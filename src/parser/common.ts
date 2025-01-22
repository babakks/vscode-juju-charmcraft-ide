import { spawn } from 'child_process';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import {
    Alias,
    Pair,
    ParsedNode,
    Scalar,
    YAMLMap,
    Range as YAMLRange,
    YAMLSeq,
    isMap,
    isScalar,
    isSeq,
    parseDocument
} from 'yaml';
import { Range, TextPositionMapper, type Problem } from '../model/common';
import { GENERIC_YAML_PROBLEMS, type MapWithNode, type SequenceWithNode, type WithNode, type YAMLNode } from '../model/yaml';
import path = require('path');


/**
 * A generic YAML parser that returns a tree of objects/arrays of type {@link WithNode<any>}.
 */
export class YAMLParser {
    readonly tpm: TextPositionMapper;
    constructor(readonly text: string) {
        this.tpm = new TextPositionMapper(text);
    }

    /**
     * @returns `undefined` if given content was not a valid YAML.
     */
    parse(): { tree: WithNode<any> | undefined; plain: any } {
        if (!this.text.trim().length) {
            return {
                plain: undefined,
                tree: {
                    value: {},
                    node: {
                        kind: 'map',
                        problems: [],
                        text: this.text,
                        range: this.tpm.all(),
                    },
                },
            };
        }
        const doc = parseDocument(this.text);
        return {
            tree: this._parseValue(doc.contents),
            plain: doc.toJS(),
        };
    }

    private _parseValue(node: Alias.Parsed | Scalar.Parsed | YAMLMap.Parsed<ParsedNode, ParsedNode | null> | YAMLSeq.Parsed<ParsedNode> | null): WithNode<any> | undefined {
        if (isMap(node)) {
            return this._parseMap(node);
        }
        if (isSeq(node)) {
            return this._parseSeq(node);
        }
        if (isScalar(node)) {
            return this._parseScalar(node);
        }
        return undefined;
    }

    private _parseMap(node: YAMLMap<ParsedNode, ParsedNode | null>): WithNode<any> {
        const range = this._nodeRangeToRange(node.range, this.tpm);
        return {
            value: Object.fromEntries(node.items.filter(x => isScalar(x.key)).map(x => [x.key.toString(), this._parsePair(x)])),
            node: {
                kind: 'map',
                range,
                text: this.tpm.getTextOverRange(range),
                raw: node,
                problems: [],
            }
        };
    }

    private _parseSeq(node: YAMLSeq<ParsedNode>): WithNode<any> {
        const range = this._nodeRangeToRange(node.range, this.tpm);
        return {
            value: node.items.map(x => this._parseValue(x)),
            node: {
                kind: 'sequence',
                range,
                text: this.tpm.getTextOverRange(range),
                raw: node,
                problems: [],
            }
        };
    }

    private _parseScalar(node: Scalar.Parsed): WithNode<any> {
        const range = this._nodeRangeToRange(node.range, this.tpm);
        return {
            value: node.value,
            node: {
                kind: 'scalar',
                range,
                text: this.tpm.getTextOverRange(range),
                raw: node,
                problems: [],
            }
        };
    }

    private _parsePair(node: Pair<ParsedNode, ParsedNode | null>): WithNode<any> {
        const range: Range = {
            start: this.tpm.indexToPosition(node.key.range[0]),
            end: node.value ? this.tpm.indexToPosition(node.value.range[2]) : this.tpm.indexToPosition(node.key.range[2]),
        };
        const value = this._parseValue(node.value);

        return {
            value,
            node: {
                kind: 'pair',
                range,
                text: this.tpm.getTextOverRange(range),
                raw: node,
                pairKeyRange: this._nodeRangeToRange(node.key.range, this.tpm),
                pairValueRange: node.value ? this._nodeRangeToRange(node.value.range, this.tpm) : undefined,
                problems: [],
            }
        };
    }

    private _nodeRangeToRange(nodeRange: YAMLRange | null | undefined, tpm: TextPositionMapper): Range {
        if (!nodeRange) {
            return { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };
        }
        return {
            start: tpm.indexToPosition(nodeRange[0]),
            end: tpm.indexToPosition(nodeRange[2]),
        };
    }
}

export type SupportedType = 'string' | 'boolean' | 'number' | 'integer';

export function valueNodeFromPairNode(pairNode: YAMLNode, valueNode: YAMLNode): YAMLNode {
    return {
        ...valueNode,
        pairKeyRange: pairNode.pairKeyRange,
        pairValueRange: pairNode.pairValueRange,
        pairText: pairNode.text,
    };
}

/**
 * If there's any problem parsing the field, the returned object's `value` property will be `undefined`.
 * @returns `undefined` if the field was missing.
 */
export function assignScalarFromPair<T>(map: WithNode<any>, key: string, t: SupportedType, required?: boolean, parentNodeProblems?: Problem[]): WithNode<T> | undefined {
    if (required && parentNodeProblems === undefined) {
        throw Error('`parentNodeProblems` cannot be `undefined` when `required` is `true`.');
    }
    if (!map.value || !(key in map.value)) {
        if (required) {
            parentNodeProblems!.push(GENERIC_YAML_PROBLEMS.missingField(key));
        }
        return undefined;
    }

    const pair: WithNode<any> = map.value[key];
    if (pair.node.kind !== 'pair') {
        return undefined;
    }

    const result: WithNode<T> = {
        node: valueNodeFromPairNode(pair.node, pair.value.node)
    };
    const value = pair.value.value;

    if (value !== undefined && (typeof value === t || t === 'integer' && typeof value === 'number' && Number.isInteger(value))) {
        result.value = value;
    } else {
        result.node.problems.push(GENERIC_YAML_PROBLEMS.unexpectedScalarType(t));
    }
    return result;
}

/**
 * If there's any problem parsing the field, the returned object's `value` property will be `undefined`.
 * @returns `undefined` if the field was missing.
 */
export function assignAnyFromPair(map: WithNode<any>, key: string, required?: boolean, parentNodeProblems?: Problem[]): WithNode<any> | undefined {
    if (required && parentNodeProblems === undefined) {
        throw Error('`parentNodeProblems` cannot be `undefined` when `required` is `true`.');
    }
    if (!map.value || !(key in map.value)) {
        if (required) {
            parentNodeProblems!.push(GENERIC_YAML_PROBLEMS.missingField(key));
        }
        return undefined;
    }

    const pair: WithNode<any> = map.value[key];
    if (pair.node.kind !== 'pair') {
        return undefined;
    }

    return {
        node: valueNodeFromPairNode(pair.node, pair.value.node),
        value: pair.value.value,
    };
}

/**
 * If there's any problem parsing the field, the returned object's `value` property will be `undefined`.
 * @returns `undefined` if the field was missing.
 */
export function assignMapFromPair<T>(map: WithNode<any>, key: string, required?: boolean, parentNodeProblems?: Problem[]): WithNode<T> | undefined {
    const result = assignAnyFromPair(map, key, required, parentNodeProblems);

    if (!result) {
        return undefined;
    }

    if (result.node.kind !== 'map') {
        result.value = undefined;
        result.node.problems.push(GENERIC_YAML_PROBLEMS.expectedMap);
        return result;
    }

    return result;
}

/**
 * If there's any problem parsing the field, the returned object's `value` property will be `undefined`.
 * @returns `undefined` if the field was missing.
 */
export function assignStringEnumFromScalarPair<T>(map: WithNode<any>, key: string, enumValues: readonly string[], required?: boolean, parentNodeProblems?: Problem[]): WithNode<T> | undefined {
    const result = assignAnyFromPair(map, key, required, parentNodeProblems);
    if (!result || result.value === undefined || result.node.problems.length) {
        return result;
    }
    if (!enumValues.includes(result.value as string)) {
        result.value = undefined;
        result.node.problems.push(GENERIC_YAML_PROBLEMS.expectedEnumValue(enumValues));
    }
    return result;
}

/**
 * If there's any problem parsing the field, the returned object's `value` property will be `undefined`.
 * @returns `undefined` if the field was missing.
 */
export function assignArrayOfScalarsFromPair<T>(map: WithNode<any>, key: string, t: SupportedType, required?: boolean, parentNodeProblems?: Problem[]): SequenceWithNode<T> | undefined {
    const initial = assignAnyFromPair(map, key, required, parentNodeProblems);
    if (!initial) {
        return undefined;
    }
    const result: SequenceWithNode<T> = {
        node: initial.node,
    };
    if (initial.value === undefined || initial.node.problems.length) {
        return result;
    }
    if (initial.node.kind !== 'sequence') {
        result.node.problems.push(GENERIC_YAML_PROBLEMS.expectedSequenceOfScalars(t));
        return result;
    }

    const sequence = initial.value;
    result.elements = [];
    for (const x of sequence as WithNode<any>[]) {
        const entry: WithNode<T> = {
            node: x.node,
        };
        result.elements.push(entry);
        if (x.node.kind === 'scalar' && x.value !== undefined && (typeof x.value === t || t === 'integer' && typeof x.value === 'number' && Number.isInteger(x.value))) {
            entry.value = x.value;
        } else {
            entry.node.problems.push(GENERIC_YAML_PROBLEMS.unexpectedScalarType(t));
        }
    }
    return result;
}

/**
 * If there's any problem parsing the field, the returned object's `value` property will be `undefined`.
 * @returns `undefined` if the field was missing.
 */
export function assignArrayOfMapsFromPair<T>(map: WithNode<any>, key: string, required?: boolean, parentNodeProblems?: Problem[]): SequenceWithNode<T> | undefined {
    const initial = assignAnyFromPair(map, key, required, parentNodeProblems);
    if (!initial) {
        return undefined;
    }
    const result: SequenceWithNode<T> = {
        node: initial.node,
    };
    if (initial.value === undefined || initial.node.problems.length) {
        return result;
    }
    if (initial.node.kind !== 'sequence') {
        result.node.problems.push(GENERIC_YAML_PROBLEMS.expectedSequence);
        return result;
    }
    result.elements = (initial.value as WithNode<any>[]).map(x => {
        if (x.node.kind !== 'map') {
            x.node.problems.push(GENERIC_YAML_PROBLEMS.expectedMap);
            x.value = undefined;
        }
        return x;
    });
    return result;
}

/**
 * If there's any problem parsing the field, the returned object's `value` property will be `undefined`.
 * @returns `undefined` if the field was missing.
 */
export function assignScalarOrArrayOfScalarsFromPair<T>(map: WithNode<any>, key: string, t: SupportedType, required?: boolean, parentNodeProblems?: Problem[]): SequenceWithNode<T> | WithNode<T> | undefined {
    const initial = assignAnyFromPair(map, key, required, parentNodeProblems);
    if (!initial) {
        return undefined;
    }
    if (initial.value === undefined || initial.node.problems.length) {
        return {
            node: initial.node,
        };
    }

    if (initial.node.kind === 'sequence') {
        return assignArrayOfScalarsFromPair(map, key, t);
    } else if (initial.node.kind === 'scalar') {
        return assignScalarFromPair(map, key, t, required, parentNodeProblems);
    } else {
        initial.node.problems.push(GENERIC_YAML_PROBLEMS.expectedScalarOrSequence(t));
        return {
            node: initial.node,
        };
    }
}

/**
 * If there's any problem parsing the field, the returned object's `value` property will be `undefined`.
 * @returns `undefined` if the field was missing.
 */
export function assignArrayOfEnumsFromPair<T>(map: WithNode<any>, key: string, enumValues: readonly string[], required?: boolean, parentNodeProblems?: Problem[]): SequenceWithNode<T> | undefined {
    const result = assignArrayOfScalarsFromPair<T>(map, key, 'string', required, parentNodeProblems);
    if (result?.elements) {
        for (const element of result?.elements) {
            if (element.value === undefined) {
                continue;
            }
            if (!enumValues.includes(element.value as string)) {
                element.value = undefined;
                element.node.problems.push(GENERIC_YAML_PROBLEMS.expectedEnumValue(enumValues));
            }
        }
    }
    return result;
}


/**
 * If there's any problem parsing the field, the returned object's `value` property will be `undefined`.
 * @returns `undefined` if the field was missing.
 */
export function assignStringEnumOrArrayOfEnumsFromPair<T>(map: WithNode<any>, key: string, enumValues: readonly string[], required?: boolean, parentNodeProblems?: Problem[]): SequenceWithNode<T> | WithNode<T> | undefined {
    const initial = assignAnyFromPair(map, key, required, parentNodeProblems);
    if (!initial) {
        return undefined;
    }
    if (initial.value === undefined || initial.node.problems.length) {
        return {
            node: initial.node,
        };
    }

    if (initial.node.kind === 'sequence') {
        return assignArrayOfEnumsFromPair<T>(map, key, enumValues, required, parentNodeProblems);
    } else if (initial.node.kind === 'scalar') {
        return assignStringEnumFromScalarPair(map, key, enumValues, required, parentNodeProblems);
    } else {
        initial.node.problems.push(GENERIC_YAML_PROBLEMS.expectedScalarOrSequence('string'));
        return {
            node: initial.node,
        };
    }
}

export function readMap<T>(map: WithNode<any>, cb: ((value: WithNode<any>, key: string, entry: WithNode<T>) => void)): MapWithNode<T> | undefined {
    const result: MapWithNode<T> = {
        node: map.node,
    };

    if (!map.value || map.node.kind !== 'map') {
        result.node.problems.push(GENERIC_YAML_PROBLEMS.expectedMap);
        return result;
    }

    result.entries = {};
    const m: { [key: string]: WithNode<any> } = map.value;
    for (const [name, pair] of Object.entries(m)) {
        const entry: WithNode<T> = {
            node: pair.node,
        };
        result.entries[name] = entry;
        cb(pair.value, name, entry);
    }
    return result;
}

export function readMapOfMap<T>(map: WithNode<any>, key: string, cb: ((map: any, key: string, entry: WithNode<T>) => void), required?: boolean, parentNodeProblems?: Problem[], acceptNull?: boolean): MapWithNode<T> | undefined {
    const initial = assignAnyFromPair(map, key, required, parentNodeProblems);
    if (!initial || initial.value === undefined) {
        return undefined;
    }
    return readMap<T>(initial, (value, key, entry) => {
        if (
            !acceptNull && (value.node.kind !== 'map' || !value.value)
            || acceptNull && (value.node.kind !== 'map' && value.value)
        ) {
            entry.node.problems.push(GENERIC_YAML_PROBLEMS.expectedMap);
            return;
        }
        cb(value, key, entry);
    });
}

export function readPlainMap<T>(map: WithNode<any>, key: string, cb: ((map: any, entry: WithNode<T>) => void), required?: boolean, parentNodeProblems?: Problem[]): WithNode<T> | undefined {
    const initial = assignAnyFromPair(map, key, required, parentNodeProblems);
    if (!initial || initial.value === undefined) {
        return undefined;
    }
    if (initial.node.kind !== 'map') {
        initial.value = undefined;
        initial.node.problems.push(GENERIC_YAML_PROBLEMS.expectedMap);
        return initial;
    }

    const result: WithNode<T> = {
        node: initial.node,
    };
    cb(initial, result);
    return result;
}

export function readSequence<T>(map: WithNode<any>, cb: ((value: WithNode<any>, element: WithNode<T>) => void)): SequenceWithNode<T> | undefined {
    const result: SequenceWithNode<T> = {
        node: map.node,
    };

    if (!map.value || map.node.kind !== 'sequence') {
        result.node.problems.push(GENERIC_YAML_PROBLEMS.expectedSequence);
        return result;
    }

    result.elements = [];
    for (const x of map.value) {
        const element: WithNode<T> = {
            node: x.node,
        };
        result.elements.push(element);
        cb(x, element);
    }
    return result;
}

export function readSequenceOfMap<T>(map: WithNode<any>, key: string, cb: ((map: any, element: WithNode<T>) => void)): SequenceWithNode<T> | undefined {
    const initial = assignAnyFromPair(map, key);
    if (!initial || initial.value === undefined) {
        return undefined;
    }
    return readSequence<T>(initial, (value, element) => {
        if (value.node.kind !== 'map' || !value.value) {
            element.node.problems.push(GENERIC_YAML_PROBLEMS.expectedMap);
            return;
        }
        cb(value, element);
    });
}

export async function getPythonAST(content: string): Promise<any | undefined> {
    const tmp = await mkdtemp(path.join(tmpdir(), 'juju-charms-ide'));
    try {
        const tmpfile = path.join(tmp, 'temp.py');
        const scriptPath = path.join(__dirname, '../../resource/ast/python-ast-to-json.py');
        await writeFile(tmpfile, content);

        const [exitCode, ast] = await new Promise<[number, string]>(function (resolve, reject) {
            let data = '';
            const process = spawn('python3', [scriptPath, tmpfile]);
            process.on('close', function (code) {
                resolve([code || 0, data]);
            });
            process.stdout.on('data', chunk => {
                data += chunk.toString();
            });
        });
        return exitCode === 0 ? JSON.parse(ast) : undefined;
    } catch {
        return undefined;
    } finally {
        await rm(tmp, { recursive: true, force: true });
    }
}

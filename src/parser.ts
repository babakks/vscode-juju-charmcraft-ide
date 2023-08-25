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
import {
    CharmAction,
    CharmActions,
    CharmAssumption,
    CharmConfig,
    CharmConfigParameter,
    CharmContainer,
    CharmContainerBase,
    CharmContainerMount,
    CharmDevice,
    CharmEndpoint,
    CharmExtraBinding,
    CharmMetadata,
    CharmResource,
    CharmStorage,
    MapWithNode,
    Problem,
    SequenceWithNode,
    WithNode,
    YAML_PROBLEMS,
    getTextOverRange
} from './model/charm';
import { Range, TextPositionMapper, toValidSymbol } from './model/common';
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
                text: getTextOverRange(this.tpm.lines, range),
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
                text: getTextOverRange(this.tpm.lines, range),
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
                text: getTextOverRange(this.tpm.lines, range),
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
                text: getTextOverRange(this.tpm.lines, range),
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

type SupportedType = 'string' | 'boolean' | 'number' | 'integer';

/**
 * If there's any problem parsing the field, the returned object's `value` property will be `undefined`.
 * @returns `undefined` if the field was missing.
 */
function assignScalarFromPair<T>(map: WithNode<any>, key: string, t: SupportedType, required?: boolean, parentNodeProblems?: Problem[]): WithNode<T> | undefined {
    if (required && parentNodeProblems === undefined) {
        throw Error('`parentNodeProblems` cannot be `undefined` when `required` is `true`.');
    }
    if (!(key in map)) {
        if (required) {
            parentNodeProblems!.push(YAML_PROBLEMS.generic.missingField(key));
        }
        return undefined;
    }

    const pair: WithNode<any> = (map as any)[key];
    if (pair.node.kind !== 'pair') {
        return undefined;
    }

    const result: WithNode<T> = {
        node: pair.value.node,
    };
    const value = pair.value.value;

    if (value !== undefined && (typeof value === t || t === 'integer' && typeof value === 'number' && Number.isInteger(value))) {
        result.value = value;
    } else {
        result.node.problems.push(YAML_PROBLEMS.generic.unexpectedScalarType(t));
    }
    return result;
}

/**
 * If there's any problem parsing the field, the returned object's `value` property will be `undefined`.
 * @returns `undefined` if the field was missing.
 */
function assignAnyFromPair(map: WithNode<any>, key: string, required?: boolean, parentNodeProblems?: Problem[]): WithNode<any> | undefined {
    if (required && parentNodeProblems === undefined) {
        throw Error('`parentNodeProblems` cannot be `undefined` when `required` is `true`.');
    }
    if (!(key in map)) {
        if (required) {
            parentNodeProblems!.push(YAML_PROBLEMS.generic.missingField(key));
        }
        return undefined;
    }

    const pair: WithNode<any> = (map as any)[key];
    if (pair.node.kind !== 'pair') {
        return undefined;
    }

    return {
        node: pair.value.node,
        value: pair.value.value,
    };
}

/**
 * If there's any problem parsing the field, the returned object's `value` property will be `undefined`.
 * @returns `undefined` if the field was missing.
 */
function assignStringEnumFromScalarPair<T>(map: WithNode<any>, key: string, enumValues: string[], required?: boolean, parentNodeProblems?: Problem[]): WithNode<T> | undefined {
    const result = assignScalarFromPair<T>(map, key, 'string', required, parentNodeProblems);
    if (!result || result.value === undefined || result.node.problems.length) {
        return result;
    }
    if (!enumValues.includes(result.value as string)) {
        result.value = undefined;
        result.node.problems.push(YAML_PROBLEMS.generic.expectedEnumValue(enumValues));
    }
    return result;
}

/**
 * If there's any problem parsing the field, the returned object's `value` property will be `undefined`.
 * @returns `undefined` if the field was missing.
 */
function assignArrayOfScalarsFromPair<T>(map: WithNode<any>, key: string, t: SupportedType, required?: boolean, parentNodeProblems?: Problem[]): SequenceWithNode<T> | undefined {
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
        result.node.problems.push(YAML_PROBLEMS.generic.expectedSequenceOfScalars(t));
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
            entry.node.problems.push(YAML_PROBLEMS.generic.unexpectedScalarType(t));
        }
    }
    return result;
}

/**
 * If there's any problem parsing the field, the returned object's `value` property will be `undefined`.
 * @returns `undefined` if the field was missing.
 */
function assignArrayOfMapsFromPair<T>(map: WithNode<any>, key: string, required?: boolean, parentNodeProblems?: Problem[]): SequenceWithNode<T> | undefined {
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
        result.node.problems.push(YAML_PROBLEMS.generic.expectedSequence);
        return result;
    }
    result.elements = (initial.value as WithNode<any>[]).map(x => {
        if (x.node.kind !== 'map') {
            x.node.problems.push(YAML_PROBLEMS.generic.expectedMap);
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
function assignScalarOrArrayOfScalarsFromPair<T>(map: WithNode<any>, key: string, t: SupportedType, required?: boolean, parentNodeProblems?: Problem[]): SequenceWithNode<T> | WithNode<T> | undefined {
    const initial = assignAnyFromPair(map, key, required, parentNodeProblems);
    if (!initial) {
        return undefined;
    }
    if (initial.value === undefined || initial.node.problems.length) {
        return {
            node: initial.node,
        };
    }

    let result: SequenceWithNode<T> | WithNode<T> | undefined;

    if (initial.node.kind === 'sequence') {
        return assignArrayOfScalarsFromPair(map, key, t);
    } else if (initial.node.kind === 'scalar') {
        return assignScalarFromPair(map, key, t, required, parentNodeProblems);
    } else {
        initial.node.problems.push(YAML_PROBLEMS.generic.expectedScalarOrSequence(t));
        return {
            node: initial.node,
        };
    }
}

export function parseCharmActionsYAML(text: string): CharmActions {
    const { tree } = new YAMLParser(text).parse();
    if (!tree) {
        return {
            actions: [],
            node: {
                kind: 'map',
                problems: [],
                text,
                range: new TextPositionMapper(text).all(),
            }
        };
    }

    const result: CharmActions = {
        actions: [],
        node: tree.node,
    };

    if (tree.node.kind !== 'map') {
        result.node.problems.push(YAML_PROBLEMS.generic.invalidYAML);
        return result;
    }

    for (const name in tree.value) {
        const item: WithNode<any> = tree.value[name];
        const entry: CharmAction = {
            name,
            symbol: toValidSymbol(name),
            node: item.node,
        };
        result.actions.push(entry);

        const map = item.value;
        if (map.node.kind !== 'map') {
            entry.node.problems.push(YAML_PROBLEMS.generic.expectedMap);
            continue;
        }

        entry.description = assignScalarFromPair(map.value, 'description', 'string');
    }

    return result;
}

export function parseCharmConfigYAML(text: string): CharmConfig {
    const { tree } = new YAMLParser(text).parse();
    if (!tree) {
        return {
            node: {
                kind: 'map',
                problems: [],
                text,
                range: new TextPositionMapper(text).all(),
            }
        };
    }

    const result: CharmConfig = {
        node: tree.node,
    };

    if (tree.node.kind !== 'map') {
        result.node.problems.push(YAML_PROBLEMS.generic.invalidYAML);
        return result;
    }

    if (!('options' in tree.value)) {
        return result;
    }

    const optionsPair: WithNode<any> = tree.value['options'];
    result.parameters = {
        value: [],
        node: optionsPair.node,
    };

    const options = optionsPair.value;
    if (options.node.kind !== 'map') {
        result.parameters.node.problems.push(YAML_PROBLEMS.generic.expectedMap);
        return result;
    }

    for (const name in options.value) {
        const item: WithNode<any> = options.value[name];
        const entry: CharmConfigParameter = {
            name,
            node: item.node,
        };
        result.parameters.value!.push(entry);

        const map = item.value;
        if (map.node.kind !== 'map') {
            entry.node.problems.push(YAML_PROBLEMS.generic.expectedMap);
            continue;
        }

        entry.type = assignStringEnumFromScalarPair(map.value, 'type', ['string', 'int', 'float', 'boolean'], true, entry.node.problems);
        entry.description = assignScalarFromPair(map.value, 'description', 'string');

        const defaultValue = assignAnyFromPair(map.value, 'default');
        if (defaultValue?.value !== undefined) {
            entry.default = defaultValue;
            if (entry.type?.value !== undefined) {
                if (
                    entry.type.value === 'string' && typeof entry.default.value !== 'string'
                    || entry.type.value === 'boolean' && typeof entry.default.value !== 'boolean'
                    || entry.type.value === 'float' && typeof entry.default.value !== 'number'
                    || entry.type.value === 'int' && (typeof entry.default.value !== 'number' || !Number.isInteger(defaultValue.value))
                ) {
                    entry.default.value = undefined; // Dropping invalid value.
                    entry.default.node.problems.push(YAML_PROBLEMS.config.wrongDefaultType(entry.type.value));
                }
            } else {
                // Parameter has no `type`, so we should check if the default value is not essentially invalid.
                if (
                    typeof entry.default.value !== 'string'
                    && typeof entry.default.value !== 'boolean'
                    && typeof entry.default.value !== 'number'
                ) {
                    entry.default.value = undefined; // Dropping invalid value.
                    entry.default.node.problems.push(YAML_PROBLEMS.config.invalidDefault);
                }
            }
        }
    }

    return result;
}

export function parseCharmMetadataYAML(text: string): CharmMetadata {
    const { tree, plain } = new YAMLParser(text).parse();
    if (!tree) {
        return {
            node: {
                kind: 'map',
                problems: [],
                text,
                range: new TextPositionMapper(text).all(),
            }
        };
    }

    const result: CharmMetadata = {
        node: tree.node,
    };

    if (tree.node.kind !== 'map') {
        result.node.problems.push(YAML_PROBLEMS.generic.invalidYAML);
        return result;
    }
    const map = tree.value;

    result.name = assignScalarFromPair(map, 'name', 'string', true, result.node.problems);
    result.displayName = assignScalarFromPair(map, 'display-name', 'string', true, result.node.problems);
    result.description = assignScalarFromPair(map, 'description', 'string', true, result.node.problems);
    result.summary = assignScalarFromPair(map, 'summary', 'string', true, result.node.problems);

    result.source = assignScalarOrArrayOfScalarsFromPair(map, 'source', 'string');
    result.issues = assignScalarOrArrayOfScalarsFromPair(map, 'issues', 'string');
    result.website = assignScalarOrArrayOfScalarsFromPair(map, 'website', 'string');

    result.maintainers = assignArrayOfScalarsFromPair(map, 'maintainers', 'string');
    result.terms = assignArrayOfScalarsFromPair(map, 'terms', 'string');

    result.docs = assignScalarFromPair(map, 'docs', 'string');
    result.subordinate = assignScalarFromPair(map, 'subordinate', 'boolean');

    result.assumes = _assumes(map, 'assumes');

    result.requires = _endpoints(map, 'requires');
    result.provides = _endpoints(map, 'provides');
    result.peers = _endpoints(map, 'peers');

    result.resources = _resources(map, 'resources');
    result.devices = _devices(map, 'devices');
    result.storage = _storage(map, 'storage');
    result.extraBindings = _extraBindings(map, 'extra-bindings');
    result.containers = _containers(map, 'containers');

    result.customFields = Object.fromEntries(Object.entries(plain).filter(([x]) => ![
        'name',
        'display-name',
        'description',
        'summary',
        'source',
        'issues',
        'website',
        'maintainers',
        'terms',
        'docs',
        'subordinate',
        'assumes',
        'requires',
        'provides',
        'peers',
        'resources',
        'devices',
        'storage',
        'extra-bindings',
        'containers',
    ].includes(x)));

    if (result.containers?.entries) {
        for (const [, container] of Object.entries(result.containers.entries)) {
            if (!container.value) {
                continue;
            }

            // Checking container resources, if any, are already defined.
            if (container.value.resource?.value !== undefined) {
                const resource = container.value.resource?.value;
                if (resource !== undefined && !Object.entries(result.resources?.entries ?? {}).find(([, v]) => v.value?.name === resource)) {
                    container.node.problems.push(YAML_PROBLEMS.metadata.containerResourceUndefined(resource));
                }
            }
            // Checking container mount storages, if any, are already defined.
            if (container.value.mounts?.elements) {
                for (let i = 0; i < container.value.mounts.elements.length; i++) {
                    const mount = container.value.mounts.elements[i];
                    const storage = mount.value?.storage?.value;
                    if (storage !== undefined && !Object.entries(result.storage?.entries ?? {}).find(([, v]) => v.value?.name === storage)) {
                        mount.node.problems.push(YAML_PROBLEMS.metadata.containerMountStorageUndefined(storage));
                    }
                }
            }
        }
    }

    return result;

    function _readMap<T>(map: WithNode<any>, key: string, cb: ((value: WithNode<any>, key: string, entry: WithNode<T>) => void)): MapWithNode<T> | undefined {
        const initial = assignAnyFromPair(map, key);
        if (!initial || initial.value === undefined) {
            return undefined;
        }
        const result: MapWithNode<T> = {
            node: initial.node,
        };

        if (!initial.value || initial.node.kind !== 'map') {
            result.node.problems.push(YAML_PROBLEMS.generic.expectedMap);
            return result;
        }

        result.entries = {};
        const m: { [key: string]: WithNode<any> } = initial.value;
        for (const [name, pair] of Object.entries(m)) {
            const entry: WithNode<T> = {
                node: pair.node,
            };
            result.entries[name] = entry;
            cb(pair.value, name, entry);
        }
        return result;
    }

    function _readMapOfMap<T>(map: WithNode<any>, key: string, cb: ((map: any, key: string, entry: WithNode<T>) => void)): MapWithNode<T> | undefined {
        return _readMap<T>(map, key, (value, key, entry) => {
            if (value.node.kind !== 'map' || !value.value) {
                entry.node.problems.push(YAML_PROBLEMS.generic.expectedMap);
                return;
            }
            cb(value.value, key, entry);
        });
    }

    function _endpoints(map: WithNode<any>, key: string): MapWithNode<CharmEndpoint> | undefined {
        return _readMapOfMap<CharmEndpoint>(map, key, (map, key, entry) => {
            entry.value = {
                name: key,
                limit: assignScalarFromPair(map, 'limit', 'integer'),
                optional: assignScalarFromPair(map, 'optional', 'boolean'),
                scope: assignStringEnumFromScalarPair(map, 'scope', ['global', 'container']),
            };
            entry.value.interface = assignScalarFromPair(map, 'interface', 'string', true, entry.node.problems);
        });
    }

    function _resources<T>(map: WithNode<any>, key: string): MapWithNode<CharmResource> | undefined {
        return _readMapOfMap<CharmResource>(map, key, (map, key, entry) => {
            entry.value = {
                name: key,
                description: assignScalarFromPair(map, 'description', 'string'),
                filename: assignScalarFromPair(map, 'filename', 'string'),
            };
            entry.value.type = assignStringEnumFromScalarPair(map, 'type', ['file', 'oci-image'], true, entry.node.problems);

            if (entry.value.type?.value) {
                const t = entry.value.type.value;
                if (t === 'file' && !entry.value.filename) {
                    entry.node.problems.push(YAML_PROBLEMS.metadata.resourceExpectedFilenameForFileResource);
                } else if (t !== 'file' && entry.value.filename) {
                    entry.value.filename.node.problems.push(YAML_PROBLEMS.metadata.resourceUnexpectedFilenameForNonFileResource);
                }
            }
        });
    }

    function _devices(map: WithNode<any>, key: string): MapWithNode<CharmDevice> | undefined {
        return _readMapOfMap<CharmDevice>(map, key, (map, key, entry) => {
            entry.value = {
                name: key,
                description: assignScalarFromPair(map, 'description', 'string'),
                countMin: assignScalarFromPair(map, 'countmin', 'integer'),
                countMax: assignScalarFromPair(map, 'countmax', 'integer'),
            };
            entry.value.type = assignStringEnumFromScalarPair(map, 'type', ['gpu', 'nvidia.com/gpu', 'amd.com/gpu'], true, entry.node.problems);
        });
    }

    function _storage(map: WithNode<any>, key: string): MapWithNode<CharmStorage> | undefined {
        return _readMapOfMap<CharmStorage>(map, key, (map, key, entry) => {
            entry.value = {
                name: key,
                description: assignScalarFromPair(map, 'description', 'string'),
                location: assignScalarFromPair(map, 'location', 'string'),
                shared: assignScalarFromPair(map, 'shared', 'boolean'),
                readOnly: assignScalarFromPair(map, 'read-only', 'boolean'),
            };
            entry.value.type = assignStringEnumFromScalarPair(map, 'type', ['filesystem', 'block'], true, entry.node.problems);

            entry.value.properties = assignArrayOfScalarsFromPair(map, 'properties', 'string');
            if (entry.value.properties?.elements) {
                const supported = ['transient'];
                for (const e of entry.value.properties.elements) {
                    if (e.value !== undefined && !supported.includes(e.value)) {
                        e.node.problems.push(YAML_PROBLEMS.generic.expectedEnumValue(supported));
                        e.value = undefined;
                    }
                }
            }

            const multipleAsInt = assignScalarFromPair<number>(map, 'multiple', 'integer');
            if (multipleAsInt?.value !== undefined) {
                entry.value.multiple = {
                    node: multipleAsInt.node,
                    value: multipleAsInt.value.toString(),
                };
            } else {
                entry.value.multiple = assignScalarFromPair<string>(map, 'multiple', 'string');
                if (entry.value.multiple?.value !== undefined) {
                    if (!entry.value.multiple.value.match(/\d+(\+|-)?|\d+-\d+/)) {
                        entry.value.multiple.node.problems.push(YAML_PROBLEMS.metadata.storageMultipleInvalid);
                        entry.value.multiple.value = undefined;
                    }
                }
            }

            const minimumSizeAsInt = assignScalarFromPair<number>(map, 'minimum-size', 'integer');
            if (minimumSizeAsInt?.value !== undefined) {
                entry.value.minimumSize = {
                    node: minimumSizeAsInt.node,
                    value: minimumSizeAsInt.value.toString(),
                };
            } else {
                entry.value.minimumSize = assignScalarFromPair<string>(map, 'minimum-size', 'string');
                if (entry.value.minimumSize?.value !== undefined) {
                    if (!entry.value.minimumSize.value.match(/\d+[MGTPEZY]?/)) {
                        entry.value.minimumSize.node.problems.push(YAML_PROBLEMS.metadata.storageMinimumSizeInvalid);
                        entry.value.minimumSize.value = undefined;
                    }
                }
            }
        });
    }

    function _extraBindings(map: WithNode<any>, key: string): MapWithNode<CharmExtraBinding> | undefined {
        return _readMap<CharmExtraBinding>(map, key, (value, key, entry) => {
            entry.value = {
                name: key,
            };
            if (value.value !== null) {
                entry.node.problems.push(YAML_PROBLEMS.generic.expectedNull);
            }
        });
    }

    function _containers(map: WithNode<any>, key: string): MapWithNode<CharmContainer> | undefined {
        return _readMapOfMap<CharmContainer>(map, key, (map, key, entry) => {
            entry.value = {
                name: key,
                resource: assignScalarFromPair(map, 'resource', 'string'),
            };

            const bases = assignArrayOfMapsFromPair(map, 'bases');
            if (bases?.elements) {
                entry.value.bases = {
                    node: bases.node,
                    elements: bases.elements.map(e => ({
                        node: e.node,
                        value: e.value === undefined ? undefined : ((e: WithNode<any>) => {
                            const result: CharmContainerBase = {
                                architectures: assignArrayOfScalarsFromPair(e.value, 'architectures', 'string'),
                            };
                            result.name = assignScalarFromPair(e.value, 'name', 'string', true, e.node.problems);
                            result.channel = assignScalarFromPair(e.value, 'channel', 'string', true, e.node.problems);
                            return result;
                        })(e),
                    })),
                };
            }

            if (entry.value.resource === undefined && entry.value.bases === undefined) {
                entry.node.problems.push(YAML_PROBLEMS.metadata.containerExpectedResourceOrBases);
            } else if (entry.value.resource !== undefined && entry.value.bases !== undefined) {
                entry.node.problems.push(YAML_PROBLEMS.metadata.containerExpectedOnlyResourceOrBases);
            }

            const mounts = assignArrayOfMapsFromPair(map, 'mounts');
            if (mounts?.elements) {
                entry.value.mounts = {
                    node: mounts.node,
                    elements: mounts.elements.map(e => ({
                        node: e.node,
                        value: e.value === undefined ? undefined : ((e: WithNode<any>) => {
                            const result: CharmContainerMount = {
                                location: assignScalarFromPair(e.value, 'location', 'string'),
                            };
                            result.storage = assignScalarFromPair(e.value, 'storage', 'string', true, e.node.problems);
                            return result;
                        })(e),
                    })),
                };
            }
        });
    }

    function _assumes(map: WithNode<any>, key: string): SequenceWithNode<CharmAssumption> | undefined {
        const initial = assignAnyFromPair(map, key);
        if (!initial || initial.value === undefined) {
            return undefined;
        }
        const result: SequenceWithNode<CharmAssumption> = {
            node: initial.node,
        };

        if (!initial.value || initial.node.kind !== 'sequence') {
            result.node.problems.push(YAML_PROBLEMS.generic.expectedSequence);
            return result;
        }

        result.elements = [];
        const sequence: WithNode<any>[] = initial.value;
        for (let i = 0; i < sequence.length; i++) {
            const element = sequence[i];
            const entry: WithNode<CharmAssumption> = {
                node: element.node,
            };
            result.elements.push(entry);

            if (element.value !== undefined && element.node.kind === 'scalar' && typeof element.value === 'string') {
                // TODO check for value format.
                entry.value = {
                    single: {
                        node: element.node,
                        value: element.value,
                    },
                };
            } else if (element.value !== undefined && element.node.kind === 'map') {
                const map = element.value;
                const keys = Object.keys(map);
                if (keys.length === 1 && keys[0] === 'all-of') {
                    // TODO check for value format.
                    entry.value = {
                        allOf: assignArrayOfScalarsFromPair<string>(map, 'all-of', 'string'),
                    };
                } else if (keys.length === 1 && keys[0] === 'any-of') {
                    // TODO check for value format.
                    entry.value = {
                        anyOf: assignArrayOfScalarsFromPair<string>(map, 'any-of', 'string'),
                    };
                } else {
                    entry.node.problems.push(YAML_PROBLEMS.metadata.assumptionExpectedAnyOfOrAllOf);
                }
            } else {
                entry.node.problems.push(YAML_PROBLEMS.metadata.assumptionExpected);
            }
        }
        return result;
    }
}

export async function getPythonAST(content: string): Promise<any | undefined> {
    const tmp = await mkdtemp(path.join(tmpdir(), 'juju-charms-ide'));
    try {
        const tmpfile = path.join(tmp, 'temp.py');
        const scriptPath = path.join(__dirname, '../resource/ast/python-ast-to-json.py');
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

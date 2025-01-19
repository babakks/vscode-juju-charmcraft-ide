import { Range, type Problem } from "./common";

/**
 * Generic YAML file problems.
 */
export const GENERIC_YAML_PROBLEMS = {
    invalidYAML: { id: 'invalidYAML', message: "Invalid YAML file." },
    missingField: (key: string) => ({ id: 'missingField', key, message: `Missing \`${key}\` field.` }),
    unexpectedScalarType: (expected: 'string' | 'integer' | 'number' | 'boolean') => ({ id: 'unexpectedScalarType', expected, message: `Must be ${expected === 'integer' ? 'an' : 'a'} ${expected}.` }),
    expectedSequenceOfScalars: (expected: 'string' | 'integer' | 'number' | 'boolean') => ({ id: 'expectedSequenceOfScalars', expected, message: `Must be a sequence of ${expected} values.` }),
    expectedScalarOrSequence: (expected: 'string' | 'integer' | 'number' | 'boolean') => ({ id: 'expectedScalarOrSequence', expected, message: `Must be ${expected === 'integer' ? 'an' : 'a'} ${expected} or a sequence of them.` }),
    expectedMap: { id: 'expectedMap', message: `Must be a map.` },
    expectedSequence: { id: 'expectedSequence', message: `Must be a sequence.` },
    expectedEnumValue: (expected: readonly string[]) => ({ id: 'expectedEnumValue', expected, message: `Must be one of the following: ${expected.map(x => `\`${x}\``).join(', ')}.` }),
    expectedNull: { id: 'expectedNull', message: 'Must be null' },
} satisfies Record<string, Problem | ((...args: any[]) => Problem)>;

export interface YAMLNode {
    kind?: 'map' | 'sequence' | 'pair' | 'scalar';
    range?: Range;
    pairKeyRange?: Range;
    pairValueRange?: Range;
    problems: Problem[];
    /**
     * Raw node returned by the underlying YAML parser/tokenizer library.
     */
    raw?: any;
    /**
     * Raw text content, corresponding to the {@link range `range`} property.
     */
    text: string;
    pairText?: string;
}

type AttachedNode = {
    node: YAMLNode;
};

export type WithNode<T> = AttachedNode & {
    value?: T;
};

export function isWithNode<T>(v: any): v is WithNode<T> {
    return 'value' in v;
}

export type SequenceWithNode<T> = AttachedNode & {
    elements?: WithNode<T>[];
};

export function isSequenceWithNode<T>(v: any): v is SequenceWithNode<T> {
    return typeof v === 'object'
        && !Array.isArray(v)
        && 'elements' in v
        && Array.isArray(v['elements']);
}

export type MapWithNode<T> = AttachedNode & {
    entries?: { [key: string]: WithNode<T> };
};

export function isMapWithNode<T>(v: any): v is MapWithNode<T> {
    return typeof v === 'object'
        && !Array.isArray(v)
        && 'entries' in v
        && typeof v['entries'] === 'object'
        && !Array.isArray(v['entries']);
}

export function emptyYAMLNode(): YAMLNode {
    return {
        text: '',
        raw: {},
        problems: [],
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
    };
}

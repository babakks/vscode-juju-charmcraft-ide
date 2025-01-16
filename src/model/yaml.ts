import { Range } from "./common";

export interface Problem {
    message: string;
    /**
     * Should be used for further identification of a problem type (e.g., to provide fix suggestions).
     */
    id?: string;
    key?: string;
    index?: number;
    /**
     * Supplementary data for further usage (e.g., when providing fix suggestions).
     */
    [key: string]: any;
}

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
    expectedEnumValue: (expected: readonly string[]) => ({ id: 'expectedEnumValue', expected, message: `Must be one of the following: ${expected.join(', ')}.` }),
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

export type SequenceWithNode<T> = AttachedNode & {
    elements?: WithNode<T>[];
};

export type MapWithNode<T> = AttachedNode & {
    entries?: { [key: string]: WithNode<T> };
};

export function emptyYAMLNode(): YAMLNode {
    return {
        text: '',
        raw: {},
        problems: [],
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
    };
}

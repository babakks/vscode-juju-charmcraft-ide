import { assert } from "chai";
import { suite, test } from "mocha";
import { TextDecoder } from "util";
import { Problem, CharmMetadata, CharmAction, CharmConfigParameter, emptyYAMLNode, CharmConfig, SequenceWithNode, CharmActions, WithNode, MapWithNode, CharmToxConfig } from "../model/charm";
import { YAMLParser, parseCharmActionsYAML, parseCharmConfigYAML, parseCharmMetadataYAML, parseToxINI } from "../parser";
import path = require("path");
import { readFileSync } from "fs";
import { Range } from "../model/common";

function cursorOverMap<T>(map: MapWithNode<T> | undefined) {
    let index = -1;
    const entries = Object.entries(map?.entries ?? {});
    return {
        next() { return entries[++index][1]; },
        get current() { return entries[index][1]; },
    };
}

function newRange(startLine: number, startCharacter: number, endLine: number, endCharacter: number): Range {
    return {
        start: { line: startLine, character: startCharacter },
        end: { line: endLine, character: endCharacter },
    };
}

function unindent(s: string): string {
    const lines = s.split('\n');
    if (lines[0] !== '') {
        throw new Error('First line should be empty');
    }
    lines.splice(0, 1);

    let indent = 0;
    let index = 0;
    const pattern = /^(\s+)/;
    for (; index < lines.length; index++) {
        const match = lines[index].match(pattern);
        if (match) {
            indent = match[1].length;
            break;
        }
    }
    return lines.map((x, i) => i >= index ? x.substring(indent) : x).join('\n').trimEnd();
}

suite(YAMLParser.name, function () {
    suite(YAMLParser.prototype.parse.name, function () {
        function parse(content: string) {
            return new YAMLParser(content).parse().tree;
        }

        suite('empty', function () {
            type TestCase = {
                name: string;
                content: string;
                expectedRange: Range;
            };
            const tests: TestCase[] = [
                {
                    name: 'empty',
                    content: '',
                    expectedRange: newRange(0, 0, 0, 0),
                }, {
                    name: 'whitespace',
                    content: ' ',
                    expectedRange: newRange(0, 0, 1, 0),
                }, {
                    name: '\\n',
                    content: '\n',
                    expectedRange: newRange(0, 0, 1, 0),
                }, {
                    name: 'mixed whitespace and \\n',
                    content: ' \n  \n ',
                    expectedRange: newRange(0, 0, 3, 0),
                },
            ];

            for (const t of tests) {
                const tt = t;
                test(tt.name, function () {
                    assert.deepInclude(parse(tt.content), {
                        value: {},
                        node: {
                            kind: 'map',
                            problems: [],
                            text: tt.content,
                            range: tt.expectedRange,
                        },
                    });
                });
            }
        });

        test('map', function () {
            const content = unindent(`
                a:
                  aa: 0
                b:
                  bb: 0
                c: 0
            `);

            const root = parse(content)!;

            assert.isDefined(root);
            assert.deepInclude(root.node, {
                kind: 'map',
                problems: [],
                range: newRange(0, 0, 5, 0),
                text: content,
            });
            assert.hasAllKeys(root.value, ['a', 'b', 'c']);

            // a
            assert.deepInclude(root.value['a'].node, {
                kind: 'pair',
                problems: [],
                range: newRange(0, 0, 2, 0),
                text: 'a:\n  aa: 0',
                pairKeyRange: newRange(0, 0, 0, 1),
                pairValueRange: newRange(1, 2, 2, 0),
            });

            assert.deepInclude(root.value['a'].value.node, {
                kind: 'map',
                problems: [],
                range: newRange(1, 2, 2, 0),
                text: 'aa: 0',
            });
            assert.hasAllKeys(root.value['a'].value.value, ['aa']);

            assert.deepInclude(root.value['a'].value.value['aa'].node, {
                kind: 'pair',
                problems: [],
                range: newRange(1, 2, 2, 0),
                text: 'aa: 0',
                pairKeyRange: newRange(1, 2, 1, 4),
                pairValueRange: newRange(1, 6, 2, 0),
            });

            assert.deepInclude(root.value['a'].value.value['aa'].value.node, {
                kind: 'scalar',
                problems: [],
                range: newRange(1, 6, 2, 0),
                text: '0',
            });
            assert.deepStrictEqual(root.value['a'].value.value['aa'].value.value, 0);

            // b
            assert.deepInclude(root.value['b'].node, {
                kind: 'pair',
                problems: [],
                range: newRange(2, 0, 4, 0),
                text: 'b:\n  bb: 0',
                pairKeyRange: newRange(2, 0, 2, 1),
                pairValueRange: newRange(3, 2, 4, 0),
            });

            assert.deepInclude(root.value['b'].value.node, {
                kind: 'map',
                problems: [],
                range: newRange(3, 2, 4, 0),
                text: 'bb: 0',
            });
            assert.hasAllKeys(root.value['b'].value.value, ['bb']);

            assert.deepInclude(root.value['b'].value.value['bb'].node, {
                kind: 'pair',
                problems: [],
                range: newRange(3, 2, 4, 0),
                text: 'bb: 0',
                pairKeyRange: newRange(3, 2, 3, 4),
                pairValueRange: newRange(3, 6, 4, 0),
            });

            assert.deepInclude(root.value['b'].value.value['bb'].value.node, {
                kind: 'scalar',
                problems: [],
                range: newRange(3, 6, 4, 0),
                text: '0',
            });
            assert.deepStrictEqual(root.value['b'].value.value['bb'].value.value, 0);

            // c
            assert.deepInclude(root.value['c'].node, {
                kind: 'pair',
                problems: [],
                range: newRange(4, 0, 5, 0),
                text: 'c: 0',
                pairKeyRange: newRange(4, 0, 4, 1),
                pairValueRange: newRange(4, 3, 5, 0),
            });

            assert.deepInclude(root.value['c'].value.node, {
                kind: 'scalar',
                problems: [],
                range: newRange(4, 3, 5, 0),
                text: '0',
            });
            assert.deepStrictEqual(root.value['c'].value.value, 0);
        });

        test('sequence', function () {
            const content = unindent(`
                - 0
                - 1
            `);

            const root = parse(content)!;

            assert.isDefined(root);
            assert.deepInclude(root.node, {
                kind: 'sequence',
                problems: [],
                range: newRange(0, 0, 2, 0),
                text: content,
            });

            // 0
            assert.deepInclude(root.value[0].node, {
                kind: 'scalar',
                problems: [],
                range: newRange(0, 2, 1, 0),
                text: '0',
            });
            assert.deepStrictEqual(root.value[0].value, 0);

            // 1
            assert.deepInclude(root.value[1].node, {
                kind: 'scalar',
                problems: [],
                range: newRange(1, 2, 2, 0),
                text: '1',
            });
            assert.deepStrictEqual(root.value[1].value, 1);
        });

        test('scalar types', function () {
            const content = unindent(`
                a-null:
                an-empty-string: ""
                a-string: something
                a-number: 999
                a-false: false
                a-true: true
            `);

            const root = parse(content)!;

            assert.isDefined(root);
            assert.deepInclude(root.node, {
                kind: 'map',
                problems: [],
                range: newRange(0, 0, 6, 0),
                text: content,
            });
            assert.hasAllKeys(root.value, ['a-null', 'an-empty-string', 'a-string', 'a-number', 'a-false', 'a-true']);

            // a-null
            assert.deepInclude(root.value['a-null'].node, {
                kind: 'pair',
                problems: [],
                range: newRange(0, 0, 0, 7),
                text: 'a-null:',
                pairKeyRange: newRange(0, 0, 0, 6),
                pairValueRange: newRange(0, 7, 0, 7),
            });
            assert.deepInclude(root.value['a-null'].value.node, {
                kind: 'scalar',
                problems: [],
                range: newRange(0, 7, 0, 7),
                text: '',
            });
            assert.deepStrictEqual(root.value['a-null'].value.value, null);

            // an-empty-string
            assert.deepInclude(root.value['an-empty-string'].node, {
                kind: 'pair',
                problems: [],
                range: newRange(1, 0, 2, 0),
                text: 'an-empty-string: ""',
                pairKeyRange: newRange(1, 0, 1, 15),
                pairValueRange: newRange(1, 17, 2, 0),
            });
            assert.deepInclude(root.value['an-empty-string'].value.node, {
                kind: 'scalar',
                problems: [],
                range: newRange(1, 17, 2, 0),
                text: '""',
            });
            assert.deepStrictEqual(root.value['an-empty-string'].value.value, '');

            // a-string
            assert.deepInclude(root.value['a-string'].node, {
                kind: 'pair',
                problems: [],
                range: newRange(2, 0, 3, 0),
                text: 'a-string: something',
                pairKeyRange: newRange(2, 0, 2, 8),
                pairValueRange: newRange(2, 10, 3, 0),
            });
            assert.deepInclude(root.value['a-string'].value.node, {
                kind: 'scalar',
                problems: [],
                range: newRange(2, 10, 3, 0),
                text: 'something',
            });
            assert.deepStrictEqual(root.value['a-string'].value.value, 'something');

            // a-number
            assert.deepInclude(root.value['a-number'].node, {
                kind: 'pair',
                problems: [],
                range: newRange(3, 0, 4, 0),
                text: 'a-number: 999',
                pairKeyRange: newRange(3, 0, 3, 8),
                pairValueRange: newRange(3, 10, 4, 0),
            });
            assert.deepInclude(root.value['a-number'].value.node, {
                kind: 'scalar',
                problems: [],
                range: newRange(3, 10, 4, 0),
                text: '999',
            });
            assert.deepStrictEqual(root.value['a-number'].value.value, 999);

            // a-false
            assert.deepInclude(root.value['a-false'].node, {
                kind: 'pair',
                problems: [],
                range: newRange(4, 0, 5, 0),
                text: 'a-false: false',
                pairKeyRange: newRange(4, 0, 4, 7),
                pairValueRange: newRange(4, 9, 5, 0),
            });
            assert.deepInclude(root.value['a-false'].value.node, {
                kind: 'scalar',
                problems: [],
                range: newRange(4, 9, 5, 0),
                text: 'false',
            });
            assert.deepStrictEqual(root.value['a-false'].value.value, false);

            // a-true
            assert.deepInclude(root.value['a-true'].node, {
                kind: 'pair',
                problems: [],
                range: newRange(5, 0, 6, 0),
                text: 'a-true: true',
                pairKeyRange: newRange(5, 0, 5, 6),
                pairValueRange: newRange(5, 8, 6, 0),
            });
            assert.deepInclude(root.value['a-true'].value.node, {
                kind: 'scalar',
                problems: [],
                range: newRange(5, 8, 6, 0),
                text: 'true',
            });
            assert.deepStrictEqual(root.value['a-true'].value.value, true);
        });
    });
});

suite(parseCharmActionsYAML.name, function () {
    function allProblems(actions: CharmActions): Problem[] {
        return [
            ...actions.node.problems,
            ...Object.entries(actions.actions?.entries ?? {}).map(([, x]) => [
                ...x.node.problems,
                ...x.value?.description?.node.problems || [],
            ]).flat(),
        ];
    }

    test('valid', function () {
        const content = unindent(`
            action-empty: {}
            action-with-description-empty:
              description: ""
            action-with-description:
              description: description
        `);

        const actions = parseCharmActionsYAML(content);

        assert.hasAllKeys(actions.actions?.entries, [
            'action-empty',
            'action-with-description-empty',
            'action-with-description',
        ]);
        assert.isEmpty(allProblems(actions), 'problem in some action(s)');

        const c = cursorOverMap(actions.actions);

        c.next();
        assert.equal(c.current.value?.name, 'action-empty');
        assert.equal(c.current.value?.symbol, 'action_empty');
        assert.isUndefined(c.current.value?.description);
        assert.equal(c.current.node.text, 'action-empty: {}');


        c.next();
        assert.equal(c.current.value?.name, 'action-with-description-empty');
        assert.equal(c.current.value?.symbol, 'action_with_description_empty');
        assert.equal(c.current.node.text, 'action-with-description-empty:\n  description: ""');
        assert.equal(c.current.value?.description?.value, '');
        assert.equal(c.current.value?.description?.node.pairText, 'description: ""');
        assert.equal(c.current.value?.description?.node.text, '""');

        c.next();
        assert.equal(c.current.value?.name, 'action-with-description');
        assert.equal(c.current.value?.symbol, 'action_with_description');
        assert.equal(c.current.node.text, 'action-with-description:\n  description: description');
        assert.equal(c.current.value?.description?.value, 'description');
        assert.equal(c.current.value?.description?.node.pairText, 'description: description');
        assert.equal(c.current.value?.description?.node.text, 'description');
    });

    test('invalid', function () {
        const content = unindent(`
            action-array-empty: []
            action-array:
              - element
            action-string: something
            action-number: 0
            action-invalid-description-array-empty:
              description: []
            action-invalid-description-array:
              description:
                - element
            action-invalid-description-number:
              description: 0
        `);

        const actions = parseCharmActionsYAML(content);
        assert.lengthOf(actions.node.problems, 0, 'expected no file-scope problem');

        const c = cursorOverMap(actions.actions);

        c.next();
        assert.strictEqual(c.current.value?.name, 'action-array-empty');
        assert.strictEqual(c.current.value?.symbol, 'action_array_empty');
        assert.strictEqual(c.current.node.text, 'action-array-empty: []');
        assert.deepStrictEqual(c.current.node.problems, [{ id: 'expectedMap', message: 'Must be a map.' }]);
        assert.isUndefined(c.current.value?.description);

        c.next();
        assert.strictEqual(c.current.value?.name, 'action-array');
        assert.strictEqual(c.current.value?.symbol, 'action_array');
        assert.strictEqual(c.current.node.text, 'action-array:\n  - element');
        assert.deepStrictEqual(c.current.node.problems, [{ id: 'expectedMap', message: 'Must be a map.' }]);
        assert.isUndefined(c.current.value?.description);

        c.next();
        assert.strictEqual(c.current.value?.name, 'action-string');
        assert.strictEqual(c.current.value?.symbol, 'action_string');
        assert.strictEqual(c.current.node.text, 'action-string: something');
        assert.deepStrictEqual(c.current.node.problems, [{ id: 'expectedMap', message: 'Must be a map.' }]);
        assert.isUndefined(c.current.value?.description);

        c.next();
        assert.strictEqual(c.current.value?.name, 'action-number');
        assert.strictEqual(c.current.value?.symbol, 'action_number');
        assert.strictEqual(c.current.node.text, 'action-number: 0');
        assert.deepStrictEqual(c.current.node.problems, [{ id: 'expectedMap', message: 'Must be a map.' }]);
        assert.isUndefined(c.current.value?.description);

        c.next();
        assert.strictEqual(c.current.value?.name, 'action-invalid-description-array-empty');
        assert.strictEqual(c.current.value?.symbol, 'action_invalid_description_array_empty');
        assert.strictEqual(c.current.node.text, 'action-invalid-description-array-empty:\n  description: []');
        assert.isEmpty(c.current.node.problems);
        assert.deepStrictEqual(c.current.value?.description?.node.problems, [{
            expected: 'string',
            id: 'unexpectedScalarType',
            message: 'Must be a string.',
        }]);
        assert.isUndefined(c.current.value?.description?.value);
        assert.strictEqual(c.current.value?.description?.node.pairText, 'description: []');
        assert.strictEqual(c.current.value?.description?.node.text, '[]');

        c.next();
        assert.strictEqual(c.current.value?.name, 'action-invalid-description-array');
        assert.strictEqual(c.current.value?.symbol, 'action_invalid_description_array');
        assert.strictEqual(c.current.node.text, 'action-invalid-description-array:\n  description:\n    - element');
        assert.isEmpty(c.current.node.problems);
        assert.deepStrictEqual(c.current.value?.description?.node.problems, [{
            expected: 'string',
            id: 'unexpectedScalarType',
            message: 'Must be a string.',
        }]);
        assert.isUndefined(c.current.value?.description?.value);
        assert.strictEqual(c.current.value?.description?.node.pairText, 'description:\n    - element');
        assert.strictEqual(c.current.value?.description?.node.text, '- element');

        c.next();
        assert.strictEqual(c.current.value?.name, 'action-invalid-description-number');
        assert.strictEqual(c.current.value?.symbol, 'action_invalid_description_number');
        assert.strictEqual(c.current.node.text, 'action-invalid-description-number:\n  description: 0');
        assert.isEmpty(c.current.node.problems);
        assert.deepStrictEqual(c.current.value?.description?.node.problems, [{
            expected: 'string',
            id: 'unexpectedScalarType',
            message: 'Must be a string.',
        }]);
        assert.isUndefined(c.current.value?.description?.value);
        assert.strictEqual(c.current.value?.description?.node.pairText, 'description: 0');
        assert.strictEqual(c.current.value?.description?.node.text, '0');
    });

    suite('special cases (with no action data)', function () {
        const tests: { name: string; content: string; expectedProblems: Problem[]; expectedEntries: any; }[] = [
            {
                name: 'empty',
                content: '',
                expectedProblems: [],
                expectedEntries: {},
            },
            {
                name: 'whitespace',
                content: ' \n \n ',
                expectedProblems: [],
                expectedEntries: {},
            },
            {
                name: 'scalar',
                content: '123',
                expectedProblems: [{ id: 'expectedMap', message: 'Must be a map.' }],
                expectedEntries: undefined,
            },
            {
                name: 'sequence (empty)',
                content: '[]',
                expectedProblems: [{ id: 'expectedMap', message: 'Must be a map.' }],
                expectedEntries: undefined,
            },
            {
                name: 'sequence',
                content: '- element',
                expectedProblems: [{ id: 'expectedMap', message: 'Must be a map.' }],
                expectedEntries: undefined,
            },
        ];

        for (const t of tests) {
            const tt = t;
            test(tt.name, function () {
                const { actions, node } = parseCharmActionsYAML(tt.content);
                assert.deepStrictEqual(actions?.entries, tt.expectedEntries);
                assert.includeDeepMembers(node.problems, tt.expectedProblems);
            });
        }
    });
});


suite(parseCharmConfigYAML.name, function () {
    function allProblems(config: CharmConfig): Problem[] {
        return [
            ...config.node.problems,
            ...config.parameters?.node.problems ?? [],
            ...(Object.entries(config.parameters?.entries ?? {})).map(([, x]) => [
                ...x.node.problems,
                ...x.value?.type?.node.problems || [],
                ...x.value?.description?.node.problems || [],
                ...x.value?.default?.node.problems || [],
            ]).flat(),
        ];
    }

    test('valid', function () {
        const content = unindent(`
            options:
              int-param-full:
                type: int
                description: some description
                default: -1
              float-param-full:
                type: float
                description: some description
                default: -1e-1
              string-param-full:
                type: string
                description: some description
                default: hello
              boolean-param-full:
                type: boolean
                description: some description
                default: false
              int-param-minimal:
                type: int
              float-param-minimal:
                type: float
              string-param-minimal:
                type: string
              boolean-param-minimal:
                type: boolean
              int-param-with-default:
                type: int
                default: -1
              float-param-with-default:
                type: float
                default: -1e-1
              string-param-with-default:
                type: string
                default: hello
              boolean-param-with-default:
                type: boolean
                default: false
              int-param-with-description:
                type: int
                description: some description
              float-param-with-description:
                type: float
                description: some description
              string-param-with-description:
                type: string
                description: some description
              boolean-param-with-description:
                type: boolean
                description: some description
        `);

        const config = parseCharmConfigYAML(content);

        assert.isEmpty(config.node.problems, 'expected no file-scope problem');
        assert.isEmpty(allProblems(config), 'problem in some parameter(s)');
        assert.hasAllKeys(config.parameters?.entries, [
            'int-param-full',
            'float-param-full',
            'string-param-full',
            'boolean-param-full',
            'int-param-minimal',
            'float-param-minimal',
            'string-param-minimal',
            'boolean-param-minimal',
            'int-param-with-default',
            'float-param-with-default',
            'string-param-with-default',
            'boolean-param-with-default',
            'int-param-with-description',
            'float-param-with-description',
            'string-param-with-description',
            'boolean-param-with-description',
        ]);

        const c = cursorOverMap(config.parameters);

        c.next();
        assert.strictEqual(c.current.value?.name, 'int-param-full');
        assert.strictEqual(c.current.value?.type?.value, 'int');
        assert.strictEqual(c.current.value?.description?.value, 'some description');
        assert.strictEqual(c.current.value?.default?.value, -1);

        c.next();
        assert.strictEqual(c.current.value?.name, 'float-param-full');
        assert.strictEqual(c.current.value?.type?.value, 'float');
        assert.strictEqual(c.current.value?.description?.value, 'some description');
        assert.strictEqual(c.current.value?.default?.value, -1e-1);

        c.next();
        assert.strictEqual(c.current.value?.name, 'string-param-full');
        assert.strictEqual(c.current.value?.type?.value, 'string');
        assert.strictEqual(c.current.value?.description?.value, 'some description');
        assert.strictEqual(c.current.value?.default?.value, 'hello');

        c.next();
        assert.strictEqual(c.current.value?.name, 'boolean-param-full');
        assert.strictEqual(c.current.value?.type?.value, 'boolean');
        assert.strictEqual(c.current.value?.description?.value, 'some description');
        assert.strictEqual(c.current.value?.default?.value, false);

        c.next();
        assert.strictEqual(c.current.value?.name, 'int-param-minimal');
        assert.strictEqual(c.current.value?.type?.value, 'int');
        assert.isUndefined(c.current.value?.description);
        assert.isUndefined(c.current.value?.default);

        c.next();
        assert.strictEqual(c.current.value?.name, 'float-param-minimal');
        assert.strictEqual(c.current.value?.type?.value, 'float');
        assert.isUndefined(c.current.value?.description);
        assert.isUndefined(c.current.value?.default);

        c.next();
        assert.strictEqual(c.current.value?.name, 'string-param-minimal');
        assert.strictEqual(c.current.value?.type?.value, 'string');
        assert.isUndefined(c.current.value?.description);
        assert.isUndefined(c.current.value?.default);

        c.next();
        assert.strictEqual(c.current.value?.name, 'boolean-param-minimal');
        assert.strictEqual(c.current.value?.type?.value, 'boolean');
        assert.isUndefined(c.current.value?.description);
        assert.isUndefined(c.current.value?.default);

        c.next();
        assert.strictEqual(c.current.value?.name, 'int-param-with-default');
        assert.strictEqual(c.current.value?.type?.value, 'int');
        assert.strictEqual(c.current.value?.default?.value, -1);
        assert.isUndefined(c.current.value?.description);

        c.next();
        assert.strictEqual(c.current.value?.name, 'float-param-with-default');
        assert.strictEqual(c.current.value?.type?.value, 'float');
        assert.strictEqual(c.current.value?.default?.value, -1e-1);
        assert.isUndefined(c.current.value?.description);

        c.next();
        assert.strictEqual(c.current.value?.name, 'string-param-with-default');
        assert.strictEqual(c.current.value?.type?.value, 'string');
        assert.strictEqual(c.current.value?.default?.value, 'hello');
        assert.isUndefined(c.current.value?.description);

        c.next();
        assert.strictEqual(c.current.value?.name, 'boolean-param-with-default');
        assert.strictEqual(c.current.value?.type?.value, 'boolean');
        assert.strictEqual(c.current.value?.default?.value, false);
        assert.isUndefined(c.current.value?.description);

        c.next();
        assert.strictEqual(c.current.value?.name, 'int-param-with-description');
        assert.strictEqual(c.current.value?.type?.value, 'int');
        assert.strictEqual(c.current.value?.description?.value, 'some description');
        assert.isUndefined(c.current.value?.default);

        c.next();
        assert.strictEqual(c.current.value?.name, 'float-param-with-description');
        assert.strictEqual(c.current.value?.type?.value, 'float');
        assert.strictEqual(c.current.value?.description?.value, 'some description');
        assert.isUndefined(c.current.value?.default);

        c.next();
        assert.strictEqual(c.current.value?.name, 'string-param-with-description');
        assert.strictEqual(c.current.value?.type?.value, 'string');
        assert.strictEqual(c.current.value?.description?.value, 'some description');
        assert.isUndefined(c.current.value?.default);

        c.next();
        assert.strictEqual(c.current.value?.name, 'boolean-param-with-description');
        assert.strictEqual(c.current.value?.type?.value, 'boolean');
        assert.strictEqual(c.current.value?.description?.value, 'some description');
        assert.isUndefined(c.current.value?.default);
    });

    test('type/default mismatch', function () {
        const content = unindent(`
            options:
              int-param-with-boolean-default:
                type: int
                default: false
              int-param-with-string-default:
                type: int
                default: hello
              int-param-with-float-default:
                type: int
                default: 0.5
              float-param-with-boolean-default:
                type: float
                default: false
              float-param-with-string-default:
                type: float
                default: hello
              string-param-with-boolean-default:
                type: string
                default: false
              string-param-with-int-default:
                type: string
                default: 1
              string-param-with-float-default:
                type: string
                default: 0.5
              boolean-param-with-string-default:
                type: boolean
                default: hello
              boolean-param-with-int-default:
                type: boolean
                default: 1
              boolean-param-with-float-default:
                type: boolean
                default: 0.5
        `);

        const config = parseCharmConfigYAML(content);

        assert.lengthOf(config.node.problems, 0, 'expected no file-scope problem');
        assert.hasAllKeys(config.parameters?.entries, [
            'int-param-with-boolean-default',
            'int-param-with-string-default',
            'int-param-with-float-default',
            'float-param-with-boolean-default',
            'float-param-with-string-default',
            'string-param-with-boolean-default',
            'string-param-with-int-default',
            'string-param-with-float-default',
            'boolean-param-with-string-default',
            'boolean-param-with-int-default',
            'boolean-param-with-float-default',
        ]);

        const c = cursorOverMap(config.parameters);

        c.next();
        assert.strictEqual(c.current.value?.name, 'int-param-with-boolean-default');
        assert.deepEqual(c.current.value?.default?.node.problems, [{ id: 'wrongDefaultType', message: 'Default value must match the parameter type; it must be an integer.' }]);

        c.next();
        assert.strictEqual(c.current.value?.name, 'int-param-with-string-default');
        assert.deepEqual(c.current.value?.default?.node.problems, [{ id: 'wrongDefaultType', message: 'Default value must match the parameter type; it must be an integer.' }]);

        c.next();
        assert.strictEqual(c.current.value?.name, 'int-param-with-float-default');
        assert.deepEqual(c.current.value?.default?.node.problems, [{ id: 'wrongDefaultType', message: 'Default value must match the parameter type; it must be an integer.' }]);

        c.next();
        assert.strictEqual(c.current.value?.name, 'float-param-with-boolean-default');
        assert.deepEqual(c.current.value?.default?.node.problems, [{ id: 'wrongDefaultType', message: 'Default value must match the parameter type; it must be a float.' }]);

        c.next();
        assert.strictEqual(c.current.value?.name, 'float-param-with-string-default');
        assert.deepEqual(c.current.value?.default?.node.problems, [{ id: 'wrongDefaultType', message: 'Default value must match the parameter type; it must be a float.' }]);

        c.next();
        assert.strictEqual(c.current.value?.name, 'string-param-with-boolean-default');
        assert.deepEqual(c.current.value?.default?.node.problems, [{ id: 'wrongDefaultType', message: 'Default value must match the parameter type; it must be a string.' }]);

        c.next();
        assert.strictEqual(c.current.value?.name, 'string-param-with-int-default');
        assert.deepEqual(c.current.value?.default?.node.problems, [{ id: 'wrongDefaultType', message: 'Default value must match the parameter type; it must be a string.' }]);

        c.next();
        assert.strictEqual(c.current.value?.name, 'string-param-with-float-default');
        assert.deepEqual(c.current.value?.default?.node.problems, [{ id: 'wrongDefaultType', message: 'Default value must match the parameter type; it must be a string.' }]);

        c.next();
        assert.strictEqual(c.current.value?.name, 'boolean-param-with-string-default');
        assert.deepEqual(c.current.value?.default?.node.problems, [{ id: 'wrongDefaultType', message: 'Default value must match the parameter type; it must be a boolean.' }]);

        c.next();
        assert.strictEqual(c.current.value?.name, 'boolean-param-with-int-default');
        assert.deepEqual(c.current.value?.default?.node.problems, [{ id: 'wrongDefaultType', message: 'Default value must match the parameter type; it must be a boolean.' }]);

        c.next();
        assert.strictEqual(c.current.value?.name, 'boolean-param-with-float-default');
        assert.deepEqual(c.current.value?.default?.node.problems, [{ id: 'wrongDefaultType', message: 'Default value must match the parameter type; it must be a boolean.' }]);
    });

    test('invalid parameter', function () {
        const content = unindent(`
            options:
              type-missing: {}
              type-invalid-string:
                type: invalid-value-for-type
              type-invalid-int:
                type: 0
              type-invalid-array:
                type: []
              type-invalid-object:
                type: {}
              type-invalid-boolean:
                type: false
              description-invalid-int:
                type: string
                description: 0
              description-invalid-array:
                type: string
                description: []
              description-invalid-object:
                type: string
                description: {}
              description-invalid-boolean:
                type: string
                description: false
              # Invalid default values when type is missing (Note that when the type field
              # is present, the default value should match the that type)
              default-invalid-object:
                default: {}
              default-invalid-array:
                default: []
        `);

        const config = parseCharmConfigYAML(content);

        assert.lengthOf(config.node.problems, 0, 'expected no file-scope problem');
        assert.hasAllKeys(config.parameters?.entries, [
            'type-missing',
            'type-invalid-string',
            'type-invalid-int',
            'type-invalid-array',
            'type-invalid-object',
            'type-invalid-boolean',
            'description-invalid-int',
            'description-invalid-array',
            'description-invalid-object',
            'description-invalid-boolean',
            'default-invalid-object',
            'default-invalid-array',
        ]);

        const c = cursorOverMap(config.parameters);

        c.next();
        assert.strictEqual(c.current.value?.name, 'type-missing');
        assert.deepEqual(c.current.node.problems, [{ id: 'missingField', key: 'type', message: 'Missing `type` field.' }]);

        c.next();
        assert.strictEqual(c.current.value?.name, 'type-invalid-string');
        assert.deepEqual(c.current.value?.type?.node.problems, [{ id: 'expectedEnumValue', expected: ['string', 'int', 'float', 'boolean'], message: 'Must be one of the following: string, int, float, boolean.' }]);

        c.next();
        assert.strictEqual(c.current.value?.name, 'type-invalid-int');
        assert.deepEqual(c.current.value?.type?.node.problems, [{ id: 'expectedEnumValue', expected: ['string', 'int', 'float', 'boolean'], message: 'Must be one of the following: string, int, float, boolean.' }]);

        c.next();
        assert.strictEqual(c.current.value?.name, 'type-invalid-array');
        assert.deepEqual(c.current.value?.type?.node.problems, [{ id: 'expectedEnumValue', expected: ['string', 'int', 'float', 'boolean'], message: 'Must be one of the following: string, int, float, boolean.' }]);

        c.next();
        assert.strictEqual(c.current.value?.name, 'type-invalid-object');
        assert.deepEqual(c.current.value?.type?.node.problems, [{ id: 'expectedEnumValue', expected: ['string', 'int', 'float', 'boolean'], message: 'Must be one of the following: string, int, float, boolean.' }]);

        c.next();
        assert.strictEqual(c.current.value?.name, 'type-invalid-boolean');
        assert.deepEqual(c.current.value?.type?.node.problems, [{ id: 'expectedEnumValue', expected: ['string', 'int', 'float', 'boolean'], message: 'Must be one of the following: string, int, float, boolean.' }]);

        c.next();
        assert.strictEqual(c.current.value?.name, 'description-invalid-int');
        assert.deepEqual(c.current.value?.description?.node.problems, [{ id: 'unexpectedScalarType', expected: 'string', message: 'Must be a string.' }]);

        c.next();
        assert.strictEqual(c.current.value?.name, 'description-invalid-array');
        assert.deepEqual(c.current.value?.description?.node.problems, [{ id: 'unexpectedScalarType', expected: 'string', message: 'Must be a string.' }]);

        c.next();
        assert.strictEqual(c.current.value?.name, 'description-invalid-object');
        assert.deepEqual(c.current.value?.description?.node.problems, [{ id: 'unexpectedScalarType', expected: 'string', message: 'Must be a string.' }]);

        c.next();
        assert.strictEqual(c.current.value?.name, 'description-invalid-boolean');
        assert.deepEqual(c.current.value?.description?.node.problems, [{ id: 'unexpectedScalarType', expected: 'string', message: 'Must be a string.' }]);

        c.next();
        assert.strictEqual(c.current.value?.name, 'default-invalid-object');
        assert.deepEqual(c.current.value?.default?.node.problems, [{ id: 'invalidDefault', message: 'Default value must have a valid type; boolean, string, integer, or float.' }]);

        c.next();
        assert.strictEqual(c.current.value?.name, 'default-invalid-array');
        assert.deepEqual(c.current.value?.default?.node.problems, [{ id: 'invalidDefault', message: 'Default value must have a valid type; boolean, string, integer, or float.' }]);
    });

    suite('special cases (with no config data)', function () {
        const tests: { name: string; content: string; expectedProblems: Problem[]; }[] = [
            {
                name: 'empty',
                content: '',
                expectedProblems: [],
            },
            {
                name: 'whitespace',
                content: ' \n \n ',
                expectedProblems: [],
            },
            {
                name: 'scalar',
                content: '123',
                expectedProblems: [{ id: 'expectedMap', message: 'Must be a map.' }],
            },
            {
                name: 'sequence (empty)',
                content: '[]',
                expectedProblems: [{ id: 'expectedMap', message: 'Must be a map.' }],
            },
            {
                name: 'sequence',
                content: '- element',
                expectedProblems: [{ id: 'expectedMap', message: 'Must be a map.' }],
            },
            {
                name: 'no `options` key',
                content: 'parent:\n  key: value',
                expectedProblems: [],
            },
        ];

        for (const t of tests) {
            const tt = t;
            test(tt.name, function () {
                const config = parseCharmConfigYAML(tt.content);
                assert.isUndefined(config.parameters);
                assert.includeDeepMembers(config.node.problems, tt.expectedProblems);
            });
        }
    });

    suite('invalid `options` value', function () {
        const tests: { name: string; content: string; expectedProblems: Problem[] }[] = [
            {
                name: 'non-object `options` (empty array)',
                content: 'options: []',
                expectedProblems: [{ id: 'expectedMap', message: 'Must be a map.' }],
            },
            {
                name: 'non-object `options` (array)',
                content: 'options:\n  - element',
                expectedProblems: [{ id: 'expectedMap', message: 'Must be a map.' }],
            },
            {
                name: 'non-object parameter',
                content: 'options:\n  param: 999',
                expectedProblems: [{ id: 'expectedMap', message: 'Must be a map.' }],
            },
            {
                name: 'non-object parameter (empty array)',
                content: 'options:\n  param: []',
                expectedProblems: [{ id: 'expectedMap', message: 'Must be a map.' }],
            },
            {
                name: 'non-object parameter (array)',
                content: 'options:\n  param:\n    - element',
                expectedProblems: [{ id: 'expectedMap', message: 'Must be a map.' }],
            },
        ];

        for (const t of tests) {
            const tt = t;
            test(tt.name, function () {
                const config = parseCharmConfigYAML(tt.content);
                assert.includeDeepMembers(allProblems(config), tt.expectedProblems);
            });
        }
    });
});

suite(parseCharmMetadataYAML.name, function () {
    /**
     * Bare minimum content, with required fields assigned.
     */
    const bareMinimum = unindent(`
        name: my-charm
        display-name: my-charm-display-name
        summary: my-charm-summary
        description: my-charm-description
    `);

    test('valid (complete)', function () {
        /**
         * Here:
         * - Keys are ordered alphabetically.
         * - Values are valid.
         * - All fields (both optional or required) are assigned.
         * - Fields that accept an array of values or a map of key/value pairs, are
         *   assigned with more than one element/pair.
         */
        const content = unindent(`
            assumes:
              - juju >= 2.9
              - k8s-api
              - all-of:
                  - juju >= 2.9
                  - k8s-api
              - any-of:
                  - juju >= 2.9
                  - k8s-api
            containers:
              container-one:
                resource: resource-one
                mounts:
                  - storage: storage-one
                    location: /some/location
                  - storage: storage-two
                    location: /some/location
              container-two:
                bases:
                  - name: base-one
                    channel: channel-one
                    architectures:
                      - architecture-one
                      - architecture-two
                  - name: base-two
                    channel: channel-two
                    architectures:
                      - architecture-one
                      - architecture-two
                mounts:
                  - storage: storage-one
                    location: /some/location
                  - storage: storage-two
                    location: /some/location
            description: my-charm-description
            devices:
              device-one:
                type: gpu
                description: device-one-description
                countmin: 1
                countmax: 2
              device-two:
                type: nvidia.com/gpu
                description: device-two-description
                countmin: 1
                countmax: 2
              device-three:
                type: amd.com/gpu
                description: device-three-description
                countmin: 1
                countmax: 2
            display-name: my-charm-display-name
            docs: https://docs.url
            extra-bindings:
              binding-one:
              binding-two:
            issues:
              - https://one.issues.url
              - https://two.issues.url
            maintainers:
              - John Doe <john.doe@company.com>
              - Jane Doe <jane.doe@company.com>
            name: my-charm
            peers:
              peer-one:
                interface: interface-one
                limit: 1
                optional: false
                scope: global
              peer-two:
                interface: interface-two
                limit: 2
                optional: true
                scope: container
            provides:
              provides-one:
                interface: interface-one
                limit: 1
                optional: false
                scope: global
              provides-two:
                interface: interface-two
                limit: 2
                optional: true
                scope: container
            requires:
              requires-one:
                interface: interface-one
                limit: 1
                optional: false
                scope: global
              requires-two:
                interface: interface-two
                limit: 2
                optional: true
                scope: container
            resources:
              resource-one:
                type: oci-image
                description: resource-one-description
              resource-two:
                type: file
                description: resource-two-description
                filename: some-file-name
            source:
              - https://one.source.url
              - https://two.source.url
            storage:
              storage-one:
                type: filesystem
                description: storage-one-description
                location: /some/location
                shared: false
                read-only: false
                multiple: 1
                minimum-size: 1
                properties:
                  - transient
              storage-two:
                type: block
                description: storage-two-description
                location: /some/location
                shared: true
                read-only: true
                multiple: 1+
                minimum-size: 1G
                properties:
                  - transient
            subordinate: false
            summary: my-charm-summary
            terms:
              - term-one
              - term-two
            website:
              - https://one.website.url
              - https://two.website.url
            z-custom-field-array:
              - custom-value-one
              - custom-value-two
            z-custom-field-boolean: true
            z-custom-field-map:
              key-one: value-one
              key-two: value-two
            z-custom-field-number: 0
            z-custom-field-string: some-string-value
        `);

        const metadata = parseCharmMetadataYAML(content);

        assert.isEmpty(metadata.node.problems, 'expected no file-scope problem');
        assert.strictEqual(metadata.node.text, content);

        assert.strictEqual(metadata.name?.value, 'my-charm');
        assert.strictEqual(metadata.description?.value, 'my-charm-description');
        assert.strictEqual(metadata.summary?.value, 'my-charm-summary');
        assert.strictEqual(metadata.displayName?.value, 'my-charm-display-name');
        assert.strictEqual(metadata.subordinate?.value, false);
        assert.strictEqual(metadata.docs?.value, 'https://docs.url');

        assert.strictEqual(metadata.assumes?.elements?.[0].value?.single?.value, 'juju >= 2.9');
        assert.strictEqual(metadata.assumes?.elements?.[1].value?.single?.value, 'k8s-api');
        assert.strictEqual(metadata.assumes?.elements?.[2].value?.allOf?.elements?.[0].value, 'juju >= 2.9');
        assert.strictEqual(metadata.assumes?.elements?.[2].value?.allOf?.elements?.[1].value, 'k8s-api');
        assert.strictEqual(metadata.assumes?.elements?.[3].value?.anyOf?.elements?.[0].value, 'juju >= 2.9');
        assert.strictEqual(metadata.assumes?.elements?.[3].value?.anyOf?.elements?.[1].value, 'k8s-api');

        const container1 = metadata.containers?.entries?.['container-one']?.value!;
        assert.strictEqual(container1.name, 'container-one');
        assert.strictEqual(container1.resource?.value, 'resource-one');
        assert.isUndefined(container1.bases);
        assert.strictEqual(container1.mounts?.elements?.[0]?.value?.storage?.value, 'storage-one');
        assert.strictEqual(container1.mounts?.elements?.[0]?.value?.location?.value, '/some/location');
        assert.strictEqual(container1.mounts?.elements?.[1]?.value?.storage?.value, 'storage-two');
        assert.strictEqual(container1.mounts?.elements?.[1]?.value?.location?.value, '/some/location');

        const container2 = metadata.containers?.entries?.['container-two']?.value!;
        assert.strictEqual(container2.name, 'container-two');
        assert.isUndefined(container2.resource);
        assert.strictEqual(container2.bases?.elements?.[0]?.value?.name?.value, 'base-one');
        assert.strictEqual(container2.bases?.elements?.[0]?.value?.channel?.value, 'channel-one');
        assert.strictEqual(container2.bases?.elements?.[0]?.value?.architectures?.elements?.[0]?.value, 'architecture-one');
        assert.strictEqual(container2.bases?.elements?.[0]?.value?.architectures?.elements?.[1]?.value, 'architecture-two');
        assert.strictEqual(container2.bases?.elements?.[1]?.value?.name?.value, 'base-two');
        assert.strictEqual(container2.bases?.elements?.[1]?.value?.channel?.value, 'channel-two');
        assert.strictEqual(container2.bases?.elements?.[1]?.value?.architectures?.elements?.[0]?.value, 'architecture-one');
        assert.strictEqual(container2.bases?.elements?.[1]?.value?.architectures?.elements?.[1]?.value, 'architecture-two');
        assert.strictEqual(container2.mounts?.elements?.[0]?.value?.storage?.value, 'storage-one');
        assert.strictEqual(container2.mounts?.elements?.[0]?.value?.location?.value, '/some/location');
        assert.strictEqual(container2.mounts?.elements?.[1]?.value?.storage?.value, 'storage-two');
        assert.strictEqual(container2.mounts?.elements?.[1]?.value?.location?.value, '/some/location');

        assert.strictEqual(metadata.devices?.entries?.['device-one']?.value?.name, 'device-one');
        assert.strictEqual(metadata.devices?.entries?.['device-one']?.value?.type?.value, 'gpu');
        assert.strictEqual(metadata.devices?.entries?.['device-one']?.value?.description?.value, 'device-one-description');
        assert.strictEqual(metadata.devices?.entries?.['device-one']?.value?.countMin?.value, 1);
        assert.strictEqual(metadata.devices?.entries?.['device-one']?.value?.countMax?.value, 2);
        assert.strictEqual(metadata.devices?.entries?.['device-two']?.value?.name, 'device-two');
        assert.strictEqual(metadata.devices?.entries?.['device-two']?.value?.type?.value, 'nvidia.com/gpu');
        assert.strictEqual(metadata.devices?.entries?.['device-two']?.value?.description?.value, 'device-two-description');
        assert.strictEqual(metadata.devices?.entries?.['device-two']?.value?.countMin?.value, 1);
        assert.strictEqual(metadata.devices?.entries?.['device-two']?.value?.countMax?.value, 2);
        assert.strictEqual(metadata.devices?.entries?.['device-three']?.value?.name, 'device-three');
        assert.strictEqual(metadata.devices?.entries?.['device-three']?.value?.type?.value, 'amd.com/gpu');
        assert.strictEqual(metadata.devices?.entries?.['device-three']?.value?.description?.value, 'device-three-description');
        assert.strictEqual(metadata.devices?.entries?.['device-three']?.value?.countMin?.value, 1);
        assert.strictEqual(metadata.devices?.entries?.['device-three']?.value?.countMax?.value, 2);

        assert.strictEqual(metadata.extraBindings?.entries?.['binding-one']?.value?.name, 'binding-one');
        assert.strictEqual(metadata.extraBindings?.entries?.['binding-two']?.value?.name, 'binding-two');

        assert.strictEqual((metadata.issues as SequenceWithNode<string>).elements?.[0]?.value, 'https://one.issues.url');
        assert.strictEqual((metadata.issues as SequenceWithNode<string>).elements?.[1]?.value, 'https://two.issues.url');

        assert.strictEqual(metadata.maintainers?.elements?.[0]?.value, 'John Doe <john.doe@company.com>');
        assert.strictEqual(metadata.maintainers?.elements?.[1]?.value, 'Jane Doe <jane.doe@company.com>');

        assert.strictEqual(metadata.peers?.entries?.['peer-one']?.value?.name, 'peer-one');
        assert.strictEqual(metadata.peers?.entries?.['peer-one']?.value?.interface?.value, 'interface-one');
        assert.strictEqual(metadata.peers?.entries?.['peer-one']?.value?.limit?.value, 1);
        assert.strictEqual(metadata.peers?.entries?.['peer-one']?.value?.optional?.value, false);
        assert.strictEqual(metadata.peers?.entries?.['peer-one']?.value?.scope?.value, 'global');
        assert.strictEqual(metadata.peers?.entries?.['peer-two']?.value?.name, 'peer-two');
        assert.strictEqual(metadata.peers?.entries?.['peer-two']?.value?.interface?.value, 'interface-two');
        assert.strictEqual(metadata.peers?.entries?.['peer-two']?.value?.limit?.value, 2);
        assert.strictEqual(metadata.peers?.entries?.['peer-two']?.value?.optional?.value, true);
        assert.strictEqual(metadata.peers?.entries?.['peer-two']?.value?.scope?.value, 'container');

        assert.strictEqual(metadata.provides?.entries?.['provides-one']?.value?.name, 'provides-one');
        assert.strictEqual(metadata.provides?.entries?.['provides-one']?.value?.interface?.value, 'interface-one');
        assert.strictEqual(metadata.provides?.entries?.['provides-one']?.value?.limit?.value, 1);
        assert.strictEqual(metadata.provides?.entries?.['provides-one']?.value?.optional?.value, false);
        assert.strictEqual(metadata.provides?.entries?.['provides-one']?.value?.scope?.value, 'global');
        assert.strictEqual(metadata.provides?.entries?.['provides-two']?.value?.name, 'provides-two');
        assert.strictEqual(metadata.provides?.entries?.['provides-two']?.value?.interface?.value, 'interface-two');
        assert.strictEqual(metadata.provides?.entries?.['provides-two']?.value?.limit?.value, 2);
        assert.strictEqual(metadata.provides?.entries?.['provides-two']?.value?.optional?.value, true);
        assert.strictEqual(metadata.provides?.entries?.['provides-two']?.value?.scope?.value, 'container');

        assert.strictEqual(metadata.requires?.entries?.['requires-one']?.value?.name, 'requires-one');
        assert.strictEqual(metadata.requires?.entries?.['requires-one']?.value?.interface?.value, 'interface-one');
        assert.strictEqual(metadata.requires?.entries?.['requires-one']?.value?.limit?.value, 1);
        assert.strictEqual(metadata.requires?.entries?.['requires-one']?.value?.optional?.value, false);
        assert.strictEqual(metadata.requires?.entries?.['requires-one']?.value?.scope?.value, 'global');
        assert.strictEqual(metadata.requires?.entries?.['requires-two']?.value?.name, 'requires-two');
        assert.strictEqual(metadata.requires?.entries?.['requires-two']?.value?.interface?.value, 'interface-two');
        assert.strictEqual(metadata.requires?.entries?.['requires-two']?.value?.limit?.value, 2);
        assert.strictEqual(metadata.requires?.entries?.['requires-two']?.value?.optional?.value, true);
        assert.strictEqual(metadata.requires?.entries?.['requires-two']?.value?.scope?.value, 'container');

        assert.strictEqual(metadata.resources?.entries?.['resource-one']?.value?.name, 'resource-one');
        assert.strictEqual(metadata.resources?.entries?.['resource-one']?.value?.type?.value, 'oci-image');
        assert.strictEqual(metadata.resources?.entries?.['resource-one']?.value?.description?.value, 'resource-one-description');
        assert.isUndefined(metadata.resources?.entries?.['resource-one']?.value?.filename);
        assert.strictEqual(metadata.resources?.entries?.['resource-two']?.value?.name, 'resource-two');
        assert.strictEqual(metadata.resources?.entries?.['resource-two']?.value?.type?.value, 'file');
        assert.strictEqual(metadata.resources?.entries?.['resource-two']?.value?.description?.value, 'resource-two-description');
        assert.strictEqual(metadata.resources?.entries?.['resource-two']?.value?.filename?.value, 'some-file-name');

        assert.strictEqual((metadata.source as SequenceWithNode<string>).elements?.[0]?.value, 'https://one.source.url');
        assert.strictEqual((metadata.source as SequenceWithNode<string>).elements?.[1]?.value, 'https://two.source.url');

        assert.strictEqual(metadata.storage?.entries?.['storage-one']?.value?.name, 'storage-one');
        assert.strictEqual(metadata.storage?.entries?.['storage-one']?.value?.type?.value, 'filesystem');
        assert.strictEqual(metadata.storage?.entries?.['storage-one']?.value?.description?.value, 'storage-one-description');
        assert.strictEqual(metadata.storage?.entries?.['storage-one']?.value?.location?.value, '/some/location');
        assert.strictEqual(metadata.storage?.entries?.['storage-one']?.value?.shared?.value, false);
        assert.strictEqual(metadata.storage?.entries?.['storage-one']?.value?.readOnly?.value, false);
        assert.strictEqual(metadata.storage?.entries?.['storage-one']?.value?.multiple?.value, '1');
        assert.strictEqual(metadata.storage?.entries?.['storage-one']?.value?.minimumSize?.value, '1');
        assert.strictEqual(metadata.storage?.entries?.['storage-one']?.value?.properties?.elements?.[0]?.value, 'transient');
        assert.strictEqual(metadata.storage?.entries?.['storage-two']?.value?.name, 'storage-two');
        assert.strictEqual(metadata.storage?.entries?.['storage-two']?.value?.type?.value, 'block');
        assert.strictEqual(metadata.storage?.entries?.['storage-two']?.value?.description?.value, 'storage-two-description');
        assert.strictEqual(metadata.storage?.entries?.['storage-two']?.value?.location?.value, '/some/location');
        assert.strictEqual(metadata.storage?.entries?.['storage-two']?.value?.shared?.value, true);
        assert.strictEqual(metadata.storage?.entries?.['storage-two']?.value?.readOnly?.value, true);
        assert.strictEqual(metadata.storage?.entries?.['storage-two']?.value?.multiple?.value, '1+');
        assert.strictEqual(metadata.storage?.entries?.['storage-two']?.value?.minimumSize?.value, '1G');
        assert.strictEqual(metadata.storage?.entries?.['storage-two']?.value?.properties?.elements?.[0]?.value, 'transient');

        assert.strictEqual((metadata.terms as SequenceWithNode<string>).elements?.[0]?.value, 'term-one');
        assert.strictEqual((metadata.terms as SequenceWithNode<string>).elements?.[1]?.value, 'term-two');

        assert.strictEqual((metadata.website as SequenceWithNode<string>).elements?.[0]?.value, 'https://one.website.url');
        assert.strictEqual((metadata.website as SequenceWithNode<string>).elements?.[1]?.value, 'https://two.website.url');

        assert.deepStrictEqual(metadata.customFields, {
            /* eslint-disable */
            'z-custom-field-array': ['custom-value-one', 'custom-value-two'],
            'z-custom-field-boolean': true,
            'z-custom-field-map': {
                'key-one': 'value-one',
                'key-two': 'value-two'
            },
            'z-custom-field-number': 0,
            'z-custom-field-string': 'some-string-value'
            /* eslint-enable */
        });
    });

    test('missing required fields', function () {
        const content = unindent(`
            z-custom-field: something
        `);

        const metadata = parseCharmMetadataYAML(content);

        assert.isUndefined(metadata.name);
        assert.isUndefined(metadata.displayName);
        assert.isUndefined(metadata.description);
        assert.isUndefined(metadata.summary);
        assert.includeDeepMembers(metadata.node.problems, [
            {
                id: 'missingField',
                key: 'name',
                message: 'Missing `name` field.',
            },
            {
                id: 'missingField',
                key: 'display-name',
                message: 'Missing `display-name` field.',
            },
            {
                id: 'missingField',
                key: 'description',
                message: 'Missing `description` field.',
            },
            {
                id: 'missingField',
                key: 'summary',
                message: 'Missing `summary` field.',
            }
        ]);
    });

    test('assign scalar when scalar or sequence expected', function () {
        const content = unindent(`
            source: https://source.url
            issues: https://issues.url
            website: https://website.url
        `);

        const metadata = parseCharmMetadataYAML(content);

        assert.deepStrictEqual((metadata.source as WithNode<string>)?.value, 'https://source.url');
        assert.deepStrictEqual((metadata.issues as WithNode<string>)?.value, 'https://issues.url');
        assert.deepStrictEqual((metadata.website as WithNode<string>)?.value, 'https://website.url');
    });

    test('assign sequence when scalar or sequence expected', function () {
        const content = unindent(`
            source:
              - https://one.source.url
              - https://two.source.url
            issues:
              - https://one.issues.url
              - https://two.issues.url
            website:
              - https://one.website.url
              - https://two.website.url
        `);

        const metadata = parseCharmMetadataYAML(content);

        assert.deepStrictEqual((metadata.source as SequenceWithNode<string>)?.elements?.map(x => x.value), [
            'https://one.source.url',
            'https://two.source.url',
        ]);
        assert.deepStrictEqual((metadata.issues as SequenceWithNode<string>)?.elements?.map(x => x.value), [
            'https://one.issues.url',
            'https://two.issues.url',
        ]);
        assert.deepStrictEqual((metadata.website as SequenceWithNode<string>)?.elements?.map(x => x.value), [
            'https://one.website.url',
            'https://two.website.url',
        ]);
    });

    test('assign non-scalar when scalar expected', function () {
        const content = unindent(`
            name: []
            display-name: {}
            description:
              - element
            summary:
              some-key: 0
        `);

        const metadata = parseCharmMetadataYAML(content);

        assert.deepStrictEqual(metadata.name?.node.problems, [{
            id: 'unexpectedScalarType',
            expected: 'string',
            message: 'Must be a string.',
        }]);
        assert.deepStrictEqual(metadata.displayName?.node.problems, [{
            id: 'unexpectedScalarType',
            expected: 'string',
            message: 'Must be a string.',
        }]);
        assert.deepStrictEqual(metadata.description?.node.problems, [{
            id: 'unexpectedScalarType',
            expected: 'string',
            message: 'Must be a string.',
        }]);
        assert.deepStrictEqual(metadata.summary?.node.problems, [{
            id: 'unexpectedScalarType',
            expected: 'string',
            message: 'Must be a string.',
        }]);
    });

    suite('assumes', function () {
        test('neither all-of nor any-of', function () {
            const content = unindent(`
                assumes:
                  - some-key:
                      - element
                      - element
            `);

            const metadata = parseCharmMetadataYAML(content);

            assert.deepStrictEqual(metadata.assumes?.elements?.[0]?.node.problems, [{
                id: 'assumptionExpectedAnyOfOrAllOf',
                message: 'Must include only one of `any-of` or `all-of` keys.',
            }]);
        });

        test('both all-of and any-of', function () {
            const content = unindent(`
                assumes:
                  - all-of:
                      - juju >= 2.9
                      - k8s
                    any-of:
                      - juju >= 2.9
                      - k8s
            `);

            const metadata = parseCharmMetadataYAML(content);

            assert.deepStrictEqual(metadata.assumes?.elements?.[0]?.node.problems, [{
                id: 'assumptionExpectedAnyOfOrAllOf',
                message: 'Must include only one of `any-of` or `all-of` keys.',
            }]);
        });

        test('extra key along all-of', function () {
            const content = unindent(`
                assumes:
                  - all-of:
                      - juju >= 2.9
                      - k8s
                    some-key: []
            `);

            const metadata = parseCharmMetadataYAML(content);

            assert.deepStrictEqual(metadata.assumes?.elements?.[0]?.node.problems, [{
                id: 'assumptionExpectedAnyOfOrAllOf',
                message: 'Must include only one of `any-of` or `all-of` keys.',
            }]);
        });

        test('extra key along any-of', function () {
            const content = unindent(`
                assumes:
                  - any-of:
                      - juju >= 2.9
                      - k8s
                    some-key: []
            `);

            const metadata = parseCharmMetadataYAML(content);

            assert.deepStrictEqual(metadata.assumes?.elements?.[0]?.node.problems, [{
                id: 'assumptionExpectedAnyOfOrAllOf',
                message: 'Must include only one of `any-of` or `all-of` keys.',
            }]);
        });
    });

    suite('endpoint', function () {
        test('invalid', function () {
            const content = unindent(`
                peers: []
                provides:
                  - element
                requires: some-value
            `);

            const metadata = parseCharmMetadataYAML(content);

            assert.isUndefined(metadata.peers?.entries);
            assert.deepStrictEqual(metadata.peers?.node.problems, [{ id: 'expectedMap', message: 'Must be a map.', }]);
            assert.isUndefined(metadata.provides?.entries);
            assert.deepStrictEqual(metadata.provides?.node.problems, [{ id: 'expectedMap', message: 'Must be a map.', }]);
            assert.isUndefined(metadata.requires?.entries);
            assert.deepStrictEqual(metadata.requires?.node.problems, [{ id: 'expectedMap', message: 'Must be a map.', }]);
        });

        test('invalid entry', function () {
            const content = unindent(`
                peers:
                  peers-endpoint-0: []
                  peers-endpoint-1:
                    - element
                  peers-endpoint-2: 0
                provides:
                  provides-endpoint-0: []
                  provides-endpoint-1:
                    - element
                  provides-endpoint-2: 0
                requires:
                  requires-endpoint-0: []
                  requires-endpoint-1:
                    - element
                  requires-endpoint-2: 0
            `);

            const metadata = parseCharmMetadataYAML(content);

            assert.deepStrictEqual(metadata.peers?.entries?.['peers-endpoint-0']?.node.problems, [{ id: 'expectedMap', message: 'Must be a map.', }]);
            assert.deepStrictEqual(metadata.peers?.entries?.['peers-endpoint-1']?.node.problems, [{ id: 'expectedMap', message: 'Must be a map.', }]);
            assert.deepStrictEqual(metadata.peers?.entries?.['peers-endpoint-2']?.node.problems, [{ id: 'expectedMap', message: 'Must be a map.', }]);
            assert.deepStrictEqual(metadata.provides?.entries?.['provides-endpoint-0']?.node.problems, [{ id: 'expectedMap', message: 'Must be a map.', }]);
            assert.deepStrictEqual(metadata.provides?.entries?.['provides-endpoint-1']?.node.problems, [{ id: 'expectedMap', message: 'Must be a map.', }]);
            assert.deepStrictEqual(metadata.provides?.entries?.['provides-endpoint-2']?.node.problems, [{ id: 'expectedMap', message: 'Must be a map.', }]);
            assert.deepStrictEqual(metadata.requires?.entries?.['requires-endpoint-0']?.node.problems, [{ id: 'expectedMap', message: 'Must be a map.', }]);
            assert.deepStrictEqual(metadata.requires?.entries?.['requires-endpoint-1']?.node.problems, [{ id: 'expectedMap', message: 'Must be a map.', }]);
            assert.deepStrictEqual(metadata.requires?.entries?.['requires-endpoint-2']?.node.problems, [{ id: 'expectedMap', message: 'Must be a map.', }]);
        });

        test('invalid entry fields', function () {
            const content = unindent(`
                peers:
                  peers-endpoint:
                    interface: 0
                    limit: something
                    optional: []
                    scope: some-random-value
                provides:
                  provides-endpoint:
                    interface: {}
                    limit:
                    optional:
                      - element
                    scope: 0
                requires:
                  requires-endpoint:
                    interface: []
                    limit: true
                    optional:
                      some-key: some-value
                    scope:
                      - element
            `);

            const metadata = parseCharmMetadataYAML(content);

            assert.deepStrictEqual(metadata.peers?.entries?.['peers-endpoint']?.value?.interface?.node.problems, [{
                id: 'unexpectedScalarType',
                expected: 'string',
                message: 'Must be a string.',
            }]);
            assert.deepStrictEqual(metadata.peers?.entries?.['peers-endpoint']?.value?.limit?.node.problems, [{
                id: 'unexpectedScalarType',
                expected: 'integer',
                message: 'Must be an integer.',
            }]);
            assert.deepStrictEqual(metadata.peers?.entries?.['peers-endpoint']?.value?.optional?.node.problems, [{
                id: 'unexpectedScalarType',
                expected: 'boolean',
                message: 'Must be a boolean.',
            }]);
            assert.deepStrictEqual(metadata.peers?.entries?.['peers-endpoint']?.value?.scope?.node.problems, [{
                id: 'expectedEnumValue',
                expected: ['global', 'container'],
                message: 'Must be one of the following: global, container.',
            }]);
            assert.deepStrictEqual(metadata.provides?.entries?.['provides-endpoint']?.value?.interface?.node.problems, [{
                id: 'unexpectedScalarType',
                expected: 'string',
                message: 'Must be a string.',
            }]);
            assert.deepStrictEqual(metadata.provides?.entries?.['provides-endpoint']?.value?.limit?.node.problems, [{
                id: 'unexpectedScalarType',
                expected: 'integer',
                message: 'Must be an integer.',
            }]);
            assert.deepStrictEqual(metadata.provides?.entries?.['provides-endpoint']?.value?.optional?.node.problems, [{
                id: 'unexpectedScalarType',
                expected: 'boolean',
                message: 'Must be a boolean.',
            }]);
            assert.deepStrictEqual(metadata.provides?.entries?.['provides-endpoint']?.value?.scope?.node.problems, [{
                id: 'expectedEnumValue',
                expected: ['global', 'container'],
                message: 'Must be one of the following: global, container.',
            }]);
            assert.deepStrictEqual(metadata.requires?.entries?.['requires-endpoint']?.value?.interface?.node.problems, [{
                id: 'unexpectedScalarType',
                expected: 'string',
                message: 'Must be a string.',
            }]);
            assert.deepStrictEqual(metadata.requires?.entries?.['requires-endpoint']?.value?.limit?.node.problems, [{
                id: 'unexpectedScalarType',
                expected: 'integer',
                message: 'Must be an integer.',
            }]);
            assert.deepStrictEqual(metadata.requires?.entries?.['requires-endpoint']?.value?.optional?.node.problems, [{
                id: 'unexpectedScalarType',
                expected: 'boolean',
                message: 'Must be a boolean.',
            }]);
            assert.deepStrictEqual(metadata.requires?.entries?.['requires-endpoint']?.value?.scope?.node.problems, [{
                id: 'expectedEnumValue',
                expected: ['global', 'container'],
                message: 'Must be one of the following: global, container.',
            }]);

        });

        test('missing `interface`', function () {
            const content = unindent(`
            peers:
              peers-endpoint:
                limit: 1
                optional: false
                scope: global
            provides:
              provides-endpoint:
                limit: 1
                optional: false
                scope: global
            requires:
              requires-endpoint:
                limit: 1
                optional: false
                scope: global
        `);

            const metadata = parseCharmMetadataYAML(content);

            assert.isDefined(metadata.peers?.entries?.['peers-endpoint'].value);
            assert.deepStrictEqual(metadata.peers?.entries?.['peers-endpoint']?.node.problems, [{
                id: 'missingField',
                key: 'interface',
                message: 'Missing `interface` field.',
            }]);
            assert.isDefined(metadata.provides?.entries?.['provides-endpoint'].value);
            assert.deepStrictEqual(metadata.provides?.entries?.['provides-endpoint']?.node.problems, [{
                id: 'missingField',
                key: 'interface',
                message: 'Missing `interface` field.',
            }]);
            assert.isDefined(metadata.requires?.entries?.['requires-endpoint'].value);
            assert.deepStrictEqual(metadata.requires?.entries?.['requires-endpoint']?.node.problems, [{
                id: 'missingField',
                key: 'interface',
                message: 'Missing `interface` field.',
            }]);
        });
    });

    suite('resources', function () {
        test('invalid', function () {
            const content = unindent(`
                resources: []
            `);

            const metadata = parseCharmMetadataYAML(content);

            assert.isUndefined(metadata.resources?.entries);
            assert.deepStrictEqual(metadata.resources?.node.problems, [{ id: 'expectedMap', message: 'Must be a map.', }]);
        });

        test('invalid entry', function () {
            const content = unindent(`
                resources:
                  resource-0: []
                  resource-1:
                    - element
                  resource-2: 0
            `);

            const metadata = parseCharmMetadataYAML(content);

            assert.deepStrictEqual(metadata.resources?.entries?.['resource-0']?.node.problems, [{ id: 'expectedMap', message: 'Must be a map.', }]);
            assert.deepStrictEqual(metadata.resources?.entries?.['resource-1']?.node.problems, [{ id: 'expectedMap', message: 'Must be a map.', }]);
            assert.deepStrictEqual(metadata.resources?.entries?.['resource-2']?.node.problems, [{ id: 'expectedMap', message: 'Must be a map.', }]);
        });

        test('invalid entry fields', function () {
            const content = unindent(`
                resources:
                  resource-0:
                    type: 0
                    description: 0
                    filename: 0
                  resource-1:
                    type: []
                    description: []
                    filename:
                      - element
                  resource-2:
                    type: {}
                    description:
                    filename:
                      some-key: some-value
            `);

            const metadata = parseCharmMetadataYAML(content);

            assert.deepStrictEqual(metadata.resources?.entries?.['resource-0']?.value?.type?.node.problems, [{
                id: 'expectedEnumValue',
                expected: ['file', 'oci-image'],
                message: 'Must be one of the following: file, oci-image.',
            }]);
            assert.deepStrictEqual(metadata.resources?.entries?.['resource-0']?.value?.description?.node.problems, [{
                id: 'unexpectedScalarType',
                expected: 'string',
                message: 'Must be a string.',
            }]);
            assert.deepStrictEqual(metadata.resources?.entries?.['resource-0']?.value?.filename?.node.problems, [{
                id: 'unexpectedScalarType',
                expected: 'string',
                message: 'Must be a string.',
            }]);
            assert.deepStrictEqual(metadata.resources?.entries?.['resource-1']?.value?.type?.node.problems, [{
                id: 'expectedEnumValue',
                expected: ['file', 'oci-image'],
                message: 'Must be one of the following: file, oci-image.',
            }]);
            assert.deepStrictEqual(metadata.resources?.entries?.['resource-1']?.value?.description?.node.problems, [{
                id: 'unexpectedScalarType',
                expected: 'string',
                message: 'Must be a string.',
            }]);
            assert.deepStrictEqual(metadata.resources?.entries?.['resource-1']?.value?.filename?.node.problems, [{
                id: 'unexpectedScalarType',
                expected: 'string',
                message: 'Must be a string.',
            }]);
            assert.deepStrictEqual(metadata.resources?.entries?.['resource-2']?.value?.type?.node.problems, [{
                id: 'expectedEnumValue',
                expected: ['file', 'oci-image'],
                message: 'Must be one of the following: file, oci-image.',
            }]);
            assert.deepStrictEqual(metadata.resources?.entries?.['resource-2']?.value?.description?.node.problems, [{
                id: 'unexpectedScalarType',
                expected: 'string',
                message: 'Must be a string.',
            }]);
            assert.deepStrictEqual(metadata.resources?.entries?.['resource-2']?.value?.filename?.node.problems, [{
                id: 'unexpectedScalarType',
                expected: 'string',
                message: 'Must be a string.',
            }]);
        });

        test('missing type', function () {
            const content = unindent(`
                resources:
                  resource:
                    description: description
                    filename: filename
            `);

            const metadata = parseCharmMetadataYAML(content);

            assert.deepStrictEqual(metadata.resources?.entries?.['resource']?.node.problems, [{
                id: 'missingField',
                key: 'type',
                message: 'Missing `type` field.',
            }]);
        });

        test('unexpected `filename` when type is `oci-image`', function () {
            const content = unindent(`
                resources:
                  resource:
                    type: oci-image
                    filename: some-filename
            `);

            const metadata = parseCharmMetadataYAML(content);

            assert.deepStrictEqual(metadata.resources?.entries?.['resource']?.value?.filename?.node.problems, [{
                id: 'resourceUnexpectedFilenameForNonFileResource',
                message: 'Field `filename` must be assigned only if resource type is `file`.',
            }]);
        });

        test('missing `filename` when type is `file`', function () {
            const content = unindent(`
                resources:
                  resource:
                    type: file
            `);

            const metadata = parseCharmMetadataYAML(content);

            assert.deepStrictEqual(metadata.resources?.entries?.['resource']?.node.problems, [{
                id: 'resourceExpectedFilenameForFileResource',
                message: 'Field `filename` is required since resource type is `file`.',
            }]);
        });
    });

    // TODO add tests for 'devices'.
    // TODO add tests for 'storage'.
    // TODO add tests for 'extra-bindings'.
    // TODO add tests for 'containers'.
    // TODO add tests for 'containers/resource' match.
    // TODO add tests for 'containers/storage' match.
});

suite(parseToxINI.name, function () {
    type TestCase = {
        name: string;
        content: string;
        expected: CharmToxConfig;
    };

    const tests: TestCase[] = [
        {
            name: 'empty',
            content: '',
            expected: { sections: {} },
        }, {
            name: 'invalid INI',
            content: '?',
            expected: { sections: {} },
        }, {
            name: 'no section',
            content: unindent(`
                key=value
            `),
            expected: { sections: {} },
        }, {
            name: 'empty section',
            content: unindent(`
                [section]
            `),
            expected: {
                sections: {
                    section: {
                        name: 'section',
                    },
                },
            },
        }, {
            name: 'non-empty section, with unknown properties',
            content: unindent(`
                [section]
                key=value
            `),
            expected: {
                sections: {
                    section: {
                        name: 'section',
                    },
                },
            },
        }, {
            name: 'non-empty section, with all expected properties',
            content: unindent(`
                [a]
                description=description-a
                commands=command-a
            `),
            expected: {
                sections: {
                    a: {
                        name: 'a',
                        description: 'description-a',
                        commands: 'command-a',
                    },
                },
            },
        }, {
            name: 'multiple non-empty sections',
            content: unindent(`
                [a]
                description=description-a
                commands=command-a
                [b]
                description=description-b
                commands=command-b
            `),
            expected: {
                sections: {
                    'a': {
                        name: 'a',
                        description: 'description-a',
                        commands: 'command-a',
                    },
                    'b': {
                        name: 'b',
                        description: 'description-b',
                        commands: 'command-b',
                    },
                },
            },
        }
    ];

    for (const t of tests) {
        const tt = t;
        test(tt.name, function () {
            const value = parseToxINI(tt.content);
            assert.deepStrictEqual(value, tt.expected);
        });
    }
});
import { assert } from "chai";
import { suite, test } from "mocha";
import { TextDecoder } from "util";
import { Problem, CharmMetadata, CharmAction, CharmConfigParameter, emptyYAMLNode } from "../model/charm";
import { YAMLParser, parseCharmActionsYAML, parseCharmConfigYAML, parseCharmMetadataYAML } from "../parser";
import path = require("path");
import { readFileSync } from "fs";
import { Range } from "../model/common";

function cursor<T>(list: T[]) {
    let index = -1;
    return {
        next() { return list[++index]; },
        get current() { return list[index]; },
    };
}

function newRange(startLine: number, startCharacter: number, endLine: number, endCharacter: number): Range {
    return {
        start: { line: startLine, character: startCharacter },
        end: { line: endLine, character: endCharacter },
    };
}

suite(YAMLParser.name, function () {
    suite(YAMLParser.prototype.parse.name, function () {
        test('map', function () {
            const content = [
                `a:`,
                `  aa: 0`,
                `b:`,
                `  bb: 0`,
                `c: 0`,
            ].join('\n');

            const root = new YAMLParser(content).parse();

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
            const content = [
                `- 0`,
                `- 1`,
            ].join('\n');

            const root = new YAMLParser(content).parse();

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
            const content = [
                `a-null:`,
                `an-empty-string: ""`,
                `a-string: something`,
                `a-number: 999`,
                `a-false: false`,
                `a-true: true`,
            ].join('\n');

            const root = new YAMLParser(content).parse();

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
    test('valid', function () {
        const content = [
            `action-empty: {}`,
            `action-with-description-empty:`,
            `  description: ""`,
            `action-with-description:`,
            `  description: description`,
        ].join('\n');

        const { actions, node } = parseCharmActionsYAML(content);

        assert.isEmpty(node.problems, 'expected no file-scope problem');
        assert.lengthOf(actions, 3);
        assert.isEmpty(actions.map(x => [
            ...x.node.problems,
            ...x.description.node?.problems || [],
        ]).flat(), 'problem in some action(s)');

        const c = cursor(actions);

        c.next();
        assert.equal(c.current.name, 'action-empty');
        assert.equal(c.current.symbol, 'action_empty');
        assert.equal(c.current.node.text, 'action-empty: {}');
        assert.deepStrictEqual(c.current.node.range, newRange(0, 0, 1, 0));

        c.next();
        assert.equal(c.current.name, 'action-with-description-empty');
        assert.equal(c.current.symbol, 'action_with_description_empty');
        assert.equal(c.current.node.text, 'action-with-description-empty:\n  description: ""');
        assert.deepStrictEqual(c.current.node.range, newRange(1, 0, 3, 0));
        assert.equal(c.current.description.value, '');
        assert.equal(c.current.description.node?.text, 'description: ""');
        assert.deepStrictEqual(c.current.description.node?.range, newRange(2, 2, 3, 0));
        assert.deepStrictEqual(c.current.description.node?.pairKeyRange, newRange(2, 2, 2, 13));
        assert.deepStrictEqual(c.current.description.node?.pairValueRange, newRange(2, 15, 3, 0));

        c.next();
        assert.equal(c.current.name, 'action-with-description');
        assert.equal(c.current.symbol, 'action_with_description');
        assert.equal(c.current.node.text, 'action-with-description:\n  description: description');
        assert.deepStrictEqual(c.current.node.range, newRange(3, 0, 5, 0));
        assert.equal(c.current.description.value, 'description');
        assert.equal(c.current.description.node?.text, 'description: description');
        assert.deepStrictEqual(c.current.description.node?.range, newRange(4, 2, 5, 0));
        assert.deepStrictEqual(c.current.description.node?.pairKeyRange, newRange(4, 2, 4, 13));
        assert.deepStrictEqual(c.current.description.node?.pairValueRange, newRange(4, 15, 5, 0));
    });

    test('invalid', function () {
        const content = [
            `action-array-empty: []`,
            `action-array:`,
            `  - element`,
            `action-string: something`,
            `action-number: 0`,
            `action-invalid-description-array-empty:`,
            `  description: []`,
            `action-invalid-description-array:`,
            `  description:`,
            `    - element`,
            `action-invalid-description-number:`,
            `  description: 0`,
        ].join('\n');

        const { actions, node } = parseCharmActionsYAML(content);
        assert.lengthOf(node.problems, 0, 'expected no file-scope problem');
        assert.lengthOf(actions, 7);

        const c = cursor(actions);

        c.next();
        assert.strictEqual(c.current.name, 'action-array-empty');
        assert.strictEqual(c.current.symbol, 'action_array_empty');
        assert.strictEqual(c.current.node.text, 'action-array-empty: []');
        assert.deepStrictEqual(c.current.node.range, newRange(0, 0, 1, 0));
        assert.deepStrictEqual(c.current.node.problems, [{ id: 'expectedObject', message: 'Must be an object.' }]);
        assert.isUndefined(c.current.description.value);
        assert.isUndefined(c.current.description.node);

        c.next();
        assert.strictEqual(c.current.name, 'action-array');
        assert.strictEqual(c.current.symbol, 'action_array');
        assert.strictEqual(c.current.node.text, 'action-array:\n  - element');
        assert.deepStrictEqual(c.current.node.range, newRange(1, 0, 3, 0));
        assert.deepStrictEqual(c.current.node.problems, [{ id: 'expectedObject', message: 'Must be an object.' }]);
        assert.isUndefined(c.current.description.value);
        assert.isUndefined(c.current.description.node);

        c.next();
        assert.strictEqual(c.current.name, 'action-string');
        assert.strictEqual(c.current.symbol, 'action_string');
        assert.strictEqual(c.current.node.text, 'action-string: something');
        assert.deepStrictEqual(c.current.node.range, newRange(3, 0, 4, 0));
        assert.deepStrictEqual(c.current.node.problems, [{ id: 'expectedObject', message: 'Must be an object.' }]);
        assert.isUndefined(c.current.description.value);
        assert.isUndefined(c.current.description.node);

        c.next();
        assert.strictEqual(c.current.name, 'action-number');
        assert.strictEqual(c.current.symbol, 'action_number');
        assert.strictEqual(c.current.node.text, 'action-number: 0');
        assert.deepStrictEqual(c.current.node.range, newRange(4, 0, 5, 0));
        assert.deepStrictEqual(c.current.node.problems, [{ id: 'expectedObject', message: 'Must be an object.' }]);
        assert.isUndefined(c.current.description.value);
        assert.isUndefined(c.current.description.node);

        c.next();
        assert.strictEqual(c.current.name, 'action-invalid-description-array-empty');
        assert.strictEqual(c.current.symbol, 'action_invalid_description_array_empty');
        assert.strictEqual(c.current.node.text, 'action-invalid-description-array-empty:\n  description: []');
        assert.deepStrictEqual(c.current.node.range, newRange(5, 0, 7, 0));
        assert.isEmpty(c.current.node.problems);
        assert.deepStrictEqual(c.current.description.node?.problems, [{
            expected: 'string',
            id: 'unexpectedPrimitiveType',
            message: 'Must be a string.',
        }]);
        assert.isUndefined(c.current.description.value);
        assert.strictEqual(c.current.description.node?.text, 'description: []');
        assert.deepStrictEqual(c.current.description.node?.range, newRange(6, 2, 7, 0));
        assert.deepStrictEqual(c.current.description.node?.pairKeyRange, newRange(6, 2, 6, 13));
        assert.deepStrictEqual(c.current.description.node?.pairValueRange, newRange(6, 15, 7, 0));

        c.next();
        assert.strictEqual(c.current.name, 'action-invalid-description-array');
        assert.strictEqual(c.current.symbol, 'action_invalid_description_array');
        assert.strictEqual(c.current.node.text, 'action-invalid-description-array:\n  description:\n    - element');
        assert.deepStrictEqual(c.current.node.range, newRange(7, 0, 10, 0));
        assert.isEmpty(c.current.node.problems);
        assert.deepStrictEqual(c.current.description.node?.problems, [{
            expected: 'string',
            id: 'unexpectedPrimitiveType',
            message: 'Must be a string.',
        }]);
        assert.isUndefined(c.current.description.value);
        assert.strictEqual(c.current.description.node?.text, 'description:\n    - element');
        assert.deepStrictEqual(c.current.description.node?.range, newRange(8, 2, 10, 0));
        assert.deepStrictEqual(c.current.description.node?.pairKeyRange, newRange(8, 2, 8, 13));
        assert.deepStrictEqual(c.current.description.node?.pairValueRange, newRange(9, 4, 10, 0));

        c.next();
        assert.strictEqual(c.current.name, 'action-invalid-description-number');
        assert.strictEqual(c.current.symbol, 'action_invalid_description_number');
        assert.strictEqual(c.current.node.text, 'action-invalid-description-number:\n  description: 0');
        assert.deepStrictEqual(c.current.node.range, newRange(10, 0, 12, 0));
        assert.isEmpty(c.current.node.problems);
        assert.deepStrictEqual(c.current.description.node?.problems, [{
            expected: 'string',
            id: 'unexpectedPrimitiveType',
            message: 'Must be a string.',
        }]);
        assert.isUndefined(c.current.description.value);
        assert.strictEqual(c.current.description.node?.text, 'description: 0');
        assert.deepStrictEqual(c.current.description.node?.range, newRange(11, 2, 12, 0));
        assert.deepStrictEqual(c.current.description.node?.pairKeyRange, newRange(11, 2, 11, 13));
        assert.deepStrictEqual(c.current.description.node?.pairValueRange, newRange(11, 15, 12, 0));
    });

    suite('invalid yaml structure', function () {
        const tests: { name: string; content: string; expectedProblems: Problem[] }[] = [
            {
                name: 'invalid yaml',
                content: '123',
                expectedProblems: [{ id: 'invalidYAML', message: "Invalid YAML file." }],
            },
            {
                name: 'empty',
                content: '',
                expectedProblems: [{ id: 'invalidYAML', message: 'Invalid YAML file.' }],
            },
        ];

        for (const t of tests) {
            const tt = t;
            test(tt.name, function () {
                const { node } = parseCharmActionsYAML(tt.content);
                assert.includeDeepMembers(node.problems, tt.expectedProblems);
            });
        }
    });
});


suite(parseCharmConfigYAML.name, function () {
    function allProblems(parameter: CharmConfigParameter): Problem[] {
        return [
            ...parameter.node.problems,
            ...parameter.node.entire?.problems || [],
            ...parameter.node.type?.problems || [],
            ...parameter.node.description?.problems || [],
            ...parameter.node.default?.problems || [],
        ];
    }

    test('valid', function () {
        const content = [
            `options:`,
            `  # Full params (type, description, default)`,
            `  int-param-full:`,
            `    type: int`,
            `    description: some description`,
            `    default: -1`,
            `  float-param-full:`,
            `    type: float`,
            `    description: some description`,
            `    default: -1e-1`,
            `  string-param-full:`,
            `    type: string`,
            `    description: some description`,
            `    default: hello`,
            `  boolean-param-full:`,
            `    type: boolean`,
            `    description: some description`,
            `    default: false`,
            ``,
            `  # Minimal params (type)`,
            `  int-param-minimal:`,
            `    type: int`,
            `  float-param-minimal:`,
            `    type: float`,
            `  string-param-minimal:`,
            `    type: string`,
            `  boolean-param-minimal:`,
            `    type: boolean`,
            ``,
            `  # Partial params (type, default)`,
            `  int-param-with-default:`,
            `    type: int`,
            `    default: -1`,
            `  float-param-with-default:`,
            `    type: float`,
            `    default: -1e-1`,
            `  string-param-with-default:`,
            `    type: string`,
            `    default: hello`,
            `  boolean-param-with-default:`,
            `    type: boolean`,
            `    default: false`,
            ``,
            `  # Partial params (type, description)`,
            `  int-param-with-description:`,
            `    type: int`,
            `    description: some description`,
            `  float-param-with-description:`,
            `    type: float`,
            `    description: some description`,
            `  string-param-with-description:`,
            `    type: string`,
            `    description: some description`,
            `  boolean-param-with-description:`,
            `    type: boolean`,
            `    description: some description`,
        ].join('\n');

        const { parameters, problems } = parseCharmConfigYAML(content);

        assert.isEmpty(problems, 'expected no file-scope problem');
        assert.lengthOf(parameters, 16);
        assert.isEmpty(parameters.map(x => allProblems(x)).flat(), 'problem in some parameter(s)');
    });

    test('type/default mismatch', function () {
        const content = [
            `options:`,
            `  type-missing: {}`,
            `  type-invalid-string:`,
            `    type: invalid-value-for-type`,
            `  type-invalid-int:`,
            `    type: 0`,
            `  type-invalid-array:`,
            `    type: []`,
            `  type-invalid-object:`,
            `    type: {}`,
            `  type-invalid-boolean:`,
            `    type: false`,
            `  description-invalid-int:`,
            `    type: string`,
            `    description: 0`,
            `  description-invalid-array:`,
            `    type: string`,
            `    description: []`,
            `  description-invalid-object:`,
            `    type: string`,
            `    description: {}`,
            `  description-invalid-boolean:`,
            `    type: string`,
            `    description: false`,
            `  # Invalid default values when type is missing (Note that when the type field`,
            `  # is present, the default value should match the that type)`,
            `  default-invalid-object:`,
            `    default: {}`,
            `  default-invalid-array:`,
            `    default: []`,
        ].join('\n');

        const { parameters, problems } = parseCharmConfigYAML(content);

        assert.lengthOf(problems, 0, 'expected no file-scope problem');
        assert.lengthOf(parameters, 11);

        const c = cursor(parameters);

        c.next();
        assert.strictEqual(c.current.name, 'int-param-with-boolean-default');
        assert.deepEqual(c.current.node.default?.problems, [{ message: 'Default value must match the parameter type; it must be an integer.' }]);

        c.next();
        assert.strictEqual(c.current.name, 'int-param-with-string-default');
        assert.deepEqual(c.current.node.default?.problems, [{ message: 'Default value must match the parameter type; it must be an integer.' }]);

        c.next();
        assert.strictEqual(c.current.name, 'int-param-with-float-default');
        assert.deepEqual(c.current.node.default?.problems, [{ message: 'Default value must match the parameter type; it must be an integer.' }]);

        c.next();
        assert.strictEqual(c.current.name, 'float-param-with-boolean-default');
        assert.deepEqual(c.current.node.default?.problems, [{ message: 'Default value must match the parameter type; it must be a float.' }]);

        c.next();
        assert.strictEqual(c.current.name, 'float-param-with-string-default');
        assert.deepEqual(c.current.node.default?.problems, [{ message: 'Default value must match the parameter type; it must be a float.' }]);

        c.next();
        assert.strictEqual(c.current.name, 'string-param-with-boolean-default');
        assert.deepEqual(c.current.node.default?.problems, [{ message: 'Default value must match the parameter type; it must be a string.' }]);

        c.next();
        assert.strictEqual(c.current.name, 'string-param-with-int-default');
        assert.deepEqual(c.current.node.default?.problems, [{ message: 'Default value must match the parameter type; it must be a string.' }]);

        c.next();
        assert.strictEqual(c.current.name, 'string-param-with-float-default');
        assert.deepEqual(c.current.node.default?.problems, [{ message: 'Default value must match the parameter type; it must be a string.' }]);

        c.next();
        assert.strictEqual(c.current.name, 'boolean-param-with-string-default');
        assert.deepEqual(c.current.node.default?.problems, [{ message: 'Default value must match the parameter type; it must be a boolean.' }]);

        c.next();
        assert.strictEqual(c.current.name, 'boolean-param-with-int-default');
        assert.deepEqual(c.current.node.default?.problems, [{ message: 'Default value must match the parameter type; it must be a boolean.' }]);

        c.next();
        assert.strictEqual(c.current.name, 'boolean-param-with-float-default');
        assert.deepEqual(c.current.node.default?.problems, [{ message: 'Default value must match the parameter type; it must be a boolean.' }]);
    });

    test('invalid parameter', function () {
        const content = [
            `options:`,
            `  type-missing: {}`,
            `  type-invalid-string:`,
            `    type: invalid-value-for-type`,
            `  type-invalid-int:`,
            `    type: 0`,
            `  type-invalid-array:`,
            `    type: []`,
            `  type-invalid-object:`,
            `    type: {}`,
            `  type-invalid-boolean:`,
            `    type: false`,
            `  description-invalid-int:`,
            `    type: string`,
            `    description: 0`,
            `  description-invalid-array:`,
            `    type: string`,
            `    description: []`,
            `  description-invalid-object:`,
            `    type: string`,
            `    description: {}`,
            `  description-invalid-boolean:`,
            `    type: string`,
            `    description: false`,
            `  # Invalid default values when type is missing (Note that when the type field`,
            `  # is present, the default value should match the that type)`,
            `  default-invalid-object:`,
            `    default: {}`,
            `  default-invalid-array:`,
            `    default: []`,
        ].join('\n');

        const { parameters, problems } = parseCharmConfigYAML(content);

        assert.lengthOf(problems, 0, 'expected no file-scope problem');
        assert.lengthOf(parameters, 12);

        const c = cursor(parameters);

        c.next();
        assert.strictEqual(c.current.name, 'type-missing');
        assert.deepEqual(c.current.node.problems, [{ key: 'type', message: 'Missing `type` field.' }]);

        c.next();
        assert.strictEqual(c.current.name, 'type-invalid-string');
        assert.deepEqual(c.current.node.type?.problems, [{ message: 'Must be one of the following: string, int, float, boolean.' }]);

        c.next();
        assert.strictEqual(c.current.name, 'type-invalid-int');
        assert.deepEqual(c.current.node.type?.problems, [{ message: 'Must be a string.' }]);

        c.next();
        assert.strictEqual(c.current.name, 'type-invalid-array');
        assert.deepEqual(c.current.node.type?.problems, [{ message: 'Must be a string.' }]);

        c.next();
        assert.strictEqual(c.current.name, 'type-invalid-object');
        assert.deepEqual(c.current.node.type?.problems, [{ message: 'Must be a string.' }]);

        c.next();
        assert.strictEqual(c.current.name, 'type-invalid-boolean');
        assert.deepEqual(c.current.node.type?.problems, [{ message: 'Must be a string.' }]);

        c.next();
        assert.strictEqual(c.current.name, 'description-invalid-int');
        assert.deepEqual(c.current.node.description?.problems, [{ message: 'Must be a string.' }]);

        c.next();
        assert.strictEqual(c.current.name, 'description-invalid-array');
        assert.deepEqual(c.current.node.description?.problems, [{ message: 'Must be a string.' }]);

        c.next();
        assert.strictEqual(c.current.name, 'description-invalid-object');
        assert.deepEqual(c.current.node.description?.problems, [{ message: 'Must be a string.' }]);

        c.next();
        assert.strictEqual(c.current.name, 'description-invalid-boolean');
        assert.deepEqual(c.current.node.description?.problems, [{ message: 'Must be a string.' }]);

        c.next();
        assert.strictEqual(c.current.name, 'default-invalid-object');
        assert.deepEqual(c.current.node.default?.problems, [{ message: 'Default value must have a valid type; boolean, string, integer, or float.' }]);

        c.next();
        assert.strictEqual(c.current.name, 'default-invalid-array');
        assert.deepEqual(c.current.node.default?.problems, [{ message: 'Default value must have a valid type; boolean, string, integer, or float.' }]);
    });

    suite('valid yaml structure', function () {
        const tests: { name: string; content: string; }[] = [
            {
                name: 'no `options` key',
                content: 'parent:\n  key: value',
            }
        ];

        for (const t of tests) {
            const tt = t;
            test(tt.name, function () {
                const { parameters, problems } = parseCharmConfigYAML(tt.content);
                problems.push(...parameters.map(x => allProblems(x)).flat());
                assert.isEmpty(problems);
            });
        }
    });

    suite('invalid yaml structure', function () {
        const tests: { name: string; content: string; expectedProblems: Problem[] }[] = [
            {
                name: 'invalid yaml',
                content: '123',
                expectedProblems: [{ message: "Invalid YAML file." }],
            },
            {
                name: 'empty',
                content: '',
                expectedProblems: [{ message: 'Invalid YAML file.' }],
            },
            {
                name: 'non-object `options` (empty array)',
                content: 'options: []',
                expectedProblems: [{ message: 'Must be an object.' }],
            },
            {
                name: 'non-object `options` (array)',
                content: 'options:\n  - element',
                expectedProblems: [{ message: 'Must be an object.' }],
            },
            {
                name: 'non-object parameter',
                content: 'options:\n  param: 999',
                expectedProblems: [{ message: 'Must be an object.' }],
            },
            {
                name: 'non-object parameter (empty array)',
                content: 'options:\n  param: []',
                expectedProblems: [{ message: 'Must be an object.' }],
            },
            {
                name: 'non-object parameter (array)',
                content: 'options:\n  param:\n    - element',
                expectedProblems: [{ message: 'Must be an object.' }],
            },
        ];

        for (const t of tests) {
            const tt = t;
            test(tt.name, function () {
                const { parameters, problems } = parseCharmConfigYAML(tt.content);
                const allProblems = problems.concat(parameters.map(x => x.node.problems).flat());
                assert.includeDeepMembers(allProblems, tt.expectedProblems);
            });
        }
    });
});

suite(parseCharmMetadataYAML.name, function () {
    test('valid-complete', function () {
        /**
         * Here:
         * - Keys are ordered alphabetically.
         * - Values are valid.
         * - All fields (both optional or required) are assigned.
         * - Fields that accept an array of values or a map of key/value pairs, are
         *   assigned with more than one element/pair.
         */
        const content = [
            `assumes:`,
            `  - juju >= 2.9`,
            `  - k8s-api`,
            `  - all-of:`,
            `      - juju >= 2.9`,
            `      - k8s-api`,
            `  - any-of:`,
            `      - juju >= 2.9`,
            `      - k8s-api`,
            `containers:`,
            `  container-one:`,
            `    resource: resource-one`,
            `    mounts:`,
            `      - storage: storage-one`,
            `        location: /some/location`,
            `      - storage: storage-two`,
            `        location: /some/location`,
            `  container-two:`,
            `    bases:`,
            `      - name: base-one`,
            `        channel: channel-one`,
            `        architectures:`,
            `          - architecture-one`,
            `          - architecture-two`,
            `      - name: base-two`,
            `        channel: channel-two`,
            `        architectures:`,
            `          - architecture-one`,
            `          - architecture-two`,
            `    mounts:`,
            `      - storage: storage-one`,
            `        location: /some/location`,
            `      - storage: storage-two`,
            `        location: /some/location`,
            `description: my-charm-description`,
            `devices:`,
            `  device-one:`,
            `    type: gpu`,
            `    description: device-one-description`,
            `    countmin: 1`,
            `    countmax: 2`,
            `  device-two:`,
            `    type: nvidia.com/gpu`,
            `    description: device-two-description`,
            `    countmin: 1`,
            `    countmax: 2`,
            `  device-three:`,
            `    type: amd.com/gpu`,
            `    description: device-three-description`,
            `    countmin: 1`,
            `    countmax: 2`,
            `display-name: my-charm-display-name`,
            `docs: https://docs.url`,
            `extra-bindings:`,
            `  binding-one:`,
            `  binding-two:`,
            `issues:`,
            `  - https://one.issues.url`,
            `  - https://two.issues.url`,
            `maintainers:`,
            `  - John Doe <john.doe@company.com>`,
            `  - Jane Doe <jane.doe@company.com>`,
            `name: my-charm`,
            `peers:`,
            `  peer-one:`,
            `    interface: interface-one`,
            `    limit: 1`,
            `    optional: false`,
            `    scope: global`,
            `  peer-two:`,
            `    interface: interface-two`,
            `    limit: 2`,
            `    optional: true`,
            `    scope: container`,
            `provides:`,
            `  provides-one:`,
            `    interface: interface-one`,
            `    limit: 1`,
            `    optional: false`,
            `    scope: global`,
            `  provides-two:`,
            `    interface: interface-two`,
            `    limit: 2`,
            `    optional: true`,
            `    scope: container`,
            `requires:`,
            `  requires-one:`,
            `    interface: interface-one`,
            `    limit: 1`,
            `    optional: false`,
            `    scope: global`,
            `  requires-two:`,
            `    interface: interface-two`,
            `    limit: 2`,
            `    optional: true`,
            `    scope: container`,
            `resources:`,
            `  resource-one:`,
            `    type: oci-image`,
            `    description: resource-one-description`,
            `  resource-two:`,
            `    type: file`,
            `    description: resource-two-description`,
            `    filename: some-file-name`,
            `source:`,
            `  - https://one.source.url`,
            `  - https://two.source.url`,
            `storage:`,
            `  storage-one:`,
            `    type: filesystem`,
            `    description: storage-one-description`,
            `    location: /some/location`,
            `    shared: false`,
            `    read-only: false`,
            `    multiple: 1`,
            `    minimum-size: 1`,
            `    properties:`,
            `      - transient`,
            `  storage-two:`,
            `    type: block`,
            `    description: storage-two-description`,
            `    location: /some/location`,
            `    shared: true`,
            `    read-only: true`,
            `    multiple: 1+`,
            `    minimum-size: 1G`,
            `    properties:`,
            `      - transient`,
            `subordinate: false`,
            `summary: my-charm-summary`,
            `terms:`,
            `  - term-one`,
            `  - term-two`,
            `website:`,
            `  - https://one.website.url`,
            `  - https://two.website.url`,
            `z-custom-field-array:`,
            `  - custom-value-one`,
            `  - custom-value-two`,
            `z-custom-field-boolean: true`,
            `z-custom-field-map:`,
            `  key-one: value-one`,
            `  key-two: value-two`,
            `z-custom-field-number: 0`,
            `z-custom-field-string: some-string-value`,
        ].join('\n');

        const metadata = parseCharmMetadataYAML(content);
        assert.isEmpty(metadata.problems, 'expected no file-scope problem');
        /* eslint-disable */
        assert.deepStrictEqual(metadata, {
            raw: content,
            problems: [],
            node: emptyYAMLNode(),
            assumes: {
                problems: [],
                singles: ['juju >= 2.9', 'k8s-api'],
                allOf: ['juju >= 2.9', 'k8s-api'],
                anyOf: ['juju >= 2.9', 'k8s-api'],
            },
            containers: [{
                problems: [],
                name: 'container-one',
                resource: 'resource-one',
                mounts: [{
                    problems: [],
                    storage: 'storage-one',
                    location: '/some/location'
                },
                {
                    problems: [],
                    storage: 'storage-two',
                    location: '/some/location'
                }]
            }, {
                problems: [],
                name: 'container-two',
                bases: [{
                    problems: [],
                    name: 'base-one',
                    channel: 'channel-one',
                    architectures: [
                        'architecture-one',
                        'architecture-two'
                    ]
                }, {
                    problems: [],
                    name: 'base-two',
                    channel: 'channel-two',
                    architectures: [
                        'architecture-one',
                        'architecture-two'
                    ]
                }
                ],
                mounts: [{
                    problems: [],
                    storage: 'storage-one',
                    location: '/some/location'
                },
                {
                    problems: [],
                    storage: 'storage-two',
                    location: '/some/location'
                }]
            }],
            customFields: {
                'z-custom-field-array': ['custom-value-one', 'custom-value-two'],
                'z-custom-field-boolean': true,
                'z-custom-field-map': {
                    'key-one': 'value-one',
                    'key-two': 'value-two'
                },
                'z-custom-field-number': 0,
                'z-custom-field-string': 'some-string-value'
            },
            description: 'my-charm-description',
            devices: [
                {
                    problems: [],
                    name: 'device-one',
                    type: 'gpu',
                    description: 'device-one-description',
                    countMin: 1,
                    countMax: 2
                },
                {
                    problems: [],
                    name: 'device-two',
                    type: 'nvidia.com/gpu',
                    description: 'device-two-description',
                    countMin: 1,
                    countMax: 2
                },
                {
                    problems: [],
                    name: 'device-three',
                    type: 'amd.com/gpu',
                    description: 'device-three-description',
                    countMin: 1,
                    countMax: 2
                }
            ],
            displayName: 'my-charm-display-name',
            docs: 'https://docs.url',
            extraBindings: [
                {
                    problems: [],
                    name: 'binding-one'
                },
                {
                    problems: [],
                    name: 'binding-two'
                }
            ],
            issues: ['https://one.issues.url', 'https://two.issues.url'],
            maintainers: ['John Doe <john.doe@company.com>', 'Jane Doe <jane.doe@company.com>'],
            name: 'my-charm',
            peers: [{
                problems: [],
                name: 'peer-one',
                interface: 'interface-one',
                limit: 1,
                optional: false,
                scope: 'global'
            }, {
                problems: [],
                name: 'peer-two',
                interface: 'interface-two',
                limit: 2,
                optional: true,
                scope: 'container'
            }],
            provides: [{
                problems: [],
                name: 'provides-one',
                interface: 'interface-one',
                limit: 1,
                optional: false,
                scope: 'global'
            }, {
                problems: [],
                name: 'provides-two',
                interface: 'interface-two',
                limit: 2,
                optional: true,
                scope: 'container'
            }],
            requires: [{
                problems: [],
                name: 'requires-one',
                interface: 'interface-one',
                limit: 1,
                optional: false,
                scope: 'global'
            }, {
                problems: [],
                name: 'requires-two',
                interface: 'interface-two',
                limit: 2,
                optional: true,
                scope: 'container'
            }],
            resources: [
                {
                    problems: [],
                    name: 'resource-one',
                    type: 'oci-image',
                    description: 'resource-one-description'
                }, {
                    problems: [],
                    name: 'resource-two',
                    type: 'file',
                    description: 'resource-two-description',
                    filename: 'some-file-name'
                }
            ],
            source: ['https://one.source.url', 'https://two.source.url'],
            storage: [{
                problems: [],
                name: 'storage-one',
                type: 'filesystem',
                description: 'storage-one-description',
                location: '/some/location',
                shared: false,
                readOnly: false,
                multiple: '1',
                minimumSize: '1',
                properties: ['transient']
            }, {
                problems: [],
                name: 'storage-two',
                type: 'block',
                description: 'storage-two-description',
                location: '/some/location',
                shared: true,
                readOnly: true,
                multiple: '1+',
                minimumSize: '1G',
                properties: ['transient']
            }],
            subordinate: false,
            summary: 'my-charm-summary',
            terms: ['term-one', 'term-two'],
            website: ['https://one.website.url', 'https://two.website.url'],
        } satisfies CharmMetadata);
        /* eslint-enable */
    });
});




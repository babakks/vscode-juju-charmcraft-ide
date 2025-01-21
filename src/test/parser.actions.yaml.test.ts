import { assert } from "chai";
import { suite, test } from "mocha";
import type { CharmActions } from "../model/actions.yaml";
import type { Problem } from "../model/common";
import { parseCharmActionsYAML } from "../parser/actions.yaml";
import { unindent } from "./util";
import { cursorOverMap } from "./parser.common.test";

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
        assert.strictEqual(c.currentKey, 'action-empty');
        assert.equal(c.current.value?.name, 'action-empty');
        assert.equal(c.current.value?.symbol, 'action_empty');
        assert.isUndefined(c.current.value?.description);
        assert.equal(c.current.node.text, 'action-empty: {}');

        c.next();
        assert.strictEqual(c.currentKey, 'action-with-description-empty');
        assert.equal(c.current.value?.name, 'action-with-description-empty');
        assert.equal(c.current.value?.symbol, 'action_with_description_empty');
        assert.equal(c.current.node.text, 'action-with-description-empty:\n  description: ""');
        assert.equal(c.current.value?.description?.value, '');
        assert.equal(c.current.value?.description?.node.pairText, 'description: ""');
        assert.equal(c.current.value?.description?.node.text, '""');

        c.next();
        assert.strictEqual(c.currentKey, 'action-with-description');
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
        assert.strictEqual(c.currentKey, 'action-array-empty');
        assert.isUndefined(c.current.value);
        assert.strictEqual(c.current.node.text, 'action-array-empty: []');
        assert.deepStrictEqual(c.current.node.problems, [{ id: 'expectedMap', message: 'Must be a map.' }]);

        c.next();
        assert.strictEqual(c.currentKey, 'action-array');
        assert.isUndefined(c.current.value);
        assert.strictEqual(c.current.node.text, 'action-array:\n  - element');
        assert.deepStrictEqual(c.current.node.problems, [{ id: 'expectedMap', message: 'Must be a map.' }]);

        c.next();
        assert.strictEqual(c.currentKey, 'action-string');
        assert.isUndefined(c.current.value);
        assert.strictEqual(c.current.node.text, 'action-string: something');
        assert.deepStrictEqual(c.current.node.problems, [{ id: 'expectedMap', message: 'Must be a map.' }]);

        c.next();
        assert.strictEqual(c.currentKey, 'action-number');
        assert.isUndefined(c.current.value);
        assert.strictEqual(c.current.node.text, 'action-number: 0');
        assert.deepStrictEqual(c.current.node.problems, [{ id: 'expectedMap', message: 'Must be a map.' }]);

        c.next();
        assert.strictEqual(c.currentKey, 'action-invalid-description-array-empty');
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
        assert.strictEqual(c.currentKey, 'action-invalid-description-array');
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
        assert.strictEqual(c.currentKey, 'action-invalid-description-number');
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

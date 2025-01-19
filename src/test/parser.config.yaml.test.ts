import { assert } from "chai";
import { suite, test } from "mocha";
import type { CharmConfig } from "../model/config.yaml";
import type { Problem } from "../model/common";
import { parseCharmConfigYAML } from "../parser/config.yaml";
import { cursorOverMap } from "./parser.common.test";
import { unindent } from "./util";

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
        assert.deepEqual(c.current.value?.type?.node.problems, [{ id: 'expectedEnumValue', expected: ['string', 'int', 'float', 'boolean'], message: 'Must be one of the following: `string`, `int`, `float`, `boolean`.' }]);

        c.next();
        assert.strictEqual(c.current.value?.name, 'type-invalid-int');
        assert.deepEqual(c.current.value?.type?.node.problems, [{ id: 'expectedEnumValue', expected: ['string', 'int', 'float', 'boolean'], message: 'Must be one of the following: `string`, `int`, `float`, `boolean`.' }]);

        c.next();
        assert.strictEqual(c.current.value?.name, 'type-invalid-array');
        assert.deepEqual(c.current.value?.type?.node.problems, [{ id: 'expectedEnumValue', expected: ['string', 'int', 'float', 'boolean'], message: 'Must be one of the following: `string`, `int`, `float`, `boolean`.' }]);

        c.next();
        assert.strictEqual(c.current.value?.name, 'type-invalid-object');
        assert.deepEqual(c.current.value?.type?.node.problems, [{ id: 'expectedEnumValue', expected: ['string', 'int', 'float', 'boolean'], message: 'Must be one of the following: `string`, `int`, `float`, `boolean`.' }]);

        c.next();
        assert.strictEqual(c.current.value?.name, 'type-invalid-boolean');
        assert.deepEqual(c.current.value?.type?.node.problems, [{ id: 'expectedEnumValue', expected: ['string', 'int', 'float', 'boolean'], message: 'Must be one of the following: `string`, `int`, `float`, `boolean`.' }]);

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

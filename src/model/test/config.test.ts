import { assert } from "chai";
import * as fs from 'fs/promises';
import { describe, suite, test } from "mocha";
import { TextDecoder } from "util";
import { parseCharmConfigYAML } from "../config";
import { CharmConfigParameterProblem } from "../type";
import path = require("path");

suite(parseCharmConfigYAML.name, async function () {
    async function parseConfig(relativePath: string): Promise<ReturnType<typeof parseCharmConfigYAML>> {
        return parseCharmConfigYAML(new TextDecoder().decode(await fs.readFile(path.join(__dirname, relativePath))));
    }

    test('valid', async function () {
        const { parameters, problems } = await parseConfig('../../../resource/test/config.yaml/valid.config.yaml');
        assert.isEmpty(problems, 'expected no file-scope problem');
        assert.lengthOf(parameters, 16);
        assert.isFalse(parameters.some(x => x.problems.length > 0), 'problem in some parameters');
    });

    test('type/default mismatch', async function () {
        const { parameters, problems } = await parseConfig('../../../resource/test/config.yaml/type-default-mismatch.config.yaml');
        assert.lengthOf(problems, 0, 'expected no file-scope problem');
        assert.lengthOf(parameters, 11);

        const allProblems = parameters.map(x => x.problems).flat();
        assert.includeDeepMembers(allProblems, [
            { parameter: 'int-param-with-boolean-default', message: 'Default value for parameter `int-param-with-boolean-default` should be an integer value.' },
            { parameter: 'int-param-with-string-default', message: 'Default value for parameter `int-param-with-string-default` should be an integer value.' },
            { parameter: 'int-param-with-float-default', message: 'Default value for parameter `int-param-with-float-default` should be an integer value.' },
            { parameter: 'float-param-with-boolean-default', message: 'Default value for parameter `float-param-with-boolean-default` should be a float value.' },
            { parameter: 'float-param-with-string-default', message: 'Default value for parameter `float-param-with-string-default` should be a float value.' },
            { parameter: 'string-param-with-boolean-default', message: 'Default value for parameter `string-param-with-boolean-default` should be a string value.' },
            { parameter: 'string-param-with-int-default', message: 'Default value for parameter `string-param-with-int-default` should be a string value.' },
            { parameter: 'string-param-with-float-default', message: 'Default value for parameter `string-param-with-float-default` should be a string value.' },
            { parameter: 'boolean-param-with-string-default', message: 'Default value for parameter `boolean-param-with-string-default` should be a boolean value.' },
            { parameter: 'boolean-param-with-int-default', message: 'Default value for parameter `boolean-param-with-int-default` should be a boolean value.' },
            { parameter: 'boolean-param-with-float-default', message: 'Default value for parameter `boolean-param-with-float-default` should be a boolean value.' },
        ]);
    });

    test('invalid parameter', async function () {
        const { parameters, problems } = await parseConfig('../../../resource/test/config.yaml/invalid.config.yaml');
        assert.lengthOf(problems, 0, 'expected no file-scope problem');
        assert.lengthOf(parameters, 12);

        const allProblems = parameters.map(x => x.problems).flat();
        assert.includeDeepMembers(allProblems, [
            { parameter: 'type-missing', message: 'Parameter `type-missing` must include `type` field.' },
            { parameter: 'type-invalid-string', message: 'Parameter `type-invalid-string` must have a valid type; `bool`, `string`, `int`, or `float`.' },
            { parameter: 'type-invalid-int', message: 'Parameter `type-invalid-int` must have a valid type; `bool`, `string`, `int`, or `float`.' },
            { parameter: 'type-invalid-array', message: 'Parameter `type-invalid-array` must have a valid type; `bool`, `string`, `int`, or `float`.' },
            { parameter: 'type-invalid-object', message: 'Parameter `type-invalid-object` must have a valid type; `bool`, `string`, `int`, or `float`.' },
            { parameter: 'type-invalid-boolean', message: 'Parameter `type-invalid-boolean` must have a valid type; `bool`, `string`, `int`, or `float`.' },
            { parameter: 'description-invalid-int', message: 'Description for parameter `description-invalid-int` should be a string.' },
            { parameter: 'description-invalid-array', message: 'Description for parameter `description-invalid-array` should be a string.' },
            { parameter: 'description-invalid-object', message: 'Description for parameter `description-invalid-object` should be a string.' },
            { parameter: 'description-invalid-boolean', message: 'Description for parameter `description-invalid-boolean` should be a string.' },
            { parameter: 'default-invalid-object', message: 'Default value for parameter `default-invalid-object` must have a valid type; boolean, string, integer, or float.' },
            { parameter: 'default-invalid-array', message: 'Default value for parameter `default-invalid-array` must have a valid type; boolean, string, integer, or float.' },
        ]);
    });

    suite('invalid yaml structure', function () {
        const tests: { name: string; content: string; expectedProblems: CharmConfigParameterProblem[] }[] = [
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
                name: 'no `options` key',
                content: 'parent:\n  key: value',
                expectedProblems: [{ message: 'Missing `options` field.' }],
            },
            {
                name: 'non-object `options` (empty array)',
                content: 'options: []',
                expectedProblems: [{ message: 'The `options` field must be an object.' }],
            },
            {
                name: 'non-object `options` (array)',
                content: 'options:\n  - element',
                expectedProblems: [{ message: 'The `options` field must be an object.' }],
            },
            {
                name: 'non-object parameter',
                content: 'options:\n  param: 999',
                expectedProblems: [{ parameter: 'param', message: 'Parameter entry `param` must be an object.' }],
            },
            {
                name: 'non-object parameter (empty array)',
                content: 'options:\n  param: []',
                expectedProblems: [{ parameter: 'param', message: 'Parameter entry `param` must be an object.' }],
            },
            {
                name: 'non-object parameter (array)',
                content: 'options:\n  param:\n    - element',
                expectedProblems: [{ parameter: 'param', message: 'Parameter entry `param` must be an object.' }],
            },
        ];

        for (const t of tests) {
            const tt = t;
            test(tt.name, function () {
                const { parameters, problems } = parseCharmConfigYAML(tt.content);
                const allProblems = problems.concat(parameters.map(x => x.problems).flat());
                assert.includeDeepMembers(allProblems, tt.expectedProblems);
            });
        }
    });
});


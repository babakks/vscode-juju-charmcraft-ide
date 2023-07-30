import { assert } from "chai";
import { suite, test } from "mocha";
import { TextDecoder } from "util";
import { CharmActionProblem, CharmConfigParameterProblem } from "../model/charm";
import { parseCharmActionsYAML, parseCharmConfigYAML, toValidSymbol } from "../parser";
import path = require("path");
import { readFileSync } from "fs";

suite(toValidSymbol.name, function () {
    type TestCase = {
        name: string;
        arg: string;
        expected: string;
    };
    const tests: TestCase[] = [
        {
            name: 'empty',
            arg: '',
            expected: '',
        }, {
            name: 'small caps',
            arg: 'abc',
            expected: 'abc',
        }, {
            name: 'mixed cases',
            arg: 'AbC',
            expected: 'AbC',
        }, {
            name: 'with dash',
            arg: 'a-b',
            expected: 'a_b',
        }, {
            name: 'with leading dash',
            arg: '-a-b',
            expected: '_a_b',
        }, {
            name: 'with trailing dash',
            arg: 'a-b-',
            expected: 'a_b_',
        },
    ];
    for (const t of tests) {
        const tt = t;
        test(tt.name, function () {
            assert.equal(toValidSymbol(tt.arg), tt.expected);
        });
    }
});

suite(parseCharmActionsYAML.name, function () {
    const RESOURCE_ACTIONS_PATH = '../../resource/test/actions.yaml';
    function parseActions(resource: string): ReturnType<typeof parseCharmActionsYAML> {
        return parseCharmActionsYAML(new TextDecoder().decode(readFileSync(path.join(__dirname, RESOURCE_ACTIONS_PATH, resource))));
    }

    test('valid', function () {
        const { actions, problems } = parseActions('valid.actions.yaml');
        assert.isEmpty(problems, 'expected no file-scope problem');
        assert.lengthOf(actions, 3);
        assert.isFalse(actions.some(x => x.problems.length > 0), 'problem in some parameters');
    });

    test('invalid', function () {
        const { actions, problems } = parseActions('invalid.actions.yaml');
        assert.lengthOf(problems, 0, 'expected no file-scope problem');
        assert.lengthOf(actions, 7);

        const allProblems = actions.map(x => x.problems).flat();
        assert.includeDeepMembers(allProblems, [
            { action: 'action-array-empty', message: 'Action entry `action-array-empty` must be an object.' },
            { action: 'action-array', message: 'Action entry `action-array` must be an object.' },
            { action: 'action-string', message: 'Action entry `action-string` must be an object.' },
            { action: 'action-number', message: 'Action entry `action-number` must be an object.' },
            { action: 'action-invalid-description-array-empty', message: 'Description for action `action-invalid-description-array-empty` should be a string.' },
            { action: 'action-invalid-description-array', message: 'Description for action `action-invalid-description-array` should be a string.' },
            { action: 'action-invalid-description-number', message: 'Description for action `action-invalid-description-number` should be a string.' },
        ]);
    });

    suite('invalid yaml structure', function () {
        const tests: { name: string; content: string; expectedProblems: CharmActionProblem[] }[] = [
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
        ];

        for (const t of tests) {
            const tt = t;
            test(tt.name, function () {
                const { actions, problems } = parseCharmActionsYAML(tt.content);
                const allProblems = problems.concat(actions.map(x => x.problems).flat());
                assert.includeDeepMembers(allProblems, tt.expectedProblems);
            });
        }
    });
});


suite(parseCharmConfigYAML.name, function () {
    const RESOURCE_CONFIG_PATH = '../../resource/test/config.yaml';
    function parseConfig(resource: string): ReturnType<typeof parseCharmConfigYAML> {
        return parseCharmConfigYAML(new TextDecoder().decode(readFileSync(path.join(__dirname, RESOURCE_CONFIG_PATH, resource))));
    }

    test('valid', function () {
        const { parameters, problems } = parseConfig('valid.config.yaml');
        assert.isEmpty(problems, 'expected no file-scope problem');
        assert.lengthOf(parameters, 16);
        assert.isFalse(parameters.some(x => x.problems.length > 0), 'problem in some parameters');
    });

    test('type/default mismatch', function () {
        const { parameters, problems } = parseConfig('type-default-mismatch.config.yaml');
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

    test('invalid parameter', function () {
        const { parameters, problems } = parseConfig('invalid.config.yaml');
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


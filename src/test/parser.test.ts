import { assert } from "chai";
import { suite, test } from "mocha";
import { TextDecoder } from "util";
import { CharmActionProblem, CharmConfigParameterProblem, CharmMetadata } from "../model/charm";
import { parseCharmActionsYAML, parseCharmConfigYAML, parseCharmMetadataYAML } from "../parser";
import path = require("path");
import { readFileSync } from "fs";

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

suite(parseCharmMetadataYAML.name, function () {
    const RESOURCE_ACTIONS_PATH = '../../resource/test/metadata.yaml';
    function parseMetadata(resource: string): ReturnType<typeof parseCharmMetadataYAML> {
        return parseCharmMetadataYAML(new TextDecoder().decode(readFileSync(path.join(__dirname, RESOURCE_ACTIONS_PATH, resource))));
    }

    test('valid-complete', function () {
        const metadata = parseMetadata('valid-complete.metadata.yaml');
        assert.isEmpty(metadata.problems, 'expected no file-scope problem');
        /* eslint-disable */
        assert.deepStrictEqual(metadata, {
            problems: [],
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




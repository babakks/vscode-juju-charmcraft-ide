import { assert } from "chai";
import { suite, test } from "mocha";
import { TextDecoder } from "util";
import { Problem, CharmMetadata, CharmAction, CharmConfigParameter, emptyYAMLNode } from "../model/charm";
import { parseCharmActionsYAML, parseCharmConfigYAML, parseCharmMetadataYAML } from "../parser";
import path = require("path");
import { readFileSync } from "fs";

function cursor<T>(list: T[]) {
    let index = -1;
    return {
        next() { return list[++index]; },
        get current() { return list[index]; },
    };
}

suite(parseCharmActionsYAML.name, function () {
    const RESOURCE_ACTIONS_PATH = '../../resource/test/actions.yaml';
    function parseActions(resource: string): ReturnType<typeof parseCharmActionsYAML> {
        return parseCharmActionsYAML(new TextDecoder().decode(readFileSync(path.join(__dirname, RESOURCE_ACTIONS_PATH, resource))));
    }

    test('valid', function () {
        const { actions, problems } = parseActions('valid.actions.yaml');
        assert.isEmpty(problems, 'expected no file-scope problem');
        assert.lengthOf(actions, 3);
        assert.isEmpty(actions.map(x => [
            ...x.node.problems,
            ...x.description.node?.problems || [],
        ]).flat(), 'problem in some action(s)');
    });

    test('invalid', function () {
        const { actions, problems } = parseActions('invalid.actions.yaml');
        assert.lengthOf(problems, 0, 'expected no file-scope problem');
        assert.lengthOf(actions, 7);

        const c = cursor(actions);

        c.next();
        assert.strictEqual(c.current.name, 'action-array-empty');
        assert.deepEqual(c.current.node.problems, [{ id: 'expectedObject', message: 'Must be an object.' }]);

        c.next();
        assert.strictEqual(c.current.name, 'action-array');
        assert.deepEqual(c.current.node.problems, [{ id: 'expectedObject', message: 'Must be an object.' }]);

        c.next();
        assert.strictEqual(c.current.name, 'action-string');
        assert.deepEqual(c.current.node.problems, [{ id: 'expectedObject', message: 'Must be an object.' }]);

        c.next();
        assert.strictEqual(c.current.name, 'action-number');
        assert.deepEqual(c.current.node.problems, [{ id: 'expectedObject', message: 'Must be an object.' }]);

        c.next();
        assert.strictEqual(c.current.name, 'action-invalid-description-array-empty');
        assert.isEmpty(c.current.node.problems);
        assert.deepEqual(c.current.description.node?.problems, [{
            expected: 'string',
            id: 'unexpectedPrimitiveType',
            message: 'Must be a string.',
        }]);

        c.next();
        assert.strictEqual(c.current.name, 'action-invalid-description-array');
        assert.isEmpty(c.current.node.problems);
        assert.deepEqual(c.current.description.node?.problems, [{
            expected: 'string',
            id: 'unexpectedPrimitiveType',
            message: 'Must be a string.',
        }]);

        c.next();
        assert.strictEqual(c.current.name, 'action-invalid-description-number');
        assert.isEmpty(c.current.node.problems);
        assert.deepEqual(c.current.description.node?.problems, [{
            expected: 'string',
            id: 'unexpectedPrimitiveType',
            message: 'Must be a string.',
        }]);
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
                const { problems } = parseCharmActionsYAML(tt.content);
                assert.includeDeepMembers(problems, tt.expectedProblems);
            });
        }
    });
});


suite(parseCharmConfigYAML.name, function () {
    const RESOURCE_CONFIG_PATH = '../../resource/test/config.yaml';
    function parseConfig(resource: string): ReturnType<typeof parseCharmConfigYAML> {
        return parseCharmConfigYAML(new TextDecoder().decode(readFileSync(path.join(__dirname, RESOURCE_CONFIG_PATH, resource))));
    }

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
        const { parameters, problems } = parseConfig('valid.config.yaml');
        assert.isEmpty(problems, 'expected no file-scope problem');
        assert.lengthOf(parameters, 16);
        assert.isEmpty(parameters.map(x => allProblems(x)).flat(), 'problem in some parameter(s)');
    });

    test('type/default mismatch', function () {
        const { parameters, problems } = parseConfig('type-default-mismatch.config.yaml');
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
        const { parameters, problems } = parseConfig('invalid.config.yaml');
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
    const RESOURCE_ACTIONS_PATH = '../../resource/test/metadata.yaml';
    function parseMetadata(resource: string): { raw: string, metadata: ReturnType<typeof parseCharmMetadataYAML> } {
        const raw = new TextDecoder().decode(readFileSync(path.join(__dirname, RESOURCE_ACTIONS_PATH, resource)));
        return { raw, metadata: parseCharmMetadataYAML(raw) };
    }

    test('valid-complete', function () {
        const { raw, metadata } = parseMetadata('valid-complete.metadata.yaml');
        assert.isEmpty(metadata.problems, 'expected no file-scope problem');
        /* eslint-disable */
        assert.deepStrictEqual(metadata, {
            raw,
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




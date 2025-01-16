import { assert } from "chai";
import { suite, test } from "mocha";
import type { SequenceWithNode, WithNode } from "../model/yaml";
import { parseCharmMetadataYAML } from "../parser/metadata.yaml";
import { unindent } from "./util";

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
                message: 'Must be one of the following: `global`, `container`.',
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
                message: 'Must be one of the following: `global`, `container`.',
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
                message: 'Must be one of the following: `global`, `container`.',
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
                message: 'Must be one of the following: `file`, `oci-image`.',
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
                message: 'Must be one of the following: `file`, `oci-image`.',
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
                message: 'Must be one of the following: `file`, `oci-image`.',
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

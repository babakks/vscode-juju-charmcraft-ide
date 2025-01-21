import { TextPositionMapper } from '../model/common';
import {
    CharmAssumption,
    CharmContainer,
    CharmContainerBase,
    CharmContainerMount,
    CharmDevice,
    CharmEndpoint,
    CharmExtraBinding,
    CharmMetadata,
    CharmResource,
    CharmStorage,
    METADATA_YAML_PROBLEMS,
} from '../model/metadata.yaml';
import { GENERIC_YAML_PROBLEMS, type MapWithNode, type SequenceWithNode, type WithNode } from '../model/yaml';
import { assignAnyFromPair, assignArrayOfMapsFromPair, assignArrayOfScalarsFromPair, assignScalarFromPair, assignScalarOrArrayOfScalarsFromPair, assignStringEnumFromScalarPair, readMap, readMapOfMap, YAMLParser } from './common';

export function parseCharmMetadataYAML(text: string): CharmMetadata {
    const { tree, plain } = new YAMLParser(text).parse();
    if (!tree) {
        return {
            node: {
                kind: 'map',
                problems: [],
                text,
                range: new TextPositionMapper(text).all(),
            }
        };
    }

    const result: CharmMetadata = {
        node: tree.node,
    };

    if (tree.node.kind !== 'map') {
        result.node.problems.push(GENERIC_YAML_PROBLEMS.invalidYAML);
        return result;
    }

    result.name = assignScalarFromPair(tree, 'name', 'string', true, result.node.problems);
    result.displayName = assignScalarFromPair(tree, 'display-name', 'string', true, result.node.problems);
    result.description = assignScalarFromPair(tree, 'description', 'string', true, result.node.problems);
    result.summary = assignScalarFromPair(tree, 'summary', 'string', true, result.node.problems);

    result.source = assignScalarOrArrayOfScalarsFromPair(tree, 'source', 'string');
    result.issues = assignScalarOrArrayOfScalarsFromPair(tree, 'issues', 'string');
    result.website = assignScalarOrArrayOfScalarsFromPair(tree, 'website', 'string');

    result.maintainers = assignArrayOfScalarsFromPair(tree, 'maintainers', 'string');
    result.terms = assignArrayOfScalarsFromPair(tree, 'terms', 'string');

    result.docs = assignScalarFromPair(tree, 'docs', 'string');
    result.subordinate = assignScalarFromPair(tree, 'subordinate', 'boolean');

    result.assumes = _assumes(tree, 'assumes');

    result.requires = _endpoints(tree, 'requires');
    result.provides = _endpoints(tree, 'provides');
    result.peers = _endpoints(tree, 'peers');

    result.resources = _resources(tree, 'resources');
    result.devices = _devices(tree, 'devices');
    result.storage = _storage(tree, 'storage');
    result.extraBindings = _extraBindings(tree, 'extra-bindings');
    result.containers = _containers(tree, 'containers');

    result.customFields = Object.fromEntries(Object.entries(plain).filter(([x]) => ![
        'name',
        'display-name',
        'description',
        'summary',
        'source',
        'issues',
        'website',
        'maintainers',
        'terms',
        'docs',
        'subordinate',
        'assumes',
        'requires',
        'provides',
        'peers',
        'resources',
        'devices',
        'storage',
        'extra-bindings',
        'containers',
    ].includes(x)));

    if (result.containers?.entries) {
        for (const [, container] of Object.entries(result.containers.entries)) {
            if (!container.value) {
                continue;
            }

            // Checking container resources, if any, are already defined.
            if (container.value.resource?.value !== undefined) {
                const resource = container.value.resource?.value;
                if (resource !== undefined) {
                    if (!Object.values(result.resources?.entries ?? {}).find(v => v.value?.name === resource)) {
                        container.node.problems.push(METADATA_YAML_PROBLEMS.containerResourceUndefined(resource));
                    } else if (!Object.values(result.resources?.entries ?? {}).find(v => v.value?.name === resource && v.value?.type?.value === 'oci-image')) {
                        container.node.problems.push(METADATA_YAML_PROBLEMS.containerResourceOCIImageExpected(resource));
                    }
                }
            }
            // Checking container mount storages, if any, are already defined.
            if (container.value.mounts?.elements) {
                for (let i = 0; i < container.value.mounts.elements.length; i++) {
                    const mount = container.value.mounts.elements[i];
                    const storage = mount.value?.storage?.value;
                    if (storage !== undefined && !Object.values(result.storage?.entries ?? {}).find(v => v.value?.name === storage)) {
                        mount.node.problems.push(METADATA_YAML_PROBLEMS.containerMountStorageUndefined(storage));
                    }
                }
            }
        }
    }

    return result;

    function _endpoints(map: WithNode<any>, key: string): MapWithNode<CharmEndpoint> | undefined {
        return readMapOfMap<CharmEndpoint>(map, key, (map, key, entry) => {
            entry.value = {
                name: key,
                limit: assignScalarFromPair(map, 'limit', 'integer'),
                optional: assignScalarFromPair(map, 'optional', 'boolean'),
                scope: assignStringEnumFromScalarPair(map, 'scope', ['global', 'container']),
            };
            entry.value.interface = assignScalarFromPair(map, 'interface', 'string', true, entry.node.problems);
        });
    }

    function _resources<T>(map: WithNode<any>, key: string): MapWithNode<CharmResource> | undefined {
        return readMapOfMap<CharmResource>(map, key, (map, key, entry) => {
            entry.value = {
                name: key,
                description: assignScalarFromPair(map, 'description', 'string'),
                filename: assignScalarFromPair(map, 'filename', 'string'),
            };
            entry.value.type = assignStringEnumFromScalarPair(map, 'type', ['file', 'oci-image'], true, entry.node.problems);

            if (entry.value.type?.value) {
                const t = entry.value.type.value;
                if (t === 'file' && !entry.value.filename) {
                    entry.node.problems.push(METADATA_YAML_PROBLEMS.resourceExpectedFilenameForFileResource);
                } else if (t !== 'file' && entry.value.filename) {
                    entry.value.filename.node.problems.push(METADATA_YAML_PROBLEMS.resourceUnexpectedFilenameForNonFileResource);
                }
            }
        });
    }

    function _devices(map: WithNode<any>, key: string): MapWithNode<CharmDevice> | undefined {
        return readMapOfMap<CharmDevice>(map, key, (map, key, entry) => {
            entry.value = {
                name: key,
                description: assignScalarFromPair(map, 'description', 'string'),
                countMin: assignScalarFromPair(map, 'countmin', 'integer'),
                countMax: assignScalarFromPair(map, 'countmax', 'integer'),
            };
            entry.value.type = assignStringEnumFromScalarPair(map, 'type', ['gpu', 'nvidia.com/gpu', 'amd.com/gpu'], true, entry.node.problems);
        });
    }

    function _storage(map: WithNode<any>, key: string): MapWithNode<CharmStorage> | undefined {
        return readMapOfMap<CharmStorage>(map, key, (map, key, entry) => {
            entry.value = {
                name: key,
                description: assignScalarFromPair(map, 'description', 'string'),
                location: assignScalarFromPair(map, 'location', 'string'),
                shared: assignScalarFromPair(map, 'shared', 'boolean'),
                readOnly: assignScalarFromPair(map, 'read-only', 'boolean'),
            };
            entry.value.type = assignStringEnumFromScalarPair(map, 'type', ['filesystem', 'block'], true, entry.node.problems);

            entry.value.properties = assignArrayOfScalarsFromPair(map, 'properties', 'string');
            if (entry.value.properties?.elements) {
                const supported = ['transient'];
                for (const e of entry.value.properties.elements) {
                    if (e.value !== undefined && !supported.includes(e.value)) {
                        e.node.problems.push(GENERIC_YAML_PROBLEMS.expectedEnumValue(supported));
                        e.value = undefined;
                    }
                }
            }

            const multipleAsInt = assignScalarFromPair<number>(map, 'multiple', 'integer');
            if (multipleAsInt?.value !== undefined) {
                entry.value.multiple = {
                    node: multipleAsInt.node,
                    value: multipleAsInt.value.toString(),
                };
            } else {
                entry.value.multiple = assignScalarFromPair<string>(map, 'multiple', 'string');
                if (entry.value.multiple?.value !== undefined) {
                    if (!entry.value.multiple.value.match(/\d+(\+|-)?|\d+-\d+/)) {
                        entry.value.multiple.node.problems.push(METADATA_YAML_PROBLEMS.storageMultipleInvalid);
                        entry.value.multiple.value = undefined;
                    }
                }
            }

            const minimumSizeAsInt = assignScalarFromPair<number>(map, 'minimum-size', 'integer');
            if (minimumSizeAsInt?.value !== undefined) {
                entry.value.minimumSize = {
                    node: minimumSizeAsInt.node,
                    value: minimumSizeAsInt.value.toString(),
                };
            } else {
                entry.value.minimumSize = assignScalarFromPair<string>(map, 'minimum-size', 'string');
                if (entry.value.minimumSize?.value !== undefined) {
                    if (!entry.value.minimumSize.value.match(/\d+[MGTPEZY]?/)) {
                        entry.value.minimumSize.node.problems.push(METADATA_YAML_PROBLEMS.storageMinimumSizeInvalid);
                        entry.value.minimumSize.value = undefined;
                    }
                }
            }
        });
    }

    function _extraBindings(map: WithNode<any>, key: string): MapWithNode<CharmExtraBinding> | undefined {
        const initial = assignAnyFromPair(map, key);
        if (!initial || initial.value === undefined) {
            return undefined;
        }
        return readMap<CharmExtraBinding>(initial, (value, key, entry) => {
            entry.value = {
                name: key,
            };
            if (value.value !== null) {
                entry.node.problems.push(GENERIC_YAML_PROBLEMS.expectedNull);
            }
        });
    }

    function _containers(map: WithNode<any>, key: string): MapWithNode<CharmContainer> | undefined {
        return readMapOfMap<CharmContainer>(map, key, (map, key, entry) => {
            entry.value = {
                name: key,
                resource: assignScalarFromPair(map, 'resource', 'string'),
            };

            entry.value.bases = assignArrayOfMapsFromPair(map, 'bases');
            const bases = entry.value.bases;
            if (bases?.elements) {
                entry.value.bases = {
                    node: bases.node,
                    elements: bases.elements.map(e => ({
                        node: e.node,
                        value: e.value === undefined ? undefined : ((e: WithNode<any>) => {
                            const result: CharmContainerBase = {
                                architectures: assignArrayOfScalarsFromPair(e, 'architectures', 'string'),
                            };
                            result.name = assignScalarFromPair(e, 'name', 'string', true, e.node.problems);
                            result.channel = assignScalarFromPair(e, 'channel', 'string', true, e.node.problems);
                            return result;
                        })(e),
                    })),
                };
            }

            if (entry.value.resource === undefined && entry.value.bases === undefined) {
                entry.node.problems.push(METADATA_YAML_PROBLEMS.containerExpectedResourceOrBases);
            } else if (entry.value.resource !== undefined && entry.value.bases !== undefined) {
                entry.node.problems.push(METADATA_YAML_PROBLEMS.containerExpectedOnlyResourceOrBases);
            }

            entry.value.mounts = assignArrayOfMapsFromPair(map, 'mounts');
            const mounts = entry.value.mounts;
            if (mounts?.elements) {
                entry.value.mounts = {
                    node: mounts.node,
                    elements: mounts.elements.map(e => ({
                        node: e.node,
                        value: e.value === undefined ? undefined : ((e: WithNode<any>) => {
                            const result: CharmContainerMount = {
                                location: assignScalarFromPair(e, 'location', 'string'),
                            };
                            result.storage = assignScalarFromPair(e, 'storage', 'string', true, e.node.problems);
                            return result;
                        })(e),
                    })),
                };
            }
        });
    }

    function _assumes(map: WithNode<any>, key: string): SequenceWithNode<CharmAssumption> | undefined {
        const initial = assignAnyFromPair(map, key);
        if (!initial || initial.value === undefined) {
            return undefined;
        }
        const result: SequenceWithNode<CharmAssumption> = {
            node: initial.node,
        };

        if (!initial.value || initial.node.kind !== 'sequence') {
            result.node.problems.push(GENERIC_YAML_PROBLEMS.expectedSequence);
            return result;
        }

        result.elements = [];
        const sequence: WithNode<any>[] = initial.value;
        for (let i = 0; i < sequence.length; i++) {
            const element = sequence[i];
            const entry: WithNode<CharmAssumption> = {
                node: element.node,
            };
            result.elements.push(entry);

            if (element.value !== undefined && element.node.kind === 'scalar' && typeof element.value === 'string') {
                // TODO check for value format.
                entry.value = {
                    single: {
                        node: element.node,
                        value: element.value,
                    },
                };
            } else if (element.value !== undefined && element.node.kind === 'map') {
                const map = element;
                const keys = Object.keys(map.value);
                if (keys.length === 1 && keys[0] === 'all-of') {
                    // TODO check for value format.
                    entry.value = {
                        allOf: assignArrayOfScalarsFromPair<string>(map, 'all-of', 'string'),
                    };
                } else if (keys.length === 1 && keys[0] === 'any-of') {
                    // TODO check for value format.
                    entry.value = {
                        anyOf: assignArrayOfScalarsFromPair<string>(map, 'any-of', 'string'),
                    };
                } else {
                    entry.node.problems.push(METADATA_YAML_PROBLEMS.assumptionExpectedAnyOfOrAllOf);
                }
            } else {
                entry.node.problems.push(METADATA_YAML_PROBLEMS.assumptionExpected);
            }
        }
        return result;
    }
}

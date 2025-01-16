import {
    CharmAssumption,
    CharmCharmcraft,
    CharmContainer,
    CharmContainerBase,
    CharmContainerMount,
    CHARMCRAFT_YAML_PROBLEMS,
    CharmDevice,
    CharmEndpoint,
    CharmExtraBinding,
    CharmResource,
    CharmStorage,
    SUPPORTED_ARCHITECTURES,
    SUPPORTED_CHARM_BASE_VALUES,
    SUPPORTED_CHARM_BUILD_BASE_VALUES,
    SUPPORTED_CHARM_CONFIG_TYPES,
    SUPPORTED_CHARM_DEVICE_TYPES,
    SUPPORTED_CHARM_ENDPOINT_SCOPES,
    SUPPORTED_CHARM_RESOURCE_TYPES,
    SUPPORTED_CHARM_STORAGE_PROPERTIES,
    SUPPORTED_CHARM_STORAGE_TYPES,
    SUPPORTED_CHARM_TYPES,
    type CharmAction,
    type CharmActionParam,
    type CharmAnalysis,
    type CharmAnalysisIgnore,
    type CharmBases,
    type CharmBasesLongForm,
    type CharmBasesPlatform,
    type CharmBasesShortForm,
    type CharmCharmhub,
    type CharmCharmLib,
    type CharmConfig,
    type CharmConfigOption,
    type CharmLinks,
    type CharmPart,
    type CharmPlatform,
} from '../model/charmcraft.yaml';
import { TextPositionMapper, toValidSymbol } from '../model/common';
import { GENERIC_YAML_PROBLEMS, type MapWithNode, type SequenceWithNode, type WithNode } from '../model/yaml';
import { assignAnyFromPair, assignArrayOfEnumsFromPair, assignArrayOfScalarsFromPair, assignScalarFromPair, assignScalarOrArrayOfScalarsFromPair, assignStringEnumFromScalarPair, readMap, readMapOfMap, readPlainMap, readSequenceOfMap, YAMLParser } from './common';

export function parseCharmCharmcraftYAML(text: string): CharmCharmcraft {
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

    const result: CharmCharmcraft = {
        node: tree.node,
    };

    if (tree.node.kind !== 'map') {
        result.node.problems.push(GENERIC_YAML_PROBLEMS.invalidYAML);
        return result;
    }

    result.type = assignStringEnumFromScalarPair(tree, 'type', SUPPORTED_CHARM_TYPES, true, result.node.problems);

    result.name = assignScalarFromPair(tree, 'name', 'string');
    result.description = assignScalarFromPair(tree, 'description', 'string');
    result.summary = assignScalarFromPair(tree, 'summary', 'string');
    result.title = assignScalarFromPair(tree, 'title', 'string', true, result.node.problems);
    result.terms = assignArrayOfScalarsFromPair(tree, 'terms', 'string');
    result.links = _links(tree, 'links');
    result.charmhub = _charmhub(tree, 'charmhub');

    result.actions = _actions(tree, 'actions');
    result.config = _config(tree, 'config');

    result.bases = _bases(tree, 'bases');
    result.base = assignStringEnumFromScalarPair(tree, 'base', SUPPORTED_CHARM_BASE_VALUES);
    result.buildBase = assignStringEnumFromScalarPair(tree, 'build-base', SUPPORTED_CHARM_BUILD_BASE_VALUES);
    result.platforms = _platforms(tree, 'platforms');

    result.peers = _endpoints(tree, 'peers');
    result.provides = _endpoints(tree, 'provides');
    result.requires = _endpoints(tree, 'requires');

    result.analysis = _analysis(tree, 'analysis');
    result.assumes = _assumes(tree, 'assumes');
    result.charmLibs = _charmLibs(tree, 'charm-libs');
    result.containers = _containers(tree, 'containers');
    result.devices = _devices(tree, 'devices');
    result.extraBindings = _extraBindings(tree, 'extra-bindings');
    result.parts = _parts(tree, 'parts');
    result.resources = _resources(tree, 'resources');
    result.storage = _storage(tree, 'storage');
    result.subordinate = assignScalarFromPair(tree, 'subordinate', 'boolean');

    result.customFields = Object.fromEntries(Object.entries(plain).filter(([x]) => ![
        'actions',
        'analysis',
        'assumes',
        'bases',
        'base',
        'buildBase',
        'platforms',
        'charmLibs',
        'charmhub',
        'config',
        'containers',
        'description',
        'devices',
        'extraBindings',
        'links',
        'name',
        'parts',
        'peers',
        'provides',
        'requires',
        'resources',
        'storage',
        'subordinate',
        'summary',
        'terms',
        'title',
        'type',
    ].includes(x)));

    // Some validations cannot be done while parsing individual key/value pairs,
    // because they depend on the other pairs. So, we apply them after parsing
    // is done.

    if (result.type?.value !== undefined) {
        const type = result.type.value;
        if (type === 'charm') {
            if (!result.description) {
                result.node.problems.push(CHARMCRAFT_YAML_PROBLEMS.descriptionRequiredWhenTypeIsCharm);
            }
            if (!result.name) {
                result.node.problems.push(CHARMCRAFT_YAML_PROBLEMS.nameRequiredWhenTypeIsCharm);
            }
            if (!result.summary) {
                result.node.problems.push(CHARMCRAFT_YAML_PROBLEMS.summaryRequiredWhenTypeIsCharm);
            }
            if (!result.bases && (!result.base || !result.platforms)) {
                result.node.problems.push(CHARMCRAFT_YAML_PROBLEMS.basesOrBaseAndPlatformRequiredWhenTypeIsCharm);
            }
        } else if (type === 'bundle') {
            if (result.bases) {
                result.bases.node.problems.push(CHARMCRAFT_YAML_PROBLEMS.basesNotSupportedWhenTypeIsBundle);
            }
            if (result.base) {
                result.base.node.problems.push(CHARMCRAFT_YAML_PROBLEMS.baseNotSupportedWhenTypeIsBundle);
            }
            if (result.buildBase) {
                result.buildBase.node.problems.push(CHARMCRAFT_YAML_PROBLEMS.buildBaseNotSupportedWhenTypeIsBundle);
            }
            if (result.platforms) {
                result.platforms.node.problems.push(CHARMCRAFT_YAML_PROBLEMS.platformsNotSupportedWhenTypeIsBundle);
            }
        }
    }

    if (result.bases && result.base) {
        result.bases.node.problems.push(CHARMCRAFT_YAML_PROBLEMS.basesNotSupportedWhenBaseIsAssigned);
    }

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
                        container.node.problems.push(CHARMCRAFT_YAML_PROBLEMS.containerResourceUndefined(resource));
                    } else if (!Object.values(result.resources?.entries ?? {}).find(v => v.value?.name === resource && v.value?.type?.value === 'oci-image')) {
                        container.node.problems.push(CHARMCRAFT_YAML_PROBLEMS.containerResourceOCIImageExpected(resource));
                    }
                }
            }
            // Checking container mount storages, if any, are already defined.
            if (container.value.mounts?.elements) {
                for (let i = 0; i < container.value.mounts.elements.length; i++) {
                    const mount = container.value.mounts.elements[i];
                    const storage = mount.value?.storage?.value;
                    if (storage !== undefined && !Object.values(result.storage?.entries ?? {}).find(v => v.value?.name === storage)) {
                        mount.node.problems.push(CHARMCRAFT_YAML_PROBLEMS.containerMountStorageUndefined(storage));
                    }
                }
            }
        }
    }

    if (result.subordinate?.value) {
        // Subordinate charms are only valid if they have at least one requires
        // integration with container scope.
        let found = false;
        for(const endpoint of Object.values(result.requires?.entries ?? {})) {
            if (endpoint.value?.scope?.value === 'container') {
                found = true;
                break;
            }
        }
        if (!found) {
            result.subordinate.node.problems.push(CHARMCRAFT_YAML_PROBLEMS.subordinateRequiresContainerScopeIntegration);
        }
    }

    return result;

    function _charmhub(map: WithNode<any>, key: string): WithNode<CharmCharmhub> | undefined {
        return readPlainMap<CharmCharmhub>(map, key, (map, entry) => {
            entry.value = {
                apiURL: assignScalarFromPair(map, 'api-url', 'string'),
                storageURL: assignScalarFromPair(map, 'storage-url', 'string'),
                registryURL: assignScalarFromPair(map, 'registry-url', 'string'),
            };
        });
    }

    function _analysis(map: WithNode<any>, key: string): WithNode<CharmAnalysis> | undefined {
        return readPlainMap<CharmAnalysis>(map, key, (map, entry) => {
            entry.value = {
                ignore: readPlainMap<CharmAnalysisIgnore>(map, 'ignore', (map, entry) => {
                    entry.value = {
                        attributes: assignArrayOfScalarsFromPair(map, 'attributes', 'string'),
                        linters: assignArrayOfScalarsFromPair(map, 'linters', 'string'),
                    };
                }),
            };
        });
    }

    function _links(map: WithNode<any>, key: string): WithNode<CharmLinks> | undefined {
        return readPlainMap<CharmLinks>(map, key, (map, entry) => {
            entry.value = {
                contact: assignScalarFromPair(map, 'contact', 'string'),
                documentation: assignScalarFromPair(map, 'documentation', 'string'),
                issues: assignArrayOfScalarsFromPair(map, 'issues', 'string'),
                source: assignArrayOfScalarsFromPair(map, 'source', 'string'),
                website: assignArrayOfScalarsFromPair(map, 'website', 'string'),
            };
        });
    }

    function _charmLibs(map: WithNode<any>, key: string): SequenceWithNode<CharmCharmLib> | undefined {
        return readSequenceOfMap<CharmCharmLib>(map, key, (map, element) => {
            element.value = {
                lib: assignScalarFromPair(map, 'lib', 'string', true, element.node.problems),
                version: assignScalarFromPair(map, 'version', 'string', true, element.node.problems),
            };

            const libPattern = /^[^.]+\.[^.]+$/;
            if (element.value.lib?.value !== undefined && !element.value.lib.value.match(libPattern)) {
                element.value.lib.node.problems.push(CHARMCRAFT_YAML_PROBLEMS.charmLibInvalidName);
            }
            const versionPattern = /^\d+(\.\d+)?$/;
            if (element.value.version?.value !== undefined && !element.value.version.value.match(versionPattern)) {
                element.value.version.node.problems.push(CHARMCRAFT_YAML_PROBLEMS.charmLibInvalidVersion);
            }
        });
    }

    function _actions(map: WithNode<any>, key: string): MapWithNode<CharmAction> | undefined {
        return readMapOfMap<CharmAction>(map, key, (map, key, entry) => {
            entry.value = {
                name: key,
                symbol: toValidSymbol(key),
                description: assignScalarFromPair(map, 'description', 'string'),
                executionGroup: assignScalarFromPair(map, 'execution-group', 'string'),
                parallel: assignScalarFromPair(map, 'parallel', 'boolean'),
                params: readMapOfMap<CharmActionParam>(map, 'params', (map, key, entry) => {
                    entry.value = {
                        name: key,
                        type: assignScalarFromPair(map, 'type', 'string'),
                        description: assignScalarFromPair(map, 'description', 'string'),
                    };
                }),
            };
        });
    }

    function _config(map: WithNode<any>, key: string): WithNode<CharmConfig> | undefined {
        return readPlainMap<CharmConfig>(map, key, (map, entry) => {
            entry.value = {
                options: _configOptions(map, 'options'),
            };
        });

        function _configOptions(map: WithNode<any>, key: string): MapWithNode<CharmConfigOption> | undefined {
            return readMapOfMap<CharmConfigOption>(map, key, (map, key, entry) => {
                entry.value = {
                    name: key,
                    type: assignStringEnumFromScalarPair(map, 'type', SUPPORTED_CHARM_CONFIG_TYPES, true, entry.node.problems),
                    description: assignScalarFromPair(map, 'description', 'string'),
                };

                const defaultValue = assignAnyFromPair(map, 'default');
                if (defaultValue?.value !== undefined) {
                    entry.value.default = defaultValue;
                    if (entry.value.type?.value !== undefined) {
                        if (
                            entry.value.type.value === 'string' && typeof entry.value.default.value !== 'string'
                            || entry.value.type.value === 'secret' && typeof entry.value.default.value !== 'string'
                            || entry.value.type.value === 'boolean' && typeof entry.value.default.value !== 'boolean'
                            || entry.value.type.value === 'float' && typeof entry.value.default.value !== 'number'
                            || entry.value.type.value === 'int' && (typeof entry.value.default.value !== 'number' || !Number.isInteger(defaultValue.value))
                        ) {
                            entry.value.default.value = undefined; // Dropping invalid value.
                            entry.value.default.node.problems.push(CHARMCRAFT_YAML_PROBLEMS.configOptionWrongDefaultType(entry.value.type.value));
                        }
                    } else {
                        // Parameter has no `type`, so we should check if the default value is not essentially invalid.
                        if (
                            typeof entry.value.default.value !== 'string'
                            && typeof entry.value.default.value !== 'boolean'
                            && typeof entry.value.default.value !== 'number'
                        ) {
                            entry.value.default.value = undefined; // Dropping invalid value.
                            entry.value.default.node.problems.push(CHARMCRAFT_YAML_PROBLEMS.configOptionInvalidDefault);
                        }
                    }
                }
            });
        }
    }

    function _bases(map: WithNode<any>, key: string): SequenceWithNode<CharmBases> | undefined {
        return readSequenceOfMap<CharmBases>(map, key, (map, element) => {
            const keys = Object.keys(map.value);
            if (keys.includes('name') && keys.includes('channel')) {
                // Short-form
                const value: CharmBasesShortForm = {
                    name: assignScalarFromPair(map, 'name', 'string', true, element.node.problems),
                    channel: assignScalarFromPair(map, 'channel', 'string', true, element.node.problems),
                    architectures: assignArrayOfEnumsFromPair(map, 'architectures', SUPPORTED_ARCHITECTURES, true, element.node.problems),
                };
                element.value = value;
            } else {
                // Long-form
                const value: CharmBasesLongForm = {
                    buildOn: _basesPlatform(map, 'build-on'),
                    runOn: _basesPlatform(map, 'run-on'),
                };
                if (!value.buildOn) {
                    element.node.problems.push(CHARMCRAFT_YAML_PROBLEMS.basesMissingBuildOn);
                }
                element.value = value;
            }
        });

        function _basesPlatform(map: WithNode<any>, key: string): SequenceWithNode<CharmBasesPlatform> | undefined {
            return readSequenceOfMap<CharmBasesPlatform>(map, key, (map, element) => {
                element.value = {
                    name: assignScalarFromPair(map, 'name', 'string', true, element.node.problems),
                    channel: assignScalarFromPair(map, 'channel', 'string', true, element.node.problems),
                    architectures: assignArrayOfEnumsFromPair(map, 'architectures', SUPPORTED_ARCHITECTURES, true, element.node.problems)
                };
            });
        }
    }

    function _platforms(map: WithNode<any>, key: string): MapWithNode<CharmPlatform> | undefined {
        return readMapOfMap<CharmPlatform>(map, key, (map, key, entry) => {
            entry.value = {
                name: key,
                buildOn: assignScalarOrArrayOfScalarsFromPair(map, 'build-on', 'string'),
                buildFor: assignScalarOrArrayOfScalarsFromPair(map, 'build-for', 'string'),
            };

            const platformPattern = /^.+@.+:(?<arch>.+)$/;  // Matches 'ubuntu@24.04:amd64'
            const supportedArchitectures = [...SUPPORTED_ARCHITECTURES] as string[];

            const match = platformPattern.exec(entry.value.name);
            if (match) {
                // The architecture component must be one of supported architectures.
                const arch = match.groups?.['arch'];
                if (arch === undefined || !supportedArchitectures.includes(arch)) {
                    entry.node.problems.push(CHARMCRAFT_YAML_PROBLEMS.platformsInvalidArchitecture(arch ?? '', supportedArchitectures));
                }
            } else {
                // In this case both `build-on` and `build-for` are required.
                if (!entry.value.buildOn) {
                    entry.node.problems.push(CHARMCRAFT_YAML_PROBLEMS.platformsBuildOnRequiredWhenPlatformNameNotFormatted);
                }
                if (!entry.value.buildFor) {
                    entry.node.problems.push(CHARMCRAFT_YAML_PROBLEMS.platformsBuildForRequiredWhenPlatformNameNotFormatted);
                }
            }

            validateScalarOrSequence(entry.value.buildOn);
            validateScalarOrSequence(entry.value.buildFor);

            function validateScalarOrSequence(scalarOrSequence: WithNode<string> | SequenceWithNode<string> | undefined) {
                if (!scalarOrSequence) {
                    return;
                }
                if (scalarOrSequence.node.kind === 'scalar') {
                    const value = scalarOrSequence as WithNode<string>;
                    validate(value);
                } else if (scalarOrSequence.node.kind === 'sequence') {
                    const sequence = scalarOrSequence as SequenceWithNode<string>;
                    for (const value of sequence.elements ?? []) {
                        validate(value);
                    }
                }
            }

            function validate(entry: WithNode<string>) {
                if (entry.value === undefined) {
                    return;
                }
                const match = platformPattern.exec(entry.value);
                if (match) {
                    // The architecture component must be one of supported architectures.
                    const arch = match.groups?.['arch'];
                    if (arch === undefined || !supportedArchitectures.includes(arch)) {
                        entry.value = undefined;
                        entry.node.problems.push(CHARMCRAFT_YAML_PROBLEMS.platformsInvalidArchitecture(arch ?? '', supportedArchitectures));
                    }
                } else {
                    entry.value = undefined;
                    entry.node.problems.push(CHARMCRAFT_YAML_PROBLEMS.platformsInvalidFormat);
                }
            }
        });
    }

    function _parts(map: WithNode<any>, key: string): MapWithNode<CharmPart> | undefined {
        return readMapOfMap<CharmPart>(map, key, (map, key, entry) => {
            entry.value = {
                name: key,
                // Common part fields:
                plugin: assignScalarFromPair(map, 'plugin', 'string'),
                buildSnaps: assignArrayOfScalarsFromPair(map, 'build-snaps', 'string'),
                prime: assignArrayOfScalarsFromPair(map, 'prime', 'string'),
                source: assignScalarFromPair(map, 'source', 'string'),
                // `charm` plugin fields: 
                charmEntrypoint: assignScalarFromPair(map, 'charm-entrypoint', 'string'),
                charmRequirements: assignArrayOfScalarsFromPair(map, 'charm-requirements', 'string'),
                charmPythonPackages: assignArrayOfScalarsFromPair(map, 'charm-python-packages', 'string'),
                charmBinaryPythonPackages: assignArrayOfScalarsFromPair(map, 'charm-binary-python-packages', 'string'),
                charmStrictDependencies: assignScalarFromPair(map, 'charm-strict-dependencies', 'boolean'),
                // `bundle` plugin fields:
                reactiveCharmBuildArguments: assignArrayOfScalarsFromPair(map, 'reactive-charm-build-arguments', 'string'),
            };
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

        const conditionPattern = /^(k8s-api|juju (<|<=|>=|>) \d+(\.\d+){0,2})$/;

        result.elements = [];
        const sequence: WithNode<any>[] = initial.value;
        for (let i = 0; i < sequence.length; i++) {
            const element = sequence[i];
            const entry: WithNode<CharmAssumption> = {
                node: element.node,
            };
            result.elements.push(entry);

            if (element.value !== undefined && element.node.kind === 'scalar' && typeof element.value === 'string') {
                const singleValue: CharmAssumption['single'] = {
                    node: element.node,
                    value: element.value,
                };
                if (!element.value.match(conditionPattern)) {
                    singleValue.value = undefined;
                    singleValue.node.problems.push(CHARMCRAFT_YAML_PROBLEMS.assumptionInvalidFormat);
                }
                entry.value = {
                    single: singleValue,
                };
            } else if (element.value !== undefined && element.node.kind === 'map') {
                const map = element;
                const keys = Object.keys(map.value);
                if (keys.length === 1 && keys[0] === 'all-of') {
                    entry.value = {
                        allOf: _assumes(map, 'all-of'),
                    };
                } else if (keys.length === 1 && keys[0] === 'any-of') {
                    entry.value = {
                        anyOf: _assumes(map, 'any-of'),
                    };
                } else {
                    entry.node.problems.push(CHARMCRAFT_YAML_PROBLEMS.assumptionExpectedAnyOfOrAllOf);
                }
            } else {
                entry.node.problems.push(CHARMCRAFT_YAML_PROBLEMS.assumptionExpected);
            }
        }
        return result;
    }

    function _endpoints(map: WithNode<any>, key: string): MapWithNode<CharmEndpoint> | undefined {
        return readMapOfMap<CharmEndpoint>(map, key, (map, key, entry) => {
            entry.value = {
                name: key,
                interface: assignScalarFromPair(map, 'interface', 'string', true, entry.node.problems),
                limit: assignScalarFromPair(map, 'limit', 'integer'),
                optional: assignScalarFromPair(map, 'optional', 'boolean'),
                scope: assignStringEnumFromScalarPair(map, 'scope', SUPPORTED_CHARM_ENDPOINT_SCOPES),
            };

            if (entry.value.interface?.value !== undefined) {
                const value = entry.value.interface.value;

                // Interface values:
                //   - Cannot be `juju`.
                //   - Cannot begin with `juju-`.
                //   - Must only contain characters `a-z`.
                //   - Cannot start with `-`.
                const interfacePattern = /^[a-z][-a-z]*$/;
                if (!interfacePattern.exec(value) || value === 'juju' || value.startsWith('juju-')) {
                    entry.value.interface.node.problems.push(CHARMCRAFT_YAML_PROBLEMS. endpointInvalidInterface);
                }
            }
        });
    }

    function _resources<T>(map: WithNode<any>, key: string): MapWithNode<CharmResource> | undefined {
        return readMapOfMap<CharmResource>(map, key, (map, key, entry) => {
            entry.value = {
                name: key,
                type: assignStringEnumFromScalarPair(map, 'type', SUPPORTED_CHARM_RESOURCE_TYPES, true, entry.node.problems),
                description: assignScalarFromPair(map, 'description', 'string'),
                filename: assignScalarFromPair(map, 'filename', 'string'),
            };

            if (entry.value.type?.value) {
                const t = entry.value.type.value;
                if (t === 'file' && !entry.value.filename) {
                    entry.node.problems.push(CHARMCRAFT_YAML_PROBLEMS.resourceExpectedFilenameForFileResource);
                } else if (t !== 'file' && entry.value.filename) {
                    entry.value.filename.node.problems.push(CHARMCRAFT_YAML_PROBLEMS.resourceUnexpectedFilenameForNonFileResource);
                }
            }
        });
    }

    function _devices(map: WithNode<any>, key: string): MapWithNode<CharmDevice> | undefined {
        return readMapOfMap<CharmDevice>(map, key, (map, key, entry) => {
            entry.value = {
                name: key,
                type: assignStringEnumFromScalarPair(map, 'type', SUPPORTED_CHARM_DEVICE_TYPES, true, entry.node.problems),
                description: assignScalarFromPair(map, 'description', 'string'),
                countMin: assignScalarFromPair(map, 'countmin', 'integer'),
                countMax: assignScalarFromPair(map, 'countmax', 'integer'),
            };
        });
    }

    function _storage(map: WithNode<any>, key: string): MapWithNode<CharmStorage> | undefined {
        return readMapOfMap<CharmStorage>(map, key, (map, key, entry) => {
            entry.value = {
                name: key,
                type: assignStringEnumFromScalarPair(map, 'type', SUPPORTED_CHARM_STORAGE_TYPES, true, entry.node.problems),
                description: assignScalarFromPair(map, 'description', 'string'),
                location: assignScalarFromPair(map, 'location', 'string'),
                shared: assignScalarFromPair(map, 'shared', 'boolean'),
                readOnly: assignScalarFromPair(map, 'read-only', 'boolean'),
                properties: assignArrayOfEnumsFromPair(map, 'properties', SUPPORTED_CHARM_STORAGE_PROPERTIES),
                minimumSize: assignAnyFromPair(map, 'minimum-size'),
                multiple: readPlainMap(map, 'multiple', (map, entry) => {
                    entry.value = {
                        range: assignAnyFromPair(map, 'range'),
                    };
                }),
            };

            const range = entry.value.multiple?.value?.range;
            if (range && range.value !== undefined) {
                const rangePattern = /^(\d+(\+|-)?|\d+-\d+)$/; // Matches <n>-<m> | <n>- | <n>+
                if (
                    typeof range.value === 'number' && !Number.isInteger(range.value)
                    || typeof range.value === 'string' && !range.value.match(rangePattern)
                ) {
                    range.value = undefined;
                    range.node.problems.push(CHARMCRAFT_YAML_PROBLEMS.storageMultipleInvalid);
                }
            }

            const minimumSize = entry.value.minimumSize;
            if (minimumSize && minimumSize.value !== undefined) {
                const minimumSizePattern = /^(\d+[MGTPEZY]?)$/; // Matches <n><multiplier>
                if (
                    typeof minimumSize.value === 'number' && !Number.isInteger(minimumSize.value)
                    || typeof minimumSize.value === 'string' && !minimumSize.value.match(minimumSizePattern)
                ) {
                    minimumSize.value = undefined;
                    minimumSize.node.problems.push(CHARMCRAFT_YAML_PROBLEMS.storageMinimumSizeInvalid);
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
                uid: assignScalarFromPair(map, 'uid', 'integer'),
                gid: assignScalarFromPair(map, 'gid', 'integer'),
                bases: readSequenceOfMap<CharmContainerBase>(map, 'bases', (map, element) => {
                    element.value = {};
                    element.value.name = assignScalarFromPair(map, 'name', 'string', true, element.node.problems);
                    element.value.channel = assignScalarFromPair(map, 'channel', 'string', true, element.node.problems);
                    element.value.architectures = assignArrayOfEnumsFromPair(map, 'architectures', SUPPORTED_ARCHITECTURES, true, element.node.problems);
                }),
                mounts: readSequenceOfMap<CharmContainerMount>(map, 'mounts', (map, element) => {
                    element.value = {
                        location: assignScalarFromPair(map, 'location', 'string'),
                    };
                    element.value.storage = assignScalarFromPair(map, 'storage', 'string', true, element.node.problems);
                }),
            };

            if (entry.value.resource === undefined && entry.value.bases === undefined) {
                entry.node.problems.push(CHARMCRAFT_YAML_PROBLEMS.containerExpectedResourceOrBases);
            } else if (entry.value.resource !== undefined && entry.value.bases !== undefined) {
                entry.node.problems.push(CHARMCRAFT_YAML_PROBLEMS.containerExpectedOnlyResourceOrBases);
            }

            if (entry.value.uid?.value !== undefined && !isInValidRange(entry.value.uid.value)) {
                entry.value.uid.node.problems.push(CHARMCRAFT_YAML_PROBLEMS.containerUIDOutOfRange);
            }
            if (entry.value.gid?.value !== undefined && !isInValidRange(entry.value.gid.value)) {
                entry.value.gid.node.problems.push(CHARMCRAFT_YAML_PROBLEMS.containerGIDOutOfRange);
            }

            function isInValidRange(n: number): boolean {
                return n >= 0 && n <= 999 || n >= 10000;
            }
        });
    }
}

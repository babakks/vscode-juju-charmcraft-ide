import { emptyYAMLNode, type MapWithNode, type Problem, type SequenceWithNode, type WithNode, type YAMLNode } from "./yaml";

/**
 * Problems specific to `charmcraft.yaml`.
 */
export const CHARMCRAFT_YAML_PROBLEMS = {
    assumptionExpectedAnyOfOrAllOf: { id: 'assumptionExpectedAnyOfOrAllOf', message: `Must include only one of \`any-of\` or \`all-of\` keys.` },
    assumptionExpected: { id: 'assumptionExpected', message: 'Expected a string entry or a map with only \`any-of\` or \`all-of\` keys.' },
    resourceExpectedFilenameForFileResource: { id: 'resourceExpectedFilenameForFileResource', message: `Field \`filename\` is required since resource type is \`file\`.` },
    resourceUnexpectedFilenameForNonFileResource: { id: 'resourceUnexpectedFilenameForNonFileResource', message: `Field \`filename\` must be assigned only if resource type is \`file\`.` },
    storageMultipleInvalid: { id: 'storageMultipleInvalid', message: `Should be one of \`n\`, \`n+\`, \`n-\`, or \`n-m\`, where \`n\` and \`m\` are integers.` },
    storageMinimumSizeInvalid: { id: 'storageMinimumSizeInvalid', message: `Should be either of \`n\` or \`nM\`, where \`n\` is an integer and M is a one of M, G, T, P, E, Z or Y.` },
    containerExpectedResourceOrBases: { id: 'containerExpectedResourceOrBases', message: `One of \`resource\` or \`bases\` fields must be assigned.` },
    containerExpectedOnlyResourceOrBases: { id: 'containerExpectedOnlyResourceOrBases', message: `Only one of \`resource\` or \`bases\` fields must be assigned.` },
    containerResourceUndefined: (expectedResource: string) => ({ id: 'containerResourceUndefined', expectedResource, message: `Container resource \`${expectedResource}\` is not defined.` }),
    containerResourceOCIImageExpected: (expectedResource: string) => ({ id: 'containerResourceOCIImageExpected', expectedResource, message: `Container resource \`${expectedResource}\` is not of type \`oci-image\`.` }),
    containerMountStorageUndefined: (expectedStorage: string) => ({ id: 'containerMountStorageUndefined', expectedStorage, message: `Container mount storage \`${expectedStorage}\` is not defined.` }),
} satisfies Record<string, Problem | ((...args: any[]) => Problem)>;

export interface CharmAction {
    name: string;
    symbol: string;
    description?: WithNode<string>;
    executionGroup?: WithNode<string>;
    parallel?: WithNode<boolean>;
}

export interface CharmAnalysisIgnore {
    attributes?: SequenceWithNode<string>;
    linters?: SequenceWithNode<string>;
}

export interface CharmAnalysis {
    ignore?: WithNode<CharmAnalysisIgnore>;
}

export interface CharmAssumption {
    single?: WithNode<string>;
    allOf?: SequenceWithNode<CharmAssumption>;
    anyOf?: SequenceWithNode<CharmAssumption>;
}

export const SUPPORTED_ARCHITECTURES = [
    'amd64',
    'arm64',
    'armhf',
    'ppc64el',
    'riscv64',
    's390x',
] as const;

export type CharmBasesPlatformArchitecture = typeof SUPPORTED_ARCHITECTURES[number];

export interface CharmBasesPlatform {
    name?: WithNode<string>;
    channel?: WithNode<string>;
    architectures?: SequenceWithNode<CharmBasesPlatformArchitecture>;
};

export interface CharmBases {
    buildOn?: SequenceWithNode<CharmBasesPlatform>;
    runOn?: SequenceWithNode<CharmBasesPlatform>;
};

/**
 * Supported values for the `base` key.
 */
export const SUPPORTED_CHARM_BASE_VALUES = ['ubuntu@24.04'] as const;

export type CharmBase = typeof SUPPORTED_CHARM_BASE_VALUES[number];

/**
 * Supported values for the `build-base` key.
 */
export const SUPPORTED_CHARM_BUILD_BASE_VALUES = ['devel', 'ubuntu@24.04'] as const;

export type CharmBuildBase = typeof SUPPORTED_CHARM_BUILD_BASE_VALUES[number];

export type CharmPlatformArchitecture = typeof SUPPORTED_ARCHITECTURES[number];

export interface CharmPlatform {
    name: string;
    buildOn?: WithNode<CharmPlatformArchitecture> | SequenceWithNode<CharmPlatformArchitecture>;
    buildFor?: WithNode<CharmPlatformArchitecture> | SequenceWithNode<CharmPlatformArchitecture>;
};

export interface CharmCharmLib {
    lib?: WithNode<string>;
    version?: WithNode<string>;
};

export interface CharmCharmhub {
    apiURL: WithNode<string>;
    storageURL: WithNode<string>;
    registryURL: WithNode<string>;
};

export const SUPPORTED_CHARM_CONFIG_TYPES = ['string', 'int', 'float', 'boolean', 'secret'] as const;

export type CharmConfigOptionType = typeof SUPPORTED_CHARM_CONFIG_TYPES[number];

export function isCharmConfigOptionType(value: string): value is CharmConfigOptionType {
    return value in SUPPORTED_CHARM_CONFIG_TYPES;
}

export interface CharmConfigOption {
    name: string;
    type?: WithNode<CharmConfigOptionType>;
    description?: WithNode<string>;
    default?: WithNode<string | number | boolean>;
}

export interface CharmConfig {
    options?: MapWithNode<CharmConfigOption>;
}

export interface CharmContainerBase {
    name?: WithNode<string>;
    channel?: WithNode<string>;
    architectures?: SequenceWithNode<string>;
}

export interface CharmContainerMount {
    storage?: WithNode<string>;
    location?: WithNode<string>;
}

export interface CharmContainer {
    name: string;
    resource?: WithNode<string>;
    bases?: SequenceWithNode<CharmContainerBase>;
    mounts?: SequenceWithNode<CharmContainerMount>;
    uid?: WithNode<number>;
    gid?: WithNode<number>;
}

export const SUPPORTED_CHARM_DEVICE_TYPES = ['gpu', 'nvidia.com/gpu', 'amd.com/gpu'] as const;

export type CharmDeviceType = typeof SUPPORTED_CHARM_DEVICE_TYPES[number];

export interface CharmDevice {
    name: string;
    type?: WithNode<CharmDeviceType>;
    description?: WithNode<string>;
    countMin?: WithNode<number>;
    countMax?: WithNode<number>;
}

export interface CharmExtraBinding {
    name: string;
}

export interface CharmLinks {
    contact?: WithNode<string>;
    documentation?: WithNode<string>;
    issues?: SequenceWithNode<string>;
    source?: SequenceWithNode<string>;
    website?: SequenceWithNode<string>;
};

export interface CharmPartBase {
    name: string;

    // When we were interested in the properties a part (e.g., `build-packages`
    // or `build-snaps`), we can add them here.
}

export interface CharmPartUnknownPlugin extends CharmPartBase {
    name: string;
    plugin?: WithNode<string>;
}

export interface CharmPartNilPlugin extends CharmPartBase {
    name: string;
    plugin: WithNode<'nil'>;
}

export interface CharmPartCharmPlugin extends CharmPartBase {
    name: string;
    plugin: WithNode<'charm'>;
    charmEntrypoint?: WithNode<string>;
    charmRequirements?: SequenceWithNode<string>;
    charmPythonPackages?: SequenceWithNode<string>;
    charmBinaryPythonPackages?: SequenceWithNode<string>;
    prime?: SequenceWithNode<string>;
}

export interface CharmPartBundlePlugin extends CharmPartBase {
    name: string;
    plugin: WithNode<'bundle'>;
    prime?: SequenceWithNode<string>;
}

export interface CharmPartReactivePlugin extends CharmPartBase {
    name: string;
    plugin: WithNode<'reactive'>;
    reactiveCharmBuildArguments?: SequenceWithNode<string>;
};

export const SUPPORTED_CHARM_ENDPOINT_SCOPES = ['global', 'container'] as const;

export type CharmEndpointScope = typeof SUPPORTED_CHARM_ENDPOINT_SCOPES[number];

export interface CharmEndpoint {
    name: string;
    interface?: WithNode<string>;
    limit?: WithNode<number>;
    optional?: WithNode<boolean>;
    scope?: WithNode<CharmEndpointScope>;
}

export const SUPPORTED_CHARM_RESOURCE_TYPES = ['file', 'oci-image'] as const;

export type CharmResourceType = typeof SUPPORTED_CHARM_RESOURCE_TYPES[number];

export interface CharmResource {
    name: string;
    type?: WithNode<CharmResourceType>;
    description?: WithNode<string>;
    filename?: WithNode<string>;
}

export const SUPPORTED_CHARM_STORAGE_TYPES = ['filesystem', 'block'] as const;

export type CharmStorageType = typeof SUPPORTED_CHARM_STORAGE_TYPES[number];

export interface CharmStorageMultiple {
    range?: WithNode<string>
}

export const SUPPORTED_CHARM_STORAGE_PROPERTIES = ['transient'] as const;

export type CharmStorageProperty = typeof SUPPORTED_CHARM_STORAGE_PROPERTIES[number];

export interface CharmStorage {
    name: string;
    type?: WithNode<CharmStorageType>;
    description?: WithNode<string>;
    location?: WithNode<string>;
    shared?: WithNode<boolean>;
    readOnly?: WithNode<boolean>;
    multiple?: WithNode<CharmStorageMultiple>;
    minimumSize?: WithNode<string>;
    properties?: SequenceWithNode<CharmStorageProperty>;
}

export const SUPPORTED_CHARM_TYPES = ['charm', 'bundle'] as const;

export type CharmType = typeof SUPPORTED_CHARM_TYPES[number];

export interface CharmCharmcraft {
    actions?: MapWithNode<CharmAction>;
    analysis?: WithNode<CharmAnalysis>;
    assumes?: SequenceWithNode<CharmAssumption>;
    bases?: SequenceWithNode<CharmBases>;
    base?: WithNode<CharmBase>;
    buildBase?: WithNode<CharmBuildBase>;
    platforms?: MapWithNode<CharmPlatform>;
    charmLibs?: SequenceWithNode<CharmCharmLib>;
    charmhub?: WithNode<CharmCharmhub>;
    config?: WithNode<CharmConfig>;
    containers?: MapWithNode<CharmContainer>;
    description?: WithNode<string>;
    devices?: MapWithNode<CharmDevice>;
    extraBindings?: MapWithNode<CharmExtraBinding>;
    links?: WithNode<CharmLinks>;
    name?: WithNode<string>;
    parts?: MapWithNode<CharmPartBase>;
    peers?: MapWithNode<CharmEndpoint>;
    provides?: MapWithNode<CharmEndpoint>;
    requires?: MapWithNode<CharmEndpoint>;
    resources?: MapWithNode<CharmResource>;
    storage?: MapWithNode<CharmStorage>;
    subordinate?: WithNode<boolean>;
    summary?: WithNode<string>;
    terms?: SequenceWithNode<string>;
    title?: WithNode<string>;
    type?: WithNode<CharmType>;

    customFields?: { [key: string]: any };
    /**
     * Root node.
     */
    node: YAMLNode;
}

export function emptyCharmcraft(): CharmCharmcraft {
    return {
        node: emptyYAMLNode(),
    };
}

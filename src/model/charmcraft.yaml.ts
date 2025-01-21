import { type Problem } from "./common";
import { emptyYAMLNode, type MapWithNode, type SequenceWithNode, type WithNode, type YAMLNode } from "./yaml";

/**
 * Problems specific to `charmcraft.yaml`.
 */
export const CHARMCRAFT_YAML_PROBLEMS = {
    assumptionExpectedAnyOfOrAllOf: { id: 'assumptionExpectedAnyOfOrAllOf', message: `Must include only one of \`any-of\` or \`all-of\` keys.` },
    assumptionExpected: { id: 'assumptionExpected', message: 'Expected a string entry or a map with only \`any-of\` or \`all-of\` keys.' },
    assumptionInvalidFormat: { id: 'assumptionInvalidFormat', message: `Condition should be \`k8s-api\` or in a comparison format like \`juju [<|<=|>=|>] #.#.#\`.` },
    basesMissingBuildOn: { id: 'basesMissingBuildOn', message: `Field \`build-on\` is required.` },
    basesNotSupportedWhenTypeIsBundle: { id: 'basesNotSupportedWhenTypeIsBundle', message: `Field \`bases\` must not be assigned when \`type\` is \`bundle\`.` },
    basesOrBaseAndPlatformRequiredWhenTypeIsCharm: { id: 'basesOrBaseAndPlatformRequiredWhenTypeIsCharm', message: `Either \`bases\` or \`base\` (and \`platforms\`) fields must be assigned when \`type\` is \`charm\`.` },
    basesNotSupportedWhenBaseIsAssigned: { id: 'basesNotSupportedWhenBaseIsAssigned', message: `Field \`bases\` must not be assigned when \`base\` is assigned.` },
    baseNotSupportedWhenTypeIsBundle: { id: 'baseNotSupportedWhenTypeIsBundle', message: `Field \`base\` must not be assigned when \`type\` is \`bundle\`.` },
    buildBaseNotSupportedWhenTypeIsBundle: { id: 'buildBaseNotSupportedWhenTypeIsBundle', message: `Field \`build-base\` must not be assigned when \`type\` is \`bundle\`.` },
    platformsNotSupportedWhenTypeIsBundle: { id: 'platformsNotSupportedWhenTypeIsBundle', message: `Field \`platforms\` must not be assigned when \`type\` is \`bundle\`.` },
    platformsInvalidArchitecture: (value: string, expected: readonly string[]) => ({ id: 'platformsInvalidArchitecture', message: `Unknown architecture \`${value}\`; it must be one of ${expected.map(x => `\`${x}\``).join(', ')}.` }),
    platformsBuildOnRequiredWhenPlatformNameIsNotArch: (expected: readonly string[]) => ({ id: 'platformsBuildOnRequiredWhenPlatformNameIsNotArch', message: `Field \`build-on\` is required when platform name is not one of supported architectures: ${expected.map(x => `\`${x}\``).join(', ')}.` }),
    platformsBuildForRequiredWhenPlatformNameIsNotArch: (expected: readonly string[]) => ({ id: 'platformsBuildForRequiredWhenPlatformNameIsNotArch', message: `Field \`build-for\` is required when platform name is not one of supported architectures: ${expected.map(x => `\`${x}\``).join(', ')}.` }),
    platformsBothOrNoneOfBuildOnAndBuildForExpected: {id: 'platformsBothOrNoneOfBuildOnAndBuildForExpected', message: `Either both or none of \`build-for\` and \`build-on\` should be assigned.`},
    platformsInvalidFormat: { id: 'platformsInvalidFormat', message: `Platform should be formatted like \`ubuntu@24.04:amd64\`.` },
    endpointInvalidInterface: { id: 'endpointInvalidInterface', message: `Invalid interface name; should only contain \`a-z\`, cannot start with \`-\` or \`juju-\`, and cannot be \`juju\`.` },
    subordinateRequiresContainerScopeIntegration: { id: 'subordinateRequiresContainerScopeIntegration', message: `Subordinate charms are only valid if they have at least one \`requires\` integration with \`container\` scope.` },
    configOptionInvalidDefault: { id: 'configOptionInvalidDefault', message: `Default value must have a valid type; boolean, string, integer, or float.` },
    configOptionWrongDefaultType: (expected: CharmConfigOptionDefaultType) => ({ id: 'configOptionWrongDefaultType', message: `Default value must match the parameter type; it must be ${expected === 'int' ? 'an integer' : 'a ' + expected}.` }),
    charmLibInvalidName: { id: 'charmLibInvalidName', message: `Charm library name should be in \`<charm>.<library>\` format.` },
    charmLibInvalidVersion: { id: 'charmLibInvalidVersion', message: `Charm library version should be in \`<api version>[.<patch version>]\` format.` },
    resourceExpectedFilenameForFileResource: { id: 'resourceExpectedFilenameForFileResource', message: `Field \`filename\` is required since resource type is \`file\`.` },
    resourceUnexpectedFilenameForNonFileResource: { id: 'resourceUnexpectedFilenameForNonFileResource', message: `Field \`filename\` must be assigned only if resource type is \`file\`.` },
    storageMultipleInvalid: { id: 'storageMultipleInvalid', message: `Should be one of \`n\`, \`n+\`, \`n-\`, or \`n-m\`, where \`n\` and \`m\` are integers.` },
    storageMinimumSizeInvalid: { id: 'storageMinimumSizeInvalid', message: `Should be either of \`n\` or \`nM\`, where \`n\` is an integer and M is a one of M, G, T, P, E, Z or Y.` },
    containerExpectedResourceOrBases: { id: 'containerExpectedResourceOrBases', message: `One of \`resource\` or \`bases\` fields must be assigned.` },
    containerExpectedOnlyResourceOrBases: { id: 'containerExpectedOnlyResourceOrBases', message: `Only one of \`resource\` or \`bases\` fields must be assigned.` },
    containerResourceUndefined: (expectedResource: string) => ({ id: 'containerResourceUndefined', expectedResource, message: `Container resource \`${expectedResource}\` is not defined.` }),
    containerResourceOCIImageExpected: (expectedResource: string) => ({ id: 'containerResourceOCIImageExpected', expectedResource, message: `Container resource \`${expectedResource}\` is not of type \`oci-image\`.` }),
    containerMountStorageUndefined: (expectedStorage: string) => ({ id: 'containerMountStorageUndefined', expectedStorage, message: `Container mount storage \`${expectedStorage}\` is not defined.` }),
    containerUIDOutOfRange: { id: 'containerUIDOutOfRange', message: `\`uid\` value must be in range [0, 999] or >= 10000.` },
    containerGIDOutOfRange: { id: 'containerGIDOutOfRange', message: `\`gid\` value must be in range [0, 999] or >= 10000.` },
    descriptionRequiredWhenTypeIsCharm: { id: 'descriptionRequiredWhenTypeIsCharm', message: `Field \`description\` is required when \`type\` is \`charm\`.` },
    nameRequiredWhenTypeIsCharm: { id: 'nameRequiredWhenTypeIsCharm', message: `Field \`name\` is required when \`type\` is \`charm\`.` },
    summaryRequiredWhenTypeIsCharm: { id: 'summaryRequiredWhenTypeIsCharm', message: `Field \`summary\` is required when \`type\` is \`charm\`.` },
} satisfies Record<string, Problem | ((...args: any[]) => Problem)>;

export interface CharmActionParam {
    name: string;

    // The following are common JSON schema properties. We can add more when we
    // need them.
    type?: WithNode<string>;
    description?: WithNode<string>;
}

export interface CharmAction {
    name: string;
    symbol: string;
    description?: WithNode<string>;
    executionGroup?: WithNode<string>;
    parallel?: WithNode<boolean>;
    params?: MapWithNode<CharmActionParam>;
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

export interface CharmBasesLongForm {
    kind: 'long';
    buildOn?: SequenceWithNode<CharmBasesPlatform>;
    runOn?: SequenceWithNode<CharmBasesPlatform>;
};

export interface CharmBasesShortForm extends CharmBasesPlatform {
    kind: 'short';
}

export type CharmBases = CharmBasesLongForm | CharmBasesShortForm;

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

export interface CharmPlatform {
    name: string;
    buildOn?: WithNode<string> | SequenceWithNode<string>;
    buildFor?: WithNode<string> | SequenceWithNode<string>;
};

export interface CharmCharmLib {
    lib?: WithNode<string>;
    version?: WithNode<string>;
};

export interface CharmCharmhub {
    apiURL?: WithNode<string>;
    storageURL?: WithNode<string>;
    registryURL?: WithNode<string>;
};

export const SUPPORTED_CHARM_CONFIG_TYPES = ['string', 'int', 'float', 'boolean', 'secret'] as const;

export type CharmConfigOptionType = typeof SUPPORTED_CHARM_CONFIG_TYPES[number];

export const SUPPORTED_CHARM_CONFIG_DEFAULT_TYPES = ['string', 'int', 'float', 'boolean'] as const;

export type CharmConfigOptionDefaultType = typeof SUPPORTED_CHARM_CONFIG_DEFAULT_TYPES[number];

export interface CharmConfigOption {
    name: string;
    type?: WithNode<CharmConfigOptionType>;
    description?: WithNode<string>;
    default?: WithNode<string | number | boolean>;
}

export interface CharmConfig {
    options?: MapWithNode<CharmConfigOption>;
}

export type CharmContainerBasesPlatformArchitecture = typeof SUPPORTED_ARCHITECTURES[number];

export interface CharmContainerBase {
    name?: WithNode<string>;
    channel?: WithNode<string>;
    architectures?: SequenceWithNode<CharmContainerBasesPlatformArchitecture>;
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

export interface CharmPart {
    name: string;
    // When we were interested in the properties a part (e.g., `build-packages`
    // or `build-snaps`), we can add them here.
    plugin?: WithNode<string>;
    buildSnaps?: SequenceWithNode<string>;
    prime?: SequenceWithNode<string>;
    source?: WithNode<string>;
    // `charm` plugin fields:
    charmEntrypoint?: WithNode<string>;
    charmRequirements?: SequenceWithNode<string>;
    charmPythonPackages?: SequenceWithNode<string>;
    charmBinaryPythonPackages?: SequenceWithNode<string>;
    charmStrictDependencies?: WithNode<boolean>;
    // `bundle` plugin fields:
    // `reactive` plugin fields:
    reactiveCharmBuildArguments?: SequenceWithNode<string>;
}

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
    range?: WithNode<number | string>
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
    minimumSize?: WithNode<number | string>;
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
    parts?: MapWithNode<CharmPart>;
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

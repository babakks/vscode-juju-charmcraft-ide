import { emptyYAMLNode, type MapWithNode, type Problem, type SequenceWithNode, type WithNode, type YAMLNode } from "./yaml";

/**
 * Problems specific to `metadata.yaml`.
 */
export const METADATA_YAML_PROBLEMS = {
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

export type CharmEndpointScope = 'global' | 'container';

export interface CharmEndpoint {
    name: string;
    interface?: WithNode<string>;
    limit?: WithNode<number>;
    optional?: WithNode<boolean>;
    scope?: WithNode<CharmEndpointScope>;
}

export type CharmResourceType = 'file' | 'oci-image';

export interface CharmResource {
    name: string;
    type?: WithNode<CharmResourceType>;
    description?: WithNode<string>;
    filename?: WithNode<string>;
}

export type CharmDeviceType = 'gpu' | 'nvidia.com/gpu' | 'amd.com/gpu';

export interface CharmDevice {
    name: string;
    type?: WithNode<CharmDeviceType>;
    description?: WithNode<string>;
    countMin?: WithNode<number>;
    countMax?: WithNode<number>;
}

export type CharmStorageType = 'filesystem' | 'block';

export type CharmStorageProperty = 'transient';

export interface CharmStorage {
    name: string;
    type?: WithNode<CharmStorageType>;
    description?: WithNode<string>;
    location?: WithNode<string>;
    shared?: WithNode<boolean>;
    readOnly?: WithNode<boolean>;
    multiple?: WithNode<string>;
    minimumSize?: WithNode<string>;
    properties?: SequenceWithNode<CharmStorageProperty>;
}

export interface CharmExtraBinding {
    name: string;
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
}

export interface CharmAssumption {
    single?: WithNode<string>;
    allOf?: SequenceWithNode<string>;
    anyOf?: SequenceWithNode<string>;
}

export interface CharmMetadata {
    name?: WithNode<string>;
    displayName?: WithNode<string>;
    description?: WithNode<string>;
    summary?: WithNode<string>;
    source?: WithNode<string> | SequenceWithNode<string>;
    issues?: WithNode<string> | SequenceWithNode<string>;
    website?: WithNode<string> | SequenceWithNode<string>;
    maintainers?: SequenceWithNode<string>;
    terms?: SequenceWithNode<string>;
    docs?: WithNode<string>;
    subordinate?: WithNode<boolean>;
    requires?: MapWithNode<CharmEndpoint>;
    provides?: MapWithNode<CharmEndpoint>;
    peers?: MapWithNode<CharmEndpoint>;
    resources?: MapWithNode<CharmResource>;
    devices?: MapWithNode<CharmDevice>;
    storage?: MapWithNode<CharmStorage>;
    extraBindings?: MapWithNode<CharmExtraBinding>;
    containers?: MapWithNode<CharmContainer>;
    assumes?: SequenceWithNode<CharmAssumption>;
    customFields?: { [key: string]: any };
    /**
     * Root node.
     */
    node: YAMLNode;
}

export function emptyMetadata(): CharmMetadata {
    return {
        node: emptyYAMLNode(),
    };
}

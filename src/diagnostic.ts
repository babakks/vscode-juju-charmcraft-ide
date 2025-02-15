import * as vscode from "vscode";
import * as actionsYAML from "./model/actions.yaml";
import type { Charm } from "./model/charm";
import * as charmcraftYAML from "./model/charmcraft.yaml";
import { CHARM_FILE_ACTIONS_YAML, CHARM_FILE_CHARMCRAFT_YAML, CHARM_FILE_CONFIG_YAML, CHARM_FILE_METADATA_YAML, Range, TextPositionMapper, isInRange, zeroRange, type Problem } from "./model/common";
import * as configYAML from "./model/config.yaml";
import * as metadataYAML from "./model/metadata.yaml";
import { SOURCE_CODE_PROBLEMS, type SourceCodeFile } from "./model/source";
import { isSequenceWithNode, isWithNode, type MapWithNode, type SequenceWithNode, type WithNode } from "./model/yaml";
import { rangeToVSCodeRange } from "./util";

export class ProblemBasedDiagnostic extends vscode.Diagnostic {
    constructor(readonly problem: Problem, range: vscode.Range, message: string, severity?: vscode.DiagnosticSeverity) {
        super(range, message, severity);
    }

    static fromProblem(problem: Problem, range?: Range): ProblemBasedDiagnostic {
        const result = new this(problem, rangeToVSCodeRange(range ?? zeroRange()), problem.message);
        result.code = problem.id;
        return result;
    }
}

function getConfigYAMLDiagnostics(config: configYAML.CharmConfig): vscode.Diagnostic[] {
    return [
        ...config.node.problems.map(p => ProblemBasedDiagnostic.fromProblem(p, config.node.range)),
        ...Object.values(config.parameters?.entries ?? {}).map(config => [
            ...config.node.problems.map(p => ProblemBasedDiagnostic.fromProblem(p, config.node.pairKeyRange)),
            ...config.value?.type?.node.problems.map(p => ProblemBasedDiagnostic.fromProblem(p, config.value!.type!.node.range)) ?? [],
            ...config.value?.description?.node.problems.map(p => ProblemBasedDiagnostic.fromProblem(p, config.value!.description!.node.range)) ?? [],
            ...config.value?.default?.node.problems.map(p => ProblemBasedDiagnostic.fromProblem(p, config.value!.default!.node.range)) ?? [],
        ]).flat(1),
    ];
}

function getActionsYAMLDiagnostics(actions: actionsYAML.CharmActions): vscode.Diagnostic[] {
    return [
        ...actions.node.problems.map(p => ProblemBasedDiagnostic.fromProblem(p, actions.node.range)),
        ...Object.values(actions.actions?.entries ?? {}).map(action => [
            ...action.node.problems.map(p => ProblemBasedDiagnostic.fromProblem(p, action.node.pairKeyRange)),
            ...action.value?.description?.node.problems.map(p => ProblemBasedDiagnostic.fromProblem(p, action.value!.description!.node.range)) ?? [],
        ]).flat(1),
    ];
}

function getMetadataYAMLDiagnostics(metadata: metadataYAML.CharmMetadata): vscode.Diagnostic[] {
    return [
        ...metadata.node.problems.map(x => ProblemBasedDiagnostic.fromProblem(x, metadata.node.range)),
        ...fs(metadata.assumes, x => [
            ...f(x.single),
            ...fs(x.allOf),
            ...fs(x.anyOf),
        ]),
        ...fm(metadata.containers, x => [
            ...fs(x.bases, x => [
                ...fs(x.architectures),
                ...f(x.channel),
                ...f(x.name),
            ]),
            ...fs(x.mounts, x => [
                ...f(x.location),
                ...f(x.storage),
            ]),
            ...f(x.resource),
        ]),
        ...f(metadata.description),
        ...fm(metadata.devices, x => [
            ...f(x.countMin),
            ...f(x.countMax),
            ...f(x.description),
            ...f(x.type),
        ]),
        ...f(metadata.displayName),
        ...f(metadata.docs),
        ...fm(metadata.extraBindings),
        ...(metadata.issues ? (metadata.issues.node.kind === 'sequence' ? fs(metadata.issues as SequenceWithNode<string>) : f(metadata.issues as WithNode<string>)) : []),
        ...fs(metadata.maintainers),
        ...f(metadata.name),
        ...fm(metadata.peers, x => [
            ...f(x.interface),
            ...f(x.limit),
            ...f(x.optional),
            ...f(x.scope),
        ]),
        ...fm(metadata.provides, x => [
            ...f(x.interface),
            ...f(x.limit),
            ...f(x.optional),
            ...f(x.scope),
        ]),
        ...fm(metadata.requires, x => [
            ...f(x.interface),
            ...f(x.limit),
            ...f(x.optional),
            ...f(x.scope),
        ]),
        ...fm(metadata.resources, x => [
            ...f(x.description),
            ...f(x.filename),
            ...f(x.type),
        ]),
        ...(metadata.source ? (metadata.source.node.kind === 'sequence' ? fs(metadata.source as SequenceWithNode<string>) : f(metadata.source as WithNode<string>)) : []),
        ...fm(metadata.storage, x => [
            ...f(x.description),
            ...f(x.location),
            ...f(x.minimumSize),
            ...f(x.multiple),
            ...fs(x.properties),
            ...f(x.readOnly),
            ...f(x.type),
        ]),
        ...f(metadata.subordinate),
        ...f(metadata.summary),
        ...fs(metadata.terms),
        ...(metadata.website ? (metadata.website.node.kind === 'sequence' ? fs(metadata.website as SequenceWithNode<string>) : f(metadata.website as WithNode<string>)) : []),
    ];
}

function getCharmcraftYAMLDiagnostics(charmcraft: charmcraftYAML.CharmCharmcraft): vscode.Diagnostic[] {
    return [
        ...charmcraft.node.problems.map(x => ProblemBasedDiagnostic.fromProblem(x, charmcraft.node.range)),
        ...fm(charmcraft.actions, x => [
            ...f(x.description),
            ...f(x.executionGroup),
            ...f(x.parallel),
            ...fm(x.params, x => [
                ...f(x.description),
                ...f(x.type),
            ]),
        ]),
        ...f(charmcraft.analysis),
        ...f(charmcraft.analysis?.value?.ignore),
        ...f(charmcraft.analysis?.value?.ignore?.value?.attributes),
        ...f(charmcraft.analysis?.value?.ignore?.value?.linters),
        ...fs(charmcraft.assumes, x => {
            function recurse(x: charmcraftYAML.CharmAssumption): vscode.Diagnostic[] {
                return [
                    ...fs(x.allOf, x => recurse(x)),
                    ...fs(x.anyOf, x => recurse(x)),
                    ...f(x.single),
                ];
            }
            return recurse(x);
        }),
        ...fs(charmcraft.bases, x => [
            ...(x.kind === 'short' ? [
                ...f(x.channel),
                ...f(x.name),
                ...fs(x.architectures),
            ] : []),
            ...(x.kind === 'long' ? [
                ...fs(x.buildOn, x => [
                    ...f(x.channel),
                    ...f(x.name),
                    ...fs(x.architectures),
                ]),
                ...fs(x.runOn, x => [
                    ...f(x.channel),
                    ...f(x.name),
                    ...fs(x.architectures),
                ])
            ] : []),
        ]),
        ...f(charmcraft.base),
        ...f(charmcraft.buildBase),
        ...fm(charmcraft.platforms, x => [
            ...(isWithNode(x.buildFor) ? f(x.buildFor) : []),
            ...(isSequenceWithNode(x.buildFor) ? fs(x.buildFor) : []),
            ...(isWithNode(x.buildOn) ? f(x.buildOn) : []),
            ...(isSequenceWithNode(x.buildOn) ? fs(x.buildOn) : []),
        ]),
        ...fs(charmcraft.charmLibs, x => [
            ...f(x.lib),
            ...f(x.version),
        ]),
        ...f(charmcraft.charmhub),
        ...f(charmcraft.charmhub?.value?.apiURL),
        ...f(charmcraft.charmhub?.value?.registryURL),
        ...f(charmcraft.charmhub?.value?.storageURL),
        ...f(charmcraft.config),
        ...fm(charmcraft.config?.value?.options, x => [
            ...f(x.default),
            ...f(x.description),
            ...f(x.type),
        ]),
        ...fm(charmcraft.containers, x => [
            ...f(x.gid),
            ...f(x.uid),
            ...fs(x.bases, x => [
                ...fs(x.architectures),
                ...f(x.channel),
                ...f(x.name),
            ]),
            ...fs(x.mounts, x => [
                ...f(x.location),
                ...f(x.storage),
            ]),
            ...f(x.resource),
        ]),
        ...f(charmcraft.description),
        ...fm(charmcraft.devices, x => [
            ...f(x.countMin),
            ...f(x.countMax),
            ...f(x.description),
            ...f(x.type),
        ]),
        ...fm(charmcraft.extraBindings),
        ...f(charmcraft.links),
        ...f(charmcraft.links?.value?.contact),
        ...f(charmcraft.links?.value?.documentation),
        ...fs(charmcraft.links?.value?.issues),
        ...fs(charmcraft.links?.value?.source),
        ...fs(charmcraft.links?.value?.website),
        ...f(charmcraft.name),
        ...fm(charmcraft.parts, x => [
            ...f(x.plugin),
            ...fs(x.buildSnaps),
            ...fs(x.prime),
            ...f(x.source),
            // `charm` plugin fields:
            ...f(x.charmEntrypoint),
            ...fs(x.charmRequirements),
            ...fs(x.charmPythonPackages),
            ...fs(x.charmBinaryPythonPackages),
            ...f(x.charmStrictDependencies),
            // `bundle` plugin fields:
            // `reactive` plugin fields:
            ...fs(x.reactiveCharmBuildArguments),
        ]),
        ...fm(charmcraft.peers, x => [
            ...f(x.interface),
            ...f(x.limit),
            ...f(x.optional),
            ...f(x.scope),
        ]),
        ...fm(charmcraft.provides, x => [
            ...f(x.interface),
            ...f(x.limit),
            ...f(x.optional),
            ...f(x.scope),
        ]),
        ...fm(charmcraft.requires, x => [
            ...f(x.interface),
            ...f(x.limit),
            ...f(x.optional),
            ...f(x.scope),
        ]),
        ...fm(charmcraft.resources, x => [
            ...f(x.description),
            ...f(x.filename),
            ...f(x.type),
        ]),
        ...fm(charmcraft.storage, x => [
            ...f(x.description),
            ...f(x.location),
            ...f(x.shared),
            ...f(x.minimumSize),
            ...f(x.multiple),
            ...fs(x.properties),
            ...f(x.readOnly),
            ...f(x.type),
        ]),
        ...f(charmcraft.subordinate),
        ...f(charmcraft.summary),
        ...fs(charmcraft.terms),
        ...f(charmcraft.title),
        ...f(charmcraft.type),
    ];
}


function fs<T>(e: SequenceWithNode<T> | undefined, cb?: ((e: T) => vscode.Diagnostic[])) {
    return !e ? [] : [
        ...f(e),
        ...(e.elements ?? []).map(x => [
            ...f(x),
            ...(x.value !== undefined && cb ? cb(x.value) : [])
        ]).flat(1),
    ];
}

function fm<T>(e: MapWithNode<T> | undefined, cb?: ((m: T) => vscode.Diagnostic[])) {
    return !e ? [] : [
        ...f(e),
        ...Object.values(e.entries ?? {}).map(x => [
            ...f(x),
            ...(x.value !== undefined && cb ? cb(x.value) : [])
        ]).flat(1),
    ];
}

function f(e: WithNode<any> | MapWithNode<any> | SequenceWithNode<any> | undefined): vscode.Diagnostic[] {
    return !e ? [] : [
        ...e.node.problems.map(p => ProblemBasedDiagnostic.fromProblem(p, e.node.range)),
    ];
}

export function getAllNonSourceCodeDiagnostics(charm: Charm): Map<string, vscode.Diagnostic[]> {
    const result = new Map<string, vscode.Diagnostic[]>();
    result.set(CHARM_FILE_CHARMCRAFT_YAML, charm.charmcraftYAML ? getCharmcraftYAMLDiagnostics(charm.charmcraftYAML) : []);
    result.set(CHARM_FILE_METADATA_YAML, charm.metadataYAML ? getMetadataYAMLDiagnostics(charm.metadataYAML) : []);
    result.set(CHARM_FILE_ACTIONS_YAML, charm.actionsYAML ? getActionsYAMLDiagnostics(charm.actionsYAML) : []);
    result.set(CHARM_FILE_CONFIG_YAML, charm.configYAML ? getConfigYAMLDiagnostics(charm.configYAML) : []);

    // Adding cross-file diagnostics.
    if (charm.charmcraftYAML?.config && charm.configYAML) {
        push(CHARM_FILE_CONFIG_YAML, ProblemBasedDiagnostic.fromProblem({
            message: `Charm configuration options should be defined in \`${CHARM_FILE_CHARMCRAFT_YAML}\`.`,
        }, charm.configYAML.node.range));
    }
    if (charm.charmcraftYAML?.actions && charm.actionsYAML) {
        push(CHARM_FILE_ACTIONS_YAML, ProblemBasedDiagnostic.fromProblem({
            message: `Charm actions should be defined in \`${CHARM_FILE_CHARMCRAFT_YAML}\`.`,
        }, charm.actionsYAML.node.range));
    }

    return result;

    function push(key: string, value: vscode.Diagnostic) {
        if (!result.get(key)) {
            result.set(key, []);
        }
        result.get(key)!.push(value);
    }
}

export function getAllSourceCodeDiagnostics(charm: Charm): Map<string, vscode.Diagnostic[]> {
    return new Map<string, vscode.Diagnostic[]>(Array.from(charm.sourceCode.getFiles().entries()).map(
        ([relativePath,]) => [relativePath, getSourceCodeDiagnostics(charm, relativePath)]
    ));
}

const REGEX_SELF_CONFIG_BRACKET = /self\s*(?:\.\s*model\s*)?\.\s*config\s*\[\s*(['"])(?<name>.*?)\1(?:\s*\])?/g;
const REGEX_SELF_CONFIG_GET_SET = /self\s*(?:\.\s*model\s*)?\.\s*config\s*\.\s*(?:get|set)\s*\(\s*(['"])(?<name>.*?)\1(?:\s*(?:\)|,))?/g;
const REGEX_SELF_ON = /self\s*\.\s*on\s*\.\s*(?<symbol>\w*)/g;

export function getSourceCodeDiagnostics(charm: Charm, sourceCodeFileRelativePath: string): vscode.Diagnostic[] {
    if (!charm.sourceCode.isMain(sourceCodeFileRelativePath)) {
        return [];
    }

    const file = charm.sourceCode.getFile(sourceCodeFileRelativePath);
    return file ? [
        ...getConfigReferenceDiagnostics(charm, file),
    ] : [];
}

function getConfigReferenceDiagnostics(charm: Charm, file: SourceCodeFile): vscode.Diagnostic[] {
    return [
        ...getConfigReferenceDiagnosticsByPattern(charm, file, REGEX_SELF_CONFIG_BRACKET),
        ...getConfigReferenceDiagnosticsByPattern(charm, file, REGEX_SELF_CONFIG_GET_SET),
        ...getEventReferenceDiagnostics(charm, file),
    ];
}

function getConfigReferenceDiagnosticsByPattern(charm: Charm, file: SourceCodeFile, pattern: RegExp): vscode.Diagnostic[] {
    const result: vscode.Diagnostic[] = [];
    const matches = file.content.matchAll(pattern);
    for (const m of matches) {
        if (m.index === undefined) {
            continue;
        }

        const name = m.groups?.['name'];
        if (name === undefined) {
            continue;
        }

        /**
         * If main charm class data is available, it should be checked that the
         * matched expression is within the main class, and `self` is accessible
         * in the block.
         */
        if (isInMainCharmClassAndSelfAccessible(file, m.index) === false) {
            continue;
        }

        if (!charm.getConfigOptionByName(name)) {
            result.push(ProblemBasedDiagnostic.fromProblem(
                SOURCE_CODE_PROBLEMS.reference.undefinedConfigParameter(name),
                offsetLengthToRange(m.index, m[0].length, file.tpm),
            ));
        }
    }
    return result;
}

function getEventReferenceDiagnostics(charm: Charm, file: SourceCodeFile): vscode.Diagnostic[] {
    const result: vscode.Diagnostic[] = [];
    const matches = file.content.matchAll(REGEX_SELF_ON);
    for (const m of matches) {
        if (m.index === undefined) {
            continue;
        }

        const symbol = m.groups?.['symbol'];
        if (symbol === undefined) {
            continue;
        }

        /**
         * If main charm class data is available, it should be checked that the
         * matched expression is within the main class, and `self` is accessible
         * in the block.
         */
        if (isInMainCharmClassAndSelfAccessible(file, m.index) === false) {
            continue;
        }

        if (!charm.getEventBySymbol(symbol)) {
            result.push(ProblemBasedDiagnostic.fromProblem(
                SOURCE_CODE_PROBLEMS.reference.undefinedEvent(symbol),
                offsetLengthToRange(m.index, m[0].length, file.tpm),
            ));
        }
    }
    return result;
}

function offsetLengthToRange(index: number, length: number, tpm: TextPositionMapper): Range {
    return {
        start: tpm.indexToPosition(index),
        end: tpm.indexToPosition(length + index),
    };
}

function isInMainCharmClassAndSelfAccessible(file: SourceCodeFile, index: number): boolean | undefined {
    if (!file.analyzer.mainCharmClass) {
        return undefined;
    }
    const position = file.tpm.indexToPosition(index);
    if (!isInRange(position, file.analyzer.mainCharmClass.extendedRange)) {
        return false;
    }
    const currentMethod = file.analyzer.mainCharmClass.methods.find(x => isInRange(position, x.extendedRange));
    if (!currentMethod || currentMethod.isStatic) {
        return false;
    }
    return true;
}

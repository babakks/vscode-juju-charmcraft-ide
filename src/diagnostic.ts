import * as vscode from "vscode";
import {
    Charm,
    CharmMetadata,
    SOURCE_CODE_PROBLEMS,
    SourceCodeFile,
} from "./model/charm";
import { Range, TextPositionMapper, isInRange, zeroRange } from "./model/common";
import { rangeToVSCodeRange } from "./util";
import type { MapWithNode, Problem, SequenceWithNode, WithNode } from "./model/yaml";
import type { CharmConfigYAML } from "./model/config.yaml";
import type { CharmActions } from "./model/actions.yaml";

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

export function getConfigDiagnostics(config: CharmConfigYAML): vscode.Diagnostic[] {
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

export function getActionsDiagnostics(actions: CharmActions): vscode.Diagnostic[] {
    return [
        ...actions.node.problems.map(p => ProblemBasedDiagnostic.fromProblem(p, actions.node.range)),
        ...Object.values(actions.actions?.entries ?? {}).map(action => [
            ...action.node.problems.map(p => ProblemBasedDiagnostic.fromProblem(p, action.node.pairKeyRange)),
            ...action.value?.description?.node.problems.map(p => ProblemBasedDiagnostic.fromProblem(p, action.value!.description!.node.range)) ?? [],
        ]).flat(1),
    ];
}

export function getMetadataDiagnostics(metadata: CharmMetadata): vscode.Diagnostic[] {
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

        if (!(name in (charm.config.parameters?.entries ?? {}))) {
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

        if (!charm.events.find(x => x.symbol === symbol)) {
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

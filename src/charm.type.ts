import { CharmSourceCodeFileAnalyzer } from "./charm.src";

export type CharmConfigParameterType = 'string' | 'int' | 'float' | 'boolean';
export function isConfigParameterType(value: string): value is CharmConfigParameterType {
    return value === 'string' || value === 'int' || value === 'float' || value === 'boolean';
}

export interface CharmConfigParameter {
    name: string;
    type?: CharmConfigParameterType;
    description?: string;
    default?: string | number | boolean;
    problems: CharmConfigParameterProblem[];
}

export interface CharmConfigParameterProblem {
    message: string;
    parameter?: string;
}

export interface CharmConfig {
    parameters: CharmConfigParameter[];
    problems: CharmConfigParameterProblem[];
}

export interface CharmEvent {
    name: string;
    symbol: string;
    preferredHandlerSymbol: string;
    description?: string;
}

export interface CharmAction {
    name: string;
    symbol: string;
    description?: string;
    problems: CharmActionProblem[];
}

export interface CharmActionProblem {
    message: string;
    action?: string;
}

export interface CharmActions {
    actions: CharmAction[];
    problems: CharmActionProblem[];
}

export interface CharmSourceCodeFile {
    content: string;
    ast: any | undefined;
    analyzer: CharmSourceCodeFileAnalyzer
    /**
     * Whether AST data is successfully derived from the content. Value of `false` means the AST is not in sync with
     * the content (and could be stale/old).
     */
    healthy: boolean;
}

export class DefaultCharmSourceCodeFile implements CharmSourceCodeFile {
    private _analyzer: CharmSourceCodeFileAnalyzer | undefined;
    constructor(public content: string, public ast: any, public healthy: boolean) { }
    get analyzer() {
        if (!this._analyzer) {
            this._analyzer = new CharmSourceCodeFileAnalyzer(this.content, this.ast);
        }
        return this._analyzer;
    }
}

export interface CharmSourceCodeTree {
    [key: string]: CharmSourceCodeTreeDirectoryEntry | CharmSourceCodeTreeFileEntry;
}

export interface CharmSourceCodeTreeDirectoryEntry {
    kind: 'directory';
    data: CharmSourceCodeTree;
}

export interface CharmSourceCodeTreeFileEntry {
    kind: 'file';
    data: CharmSourceCodeFile;
}

export interface Position {
    /**
     * Zero-base line number.
     */
    line: number;

    /**
     * Zero-base character offset.
     */
    character: number;
}

/**
 * Represents a range with exclusive end; [start,end).
 */
export interface Range {
    /**
     * Start position (inclusive).
     */
    start: Position;

    /**
     * End position (exclusive).
     */
    end: Position;
}

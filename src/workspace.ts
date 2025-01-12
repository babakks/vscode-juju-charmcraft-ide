import TelemetryReporter from '@vscode/extension-telemetry';
import { TextDecoder } from 'util';
import * as vscode from 'vscode';
import { Uri } from 'vscode';
import { WorkspaceRunLintOnSaveConfig } from './config';
import {
    getActionsDiagnostics,
    getAllSourceCodeDiagnostics,
    getConfigDiagnostics,
    getMetadataDiagnostics,
    getSourceCodeDiagnostics
} from './diagnostic';
import { DiagnosticCollectionManager } from './diagnostic.collection';
import { LinterMessage, parseGenericLinterOutput, parseToxLinterOutput } from './lint.parser';
import {
    Charm,
    CharmToxConfig,
    CharmToxConfigSection,
    SourceCode,
    SourceCodeFile,
    SourceCodeTree,
    emptyToxConfig
} from './model/charm';
import {
    CHARM_DIR_LIB,
    CHARM_DIR_SRC,
    CHARM_DIR_TESTS,
    CHARM_DIR_VENV,
    CHARM_FILE_ACTIONS_YAML,
    CHARM_FILE_CONFIG_YAML,
    CHARM_FILE_METADATA_YAML,
    CHARM_FILE_TOX_INI,
    CHARM_TOX_LINT_SECTION
} from './model/common';
import {
    getPythonAST,
    parseCharmActionsYAML,
    parseCharmConfigYAML,
    parseCharmMetadataYAML,
    parseToxINI
} from './parser';
import { rangeToVSCodeRange, tryReadWorkspaceFileAsText } from './util';
import { VirtualEnv } from './venv';
import { BackgroundWorkerManager } from './worker';
import { NonStackableEvent } from './event';
import { emptyConfig, type CharmConfig } from './model/config.yaml';
import { emptyActions, type CharmActions } from './model/actions.yaml';
import { emptyMetadata, type CharmMetadata } from './model/metadata.yaml';

export interface WorkspaceCharmConfig {
    virtualEnvDirectory?: string;
    runLintOnSave?: WorkspaceRunLintOnSaveConfig;
}

export class WorkspaceCharm implements vscode.Disposable {
    private static readonly _telemetryEventLintOnSave = 'v0.workspace.lintOnSave';
    private static readonly _telemetryEventLintOnSaveDuration = 'duration';
    private static readonly _telemetryEventLintOnSaveDiagnosticsLength = 'diagnosticsLength';

    private _disposables: vscode.Disposable[] = [];
    private readonly watcher: vscode.FileSystemWatcher;

    private readonly _diagnostics: DiagnosticCollectionManager;
    private readonly _lintDiagnostics: DiagnosticCollectionManager;

    private readonly _onLintOnSave: NonStackableEvent;

    /**
     * URI of the charm's `src` directory. This property is always assigned with
     * the standard path, even if the directory does not exist.
     */
    readonly srcUri: Uri;

    /**
     * URI of the charm's `tests` directory. This property is always assigned with
     * the standard path, even if the directory does not exist.
     */
    readonly testsUri: Uri;

    /**
     * URI of the charm's `lib` directory. This property is always assigned with
     * the standard path, even if the directory does not exist.
     */
    readonly libUri: Uri;

    /**
     * Array of source codes (e.g., charm source code or tests) that are tracked
     * by this instance.
     */
    readonly sourceCodeUris: readonly Uri[];

    /**
     * Persisted model of the charm.
     */
    readonly model: Charm;

    /**
     * *Live* instance of the charm model (i.e., content is in sync with the
     * latest un-persisted changes).
     */
    readonly live: Charm;

    private _hasConfig: boolean = false;
    private readonly _onConfigChanged = new vscode.EventEmitter<void>();
    /**
     * URI of the charm's `config.yaml` file. This property is always
     * assigned with the standard path, so consult with {@link hasConfig} to
     * check if the file exists.
     */
    readonly configUri: Uri;
    /**
     * Fires when the **persisted** configuration file (i.e., `config.yaml`)
     * changes, or is created/deleted).
     */
    readonly onConfigChanged = this._onConfigChanged.event;

    private _hasActions: boolean = false;
    private readonly _onActionsChanged = new vscode.EventEmitter<void>();
    /**
     * URI of the charm's `actions.yaml` file. This property is always
     * assigned with the standard path, so consult with {@link hasActions} to
     * check if the file exists.
     */
    readonly actionsUri: Uri;
    /**
     * Fires when the **persisted** actions file (i.e., `actions.yaml`) changes,
     * or is created/deleted).
     */
    readonly onActionsChanged = this._onActionsChanged.event;

    private _hasMetadata: boolean = false;
    private readonly _onMetadataChanged = new vscode.EventEmitter<void>();
    /**
     * URI of the charm's `metadata.yaml` file. This property is always
     * assigned with the standard path, so consult with {@link hasMetadata} to
     * check if the file exists.
     */
    readonly metadataUri: Uri;
    /**
     * Fires when the **persisted** metadata file (i.e., `metadata.yaml`)
     * changes, or is created/deleted).
     */
    readonly onMetadataChanged = this._onMetadataChanged.event;

    private readonly _virtualEnvDirectory: string;

    private _hasVirtualEnv: boolean = false;
    private readonly _onVirtualEnvChanged = new vscode.EventEmitter<void>();
    /**
     * URI of the charm's virtual environment directory. This property is always
     * assigned with the standard path, so consult with {@link hasVirtualEnv} to
     * check if the directory exists.
     */
    readonly virtualEnvUri: Uri;
    /**
     * Fires when the virtual environment directory (i.e., `venv`) is
     * created/deleted.
     */
    readonly onVirtualEnvChanged = this._onVirtualEnvChanged.event;
    readonly virtualEnv: VirtualEnv;

    private _hasToxConfig: boolean = false;
    private readonly _onToxConfigChanged = new vscode.EventEmitter<void>();
    /**
     * URI of the charm's `tox.ini` file. This property is always assigned with
     * the standard path, so consult with {@link hasToxConfig} to check if the
     * file exists.
     */
    readonly toxConfigUri: Uri;
    /**
     * Fires when the **persisted** tox configuration file (i.e., `tox.ini`)
     * changes, or is created/deleted).
     */
    readonly onToxConfigChanged = this._onToxConfigChanged.event;

    constructor(
        readonly home: Uri,
        readonly backgroundWorkerManager: BackgroundWorkerManager,
        readonly output: vscode.OutputChannel,
        readonly reporter: TelemetryReporter,
        diagnostics: vscode.DiagnosticCollection,
        lintDiagnostics: vscode.DiagnosticCollection,
        readonly config?: WorkspaceCharmConfig,
    ) {
        this._virtualEnvDirectory = config?.virtualEnvDirectory ?? CHARM_DIR_VENV;
        this.model = new Charm();
        this.live = new Charm();
        this.actionsUri = Uri.joinPath(this.home, CHARM_FILE_ACTIONS_YAML);
        this.metadataUri = Uri.joinPath(this.home, CHARM_FILE_METADATA_YAML);
        this.toxConfigUri = Uri.joinPath(this.home, CHARM_FILE_TOX_INI);
        this.srcUri = Uri.joinPath(this.home, CHARM_DIR_SRC);
        this.testsUri = Uri.joinPath(this.home, CHARM_DIR_TESTS);
        this.sourceCodeUris = [this.srcUri, this.testsUri];
        this.libUri = Uri.joinPath(this.home, CHARM_DIR_LIB);
        this.configUri = Uri.joinPath(this.home, CHARM_FILE_CONFIG_YAML);
        this.virtualEnvUri = Uri.joinPath(this.home, this._virtualEnvDirectory);

        this._diagnostics = new DiagnosticCollectionManager(this.home, diagnostics);
        this._lintDiagnostics = new DiagnosticCollectionManager(this.home, lintDiagnostics);

        const watchGlobPattern = `{${[
            this._virtualEnvDirectory,
            CHARM_FILE_CONFIG_YAML,
            CHARM_FILE_METADATA_YAML,
            CHARM_FILE_ACTIONS_YAML,
            CHARM_FILE_TOX_INI,
            `${CHARM_DIR_SRC}/**/*.py`,
            `${CHARM_DIR_TESTS}/**/*.py`,
        ].join(',')}}`;

        this._disposables.push(
            this.virtualEnv = new VirtualEnv(this.home, this._virtualEnvDirectory),
            this.watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(home, watchGlobPattern)),
            this.watcher.onDidChange(async e => await this._onFileSystemEvent('change', e)),
            this.watcher.onDidCreate(async e => await this._onFileSystemEvent('create', e)),
            this.watcher.onDidDelete(async e => await this._onFileSystemEvent('delete', e)),
        );

        this._onLintOnSave = new NonStackableEvent(async () => {
            this._lintDiagnostics.update(await this._getSourceCodeLinterDiagnostics());
        });
    }

    dispose() {
        this._disposables.forEach(x => x.dispose());
        this._diagnostics.dispose();
        this._lintDiagnostics.dispose();
        this._onConfigChanged.dispose();
        this._onActionsChanged.dispose();
        this._onMetadataChanged.dispose();
        this._onVirtualEnvChanged.dispose();
        this._onToxConfigChanged.dispose();
    }

    private _getRelativePath(uri: Uri, base?: Uri): string | undefined {
        const prefix = (base ?? this.home).path + '/';
        return uri.path.startsWith(prefix) ? uri.path.replace(prefix, '') : undefined;
    }

    private _isNestedUnder(uri: Uri, parent: Uri): boolean {
        const prefix = parent.path + '/';
        return uri.path.startsWith(prefix);
    }

    /**
     * @returns Path of the given URI relative to the charm's directory, if it's
     * a source code file (i.e., it's under any of the URIs listed by
     * {@link sourceCodeUris}); otherwise, `undefined`.
     */
    private _getSourceCodeRelativePath(uri: Uri): string | undefined {
        const relativePath = this._getRelativePath(uri);
        if (!relativePath) {
            return;
        }
        return this.sourceCodeUris.some(x => this._isNestedUnder(uri, x)) ? relativePath : undefined;
    }

    /**
     * Returns `true` if there's a virtual environment directory associated with the charm; otherwise, `false`.
     */
    get hasVirtualEnv() {
        return this._hasVirtualEnv;
    }

    /**
     * Returns `true` if there's a `config.yaml` file associated with the charm; otherwise, `false`.
     */
    get hasConfig() {
        return this._hasConfig;
    }

    /**
     * Returns `true` if there's an `actions.yaml` file associated with the charm; otherwise, `false`.
     */
    get hasActions() {
        return this._hasActions;
    }

    /**
     * Returns `true` if there's a `metadata.yaml` file associated with the charm; otherwise, `false`.
     */
    get hasMetadata() {
        return this._hasMetadata;
    }

    /**
     * Returns `true` if there's a `tox.ini` file associated with the charm; otherwise, `false`.
     */
    get hasToxConfig() {
        return this._hasToxConfig;
    }

    private async _onFileSystemEvent(kind: 'change' | 'create' | 'delete', uri: Uri) {
        if (uri.path === this.virtualEnvUri.path) {
            await this._refreshVirtualEnv();
        } else if (uri.path === this.actionsUri.path) {
            await this._refreshActions();
        } else if (uri.path === this.configUri.path) {
            await this._refreshConfig();
        } else if (uri.path === this.metadataUri.path) {
            await this._refreshMetadata();
        } else if (uri.path === this.toxConfigUri.path) {
            await this._refreshToxConfig();
        } else {
            if (this._getSourceCodeRelativePath(uri)) {
                if (kind === 'change') {
                    await this._refreshSourceCodeFile(uri);
                } else {
                    await this._refreshSourceCodeTree();
                }
            }
        }
    }

    async refresh() {
        await Promise.allSettled([
            this._refreshVirtualEnv(),
            this._refreshActions(),
            this._refreshConfig(),
            this._refreshMetadata(),
            this._refreshToxConfig(),
            this._refreshSourceCodeTree(),
        ]);
    }

    private async _refreshVirtualEnv() {
        try {
            const stat = await vscode.workspace.fs.stat(this.virtualEnvUri);
            this._hasVirtualEnv = stat.type === vscode.FileType.Directory;
        } catch {
            this._hasVirtualEnv = false;
        }
        this._onVirtualEnvChanged.fire();
    }

    private async _refreshActions() {
        const content = await tryReadWorkspaceFileAsText(this.actionsUri);
        let actions: CharmActions;
        if (content === undefined) {
            this._hasActions = false;
            actions = emptyActions();
        } else {
            this._hasActions = true;
            actions = parseCharmActionsYAML(content);
        }
        this.model.updateActions(actions);
        await this.updateLiveActionsFile();
        this._onActionsChanged.fire();
    }

    private async _refreshConfig() {
        const content = await tryReadWorkspaceFileAsText(this.configUri);
        let config: CharmConfig;
        if (content === undefined) {
            this._hasConfig = false;
            config = emptyConfig();
        } else {
            this._hasConfig = true;
            config = parseCharmConfigYAML(content);
        }
        this.model.updateConfig(config);
        await this.updateLiveConfigFile();
        this._onConfigChanged.fire();
    }

    private async _refreshMetadata() {
        const content = await tryReadWorkspaceFileAsText(this.metadataUri);
        let metadata: CharmMetadata;
        if (content === undefined) {
            this._hasMetadata = false;
            metadata = emptyMetadata();
        } else {
            this._hasMetadata = true;
            metadata = parseCharmMetadataYAML(content);
        }
        this.model.updateMetadata(metadata);
        await this.updateLiveMetadataFile();
        this._onMetadataChanged.fire();
    }

    private async _refreshToxConfig() {
        const content = await tryReadWorkspaceFileAsText(this.toxConfigUri);
        let toxConfig: CharmToxConfig;
        if (content === undefined) {
            this._hasToxConfig = false;
            toxConfig = emptyToxConfig();
        } else {
            this._hasToxConfig = true;
            toxConfig = parseToxINI(content);
        }
        this.model.updateToxConfig(toxConfig);
        await this.updateLiveToxConfigFile();
        this._onToxConfigChanged.fire();
    }

    private async _refreshSourceCodeFile(uri: Uri) {
        const relativePath = this._getSourceCodeRelativePath(uri);
        if (!relativePath) {
            return;
        }

        let file = await createSourceCodeFile(uri);

        // Keeping old AST data if there's no AST available (e.g., due to Python parser error in the middle of
        // incomplete changes).
        if (!file.ast) {
            const oldAST = this.model.sourceCode.getFile(relativePath);
            if (oldAST) {
                file = createFileWithOldAST(file.content, oldAST);
                this._log(`failed to generate AST; keeping old AST data: ${relativePath}`);
            }
        }

        this.model.sourceCode.updateFile(relativePath, file);
        await this.updateLiveSourceCodeFile(uri);

        // linting on-save.
        await this._refreshCodeLinterDiagnostics();
    }

    private async _refreshCodeLinterDiagnostics() {
        if (this.config?.runLintOnSave?.enabled === false) {
            return;
        }
        this._onLintOnSave.fire();
    }

    private async _checkToxAvailable(): Promise<boolean> {
        const result = await this.virtualEnv.exec({
            command: 'python3',
            args: ['-c', 'import tox'],
            notActivate: !this.hasVirtualEnv, // To activate the virtual env, if there's one.
        });
        return result.code === 0;
    }

    private async _getSourceCodeLinterDiagnostics(): Promise<Map<string, vscode.Diagnostic[]>> {
        const commands = this.hasVirtualEnv && this.config?.runLintOnSave?.commands || [];
        const toxSections = this.config?.runLintOnSave?.tox ?? [CHARM_TOX_LINT_SECTION];
        const correspondingToxSections = toxSections.map(s =>
            s in this.model.toxConfig.sections
                ? this.model.toxConfig.sections[s]
                : Object.values(this.model.toxConfig.sections).find(v => v.env === s)
        ).filter((s): s is CharmToxConfigSection => !!s);

        if (correspondingToxSections.length && !(await this._checkToxAvailable())) {
            if (this.hasVirtualEnv) {
                vscode.window.showErrorMessage(
                    "There is a virtual environment but Tox is not installed in it. " +
                    "Please install Tox in the virtual environment or try setting up the virtual environment again. " +
                    `(Charm at ${this.home.path})`
                );
            } else {
                vscode.window.showErrorMessage(
                    "Tox is not installed. Please either install it globally or setup a virtual environment. "+
                    `(Charm at ${this.home.path})`
                );
            }
            correspondingToxSections.splice(0);
        }

        const executions = [
            ...correspondingToxSections.map(x =>
                this.backgroundWorkerManager.execute(x.name, () =>
                    this.virtualEnv.exec({
                        command: 'python3',
                        args: ['-m', 'tox', '-e', x.env, '-x', `${x.name}.ignore_errors=True`],
                        notActivate: !this.hasVirtualEnv, // To activate the virtual env, if there's one.
                    }))),
            ...commands.map(x => this.virtualEnv.execInShell(x)),
        ];

        if (!executions.length) {
            return new Map();
        }

        const t0 = new Date();
        const results = await Promise.allSettled(executions);
        const duration = new Date().getTime() - t0.getTime();

        const entries: LinterMessage[] = [];
        for (const result of results) {
            if (result.status === 'rejected') {
                continue;
            }
            entries.push(
                ...parseToxLinterOutput(result.value.stdout),
                ...parseGenericLinterOutput(result.value.stderr),
            );
        }

        const include = this.config?.runLintOnSave?.include?.length ? new Set(this.config.runLintOnSave.include) : undefined;
        const exclude = this.config?.runLintOnSave?.exclude?.length ? new Set(this.config.runLintOnSave.exclude) : undefined;

        const homePath = this.home.path + '/';
        const map = new Map<string, vscode.Diagnostic[]>();
        for (const x of entries) {
            const path = x.relativePath ?? (x.absolutePath?.startsWith(homePath) && x.absolutePath.substring(homePath.length)) ?? undefined;
            if (!path) {
                continue;
            }
            if (include && !include.has(x.linter) || exclude && exclude.has(x.linter)) {
                continue;
            }
            if (!map.has(path)) {
                map.set(path, []);
            }
            map.get(path)?.push(toDiagnostic(x));
        }

        const diagnosticsLength = Array.from(map.values()).reduce((counter, x) => counter + x.length, 0);
        this.reporter.sendTelemetryEvent(WorkspaceCharm._telemetryEventLintOnSave, undefined, {
            [WorkspaceCharm._telemetryEventLintOnSaveDuration]: duration,
            [WorkspaceCharm._telemetryEventLintOnSaveDiagnosticsLength]: diagnosticsLength,
        });

        return map;

        function toDiagnostic(entry: LinterMessage): vscode.Diagnostic {
            return new vscode.Diagnostic(rangeToVSCodeRange(entry.range), `(${entry.linter ?? 'generic'}:) ${entry.message}`);
        }
    }

    private async _refreshSourceCodeTree() {
        const tree = await discoverSourceCodeTree(this.home, Array.from(this.sourceCodeUris));
        if (!tree) {
            return;
        }
        this.model.updateSourceCode(new SourceCode(tree));
        this.live.updateSourceCode(new SourceCode(tree));
        this._diagnostics.update(getAllSourceCodeDiagnostics(this.live));
        await this._refreshCodeLinterDiagnostics();
    }

    async updateLiveFile(uri: Uri) {
        if (this._getSourceCodeRelativePath(uri)) {
            await this.updateLiveSourceCodeFile(uri);
        } else if (uri.path === this.configUri.path) {
            await this.updateLiveConfigFile();
        } else if (uri.path === this.actionsUri.path) {
            await this.updateLiveActionsFile();
        } else if (uri.path === this.metadataUri.path) {
            await this.updateLiveMetadataFile();
        }
    }

    /**
     * @returns `undefined` when there's no dirty document with the given URI.
     */
    private _getDirtyDocumentContent(uri: Uri): string | undefined {
        const docs = Array.from(vscode.workspace.textDocuments);
        for (const doc of docs) {
            if (doc.isClosed) {
                continue;
            }
            if (doc.uri.toString() === uri.toString()) {
                if (doc.isDirty) {
                    return doc.getText();
                }
            }
        }
        return undefined;
    }

    async updateLiveConfigFile() {
        const content = this._getDirtyDocumentContent(this.configUri);
        if (content === undefined) {
            this.live.updateConfig(this.model.config);
            this._diagnostics.updateByURI(this.configUri, getConfigDiagnostics(this.live.config));
            return;
        }

        this._log('config refreshed');
        this.live.updateConfig(parseCharmConfigYAML(content));
        this._diagnostics.updateByURI(this.configUri, getConfigDiagnostics(this.live.config));
    }

    async updateLiveActionsFile() {
        const content = this._getDirtyDocumentContent(this.actionsUri);
        if (content === undefined) {
            this.live.updateActions(this.model.actions);
            this._diagnostics.updateByURI(this.actionsUri, getActionsDiagnostics(this.live.actions));
            return;
        }

        this._log('actions refreshed');
        this.live.updateActions(parseCharmActionsYAML(content));
        this._diagnostics.updateByURI(this.actionsUri, getActionsDiagnostics(this.live.actions));
    }

    async updateLiveMetadataFile() {
        const content = this._getDirtyDocumentContent(this.metadataUri);
        if (content === undefined) {
            this.live.updateMetadata(this.model.metadata);
            this._diagnostics.updateByURI(this.metadataUri, getMetadataDiagnostics(this.live.metadata));
            return;
        }

        this._log('metadata refreshed');
        this.live.updateMetadata(parseCharmMetadataYAML(content));
        this._diagnostics.updateByURI(this.metadataUri, getMetadataDiagnostics(this.live.metadata));
    }

    async updateLiveToxConfigFile() {
        const content = this._getDirtyDocumentContent(this.toxConfigUri);
        if (content === undefined) {
            this.live.updateToxConfig(this.model.toxConfig);
            return;
        }

        this._log('tox config refreshed');
        this.live.updateToxConfig(parseToxINI(content));
    }

    async updateLiveSourceCodeFile(uri: Uri) {
        const relativePath = this._getSourceCodeRelativePath(uri);
        if (!relativePath) {
            return undefined;
        }

        const content = this._getDirtyDocumentContent(uri);
        if (content === undefined) {
            const file = this.model.sourceCode.getFile(relativePath);
            if (file) {
                this.live.sourceCode.updateFile(relativePath, file);
                this._diagnostics.updateByURI(uri, getSourceCodeDiagnostics(this.live, relativePath));
            }
            return;
        }

        // using cached data to avoid unnecessary running of python AST parser.
        const cached = this.live.sourceCode.getFile(relativePath);
        if (cached?.content === content) {
            return;
        }

        this._log(`source refreshed: ${relativePath}`);
        let file = await createSourceCodeFileFromContent(content);

        // Keeping old AST data if there's no AST available (e.g., due to Python parser error in the middle of
        // incomplete changes).
        if (!file.ast) {
            const oldAST = this.live.sourceCode.getFile(relativePath);
            if (oldAST) {
                file = createFileWithOldAST(file.content, oldAST);
                this._log(`failed to generate AST; keeping old AST data: ${relativePath}`);
            }
        }

        this.live.sourceCode.updateFile(relativePath, file);
        this._diagnostics.updateByURI(uri, getSourceCodeDiagnostics(this.live, relativePath));
    }

    private _log(s: string) {
        this.output.appendLine(`${new Date().toISOString()} ${this.home.path} ${s}`);
    }
}

export async function discoverSourceCodeTree(
    root: Uri,
    onlyInclude?: Uri[],
    token?: vscode.CancellationToken
): Promise<SourceCodeTree | undefined> {
    async function readDir(uri: Uri, onlyInclude?: Uri[]): Promise<SourceCodeTree | undefined> {
        if (token?.isCancellationRequested) {
            return undefined;
        }

        const result: SourceCodeTree = {};
        let children = await vscode.workspace.fs.readDirectory(uri);

        if (onlyInclude) {
            children = children.filter(([name, entryType]) => {
                const childUri = Uri.joinPath(uri, name);
                const isIncluded = !onlyInclude ? true : onlyInclude.some(x =>
                    childUri.path === x.path
                    || childUri.path.startsWith(x.path + '/')
                    || entryType === vscode.FileType.Directory && x.path.startsWith(childUri.path + '/')
                );
                return isIncluded;
            });
        }

        for (const [name, entryType] of children) {
            const entryUri = Uri.joinPath(uri, name);
            if (entryType === vscode.FileType.File && name.endsWith('.py')) {
                const file = await createSourceCodeFile(entryUri);
                result[name] = {
                    kind: 'file',
                    data: file,
                };
            } else if (entryType === vscode.FileType.Directory) {
                const subdir = await readDir(entryUri, onlyInclude);
                if (!subdir) {
                    return undefined;
                }
                result[name] = { kind: 'directory', data: subdir, };
            }
        }
        return result;
    }
    return await readDir(root, onlyInclude);
}

export async function createSourceCodeFile(uri: Uri): Promise<SourceCodeFile> {
    const content = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
    return await createSourceCodeFileFromContent(content);
}

export async function createSourceCodeFileFromContent(content: string): Promise<SourceCodeFile> {
    const ast = await getPythonAST(content);
    return new SourceCodeFile(content, ast, ast !== undefined);
}

function createFileWithOldAST(newContent: string, oldAST: any): SourceCodeFile {
    return new SourceCodeFile(newContent, oldAST, false);
}

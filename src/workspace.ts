import { TextDecoder } from 'util';
import * as vscode from 'vscode';
import { Disposable, Uri } from 'vscode';
import {
    getActionsDiagnostics,
    getAllSourceCodeDiagnostics,
    getSourceCodeDiagnostics,
    getTestSourceCodeDiagnostics,
    getConfigDiagnostics,
    getMetadataDiagnostics,
    getAllTestSourceCodeDiagnostics
} from './diagnostic';
import {
    Charm,
    CharmActions,
    CharmConfig,
    CharmMetadata,
    CharmToxConfig,
    SourceCode,
    SourceCodeFile,
    SourceCodeTree,
    emptyActions,
    emptyConfig,
    emptyMetadata,
    emptyToxConfig
} from './model/charm';
import {
    CHARM_DIR_SRC,
    CHARM_DIR_TESTS,
    CHARM_DIR_VENV,
    CHARM_FILE_ACTIONS_YAML,
    CHARM_FILE_CONFIG_YAML,
    CHARM_FILE_METADATA_YAML,
    CHARM_FILE_TOX_INI
} from './model/common';
import { getPythonAST, parseCharmActionsYAML, parseCharmConfigYAML, parseCharmMetadataYAML, parseToxINI } from './parser';
import { tryReadWorkspaceFileAsText } from './util';
import { VirtualEnv } from './venv';
import path = require('path');

export async function discoverSourceCodeTree(charmHome: vscode.Uri, token?: vscode.CancellationToken): Promise<SourceCodeTree | undefined> {
    async function readDir(uri: vscode.Uri): Promise<SourceCodeTree | undefined> {
        if (token?.isCancellationRequested) {
            return undefined;
        }

        const result: SourceCodeTree = {};
        const children = await vscode.workspace.fs.readDirectory(uri);
        for (const [name, entryType] of children) {
            const entryUri = vscode.Uri.joinPath(uri, name);
            if (entryType === vscode.FileType.File && name.endsWith('.py')) {
                const file = await createSourceCodeFile(entryUri);
                result[name] = {
                    kind: 'file',
                    data: file,
                };
            } else if (entryType === vscode.FileType.Directory) {
                const subdir = await readDir(entryUri);
                if (!subdir) {
                    return undefined;
                }
                result[name] = { kind: 'directory', data: subdir, };
            }
        }
        return result;
    }
    return await readDir(charmHome);
}

export async function createSourceCodeFile(uri: vscode.Uri): Promise<SourceCodeFile> {
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

const WATCH_GLOB_PATTERN = `{${[
    CHARM_DIR_VENV,
    CHARM_FILE_CONFIG_YAML,
    CHARM_FILE_METADATA_YAML,
    CHARM_FILE_ACTIONS_YAML,
    CHARM_FILE_TOX_INI,
    `${CHARM_DIR_SRC}/**/*.py`,
    `${CHARM_DIR_TESTS}/**/*.py`,
].join(',')}}`;

export class WorkspaceCharm implements vscode.Disposable {
    private _disposables: Disposable[] = [];
    private readonly watcher: vscode.FileSystemWatcher;

    private readonly _srcDir: Uri;
    private readonly _testsDir: Uri;

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
        readonly output: vscode.OutputChannel,
        readonly diagnostics: vscode.DiagnosticCollection
    ) {
        this.model = new Charm();
        this.live = new Charm();
        this.actionsUri = Uri.joinPath(this.home, CHARM_FILE_ACTIONS_YAML);
        this.metadataUri = Uri.joinPath(this.home, CHARM_FILE_METADATA_YAML);
        this.toxConfigUri = Uri.joinPath(this.home, CHARM_FILE_TOX_INI);
        this._srcDir = Uri.joinPath(this.home, CHARM_DIR_SRC);
        this._testsDir = Uri.joinPath(this.home, CHARM_DIR_TESTS);
        this.configUri = Uri.joinPath(this.home, CHARM_FILE_CONFIG_YAML);
        this.virtualEnvUri = Uri.joinPath(this.home, CHARM_DIR_VENV);
        this._disposables.push(
            this.virtualEnv = new VirtualEnv(this.home, CHARM_DIR_VENV),
            this.watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(home, WATCH_GLOB_PATTERN)),
            this.watcher.onDidChange(async e => await this._onFileSystemEvent('change', e)),
            this.watcher.onDidCreate(async e => await this._onFileSystemEvent('create', e)),
            this.watcher.onDidDelete(async e => await this._onFileSystemEvent('delete', e)),
        );
    }

    dispose() {
        this._disposables.forEach(x => x.dispose());
    }

    private _getRelativePathToSrc(uri: Uri): string | undefined {
        const prefix = this._srcDir.path + '/';
        return uri.path.startsWith(prefix) ? uri.path.replace(prefix, '') : undefined;
    }

    private _getRelativePathToTests(uri: Uri): string | undefined {
        const prefix = this._testsDir.path + '/';
        return uri.path.startsWith(prefix) ? uri.path.replace(prefix, '') : undefined;
    }

    private _getRelativePath(uri: Uri): string | undefined {
        const prefix = this.home.path + '/';
        return uri.path.startsWith(prefix) ? uri.path.replace(prefix, '') : undefined;
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

    private async _onFileSystemEvent(kind: 'change' | 'create' | 'delete', uri: vscode.Uri) {
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
            if (this._getRelativePathToSrc(uri)) {
                if (kind === 'change') {
                    await this._refreshSourceCodeFile(uri);
                } else {
                    await this._refreshSourceCodeTree();
                }
            } else if (this._getRelativePathToTests(uri)) {
                if (kind === 'change') {
                    await this._refreshTestSourceCodeFile(uri);
                } else {
                    await this._refreshTestSourceCodeTree();
                }
            }
        }
    }

    private _updateDiagnostics(map: Map<string, vscode.Diagnostic[]>, baseURI: vscode.Uri) {
        for (const [relativePath, diags] of map) {
            const uri = vscode.Uri.joinPath(baseURI, relativePath);
            this._updateDiagnosticsByURI(uri, diags);
        }
    }

    private _updateDiagnosticsByURI(uri: Uri, entries: vscode.Diagnostic[]) {
        this.diagnostics.delete(uri);
        this.diagnostics.set(uri, entries);
    }

    async refresh() {
        await Promise.allSettled([
            this._refreshVirtualEnv(),
            this._refreshActions(),
            this._refreshConfig(),
            this._refreshMetadata(),
            this._refreshToxConfig(),
            this._refreshSourceCodeTree(),
            this._refreshTestSourceCodeTree(),
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
        let file = await createSourceCodeFile(uri);
        const relativePath = this._getRelativePathToSrc(uri);
        if (!relativePath) {
            return;
        }

        // Keeping old AST data if there's no AST available (e.g., due to Python parser error in the middle of
        // incomplete changes).
        if (!file.ast) {
            const oldAST = this.model.src.getFile(relativePath);
            if (oldAST) {
                file = createFileWithOldAST(file.content, oldAST);
                this._log(`failed to generate AST; keeping old AST data: ${relativePath}`);
            }
        }

        this.model.src.updateFile(relativePath, file);
        await this.updateLiveSourceCodeFile(uri);
    }

    private async _refreshSourceCodeTree() {
        const tree = await discoverSourceCodeTree(this._srcDir);
        if (!tree) {
            return;
        }
        this.model.updateSourceCode(new SourceCode(tree));
        this.live.updateSourceCode(new SourceCode(tree));
        this._updateDiagnostics(getAllSourceCodeDiagnostics(this.live), this._srcDir);
    }


    private async _refreshTestSourceCodeFile(uri: Uri) {
        let file = await createSourceCodeFile(uri);
        const relativePath = this._getRelativePathToTests(uri);
        if (!relativePath) {
            return;
        }

        // Keeping old AST data if there's no AST available (e.g., due to Python parser error in the middle of
        // incomplete changes).
        if (!file.ast) {
            const oldAST = this.model.tests.getFile(relativePath);
            if (oldAST) {
                file = createFileWithOldAST(file.content, oldAST);
                this._log(`failed to generate AST; keeping old AST data: ${relativePath}`);
            }
        }

        this.model.tests.updateFile(relativePath, file);
        await this.updateLiveTestSourceCodeFile(uri);
    }

    private async _refreshTestSourceCodeTree() {
        const tree = await discoverSourceCodeTree(this._testsDir);
        if (!tree) {
            return;
        }
        this.model.updateTestSourceCode(new SourceCode(tree));
        this.live.updateTestSourceCode(new SourceCode(tree));
        this._updateDiagnostics(getAllTestSourceCodeDiagnostics(this.live), this._testsDir);
    }

    async updateLiveFile(uri: Uri) {
        if (this._getRelativePathToSrc(uri) !== undefined) {
            await this.updateLiveSourceCodeFile(uri);
        } else if (this._getRelativePathToTests(uri) !== undefined) {
            await this.updateLiveTestSourceCodeFile(uri);
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
            this._updateDiagnosticsByURI(this.configUri, getConfigDiagnostics(this.live.config));
            return;
        }

        this._log('config refreshed');
        this.live.updateConfig(parseCharmConfigYAML(content));
        this._updateDiagnosticsByURI(this.configUri, getConfigDiagnostics(this.live.config));
    }

    async updateLiveActionsFile() {
        const content = this._getDirtyDocumentContent(this.actionsUri);
        if (content === undefined) {
            this.live.updateActions(this.model.actions);
            this._updateDiagnosticsByURI(this.actionsUri, getActionsDiagnostics(this.live.actions));
            return;
        }

        this._log('actions refreshed');
        this.live.updateActions(parseCharmActionsYAML(content));
        this._updateDiagnosticsByURI(this.actionsUri, getActionsDiagnostics(this.live.actions));
    }

    async updateLiveMetadataFile() {
        const content = this._getDirtyDocumentContent(this.metadataUri);
        if (content === undefined) {
            this.live.updateMetadata(this.model.metadata);
            this._updateDiagnosticsByURI(this.metadataUri, getMetadataDiagnostics(this.live.metadata));
            return;
        }

        this._log('metadata refreshed');
        this.live.updateMetadata(parseCharmMetadataYAML(content));
        this._updateDiagnosticsByURI(this.metadataUri, getMetadataDiagnostics(this.live.metadata));
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
        const relativePath = this._getRelativePathToSrc(uri);
        if (!relativePath) {
            return undefined;
        }

        const content = this._getDirtyDocumentContent(uri);
        if (content === undefined) {
            const file = this.model.src.getFile(relativePath);
            if (file) {
                this.live.src.updateFile(relativePath, file);
                this._updateDiagnosticsByURI(uri, getSourceCodeDiagnostics(this.live, relativePath));
            }
            return;
        }

        // using cached data to avoid unnecessary running of python AST parser.
        const cached = this.live.src.getFile(relativePath);
        if (cached?.content === content) {
            return;
        }

        this._log(`source refreshed: ${relativePath}`);
        let file = await createSourceCodeFileFromContent(content);

        // Keeping old AST data if there's no AST available (e.g., due to Python parser error in the middle of
        // incomplete changes).
        if (!file.ast) {
            const oldAST = this.live.src.getFile(relativePath);
            if (oldAST) {
                file = createFileWithOldAST(file.content, oldAST);
                this._log(`failed to generate AST; keeping old AST data: ${relativePath}`);
            }
        }

        this.live.src.updateFile(relativePath, file);
        this._updateDiagnosticsByURI(uri, getSourceCodeDiagnostics(this.live, relativePath));
    }

    async updateLiveTestSourceCodeFile(uri: Uri) {
        const relativePath = this._getRelativePathToTests(uri);
        if (!relativePath) {
            return undefined;
        }

        const content = this._getDirtyDocumentContent(uri);
        if (content === undefined) {
            const file = this.model.tests.getFile(relativePath);
            if (file) {
                this.live.tests.updateFile(relativePath, file);
                this._updateDiagnosticsByURI(uri, getTestSourceCodeDiagnostics(this.live, relativePath));
            }
            return;
        }

        // using cached data to avoid unnecessary running of python AST parser.
        const cached = this.live.tests.getFile(relativePath);
        if (cached?.content === content) {
            return;
        }

        this._log(`source refreshed: ${relativePath}`);
        let file = await createSourceCodeFileFromContent(content);

        // Keeping old AST data if there's no AST available (e.g., due to Python parser error in the middle of
        // incomplete changes).
        if (!file.ast) {
            const oldAST = this.live.tests.getFile(relativePath);
            if (oldAST) {
                file = createFileWithOldAST(file.content, oldAST);
                this._log(`failed to generate AST; keeping old AST data: ${relativePath}`);
            }
        }

        this.live.tests.updateFile(relativePath, file);
        this._updateDiagnosticsByURI(uri, getTestSourceCodeDiagnostics(this.live, relativePath));
    }

    private _log(s: string) {
        this.output.appendLine(`${new Date().toISOString()} ${this.home.path} ${s}`);
    }
}

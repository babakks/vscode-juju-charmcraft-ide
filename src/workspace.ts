import { TextDecoder } from 'util';
import * as vscode from 'vscode';
import { Disposable, Uri } from 'vscode';
import { getActionsDiagnostics, getAllSourceCodeDiagnostics, getConfigDiagnostics, getMetadataDiagnostics, getSourceCodeDiagnostics } from './diagnostic';
import { Charm, CharmActions, CharmConfig, CharmMetadata, CharmSourceCode, CharmSourceCodeFile, CharmSourceCodeTree, MapWithNode, Problem, SequenceWithNode, WithNode, YAMLNode, emptyActions, emptyConfig, emptyMetadata } from './model/charm';
import { CHARM_DIR_SRC, CHARM_FILE_ACTIONS_YAML, CHARM_FILE_CONFIG_YAML, CHARM_FILE_METADATA_YAML, Range, zeroRange } from './model/common';
import { getPythonAST, parseCharmActionsYAML, parseCharmConfigYAML, parseCharmMetadataYAML } from './parser';
import { rangeToVSCodeRange, tryReadWorkspaceFileAsText } from './util';
import path = require('path');

export async function getCharmSourceCodeTree(charmHome: vscode.Uri, token?: vscode.CancellationToken): Promise<CharmSourceCodeTree | undefined> {
    async function readDir(uri: vscode.Uri): Promise<CharmSourceCodeTree | undefined> {
        if (token?.isCancellationRequested) {
            return undefined;
        }

        const result: CharmSourceCodeTree = {};
        const children = await vscode.workspace.fs.readDirectory(uri);
        for (const [name, entryType] of children) {
            const entryUri = vscode.Uri.joinPath(uri, name);
            if (entryType === vscode.FileType.File && name.endsWith('.py')) {
                const file = await createCharmSourceCodeFile(entryUri);
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

export async function createCharmSourceCodeFile(uri: vscode.Uri): Promise<CharmSourceCodeFile> {
    const content = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
    return await createCharmSourceCodeFileFromContent(content);
}

export async function createCharmSourceCodeFileFromContent(content: string): Promise<CharmSourceCodeFile> {
    const ast = await getPythonAST(content);
    return new CharmSourceCodeFile(content, ast, ast !== undefined);
}

const WATCH_GLOB_PATTERN = `{${CHARM_FILE_CONFIG_YAML},${CHARM_FILE_METADATA_YAML},${CHARM_FILE_ACTIONS_YAML},${CHARM_DIR_SRC}/**/*.py}`;

export class WorkspaceCharm implements vscode.Disposable {
    private _disposables: Disposable[] = [];

    /**
     * Persisted model of the charm. 
     */
    readonly model: Charm;

    /**
     * *Live* instance of the charm model (i.e., content is in sync with the
     * latest un-persisted changes).
     */
    readonly live: Charm;

    private readonly _srcDir: Uri;

    private readonly watcher: vscode.FileSystemWatcher;

    readonly configUri: Uri;
    readonly actionsUri: Uri;
    readonly metadataUri: Uri;

    constructor(
        readonly home: Uri,
        readonly output: vscode.OutputChannel,
        readonly diagnostics: vscode.DiagnosticCollection
    ) {
        this.model = new Charm();
        this.live = new Charm();
        this.configUri = Uri.joinPath(this.home, CHARM_FILE_CONFIG_YAML);
        this.actionsUri = Uri.joinPath(this.home, CHARM_FILE_ACTIONS_YAML);
        this.metadataUri = Uri.joinPath(this.home, CHARM_FILE_METADATA_YAML);
        this._srcDir = Uri.joinPath(this.home, CHARM_DIR_SRC);
        this._disposables.push(
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

    private _getRelativePath(uri: Uri): string | undefined {
        const prefix = this.home.path + '/';
        return uri.path.startsWith(prefix) ? uri.path.replace(prefix, '') : undefined;
    }

    private async _onFileSystemEvent(kind: 'change' | 'create' | 'delete', uri: vscode.Uri) {
        if (uri.path.endsWith(CHARM_FILE_ACTIONS_YAML)) {
            await this._refreshActions();
        } else if (uri.path.endsWith(CHARM_FILE_CONFIG_YAML)) {
            await this._refreshConfig();
        } else if (uri.path.endsWith(CHARM_FILE_METADATA_YAML)) {
            await this._refreshMetadata();
        }

        if (this._getRelativePathToSrc(uri)) {
            if (kind === 'change') {
                await this._refreshSourceCodeFile(uri);
            } else {
                await this._refreshSourceCodeTree();
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
            this._refreshActions(),
            this._refreshConfig(),
            this._refreshMetadata(),
            this._refreshSourceCodeTree(),
        ]);
    }

    private async _refreshActions() {
        const uri = vscode.Uri.joinPath(this.home, CHARM_FILE_ACTIONS_YAML);
        const content = await tryReadWorkspaceFileAsText(uri) || "";
        const actions = (content ? parseCharmActionsYAML(content) : undefined) || emptyActions();
        this.model.updateActions(actions);
        await this.updateLiveActionsFile();
    }

    private async _refreshConfig() {
        const uri = vscode.Uri.joinPath(this.home, CHARM_FILE_CONFIG_YAML);
        const content = await tryReadWorkspaceFileAsText(uri) || "";
        const config = (content ? parseCharmConfigYAML(content) : undefined) || emptyConfig();
        this.model.updateConfig(config);
        await this.updateLiveConfigFile();
    }

    private async _refreshMetadata() {
        const uri = vscode.Uri.joinPath(this.home, CHARM_FILE_METADATA_YAML);
        const content = await tryReadWorkspaceFileAsText(uri) || "";
        const metadata = (content ? parseCharmMetadataYAML(content) : undefined) || emptyMetadata();
        this.model.updateMetadata(metadata);
        await this.updateLiveMetadataFile();
    }

    private async _refreshSourceCodeFile(uri: Uri) {
        let file = await createCharmSourceCodeFile(uri);
        const relativePath = this._getRelativePathToSrc(uri);
        if (!relativePath) {
            return;
        }

        // Keeping old AST data if there's no AST available (e.g., due to Python parser error in the middle of
        // incomplete changes).
        if (!file.ast) {
            const unhealthyFile = this._makeFileWithOldAST(relativePath, file);
            if (unhealthyFile) {
                file = unhealthyFile;
                this._log(`failed to generate AST; keeping old AST data: ${relativePath}`);
            }
        }

        this.model.src.updateFile(relativePath, file);
        await this.updateLiveSourceCodeFile(uri);
    }

    private _makeFileWithOldAST(relativePath: string, newFile: CharmSourceCodeFile): CharmSourceCodeFile | undefined {
        const oldFile = this.model.src.getFile(relativePath);
        if (oldFile) {
            return new CharmSourceCodeFile(newFile.content, oldFile.ast, false);
        }
        return undefined;
    }

    private async _refreshSourceCodeTree() {
        const tree = await getCharmSourceCodeTree(this._srcDir);
        if (!tree) {
            return;
        }
        this.model.updateSourceCode(new CharmSourceCode(tree));
        this.live.updateSourceCode(new CharmSourceCode(tree));
        this._updateDiagnostics(getAllSourceCodeDiagnostics(this.live), this._srcDir);
    }

    async updateLiveFile(uri: Uri) {
        if (this._getRelativePathToSrc(uri) !== undefined) {
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
        let file = await createCharmSourceCodeFileFromContent(content);

        // Keeping old AST data if there's no AST available (e.g., due to Python parser error in the middle of
        // incomplete changes).
        if (!file.ast) {
            const unhealthyFile = this._makeFileWithOldAST(relativePath, file);
            if (unhealthyFile) {
                file = unhealthyFile;
                this._log(`failed to generate AST; keeping old AST data: ${relativePath}`);
            }
        }
        this.live.src.updateFile(relativePath, file);
        this._updateDiagnosticsByURI(uri, getSourceCodeDiagnostics(this.live, relativePath));
    }

    private _log(s: string) {
        this.output.appendLine(`${new Date().toISOString()} ${this.home.path} ${s}`);
    }
}

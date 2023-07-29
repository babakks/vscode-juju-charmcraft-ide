import * as vscode from 'vscode';
import { Disposable, Uri } from 'vscode';
import { Charm } from './model/charm';
import * as constant from './model/constant';
import { CharmSourceCode } from './model/src';
import { CharmSourceCodeFile, DefaultCharmSourceCodeFile } from './model/type';
import {
    createCharmSourceCodeFile,
    createCharmSourceCodeFileFromContent,
    getCharmSourceCodeTree,
    tryReadWorkspaceFileAsText
} from './workspace';

const WATCH_GLOB_PATTERN = `{${constant.CHARM_FILE_CONFIG_YAML},${constant.CHARM_FILE_METADATA_YAML},${constant.CHARM_FILE_ACTIONS_YAML},${constant.CHARM_DIR_SRC}/**/*.py}`;

export class ExtensionCharm implements vscode.Disposable {
    private _disposables: Disposable[] = [];
    private _liveFileCache = new Map<string, CharmSourceCodeFile>();

    readonly model: Charm;
    private readonly _srcDir: Uri;

    private readonly watcher: vscode.FileSystemWatcher;

    constructor(readonly home: Uri, readonly output: vscode.OutputChannel) {
        this.model = new Charm();
        this._srcDir = Uri.joinPath(this.home, constant.CHARM_DIR_SRC);
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
        if (uri.path.endsWith(constant.CHARM_FILE_ACTIONS_YAML)) {
            await this._refreshActions();
        } else if (uri.path.endsWith(constant.CHARM_FILE_CONFIG_YAML)) {
            await this._refreshConfig();
        } else if (uri.path.endsWith(constant.CHARM_FILE_METADATA_YAML)) {
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

    async refresh() {
        await Promise.allSettled([
            this._refreshActions(),
            this._refreshConfig(),
            this._refreshMetadata(),
            this._refreshSourceCodeTree(),
        ]);
    }

    private async _refreshActions() {
        const uri = vscode.Uri.joinPath(this.home, constant.CHARM_FILE_ACTIONS_YAML);
        const content = await tryReadWorkspaceFileAsText(uri) || "";
        this.model.updateActions(content);
    }

    private async _refreshConfig() {
        const uri = vscode.Uri.joinPath(this.home, constant.CHARM_FILE_CONFIG_YAML);
        const content = await tryReadWorkspaceFileAsText(uri) || "";
        this.model.updateConfig(content);
    }

    private async _refreshMetadata() {
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
        this._liveFileCache.delete(relativePath);
    }

    private _makeFileWithOldAST(relativePath: string, newFile: CharmSourceCodeFile): CharmSourceCodeFile | undefined {
        const oldFile = this.model.src.getFile(relativePath);
        if (oldFile) {
            return new DefaultCharmSourceCodeFile(newFile.content, oldFile.ast, false);
        }
        return undefined;
    }

    private async _refreshSourceCodeTree() {
        const tree = await getCharmSourceCodeTree(this._srcDir);
        if (!tree) {
            return;
        }
        this.model.updateSourceCode(new CharmSourceCode(tree));
        this._liveFileCache.clear();
    }

    getLatestCachedLiveSourceCodeFile(uri: Uri): CharmSourceCodeFile | undefined {
        const relativePath = this._getRelativePathToSrc(uri);
        if (!relativePath) {
            return undefined;
        }
        return this._liveFileCache.get(relativePath) ?? this.model.src.getFile(relativePath);
    }

    async updateLiveSourceCodeFile(uri: Uri): Promise<CharmSourceCodeFile | undefined> {
        const relativePath = this._getRelativePathToSrc(uri);
        if (!relativePath) {
            return undefined;
        }

        let content: string | undefined;
        const docs = Array.from(vscode.workspace.textDocuments);
        for (const doc of docs) {
            if (doc.isClosed) {
                continue;
            }
            if (doc.uri.toString() === uri.toString()) {
                if (doc.isDirty) {
                    content = doc.getText();
                }
                break;
            }
        }

        if (content === undefined) {
            return this.model.src.getFile(relativePath);
        }

        // using cached data to avoid unnecessary running of python AST parser.
        const cached = this._liveFileCache.get(relativePath);
        if (cached?.content === content) {
            return cached;
        }

        this._log(`content refreshed: ${relativePath}`);
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

        this._liveFileCache.set(relativePath, file);
        return file;
    }

    private _log(s: string) {
        this.output.appendLine(`${new Date().toISOString()} ${this.home.path} ${s}`);
    }
}
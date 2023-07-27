import * as vscode from 'vscode';
import { Disposable, Uri } from 'vscode';
import { Charm } from './charm';
import * as constant from './constant';
import {
    CHARM_CONFIG_COMPLETION_TRIGGER_CHARS,
    CHARM_EVENT_COMPLETION_TRIGGER_CHARS,
    CharmConfigParametersCompletionProvider,
    CharmEventCompletionProvider
} from './extension.completion';
import { getCharmSourceCodeTree, findCharms, tryReadWorkspaceFileAsText, createCharmSourceCodeFileFromContent, createCharmSourceCodeFile } from './extension.workspace';
import { CharmConfigHoverProvider, CharmEventHoverProvider } from './extension.hover';
import { CharmSourceCode } from './charm.src';
import { CharmDataProvider } from './extension.type';
import { CharmSourceCodeFile, DefaultCharmSourceCodeFile } from './charm.type';
import { TextDecoder } from 'util';
import { EventHandlerCodeActionProvider } from './extension.codeActions';
import { clearInterval, setInterval } from 'timers';
import { PythonExtension } from './external/ms-python.python';

const DIRTY_DOCUMENT_REFRESH_INTERVAL = 1500; // (ms)

export class ExtensionCore implements Disposable {
    private readonly _set = new Set<ExtensionCharm>();
    private readonly _disposablesPerCharm = new Map<ExtensionCharm, Disposable[]>();
    private readonly _disposables: Disposable[] = [];
    private readonly _charmDataProvider: CharmDataProvider;

    private readonly _dirties = new Map<string, Uri>();
    private readonly _liveContentRefreshInterval: NodeJS.Timeout;

    constructor(readonly output: vscode.OutputChannel, readonly pythonExtensionAPI: PythonExtension) {
        this._charmDataProvider = {
            getCharmBySourceCodeFile: this._locateCharmFromSrcDir.bind(this),
        };

        this._disposables.push(
            vscode.workspace.onDidChangeTextDocument(e => {
                this._dirties.set(e.document.uri.path, e.document.uri);
            }),
            vscode.workspace.onDidCloseTextDocument(e => {
                this._dirties.delete(e.uri.path);
            }),
            vscode.workspace.onDidOpenTextDocument(e => {
                this._dirties.set(e.uri.path, e.uri);
            })
        );
        // To capture already-opened documents (e.g., at startup).
        vscode.workspace.textDocuments.forEach(x => this._dirties.set(x.uri.path, x.uri));

        this._liveContentRefreshInterval = setInterval(() => {
            const dirties = new Map(this._dirties);
            if (!dirties.size) {
                return;
            }

            this._dirties.clear();
            const dirtyKeys = Array.from(dirties.keys());

            for (const charm of this._set) {
                const home = charm.home.path + '/';
                const keys = dirtyKeys.filter(x => x.startsWith(home));
                for (const k of keys) {
                    const uri = dirties.get(k)!;
                    charm.updateLiveSourceCodeFile(uri).then(() => {
                        // nop
                    });
                }
            }
        }, DIRTY_DOCUMENT_REFRESH_INTERVAL);
    }

    dispose() {
        clearInterval(this._liveContentRefreshInterval);
        this._set.forEach(charm => this._removeAndDisposeCharm(charm));
    }

    private _removeAndDisposeCharm(charm: ExtensionCharm) {
        this._disposablesPerCharm.get(charm)?.forEach(x => x.dispose());
        this._disposablesPerCharm.delete(charm);
        charm.dispose();
        this._set.delete(charm);
    }

    private _locateCharmFromSrcDir(uri: Uri): { charm: ExtensionCharm; relativePath: string } | undefined {
        const u = uri.toString();
        for (const charm of this._set) {
            const srcUri = Uri.joinPath(charm.home, constant.CHARM_DIR_SRC);
            if (u.startsWith(srcUri.toString())) {
                return {
                    charm: charm,
                    relativePath: u.replace(srcUri + '/', ''),
                };
            }
        }
        return undefined;
    }

    setupCompletionProviders() {
        const configCompletionProvider = new CharmConfigParametersCompletionProvider(this._charmDataProvider);
        this._disposables.push(
            vscode.languages.registerCompletionItemProvider(
                { scheme: 'file', language: 'python' },
                configCompletionProvider,
                ...CHARM_CONFIG_COMPLETION_TRIGGER_CHARS)
        );

        const eventCompletionProvider = new CharmEventCompletionProvider(this._charmDataProvider);
        this._disposables.push(
            vscode.languages.registerCompletionItemProvider(
                { scheme: 'file', language: 'python' },
                eventCompletionProvider,
                ...CHARM_EVENT_COMPLETION_TRIGGER_CHARS)
        );
    }

    setupHoverProviders() {
        const configHoverProvider = new CharmConfigHoverProvider(this._charmDataProvider);
        this._disposables.push(
            vscode.languages.registerHoverProvider(
                { scheme: 'file', language: 'python' },
                configHoverProvider)
        );

        const eventHoverProvider = new CharmEventHoverProvider(this._charmDataProvider);
        this._disposables.push(
            vscode.languages.registerHoverProvider(
                { scheme: 'file', language: 'python' },
                eventHoverProvider)
        );
    }

    setupCodeActionProviders() {
        const eventHandlerCodeActionProvider = new EventHandlerCodeActionProvider(this._charmDataProvider);
        this._disposables.push(
            vscode.languages.registerCodeActionsProvider(
                { scheme: 'file', language: 'python' },
                eventHandlerCodeActionProvider,
            )
        );
    }

    async refresh() {
        const snapshot = new Set(this._set);
        const snapshotUris = new Map(Array.from(snapshot).map(x => [x.home.toString(), x]));
        const newCharms: ExtensionCharm[] = [];

        const uris = await findCharms();
        for (const u of uris) {
            const key = u.toString();
            if (snapshotUris.has(key)) {
                snapshot.delete(snapshotUris.get(key)!);
                snapshotUris.delete(key);
                continue;
            }
            const charm = this._instantiateCharm(u);
            this._set.add(charm);
            newCharms.push(charm);
        }

        // Some existing charms may no longer exist.
        if (snapshot.size) {
            snapshot.forEach(charm => {
                this._removeAndDisposeCharm(charm);
            });
        }

        await Promise.allSettled(newCharms.map(charm => charm.refresh()));
    }

    private _instantiateCharm(home: Uri): ExtensionCharm {
        const charm = new ExtensionCharm(home, this.output);
        this._disposablesPerCharm.set(charm, []);
        return charm;
    }
}

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
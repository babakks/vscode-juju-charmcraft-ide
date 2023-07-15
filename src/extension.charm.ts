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
import { findCharms, tryReadWorkspaceFileAsText } from './extension.workspace';
import { CharmConfigHoverProvider, CharmEventHoverProvider } from './extension.hover';

export class ExtensionCore implements Disposable {
    private _set = new Set<ExtensionCharm>();
    private _disposablesPerCharm = new Map<ExtensionCharm, Disposable[]>();
    private _disposables: Disposable[] = [];

    constructor() { }

    dispose() {
        this._set.forEach(charm => this._removeAndDisposeCharm(charm));
    }

    private _removeAndDisposeCharm(charm: ExtensionCharm) {
        this._disposablesPerCharm.get(charm)?.forEach(x => x.dispose());
        this._disposablesPerCharm.delete(charm);
        charm.dispose();
        this._set.delete(charm);
    }

    private _locateCharmFromSrcDir(uri: Uri): Charm | undefined {
        const u = uri.toString();
        for (const element of this._set) {
            if (u.startsWith(Uri.joinPath(element.home, constant.CHARM_DIR_SRC).toString())) {
                return element.model;
            }
        }
        return undefined;
    }

    setupCompletionProviders() {
        const configCompletionProvider = new CharmConfigParametersCompletionProvider(this._locateCharmFromSrcDir.bind(this));
        this._disposables.push(
            vscode.languages.registerCompletionItemProvider(
                { scheme: 'file', language: 'python' },
                configCompletionProvider,
                ...CHARM_CONFIG_COMPLETION_TRIGGER_CHARS)
        );

        const eventCompletionProvider = new CharmEventCompletionProvider(this._locateCharmFromSrcDir.bind(this));
        this._disposables.push(
            vscode.languages.registerCompletionItemProvider(
                { scheme: 'file', language: 'python' },
                eventCompletionProvider,
                ...CHARM_EVENT_COMPLETION_TRIGGER_CHARS)
        );
    }

    setupHoverProviders() {
        const configHoverProvider = new CharmConfigHoverProvider(this._locateCharmFromSrcDir.bind(this));
        this._disposables.push(
            vscode.languages.registerHoverProvider(
                { scheme: 'file', language: 'python' },
                configHoverProvider)
        );

        const eventHoverProvider = new CharmEventHoverProvider(this._locateCharmFromSrcDir.bind(this));
        this._disposables.push(
            vscode.languages.registerHoverProvider(
                { scheme: 'file', language: 'python' },
                eventHoverProvider)
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
        const charm = new ExtensionCharm(home);
        this._disposablesPerCharm.set(charm, []);
        return charm;
    }
}

const WATCH_GLOB_PATTERN = `{${constant.CHARM_FILE_CONFIG_YAML},${constant.CHARM_FILE_METADATA_YAML},${constant.CHARM_FILE_ACTIONS_YAML}}`;

class ExtensionCharm implements vscode.Disposable {
    private _disposables: Disposable[] = [];
    private readonly watcher: vscode.FileSystemWatcher;
    readonly model: Charm;

    constructor(readonly home: Uri) {
        this.model = new Charm();
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

    private async _onFileSystemEvent(kind: 'change' | 'create' | 'delete', uri: vscode.Uri) {
        if (uri.path.endsWith(constant.CHARM_FILE_ACTIONS_YAML)) {
            await this._refreshActions();
        } else if (uri.path.endsWith(constant.CHARM_FILE_CONFIG_YAML)) {
            await this._refreshConfig();
        } else if (uri.path.endsWith(constant.CHARM_FILE_METADATA_YAML)) {
            await this._refreshMetadata();
        }
    }

    async refresh() {
        await Promise.allSettled([
            this._refreshActions(),
            this._refreshConfig(),
            this._refreshMetadata(),
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
}
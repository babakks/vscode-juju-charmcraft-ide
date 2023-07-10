import * as vscode from 'vscode';
import { Disposable, Uri } from 'vscode';
import { Charm } from './charm';
import { CharmConfigParametersCompletionProvider, CHARM_CONFIG_COMPLETION_TRIGGER_CHARS, CharmEventCompletionProvider, CHARM_EVENT_COMPLETION_TRIGGER_CHARS } from './completion';
import { registerSchemas } from './schema';
import { findCharms } from './workspace';
import path = require('path');
import { CHARM_DIR_SRC, EXTENSION_SCHEMA_DATA_DIR } from './constant';

export async function activate(context: vscode.ExtensionContext) {
    await registerSchemas(path.join(context.extensionPath, ...EXTENSION_SCHEMA_DATA_DIR));

    const disposables = [];
    const ide = new CharmsIDE();
    disposables.push(ide);
    await ide.refresh();
    ide.setupCompletionProviders();

    context.subscriptions.push(...disposables);
}

export function deactivate() { }

class CharmsIDE implements Disposable {
    private _set = new Set<Charm>();
    private _disposablesPerCharm = new Map<Charm, Disposable[]>();
    private _disposables: Disposable[] = [];

    constructor() {
    }

    dispose() {
        this._set.forEach(charm => this._removeAndDisposeCharm(charm));
    }

    private _removeAndDisposeCharm(charm: Charm) {
        this._disposablesPerCharm.get(charm)?.forEach(x => x.dispose());
        this._disposablesPerCharm.delete(charm);
        charm.dispose();
        this._set.delete(charm);
    }

    private _locateCharmFromSrcDir(uri: Uri): Charm | undefined {
        const u = uri.toString();
        for (const charm of this._set) {
            if (u.startsWith(Uri.joinPath(charm.home, CHARM_DIR_SRC).toString())) {
                return charm;
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

    async refresh() {
        const snapshot = new Set(this._set);
        const snapshotUris = new Map(Array.from(snapshot).map(x => [x.home.toString(), x]));
        const newCharms: Charm[] = [];

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

    private _instantiateCharm(home: Uri): Charm {
        const charm = new Charm(home);
        this._disposablesPerCharm.set(charm, [
            charm.onConfigChanged(() => this._onCharmConfigChanged(charm)),
            charm.onMetadataChanged(() => this._onCharmMetadataChanged(charm)),
        ]);
        return charm;
    }

    private _onCharmConfigChanged(charm: Charm) {
    }

    private _onCharmMetadataChanged(charm: Charm) {
    }
}
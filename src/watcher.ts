import { clearInterval, setInterval } from 'timers';
import * as vscode from 'vscode';
import { Disposable, Uri } from 'vscode';
import { Registry } from './registry';

const DIRTY_DOCUMENT_REFRESH_INTERVAL = 1500; // (ms)

/**
 * Watches live documents (i.e., documents opened in the editor) for unsaved
 * changes and trigger corresponding charms to update their cache with the
 * latest content.
 */
export class DocumentWatcher implements Disposable {
    private readonly _listeners: Disposable[] = [];
    private readonly _dirties = new Map<string, Uri>();
    private _liveContentRefreshInterval: NodeJS.Timeout | undefined;

    constructor(readonly registry: Registry) { }

    dispose() {
        this.disable();
    }

    enable() {
        if (this._liveContentRefreshInterval) {
            this.disable();
        }

        this._dirties.clear();
        this._listeners.push(
            vscode.workspace.onDidChangeTextDocument(e => this._dirties.set(e.document.uri.path, e.document.uri)),
            vscode.workspace.onDidCloseTextDocument(e => this._dirties.set(e.uri.path, e.uri)),
            vscode.workspace.onDidOpenTextDocument(e => this._dirties.set(e.uri.path, e.uri)),
        );
        // To capture already-opened documents (e.g., at startup).
        vscode.workspace.textDocuments.forEach(x => this._dirties.set(x.uri.path, x.uri));
        this._liveContentRefreshInterval = setInterval(() => this._tick(), DIRTY_DOCUMENT_REFRESH_INTERVAL);
    }

    disable() {
        this._dirties.clear();
        this._listeners.forEach(x => x.dispose());
        if (this._liveContentRefreshInterval) {
            clearInterval(this._liveContentRefreshInterval);
        }
    }

    private _tick() {
        const dirties = new Map(this._dirties);
        if (!dirties.size) {
            return;
        }

        this._dirties.clear();
        const dirtyKeys = Array.from(dirties.keys());

        for (const charm of this.registry.getWorkspaceCharms()) {
            const home = charm.home.path + '/';
            const keys = dirtyKeys.filter(x => x.startsWith(home));
            for (const k of keys) {
                const uri = dirties.get(k)!;
                charm.updateLiveFile(uri).then(() => {
                    // nop
                });
            }
        }
    }
}

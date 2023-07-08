import * as vscode from 'vscode';
import { registerSchemas } from './schema';
import path = require('path');
import { findCharms } from './workspace';
import { Charm } from './charm';

const SCHEMA_DATA_DIR = ['schema', 'data']; // "[ROOT]/schema/data"

export async function activate(context: vscode.ExtensionContext) {
    await registerSchemas(path.join(context.extensionPath, ...SCHEMA_DATA_DIR));

    const disposables = [];
    const ide = new CharmsIDE();
    disposables.push(ide);
    await ide.refresh();

    context.subscriptions.push(...disposables);
}

export function deactivate() { }

class CharmsIDE implements vscode.Disposable {
    private _map = new Map<string, Charm>();

    constructor() {
    }

    dispose() {
        this._map.forEach(x => x.dispose());
    }

    async refresh() {
        const snapshot = new Map(this._map.entries());
        const newCharms: Charm[] = [];

        const uris = await findCharms();
        for (const u of uris) {
            const key = u.toString();
            if (snapshot.has(key)) {
                snapshot.delete(key);
                continue;
            }
            const charm = new Charm(u);
            this._map.set(key, charm);
            newCharms.push(charm);
        }

        // Some existing charms may no longer exist.
        if (snapshot.size) {
            snapshot.forEach(charm => charm.dispose());
        }

        await Promise.allSettled(newCharms.map(charm => charm.refresh()));
    }
}
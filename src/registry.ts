import { Disposable, EventEmitter, OutputChannel, Uri } from 'vscode';
import { ExtensionCharm } from './charm';
import * as constant from './model/constant';
import { findCharms } from './workspace';

export class CharmRegistry implements Disposable {
    private readonly _set = new Set<ExtensionCharm>();
    private readonly _disposablesPerCharm = new Map<ExtensionCharm, Disposable[]>();

    private readonly _onChanged = new EventEmitter<void>();
    readonly onChanged = this._onChanged.event;

    constructor(readonly output: OutputChannel) { }

    dispose() {
        this._onChanged.dispose();
        this._set.forEach(charm => this._removeAndDisposeCharm(charm));
    }

    private _removeAndDisposeCharm(charm: ExtensionCharm) {
        this._disposablesPerCharm.get(charm)?.forEach(x => x.dispose());
        this._disposablesPerCharm.delete(charm);
        charm.dispose();
        this._set.delete(charm);
    }

    getCharms() {
        return Array.from(this._set);
    }

    getCharmBySourceCodeFile(uri: Uri): { charm: ExtensionCharm; relativeSourcePath: string } | undefined {
        const located = this.getCharmByFile(uri);
        if (!located) {
            return undefined;
        }
        const prefix = constant.CHARM_DIR_SRC + '/';
        return located.relativePath.startsWith(prefix)
            ? { charm: located.charm, relativeSourcePath: located.relativePath.replace(prefix, '') }
            : undefined;
    }

    getCharmByFile(uri: Uri): { charm: ExtensionCharm; relativePath: string } | undefined {
        const u = uri.toString();
        for (const charm of this._set) {
            const home = charm.home.toString() + '/';
            if (u.startsWith(home)) {
                return {
                    charm: charm,
                    relativePath: u.replace(home, ''),
                };
            }
        }
        return undefined;
    }

    async refresh() {
        const snapshot = new Set(this._set);
        const snapshotUris = new Map(Array.from(snapshot).map(x => [x.home.toString(), x]));
        const initialKeys = Array.from(snapshotUris.keys());

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

        // Disposing of charms that no longer exist.
        if (snapshot.size) {
            snapshot.forEach(charm => {
                this._removeAndDisposeCharm(charm);
            });
        }

        await Promise.allSettled(newCharms.map(charm => charm.refresh()));

        const changed = this._set.size !== initialKeys.length || !initialKeys.every(x => x in initialKeys);
        if (changed) {
            this.output.appendLine(`registry refreshed (changes detected)`);
            this._onChanged.fire();
        } else {
            this.output.appendLine(`registry refreshed (no change)`);
        }
    }

    private _instantiateCharm(home: Uri): ExtensionCharm {
        const charm = new ExtensionCharm(home, this.output);
        this._disposablesPerCharm.set(charm, []);
        return charm;
    }
}

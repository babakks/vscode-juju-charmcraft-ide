import * as vscode from 'vscode';
import { Disposable, EventEmitter, OutputChannel, Uri } from 'vscode';
import * as constant from './model/common';
import { CHARM_FILE_CHARMCRAFT_YAML, CHARM_FILE_METADATA_YAML } from './model/common';
import { WorkspaceCharm } from './workspace';
import path = require('path');

/**
 * Registry of discovered charms.
 */
export class Registry implements Disposable {
    private readonly _set = new Set<WorkspaceCharm>();
    private readonly _disposablesPerCharm = new Map<WorkspaceCharm, Disposable[]>();

    private readonly _onChanged = new EventEmitter<void>();
    readonly onChanged = this._onChanged.event;

    constructor(readonly output: OutputChannel) { }

    dispose() {
        this._onChanged.dispose();
        this._set.forEach(charm => this._removeAndDisposeCharm(charm));
    }

    private _removeAndDisposeCharm(charm: WorkspaceCharm) {
        this._disposablesPerCharm.get(charm)?.forEach(x => x.dispose());
        this._disposablesPerCharm.delete(charm);
        charm.dispose();
        this._set.delete(charm);
    }

    getWorkspaceCharms() {
        return Array.from(this._set);
    }

    getCharms() {
        return Array.from(this._set).map(x => x.model);
    }

    getCharmBySourceCodeFile(uri: Uri): { workspaceCharm: WorkspaceCharm; relativeSourcePath: string } | { workspaceCharm: undefined; relativeSourcePath: undefined } {
        const { workspaceCharm: charm, relativePath } = this.getCharmByFile(uri);
        if (!charm) {
            return { workspaceCharm: undefined, relativeSourcePath: undefined };
        }
        const prefix = constant.CHARM_DIR_SRC + '/';
        return relativePath.startsWith(prefix)
            ? { workspaceCharm: charm, relativeSourcePath: relativePath.replace(prefix, '') }
            : { workspaceCharm: undefined, relativeSourcePath: undefined };
    }

    getCharmByFile(uri: Uri): { workspaceCharm: WorkspaceCharm; relativePath: string } | { workspaceCharm: undefined; relativePath: undefined; } {
        const u = uri.toString();
        for (const charm of this._set) {
            const home = charm.home.toString() + '/';
            if (u.startsWith(home)) {
                return {
                    workspaceCharm: charm,
                    relativePath: u.replace(home, ''),
                };
            }
        }
        return { workspaceCharm: undefined, relativePath: undefined };
    }

    async refresh() {
        const snapshot = new Set(this._set);
        const snapshotUris = new Map(Array.from(snapshot).map(x => [x.home.toString(), x]));
        const initialKeys = Array.from(snapshotUris.keys());

        const newCharms: WorkspaceCharm[] = [];
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

    private _instantiateCharm(home: Uri): WorkspaceCharm {
        const charm = new WorkspaceCharm(home, this.output);
        this._disposablesPerCharm.set(charm, []);
        return charm;
    }
}

const GLOB_METADATA = `**/${CHARM_FILE_METADATA_YAML}}`;

export async function findCharms(token?: vscode.CancellationToken): Promise<vscode.Uri[]> {
    const matches = await vscode.workspace.findFiles(GLOB_METADATA, undefined, undefined, token);
    const result: vscode.Uri[] = [];
    await Promise.allSettled(
        matches.map(async uri => {
            const parent = vscode.Uri.joinPath(uri, '..');
            if (await isCharmDirectory(parent)) {
                result.push(parent);
            }
        })
    );
    return result;
}

async function isCharmDirectory(uri: vscode.Uri): Promise<boolean> {
    return (await Promise.allSettled([
        vscode.workspace.fs.stat(vscode.Uri.joinPath(uri, CHARM_FILE_CHARMCRAFT_YAML)),
        vscode.workspace.fs.stat(vscode.Uri.joinPath(uri, CHARM_FILE_METADATA_YAML)),
    ])).every(x => x.status === 'fulfilled' && x.value.type === vscode.FileType.File);
}

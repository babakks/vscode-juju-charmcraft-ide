import { Disposable, EventEmitter, OutputChannel, Uri, DiagnosticCollection, CancellationToken, workspace, FileType } from 'vscode';
import * as constant from './model/common';
import { CHARM_FILE_CHARMCRAFT_YAML, CHARM_FILE_METADATA_YAML } from './model/common';
import { WorkspaceCharm } from './workspace';

/**
 * Registry of discovered charms.
 */
export class Registry implements Disposable {
    private readonly _set = new Set<WorkspaceCharm>();
    private readonly _disposablesPerCharm = new Map<WorkspaceCharm, Disposable[]>();

    private _activeCharm: WorkspaceCharm | undefined = undefined;

    private readonly _onActiveCharmChanged = new EventEmitter<void>();
    readonly onActiveCharmChanged = this._onActiveCharmChanged.event;

    private readonly _onChanged = new EventEmitter<void>();
    readonly onChanged = this._onChanged.event;

    private readonly _onCharmVirtualEnvChanged = new EventEmitter<WorkspaceCharm>();
    /**
     * A de-mux/aggregator event for {@link WorkspaceCharm.onVirtualEnvChanged} event.
     */
    readonly onCharmVirtualEnvChanged = this._onCharmVirtualEnvChanged.event;

    private readonly _onCharmConfigChanged = new EventEmitter<WorkspaceCharm>();
    /**
     * A de-mux/aggregator event for {@link WorkspaceCharm.onConfigChanged} event.
     */
    readonly onCharmConfigChanged = this._onCharmConfigChanged.event;

    private readonly _onCharmActionsChanged = new EventEmitter<WorkspaceCharm>();
    /**
     * A de-mux/aggregator event for {@link WorkspaceCharm.onActionsChanged} event.
     */
    readonly onCharmActionsChanged = this._onCharmActionsChanged.event;

    private readonly _onCharmMetadataChanged = new EventEmitter<WorkspaceCharm>();
    /**
     * A de-mux/aggregator event for {@link WorkspaceCharm.onMetadataChanged} event.
     */
    readonly onCharmMetadataChanged = this._onCharmMetadataChanged.event;

    private readonly _onCharmToxConfigChanged = new EventEmitter<WorkspaceCharm>();
    /**
     * A de-mux/aggregator event for {@link WorkspaceCharm.onToxConfigChanged} event.
     */
    readonly onCharmToxConfigChanged = this._onCharmToxConfigChanged.event;

    constructor(readonly output: OutputChannel, readonly diagnostics: DiagnosticCollection) { }

    dispose() {
        this._onChanged.dispose();
        this._set.forEach(charm => this._removeAndDisposeCharm(charm));
    }

    private _removeAndDisposeCharm(charm: WorkspaceCharm) {
        this._disposablesPerCharm.get(charm)?.forEach(x => x.dispose());
        this._disposablesPerCharm.delete(charm);
        charm.dispose();
        this._set.delete(charm);
        if (this._activeCharm === charm) {
            this.setActiveCharm(undefined);
        }
    }

    getActiveCharm(): WorkspaceCharm | undefined {
        return this._activeCharm;
    }

    setActiveCharm(workspaceCharm: WorkspaceCharm | undefined) {
        this._activeCharm = workspaceCharm;
        this._onActiveCharmChanged.fire();
    }

    getWorkspaceCharms() {
        return Array.from(this._set);
    }

    getCharms() {
        return Array.from(this._set).map(x => x.model);
    }

    getCharmBySourceCodeFile(uri: Uri): { workspaceCharm: WorkspaceCharm; relativePath: string } | { workspaceCharm: undefined; relativePath: undefined } {
        const { workspaceCharm, relativePath } = this.getCharmByFile(uri);
        return workspaceCharm && relativePath !== undefined
            ? { workspaceCharm, relativePath }
            : { workspaceCharm: undefined, relativePath: undefined };
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
        const charm = new WorkspaceCharm(home, this.output, this.diagnostics);
        this._disposablesPerCharm.set(charm, [
            charm.onVirtualEnvChanged(() => this._onCharmVirtualEnvChanged.fire(charm)),
            charm.onConfigChanged(() => this._onCharmConfigChanged.fire(charm)),
            charm.onActionsChanged(() => this._onCharmActionsChanged.fire(charm)),
            charm.onMetadataChanged(() => this._onCharmMetadataChanged.fire(charm)),
            charm.onToxConfigChanged(() => this._onCharmToxConfigChanged.fire(charm)),
        ]);
        return charm;
    }
}

const GLOB_METADATA = `**/${CHARM_FILE_METADATA_YAML}}`;

export async function findCharms(token?: CancellationToken): Promise<Uri[]> {
    const matches = await workspace.findFiles(GLOB_METADATA, undefined, undefined, token);
    const result: Uri[] = [];
    await Promise.allSettled(
        matches.map(async uri => {
            const parent = Uri.joinPath(uri, '..');
            if (await isCharmDirectory(parent)) {
                result.push(parent);
            }
        })
    );
    return result;
}

async function isCharmDirectory(uri: Uri): Promise<boolean> {
    return (await Promise.allSettled([
        workspace.fs.stat(Uri.joinPath(uri, CHARM_FILE_CHARMCRAFT_YAML)),
        workspace.fs.stat(Uri.joinPath(uri, CHARM_FILE_METADATA_YAML)),
    ])).every(x => x.status === 'fulfilled' && x.value.type === FileType.File);
}

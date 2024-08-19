import TelemetryReporter from '@vscode/extension-telemetry';
import {
    CancellationToken,
    DiagnosticCollection,
    Disposable,
    EventEmitter,
    FileType,
    OutputChannel,
    Uri,
    workspace,
} from 'vscode';
import { ConfigManager, WorkspaceConfig } from './config';
import { CHARM_FILE_CHARMCRAFT_YAML, CHARM_FILE_METADATA_YAML, CHARM_FILE_TOX_INI } from './model/common';
import { BackgroundWorkerManager } from './worker';
import { WorkspaceCharm, WorkspaceCharmConfig } from './workspace';

/**
 * Registry of discovered charms.
 */
export class Registry implements Disposable {
    private readonly _disposables: Disposable[] = [];

    private readonly _set = new Set<WorkspaceCharm>();
    private readonly _disposablesPerCharm = new Map<WorkspaceCharm, Disposable[]>();

    private _activeCharm: WorkspaceCharm | undefined = undefined;

    private readonly _onActiveCharmChanged = new EventEmitter<void>();
    readonly onActiveCharmChanged = this._onActiveCharmChanged.event;

    private readonly _onChanged = new EventEmitter<void>();
    /**
     * Fires when charms change (e.g., a new charm is added/removed).
     */
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

    constructor(
        readonly configManager: ConfigManager,
        readonly backgroundWorkerManager: BackgroundWorkerManager,
        readonly output: OutputChannel,
        readonly reporter: TelemetryReporter,
        readonly diagnostics: DiagnosticCollection,
        readonly lintDiagnostics: DiagnosticCollection,
    ) {
        this._disposables.push(
            this.configManager.onChanged(async () => {
                this._reset();
                await this.refresh();
            })
        );
    }

    dispose() {
        this._disposeCharms();
        this._disposables.forEach(x => x.dispose());
        this._onActiveCharmChanged.dispose();
        this._onCharmVirtualEnvChanged.dispose();
        this._onCharmConfigChanged.dispose();
        this._onCharmActionsChanged.dispose();
        this._onCharmMetadataChanged.dispose();
        this._onCharmToxConfigChanged.dispose();
        this._onChanged.dispose();
    }

    private _disposeCharms() {
        this._set.forEach(charm => this._removeAndDisposeCharm(charm));
    }

    private _reset() {
        this.setActiveCharm(undefined);
        this._disposeCharms();
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

    /**
     * Locates corresponding charm for a given URI which could point to either a
     * file or a directory.
     * @returns Corresponding charm and the path of the given URI relative to
     * the charm. Note that, independent of the platform, the relative path is
     * separated by `/` (forward slash).
     */
    getCharmByUri(uri: Uri): { workspaceCharm: WorkspaceCharm; relativePath: string } | { workspaceCharm: undefined; relativePath: undefined } {
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
        const config = this.configManager.getLatest();
        const uris = await findCharms(undefined, config.ignore);
        for (const u of uris) {
            const key = u.toString();
            if (snapshotUris.has(key)) {
                snapshot.delete(snapshotUris.get(key)!);
                snapshotUris.delete(key);
                continue;
            }
            const workspaceCharmConfig = getCharmSpecificConfig(config, u);
            const charm = this._instantiateCharm(u, workspaceCharmConfig);
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

    private _instantiateCharm(home: Uri, workspaceCharmConfig?: WorkspaceCharmConfig): WorkspaceCharm {
        const charm = new WorkspaceCharm(home, this.backgroundWorkerManager, this.output, this.reporter, this.diagnostics, this.lintDiagnostics, workspaceCharmConfig);
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

function getCharmSpecificConfig(config: WorkspaceConfig, charmHome: Uri): WorkspaceCharmConfig {
    const relativeHome = workspace.asRelativePath(charmHome);
    const overrideKey = Object.keys(config?.override ?? {}).find(k => k === relativeHome || relativeHome.startsWith(k + '/'));
    const override = overrideKey !== undefined ? config.override![overrideKey] : undefined;

    const result: WorkspaceCharmConfig = {};

    const virtualEnvDirectory = override?.virtualEnvDirectory !== undefined ? override.virtualEnvDirectory
        : config.defaultVirtualEnvDirectory !== undefined ? config.defaultVirtualEnvDirectory : undefined;
    if (virtualEnvDirectory !== undefined) {
        result.virtualEnvDirectory = virtualEnvDirectory;
    }

    const runLintOnSave = override?.runLintOnSave && config.runLintOnSave ? { ...config.runLintOnSave, ...override.runLintOnSave }
        : (override?.runLintOnSave ?? config.runLintOnSave);
    if (runLintOnSave !== undefined) {
        result.runLintOnSave = runLintOnSave;
    }

    return result;
}

const GLOB_METADATA = `**/${CHARM_FILE_METADATA_YAML}}`;

export async function findCharms(token?: CancellationToken, ignorePattern?: string): Promise<Uri[]> {
    const matches = await workspace.findFiles(GLOB_METADATA, ignorePattern, undefined, token);
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

/**
 * Determines whether a given URI is charm directory. A directory is considered
 * to be a charm directory if at least one of the following is true:
 *
 *   - Contains `charmcraft.yaml`.
 *   - Contains both `metadata.yaml` and `tox.ini`.
 *
 */
async function isCharmDirectory(uri: Uri): Promise<boolean> {
    const files = {
        [CHARM_FILE_CHARMCRAFT_YAML]: false,
        [CHARM_FILE_METADATA_YAML]: false,
        [CHARM_FILE_TOX_INI]: false,
    };

    const checkFile = async (filename: keyof typeof files) => {
        const stat = await workspace.fs.stat(Uri.joinPath(uri, filename));
        files[filename] = stat.type === FileType.File;
    };

    await Promise.allSettled((Object.keys(files) as (keyof typeof files)[]).map(x => checkFile(x)));
    return files[CHARM_FILE_CHARMCRAFT_YAML] || files[CHARM_FILE_METADATA_YAML] && files[CHARM_FILE_TOX_INI];
}

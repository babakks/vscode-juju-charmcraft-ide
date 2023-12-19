import { Disposable, EventEmitter, workspace } from 'vscode';

/**
 * Workspace/global-scoped configuration parameters.
 */
export interface WorkspaceConfig {
    /**
     * Relative Glob pattern of path of charms to ignore.
     */
    ignore?: string;

    /**
     * Default directory name to setup/detect virtual environments.
     */
    defaultVirtualEnvDirectory?: string;

    /**
     * Charm-specific overrides. Keys are relative paths of charm directories or
     * their parent directories.
     * 
     * Note that leading `./` and trailing `/` are removed.
     */
    override?: {
        [key: string]: WorkspaceOverrideConfig;
    };
}

export interface WorkspaceOverrideConfig {
    virtualEnvDirectory?: string;
}

const CONFIG_SECTION = 'charmcraft-ide';
const CONFIG_KEY_IGNORE = 'ignore';
const CONFIG_KEY_DEFAULT_VENV_DIR = 'defaultVirtualEnvDirectory';
const CONFIG_KEY_OVERRIDE = 'override';
const CONFIG_KEY_OVERRIDE_VENV_DIR = 'virtualEnvDirectory';

export class ConfigManager implements Disposable {
    private readonly _disposables: Disposable[] = [];

    private _onChanged = new EventEmitter<void>();
    /**
     * Fires when extension configuration changes.
     */
    readonly onChanged = this._onChanged.event;

    constructor() {
        this._disposables.push(
            workspace.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration(CONFIG_SECTION)) {
                    this._onChanged.fire();
                }
            }),
            workspace.onDidChangeWorkspaceFolders(e => {
                if (e.added.length || e.removed.length) {
                    this._onChanged.fire();
                }
            })
        );
    }

    dispose() {
        this._disposables.forEach(x => x.dispose());
        this._onChanged.dispose();
    }

    /**
     * Returns latest config of the extension.
     */
    getLatest(): WorkspaceConfig {
        const config = workspace.getConfiguration(CONFIG_SECTION);
        return {
            ignore: config.get<string>(CONFIG_KEY_IGNORE),
            defaultVirtualEnvDirectory: config.get<string>(CONFIG_KEY_DEFAULT_VENV_DIR),
            override: loadOverride(),
        };

        function loadOverride(): WorkspaceConfig['override'] {
            const map = config.get<{ [key: string]: { [key: string]: any } }>(CONFIG_KEY_OVERRIDE);
            if (!map) {
                return undefined;
            }
            const result: WorkspaceConfig['override'] = {};
            for (const [k, v] of Object.entries(map)) {
                result[sanitizeKey(k)] = {
                    virtualEnvDirectory: v[CONFIG_KEY_OVERRIDE_VENV_DIR],
                };
            }
            return result;

            function sanitizeKey(k: string): string {
                let result = k.trim();
                if (result.startsWith('./')) {
                    result = result.substring(2);
                } else if (result.startsWith('/')) {
                    result = result.substring(1);
                }
                if (result.endsWith('/')) {
                    result = result.substring(0, -1 + result.length);
                }
                return result;
            }
        };
    }
}

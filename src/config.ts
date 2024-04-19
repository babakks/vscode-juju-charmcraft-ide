import { Disposable, EventEmitter, workspace, type WorkspaceConfiguration } from 'vscode';

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

    runLintOnSave?: WorkspaceRunLintOnSaveConfig;

    /**
     * Configurations specific to charm testing features.
     */
    test: WorkspaceTestConfig;

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

/**
 * Configurations related to charm testing features.
 */
export interface WorkspaceTestConfig {
    /**
     * Custom fields to include in launch configuration when debugging tests.
     */
    customDebugLaunchConfig?: { [key: string]: any }
}

export interface WorkspaceRunLintOnSaveConfig {
    enabled?: boolean

    /**
     * Array of linting-related Tox environments (sections, e.g.,
     * `['testenv:lint']`) to run on save.
     */
    tox?: string[];

    /**
     * Array of linting-related commands to run on save.
     */
    commands?: string[];

    /**
     * Array of linters to exclude their diagnostics; for example, `['flake8']`.
     */
    exclude?: string[];

    /**
     * Array of linters to include their diagnostics and exclude other linters';
     * for example, `['flake8']`.
     */
    include?: string[];
}

export interface WorkspaceOverrideConfig {
    virtualEnvDirectory?: string;
    runLintOnSave?: WorkspaceRunLintOnSaveConfig;
}

const CONFIG_SECTION = 'charmcraft-ide';
const CONFIG_KEY_IGNORE = 'ignore';
const CONFIG_KEY_DEFAULT_VENV_DIR = 'defaultVirtualEnvDirectory';
const CONFIG_KEY_RUN_LINT_ON_SAVE = 'runLintOnSave';
const CONFIG_KEY_OVERRIDE = 'override';
const CONFIG_KEY_OVERRIDE_VENV_DIR = 'virtualEnvDirectory';
const CONFIG_KEY_OVERRIDE_RUN_LINT_ON_SAVE = 'runLintOnSave';

const CONFIG_SECTION_TEST = 'charmcraft-ide.test';
const CONFIG_KEY_TEST_DEBUG_CUSTOM_LAUNCH_CONFIG = 'customDebugLaunchConfig';

const CONFIG_SUBKEY_RUN_LINT_ON_SAVE_ENABLED = 'enabled';
const CONFIG_SUBKEY_RUN_LINT_ON_SAVE_TOX = 'tox';
const CONFIG_SUBKEY_RUN_LINT_ON_SAVE_COMMANDS = 'commands';
const CONFIG_SUBKEY_RUN_LINT_ON_SAVE_EXCLUDE = 'exclude';
const CONFIG_SUBKEY_RUN_LINT_ON_SAVE_INCLUDE = 'include';

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
        const testConfig = workspace.getConfiguration(CONFIG_SECTION_TEST);

        const result: WorkspaceConfig = {
            test: {},
        };

        /*
         * Note that here to avoid putting default values in more than one
         * place (i.e., in configuration schema inside `package.json`), we need
         * to read parameters with a custom function.
         *
         * Also note that `config.get` method returns empty/zero for parameters
         * that don't have a pre-defined default value in configuration schema.
         */

        const ignore = optionalString(readParameterIgnoreDefault(CONFIG_KEY_IGNORE));
        if (ignore !== undefined) {
            result.ignore = ignore;
        }

        const defaultVirtualEnvDirectory = optionalString(readParameterIgnoreDefault(CONFIG_KEY_DEFAULT_VENV_DIR));
        if (defaultVirtualEnvDirectory !== undefined) {
            result.defaultVirtualEnvDirectory = defaultVirtualEnvDirectory;
        }

        const runLintOnSave = parseRunLintOnSave(readParameterIgnoreDefault(CONFIG_KEY_RUN_LINT_ON_SAVE));
        if (runLintOnSave !== undefined) {
            result.runLintOnSave = runLintOnSave;
        }

        const customDebugLaunchConfig = optionalStringMap(readParameterIgnoreDefault(
            CONFIG_KEY_TEST_DEBUG_CUSTOM_LAUNCH_CONFIG,
            testConfig,
        ));
        if (customDebugLaunchConfig !== undefined) {
            result.test.customDebugLaunchConfig = customDebugLaunchConfig;
        }

        const override = loadOverride(readParameterIgnoreDefault(CONFIG_KEY_OVERRIDE));
        if (override !== undefined) {
            result.override = override;
        }

        return result;

        function loadOverride(raw: any): WorkspaceConfig['override'] {
            if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
                return undefined;
            }
            const result: WorkspaceConfig['override'] = {};
            for (const k of Object.keys(raw)) {
                const v = raw[k] as any;
                if (!v || typeof v !== 'object' || Array.isArray(v)) {
                    continue;
                }

                const entry: WorkspaceOverrideConfig = {};

                const virtualEnvDirectory = optionalString(v[CONFIG_KEY_OVERRIDE_VENV_DIR]);
                if (virtualEnvDirectory !== undefined) {
                    entry.virtualEnvDirectory = virtualEnvDirectory;
                }

                const runLintOnSave = parseRunLintOnSave(v[CONFIG_KEY_OVERRIDE_RUN_LINT_ON_SAVE]);
                if (runLintOnSave !== undefined) {
                    entry.runLintOnSave = runLintOnSave;
                }

                result[sanitizeKey(k)] = entry;
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

        function parseRunLintOnSave(raw: any): WorkspaceRunLintOnSaveConfig | undefined {
            if (typeof raw !== 'object' || Array.isArray(raw)) {
                return undefined;
            }

            const result: WorkspaceRunLintOnSaveConfig = {};

            const enabled = optionalBoolean(raw[CONFIG_SUBKEY_RUN_LINT_ON_SAVE_ENABLED]);
            if (enabled !== undefined) {
                result.enabled = enabled;
            }

            const tox = optionalStringArray(raw[CONFIG_SUBKEY_RUN_LINT_ON_SAVE_TOX]);
            if (tox !== undefined) {
                result.tox = tox;
            }

            const commands = optionalStringArray(raw[CONFIG_SUBKEY_RUN_LINT_ON_SAVE_COMMANDS]);
            if (commands !== undefined) {
                result.commands = commands;
            }

            const include = optionalStringArray(raw[CONFIG_SUBKEY_RUN_LINT_ON_SAVE_INCLUDE]);
            if (include !== undefined) {
                result.include = include;
            }

            const exclude = optionalStringArray(raw[CONFIG_SUBKEY_RUN_LINT_ON_SAVE_EXCLUDE]);
            if (exclude !== undefined) {
                result.exclude = exclude;
            }
            return result;
        };

        function optionalBoolean(v: any): boolean | undefined {
            return typeof v === 'boolean' ? v : undefined;
        }

        function optionalString(v: any): string | undefined {
            return typeof v === 'string' ? v : undefined;
        }

        function optionalStringArray(v: any): string[] | undefined {
            return typeof v === 'object' && Array.isArray(v) ? v : undefined;
        }

        function optionalStringMap(v: any): { [key: string]: any } | undefined {
            return typeof v === 'object' && !Array.isArray(v) ? v : undefined;
        }

        function readParameterIgnoreDefault(key: string, c?: WorkspaceConfiguration): any {
            const i = (c ?? config).inspect(key);
            return i?.workspaceValue ?? i?.globalValue;
        }
    }
}

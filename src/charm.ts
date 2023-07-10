import * as yaml from 'js-yaml';
import * as vscode from 'vscode';
import { Disposable, Uri } from 'vscode';
import { CharmConfig, CharmConfigParameter, CharmConfigParameterProblem, CharmEvent } from './charmTypes';
import { parseCharmConfigYAML } from './charmConfig';
import { CHARM_FILE_CONFIG_YAML, CHARM_FILE_METADATA_YAML } from './constant';
import { tryReadWorkspaceFileAsText } from './util';

const WATCH_GLOB_PATTERN = `{${CHARM_FILE_CONFIG_YAML},${CHARM_FILE_METADATA_YAML}}`;

const CHARM_LIFECYCLE_EVENTS: CharmEvent[] = [
    Object.freeze({ name: 'start', description: 'fired as soon as the unit initialization is complete.' }),
    Object.freeze({ name: 'config_changed', description: 'fired whenever the cloud admin changes the charm configuration *.' }),
    Object.freeze({ name: 'install', description: 'fired when juju is done provisioning the unit.' }),
    Object.freeze({ name: 'leader_elected', description: 'fired on the new leader when juju elects one.' }),
    Object.freeze({ name: 'leader_settings_changed', description: 'fired on all follower units when a new leader is chosen.' }),
    Object.freeze({ name: 'pre_series_upgrade', description: 'fired before the series upgrade takes place.' }),
    Object.freeze({ name: 'post_series_upgrade', description: 'fired after the series upgrade has taken place.' }),
    Object.freeze({ name: 'stop', description: 'fired before the unit begins deprovisioning.' }),
    Object.freeze({ name: 'remove', description: 'fired just before the unit is deprovisioned.' }),
    Object.freeze({ name: 'update_status', description: 'fired automatically at regular intervals by juju.' }),
    Object.freeze({ name: 'upgrade_charm', description: 'fired when the cloud admin upgrades the charm.' }),
    Object.freeze({ name: 'collect_metrics', description: '(deprecated, will be removed soon)' }),
];

const CHARM_SECRET_EVENTS = [
    'secret_changed',
    'secret_expired',
    'secret_remove',
    'secret_rotate',
];

const CHARM_RELATION_EVENTS_SUFFIX = [
    `_relation_broken`,
    `_relation_changed`,
    `_relation_created`,
    `_relation_departed`,
    `_relation_joined`,
];

const CHARM_STORAGE_EVENTS_SUFFIX = [
    `_storage_attached`,
    `_storage_detaching`,
];

const CHARM_CONTAINER_EVENT_SUFFIX = [
    '_pebble_ready',
];

const CHARM_ACTION_EVENT_SUFFIX = [
    '_action'
];

export class Charm implements Disposable {
    private _disposables: Disposable[] = [];
    private readonly watcher: vscode.FileSystemWatcher;
    private _config: CharmConfig = { parameters: [], problems: [] };

    readonly configURI: vscode.Uri;
    readonly metadataURI: vscode.Uri;

    private readonly _onConfigChanged = new vscode.EventEmitter<void>();
    readonly onConfigChanged = this._onConfigChanged.event;

    private readonly _onMetadataChanged = new vscode.EventEmitter<void>();
    readonly onMetadataChanged = this._onMetadataChanged.event;

    constructor(readonly home: Uri) {
        this._disposables.push(
            this.watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(home, WATCH_GLOB_PATTERN)),
            this.watcher.onDidChange(async e => await this._onFileSystemEvent('change', e)),
            this.watcher.onDidCreate(async e => await this._onFileSystemEvent('create', e)),
            this.watcher.onDidDelete(async e => await this._onFileSystemEvent('delete', e)),
        );

        this.configURI = vscode.Uri.joinPath(home, CHARM_FILE_CONFIG_YAML);
        this.metadataURI = vscode.Uri.joinPath(home, CHARM_FILE_METADATA_YAML);
    }

    dispose() {
        this._disposables.forEach(x => x.dispose());
    }

    get config() {
        return this._config;
    }

    get events() {
        // TODO include other events
        return Array.from(CHARM_LIFECYCLE_EVENTS);
    }

    private async _onFileSystemEvent(kind: 'change' | 'create' | 'delete', uri: vscode.Uri) {
        if (uri.path.endsWith(CHARM_FILE_CONFIG_YAML)) {
            await this._refreshConfig();
        } else if (uri.path.endsWith(CHARM_FILE_METADATA_YAML)) {
            await this._refreshMetadata();
        }
    }

    async refresh() {
        await Promise.allSettled([
            this._refreshConfig(),
            this._refreshMetadata(),
        ]);
    }

    private async _refreshConfig() {
        const uri = vscode.Uri.joinPath(this.home, CHARM_FILE_CONFIG_YAML);
        const content = await tryReadWorkspaceFileAsText(uri);
        if (content === undefined) {
            this._config = { parameters: [], problems: [] };
            return;
        }
        this._config = await parseCharmConfigYAML(content);
        this._onConfigChanged.fire();
    }

    private async _refreshMetadata() {
        this._onMetadataChanged.fire();
    }
}


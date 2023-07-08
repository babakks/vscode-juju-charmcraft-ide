import * as vscode from 'vscode';
import { Uri, Disposable } from 'vscode';
import * as yaml from 'js-yaml';
import { tryReadWorkspaceFileAsText } from './util';
import { CharmConfigParameter, CharmConfigParameterProblem, parseCharmConfigYAML } from './charmConfig';

export type ConfigParameterType = 'string' | 'int' | 'float' | 'boolean';
function isConfigParameterType(value: string): value is ConfigParameterType {
    return value === 'string' || value === 'int' || value === 'float' || value === 'boolean';
}

export interface ConfigParameter {
    type: ConfigParameterType;
    description?: string;
    default?: string | number | boolean;
}

const WATCH_GLOB_PATTERN = 'metadata.yaml,config.yaml';
const FILE_CONFIG_YAML = 'config.yaml';
const FILE_METADATA_YAML = 'metadata.yaml';
export class Charm implements Disposable {
    private _disposables: Disposable[] = [];
    private readonly watcher: vscode.FileSystemWatcher;
    private _configParams: CharmConfigParameter[] = [];
    private _configProblems: CharmConfigParameterProblem[] = [];

    constructor(readonly home: Uri) {
        this._disposables.push(
            this.watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(home, WATCH_GLOB_PATTERN)),
            this.watcher.onDidChange(async e => await this._onFileSystemEvent('change', e)),
            this.watcher.onDidCreate(async e => await this._onFileSystemEvent('create', e)),
            this.watcher.onDidDelete(async e => await this._onFileSystemEvent('delete', e)),
        );
    }

    dispose() {
        this._disposables.forEach(x => x.dispose());
    }

    private async _onFileSystemEvent(kind: 'change' | 'create' | 'delete', uri: vscode.Uri) {
        if (uri.path.endsWith(FILE_CONFIG_YAML)) {
            await this._refreshConfig();
        } else if (uri.path.endsWith(FILE_METADATA_YAML)) {
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
        const uri = vscode.Uri.joinPath(this.home, FILE_CONFIG_YAML);
        const content = await tryReadWorkspaceFileAsText(uri);
        if (content === undefined) {
            this._configParams = [];
            this._configProblems = [];
            return;
        }
        [this._configParams, this._configProblems] = await parseCharmConfigYAML(content);
    }

    private async _refreshMetadata() {
    }
}


import TelemetryReporter from "@vscode/extension-telemetry";
import { basename } from "path";
import {
    Disposable,
    EventEmitter,
    ProviderResult,
    ThemeIcon,
    TreeDataProvider,
    TreeItem,
    TreeItemCollapsibleState,
    type Uri
} from "vscode";
import type { Range } from "./model/common";
import { Registry } from "./registry";
import { rangeToVSCodeRange } from "./util";
import { WorkspaceCharm } from "./workspace";
import type { CharmAction, CharmConfigOption } from "./model/charm";

type TreeItemModel =
    NoCharmTreeItemModel
    | CharmTreeItemModel
    | NoVirtualEnvWarningTreeItemModel
    | ConfigTreeItemModel
    | ConfigOptionTreeItemModel
    | ActionsTreeItemModel
    | ActionItemTreeItemModel
    | MetadataTreeItemModel
    | CharmcraftTreeItemModel
    | ToxConfigTreeItemModel
    | ToxConfigEnvTreeItemModel;

type WithWorkspaceCharm = {
    workspaceCharm: WorkspaceCharm;
};

export type NoCharmTreeItemModel = {
    kind: 'noCharmDetected';
};

export type CharmTreeItemModel = WithWorkspaceCharm & {
    kind: 'charm';
};

export type NoVirtualEnvWarningTreeItemModel = WithWorkspaceCharm & {
    kind: 'noVirtualEnvWarning';
};

export type ConfigTreeItemModel = WithWorkspaceCharm & {
    kind: 'config';
    uri: Uri | undefined;
};

export type ConfigOptionTreeItemModel = WithWorkspaceCharm & {
    kind: 'configOption';
    name: string;
    type: string | undefined;
    uri: Uri | undefined;
    range: Range | undefined;
};

export type ActionsTreeItemModel = WithWorkspaceCharm & {
    kind: 'actions';
    uri: Uri | undefined;
};

export type ActionItemTreeItemModel = WithWorkspaceCharm & {
    kind: 'actionItem';
    name: string;
    uri: Uri | undefined;
    range: Range | undefined;
};

export type MetadataTreeItemModel = WithWorkspaceCharm & {
    kind: 'metadata';
};

export type CharmcraftTreeItemModel = WithWorkspaceCharm & {
    kind: 'charmcraft';
};

export type ToxConfigTreeItemModel = WithWorkspaceCharm & {
    kind: 'tox';
};

export type ToxConfigEnvTreeItemModel = WithWorkspaceCharm & {
    kind: 'toxEnv';
    /**
     * For example, `testenv:lint`,
     */
    section: string;
    /**
     * For example, `testenv`,
     */
    group: string;
    /**
     * For example, `lint`,
     */
    env: string;
    command: string;
};

export class CharmcraftTreeDataProvider implements TreeDataProvider<TreeItemModel>, Disposable {
    private readonly _disposables: Disposable[] = [];

    private readonly _onDidChangeTreeData = new EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(readonly registry: Registry, readonly reporter: TelemetryReporter) {
        this._disposables.push(
            this.registry.onChanged(() => this.triggerRefresh()),
            this.registry.onCharmConfigChanged(() => this.triggerRefresh()),
            this.registry.onCharmVirtualEnvChanged(() => this.triggerRefresh()),
            this.registry.onCharmActionsChanged(() => this.triggerRefresh()),
            this.registry.onCharmMetadataChanged(() => this.triggerRefresh()),
            this.registry.onCharmCharmcraftChanged(() => this.triggerRefresh()),
            this.registry.onCharmToxConfigChanged(() => this.triggerRefresh()),
            this.registry.onActiveCharmChanged(() => this.triggerRefresh()),
        );
    }

    dispose() {
        this._disposables.forEach(x => x.dispose());
        this._onDidChangeTreeData.dispose();
    }

    triggerRefresh() {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TreeItemModel): TreeItem | Thenable<TreeItem> {
        if (element.kind === 'noCharmDetected') {
            const item = new TreeItem("No Charms Detected");
            item.iconPath = new ThemeIcon('info');
            item.collapsibleState = TreeItemCollapsibleState.None;
            return item;
        }

        if (element.kind === 'charm') {
            const isActive = this.registry.getActiveCharm() === element.workspaceCharm;

            const item = new TreeItem(getWorkspaceCharmLabel(element.workspaceCharm));
            item.resourceUri = element.workspaceCharm.home;
            item.id = item.resourceUri.fsPath;
            item.iconPath = isActive ? new ThemeIcon('pass-filled') : new ThemeIcon('package');
            item.description = isActive ? "Activated" : undefined;
            item.collapsibleState = TreeItemCollapsibleState.Expanded;
            item.contextValue = 'charm';
            return item;
        }

        if (element.kind === 'noVirtualEnvWarning') {
            const item = new TreeItem("No Virtual Environment Detected");
            item.iconPath = new ThemeIcon('warning');
            item.collapsibleState = TreeItemCollapsibleState.None;
            item.contextValue = 'noVirtualEnvWarning';
            return item;
        }


        if (element.kind === 'config') {
            const item = new TreeItem('Config');
            item.resourceUri = element.uri;
            item.id = element.uri?.fsPath;
            item.iconPath = new ThemeIcon('gear');
            item.collapsibleState = TreeItemCollapsibleState.Collapsed;
            item.contextValue = 'config';
            if (element.uri) {
                item.tooltip = `Open ${basename(element.uri.fsPath)}`;
                item.command = {
                    title: 'Open',
                    command: 'vscode.open',
                    arguments: [element.uri],
                };
            }
            return item;
        }

        if (element.kind === 'configOption') {
            const item = new TreeItem(element.name);
            item.id = (element.uri?.fsPath ?? '') + "?option=" + element.name;
            item.description = element.type;
            item.iconPath = new ThemeIcon('gear');
            item.collapsibleState = TreeItemCollapsibleState.None;
            if(element.uri) {
                item.tooltip = 'Go to definition';
                item.command = {
                    title: 'Open',
                    command: 'vscode.open',
                    arguments: [
                        element.uri,
                        ...(element.range ? [{ selection: rangeToVSCodeRange(element.range) }] : []),
                    ],
                };
            }
            return item;
        }

        if (element.kind === 'actions') {
            const item = new TreeItem('Actions');
            item.resourceUri = element.uri;
            item.id = element.uri?.fsPath;
            item.iconPath = new ThemeIcon('wrench');
            item.collapsibleState = TreeItemCollapsibleState.Collapsed;
            item.contextValue = 'actions';
            if (element.uri) {
                item.tooltip = `Open ${basename(element.uri.fsPath)}`;
                item.command = {
                    title: 'Open',
                    command: 'vscode.open',
                    arguments: [element.uri],
                };
            }
            return item;
        }

        if (element.kind === 'actionItem') {
            const item = new TreeItem(element.name);
            item.id = (element.uri?.fsPath ?? '') + "?action=" + element.name;
            item.iconPath = new ThemeIcon('wrench');
            item.collapsibleState = TreeItemCollapsibleState.None;
            if(element.uri) {
                item.tooltip = 'Go to definition';
                item.command = {
                    title: 'Open',
                    command: 'vscode.open',
                    arguments: [
                        element.uri,
                        ...(element.range ? [{ selection: rangeToVSCodeRange(element.range) }] : []),
                    ],
                };
            }
            return item;
        }

        if (element.kind === 'metadata') {
            const item = new TreeItem('Metadata');
            item.resourceUri = element.workspaceCharm.metadataUri;
            item.id = item.resourceUri.fsPath;
            item.iconPath = new ThemeIcon('info');
            item.collapsibleState = TreeItemCollapsibleState.None;
            item.contextValue = 'metadata';
            item.tooltip = 'Open metadata.yaml';
            item.command = {
                title: 'Open',
                command: 'vscode.open',
                arguments: [element.workspaceCharm.metadataUri],
            };
            return item;
        }

        if (element.kind === 'charmcraft') {
            const item = new TreeItem('Charmcraft');
            item.resourceUri = element.workspaceCharm.charmcraftUri;
            item.id = item.resourceUri.fsPath;
            item.iconPath = new ThemeIcon('info');
            item.collapsibleState = TreeItemCollapsibleState.None;
            item.contextValue = 'charmcraft';
            item.tooltip = 'Open charmcraft.yaml';
            item.command = {
                title: 'Open',
                command: 'vscode.open',
                arguments: [element.workspaceCharm.charmcraftUri],
            };
            return item;
        }

        if (element.kind === 'tox') {
            const item = new TreeItem('Tox');
            item.resourceUri = element.workspaceCharm.toxConfigUri;
            item.id = item.resourceUri.fsPath;
            item.iconPath = new ThemeIcon('zap');
            item.collapsibleState = TreeItemCollapsibleState.Expanded;
            item.contextValue = 'tox';
            item.tooltip = 'Open tox.ini';
            item.command = {
                title: 'Open',
                command: 'vscode.open',
                arguments: [element.workspaceCharm.toxConfigUri],
            };
            return item;
        }

        if (element.kind === 'toxEnv') {
            let label = element.env;
            let iconPath = new ThemeIcon('zap');
            if (element.section === 'testenv:lint') {
                label = "Lint (lint)";
                iconPath = new ThemeIcon("jersey");
            } else if (element.section === 'testenv:fmt') {
                label = "Format (fmt)";
                iconPath = new ThemeIcon("jersey");
            } else if (element.section === 'testenv:format') {
                label = "Format (format)";
                iconPath = new ThemeIcon("jersey");
            } else if (element.section === 'testenv:unit') {
                label = "Unit tests (unit)";
                iconPath = new ThemeIcon("beaker");
            } else if (element.section === 'testenv:integration') {
                label = "Integration tests (integration)";
                iconPath = new ThemeIcon("beaker");
            }

            const item = new TreeItem(label);
            item.id = element.workspaceCharm.toxConfigUri.fsPath + `?section=${element.section}`;
            item.tooltip = element.section;
            item.iconPath = iconPath;
            item.collapsibleState = TreeItemCollapsibleState.None;
            item.contextValue = 'toxEnv';
            return item;
        }

        return undefined as never;
    }

    getChildren(element?: TreeItemModel | undefined): ProviderResult<TreeItemModel[]> {
        if (!element) {
            const workspaceCharms = this.registry.getWorkspaceCharms();
            if (!workspaceCharms.length) {
                return [{ kind: 'noCharmDetected' } as NoCharmTreeItemModel];
            }

            return workspaceCharms.sort((a, b) => {
                return getWorkspaceCharmLabel(a).localeCompare(getWorkspaceCharmLabel(b));
            }).map(x => ({
                kind: 'charm',
                workspaceCharm: x,
            } as CharmTreeItemModel));
        }

        if (element.kind === 'noCharmDetected') {
            return;
        }

        const workspaceCharm = element.workspaceCharm;

        if (element.kind === 'charm') {
            const result: TreeItemModel[] = [
                ...(!workspaceCharm.hasVirtualEnv ? [{ kind: 'noVirtualEnvWarning', workspaceCharm } as NoVirtualEnvWarningTreeItemModel] : []),
                ...(workspaceCharm.hasMetadata ? [{ kind: 'metadata', workspaceCharm } as MetadataTreeItemModel] : []),
                ...(workspaceCharm.hasCharmcraft ? [{ kind: 'charmcraft', workspaceCharm } as CharmcraftTreeItemModel] : []),
                ...(workspaceCharm.hasToxConfig ? [{ kind: 'tox', workspaceCharm } as ToxConfigTreeItemModel] : []),
            ];

            const configElement = { kind: 'config', workspaceCharm } as ConfigTreeItemModel;
            if (workspaceCharm.model.configOptions.some(x => x.definition === 'charmcraft.yaml')) {
                configElement.uri = workspaceCharm.charmcraftUri;
            } else if (workspaceCharm.model.configOptions.some(x => x.definition === 'config.yaml')) {
                configElement.uri = workspaceCharm.configUri;
            }
            result.push(configElement);

            const actionsElement = { kind: 'actions', workspaceCharm } as ActionsTreeItemModel;
            if (workspaceCharm.model.actions.some(x => x.definition === 'charmcraft.yaml')) {
                actionsElement.uri = workspaceCharm.charmcraftUri;
            } else if (workspaceCharm.model.actions.some(x => x.definition === 'actions.yaml')) {
                actionsElement.uri = workspaceCharm.actionsUri;
            }
            result.push(actionsElement);

            return result;
        }

        if (element.kind === 'config') {
            return workspaceCharm.model.configOptions.map(x => ({
                kind: 'configOption',
                workspaceCharm,
                name: x.name,
                type: x.type,
                range: getNodeRange(x),
                uri: getURI(x),
            } as ConfigOptionTreeItemModel));

            function getNodeRange(option: CharmConfigOption) {
                const node =
                    option.definition === 'charmcraft.yaml' ? workspaceCharm.model.charmcraftYAML.config?.value?.options?.entries?.[option.name]?.node :
                        option.definition === 'config.yaml' ? workspaceCharm.model.configYAML.parameters?.entries?.[option.name]?.node :
                            undefined;
                return node?.range ?? node?.pairKeyRange ?? node?.pairValueRange;
            }

            function getURI(option: CharmConfigOption) {
                return option.definition === 'charmcraft.yaml' ? workspaceCharm.charmcraftUri :
                    option.definition === 'config.yaml' ? workspaceCharm.configUri :
                        undefined;
            }
        }

        if (element.kind === 'actions') {
            return workspaceCharm.model.actions.map(x => ({
                kind: 'actionItem',
                workspaceCharm,
                name: x.name,
                uri: getURI(x),
                range: getNodeRange(x),
            } as ActionItemTreeItemModel));

            function getNodeRange(action: CharmAction) {
                const node =
                    action.definition === 'charmcraft.yaml' ? workspaceCharm.model.charmcraftYAML.config?.value?.options?.entries?.[action.name]?.node :
                        action.definition === 'actions.yaml' ? workspaceCharm.model.actionsYAML.actions?.entries?.[action.name]?.node :
                            undefined;
                return node?.range ?? node?.pairKeyRange ?? node?.pairValueRange;
            }

            function getURI(action: CharmAction) {
                return action.definition === 'charmcraft.yaml' ? workspaceCharm.charmcraftUri :
                    action.definition === 'actions.yaml' ? workspaceCharm.actionsUri :
                        undefined;
            }
        }

        if (element.kind === 'tox' && workspaceCharm.hasToxConfig) {
            return filterAnsSortToxSections(Object.keys(workspaceCharm.model.toxINI.sections))
                .map(section => {
                    const components = section.split(':');
                    const group = components.slice(0, -1).join(':');
                    const env = components[-1 + components.length];
                    return {
                        kind: 'toxEnv',
                        workspaceCharm,
                        section,
                        env,
                        group,
                        command: `tox -e "${env}"`,
                    } as ToxConfigEnvTreeItemModel;
                });
        }

        return [];
    }

    // getParent?(element: TreeItemModel): ProviderResult<TreeItemModel> {
    //     throw new Error("Method not implemented.");
    // }

    // resolveTreeItem?(item: TreeItem, element: TreeItemModel, token: CancellationToken): ProviderResult<TreeItem> {
    //     throw new Error("Method not implemented.");
    // }
}

function getWorkspaceCharmLabel(workspaceCharm: WorkspaceCharm): string {
    const name =
        workspaceCharm.model.charmcraftYAML.name?.value ??
        workspaceCharm.model.metadataYAML.name?.value;
    const title =
        workspaceCharm.model.charmcraftYAML.title?.value ??
        workspaceCharm.model.metadataYAML.displayName?.value;
    return name || title
        ? `${name ?? '?'} (${title ?? '?'})`
        : basename(workspaceCharm.home.path);
}

function filterAnsSortToxSections(envs: string[]): string[] {
    const excluded = [
        'tox',
        'vars',
        'testenv',
    ];
    const filtered = envs.filter(x => excluded.indexOf(x) === -1);

    let counter = 0;
    const preferredLeaders = new Map<string, number>([
        ["testenv:lint", counter++],
        ["testenv:fmt", counter++],
        ["testenv:format", counter++],
        ["testenv:unit", counter++],
        ["testenv:integration", counter++],
    ]);

    return filtered
        .map(x => ({
            section: x,
            sortTag: `${(preferredLeaders.get(x) ?? counter).toString().padStart(2, '0')}:${x}`,
        }))
        .sort((a, b) => a.sortTag.localeCompare(b.sortTag))
        .map(x => x.section);
}

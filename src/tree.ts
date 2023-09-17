import { CancellationToken, Disposable, Event, EventEmitter, ProviderResult, ThemeIcon, TreeDataProvider, TreeItem, TreeItemCollapsibleState } from "vscode";
import { WorkspaceCharm } from "./workspace";
import { Registry } from "./registry";
import TelemetryReporter from "@vscode/extension-telemetry";
import { basename, dirname } from "path";

type TreeItemModel =
    CharmTreeItemModel
    | ConfigTreeItemModel
    | ActionsTreeItemModel
    | MetadataTreeItemModel;

type WithWorkspaceCharm = {
    workspaceCharm: WorkspaceCharm;
};

export type CharmTreeItemModel = { kind: 'charm'; } & WithWorkspaceCharm;
export type ConfigTreeItemModel = { kind: 'config'; } & WithWorkspaceCharm;
export type ActionsTreeItemModel = { kind: 'actions'; } & WithWorkspaceCharm;
export type MetadataTreeItemModel = { kind: 'metadata'; } & WithWorkspaceCharm;

export class CharmcraftTreeDataProvider implements TreeDataProvider<TreeItemModel>, Disposable {
    private readonly _disposables: Disposable[] = [];

    private readonly _onDidChangeTreeData = new EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(readonly registry: Registry, readonly reporter: TelemetryReporter) {
        this._disposables.push(
            this.registry.onChanged(() => this.triggerRefresh()),
            this.registry.onCharmConfigChanged(() => this.triggerRefresh()),
            this.registry.onCharmActionsChanged(() => this.triggerRefresh()),
            this.registry.onCharmMetadataChanged(() => this.triggerRefresh()),
        );
    }

    dispose() {
        this._disposables.forEach(x => x.dispose());
    }

    triggerRefresh() {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TreeItemModel): TreeItem | Thenable<TreeItem> {
        if (element.kind === 'charm') {
            const item = new TreeItem(getWorkspaceCharmLabel(element.workspaceCharm));
            item.resourceUri = element.workspaceCharm.home;
            item.iconPath = new ThemeIcon('package');
            item.collapsibleState = TreeItemCollapsibleState.Collapsed;
            item.contextValue = 'charm';
            return item;
        }

        if (element.kind === 'config') {
            const item = new TreeItem('Config');
            item.resourceUri = element.workspaceCharm.configUri;
            item.iconPath = new ThemeIcon('gear');
            item.collapsibleState = TreeItemCollapsibleState.None;
            item.contextValue = 'config';
            item.tooltip = 'Open config.yaml';
            item.command = {
                title: 'Open',
                command: 'vscode.open',
                arguments: [element.workspaceCharm.configUri],
            };
            return item;
        }

        if (element.kind === 'actions') {
            const item = new TreeItem('Actions');
            item.resourceUri = element.workspaceCharm.actionsUri;
            item.iconPath = new ThemeIcon('wrench');
            item.collapsibleState = TreeItemCollapsibleState.None;
            item.contextValue = 'actions';
            item.tooltip = 'Open actions.yaml';
            item.command = {
                title: 'Open',
                command: 'vscode.open',
                arguments: [element.workspaceCharm.actionsUri],
            };
            return item;
        }

        if (element.kind === 'metadata') {
            const item = new TreeItem('Metadata');
            item.resourceUri = element.workspaceCharm.metadataUri;
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

        return undefined as never;
    }

    getChildren(element?: TreeItemModel | undefined): ProviderResult<TreeItemModel[]> {
        if (!element) {
            return Array.from(this.registry.getWorkspaceCharms()).sort((a, b) => {
                return getWorkspaceCharmLabel(a).localeCompare(getWorkspaceCharmLabel(b));
            }).map(x => ({
                kind: 'charm',
                workspaceCharm: x,
            } as CharmTreeItemModel));
        }

        if (element.kind === 'charm') {
            return [
                ...(element.workspaceCharm.hasActions ? [{ kind: 'actions', workspaceCharm: element.workspaceCharm } as ActionsTreeItemModel] : []),
                ...(element.workspaceCharm.hasConfig ? [{ kind: 'config', workspaceCharm: element.workspaceCharm } as ConfigTreeItemModel] : []),
                ...(element.workspaceCharm.hasMetadata ? [{ kind: 'metadata', workspaceCharm: element.workspaceCharm } as MetadataTreeItemModel] : []),
            ];
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
    const name = workspaceCharm.model.metadata.name?.value;
    const displayName = workspaceCharm.model.metadata.displayName?.value;
    return name || displayName
        ? `${name ?? '?'} (${displayName ?? '?'})`
        : basename(workspaceCharm.home.path);
}

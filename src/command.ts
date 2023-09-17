import TelemetryReporter from '@vscode/extension-telemetry';
import {
    ExtensionContext, MessageItem,
    ProgressLocation,
    commands, window,
    workspace
} from 'vscode';
import { Registry } from './registry';
import {
    ActionsTreeItemModel,
    CharmTreeItemModel,
    CharmcraftTreeDataProvider,
    ConfigTreeItemModel,
    MetadataTreeItemModel
} from './tree';
import { ExecutionResult } from './venv';
import path = require('path');

export class Commands {
    constructor(
        readonly context: ExtensionContext,
        readonly reporter: TelemetryReporter,
        readonly registry: Registry,
        readonly treeDataProvider: CharmcraftTreeDataProvider,
    ) { }

    register() {
        return [
            commands.registerCommand('charmcraft-ide.discoverCharms', async () => {
                await this.discoverCharms();
            }),
            commands.registerCommand('charmcraft-ide.revealCharmDirectory', async (e: CharmTreeItemModel) => {
                await this.revealCharmDirectory(e);
            }),
            commands.registerCommand('charmcraft-ide.createAndSetupVirtualEnvironment', async (e: CharmTreeItemModel) => {
                await this.createAndSetupVirtualEnvironment(e);
            }),
            commands.registerCommand('charmcraft-ide.revealCharmFile', async (e: ConfigTreeItemModel | ActionsTreeItemModel | MetadataTreeItemModel) => {
                await this.revealCharmFile(e);
            }),
            commands.registerCommand('charmcraft-ide.resetStateGlobal', () => {
                this.resetStateGlobal();
            }),
            commands.registerCommand('charmcraft-ide.resetStateWorkspace', () => {
                this.resetStateWorkspace();
            }),
        ];
    }

    async revealCharmDirectory(e: CharmTreeItemModel) {
        this.reporter.sendTelemetryEvent('v0.command.revealCharmDirectory');
        await commands.executeCommand('revealInExplorer', e.workspaceCharm.home);
    }

    async discoverCharms() {
        this.reporter.sendTelemetryEvent('v0.command.discoverCharms');
        await this.registry.refresh();
        this.treeDataProvider.triggerRefresh();
    }

    async createAndSetupVirtualEnvironment(e: CharmTreeItemModel) {
        this.reporter.sendTelemetryEvent('v0.command.createAndSetupVirtualEnvironment');
        if (e.workspaceCharm.hasVirtualEnv) {
            const ok: MessageItem = { title: "OK" };
            const cancel: MessageItem = { title: "Cancel", isCloseAffordance: true };
            const resp = await window.showInformationMessage(
                "Charm already has a virtual environment. Proceed with re-creating it?",
                ok, cancel,
            );
            if (!resp || resp === cancel) {
                return;
            }

            const deleteResult = await e.workspaceCharm.virtualEnv.delete();
            if (deleteResult.code !== 0) {
                const showLogs: MessageItem = { title: "Show Logs" };
                const resp = await window.showInformationMessage(
                    "Failed to delete the existing  virtual environment. Click on 'See Logs' for more information.",
                    showLogs,
                );
                if (!resp) {
                    return;
                }
                await showResultInNewDocument(deleteResult);
                return;
            }
        }

        const createResult = await e.workspaceCharm.virtualEnv.create();
        if (createResult.code !== 0) {
            const showLogs: MessageItem = { title: "Show Logs" };
            const resp = await window.showInformationMessage(
                "Failed to create the virtual environment. Click on 'See Logs' for more information.",
                showLogs,
            );
            if (!resp) {
                return;
            }
            await showResultInNewDocument(createResult);
            return;
        }

        const setupResult = await window.withProgress(
            {
                location: ProgressLocation.Notification,
                title: "Setting up virtual environment at " + workspace.asRelativePath(e.workspaceCharm.virtualEnvUri) + ".",
            },
            async progress => {
                progress.report({});
                return await e.workspaceCharm.virtualEnv.setup();
            },
        );

        if (setupResult.code !== 0) {
            const showlogs: MessageItem = { title: "Show Logs" };
            const resp = await window.showInformationMessage(
                "Failed to setup the virtual environment. Click on 'See Logs' for more information.",
                showlogs,
            );
            if (!resp) {
                return;
            }
            await showResultInNewDocument(setupResult);
            return;
        }

        const showLogs: MessageItem = { title: "Show Logs" };
        const resp = await window.showInformationMessage(
            "Virtual environment created at " + workspace.asRelativePath(e.workspaceCharm.virtualEnvUri) + ".",
            showLogs,
        );
        if (!resp) {
            return;
        }
        await showResultInNewDocument(setupResult);

        async function showResultInNewDocument(e: ExecutionResult) {
            const content = `exit-code: ${e.code}\r\n\r\nstdout:\r\n-------\r\n\r\n${e.stdout}\r\n\r\nstderr:\r\n-------\r\n\r\n${e.stderr}\r\n\r\n`;
            const doc = await workspace.openTextDocument({ content });
            await window.showTextDocument(doc);
        }
    }

    async revealCharmFile(e: ConfigTreeItemModel | ActionsTreeItemModel | MetadataTreeItemModel) {
        if (e.kind === 'config') {
            this.reporter.sendTelemetryEvent('v0.command.revealCharmFile.config');
            await commands.executeCommand('revealInExplorer', e.workspaceCharm.configUri);
        } else if (e.kind === 'actions') {
            this.reporter.sendTelemetryEvent('v0.command.revealCharmFile.actions');
            await commands.executeCommand('revealInExplorer', e.workspaceCharm.actionsUri);
        } else if (e.kind === 'metadata') {
            this.reporter.sendTelemetryEvent('v0.command.revealCharmFile.metadata');
            await commands.executeCommand('revealInExplorer', e.workspaceCharm.metadataUri);
        }
    }

    resetStateGlobal() {
        this.reporter.sendTelemetryEvent('v0.command.resetStateGlobal');
        const keys = this.context.globalState.keys();
        for (const key of keys) {
            this.context.globalState.update(key, undefined);
        }
    }

    resetStateWorkspace() {
        this.reporter.sendTelemetryEvent('v0.command.resetStateWorkspace');
        const keys = this.context.workspaceState.keys();
        for (const key of keys) {
            this.context.workspaceState.update(key, undefined);
        }
    }
}


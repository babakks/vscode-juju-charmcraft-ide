import TelemetryReporter from '@vscode/extension-telemetry';
import {
    Disposable,
    ExtensionContext, MessageItem,
    ProgressLocation,
    commands, extensions, window,
    workspace
} from 'vscode';
import { Registry } from './registry';
import {
    ActionsTreeItemModel,
    CharmTreeItemModel,
    CharmcraftTreeDataProvider,
    ConfigTreeItemModel,
    MetadataTreeItemModel,
    NoVirtualEnvWarningTreeItemModel,
    ToxConfigEnvTreeItemModel,
    ToxConfigTreeItemModel
} from './tree';
import { ExecutionResult } from './venv';
import path = require('path');
import { WorkspaceCharm } from './workspace';
import { PythonExtension } from './include/ms-python.python';
import { CHARM_DIR_LIB, CHARM_DIR_SRC, CHARM_DIR_TESTS } from './model/common';
import { COMMAND_ACTIVATE_CHARM, COMMAND_CREATE_AND_SETUP_VIRTUAL_ENVIRONMENT, COMMAND_DISCOVER_CHARMS, COMMAND_RESET_STATE_GLOBAL, COMMAND_RESET_STATE_WORKSPACE, COMMAND_REVEAL_CHARM_DIRECTORY, COMMAND_REVEAL_CHARM_FILE, COMMAND_RUN_TOX_ENV_IN_TERMINAL } from './command.const';

export class Commands implements Disposable {
    private readonly _disposables: Disposable[] = [];

    constructor(
        readonly context: ExtensionContext,
        readonly reporter: TelemetryReporter,
        readonly registry: Registry,
        readonly treeDataProvider: CharmcraftTreeDataProvider,
    ) { }

    dispose() {
        this._disposables.forEach(x => x.dispose());
    }

    register() {
        this._disposables.push(
            commands.registerCommand(COMMAND_DISCOVER_CHARMS, async () => {
                await this.discoverCharms();
            }),
            commands.registerCommand(COMMAND_REVEAL_CHARM_DIRECTORY, async (e: CharmTreeItemModel) => {
                await this.revealCharmDirectory(e);
            }),
            commands.registerCommand(COMMAND_CREATE_AND_SETUP_VIRTUAL_ENVIRONMENT, async (e: CharmTreeItemModel | NoVirtualEnvWarningTreeItemModel) => {
                await this.createAndSetupVirtualEnvironment(e);
            }),
            commands.registerCommand(COMMAND_ACTIVATE_CHARM, async (e: CharmTreeItemModel) => {
                await this.activateCharm(e);
            }),
            commands.registerCommand(COMMAND_REVEAL_CHARM_FILE, async (e: ConfigTreeItemModel | ActionsTreeItemModel | MetadataTreeItemModel | ToxConfigTreeItemModel) => {
                await this.revealCharmFile(e);
            }),
            commands.registerCommand(COMMAND_RUN_TOX_ENV_IN_TERMINAL, async (e: ToxConfigEnvTreeItemModel) => {
                await this.runToxEnvInTerminal(e);
            }),
            commands.registerCommand(COMMAND_RESET_STATE_GLOBAL, () => {
                this.resetStateGlobal();
            }),
            commands.registerCommand(COMMAND_RESET_STATE_WORKSPACE, () => {
                this.resetStateWorkspace();
            }),
        );
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

    async revealCharmFile(e: ConfigTreeItemModel | ActionsTreeItemModel | MetadataTreeItemModel | ToxConfigTreeItemModel) {
        if (e.kind === 'config') {
            this.reporter.sendTelemetryEvent('v0.command.revealCharmFile.config');
            await commands.executeCommand('revealInExplorer', e.workspaceCharm.configUri);
        } else if (e.kind === 'actions') {
            this.reporter.sendTelemetryEvent('v0.command.revealCharmFile.actions');
            await commands.executeCommand('revealInExplorer', e.workspaceCharm.actionsUri);
        } else if (e.kind === 'metadata') {
            this.reporter.sendTelemetryEvent('v0.command.revealCharmFile.metadata');
            await commands.executeCommand('revealInExplorer', e.workspaceCharm.metadataUri);
        } else if (e.kind === 'tox') {
            this.reporter.sendTelemetryEvent('v0.command.revealCharmFile.toxConfig');
            await commands.executeCommand('revealInExplorer', e.workspaceCharm.toxConfigUri);
        }
    }

    async createAndSetupVirtualEnvironment(e: CharmTreeItemModel | NoVirtualEnvWarningTreeItemModel) {
        this.reporter.sendTelemetryEvent('v0.command.createAndSetupVirtualEnvironment');
        await this._createAndSetupVirtualEnvironment(e.workspaceCharm);
    }

    private async _createAndSetupVirtualEnvironment(workspaceCharm: WorkspaceCharm) {
        if (workspaceCharm.hasVirtualEnv) {
            const ok: MessageItem = { title: "OK" };
            const cancel: MessageItem = { title: "Cancel", isCloseAffordance: true };
            const resp = await window.showInformationMessage(
                "Charm already has a virtual environment. Proceed with re-creating it?",
                ok, cancel,
            );
            if (!resp || resp === cancel) {
                return;
            }

            const deleteResult = await workspaceCharm.virtualEnv.delete();
            if (deleteResult.code !== 0) {
                const showLogs: MessageItem = { title: "Show Logs" };
                window.showInformationMessage(
                    "Failed to delete the existing  virtual environment. Click on 'See Logs' for more information.",
                    showLogs,
                ).then(resp => {
                    if (!resp) {
                        return;
                    }
                    showResultInNewDocument(deleteResult);
                });
                return;
            }
        }

        const createResult = await workspaceCharm.virtualEnv.create();
        if (createResult.code !== 0) {
            const showLogs: MessageItem = { title: "Show Logs" };
            window.showInformationMessage(
                "Failed to create the virtual environment. Click on 'See Logs' for more information.",
                showLogs,
            ).then(resp => {
                if (!resp) {
                    return;
                }
                showResultInNewDocument(createResult);
            });
            return;
        }

        const setupResult = await window.withProgress(
            {
                location: ProgressLocation.Notification,
                title: "Setting up virtual environment at " + workspace.asRelativePath(workspaceCharm.virtualEnvUri) + ".",
            },
            async progress => {
                progress.report({});
                return await workspaceCharm.virtualEnv.setup();
            },
        );

        if (setupResult.code !== 0) {
            const showlogs: MessageItem = { title: "Show Logs" };
            window.showInformationMessage(
                "Failed to setup the virtual environment. Click on 'See Logs' for more information.",
                showlogs,
            ).then(resp => {
                if (!resp) {
                    return;
                }
                showResultInNewDocument(setupResult);
            });
            return;
        }

        const showLogs: MessageItem = { title: "Show Logs" };
        window.showInformationMessage(
            "Virtual environment created at " + workspace.asRelativePath(workspaceCharm.virtualEnvUri) + ".",
            showLogs,
        ).then(resp => {
            if (!resp) {
                return;
            }
            showResultInNewDocument(setupResult);
        });

        async function showResultInNewDocument(e: ExecutionResult) {
            const content = `exit-code: ${e.code}\r\n\r\nstdout:\r\n-------\r\n\r\n${e.stdout}\r\n\r\nstderr:\r\n-------\r\n\r\n${e.stderr}\r\n\r\n`;
            const doc = await workspace.openTextDocument({ content });
            await window.showTextDocument(doc);
        }
    }

    async activateCharm(e: CharmTreeItemModel) {
        this.reporter.sendTelemetryEvent('v0.command.activateCharm');
        await this._askAndSetupVirtualEnvFirst(e.workspaceCharm);
        if (!e.workspaceCharm.hasVirtualEnv) {
            return;
        }

        const pythonExt = extensions.getExtension('ms-python.python');
        if (!pythonExt) {
            window.showErrorMessage("You need to have Microsoft Python extension installed.");
            return;
        }
        if (!pythonExt.isActive) {
            await pythonExt.activate();
        }

        const api = pythonExt.exports as PythonExtension;
        const venv = e.workspaceCharm.virtualEnv;
        const charmRelativePath = workspace.asRelativePath(e.workspaceCharm.home);
        try {
            await api.environments.updateActiveEnvironmentPath(
                path.join(venv.charmHome.fsPath, venv.virtualEnvDir, 'bin', 'python3'),
            );
        } catch {
            window.showErrorMessage("Failed to activate Python development environment for the charm " + charmRelativePath + ".");
            return;
        }

        const pythonAnalysisConfig = workspace.getConfiguration('python.analysis');
        const oldEntriesToKeep: string[] = [];
        const oldEntries = pythonAnalysisConfig.get<string[]>('extraPaths', []);
        if (oldEntries.length > 0) {
            const allPossibleCharmRelatedEntries = this.registry.getWorkspaceCharms()
                .map(x => getExtraPathEntriesForCharm(x)).flat();
            oldEntriesToKeep.push(...oldEntries.filter(x => allPossibleCharmRelatedEntries.indexOf(x) === -1));
        }
        pythonAnalysisConfig.update('extraPaths', [
            ...oldEntriesToKeep,
            path.join(charmRelativePath, CHARM_DIR_LIB),
            path.join(charmRelativePath, CHARM_DIR_SRC),
            path.join(charmRelativePath, CHARM_DIR_TESTS),
        ]);

        this.registry.setActiveCharm(e.workspaceCharm);
        window.showInformationMessage("Activated Python development environment for the charm " + charmRelativePath + ".");

        function getExtraPathEntriesForCharm(workspaceCharm: WorkspaceCharm): string[] {
            const charmRelativePath = workspace.asRelativePath(workspaceCharm.home);
            return [
                path.join(charmRelativePath, CHARM_DIR_LIB),
                path.join(charmRelativePath, CHARM_DIR_SRC),
                path.join(charmRelativePath, CHARM_DIR_TESTS),
            ];
        }
    }

    async runToxEnvInTerminal(e: ToxConfigEnvTreeItemModel) {
        this.reporter.sendTelemetryEvent('v0.command.runToxEnvInTerminal', { "section": e.section });
        await this._askAndSetupVirtualEnvFirst(e.workspaceCharm);
        if (e.workspaceCharm.hasVirtualEnv) {
            e.workspaceCharm.virtualEnv.execInTerminal(e.group, e.command).show();
        }
    }

    private async _askAndSetupVirtualEnvFirst(workspaceCharm: WorkspaceCharm) {
        if (workspaceCharm.hasVirtualEnv) {
            return;
        }

        const yes: MessageItem = { title: "Yes" };
        const no: MessageItem = { title: "No", isCloseAffordance: true };
        const resp = await window.showErrorMessage(
            "No virtual environment detected in the charm to continue with. Do you want to setup the virtual environment now?",
            yes, no,
        );
        if (!resp || resp === no) {
            return;
        }
        await this._createAndSetupVirtualEnvironment(workspaceCharm);
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


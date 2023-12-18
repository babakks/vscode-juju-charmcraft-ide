import TelemetryReporter from '@vscode/extension-telemetry';
import {
    ExtensionContext, MessageItem,
    ProgressLocation,
    commands, extensions, window,
    workspace
} from 'vscode';
import {
    COMMAND_ACTIVATE_CHARM,
    COMMAND_CREATE_AND_SETUP_VIRTUAL_ENVIRONMENT,
    COMMAND_DISCOVER_CHARMS,
    COMMAND_RESET_STATE_GLOBAL,
    COMMAND_RESET_STATE_WORKSPACE,
    COMMAND_REVEAL_CHARM_DIRECTORY,
    COMMAND_REVEAL_CHARM_FILE,
    COMMAND_RUN_TOX_ENV_IN_TERMINAL
} from './command.const';
import { PythonExtension } from './include/ms-python.python';
import { CHARM_DIR_LIB, CHARM_DIR_SRC, CHARM_DIR_TESTS } from './model/common';
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
import { WorkspaceCharm } from './workspace';
import path = require('path');

export function registerCommands(ic: InternalCommands, reporter: TelemetryReporter) {
    return [
        commands.registerCommand(COMMAND_DISCOVER_CHARMS, async () => {
            reporter.sendTelemetryEvent('v0.command.discoverCharms');
            await ic.discoverCharms();
        }),
        commands.registerCommand(COMMAND_REVEAL_CHARM_DIRECTORY, async (e: CharmTreeItemModel) => {
            reporter.sendTelemetryEvent('v0.command.revealCharmDirectory');
            await commands.executeCommand('revealInExplorer', e.workspaceCharm.home);
        }),
        commands.registerCommand(COMMAND_CREATE_AND_SETUP_VIRTUAL_ENVIRONMENT, async (e: CharmTreeItemModel | NoVirtualEnvWarningTreeItemModel) => {
            reporter.sendTelemetryEvent('v0.command.createAndSetupVirtualEnvironment');
            await ic.createAndSetupVirtualEnvironment(e.workspaceCharm);
        }),
        commands.registerCommand(COMMAND_ACTIVATE_CHARM, async (e: CharmTreeItemModel) => {
            reporter.sendTelemetryEvent('v0.command.activateCharm');
            await ic.activateCharm(e.workspaceCharm);
        }),
        commands.registerCommand(COMMAND_REVEAL_CHARM_FILE, async (e: ConfigTreeItemModel | ActionsTreeItemModel | MetadataTreeItemModel | ToxConfigTreeItemModel) => {
            if (e.kind === 'config') {
                reporter.sendTelemetryEvent('v0.command.revealCharmFile.config');
                await commands.executeCommand('revealInExplorer', e.workspaceCharm.configUri);
            } else if (e.kind === 'actions') {
                reporter.sendTelemetryEvent('v0.command.revealCharmFile.actions');
                await commands.executeCommand('revealInExplorer', e.workspaceCharm.actionsUri);
            } else if (e.kind === 'metadata') {
                reporter.sendTelemetryEvent('v0.command.revealCharmFile.metadata');
                await commands.executeCommand('revealInExplorer', e.workspaceCharm.metadataUri);
            } else if (e.kind === 'tox') {
                reporter.sendTelemetryEvent('v0.command.revealCharmFile.toxConfig');
                await commands.executeCommand('revealInExplorer', e.workspaceCharm.toxConfigUri);
            }
        }),
        commands.registerCommand(COMMAND_RUN_TOX_ENV_IN_TERMINAL, async (e: ToxConfigEnvTreeItemModel) => {
            reporter.sendTelemetryEvent('v0.command.runToxEnvInTerminal', { "section": e.section });
            await ic.runToxEnvInTerminal(e.workspaceCharm, e.group, e.command);
        }),
        commands.registerCommand(COMMAND_RESET_STATE_GLOBAL, () => {
            reporter.sendTelemetryEvent('v0.command.resetStateGlobal');
            ic.resetStateGlobal();
        }),
        commands.registerCommand(COMMAND_RESET_STATE_WORKSPACE, () => {
            reporter.sendTelemetryEvent('v0.command.resetStateWorkspace');
            ic.resetStateWorkspace();
        }),
    ];
}

export class InternalCommands {
    constructor(
        readonly context: ExtensionContext,
        readonly registry: Registry,
        readonly treeDataProvider: CharmcraftTreeDataProvider,
    ) { }

    async discoverCharms() {
        await this.registry.refresh();
        this.treeDataProvider.triggerRefresh();
    }

    /**
     * @returns `undefined` if the user cancels the creation/setup process;
     * otherwise `true` if the process was successful, or `false` if not. Note
     * that if there was an existing virtual environment and the user decides to
     * keep it, the method returns `undefined`.
     */
    async createAndSetupVirtualEnvironment(workspaceCharm: WorkspaceCharm): Promise<boolean | undefined> {
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
                return false;
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
            return false;
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
            const showLogs: MessageItem = { title: "Show Logs" };
            window.showInformationMessage(
                "Failed to setup the virtual environment. Click on 'See Logs' for more information.",
                showLogs,
            ).then(resp => {
                if (!resp) {
                    return;
                }
                showResultInNewDocument(setupResult);
            });
            return false;
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
        return true;

        async function showResultInNewDocument(e: ExecutionResult) {
            const content = `exit-code: ${e.code}\r\n\r\nstdout:\r\n-------\r\n\r\n${e.stdout}\r\n\r\nstderr:\r\n-------\r\n\r\n${e.stderr}\r\n\r\n`;
            const doc = await workspace.openTextDocument({ content });
            await window.showTextDocument(doc);
        }
    }

    async activateCharm(workspaceCharm: WorkspaceCharm) {
        if (!await this.askAndSetupVirtualEnvFirst(workspaceCharm)) {
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
        const venv = workspaceCharm.virtualEnv;
        const charmRelativePath = workspace.asRelativePath(workspaceCharm.home);
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

        this.registry.setActiveCharm(workspaceCharm);
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

    async runToxEnvInTerminal(workspaceCharm: WorkspaceCharm, group: string, command: string) {
        if (!await this.askAndSetupVirtualEnvFirst(workspaceCharm)) {
            return;
        }
        workspaceCharm.virtualEnv.execInTerminal(group, command).show();
    }

    /**
     * @returns `undefined` if the user cancels the creation/setup process. If
     * there's an existing virtual environment or a new one was successfully
     * created, the method returns `true`. Otherwise, if the creation process
     * failed, a `false` value will be returned. 
     */
    async askAndSetupVirtualEnvFirst(workspaceCharm: WorkspaceCharm, modal?: boolean): Promise<boolean | undefined> {
        if (workspaceCharm.hasVirtualEnv) {
            return true;
        }

        const yes: MessageItem = { title: "Yes" };
        const no: MessageItem = { title: "No", isCloseAffordance: true };
        const resp = await window.showErrorMessage(
            "No virtual environment detected in the charm directory to continue with. Do you want to setup the virtual environment now?",
            { modal },
            yes, no,
        );
        if (!resp || resp === no) {
            return;
        }
        return await this.createAndSetupVirtualEnvironment(workspaceCharm);
    }

    resetStateGlobal() {
        const keys = this.context.globalState.keys();
        for (const key of keys) {
            this.context.globalState.update(key, undefined);
        }
    }

    resetStateWorkspace() {
        const keys = this.context.workspaceState.keys();
        for (const key of keys) {
            this.context.workspaceState.update(key, undefined);
        }
    }
}


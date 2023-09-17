import TelemetryReporter from '@vscode/extension-telemetry';
import {
    Disposable,
    ExtensionContext,
    ExtensionMode,
    MessageItem,
    ProgressLocation,
    commands,
    extensions,
    languages,
    window,
    workspace
} from 'vscode';
import { EventHandlerCodeActionProvider } from './codeAction';
import {
    CHARM_CONFIG_COMPLETION_TRIGGER_CHARS,
    CHARM_EVENT_COMPLETION_TRIGGER_CHARS,
    CharmConfigParametersCompletionProvider,
    CharmEventCompletionProvider
} from './completion';
import { CharmConfigDefinitionProvider, CharmEventDefinitionProvider } from './definition';
import { CharmConfigHoverProvider, CharmEventHoverProvider } from './hover';
import { ExtensionAPI } from './include/redhat.vscode-yaml';
import { Registry } from './registry';
import { registerSchemas } from './schema';
import { ActionsTreeItemModel, CharmTreeItemModel, CharmcraftTreeDataProvider, ConfigTreeItemModel, MetadataTreeItemModel } from './tree';
import { DocumentWatcher } from './watcher';
import path = require('path');
import { ExecutionResult } from './venv';

const TELEMETRY_INSTRUMENTATION_KEY = 'e9934c53-e6be-4d6d-897c-bcc96cbb3f75';

const EXTENSION_SCHEMA_DATA_DIR = 'schema/data';

const RED_HAT_YAML_EXT = 'redhat.vscode-yaml';
const GLOBAL_STATE_KEY_NEVER_ASK_FOR_YAML_EXT = 'never-ask-yaml-extension';

export async function activate(context: ExtensionContext) {
    const reporter = new TelemetryReporter(context.extensionMode === ExtensionMode.Production ? TELEMETRY_INSTRUMENTATION_KEY : '');
    context.subscriptions.push(reporter);

    const output = window.createOutputChannel('Charmcraft IDE');
    context.subscriptions.push(output);

    const diagnostics = languages.createDiagnosticCollection('Charmcraft IDE');
    context.subscriptions.push(diagnostics);

    const registry = new Registry(output, diagnostics);
    context.subscriptions.push(registry);
    await registry.refresh();

    context.subscriptions.push(
        ...registerCodeActionProviders(registry, reporter),
        ...registerCompletionProviders(registry, reporter),
        ...registerHoverProviders(registry, reporter),
        ...registerDefinitionProviders(registry, reporter),
    );

    const dw = new DocumentWatcher(registry);
    context.subscriptions.push(dw);
    dw.enable();

    const tdp = new CharmcraftTreeDataProvider(registry, reporter);
    context.subscriptions.push(tdp);
    context.subscriptions.push(window.createTreeView('charmcraft-charms', { treeDataProvider: tdp }));

    context.subscriptions.push(...registerCommands(context, reporter, registry, tdp));

    // Note that we shouldn't `await` on this call, because it could ask for user decision (e.g., to install the YAML
    // extension) and get blocked for an unknown time duration (possibly never, if user decides to skip the message).
    integrateWithYAMLExtension(context).catch(reason => {
        output.appendLine(`failed to integrate with YAML extension: ${reason}`);
    });
}

export function deactivate() { }

function registerCommands(context: ExtensionContext, reporter: TelemetryReporter, registry: Registry, tdp: CharmcraftTreeDataProvider): Disposable[] {
    return [
        commands.registerCommand('charmcraft-ide.discoverCharms', async function () {
            reporter.sendTelemetryEvent('v0.command.discoverCharms');
            await registry.refresh();
            tdp.triggerRefresh();
        }),
        commands.registerCommand('charmcraft-ide.revealCharmDirectory', async function (e: CharmTreeItemModel) {
            reporter.sendTelemetryEvent('v0.command.revealCharmDirectory');
            await commands.executeCommand('revealInExplorer', e.workspaceCharm.home);
        }),
        commands.registerCommand('charmcraft-ide.createAndSetupVirtualEnvironment', async function (e: CharmTreeItemModel) {
            reporter.sendTelemetryEvent('v0.command.createAndSetupVirtualEnvironment');
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
        }),
        commands.registerCommand('charmcraft-ide.revealCharmFile', async function (e: ConfigTreeItemModel | ActionsTreeItemModel | MetadataTreeItemModel) {
            if (e.kind === 'config') {
                reporter.sendTelemetryEvent('v0.command.revealCharmFile.config');
                await commands.executeCommand('revealInExplorer', e.workspaceCharm.configUri);
            } else if (e.kind === 'actions') {
                reporter.sendTelemetryEvent('v0.command.revealCharmFile.actions');
                await commands.executeCommand('revealInExplorer', e.workspaceCharm.actionsUri);
            } else if (e.kind === 'metadata') {
                reporter.sendTelemetryEvent('v0.command.revealCharmFile.metadata');
                await commands.executeCommand('revealInExplorer', e.workspaceCharm.metadataUri);
            }
        }),
        commands.registerCommand('charmcraft-ide.resetStateGlobal', function () {
            reporter.sendTelemetryEvent('v0.command.resetStateGlobal');
            const keys = context.globalState.keys();
            for (const key of keys) {
                context.globalState.update(key, undefined);
            }
        }),
        commands.registerCommand('charmcraft-ide.resetStateWorkspace', function () {
            reporter.sendTelemetryEvent('v0.command.resetStateWorkspace');
            const keys = context.workspaceState.keys();
            for (const key of keys) {
                context.workspaceState.update(key, undefined);
            }
        }),
    ];
}

async function integrateWithYAMLExtension(context: ExtensionContext) {
    const yamlExtension = extensions.getExtension(RED_HAT_YAML_EXT);
    if (!yamlExtension) {
        const neverAsk = context.globalState.get(GLOBAL_STATE_KEY_NEVER_ASK_FOR_YAML_EXT);
        if (neverAsk) {
            return;
        }

        const resp = await window.showInformationMessage(
            "To enable YAML file services (e.g., schema validation or auto-completion) you need to install Red Hat YAML language server extension.",
            "Open Red Hat YAML Extension",
            "Never ask",
        );
        if (resp) {
            if (resp === 'Never ask') {
                context.globalState.update(GLOBAL_STATE_KEY_NEVER_ASK_FOR_YAML_EXT, true);
            } else {
                commands.executeCommand('extension.open', RED_HAT_YAML_EXT);
            }
        }
        return;
    }

    if (!yamlExtension.isActive) {
        await yamlExtension.activate();
    }

    const yaml = yamlExtension.exports as ExtensionAPI;
    await registerSchemas(
        path.join(context.extensionPath, EXTENSION_SCHEMA_DATA_DIR),
        yaml,
        // Enable watching for schema changes, only in development mode.
        context.extensionMode === ExtensionMode.Development,
    );
}

function registerCompletionProviders(registry: Registry, reporter: TelemetryReporter): Disposable[] {
    return [
        languages.registerCompletionItemProvider(
            { scheme: 'file', language: 'python' },
            new CharmConfigParametersCompletionProvider(registry, reporter),
            ...CHARM_CONFIG_COMPLETION_TRIGGER_CHARS
        ),
        languages.registerCompletionItemProvider(
            { scheme: 'file', language: 'python' },
            new CharmEventCompletionProvider(registry, reporter),
            ...CHARM_EVENT_COMPLETION_TRIGGER_CHARS
        ),
    ];
}

function registerHoverProviders(registry: Registry, reporter: TelemetryReporter): Disposable[] {
    return [
        languages.registerHoverProvider(
            { scheme: 'file', language: 'python' },
            new CharmConfigHoverProvider(registry, reporter),
        ),
        languages.registerHoverProvider(
            { scheme: 'file', language: 'python' },
            new CharmEventHoverProvider(registry, reporter),
        ),
    ];
}

function registerCodeActionProviders(registry: Registry, reporter: TelemetryReporter): Disposable[] {
    return [
        languages.registerCodeActionsProvider(
            { scheme: 'file', language: 'python' },
            new EventHandlerCodeActionProvider(registry, reporter),
        ),
    ];
}

function registerDefinitionProviders(registry: Registry, reporter: TelemetryReporter): Disposable[] {
    return [
        languages.registerDefinitionProvider(
            { scheme: 'file', language: 'python' },
            new CharmConfigDefinitionProvider(registry, reporter),
        ),
        languages.registerDefinitionProvider(
            { scheme: 'file', language: 'python' },
            new CharmEventDefinitionProvider(registry, reporter),
        ),
    ];
}

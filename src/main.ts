import TelemetryReporter from '@vscode/extension-telemetry';
import {
    Disposable,
    ExtensionContext,
    ExtensionMode,
    commands,
    extensions,
    languages,
    window
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
import { DocumentWatcher } from './watcher';
import path = require('path');

const TELEMETRY_INSTRUMENTATION_KEY = 'e9934c53-e6be-4d6d-897c-bcc96cbb3f75';

const EXTENSION_SCHEMA_DATA_DIR = 'schema/data';

const RED_HAT_YAML_EXT = 'redhat.vscode-yaml';
const GLOBAL_STATE_KEY_NEVER_ASK_FOR_YAML_EXT = 'never-ask-yaml-extension';

export async function activate(context: ExtensionContext) {
    const reporter = new TelemetryReporter(context.extensionMode === ExtensionMode.Production ? TELEMETRY_INSTRUMENTATION_KEY : '');
    context.subscriptions.push(reporter);

    const output = window.createOutputChannel('Charmcraft IDE');
    context.subscriptions.push(output);

    const registry = new Registry(output);
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

    context.subscriptions.push(...registerCommands(context, reporter));

    // const python = extensions.getExtension('ms-python.python')?.exports as PythonExtension;
    // if (!python) {
    //     // throw new Error('Failed to retrieve `ms-python.python` extension API');
    // } else {
    // }

    // Note that we shouldn't `await` on this call, because it could ask for user decision (e.g., to install the YAML
    // extension) and get blocked for an unknown time duration (possibly never, if user decides to skip the message).
    integrateWithYAMLExtension(context).catch(reason => {
        output.appendLine(`failed to integrate with YAML extension: ${reason}`);
    });
}

export function deactivate() { }

function registerCommands(context: ExtensionContext, reporter: TelemetryReporter): Disposable[] {
    return [
        commands.registerCommand('vscode-juju-charmcraft-ide.resetStateGlobal', function () {
            reporter.sendTelemetryEvent('v0.command.resetStateGlobal');
            const keys = context.globalState.keys();
            for (const key of keys) {
                context.globalState.update(key, undefined);
            }
        }),
        commands.registerCommand('vscode-juju-charmcraft-ide.resetStateWorkspace', function () {
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

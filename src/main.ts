import { Disposable, ExtensionContext, extensions, languages, window } from 'vscode';
import { EventHandlerCodeActionProvider } from './codeAction';
import {
    CHARM_CONFIG_COMPLETION_TRIGGER_CHARS,
    CHARM_EVENT_COMPLETION_TRIGGER_CHARS,
    CharmConfigParametersCompletionProvider,
    CharmEventCompletionProvider
} from './completion';
import { DocumentWatcher } from './documentWatcher';
import { CharmConfigHoverProvider, CharmEventHoverProvider } from './hover';
import { PythonExtension } from './include/ms-python.python';
import { ExtensionAPI } from './include/redhat.vscode-yaml';
import { Registry } from './registry';
import { registerSchemas } from './schema';
import path = require('path');

const EXTENSION_SCHEMA_DATA_DIR = 'schema/data';

export async function activate(context: ExtensionContext) {
    const python = extensions.getExtension('ms-python.python')?.exports as PythonExtension;
    if (!python) {
        throw new Error('Failed to retrieve `ms-python.python` extension API');
    }

    const yaml = extensions.getExtension("redhat.vscode-yaml")?.exports as ExtensionAPI;
    if (!yaml) {
        throw new Error('Failed to retrieve `redhat.vscode-yaml` extension API');
    }
    await registerSchemas(path.join(context.extensionPath, EXTENSION_SCHEMA_DATA_DIR), yaml);

    const output = window.createOutputChannel('Charms IDE');
    context.subscriptions.push(output);

    const registry = new Registry(output);
    context.subscriptions.push(registry);
    await registry.refresh();

    context.subscriptions.push(
        ...registerCodeActionProviders(registry),
        ...registerCompletionProviders(registry),
        ...registerHoverProviders(registry)
    );

    const dw = new DocumentWatcher(registry);
    context.subscriptions.push(dw);
    dw.enable();
}

export function deactivate() { }

function registerCompletionProviders(registry: Registry): Disposable[] {
    return [
        languages.registerCompletionItemProvider(
            { scheme: 'file', language: 'python' },
            new CharmConfigParametersCompletionProvider(registry),
            ...CHARM_CONFIG_COMPLETION_TRIGGER_CHARS
        ),
        languages.registerCompletionItemProvider(
            { scheme: 'file', language: 'python' },
            new CharmEventCompletionProvider(registry),
            ...CHARM_EVENT_COMPLETION_TRIGGER_CHARS
        ),
    ];
}

function registerHoverProviders(registry: Registry): Disposable[] {
    return [
        languages.registerHoverProvider(
            { scheme: 'file', language: 'python' },
            new CharmConfigHoverProvider(registry)
        ),
        languages.registerHoverProvider(
            { scheme: 'file', language: 'python' },
            new CharmEventHoverProvider(registry)
        ),
    ];
}

function registerCodeActionProviders(registry: Registry): Disposable[] {
    return [
        languages.registerCodeActionsProvider(
            { scheme: 'file', language: 'python' },
            new EventHandlerCodeActionProvider(registry)
        ),
    ];
}

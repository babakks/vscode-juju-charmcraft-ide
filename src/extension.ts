import * as vscode from 'vscode';
import { EXTENSION_SCHEMA_DATA_DIR } from './constant';
import { ExtensionCore } from './extension.charm';
import { registerSchemas } from './extension.schema';
import { PythonExtension } from './external/ms-python.python';
import { ExtensionAPI } from './external/redhat.vscode-yaml';
import path = require('path');

export async function activate(context: vscode.ExtensionContext) {
    const python = vscode.extensions.getExtension('ms-python.python')?.exports as PythonExtension;
    if (!python) {
        throw new Error('Failed to retrieve `ms-python.python` extension API');
    }

    const yaml = vscode.extensions.getExtension("redhat.vscode-yaml")?.exports as ExtensionAPI;
    if (!yaml) {
        throw new Error('Failed to retrieve `redhat.vscode-yaml` extension API');
    }
    await registerSchemas(path.join(context.extensionPath, ...EXTENSION_SCHEMA_DATA_DIR), yaml);

    const output = vscode.window.createOutputChannel('Charms IDE');
    const ide = new ExtensionCore(output, python);
    context.subscriptions.push(ide);

    ide.setupCodeActionProviders();
    ide.setupCompletionProviders();
    ide.setupHoverProviders();

    await ide.refresh();
}

export function deactivate() { }

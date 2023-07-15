import * as vscode from 'vscode';
import { EXTENSION_SCHEMA_DATA_DIR } from './constant';
import { ExtensionCore } from './extension.charm';
import { registerSchemas } from './extension.schema';
import path = require('path');

export async function activate(context: vscode.ExtensionContext) {
    await registerSchemas(path.join(context.extensionPath, ...EXTENSION_SCHEMA_DATA_DIR));

    const ide = new ExtensionCore();
    context.subscriptions.push(ide);

    ide.setupCompletionProviders();
    ide.setupHoverProviders();

    await ide.refresh();
}

export function deactivate() { }

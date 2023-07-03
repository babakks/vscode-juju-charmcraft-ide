import * as vscode from 'vscode';
import { registerSchemas } from './schema';
import path = require('path');

const SCHEMA_DATA_DIR = ['schema', 'data']; // "[ROOT]/schema/data"

export async function activate(context: vscode.ExtensionContext) {
    await registerSchemas(path.join(context.extensionPath, ...SCHEMA_DATA_DIR));

    let disposable = vscode.commands.registerCommand('vscode-juju-charms-ide.helloWorld', () => {
        vscode.window.showInformationMessage('Hello World from Juju Charms IDE!');
    });
    context.subscriptions.push(disposable);
}

export function deactivate() { }

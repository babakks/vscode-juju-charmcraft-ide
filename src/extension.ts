import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('vscode-juju-charms-ide.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from Juju Charms IDE!');
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {}

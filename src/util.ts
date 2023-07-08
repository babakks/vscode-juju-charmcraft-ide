import { TextDecoder } from 'util';
import * as vscode from 'vscode';

export async function tryReadWorkspaceFileAsText(uri: vscode.Uri): Promise<undefined | string> {
    try {
        return new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
    } catch {
        return undefined;
    }
}
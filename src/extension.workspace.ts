import { TextDecoder } from 'util';
import * as vscode from 'vscode';

const GLOB_METADATA = '**/metadata.yaml';
const FILE_METADATA_YAML = 'metadata.yaml';
const FILE_CHARMCRAFT_YAML = 'charmcraft.yaml';

export async function findCharms(token?: vscode.CancellationToken): Promise<vscode.Uri[]> {
    const matches = await vscode.workspace.findFiles(GLOB_METADATA, undefined, undefined, token);
    const result: vscode.Uri[] = [];
    await Promise.allSettled(
        matches.map(async uri => {
            const parent = vscode.Uri.joinPath(uri, '..');
            if (await isCharmDirectory(parent)) {
                result.push(parent);
            }
        })
    );
    return result;
}

async function isCharmDirectory(uri: vscode.Uri): Promise<boolean> {
    return (await Promise.allSettled([
        vscode.workspace.fs.stat(vscode.Uri.joinPath(uri, FILE_CHARMCRAFT_YAML)),
        vscode.workspace.fs.stat(vscode.Uri.joinPath(uri, FILE_METADATA_YAML)),
    ])).every(x => x.status === 'fulfilled' && x.value.type === vscode.FileType.File);
}

export interface ChangedEventArgs {
    charmDir: vscode.Uri;
}

export async function tryReadWorkspaceFileAsText(uri: vscode.Uri): Promise<undefined | string> {
    try {
        return new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
    } catch {
        return undefined;
    }
}

// /**
//  * 
//  */
// export class CharmDetector implements vscode.Disposable {
//     private _disposables: vscode.Disposable[] = [];
//     private _onChanged = new vscode.EventEmitter<ChangedEventArgs>();
//     onChanged = this._onChanged.event;

//     constructor() {
//         const fsw = vscode.workspace.createFileSystemWatcher("");

//         this._disposables.push(this._onChanged);
//     }

//     dispose() {
//         this._disposables.forEach(x => x.dispose());
//     }
// }


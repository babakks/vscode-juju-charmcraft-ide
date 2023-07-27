import { spawn } from 'child_process';
import { mkdtemp, rm, rmdir, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { TextDecoder } from 'util';
import * as vscode from 'vscode';
import { CharmSourceCodeFile, CharmSourceCodeTree, DefaultCharmSourceCodeFile } from './charm.type';
import path = require('path');
import { CharmSourceCodeFileAnalyzer } from './charm.src';

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

export async function getCharmSourceCodeTree(charmHome: vscode.Uri, token?: vscode.CancellationToken): Promise<CharmSourceCodeTree | undefined> {
    async function readDir(uri: vscode.Uri): Promise<CharmSourceCodeTree | undefined> {
        if (token?.isCancellationRequested) {
            return undefined;
        }

        const result: CharmSourceCodeTree = {};
        const children = await vscode.workspace.fs.readDirectory(uri);
        for (const [name, entryType] of children) {
            const entryUri = vscode.Uri.joinPath(uri, name);
            if (entryType === vscode.FileType.File && name.endsWith('.py')) {
                const file = await createCharmSourceCodeFile(entryUri);
                result[name] = {
                    kind: 'file',
                    data: file,
                };
            } else if (entryType === vscode.FileType.Directory) {
                const subdir = await readDir(entryUri);
                if (!subdir) {
                    return undefined;
                }
                result[name] = { kind: 'directory', data: subdir, };
            }
        }
        return result;
    }
    return await readDir(charmHome);
}

export async function createCharmSourceCodeFile(uri: vscode.Uri): Promise<CharmSourceCodeFile> {
    const content = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
    return await createCharmSourceCodeFileFromContent(content);
}

export async function createCharmSourceCodeFileFromContent(content: string): Promise<CharmSourceCodeFile> {
    const ast = await getPythonAST(content)
    return new DefaultCharmSourceCodeFile(content, ast, ast !== undefined);
}

async function getPythonAST(content: string): Promise<any | undefined> {
    const tmp = await mkdtemp(path.join(tmpdir(), 'juju-charms-ide'));
    try {
        const tmpfile = path.join(tmp, 'temp.py');
        const scriptPath = path.join(__dirname, '../resource/ast/python-ast-to-json.py');
        await writeFile(tmpfile, content);

        const [exitCode, ast] = await new Promise<[number, string]>(function (resolve, reject) {
            let data = '';
            const process = spawn('python3', [scriptPath, tmpfile]);
            process.on('close', function (code) {
                resolve([code || 0, data]);
            });
            process.stdout.on('data', chunk => {
                data += chunk.toString();
            });
        });
        return exitCode === 0 ? JSON.parse(ast) : undefined;
    } catch {
        return undefined;
    } finally {
        await rm(tmp, { recursive: true, force: true });
    }
}

async function isCharmDirectory(uri: vscode.Uri): Promise<boolean> {
    return (await Promise.allSettled([
        vscode.workspace.fs.stat(vscode.Uri.joinPath(uri, FILE_CHARMCRAFT_YAML)),
        vscode.workspace.fs.stat(vscode.Uri.joinPath(uri, FILE_METADATA_YAML)),
    ])).every(x => x.status === 'fulfilled' && x.value.type === vscode.FileType.File);
}

export async function tryReadWorkspaceFileAsText(uri: vscode.Uri): Promise<undefined | string> {
    try {
        return new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
    } catch {
        return undefined;
    }
}

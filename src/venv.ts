import { spawn } from 'child_process';
import path = require('path');
import * as vscode from 'vscode';

export interface ExecutionResult {
    code: number | null;
    stdout: string;
    stderr: string;
}

export type ExecutionEnv = {
    [key: string]: string | undefined;
};

export class VirtualEnv implements vscode.Disposable {
    private readonly _disposables: vscode.Disposable[] = [];
    /**
     * Maps a tuple of group (e.g., `testenv` in tox environments like
     * `testenv:lint`) and CWD (as a single JSON string) to terminals.
     */
    private readonly _terminalMap = new Map<string, vscode.Terminal>();

    constructor(readonly charmHome: vscode.Uri, readonly virtualEnvDir: string = 'venv') {
        if (this.charmHome.scheme !== 'file') {
            throw new Error('Only `file://` scheme is supported');
        }
        if (this.virtualEnvDir === '') {
            throw new Error('Virtual environment directory cannot be empty string');
        }

        this._disposables.push(vscode.window.onDidCloseTerminal(e => {
            for (const [k, v] of this._terminalMap) {
                if (v === e) {
                    this._terminalMap.delete(k);
                    return;
                }
            }
        }));
    }

    dispose() {
        this._disposables.forEach(x => x.dispose());
    }

    async create(): Promise<ExecutionResult> {
        // if (this.isCreated) {
        //     throw new Error('Virtual environment is already created');
        // }
        const result = await this._exec(
            this.charmHome.path,
            'sh',
            [
                getResourceScriptPath('create.sh'),
                this.virtualEnvDir,
            ],
            undefined,
            true,
        );
        return result;
    }

    async delete(): Promise<ExecutionResult> {
        // if (!this.isCreated) {
        //     throw new Error('Virtual environment is not created yet');
        // }
        const result = await this._exec(
            this.charmHome.path,
            'sh',
            [
                getResourceScriptPath('delete.sh'),
                this.virtualEnvDir,
            ],
            undefined,
            true,
        );
        return result;
    }

    async setup(): Promise<ExecutionResult> {
        const result = await this._exec(this.charmHome.path, 'sh', [getResourceScriptPath('setup.sh')]);
        return result;
    }

    /**
     * Executes given command within the virtual environment, in the charm home
     * directory.
     */
    async exec(command: string, args?: string[], cwd?: vscode.Uri, env?: ExecutionEnv): Promise<ExecutionResult> {
        return await this._exec(cwd?.fsPath ?? this.charmHome.path, command, args, env);
    }

    private async _exec(
        cwd: string,
        command: string,
        args?: string[],
        env?: ExecutionEnv,
        notActivate?: boolean,
    ): Promise<ExecutionResult> {
        let modifiedCommand: string;
        let modifiedArgs: string[] | undefined;

        if (notActivate) {
            modifiedCommand = command;
            modifiedArgs = args;
        } else {
            modifiedCommand = 'sh';
            modifiedArgs = [
                '-c',
                this._prependActivateCommand(`${command}${args ? ' "$@"' : ''}`),
                "",
                ...args ?? [],
            ];
        }

        return await new Promise<ExecutionResult>(resolve => {
            const cp = spawn(modifiedCommand, modifiedArgs, { cwd, env });
            const result: ExecutionResult = {
                code: 0,
                stdout: '',
                stderr: '',
            };
            cp.stdout.on('data', (data) => {
                result.stdout += (data.toString() as string).replace(/\r?\n/g, '\r\n');
            });
            cp.stderr.on('data', (data) => {
                result.stderr += (data.toString() as string).replace(/\r?\n/g, '\r\n');;
            });
            cp.on('close', (code) => {
                result.code = code;
                resolve(result);
            });
        });
    }

    execInTerminal(group: string, command: string, cwd?: vscode.Uri, env?: ExecutionEnv, terminalName?: string): vscode.Terminal {
        const terminal = this._getOrCreateTerminal(group, cwd, env, terminalName);
        const modifiedCommand = this._prependActivateCommand(command);
        terminal.sendText(modifiedCommand, true);
        return terminal;
    }

    private _getOrCreateTerminal(group: string, cwd?: vscode.Uri, env?: ExecutionEnv, terminalName?: string): vscode.Terminal {
        const getKey = () => JSON.stringify([group, cwd?.path ?? this.charmHome.path]);
        const terminal = this._terminalMap.get(getKey());
        if (terminal) {
            return terminal;
        }
        const created = vscode.window.createTerminal({
            name: terminalName || group || undefined,
            cwd: cwd ?? this.charmHome,
            env,
        });
        this._terminalMap.set(getKey(), created);
        return created;
    }

    private _prependActivateCommand(command: string): string {
        return `. ${quoteForShell(`${this.virtualEnvDir}/bin/activate`)} && ${command}`;
    }
}

function getResourceScriptPath(name: string): string {
    return path.join(__dirname, '../resource/venv', name);
}

function quoteForShell(value: string) {
    return '"' + value.replace(/(["'$`\\])/g, '\\$1') + '"';
}

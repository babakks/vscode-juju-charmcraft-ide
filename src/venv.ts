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

export class VirtualEnv {
    // private _isCreated: boolean = false;
    // private _isSetUp: boolean = false;

    constructor(readonly home: vscode.Uri, readonly dir: string = 'venv') {
        if (this.home.scheme !== 'file') {
            throw new Error('Only `file://` scheme is supported');
        }
        if (this.dir === '') {
            throw new Error('Virtual environment directory cannot be empty string');
        }
    }

    // get isCreated(): boolean {
    //     return this._isCreated;
    // }

    // get isSetUp(): boolean {
    //     return this._isSetUp;
    // }

    async create(): Promise<ExecutionResult> {
        // if (this.isCreated) {
        //     throw new Error('Virtual environment is already created');
        // }
        const result = await this._exec(
            this.home.path,
            'sh',
            [
                getResourceScriptPath('create.sh'),
                this.dir,
            ],
            undefined,
            true,
        );
        // if (result.code === 0) {
        //     this._isCreated = true;
        // }
        return result;
    }

    async delete(): Promise<ExecutionResult> {
        // if (!this.isCreated) {
        //     throw new Error('Virtual environment is not created yet');
        // }
        const result = await this._exec(
            this.home.path,
            'sh',
            [
                getResourceScriptPath('delete.sh'),
                this.dir,
            ],
            undefined,
            true,
        );
        // if (result.code === 0) {
        //     this._isCreated = false;
        //     this._isSetUp = false;
        // }
        return result;
    }

    async setup(): Promise<ExecutionResult> {
        // if (!this.isCreated) {
        //     throw new Error('Virtual environment is not created yet');
        // }
        const result = await this._exec(this.home.path, 'sh', [getResourceScriptPath('setup.sh')]);
        // if (result.code === 0) {
        //     this._isSetUp = true;
        // }
        return result;
    }

    async exec(command: string, args?: string[], env?: ExecutionEnv): Promise<ExecutionResult> {
        // if (!this.isCreated) {
        //     throw new Error('Virtual environment is not created yet');
        // }
        // if (!this.isSetUp) {
        //     throw new Error('Virtual environment is not set up yet');
        // }
        return await this._exec(this.home.path, command, args, env);
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
                `. ${quoteForShell(`${this.dir}/bin/activate`)} && ${command}${args ? ' "$@"' : ''}`,
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
}

function getResourceScriptPath(name: string): string {
    return path.join(__dirname, '../resource/venv', name);
}

function quoteForShell(value: string) {
    return '"' + value.replace(/(["'$`\\])/g, '\\$1') + '"';
}

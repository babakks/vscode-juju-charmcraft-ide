import path = require("path");
import { Range } from "./model/common";

export type Linter =
    'flake8' | 'pflake8'
    | 'pylint'
    | 'ruff'
    | 'mypy'
    | 'codespell'
    | 'pydocstyle';

export interface LinterMessage {
    linter: Linter | undefined;
    absolutePath?: string;
    relativePath?: string;
    range: Range;
    message: string;
}

export type LinterOutputParser = (lines: string[]) => LinterMessage[];

const parsers = new Map<Linter, LinterOutputParser>([
    ['flake8', flake8OutputParser],
    ['pflake8', flake8OutputParser],
    ['pylint', pylintOutputParser],
    ['ruff', ruffOutputParser],
    ['mypy', mypyOutputParser],
    ['codespell', codespellOutputParser],
    ['pydocstyle', pydocstyleOutputParser],
]);

const commandHeadPattern = /^(?<env>.*): commands\[(?<cmdIndex>\d+)\]> (?<cmd>.*)$/;
const commandExitPattern = /^(?<env>.*): exit \d+ \(.*?\) .*?> (?<cmd>.*?)(?: |$)/;
const shellWrappedCommandPattern = /^(?:sh|bash|zsh|fish) +-c +['"]?(?<linter>.*?)(?: |$)/;
export function parseToxLinterOutput(output: string): LinterMessage[] {
    const lines = output.split(/\r?\n/g);
    const detectedLinters: { name: string, start: number, end?: number }[] = [];
    for (let n = 0; n < lines.length; n++) {
        const line = lines[n];

        // Note that the "command exit" lines only appear when the corresponding command exits with a non-zero code.
        const matchEnd = line.match(commandExitPattern);
        if (matchEnd) {
            const linter = getLinterFromCommand(matchEnd.groups!['cmd']);
            if (detectedLinters[-1 + detectedLinters.length]?.name === linter) {
                detectedLinters[-1 + detectedLinters.length].end = n;
            }
            continue;
        }

        const match = line.match(commandHeadPattern);
        if (!match) {
            continue;
        }
        const linter = getLinterFromCommand(match.groups!['cmd']);
        detectedLinters.push({ name: linter, start: n });
    }

    const result: LinterMessage[] = [];
    for (let l = 0; l < detectedLinters.length; l++) {
        const linter = detectedLinters[l];
        const nextLinter = detectedLinters[1 + l];
        if (!parsers.has(linter.name as Linter)) {
            continue;
        }
        const slice = lines.slice(1 + linter.start, linter.end ?? nextLinter?.start);
        result.push(...parsers.get(linter.name as Linter)!(slice));
    }
    return result;

    function getLinterFromCommand(command: string): string {
        const match = command.match(shellWrappedCommandPattern);
        if (match) {
            return match.groups!['linter'];
        }
        return command.substring(0, command.indexOf(' '));
    }
}

const _GENERIC_PATTERN = /^(?<path>.*?):(?<line>\d+):?(?:(?<col>\d+):?)?(?<message>.*)$/;
export function parseGenericLinterOutput(output: string): LinterMessage[] {
    const lines = output.split(/\r?\n/g);
    const result: LinterMessage[] = [];
    for (const line of lines) {
        const match = line.match(_GENERIC_PATTERN);
        if (!match) {
            continue;
        }

        const filePath = match.groups!['path']!;
        const lineNumber = parseInt(match.groups!['line']!);
        const colNumber = match.groups!['col'] !== undefined ? parseInt(match.groups!['col']) : undefined;
        const range: Range = {
            start: { line: -1 + lineNumber, character: colNumber ?? 0 },
            end: { line: lineNumber, character: 0 },
        };

        const message = match.groups!['message'].trim();
        result.push({
            linter: undefined,
            range,
            message,
            ...(path.isAbsolute(filePath) ? { absolutePath: filePath } : { relativePath: filePath }),
        });
    }
    return result;
}

const _FLAKE8_PATTERN = /^(?<absolutePath>.*?):(?<line>\d+):(?<col>\d+): (?<message>.*)$/;
const _FLAKE8_LINTER: Linter = 'flake8';
export function flake8OutputParser(lines: string[]): LinterMessage[] {
    const result: LinterMessage[] = [];
    for (const line of lines) {
        const match = line.match(_FLAKE8_PATTERN);
        if (!match) {
            continue;
        }

        const absolutePath = match.groups!['absolutePath']!;
        const lineNumber = parseInt(match.groups!['line']!);
        const colNumber = parseInt(match.groups!['col']!);
        const range: Range = {
            start: { line: -1 + lineNumber, character: -1 + colNumber },
            end: { line: lineNumber, character: 0 },
        };

        const message = match.groups!['message'];
        result.push({ linter: _FLAKE8_LINTER, absolutePath, range, message });
    }
    return result;
}

const _PYLINT_PATTERN = /^(?<relativePath>.*?):(?<line>\d+):(?<col>\d+): (?<message>.*)$/;
const _PYLINT_LINTER: Linter = 'pylint';
export function pylintOutputParser(lines: string[]): LinterMessage[] {
    const result: LinterMessage[] = [];
    for (const line of lines) {
        const match = line.match(_PYLINT_PATTERN);
        if (!match) {
            continue;
        }

        const relativePath = match.groups!['relativePath']!;
        const lineNumber = parseInt(match.groups!['line']!);
        const colNumber = parseInt(match.groups!['col']!);
        const range: Range = {
            start: { line: -1 + lineNumber, character: colNumber },
            end: { line: lineNumber, character: 0 },
        };

        const message = match.groups!['message'];
        result.push({ linter: _PYLINT_LINTER, relativePath, range, message });
    }
    return result;
}

const _RUFF_PATTERN = /^(?<relativePath>.*?):(?<line>\d+):(?<col>\d+): (?<message>.*)$/;
const _RUFF_LINTER: Linter = 'ruff';
export function ruffOutputParser(lines: string[]): LinterMessage[] {
    const result: LinterMessage[] = [];
    for (const line of lines) {
        const match = line.match(_RUFF_PATTERN);
        if (!match) {
            continue;
        }

        const relativePath = match.groups!['relativePath']!;
        const lineNumber = parseInt(match.groups!['line']!);
        const colNumber = parseInt(match.groups!['col']!);
        const range: Range = {
            start: { line: -1 + lineNumber, character: -1 + colNumber },
            end: { line: lineNumber, character: 0 },
        };

        const message = match.groups!['message'];
        result.push({ linter: _RUFF_LINTER, relativePath, range, message });
    }
    return result;
}

const _MYPY_PATTERN = /^(?<relativePath>.*?):(?<line>\d+): (?<message>.*)$/;
const _MYPY_LINTER: Linter = 'mypy';
export function mypyOutputParser(lines: string[]): LinterMessage[] {
    const result: LinterMessage[] = [];
    for (const line of lines) {
        const match = line.match(_MYPY_PATTERN);
        if (!match) {
            continue;
        }

        const relativePath = match.groups!['relativePath']!;
        const lineNumber = parseInt(match.groups!['line']!);
        const range: Range = {
            start: { line: -1 + lineNumber, character: 0 },
            end: { line: lineNumber, character: 0 },
        };

        const message = match.groups!['message'];
        result.push({ linter: _MYPY_LINTER, relativePath, range, message });
    }
    return result;
}

const _CODESPELL_PATTERN = /^(?<absolutePath>.*?):(?<line>\d+): (?<message>.*)$/;
const _CODESPELL_LINTER: Linter = 'codespell';
export function codespellOutputParser(lines: string[]): LinterMessage[] {
    const result: LinterMessage[] = [];
    for (const line of lines) {
        const match = line.match(_CODESPELL_PATTERN);
        if (!match) {
            continue;
        }

        const absolutePath = match.groups!['absolutePath']!;
        const lineNumber = parseInt(match.groups!['line']!);
        const range: Range = {
            start: { line: -1 + lineNumber, character: 0 },
            end: { line: lineNumber, character: 0 },
        };

        const message = match.groups!['message'];
        result.push({ linter: _CODESPELL_LINTER, absolutePath, range, message });
    }
    return result;
}

const _PYDOCSTYLE_PATTERN = /^(?<absolutePath>.*?):(?<line>\d+) (?<location>.*)$/;
const _PYDOCSTYLE_LINTER: Linter = 'pydocstyle';
export function pydocstyleOutputParser(lines: string[]): LinterMessage[] {
    const result: LinterMessage[] = [];
    for (const line of lines) {
        const match = line.match(_PYDOCSTYLE_PATTERN);
        if (!match) {
            const last = result[-1 + result.length];
            if (last) {
                last.message += ' ' + line.trim();
            }
            continue;
        }

        const absolutePath = match.groups!['absolutePath']!;
        const lineNumber = parseInt(match.groups!['line']!);
        const message = match.groups!['location'];
        const range: Range = {
            start: { line: -1 + lineNumber, character: 0 },
            end: { line: lineNumber, character: 0 },
        };

        result.push({ linter: _PYDOCSTYLE_LINTER, absolutePath, range, message });
    }
    return result;
}

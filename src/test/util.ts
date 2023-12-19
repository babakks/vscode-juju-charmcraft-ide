import { Range } from "../model/common";

export function newRange(startLine: number, startCharacter: number, endLine: number, endCharacter: number): Range {
    return {
        start: { line: startLine, character: startCharacter },
        end: { line: endLine, character: endCharacter },
    };
}

export function unindent(s: string): string {
    const lines = s.split('\n');
    if (lines[0] !== '') {
        throw new Error('First line should be empty');
    }
    lines.splice(0, 1);

    let indent = 0;
    let index = 0;
    const pattern = /^(\s+)/;
    for (; index < lines.length; index++) {
        const match = lines[index].match(pattern);
        if (match) {
            indent = match[1].length;
            break;
        }
    }
    return lines.map((x, i) => i >= index ? x.substring(indent) : x).join('\n').trimEnd();
}
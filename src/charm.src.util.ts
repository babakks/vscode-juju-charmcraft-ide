import { Position, Range } from "./charm.type";
import { comparePositions } from "./charm.util";

export function getNodeRange(node: any): Range {
    return {
        start: { line: -1 + Number.parseInt(node.lineno), character: Number.parseInt(node.col_offset) },
        end: { line: -1 + Number.parseInt(node.end_lineno), character: Number.parseInt(node.end_col_offset) },
    };
}

export function getNodeExtendedRange(node: any, nextNode: any): Range {
    const range = getNodeRange(node);
    if (!nextNode) {
        return getNodeRange(node);
    }
    const nextNodeRange = getNodeRange(nextNode);
    const firstDecorator = nextNode['decorator_list']?.[0];
    const nextNodeStart = firstDecorator ? getNodeRange(firstDecorator).start : nextNodeRange.start;
    return nextNodeStart.line === range.end.line
        ? { start: range.start, end: nextNodeStart }
        : { start: range.start, end: { line: nextNodeStart.line, character: 0 } };
}

export function unquoteSymbol(s: string): string {
    if (s.length < 2) {
        return s;
    }
    const quote = s.charAt(0);
    if (quote !== '"' && quote !== "'") {
        return s;
    }
    if (s.charAt(-1 + s.length) !== quote) {
        return s;
    }
    return s.substring(1, -1 + s.length);
}

const POSITION_ZERO = { line: 0, character: 0 };
export function getTextOverRange(lines: string[], range: Range): string {
    if (!lines.length) {
        return '';
    }

    const start = comparePositions(range.start, POSITION_ZERO) === -1 ? POSITION_ZERO : range.start;
    const max: Position = { line: -1 + lines.length, character: lines[-1 + lines.length].length };
    const end = comparePositions(range.end, max) === 1 ? max : range.end;

    if (comparePositions(start, end) === 1) {
        return '';
    }

    const portion = lines.slice(start.line, 1 + end.line);
    portion[-1 + portion.length] = portion[-1 + portion.length].substring(0, end.character);
    portion[0] = portion[0].substring(start.character);
    return portion.join('\n');
}

const REGEXP_SPECIAL_CHARS = /[/\-\\^$*+?.()|[\]{}]/g;
export function escapeRegex(s: string): string {
    return s.replace(REGEXP_SPECIAL_CHARS, '\\$&');
}

export type DeepSearchCallbackNode = { kind: 'object'; value: object } | { kind: 'array'; value: Array<any> };
export type DeepSearchCallback = (key: any, node: DeepSearchCallbackNode) => boolean | DeepSearchCallback;

export function deepSearch(node: any, callback: DeepSearchCallback) {
    _deepSearch([node], callback);
    function _deepSearch(node: any, callback: DeepSearchCallback) {
        if (typeof node !== 'object') {
            return;
        }
        if (Array.isArray(node)) {
            for (let i = 0; i < node.length; i++) {
                const element = node[i];
                if (typeof element !== 'object') {
                    continue;
                }
                const arg: DeepSearchCallbackNode = Array.isArray(element) ? { kind: 'array', value: element } : { kind: 'object', value: element };
                const dig = callback(i, arg);
                if (dig === false) {
                    continue;
                }
                const nextCallback = dig === true ? callback : dig;
                _deepSearch(element, nextCallback);
            }
        } else {
            for (const key in node) {
                const value = node[key];
                if (typeof value !== 'object') {
                    continue;
                }
                const arg: DeepSearchCallbackNode = Array.isArray(value) ? { kind: 'array', value: value } : { kind: 'object', value: value };
                const dig = callback(key, arg);
                if (dig === false) {
                    continue;
                }
                const nextCallback = dig === true ? callback : dig;
                _deepSearch(value, nextCallback);
            }
        }
    }
}

export function deepSearchForPattern(node: any, pattern: any): any | undefined {

}
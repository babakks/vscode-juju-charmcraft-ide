import { Position, Range } from "./charm.type";

export function comparePositions(a: Position, b: Position): -1 | 0 | 1 {
    return a.line === b.line && a.character === b.character ? 0 :
        a.line < b.line || a.line === b.line && a.character < b.character ? -1 : 1;
}

export function isInRange(position: Position, range: Range): boolean {
    return (position.line > range.start.line || position.line === range.start.line && position.character >= range.start.character)
        && (position.line < range.end.line || position.line === range.end.line && position.character < range.end.character);
}
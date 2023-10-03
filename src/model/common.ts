export const CHARM_DIR_SRC = 'src';
export const CHARM_DIR_SRC_MAIN = 'charm.py';
export const CHARM_DIR_LIB = 'lib';
export const CHARM_DIR_TESTS = 'tests';
export const CHARM_DIR_VENV = 'venv';
export const CHARM_FILE_ACTIONS_YAML = 'actions.yaml';
export const CHARM_FILE_CONFIG_YAML = 'config.yaml';
export const CHARM_FILE_METADATA_YAML = 'metadata.yaml';
export const CHARM_FILE_CHARMCRAFT_YAML = 'charmcraft.yaml';
export const CHARM_FILE_TOX_INI = 'tox.ini';
export const CHARM_SOURCE_CODE_CHARM_BASE_CLASS = 'CharmBase';

export interface Position {
    /**
     * Zero-base line number.
     */
    line: number;

    /**
     * Zero-base character offset.
     */
    character: number;
}

/**
 * Represents a range with exclusive end; [start,end).
 */
export interface Range {
    /**
     * Start position (inclusive).
     */
    start: Position;

    /**
     * End position (exclusive).
     */
    end: Position;
}

export function zeroPosition(): Position {
    return { line: 0, character: 0 };
}

export function zeroRange(): Range {
    return { start: zeroPosition(), end: zeroPosition() };
}

export function comparePositions(a: Position, b: Position): -1 | 0 | 1 {
    return a.line === b.line && a.character === b.character ? 0 :
        a.line < b.line || a.line === b.line && a.character < b.character ? -1 : 1;
}

export function isInRange(position: Position, range: Range): boolean {
    return (position.line > range.start.line || position.line === range.start.line && position.character >= range.start.character)
        && (position.line < range.end.line || position.line === range.end.line && position.character < range.end.character);
}

export function toValidSymbol(value: string): string {
    return value.replace(/-/g, '_');
}

export class TextPositionMapper {
    readonly lines: string[];
    private readonly _offsets: number[];

    constructor(readonly content: string) {
        this.lines = content.split('\n');
        this._offsets = new Array<number>(this.lines.length);
        let cursor = 0;
        for (let i = 0; i < this.lines.length; i++) {
            this._offsets[i] = cursor;
            cursor += 1 + this.lines[i].length;
            if (this.lines[i].endsWith('\r')) {
                this.lines[i] = this.lines[i].substring(0, -1 + this.lines[i].length);
            }
        }
    }

    indexToPosition(index: number): Position {
        if (!Number.isInteger(index)) {
            index = Math.floor(index);
        }
        if (!this.content.length) {
            return { line: 0, character: 0 };
        }
        for (let i = -1 + this._offsets.length; i >= 0; i--) {
            if (this._offsets[i] <= index) {
                const delta = index - this._offsets[i];
                if (i === -1 + this.lines.length && this.lines[i].length && delta >= this.lines[i].length) {
                    return { line: 1 + i, character: 0 };
                }
                return {
                    line: i,
                    character: delta <= this.lines[i].length ? delta : this.lines[i].length,
                };
            }
        }
        return {
            line: -1 + this.lines.length,
            character: this.lines[-1 + this.lines.length].length,
        };
    }

    positionToIndex(position: Position): number {
        const posLine = Number.isInteger(position.line) ? position.line : Math.floor(position.line);
        const posCharacter = Number.isInteger(position.character) ? position.character : Math.floor(position.character);
        if (posLine > -1 + this.lines.length) {
            return this.content.length;
        }
        if (posLine < 0) {
            return 0;
        }
        if (posCharacter < 0) {
            return this._offsets[posLine];
        }
        const line = this.lines[posLine];
        if (posCharacter >= line.length) {
            return this._offsets[posLine] + line.length;
        }
        return this._offsets[posLine] + posCharacter;
    }

    /**
     * @returns A range that covers all of the content.
     */
    all(): Range {
        return {
            start: { line: 0, character: 0 },
            end: this.indexToPosition(this.content.length),
        };
    }

    getTextOverRange(range: Range): string {
        if (!this.lines.length) {
            return '';
        }

        const zero = zeroPosition();
        const start = comparePositions(range.start, zero) === -1 ? zero : range.start;
        const max: Position = { line: -1 + this.lines.length, character: this.lines[-1 + this.lines.length].length };
        const end = comparePositions(range.end, max) === 1 ? max : range.end;

        if (comparePositions(start, end) === 1) {
            return '';
        }

        const portion = this.lines.slice(start.line, 1 + end.line);
        portion[-1 + portion.length] = portion[-1 + portion.length].substring(0, end.character);
        portion[0] = portion[0].substring(start.character);

        if (portion[-1 + portion.length] === '') {
            portion.pop();
        }
        if (portion[0] === '') {
            portion.splice(0, 1);
        }
        return portion.join('\n');
    }
}
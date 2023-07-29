export const CHARM_DIR_SRC = 'src';
export const CHARM_DIR_SRC_MAIN = 'charm.py';
export const CHARM_DIR_LIB = 'lib';
export const CHARM_FILE_ACTIONS_YAML = 'actions.yaml';
export const CHARM_FILE_CONFIG_YAML = 'config.yaml';
export const CHARM_FILE_METADATA_YAML = 'metadata.yaml';
export const CHARM_FILE_CHARMCRAFT_YAML = 'charmcraft.yaml';
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

export function comparePositions(a: Position, b: Position): -1 | 0 | 1 {
    return a.line === b.line && a.character === b.character ? 0 :
        a.line < b.line || a.line === b.line && a.character < b.character ? -1 : 1;
}

export function isInRange(position: Position, range: Range): boolean {
    return (position.line > range.start.line || position.line === range.start.line && position.character >= range.start.character)
        && (position.line < range.end.line || position.line === range.end.line && position.character < range.end.character);
}

import { TextDecoder } from 'util';
import { MarkdownString, Uri, Range as VSCodeRange, workspace } from 'vscode';
import { CharmEvent, type CharmConfigOption } from './model/charm';
import { Range } from './model/common';

const SEPARATOR = '\n<hr/>\n\n';

export function getConfigOptionDocumentation(configOption: CharmConfigOption, includeTitle?: boolean): MarkdownString {
    const result = new MarkdownString();
    result.supportHtml = true;

    if (includeTitle) {
        result.appendMarkdown(`\`${configOption.name}\` *[charm configuration]* ${SEPARATOR}`);
    }

    if (configOption.type !== undefined && configOption.default !== undefined) {
        result.appendMarkdown(`**Type:** ${configOption.type}<br/>**Default:** \`${JSON.stringify(configOption.default)}\` ${SEPARATOR}`);
    } else if (configOption.type !== undefined) {
        result.appendMarkdown(`**Type:** ${configOption.type} ${SEPARATOR}`);
    } else if (configOption.default !== undefined) {
        result.appendMarkdown(`**Default:** \`${JSON.stringify(configOption.default)}\` ${SEPARATOR}`);
    }

    if (configOption.description !== undefined) {
        result.appendMarkdown(configOption.description);
    }
    return result;
}

export function getEventDocumentation(event: CharmEvent, includeTitle?: boolean): MarkdownString {
    const result = new MarkdownString();
    result.supportHtml = true;

    if (includeTitle) {
        let source: string = '';
        switch (event.source) {
            case 'action': source = 'action'; break;
            case 'storage': source = 'storage'; break;
            case 'container': source = 'container'; break;
            case 'endpoints/peer': source = 'peer'; break;
            case 'endpoints/provides': source = 'provides'; break;
            case 'endpoints/requires': source = 'requires'; break;
        }
        if (source) {
            result.appendMarkdown(`\`${event.name}\` *[charm event: ${source}]* ${SEPARATOR}`);
        } else {
            result.appendMarkdown(`\`${event.name}\` *[charm event]* ${SEPARATOR}`);
        }
    }
    if (event.description) {
        result.appendMarkdown(event.description);
    }
    return result;
}

export async function tryReadWorkspaceFileAsText(uri: Uri): Promise<undefined | string> {
    try {
        return new TextDecoder().decode(await workspace.fs.readFile(uri));
    } catch {
        return undefined;
    }
}

export function rangeToVSCodeRange(range: Range): VSCodeRange {
    return new VSCodeRange(range.start.line, range.start.character, range.end.line, range.end.character);
}

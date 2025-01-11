import { TextDecoder } from 'util';
import { MarkdownString, Uri, Range as VSCodeRange, workspace } from 'vscode';
import { CharmEvent } from './model/charm';
import { Range } from './model/common';
import type { CharmConfigYAMLParameter } from './model/config.yaml';

const SEPARATOR = '\n<hr/>\n\n';

export function getConfigParamDocumentation(param: CharmConfigYAMLParameter, includeTitle?: boolean): MarkdownString {
    const result = new MarkdownString();
    result.supportHtml = true;

    if (includeTitle) {
        result.appendMarkdown(`\`${param.name}\` *[charm configuration]* ${SEPARATOR}`);
    }

    if (param.type?.value && param.default?.value !== undefined) {
        result.appendMarkdown(`**Type:** ${param.type.value}<br/>**Default:** \`${JSON.stringify(param.default.value)}\` ${SEPARATOR}`);
    } else if (param.type?.value) {
        result.appendMarkdown(`**Type:** ${param.type.value} ${SEPARATOR}`);
    } else if (param.default?.value !== undefined) {
        result.appendMarkdown(`**Default:** \`${JSON.stringify(param.default.value)}\` ${SEPARATOR}`);
    }

    if (param.description?.value) {
        result.appendMarkdown(param.description.value);
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

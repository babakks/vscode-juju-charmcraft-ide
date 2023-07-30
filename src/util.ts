import { TextDecoder } from 'util';
import { MarkdownString, Uri, workspace } from 'vscode';
import { CharmConfigParameter, CharmEvent } from './model/charm';

const SEPARATOR = '\n<hr/>\n\n';

export function getConfigParamDocumentation(param: CharmConfigParameter, includeTitle?: boolean): MarkdownString {
    const result = new MarkdownString();
    result.supportHtml = true;

    if (includeTitle) {
        result.appendMarkdown(`\`${param.name}\` *(charm configuration parameter)* ${SEPARATOR}`);
    }

    if (param.type && param.default !== undefined) {
        result.appendMarkdown(`**Type:** ${param.type}<br/>**Default:** \`${JSON.stringify(param.default)}\` ${SEPARATOR}`);
    } else if (param.type) {
        result.appendMarkdown(`**Type:** ${param.type} ${SEPARATOR}`);
    } else if (param.default !== undefined) {
        result.appendMarkdown(`**Default:** \`${JSON.stringify(param.default)}\` ${SEPARATOR}`);
    }

    if (param.description) {
        result.appendMarkdown(param.description);
    }
    return result;
}

export function getEventDocumentation(event: CharmEvent, includeTitle?: boolean): MarkdownString {
    const result = new MarkdownString();
    result.supportHtml = true;

    if (includeTitle) {
        result.appendMarkdown(`\`${event.name}\` *(charm event)* ${SEPARATOR}`);
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

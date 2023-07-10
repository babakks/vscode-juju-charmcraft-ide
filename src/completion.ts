import * as vscode from 'vscode';
import { CompletionItem, CompletionItemProvider, Uri } from 'vscode';
import { Charm } from './charm';
import { CharmConfigParameter, CharmEvent } from './charmTypes';

export type CharmProvider = (uri: Uri) => Charm | undefined;

const REGEX_SELF_CONFIG = /self\.config\[(?<quote>["']?)$/;
const REGEX_SELF_CONFIG_GET = /self\.config.get\((?<quote>["']?)$/;
export const CHARM_CONFIG_COMPLETION_TRIGGER_CHARS = ['[', '(', '"', "'"];

export class CharmConfigParametersCompletionProvider implements CompletionItemProvider<CompletionItem> {
    constructor(readonly charmProvider: CharmProvider) { }

    provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>> {
        const charm = this.charmProvider(document.uri);
        if (!charm || token.isCancellationRequested) {
            return;
        }

        const leadingTextToCursor = document.getText(new vscode.Range(new vscode.Position(position.line, 0), position));
        const match = leadingTextToCursor.match(REGEX_SELF_CONFIG) || leadingTextToCursor.match(REGEX_SELF_CONFIG_GET);
        if (!match) {
            return;
        }

        const openQuote = match.groups!['quote'];
        const nextChar = document.getText(new vscode.Range(position, new vscode.Position(position.line, 1 + position.character)));
        const hasMatchingCloseQuote = nextChar === openQuote;

        const result: CompletionItem[] = [];
        for (const p of charm.config.parameters) {
            result.push({
                label: p.name,
                insertText: openQuote
                    ? (p.name + (hasMatchingCloseQuote ? '' : openQuote))
                    : `"${p.name}"`,
                sortText: "0",
                detail: p.name,
                documentation: this.formatDocumentation(p),
            });
        }
        return result;

    }
    resolveCompletionItem?(item: vscode.CompletionItem, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CompletionItem> {
        return;
    }

    formatDocumentation(param: CharmConfigParameter): vscode.MarkdownString {
        const result = new vscode.MarkdownString();
        result.supportHtml = true;
        if (param.type !== undefined) {
            result.appendMarkdown(`**Type:** ${param.type}<br/>`);
        }
        if (param.default !== undefined) {
            result.appendMarkdown(`(default: \`${JSON.stringify(param.default)}\`)`);
        }
        if (param.description) {
            if (result.value !== '') {
                result.appendText('\n\n');
            }
            result.appendMarkdown(param.description);
        }
        return result;
    }
}


const SELF_ON = 'self.on.';
const SELF_FRAMEWORK_OBSERVE = 'self.framework.observe(';
const SELF_FRAMEWORK_OBSERVE_SELF_ON = 'self.framework.observe(self.on.';

const TRAILING_CLOSE_BRACKET = ')';
export const CHARM_EVENT_COMPLETION_TRIGGER_CHARS = ['.', '('];

export class CharmEventCompletionProvider implements CompletionItemProvider<CompletionItem> {
    constructor(readonly charmProvider: CharmProvider) { }

    provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>> {
        const charm = this.charmProvider(document.uri);
        if (!charm || token.isCancellationRequested) {
            return;
        }

        const leadingTextToCursor = document.getText(new vscode.Range(new vscode.Position(position.line, 0), position));

        const isFullEventSubscription = leadingTextToCursor.endsWith(SELF_FRAMEWORK_OBSERVE_SELF_ON);
        const isPartialEventSubscription = !isFullEventSubscription && leadingTextToCursor.endsWith(SELF_FRAMEWORK_OBSERVE);
        const match = isFullEventSubscription || isPartialEventSubscription || leadingTextToCursor.endsWith(SELF_ON);
        if (!match) {
            return;
        }

        const remainingLineText = document.getText(new vscode.Range(position, new vscode.Position(1 + position.line, 0)));
        const isNextCharClosedBracket = (isFullEventSubscription || isPartialEventSubscription) && remainingLineText.endsWith(')');

        const result: CompletionItem[] = [];
        for (const e of charm.events) {
            const item: CompletionItem = {
                label: e.name,
                insertText: e.name,
                sortText: '0',
                detail: e.name,
                documentation: this.formatDocumentation(e),
            };

            if (isFullEventSubscription) {
                item.insertText = `${e.name}, self._on_${e.name}${isNextCharClosedBracket ? '' : ')'}`;
            } else if (isPartialEventSubscription) {
                item.label = `self.on.${e.name}`;
                item.insertText = `self.on.${e.name}, self._on_${e.name}${isNextCharClosedBracket ? '' : ')'}`;
            }
            if (typeof item.insertText === 'string' && remainingLineText.startsWith(item.insertText)) {
                item.insertText = '';
            }
            result.push(item);
        }
        return result;

    }
    resolveCompletionItem?(item: vscode.CompletionItem, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CompletionItem> {
        return;
    }

    formatDocumentation(e: CharmEvent): vscode.MarkdownString {
        const result = new vscode.MarkdownString();
        result.supportHtml = true;
        if (e.description) {
            result.appendMarkdown(e.description);
        }
        return result;
    }
}

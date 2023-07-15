import * as vscode from 'vscode';
import { CompletionItem, CompletionItemProvider, Uri } from 'vscode';
import { CharmConfigParameter } from './charmTypes';
import { getConfigParamDocumentation, getEventDocumentation } from './extension.common';
import { CharmProvider } from './extension.type';

export const CHARM_CONFIG_COMPLETION_TRIGGER_CHARS = ['"', "'"];

export class CharmConfigParametersCompletionProvider implements CompletionItemProvider<CompletionItem> {
    private readonly _regexSelfConfigBracket = /self(?:\.model)?\.config\[(?<quote>["'])$/;
    private readonly _regexSelfConfigGetSet = /self(?:\.model)?\.config\.(?<method>get|set)\((?<quote>["'])$/;

    constructor(readonly charmProvider: CharmProvider) { }

    provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>> {
        const charm = this.charmProvider(document.uri);
        if (!charm || token.isCancellationRequested) {
            return;
        }

        const leadingTextToCursor = document.getText(new vscode.Range(new vscode.Position(position.line, 0), position));
        let match: ReturnType<string['match']> | undefined;
        let matchType: 'indexer' | 'get' | 'set' | undefined;

        if (match = leadingTextToCursor.match(this._regexSelfConfigBracket)) {
            matchType = 'indexer';
        } else if (match = leadingTextToCursor.match(this._regexSelfConfigGetSet)) {
            matchType = match.groups!.method === 'set' ? 'set' : 'get';
        }

        if (!match) {
            return;
        }

        const openQuote = match.groups!['quote'];
        const trailingText = document.getText(new vscode.Range(position, new vscode.Position(1 + position.line, 0)));
        const needsCloseQuote = openQuote && !trailingText.startsWith(openQuote);

        const result: CompletionItem[] = [];
        for (const p of charm.config.parameters) {
            const completion: CompletionItem = {
                label: p.name,
                sortText: "0",
                detail: p.name,
                documentation: getConfigParamDocumentation(p),
            };
            result.push(completion);

            if (matchType === 'set') {
                completion.insertText = `${p.name}${openQuote}, ${this.getParameterDefaultValueAsString(p)}`;
                if (!needsCloseQuote) {
                    // To delete the closing quote and insert the second argument to `self.config.set` method.
                    completion.additionalTextEdits = [
                        vscode.TextEdit.delete(new vscode.Range(position, new vscode.Position(position.line, 1 + position.character))),
                    ];
                }
            } else {
                completion.insertText = p.name + (needsCloseQuote ? openQuote : '');
            }
        }
        return result;

    }
    resolveCompletionItem?(item: vscode.CompletionItem, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CompletionItem> {
        return;
    }

    getParameterDefaultValueAsString(param: CharmConfigParameter): string {
        switch (param.type) {
            case undefined:
                return '""';
            case 'string':
                return param.default !== undefined && typeof param.default === 'string' ? JSON.stringify(param.default) : '""';
            case 'boolean':
                return param.default !== undefined && typeof param.default === 'boolean' ? (param.default ? 'True' : 'False') : 'False';
            case 'int':
                return param.default !== undefined && typeof param.default === 'number' && Number.isInteger(param.default) ? param.default.toString() : '0';
            case 'float':
                return param.default !== undefined && typeof param.default === 'number' ? param.default.toString() : '0';
        }
    }
}


const SELF_ON = 'self.on.';
const SELF_FRAMEWORK_OBSERVE = 'self.framework.observe(';
const SELF_FRAMEWORK_OBSERVE_SELF_ON = 'self.framework.observe(self.on.';
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
        const isNextCharClosedBracket = (isFullEventSubscription || isPartialEventSubscription) && remainingLineText.startsWith(')');

        const result: CompletionItem[] = [];
        for (const e of charm.events) {
            const item: CompletionItem = {
                label: e.symbol,
                insertText: e.symbol,
                sortText: '0',
                detail: e.name,
                documentation: getEventDocumentation(e),
            };

            if (isFullEventSubscription) {
                item.insertText = `${e.symbol}, self._on_${e.symbol}${isNextCharClosedBracket ? '' : ')'}`;
            } else if (isPartialEventSubscription) {
                item.label = `self.on.${e.symbol}`;
                item.insertText = `self.on.${e.symbol}, self._on_${e.symbol}${isNextCharClosedBracket ? '' : ')'}`;
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
}

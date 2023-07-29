import {
    CancellationToken,
    CompletionContext,
    CompletionItem, CompletionItemProvider,
    CompletionList,
    Position,
    ProviderResult,
    Range,
    TextDocument,
    TextEdit
} from 'vscode';
import { CharmRegistry } from './registry';
import { getConfigParamDocumentation, getEventDocumentation } from './util';
import { CharmConfigParameter } from './model/charm';
import { isInRange } from './model/common';

export const CHARM_CONFIG_COMPLETION_TRIGGER_CHARS = ['"', "'"];

export class CharmConfigParametersCompletionProvider implements CompletionItemProvider<CompletionItem> {
    private readonly _regexSelfConfigBracket = /self(?:\.model)?\.config\[(?<quote>["'])$/;
    private readonly _regexSelfConfigGetSet = /self(?:\.model)?\.config\.(?<method>get|set)\((?<quote>["'])$/;

    constructor(readonly registry: CharmRegistry) { }

    async provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken, context: CompletionContext): Promise<CompletionItem[] | CompletionList<CompletionItem> | undefined> {
        const located = this.registry.getCharmBySourceCodeFile(document.uri);
        if (!located || token.isCancellationRequested) {
            return;
        }

        if (!located.charm.model.src.isMain(located.relativeSourcePath)) {
            return;
        }

        const file = located.charm.getLatestCachedLiveSourceCodeFile(document.uri);
        if (!file) {
            return;
        }


        if (!file.analyzer.mainCharmClass) {
            return;
        }

        if (!isInRange({ line: position.line, character: position.character }, file.analyzer.mainCharmClass.extendedRange)) {
            return;
        }

        const currentMethod = file.analyzer.mainCharmClass.methods.find(x => isInRange({ line: position.line, character: position.character }, x.extendedRange));
        if (!currentMethod || currentMethod.isStatic) {
            return;
        }

        const leadingTextToCursor = document.getText(new Range(new Position(position.line, 0), position));
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
        const trailingText = document.getText(new Range(position, new Position(1 + position.line, 0)));
        const needsCloseQuote = openQuote && !trailingText.startsWith(openQuote);

        const result: CompletionItem[] = [];
        for (const p of located.charm.model.config.parameters) {
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
                        TextEdit.delete(new Range(position, new Position(position.line, 1 + position.character))),
                    ];
                }
            } else {
                completion.insertText = p.name + (needsCloseQuote ? openQuote : '');
            }
        }
        return result;

    }

    resolveCompletionItem?(item: CompletionItem, token: CancellationToken): ProviderResult<CompletionItem> {
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
    constructor(readonly registry: CharmRegistry) { }

    provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken, context: CompletionContext): ProviderResult<CompletionItem[] | CompletionList<CompletionItem>> {
        const located = this.registry.getCharmBySourceCodeFile(document.uri);
        if (!located || token.isCancellationRequested) {
            return;
        }

        if (!located.charm.model.src.isMain(located.relativeSourcePath)) {
            return;
        }

        const file = located.charm.getLatestCachedLiveSourceCodeFile(document.uri);
        if (!file) {
            return;
        }


        if (!file.analyzer.mainCharmClass) {
            return;
        }

        if (!isInRange({ line: position.line, character: position.character }, file.analyzer.mainCharmClass.extendedRange)) {
            return;
        }

        const currentMethod = file.analyzer.mainCharmClass.methods.find(x => isInRange({ line: position.line, character: position.character }, x.extendedRange));
        if (!currentMethod || currentMethod.isStatic) {
            return;
        }

        const leadingTextToCursor = document.getText(new Range(new Position(position.line, 0), position));

        const isFullEventSubscription = leadingTextToCursor.endsWith(SELF_FRAMEWORK_OBSERVE_SELF_ON);
        const isPartialEventSubscription = !isFullEventSubscription && leadingTextToCursor.endsWith(SELF_FRAMEWORK_OBSERVE);
        const match = isFullEventSubscription || isPartialEventSubscription || leadingTextToCursor.endsWith(SELF_ON);
        if (!match) {
            return;
        }

        const remainingLineText = document.getText(new Range(position, new Position(1 + position.line, 0)));
        const isNextCharClosedBracket = (isFullEventSubscription || isPartialEventSubscription) && remainingLineText.startsWith(')');

        const result: CompletionItem[] = [];
        for (const e of located.charm.model.events) {
            const item: CompletionItem = {
                label: e.symbol,
                insertText: e.symbol,
                sortText: '0',
                detail: e.name,
                documentation: getEventDocumentation(e),
            };

            if (isFullEventSubscription) {
                item.insertText = `${e.symbol}, self.${e.preferredHandlerSymbol}${isNextCharClosedBracket ? '' : ')'}`;
            } else if (isPartialEventSubscription) {
                item.label = `self.on.${e.symbol}`;
                item.insertText = `self.on.${e.symbol}, self.${e.preferredHandlerSymbol}${isNextCharClosedBracket ? '' : ')'}`;
            }
            if (typeof item.insertText === 'string' && remainingLineText.startsWith(item.insertText)) {
                item.insertText = '';
            }
            result.push(item);
        }
        return result;

    }

    resolveCompletionItem?(item: CompletionItem, token: CancellationToken): ProviderResult<CompletionItem> {
        return;
    }
}

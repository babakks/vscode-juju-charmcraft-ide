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
import { Registry } from './registry';
import { getConfigOptionDocumentation, getEventDocumentation } from './util';
import { type CharmConfigOption } from './model/charm';
import { isInRange } from './model/common';
import TelemetryReporter from '@vscode/extension-telemetry';

export const CHARM_CONFIG_COMPLETION_TRIGGER_CHARS = ['"', "'"];

export class CharmConfigParametersCompletionProvider implements CompletionItemProvider<CompletionItem> {
    private static readonly _telemetryEvent = 'v0.completion.config';

    private readonly _regexSelfConfigBracket = /self(?:\.model)?\.config\[(?<quote>["'])$/;
    private readonly _regexSelfConfigGetSet = /self(?:\.model)?\.config\.(?<method>get|set)\((?<quote>["'])$/;

    constructor(readonly registry: Registry, readonly reporter: TelemetryReporter) { }

    async provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken, context: CompletionContext): Promise<CompletionItem[] | CompletionList<CompletionItem> | undefined> {
        const { workspaceCharm, relativePath } = this.registry.getCharmByUri(document.uri);
        if (!workspaceCharm || token.isCancellationRequested) {
            return;
        }

        if (!workspaceCharm.live.sourceCode.isMain(relativePath)) {
            return;
        }

        const file = workspaceCharm.live.sourceCode.getFile(relativePath);
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

        this.reporter.sendTelemetryEvent(CharmConfigParametersCompletionProvider._telemetryEvent);

        const openQuote = match.groups!['quote'];
        const trailingText = document.getText(new Range(position, new Position(1 + position.line, 0)));
        const needsCloseQuote = openQuote && !trailingText.startsWith(openQuote);

        const result: CompletionItem[] = [];
        for (const v of workspaceCharm.live.configOptions) {
            const p = v;
            const completion: CompletionItem = {
                label: p.name,
                sortText: "0",
                detail: p.name,
                documentation: getConfigOptionDocumentation(p),
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

    // resolveCompletionItem?(item: CompletionItem, token: CancellationToken): ProviderResult<CompletionItem> {
    //     return;
    // }

    getParameterDefaultValueAsString(option: CharmConfigOption): string {
        if (!option.type) {
            return '""';
        }
        switch (option.type) {
            case 'string':
                return option.default !== undefined ? JSON.stringify(option.default) : '""';
            case 'boolean':
                return option.default !== undefined ? (option.default ? 'True' : 'False') : 'False';
            case 'int':
                return option.default !== undefined ? option.default.toString() : '0';
            case 'float':
                return option.default !== undefined ? option.default.toString() : '0';
            case 'secret':
                return option.default !== undefined ? JSON.stringify(option.default) : '""';
            default:
                return '""';
        }
    }
}


const SELF_ON = 'self.on.';
const SELF_FRAMEWORK_OBSERVE = 'self.framework.observe(';
const SELF_FRAMEWORK_OBSERVE_SELF_ON = 'self.framework.observe(self.on.';
export const CHARM_EVENT_COMPLETION_TRIGGER_CHARS = ['.', '('];

export class CharmEventCompletionProvider implements CompletionItemProvider<CompletionItem> {
    private static readonly _telemetryEvent = 'v0.completion.event';

    constructor(readonly registry: Registry, readonly reporter: TelemetryReporter) { }

    provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken, context: CompletionContext): ProviderResult<CompletionItem[] | CompletionList<CompletionItem>> {
        const { workspaceCharm, relativePath } = this.registry.getCharmByUri(document.uri);
        if (!workspaceCharm || token.isCancellationRequested) {
            return;
        }

        if (!workspaceCharm.live.sourceCode.isMain(relativePath)) {
            return;
        }

        const file = workspaceCharm.live.sourceCode.getFile(relativePath);
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

        this.reporter.sendTelemetryEvent(CharmEventCompletionProvider._telemetryEvent);

        const remainingLineText = document.getText(new Range(position, new Position(1 + position.line, 0)));
        const isNextCharClosedBracket = (isFullEventSubscription || isPartialEventSubscription) && remainingLineText.startsWith(')');

        const result: CompletionItem[] = [];
        for (const e of workspaceCharm.live.events) {
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

    // resolveCompletionItem?(item: CompletionItem, token: CancellationToken): ProviderResult<CompletionItem> {
    //     return;
    // }
}

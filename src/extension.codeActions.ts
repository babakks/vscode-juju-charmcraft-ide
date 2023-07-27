import {
    CancellationToken,
    CodeAction,
    CodeActionContext,
    CodeActionKind,
    CodeActionProvider,
    Command,
    ProviderResult,
    Range,
    Selection,
    TextDocument,
    window
} from 'vscode';
import { CharmDataProvider } from './extension.type';
import { CharmSourceCodeFileAnalyzer } from './charm.src';
import { isInRange } from './charm.util';

export class EventHandlerCodeActionProvider implements CodeActionProvider {
    constructor(readonly cdp: CharmDataProvider) { }

    async provideCodeActions(document: TextDocument, range: Range | Selection, context: CodeActionContext, token: CancellationToken): Promise<(CodeAction | Command)[] | undefined> {
        if (!(range instanceof Selection)) {
            return;
        }

        const located = this.cdp.getCharmBySourceCodeFile(document.uri);
        if (!located) {
            return;
        }

        if (!located.charm.model.src.isMain(located.relativePath)) {
            return;
        }

        const file = await located.charm.getLatestCachedLiveSourceCodeFile(document.uri);
        if (!file) {
            return;
        }

        const classes = file.analyzer.charmClasses;
        if (!classes) {
            return;
        }

        // if (range.start.line !== charmClass.range.start.line) {
        //     return;
        // }

        // return [{
        //     title: 'Insert missing methods',
        // } as CodeAction];
    }

    resolveCodeAction?(codeAction: CodeAction, token: CancellationToken): ProviderResult<CodeAction> {
        throw new Error('Method not implemented.');
    }

}
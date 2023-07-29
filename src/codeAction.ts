import {
    CancellationToken,
    CodeAction,
    CodeActionContext, CodeActionProvider,
    Command,
    ProviderResult,
    Range,
    Selection,
    TextDocument
} from 'vscode';
import { CharmRegistry } from './registry';

export class EventHandlerCodeActionProvider implements CodeActionProvider {
    constructor(readonly registry: CharmRegistry) { }

    async provideCodeActions(document: TextDocument, range: Range | Selection, context: CodeActionContext, token: CancellationToken): Promise<(CodeAction | Command)[] | undefined> {
        if (!(range instanceof Selection)) {
            return;
        }

        const located = this.registry.getCharmBySourceCodeFile(document.uri);
        if (!located) {
            return;
        }

        if (!located.charm.model.src.isMain(located.relativeSourcePath)) {
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
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
import { Registry } from './registry';

export class EventHandlerCodeActionProvider implements CodeActionProvider {
    constructor(readonly registry: Registry) { }

    async provideCodeActions(document: TextDocument, range: Range | Selection, context: CodeActionContext, token: CancellationToken): Promise<(CodeAction | Command)[] | undefined> {
        if (!(range instanceof Selection)) {
            return;
        }

        const { workspaceCharm, relativeSourcePath } = this.registry.getCharmBySourceCodeFile(document.uri);
        if (!workspaceCharm) {
            return;
        }

        if (!workspaceCharm.model.src.isMain(relativeSourcePath)) {
            return;
        }

        const file = workspaceCharm.getLatestCachedLiveSourceCodeFile(document.uri);
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

    // resolveCodeAction?(codeAction: CodeAction, token: CancellationToken): ProviderResult<CodeAction> {
    //     throw new Error('Method not implemented.');
    // }
}
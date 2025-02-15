import TelemetryReporter from '@vscode/extension-telemetry';
import {
    CancellationToken,
    CodeAction,
    CodeActionContext, CodeActionProvider,
    Command,
    Range,
    Selection,
    TextDocument
} from 'vscode';
import { Registry } from './registry';

export class EventHandlerCodeActionProvider implements CodeActionProvider {
    constructor(readonly registry: Registry, readonly reporter: TelemetryReporter) { }

    async provideCodeActions(document: TextDocument, range: Range | Selection, context: CodeActionContext, token: CancellationToken): Promise<(CodeAction | Command)[] | undefined> {
        if (!(range instanceof Selection)) {
            return;
        }

        const { workspaceCharm, relativePath } = this.registry.getCharmByUri(document.uri);
        if (!workspaceCharm) {
            return;
        }

        if (!workspaceCharm.model.sourceCode.isMain(relativePath)) {
            return;
        }

        const file = workspaceCharm.live.sourceCode.getFile(relativePath);
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
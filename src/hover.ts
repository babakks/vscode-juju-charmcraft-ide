import {
    CancellationToken,
    Hover,
    HoverProvider,
    Position,
    ProviderResult,
    Range,
    TextDocument
} from 'vscode';
import { Registry } from './registry';
import { getConfigParamDocumentation, getEventDocumentation } from './util';

const REGEX_SELF_CONFIG_BRACKET = /self(?:\.model)?\.config\[(['"])(?<name>.*?)\1/;
const REGEX_SELF_CONFIG_GET_SET = /self(?:\.model)?\.config\.(?:get|set)\((['"])(?<name>.*?)\1/;
export class CharmConfigHoverProvider implements HoverProvider {
    constructor(readonly registry: Registry) { }

    provideHover(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Hover> {
        const { workspaceCharm } = this.registry.getCharmBySourceCodeFile(document.uri);
        if (!workspaceCharm || token.isCancellationRequested) {
            return;
        }

        let match: Range | undefined;
        let matchRegex: RegExp;

        if (match = document.getWordRangeAtPosition(position, REGEX_SELF_CONFIG_BRACKET)) {
            matchRegex = REGEX_SELF_CONFIG_BRACKET;
        } else if (match = document.getWordRangeAtPosition(position, REGEX_SELF_CONFIG_GET_SET)) {
            matchRegex = REGEX_SELF_CONFIG_GET_SET;
        } else {
            return;
        }

        const matchText = document.getText(new Range(match.start, match.end));
        const name = matchText.match(matchRegex)!.groups!['name'];

        const parameter = workspaceCharm.model.getConfigParameterByName(name);
        if (!parameter) {
            return;
        }

        return new Hover(getConfigParamDocumentation(parameter, true));
    }
}

const REGEX_SELF_ON = /self\.on\.(?<symbol>\w*)/;
export class CharmEventHoverProvider implements HoverProvider {
    constructor(readonly registry: Registry) { }

    provideHover(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Hover> {
        const { workspaceCharm } = this.registry.getCharmBySourceCodeFile(document.uri);
        if (!workspaceCharm || token.isCancellationRequested) {
            return;
        }

        const match = document.getWordRangeAtPosition(position, REGEX_SELF_ON);
        if (!match) {
            return;
        }

        const matchText = document.getText(new Range(match.start, match.end));
        const symbol = matchText.match(REGEX_SELF_ON)!.groups!['symbol'];

        const event = workspaceCharm.model.getEventBySymbol(symbol);
        if (!event) {
            return;
        }

        return new Hover(getEventDocumentation(event, true));
    }
}
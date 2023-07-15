import { CancellationToken, Hover, HoverProvider, Position, ProviderResult, Range, TextDocument } from 'vscode';
import { CharmProvider } from './extension.type';
import { getConfigParamDocumentation, getEventDocumentation } from './extension.common';

const REGEX_SELF_CONFIG_BRACKET = /self(?:\.model)?\.config\[(['"])(?<name>.*?)\1/;
const REGEX_SELF_CONFIG_GET_SET = /self(?:\.model)?\.config\.(?:get|set)\((['"])(?<name>.*?)\1/;
export class CharmConfigHoverProvider implements HoverProvider {
    constructor(readonly charmProvider: CharmProvider) { }

    provideHover(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Hover> {
        const charm = this.charmProvider(document.uri);
        if (!charm || token.isCancellationRequested) {
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

        const parameter = charm.getConfigParameterByName(name);
        if (!parameter) {
            return;
        }

        return new Hover(getConfigParamDocumentation(parameter, true));
    }
}

const REGEX_SELF_ON = /self\.on\.(?<symbol>\w*)/;
export class CharmEventHoverProvider implements HoverProvider {
    constructor(readonly charmProvider: CharmProvider) { }

    provideHover(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Hover> {
        const charm = this.charmProvider(document.uri);
        if (!charm || token.isCancellationRequested) {
            return;
        }

        const match = document.getWordRangeAtPosition(position, REGEX_SELF_ON);
        if (!match) {
            return;
        }

        const matchText = document.getText(new Range(match.start, match.end));
        const symbol = matchText.match(REGEX_SELF_ON)!.groups!['symbol'];

        const event = charm.getEventBySymbol(symbol);
        if (!event) {
            return;
        }

        return new Hover(getEventDocumentation(event, true));
    }
}
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
import { getConfigOptionDocumentation, getEventDocumentation } from './util';
import TelemetryReporter from '@vscode/extension-telemetry';

const REGEX_SELF_CONFIG_BRACKET = /self(?:\.model)?\.config\[(['"])(?<name>.*?)\1/;
const REGEX_SELF_CONFIG_GET_SET = /self(?:\.model)?\.config\.(?:get|set)\((['"])(?<name>.*?)\1/;
export class CharmConfigHoverProvider implements HoverProvider {
    private static readonly _telemetryEvent = 'v0.hover.config';

    constructor(readonly registry: Registry, readonly reporter: TelemetryReporter) { }

    provideHover(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Hover> {
        const { workspaceCharm } = this.registry.getCharmByUri(document.uri);
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

        const option = workspaceCharm.live.getConfigOptionByName(name);
        if (!option) {
            return;
        }

        this.reporter.sendTelemetryEvent(CharmConfigHoverProvider._telemetryEvent);

        return new Hover(getConfigOptionDocumentation(option, true));
    }
}

const REGEX_SELF_ON = /self\.on\.(?<symbol>\w*)/;
export class CharmEventHoverProvider implements HoverProvider {
    private static readonly _telemetryEvent = 'v0.hover.event';

    constructor(readonly registry: Registry, readonly reporter: TelemetryReporter) { }

    provideHover(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Hover> {
        const { workspaceCharm } = this.registry.getCharmByUri(document.uri);
        if (!workspaceCharm || token.isCancellationRequested) {
            return;
        }

        const match = document.getWordRangeAtPosition(position, REGEX_SELF_ON);
        if (!match) {
            return;
        }

        const matchText = document.getText(new Range(match.start, match.end));
        const symbol = matchText.match(REGEX_SELF_ON)!.groups!['symbol'];

        const event = workspaceCharm.live.getEventBySymbol(symbol);
        if (!event) {
            return;
        }

        this.reporter.sendTelemetryEvent(CharmEventHoverProvider._telemetryEvent);

        return new Hover(getEventDocumentation(event, true));
    }
}
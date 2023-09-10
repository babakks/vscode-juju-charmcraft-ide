import {
    CancellationToken,
    Definition,
    DefinitionProvider,
    Hover,
    HoverProvider,
    LocationLink,
    Position,
    ProviderResult,
    Range,
    TextDocument
} from 'vscode';
import { Registry } from './registry';
import { getConfigParamDocumentation, getEventDocumentation, rangeToVSCodeRange } from './util';
import TelemetryReporter from '@vscode/extension-telemetry';

const REGEX_SELF_CONFIG_BRACKET = /self(?:\.model)?\.config\[(['"])(?<name>.*?)\1/;
const REGEX_SELF_CONFIG_GET_SET = /self(?:\.model)?\.config\.(?:get|set)\((['"])(?<name>.*?)\1/;
export class CharmConfigDefinitionProvider implements DefinitionProvider {
    private static readonly _telemetryEvent = 'v0.definition.config';

    constructor(readonly registry: Registry, readonly reporter: TelemetryReporter) { }

    provideDefinition(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Definition | LocationLink[]> {
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

        const parameter = workspaceCharm.live.config.parameters?.entries?.[name];
        if (!parameter || !parameter.node.range) {
            return;
        }

        this.reporter.sendTelemetryEvent(CharmConfigDefinitionProvider._telemetryEvent);

        return {
            uri: workspaceCharm.configUri,
            range: rangeToVSCodeRange(parameter.node.range),
        };
    }
}

const REGEX_SELF_ON = /self\.on\.(?<symbol>\w*)/;
export class CharmEventDefinitionProvider implements DefinitionProvider {
    private static readonly _telemetryEvent = 'v0.definition.event';

    constructor(readonly registry: Registry, readonly reporter: TelemetryReporter) { }

    provideDefinition(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Definition | LocationLink[]> {
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

        const event = workspaceCharm.live.getEventBySymbol(symbol);
        if (!event) {
            return;
        }

        if (event.source !== 'action' || event.sourceActionName === undefined) {
            return;
        }

        const action = workspaceCharm.live.actions.actions?.entries?.[event.sourceActionName];
        if (!action || !action.node.range) {
            return;
        }

        this.reporter.sendTelemetryEvent(CharmEventDefinitionProvider._telemetryEvent);

        return {
            uri: workspaceCharm.actionsUri,
            range: rangeToVSCodeRange(action.node.range),
        };
    }
}
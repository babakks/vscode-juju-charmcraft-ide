import TelemetryReporter from '@vscode/extension-telemetry';
import {
    CancellationToken,
    Definition,
    DefinitionProvider, LocationLink,
    Position,
    ProviderResult,
    Range,
    TextDocument
} from 'vscode';
import { Registry } from './registry';
import { rangeToVSCodeRange } from './util';

const REGEX_SELF_CONFIG_BRACKET = /self(?:\.model)?\.config\[(['"])(?<name>.*?)\1/;
const REGEX_SELF_CONFIG_GET_SET = /self(?:\.model)?\.config\.(?:get|set)\((['"])(?<name>.*?)\1/;
export class CharmConfigDefinitionProvider implements DefinitionProvider {
    private static readonly _telemetryEvent = 'v0.definition.config';

    constructor(readonly registry: Registry, readonly reporter: TelemetryReporter) { }

    provideDefinition(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Definition | LocationLink[]> {
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

        const uri = option.definition === 'charmcraft.yaml' ? workspaceCharm.charmcraftUri :
            option.definition === 'config.yaml' ? workspaceCharm.configUri : undefined;
        if (!uri) {
            return;
        }

        const node = option.definition === 'charmcraft.yaml' ? workspaceCharm.live.charmcraftYAML.config?.value?.options?.entries?.[name]?.node :
            option.definition === 'config.yaml' ? workspaceCharm.live.configYAML.parameters?.entries?.[name]?.node : undefined;
        if (!node?.range) {
            return;
        }

        this.reporter.sendTelemetryEvent(CharmConfigDefinitionProvider._telemetryEvent);

        return {
            uri,
            range: rangeToVSCodeRange(node.range),
        };
    }
}

const REGEX_SELF_ON = /self\.on\.(?<symbol>\w*)/;
export class CharmEventDefinitionProvider implements DefinitionProvider {
    private static readonly _telemetryEvent = 'v0.definition.event';

    constructor(readonly registry: Registry, readonly reporter: TelemetryReporter) { }

    provideDefinition(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Definition | LocationLink[]> {
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

        if (event.source !== 'action') {
            return;
        }

        const uri = event.definition === 'charmcraft.yaml' ? workspaceCharm.charmcraftUri :
            event.definition === 'actions.yaml' ? workspaceCharm.actionsUri : undefined;
        if (!uri) {
            return;
        }

        const node = event.definition === 'charmcraft.yaml' ? workspaceCharm.live.charmcraftYAML.actions?.entries?.[event.sourceActionName]?.node :
            event.definition === 'actions.yaml' ? workspaceCharm.live.actionsYAML.actions?.entries?.[event.sourceActionName]?.node : undefined;
        if (!node?.range) {
            return;
        }

        this.reporter.sendTelemetryEvent(CharmEventDefinitionProvider._telemetryEvent);

        return {
            uri,
            range: rangeToVSCodeRange(node.range),
        };
    }
}
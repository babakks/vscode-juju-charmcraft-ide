import TelemetryReporter from '@vscode/extension-telemetry';
import {
    Disposable,
    ExtensionContext,
    ExtensionMode, OutputChannel, Uri, languages,
    tests,
    window
} from 'vscode';
import { EventHandlerCodeActionProvider } from './codeAction';
import { Commands } from './command';
import {
    CHARM_CONFIG_COMPLETION_TRIGGER_CHARS,
    CHARM_EVENT_COMPLETION_TRIGGER_CHARS,
    CharmConfigParametersCompletionProvider,
    CharmEventCompletionProvider
} from './completion';
import { CharmConfigDefinitionProvider, CharmEventDefinitionProvider } from './definition';
import { CharmConfigHoverProvider, CharmEventHoverProvider } from './hover';
import { Registry } from './registry';
import { integrateWithYAMLExtension } from './schema';
import { CharmTestProvider } from './test';
import { CharmcraftTreeDataProvider } from './tree';
import { DocumentWatcher } from './watcher';

const TELEMETRY_INSTRUMENTATION_KEY = 'e9934c53-e6be-4d6d-897c-bcc96cbb3f75';

export async function activate(context: ExtensionContext) {
    const reporter = new TelemetryReporter(context.extensionMode === ExtensionMode.Production ? TELEMETRY_INSTRUMENTATION_KEY : '');
    context.subscriptions.push(reporter);

    const output = window.createOutputChannel('Charmcraft IDE');
    context.subscriptions.push(output);

    const testOutput = window.createOutputChannel('Charmcraft IDE (tests)');
    context.subscriptions.push(testOutput);

    const diagnostics = languages.createDiagnosticCollection('Charmcraft IDE');
    context.subscriptions.push(diagnostics);

    const registry = new Registry(output, diagnostics);
    context.subscriptions.push(registry);
    await registry.refresh();

    context.subscriptions.push(
        ...registerCodeActionProviders(registry, reporter),
        ...registerCompletionProviders(registry, reporter),
        ...registerHoverProviders(registry, reporter),
        ...registerDefinitionProviders(registry, reporter),
        ...registerTestProvider(registry, reporter, output, testOutput, context.logUri),
    );

    const dw = new DocumentWatcher(registry);
    context.subscriptions.push(dw);
    dw.enable();

    const tdp = new CharmcraftTreeDataProvider(registry, reporter);
    context.subscriptions.push(tdp);
    context.subscriptions.push(window.createTreeView('charmcraft-charms', { treeDataProvider: tdp }));

    const commands = new Commands(context, reporter, registry, tdp);
    context.subscriptions.push(commands);
    commands.register();

    // Note that we shouldn't `await` on this call, because it could ask for user decision (e.g., to install the YAML
    // extension) and get blocked for an unknown time duration (possibly never, if user decides to skip the message).
    integrateWithYAMLExtension(context).catch(reason => {
        output.appendLine(`failed to integrate with YAML extension: ${reason}`);
    });
}

export function deactivate() { }

function registerCompletionProviders(registry: Registry, reporter: TelemetryReporter): Disposable[] {
    return [
        languages.registerCompletionItemProvider(
            { scheme: 'file', language: 'python' },
            new CharmConfigParametersCompletionProvider(registry, reporter),
            ...CHARM_CONFIG_COMPLETION_TRIGGER_CHARS
        ),
        languages.registerCompletionItemProvider(
            { scheme: 'file', language: 'python' },
            new CharmEventCompletionProvider(registry, reporter),
            ...CHARM_EVENT_COMPLETION_TRIGGER_CHARS
        ),
    ];
}

function registerHoverProviders(registry: Registry, reporter: TelemetryReporter): Disposable[] {
    return [
        languages.registerHoverProvider(
            { scheme: 'file', language: 'python' },
            new CharmConfigHoverProvider(registry, reporter),
        ),
        languages.registerHoverProvider(
            { scheme: 'file', language: 'python' },
            new CharmEventHoverProvider(registry, reporter),
        ),
    ];
}

function registerCodeActionProviders(registry: Registry, reporter: TelemetryReporter): Disposable[] {
    return [
        languages.registerCodeActionsProvider(
            { scheme: 'file', language: 'python' },
            new EventHandlerCodeActionProvider(registry, reporter),
        ),
    ];
}

function registerDefinitionProviders(registry: Registry, reporter: TelemetryReporter): Disposable[] {
    return [
        languages.registerDefinitionProvider(
            { scheme: 'file', language: 'python' },
            new CharmConfigDefinitionProvider(registry, reporter),
        ),
        languages.registerDefinitionProvider(
            { scheme: 'file', language: 'python' },
            new CharmEventDefinitionProvider(registry, reporter),
        ),
    ];
}

function registerTestProvider(registry: Registry, reporter: TelemetryReporter, output: OutputChannel, testOutput: OutputChannel, logUri: Uri): Disposable[] {
    const controller = tests.createTestController('charmcraft-ide', 'Charmcraft IDE');
    const provider = new CharmTestProvider(registry, reporter, controller, output, testOutput, logUri);
    return [controller, provider];
}

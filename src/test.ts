import TelemetryReporter from '@vscode/extension-telemetry';
import {
    CancellationToken,
    DebugAdapterTracker,
    DebugSession,
    Disposable,
    EventEmitter,
    FileType,
    OutputChannel,
    ProviderResult,
    RelativePattern,
    TestController,
    TestItem,
    TestItemCollection,
    TestMessage,
    TestRun,
    TestRunProfileKind,
    TestRunRequest,
    Uri,
    debug,
    window,
    workspace
} from 'vscode';
import { Registry } from './registry';
import { rangeToVSCodeRange, tryReadWorkspaceFileAsText } from './util';
import assert = require('assert');
import path = require('path');
import { WorkspaceCharm } from './workspace';
import { CHARM_DIR_TESTS } from './model/common';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { COMMAND_CREATE_AND_SETUP_VIRTUAL_ENVIRONMENT } from './command.const';
import { InternalCommands } from './command';

type TestData = CharmTestData | DirectoryTestData | FileTestData | FunctionTestData | ClassTestData | MethodTestData;

interface TestDataBase {
    /**
     * Test item URI.
     */
    uri: Uri;
};

interface MethodTestData extends TestDataBase {
    kind: 'method';
    class: string;
    name: string;
}

interface ClassTestData extends TestDataBase {
    kind: 'class';
    name: string;
}

interface FunctionTestData extends TestDataBase {
    kind: 'function';
    name: string;
}

interface FileTestData extends TestDataBase {
    kind: 'file';
}

interface DirectoryTestData extends TestDataBase {
    kind: 'directory';
}

interface CharmTestData extends TestDataBase {
    kind: 'charm';
}

interface OnCreateDebugAdapterTrackerEventArgs {
    session: DebugSession;
    tracker: DebugAdapterTracker | undefined;
}

export class CharmTestProvider implements Disposable {
    private static readonly _telemetryEventRun = 'v0.test.run';
    private static readonly _telemetryEventDebug = 'v0.test.debug';

    private readonly _disposables: Disposable[] = [];
    private readonly _watchers: Disposable[] = [];

    private readonly _map = new WeakMap<TestItem, TestData>();

    private readonly _onCreateDebugAdapterTracker = new EventEmitter<OnCreateDebugAdapterTrackerEventArgs>();

    private readonly _onUpdate = new EventEmitter<void>();
    /**
     * Fires when the list of discovered tests is updated.
     */
    readonly onUpdate = this._onUpdate.event;

    constructor(
        readonly registry: Registry,
        readonly ic: InternalCommands,
        readonly reporter: TelemetryReporter,
        readonly controller: TestController,
        readonly output: OutputChannel,
        readonly testOutput: OutputChannel,
        readonly logUri: Uri,
    ) {
        // First, create the `resolveHandler`. This may initially be called with
        // "undefined" to ask for all tests in the workspace to be discovered, usually
        // when the user opens the Test Explorer for the first time.
        this.controller.resolveHandler = async test => {
            if (!test) {
                await this._discoverAllTests();
                this._purgeEntriesWithNoChildren();
                return;
            }

            const data = this._map.get(test);
            if (!data) {
                return;
            }

            if (data.kind === 'charm') {
                await this._refreshCharmEntry(test);
            } else if (data.kind === 'directory') {
                await this._refreshDirectoryEntry(test);
            } else if (data.kind === 'file') {
                await this._refreshFileEntry(test);
            } else if (data.kind === 'class') {
                await this._refreshFileEntry(test);
            } else if (data.kind === 'function') {
                await this._refreshFileEntry(test);
            } else {
                assert(test.uri);
                await this._discoverTestsInFile(test.uri);
            }
            this._purgeEntriesWithNoChildren();
        };

        this.controller.refreshHandler = async (token: CancellationToken) => {
            await this._discoverAllTests(token);
        };

        this._disposables.push(
            // // When text documents are open, parse tests in them.
            // workspace.onDidOpenTextDocument(e => this._discoverTestsInFile(e.uri)),
            // // We could also listen to document changes to re-parse unsaved changes:
            // vscode.workspace.onDidChangeTextDocument(e => this.parseTestsInDocument(e.document)),
            controller.createRunProfile('Run', TestRunProfileKind.Run, (request, token) => this._startTestRun(false, request, token)),
            controller.createRunProfile('Debug', TestRunProfileKind.Debug, (request, token) => this._startTestRun(true, request, token)),
        );

        debug.registerDebugAdapterTrackerFactory('python', {
            createDebugAdapterTracker: (session: DebugSession): ProviderResult<DebugAdapterTracker> => {
                const e: OnCreateDebugAdapterTrackerEventArgs = { session, tracker: undefined };
                this._onCreateDebugAdapterTracker.fire(e);
                return e.tracker;
            }
        });

        this._disposables.push(this.registry.onChanged(() => {
            this._onUpdate.fire();
        }));
    }

    dispose() {
        this._disposeCurrentWatchers();
        this._disposables.forEach(x => x.dispose());
    }

    private _disposeCurrentWatchers() {
        this._watchers.forEach(x => x.dispose());
    }

    // TBD if not used.
    getTests(): TestItem[] {
        const result: TestItem[] = [];
        const stack: TestItem[] = [];

        const push = (values: TestItemCollection) => values.forEach(x => stack.push(x));
        push(this.controller.items);
        while (true) {
            const entry = stack.pop();
            if (!entry) {
                break;
            }
            if (entry.range) {
                result.push(entry);
            }
            push(entry.children);
        }
        return result;
    }

    private _findFileEntry(uri: Uri): TestItem | undefined {
        return firstChild(this.controller.items, (x: TestItem) => x.uri?.path === uri.path && this._map.get(x)?.kind === 'file');
    }

    private _findEntriesWithNoChildren(kind: TestData['kind']): TestItem[] {
        return filterChildren(this.controller.items, (x: TestItem) => this._map.get(x)?.kind === kind && !x.children.size);
    }

    private _purgeEntriesWithNoChildren() {
        for (const x of this._findEntriesWithNoChildren('class')) {
            assert(x.parent);
            this._map.delete(x);
            x.parent.children.delete(x.id);
        }

        for (const x of this._findEntriesWithNoChildren('file')) {
            assert(x.parent);
            this._map.delete(x);
            x.parent.children.delete(x.id);
        }

        for (const x of this._findEntriesWithNoChildren('directory')) {
            assert(x.parent);
            this._map.delete(x);
            x.parent.children.delete(x.id);
        }

        for (const x of this._findEntriesWithNoChildren('charm')) {
            this._map.delete(x);
            this.controller.items.delete(x.id);
        }
    }

    private async _refreshCharmEntry(test: TestItem) {
        assert(test.uri);
        traceChildren(test).forEach(x => this._map.delete(x));
        test.children.replace([]);

        const { workspaceCharm } = this.registry.getCharmByUri(test.uri);
        if (!workspaceCharm) {
            return;
        }

        const pattern = this._getFindFilesPatternForCharm(workspaceCharm);
        const files = await workspace.findFiles(pattern);
        for (const entryUri of files) {
            await this._discoverTestsInFile(entryUri);
        }
    }

    private async _refreshDirectoryEntry(test: TestItem) {
        assert(test.uri);
        traceChildren(test).forEach(x => this._map.delete(x));
        test.children.replace([]);
        const files = await workspace.fs.readDirectory(test.uri);
        for (const [filename, fileType] of files) {
            if (fileType !== FileType.File) {
                continue;
            }
            await this._discoverTestsInFile(Uri.joinPath(test.uri, filename));
        }
    }

    private async _refreshFileEntry(test: TestItem) {
        assert(test.uri);
        test.children.forEach(x => this._map.delete(x));
        test.children.replace([]);
        await this._discoverTestsInFile(test.uri);
    }

    private async _discoverTestsInFile(uri: Uri) {
        if (uri.scheme !== 'file' || !uri.path.endsWith('.py')) {
            return;
        }

        const { workspaceCharm, relativePath } = this.registry.getCharmByUri(uri);
        if (!workspaceCharm) {
            return;
        }

        const pathComponents = relativePath.split('/');
        if (pathComponents[0] !== CHARM_DIR_TESTS) {
            // Only tests under the `tests` directory will be discovered.
            return;
        }

        const file = workspaceCharm.model.sourceCode.getFile(relativePath);
        if (!file) {
            return;
        }

        let updated = false;

        const charmId = workspaceCharm.testsUri.path;
        let charmItem = this.controller.items.get(charmId);
        if (!charmItem) {
            const label = workspace.asRelativePath(workspaceCharm.home);
            charmItem = this.controller.createTestItem(charmId, label, workspaceCharm.testsUri);
            this.controller.items.add(charmItem);
            const testData: CharmTestData = {
                kind: 'charm',
                uri,
            };
            this._map.set(charmItem, testData);
            updated = true;
        }

        const dirs = pathComponents.slice(1, -1); // Skipping index 0, because it's the `tests` directory.
        const filename = pathComponents[-1 + pathComponents.length];

        let parentItem: TestItem = charmItem;
        for (const dir of dirs) {
            const dirId = `${parentItem.id}/${dir}`;
            let dirItem = parentItem.children.get(dirId);
            if (!dirItem) {
                dirItem = this.controller.createTestItem(dirId, dir, Uri.joinPath(parentItem.uri!, dir));
                parentItem.children.add(dirItem);
                const testData: DirectoryTestData = {
                    kind: 'directory',
                    uri,
                };
                this._map.set(dirItem, testData);
                updated = true;
            }
            parentItem = dirItem;
        }

        const fileId = uri.path;
        let fileItem = parentItem.children.get(fileId);
        if (!fileItem) {
            fileItem = this.controller.createTestItem(fileId, filename, uri);
            parentItem.children.add(fileItem);
            const testData: FileTestData = {
                kind: 'file',
                uri,
            };
            this._map.set(fileItem, testData);
            updated = true;
        }

        for (const func of file.analyzer.testFunctions ?? []) {
            const funcId = `${fileItem.id}:${func.name}`;
            let funcItem = fileItem.children.get(funcId);
            if (!funcItem) {
                funcItem = this.controller.createTestItem(funcId, func.name, uri);
                funcItem.range = rangeToVSCodeRange(func.range);
                fileItem.children.add(funcItem);
                const testData: FunctionTestData = {
                    kind: 'function',
                    uri,
                    name: func.name,
                };
                this._map.set(funcItem, testData);
                updated = true;
            }
        }

        for (const cls of file.analyzer.testClasses ?? []) {
            const classId = `${uri.path}:${cls.name}`;
            let classItem = fileItem.children.get(classId);
            if (!classItem) {
                classItem = this.controller.createTestItem(classId, cls.name, uri);
                classItem.range = rangeToVSCodeRange(cls.range);
                fileItem.children.add(classItem);
                const testData: ClassTestData = {
                    kind: 'class',
                    uri,
                    name: cls.name,
                };
                this._map.set(classItem, testData);
                updated = true;
            }

            for (const method of cls.testMethods) {
                const methodId = `${classItem.id}:${method.name}`;
                let methodItem = classItem.children.get(methodId);
                if (!methodItem) {
                    methodItem = this.controller.createTestItem(methodId, method.name, uri);
                    methodItem.range = rangeToVSCodeRange(method.range);
                    classItem.children.add(methodItem);
                    const testData: MethodTestData = {
                        kind: 'method',
                        uri,
                        class: cls.name,
                        name: method.name,
                    };
                    this._map.set(methodItem, testData);
                    updated = true;
                }
            }
        }

        if (updated) {
            this._onUpdate.fire();
        }
    }

    private async _discoverAllTests(token?: CancellationToken) {
        if (token?.isCancellationRequested) {
            return [];
        }

        this._disposeCurrentWatchers();
        this.controller.items.replace([]);

        const workspaceCharms = this.registry.getWorkspaceCharms();
        if (!workspaceCharms.length) {
            return [];
        }

        const cancelPromise = token ? this._getCancellationTokenPromise(token) : undefined;
        const promises = workspaceCharms.map(async workspaceCharm => {
            const pattern = this._getFindFilesPatternForCharm(workspaceCharm);
            const watcher = workspace.createFileSystemWatcher(pattern);
            this._watchers.push(
                watcher,
                // When files are created, make sure there's a corresponding "file" node in the tree
                watcher.onDidCreate(async uri => { await this._discoverTestsInFile(uri); }),
                // When files change, re-parse them. Note that you could optimize this so
                // that you only re-parse children that have been resolved in the past.
                watcher.onDidChange(async uri => {
                    const test = this._findFileEntry(uri);
                    if (!test) {
                        await this._discoverTestsInFile(uri);
                    } else {
                        await this._refreshFileEntry(test);
                    }
                    this._purgeEntriesWithNoChildren();
                }),
                // And, finally, delete TestItems for removed files. This is simple, since
                // we use the URI as the TestItem's ID.
                watcher.onDidDelete(uri => {
                    const test = this._findFileEntry(uri);
                    if (!test) {
                        return;
                    }
                    test.parent?.children.delete(test.id);
                    this._map.delete(test);
                    this._purgeEntriesWithNoChildren();
                }),
            );

            const allFiles = workspace.findFiles(pattern);
            const race = await Promise.race([allFiles, ...(cancelPromise ? [cancelPromise] : [])]);
            if (!race) {
                return watcher;
            }

            for (const file of race) {
                if (token?.isCancellationRequested) {
                    break;
                }
                this._discoverTestsInFile(file);
            }
            return watcher;
        });
        await Promise.all(promises);
    }

    private _getFindFilesPatternForCharm(workspaceCharm: WorkspaceCharm) {
        return new RelativePattern(workspaceCharm.testsUri, '**/*.py');
    }

    private _getCancellationTokenPromise(token: CancellationToken) {
        return new Promise<void>(resolve => {
            if (token.isCancellationRequested) {
                resolve();
            }
            const listener = token.onCancellationRequested(e => {
                listener.dispose();
                resolve();
            });
            this._disposables.push(listener);
        });
    }

    private async _startTestRun(isDebug: boolean, request: TestRunRequest, token: CancellationToken) {
        const queue: { test: TestItem; data: DirectoryTestData | FileTestData | ClassTestData | MethodTestData | FunctionTestData }[] = [];
        const run = this.controller.createTestRun(request);

        function gatherTestItems(collection: TestItemCollection) {
            const items: TestItem[] = [];
            collection.forEach(item => items.push(item));
            return items;
        }

        const discoverTests = async (tests: Iterable<TestItem>) => {
            for (const test of tests) {
                if (request.exclude?.includes(test)) {
                    continue;
                }

                const data = this._map.get(test);
                if (!data) {
                    continue;
                }

                if (data.kind === 'charm') {
                    await discoverTests(gatherTestItems(test.children));
                } else {
                    run.enqueued(test);
                    queue.push({ test, data });
                }
            }
        };

        const runTestQueue = async () => {
            for (const { test, data } of queue) {
                if (run.token.isCancellationRequested) {
                    run.skipped(test);
                    this._log(`Skipped ${test.id}\r\n`, run);
                } else {
                    run.started(test);
                    this._log(`Running ${test.id}\r\n`, run);
                    if (isDebug) {
                        this.reporter.sendTelemetryEvent(CharmTestProvider._telemetryEventDebug);
                        await this._debug(run, test, data, token);
                    } else {
                        this.reporter.sendTelemetryEvent(CharmTestProvider._telemetryEventRun);
                        await this._run(run, test, data, token);
                    }
                    this._log(`Completed ${test.id}\r\n`, run);
                }
            }

            run.end();
        };

        await discoverTests(request.include ?? gatherTestItems(this.controller.items));
        if (!queue.length) {
            window.showErrorMessage("No tests to run.");
            run.end();
            return;
        } else if (isDebug && queue.length > 1) {
            window.showErrorMessage("The extension does not support debugging multiple tests.");
            run.end();
            return;
        }
        await runTestQueue();
    };

    private async _run(run: TestRun, test: TestItem, data: DirectoryTestData | FileTestData | ClassTestData | MethodTestData | FunctionTestData, token: CancellationToken) {
        const { workspaceCharm, relativePath } = this.registry.getCharmByUri(data.uri);
        if (!workspaceCharm) {
            this._log('failed to locate corresponding charm; skipping.', run, test);
            run.skipped(test);
            return;
        }

        if (!workspaceCharm.hasVirtualEnv && !await this.ic.askAndSetupVirtualEnvFirst(workspaceCharm, true)) {
            this._log('charm has no virtual env; skipping.', run, test);
            run.skipped(test);
            return;
        }

        const env = await workspaceCharm.virtualEnv.computeActivationEnvVars(true);
        if (!env) {
            this._log('failed to compute env vars to activate venv; skipping.', run, test);
            run.skipped(test);
            return;
        }

        const { command, args, cwd } = this._getPytestCommand(data, workspaceCharm.home, relativePath);

        type ProcessResult = { code: number | null; stdout: string; stderr: string; };
        test.busy = true;
        const start = Date.now();
        const result = await new Promise<ProcessResult>(resolve => {
            const cp = spawn(command, args, {
                cwd: cwd.path,
                env: env,
            });
            const result: ProcessResult = {
                code: 0,
                stdout: '',
                stderr: '',
            };
            cp.stdout.on('data', (data) => {
                result.stdout += (data.toString() as string).replace(/\r?\n/g, '\r\n');
            });
            cp.stderr.on('data', (data) => {
                result.stderr += (data.toString() as string).replace(/\r?\n/g, '\r\n');;
            });
            cp.on('close', (code) => {
                result.code = code;
                resolve(result);
            });
        });
        test.busy = false;
        if (result.code === 0) {
            if (result.stdout) {
                this._log(result.stdout, run, test);
            }
            run.passed(test, Date.now() - start);
        } else {
            this._log(`test failed (exit code: ${result.code}): ${test.id}`, run, test);
            if (result.stdout) {
                this._log(result.stdout, run, test);
            }
            if (result.stderr) {
                this._log(result.stderr, run, test);
            }
            run.failed(test, new TestMessage(`${result.stdout}\r\n${result.stderr}`), Date.now() - start);
        }
    }

    private async _debug(run: TestRun, test: TestItem, data: DirectoryTestData | FileTestData | ClassTestData | MethodTestData | FunctionTestData, token: CancellationToken) {
        const { workspaceCharm, relativePath } = this.registry.getCharmByUri(data.uri);
        if (!workspaceCharm) {
            this._log('failed to locate corresponding charm; skipping.', run, test);
            run.skipped(test);
            return;
        }

        if (!workspaceCharm.hasVirtualEnv && !await this.ic.askAndSetupVirtualEnvFirst(workspaceCharm, true)) {
            this._log('charm has no virtual env; skipping.', run, test);
            run.skipped(test);
            return;
        }

        const env = await workspaceCharm.virtualEnv.computeActivationEnvVars(true);
        if (!env) {
            this._log('failed to compute env vars to activate venv; skipping.', run, test);
            run.skipped(test);
            return;
        }

        const { pytestArgs, cwd } = this._getPytestCommand(data, workspaceCharm.home, relativePath);

        const sessionIDKey = 'charmcraftIDETestSessionID' as const;
        const sessionId = randomUUID();

        let tracker: TestDebugAdapterTracker | undefined = undefined;
        const trackerListener = this._onCreateDebugAdapterTracker.event(e => {
            if (e.tracker || e.session.configuration[sessionIDKey] !== sessionId) {
                return;
            }
            e.tracker = tracker = new TestDebugAdapterTracker();
            trackerListener.dispose();
        });
        this._disposables.push(trackerListener);

        let sessionStartSignal: (value: DebugSession) => void;
        const sessionStartPromise = new Promise<DebugSession>(resolve => { sessionStartSignal = resolve; });
        const listener = debug.onDidStartDebugSession(e => {
            if (e.configuration[sessionIDKey] === sessionId) {
                sessionStartSignal(e);
                listener.dispose();
            }
        });
        this._disposables.push(listener);

        const started = await debug.startDebugging(
            workspace.getWorkspaceFolder(data.uri),
            {
                [sessionIDKey]: sessionId,
                type: 'python',
                request: 'launch',
                module: 'pytest',
                name: `Debug test ${test.id}`,
                debugLauncherPython: await workspaceCharm.virtualEnv.getPythonExecutablePath(),
                cwd: cwd.path,
                env,
                args: pytestArgs,
                console: "internalConsole",
            },
        );

        if (!started) {
            this._log('error: debug session did not start', run, test);
            run.skipped(test);
            return;
        }

        let sessionStopSignal: () => void;
        const sessionStopPromise = new Promise<void>(resolve => { sessionStopSignal = resolve; });

        const listener2 = debug.onDidTerminateDebugSession(e => {
            if (e.configuration[sessionIDKey] === sessionId) {
                if (tracker) {
                    const join = (lines: string[]) => lines.join('\n').replace(/[^\r]\n/, '\r\n');
                    const stdout = join(tracker.stdout);
                    const stderr = join(tracker.stderr);
                    const others = join(tracker.others);
                    const trail = [stdout, stderr, others].join('\r\n');
                    const markAsFailed = () => run.failed(test, new TestMessage(trail));
                    const markAsPassed = () => run.passed(test);
                    this._log(trail);
                    if (tracker.exitCode !== undefined) {
                        if (!tracker.exitCode) {
                            markAsPassed();
                        } else {
                            markAsFailed();
                        }
                    } else if (tracker.error) {
                        markAsFailed();
                    } else {
                        /**
                         * As a fallback try to parse the summary lines like these:
                         *   - "============================== 1 failed in 3.19s ==============================="
                         *   - "============================== 1 passed in 8.12s ==============================="
                         *   - "========================= 1 failed, 2 passed in 0.02s =========================="
                         */
                        const lines = stdout.trim().split('\n');
                        const summaryLine = lines[-1 + lines.length].trim();
                        const match = summaryLine.match(/^=+(.*?)=+$/g);
                        if (!match) {
                            run.skipped(test);
                        } else {
                            if (match[1].includes('failed')) {
                                markAsFailed();
                            } else if (match[1].includes('passed')) {
                                markAsPassed();
                            } else {
                                run.skipped(test);
                            }
                        }
                    }
                } else {
                    run.skipped(test);
                }

                listener2.dispose();
                sessionStopSignal();
            }
        });
        this._disposables.push(listener2);

        const session = await sessionStartPromise;
        const cancelListener = token.onCancellationRequested(e => {
            debug.stopDebugging(session);
            cancelListener.dispose();
        });
        this._disposables.push(cancelListener);
        await sessionStopPromise;
    }

    private _getPytestCommand(
        data: DirectoryTestData | FileTestData | ClassTestData | MethodTestData | FunctionTestData,
        charmHome: Uri,
        relativePath: string,
    ): { cwd: Uri; command: string; args: string[], pytestArgs: string[] } {
        const command = 'python3';
        const pytestArgs = ['-v', '--tb', 'native', '--log-cli-level=INFO', '--cache-clear'];
        if (data.kind === 'directory' || data.kind === 'file') {
            pytestArgs.push(relativePath);
        } else if (data.kind === 'class' || data.kind === 'function') {
            pytestArgs.push(`${relativePath}::${data.name}`);
        } else {
            pytestArgs.push(`${relativePath}::${data.class}::${data.name}`);
        }
        const args = ['-m', 'pytest', ...pytestArgs];
        return { command, args, pytestArgs, cwd: charmHome };
    }

    private _getLogFilePath(name: string): Uri {
        return Uri.joinPath(this.logUri, name);
    }

    private _log(message: string, run?: TestRun, test?: TestItem) {
        this.testOutput.appendLine(message);
        run?.appendOutput(
            message,
            test?.uri && test?.range ? { uri: test.uri, range: test.range } : undefined,
            test,
        );
    }
}

function traceChildren(testItem: TestItem): TestItem[] {
    return Array.from(childGenerator(testItem));
}

function firstChild(collection: TestItemCollection, predicate: (test: TestItem) => any): TestItem | undefined {
    for (const [, item] of collection) {
        if (predicate(item)) {
            return item;
        }
        for (const x of childGenerator(item)) {
            if (predicate(x)) {
                return x;
            }
        }
    }
}

function filterChildren(collection: TestItemCollection, predicate: (test: TestItem) => any): TestItem[] {
    const result = [];
    for (const [, item] of collection) {
        if (predicate(item)) {
            result.push(item);
        }
        for (const x of childGenerator(item)) {
            if (predicate(x)) {
                result.push(x);
            }
        }
    }
    return result;
}

function* childGenerator(testItem: TestItem) {
    const stack = [testItem];
    const result: TestItem[] = [];
    while (true) {
        const item = stack.pop();
        if (!item) {
            break;
        }
        if (item !== testItem) {
            yield item;
        }
        item.children.forEach(x => stack.push(x));
    }
}

class TestDebugAdapterTracker implements DebugAdapterTracker {
    public readonly stdout: string[] = [];
    public readonly stderr: string[] = [];
    public readonly others: string[] = [];

    private _exitCode: number | undefined = undefined;
    get exitCode() {
        return this._exitCode;
    }

    private _error: Error | undefined = undefined;
    get error() {
        return this._error;
    }

    /**
     * The debug adapter has sent a Debug Adapter Protocol message to the editor.
     */
    onDidSendMessage(message: any): void {
        if (message['type'] !== 'event') {
            return;
        }

        if (message['event'] === 'exited' && message.body?.exitCode !== undefined) {
            this._exitCode = message.body?.exitCode as number;
        }

        if (message['event'] !== 'output') {
            return;
        }
        if (message.body.category === 'stdout') {
            this.stdout.push(message.body.output);
        } else if (message.body.category === 'stderr') {
            this.stderr.push(message.body.output);
        } else {
            this.others.push(message.body.output);
        }
    }

    /**
     * An error with the debug adapter has occurred.
     */
    onError(error: Error): void {
        this._error = error;
    }

    /**
     * The debug adapter has exited with the given exit code or signal.
     */
    onExit(code: number | undefined, signal: string | undefined): void {
        if (code === undefined) {
            return;
        }
        this._exitCode = code;
    }
}

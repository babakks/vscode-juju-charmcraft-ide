import { CancellationToken, Event, Uri, WorkspaceFolder, QuickPickItem } from 'vscode';
export interface PythonExtension {
    ready: Promise<void>;
    jupyter: {
        registerHooks(): void;
    };
    debug: {
        getRemoteLauncherCommand(host: string, port: number, waitUntilDebuggerAttaches: boolean): Promise<string[]>;
        getDebuggerPackagePath(): Promise<string | undefined>;
    };
    datascience: {
        showDataViewer(dataProvider: IDataViewerDataProvider, title: string): Promise<void>;
        registerRemoteServerProvider(serverProvider: IJupyterUriProvider): void;
    };
    readonly environments: {
        getActiveEnvironmentPath(resource?: Resource): EnvironmentPath;
        updateActiveEnvironmentPath(environment: string | EnvironmentPath | Environment, resource?: Resource): Promise<void>;
        readonly onDidChangeActiveEnvironmentPath: Event<ActiveEnvironmentPathChangeEvent>;
        readonly known: readonly Environment[];
        readonly onDidChangeEnvironments: Event<EnvironmentsChangeEvent>;
        refreshEnvironments(options?: RefreshOptions, token?: CancellationToken): Promise<void>;
        resolveEnvironment(environment: Environment | EnvironmentPath | string): Promise<ResolvedEnvironment | undefined>;
        getEnvironmentVariables(resource?: Resource): EnvironmentVariables;
        readonly onDidEnvironmentVariablesChange: Event<EnvironmentVariablesChangeEvent>;
    };
}
interface IJupyterServerUri {
    baseUrl: string;
    token: string;
    authorizationHeader: any;
    expiration?: Date;
    displayName: string;
}
declare type JupyterServerUriHandle = string;
export interface IJupyterUriProvider {
    readonly id: string;
    getQuickPickEntryItems(): QuickPickItem[];
    handleQuickPick(item: QuickPickItem, backEnabled: boolean): Promise<JupyterServerUriHandle | 'back' | undefined>;
    getServerUri(handle: JupyterServerUriHandle): Promise<IJupyterServerUri>;
}
interface IDataFrameInfo {
    columns?: {
        key: string;
        type: ColumnType;
    }[];
    indexColumn?: string;
    rowCount?: number;
}
export interface IDataViewerDataProvider {
    dispose(): void;
    getDataFrameInfo(): Promise<IDataFrameInfo>;
    getAllRows(): Promise<IRowsResponse>;
    getRows(start: number, end: number): Promise<IRowsResponse>;
}
declare enum ColumnType {
    String = "string",
    Number = "number",
    Bool = "bool"
}
declare type IRowsResponse = any[];
export declare type RefreshOptions = {
    forceRefresh?: boolean;
};
export declare type Environment = EnvironmentPath & {
    readonly executable: {
        readonly uri: Uri | undefined;
        readonly bitness: Bitness | undefined;
        readonly sysPrefix: string | undefined;
    };
    readonly environment: {
        readonly type: EnvironmentType;
        readonly name: string | undefined;
        readonly folderUri: Uri;
        readonly workspaceFolder: WorkspaceFolder | undefined;
    } | undefined;
    readonly version: (VersionInfo & {
        readonly sysVersion: string | undefined;
    }) | undefined;
    readonly tools: readonly EnvironmentTools[];
};
export declare type ResolvedEnvironment = Environment & {
    readonly executable: {
        readonly uri: Uri | undefined;
        readonly bitness: Bitness;
        readonly sysPrefix: string;
    };
    readonly version: (ResolvedVersionInfo & {
        readonly sysVersion: string;
    }) | undefined;
};
export declare type EnvironmentsChangeEvent = {
    readonly env: Environment;
    readonly type: 'add' | 'remove' | 'update';
};
export declare type ActiveEnvironmentPathChangeEvent = EnvironmentPath & {
    readonly resource: WorkspaceFolder | undefined;
};
export declare type Resource = Uri | WorkspaceFolder;
export declare type EnvironmentPath = {
    readonly id: string;
    readonly path: string;
};
export declare type EnvironmentTools = KnownEnvironmentTools | string;
export declare type KnownEnvironmentTools = 'Conda' | 'Pipenv' | 'Poetry' | 'VirtualEnv' | 'Venv' | 'VirtualEnvWrapper' | 'Pyenv' | 'Unknown';
export declare type EnvironmentType = KnownEnvironmentTypes | string;
export declare type KnownEnvironmentTypes = 'VirtualEnvironment' | 'Conda' | 'Unknown';
export declare type Bitness = '64-bit' | '32-bit' | 'Unknown';
export declare type PythonReleaseLevel = 'alpha' | 'beta' | 'candidate' | 'final';
export declare type PythonVersionRelease = {
    readonly level: PythonReleaseLevel;
    readonly serial: number;
};
export declare type VersionInfo = {
    readonly major: number | undefined;
    readonly minor: number | undefined;
    readonly micro: number | undefined;
    readonly release: PythonVersionRelease | undefined;
};
export declare type ResolvedVersionInfo = {
    readonly major: number;
    readonly minor: number;
    readonly micro: number;
    readonly release: PythonVersionRelease;
};
export declare type EnvironmentVariables = {
    readonly [key: string]: string | undefined;
};
export declare type EnvironmentVariablesChangeEvent = {
    readonly resource: WorkspaceFolder | undefined;
    readonly env: EnvironmentVariables;
};
export declare const PVSC_EXTENSION_ID = "ms-python.python";
export declare namespace PythonExtension {
    function api(): Promise<PythonExtension>;
}
export {};

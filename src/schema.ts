import { readFileSync, watch } from 'fs';
import { readFile, readdir } from 'fs/promises';
import * as handlebars from 'handlebars';
import { URL } from 'url';
import { TextDecoder } from 'util';
import * as vscode from 'vscode';
import { type ExtensionAPI } from './include/redhat.vscode-yaml';
import path = require('path');

const EXTENSION_SCHEMA_DATA_DIR = 'schema/data';

const RED_HAT_YAML_EXT = 'redhat.vscode-yaml';
const GLOBAL_STATE_KEY_NEVER_ASK_FOR_YAML_EXT = 'never-ask-yaml-extension';

const SCHEMA_FILE = 'schema.json';
const SCHEMA_INCLUDE_SUBDIR = 'include';

type Schema = { uri: string, filename: string; content: string };
type SchemaMapByURI = Map<string, Schema>;
type SchemaMapByFilename = Map<string, Schema>;

export async function integrateWithYAMLExtension(context: vscode.ExtensionContext) {
    const yamlExtension = vscode.extensions.getExtension(RED_HAT_YAML_EXT);
    if (!yamlExtension) {
        const neverAsk = context.globalState.get(GLOBAL_STATE_KEY_NEVER_ASK_FOR_YAML_EXT);
        if (neverAsk) {
            return;
        }

        const resp = await vscode.window.showInformationMessage(
            "To enable YAML file services (e.g., schema validation or auto-completion) you need to install Red Hat YAML language server extension.",
            "Open Red Hat YAML Extension",
            "Never ask",
        );
        if (resp) {
            if (resp === 'Never ask') {
                context.globalState.update(GLOBAL_STATE_KEY_NEVER_ASK_FOR_YAML_EXT, true);
            } else {
                vscode.commands.executeCommand('extension.open', RED_HAT_YAML_EXT);
            }
        }
        return;
    }

    if (!yamlExtension.isActive) {
        await yamlExtension.activate();
    }

    const yaml = yamlExtension.exports as ExtensionAPI;
    await registerSchemas(
        path.join(context.extensionPath, EXTENSION_SCHEMA_DATA_DIR),
        yaml,
        // Enable watching for schema changes, only in development mode.
        context.extensionMode === vscode.ExtensionMode.Development,
    );
}

export async function registerSchemas(schemaDataDir: string, yamlExtensionAPI: ExtensionAPI, watchForChanges: boolean): Promise<vscode.Disposable[]> {
    let [byURI, byFilename] = await loadSchemas(schemaDataDir);
    const protocols = new Set(Array.from(byURI.keys()).map(x => new URL(x).protocol).map(x => x.substring(0, -1 + x.length)));

    for (const p of protocols) {
        yamlExtensionAPI.registerContributor(
            p,
            resource => {
                const filename = path.basename(resource);
                const value = byFilename.get(filename);
                return value?.uri;
            }, uri => {
                const value = byURI.get(uri);
                return value?.content;
            }
        );
    }

    const stack = [schemaDataDir];
    const dirs: string[] = [];
    while (stack.length) {
        const dir = stack.pop()!;
        dirs.push(dir);
        stack.push(...(await readdir(dir, { withFileTypes: true })).filter(x => x.isDirectory()).map(x => path.join(dir, x.name)));
    }

    const refresh = async (event: string, filename: string) => {
        [byURI, byFilename] = await loadSchemas(schemaDataDir);
    };

    if (!watchForChanges) {
        return [];
    }

    const watchers = dirs.map(dir => watch(dir, refresh));
    return watchers.map(x => ({ dispose: () => x.close() }));
}

async function loadSchemas(schemaDir: string): Promise<[SchemaMapByURI, SchemaMapByFilename]> {
    const entries = await readdir(schemaDir, { withFileTypes: true });
    const subdirs = entries.filter(x => x.isDirectory()).map(x => x.name);
    const byURI = new Map<string, Schema>();
    const byFilename = new Map<string, Schema>();
    for (const x of subdirs) {
        const schema = await loadSchemaFromDir(path.join(schemaDir, x));
        if (!schema.uri) {
            continue;
        }
        byURI.set(schema.uri, schema);
        byFilename.set(schema.filename, schema);
    }
    return [byURI, byFilename];
}

async function loadSchemaFromDir(schemaDir: string): Promise<Schema> {
    const filename = path.basename(schemaDir);
    const includeDir = path.join(schemaDir, SCHEMA_INCLUDE_SUBDIR);
    const schemaFile = path.join(schemaDir, SCHEMA_FILE);
    const template = new TextDecoder().decode(await readFile(schemaFile));
    const content = render(template, includeDir);
    const parsed = JSON.parse(content);
    const uri = parsed && typeof parsed === 'object' && typeof parsed.$id === 'string' ? parsed.$id : "";
    return { uri, filename, content };
}

function render(template: string, includeDir: string) {
    const engine = handlebars.create();
    engine.registerHelper('include', function (ref: string) {
        if (!ref) {
            return "";
        }
        const f = path.join(includeDir, ref.endsWith('.md') ? ref : ref + '.md');
        const raw = new TextDecoder().decode(readFileSync(f));
        const quoted = JSON.stringify(raw);
        return quoted.substring(1, -1 + quoted.length);
    });
    return engine.compile(template)({});
}

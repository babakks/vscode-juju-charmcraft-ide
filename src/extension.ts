import { readFileSync, watch } from 'fs';
import { readFile, readdir } from 'fs/promises';
import * as handlebars from 'handlebars';
import { URL } from 'url';
import { TextDecoder } from 'util';
import * as vscode from 'vscode';
import { type ExtensionAPI } from './redhat.vscode-yaml';
import path = require('path');

export async function activate(context: vscode.ExtensionContext) {
    await registerSchemas(context.extensionPath);
    let disposable = vscode.commands.registerCommand('vscode-juju-charms-ide.helloWorld', () => {
        vscode.window.showInformationMessage('Hello World from Juju Charms IDE!');
    });
    context.subscriptions.push(disposable);
}

export function deactivate() { }

async function registerSchemas(extensionPath: string): Promise<vscode.Disposable> {
    const yaml = vscode.extensions.getExtension("redhat.vscode-yaml")?.exports as ExtensionAPI;
    if (!yaml) {
        throw new Error('Failed to retrieve `redhat.vscode-yaml` extension API');
    }

    const schemaDir = path.join(extensionPath, ...SCHEMA_DIR);
    let [byURI, byFilename] = await loadSchemas(schemaDir);
    const protocols = new Set(Array.from(byURI.keys()).map(x => new URL(x).protocol).map(x => x.substring(0, -1 + x.length)));

    for (const p of protocols) {
        yaml.registerContributor(
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

    const stack = [schemaDir];
    const dirs: string[] = [];
    while (stack.length) {
        const dir = stack.pop()!;
        dirs.push(dir);
        stack.push(...(await readdir(dir, { withFileTypes: true })).filter(x => x.isDirectory()).map(x => path.join(dir, x.name)));
    }

    const refresh = async (event: string, filename: string) => {
        [byURI, byFilename] = await loadSchemas(schemaDir);
    };
    const watchers = dirs.map(dir => watch(dir, refresh));
    return { dispose: () => { watchers.forEach(x => x.close()); } };
}

type Schema = { uri: string, filename: string; content: string };
type SchemaMapByURI = Map<string, Schema>;
type SchemaMapByFilename = Map<string, Schema>;

const SCHEMA_DIR = ['schema', 'data'];
const SCHEMA_FILE = 'schema.json';

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

const SCHEMA_INCLUDE_SUBDIR = 'include';
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

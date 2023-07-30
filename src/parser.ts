import * as yaml from 'js-yaml';
import {
    CharmAction,
    CharmActionProblem,
    CharmActions,
    CharmConfig,
    CharmConfigParameter,
    CharmConfigParameterProblem,
    isConfigParameterType
} from './model/charm';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path = require('path');
import { spawn } from 'child_process';

const _ACTION_PROBLEMS = {
    invalidYAMLFile: { message: "Invalid YAML file." },
    entryMustBeObject: (key: string) => ({ action: key, message: `Action entry \`${key}\` must be an object.` }),
    entryDescriptionMustBeValid: (key: string) => ({ action: key, message: `Description for action \`${key}\` should be a string.` }),
} satisfies Record<string, CharmActionProblem | ((...args: any[]) => CharmActionProblem)>;

export function parseCharmActionsYAML(content: string): CharmActions {
    const problems: CharmActionProblem[] = [];
    const doc = yaml.load(content);
    if (!doc || typeof doc !== 'object') {
        problems.push(_ACTION_PROBLEMS.invalidYAMLFile);
        return { actions: [], problems };
    }

    const actions: CharmAction[] = [];
    for (const [name, value] of Object.entries(doc)) {
        const entry: CharmAction = {
            name,
            symbol: toValidSymbol(name),
            problems: [],
        };
        actions.push(entry);

        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            entry.problems.push(_ACTION_PROBLEMS.entryMustBeObject(name));
            continue;
        }

        if ('description' in value) {
            if (typeof value.description !== 'string') {
                entry.problems.push(_ACTION_PROBLEMS.entryDescriptionMustBeValid(name));
            } else {
                entry.description = value.description;
            }
        }
    }

    return { actions, problems };
}

export function toValidSymbol(value: string): string {
    return value.replace(/-/g, '_');
}


const _CONFIG_PROBLEMS = {
    invalidYAMLFile: { message: "Invalid YAML file." },
    optionsFieldMissing: { message: "Missing `options` field." },
    optionsFieldMustBeObject: { message: "The `options` field must be an object." },
    paramEntryMustBeObject: (key: string) => ({ parameter: key, message: `Parameter entry \`${key}\` must be an object.` }),
    paramEntryMustIncludeType: (key: string) => ({ parameter: key, message: `Parameter \`${key}\` must include \`type\` field.` }),
    paramEntryTypeMustBeValid: (key: string) => ({ parameter: key, message: `Parameter \`${key}\` must have a valid type; \`bool\`, \`string\`, \`int\`, or \`float\`.` }),
    paramEntryDefaultMustMatchTypeBoolean: (key: string) => ({ parameter: key, message: `Default value for parameter \`${key}\` should be a boolean value.` }),
    paramEntryDefaultMustMatchTypeString: (key: string) => ({ parameter: key, message: `Default value for parameter \`${key}\` should be a string value.` }),
    paramEntryDefaultMustMatchTypeInteger: (key: string) => ({ parameter: key, message: `Default value for parameter \`${key}\` should be an integer value.` }),
    paramEntryDefaultMustMatchTypeFloat: (key: string) => ({ parameter: key, message: `Default value for parameter \`${key}\` should be a float value.` }),
    paramEntryDefaultMustBeValid: // This happens when there'n no `type` field to restrict the default value type
        (key: string) => ({ parameter: key, message: `Default value for parameter \`${key}\` must have a valid type; boolean, string, integer, or float.` }),
    paramEntryDescriptionMustBeValid: (key: string) => ({ parameter: key, message: `Description for parameter \`${key}\` should be a string.` }),
} satisfies Record<string, CharmConfigParameterProblem | ((...args: any[]) => CharmConfigParameterProblem)>;

export function parseCharmConfigYAML(content: string): CharmConfig {
    const problems: CharmConfigParameterProblem[] = [];
    const doc = yaml.load(content);
    if (!doc || typeof doc !== 'object') {
        problems.push(_CONFIG_PROBLEMS.invalidYAMLFile);
        return { parameters: [], problems };
    }
    if (!('options' in doc)) {
        problems.push(_CONFIG_PROBLEMS.optionsFieldMissing);
        return { parameters: [], problems };
    }
    if (!doc.options || typeof doc.options !== 'object' || Array.isArray(doc.options)) {
        problems.push(_CONFIG_PROBLEMS.optionsFieldMustBeObject);
        return { parameters: [], problems };
    }

    const parameters: CharmConfigParameter[] = [];
    for (const [name, value] of Object.entries(doc.options)) {
        const entry: CharmConfigParameter = {
            name,
            problems: [],
        };
        parameters.push(entry);

        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            entry.problems.push(_CONFIG_PROBLEMS.paramEntryMustBeObject(name));
            continue;
        }

        if (!('type' in value)) {
            entry.problems.push(_CONFIG_PROBLEMS.paramEntryMustIncludeType(name));
        } else if (!value.type || typeof value.type !== 'string' || !isConfigParameterType(value.type)) {
            entry.problems.push(_CONFIG_PROBLEMS.paramEntryTypeMustBeValid(name));
        } else {
            entry.type = value.type;
        }

        if ('default' in value) {
            const defaultValue = value.default;
            if (entry.type) {
                let problem: CharmConfigParameterProblem | undefined;

                if (entry.type === 'string' && typeof defaultValue !== 'string') {
                    problem = _CONFIG_PROBLEMS.paramEntryDefaultMustMatchTypeString(name);
                }
                else if (entry.type === 'boolean' && typeof defaultValue !== 'boolean') {
                    problem = _CONFIG_PROBLEMS.paramEntryDefaultMustMatchTypeBoolean(name);
                }
                else if (entry.type === 'int' && (typeof defaultValue !== 'number' || !Number.isInteger(defaultValue))) {
                    problem = _CONFIG_PROBLEMS.paramEntryDefaultMustMatchTypeInteger(name);
                }
                else if (entry.type === 'float' && typeof defaultValue !== 'number') {
                    problem = _CONFIG_PROBLEMS.paramEntryDefaultMustMatchTypeFloat(name);
                }

                if (problem) {
                    entry.problems.push(problem);
                } else {
                    entry.default = defaultValue;
                }
            } else {
                // There's no valid type for the parameter, so we should check if the default value is not essentially invalid.
                if (!(typeof defaultValue === 'string' || typeof defaultValue === 'boolean' || typeof defaultValue === 'number')) {
                    entry.problems.push(_CONFIG_PROBLEMS.paramEntryDefaultMustBeValid(name));
                } else {
                    entry.default = defaultValue;
                }
            }
        }

        if ('description' in value) {
            if (typeof value.description !== 'string') {
                entry.problems.push(_CONFIG_PROBLEMS.paramEntryDescriptionMustBeValid(name));
            } else {
                entry.description = value.description;
            }
        }
    }

    return { parameters, problems };
}

export async function getPythonAST(content: string): Promise<any | undefined> {
    const tmp = await mkdtemp(path.join(tmpdir(), 'juju-charms-ide'));
    try {
        const tmpfile = path.join(tmp, 'temp.py');
        const scriptPath = path.join(__dirname, '../resource/ast/python-ast-to-json.py');
        await writeFile(tmpfile, content);

        const [exitCode, ast] = await new Promise<[number, string]>(function (resolve, reject) {
            let data = '';
            const process = spawn('python3', [scriptPath, tmpfile]);
            process.on('close', function (code) {
                resolve([code || 0, data]);
            });
            process.stdout.on('data', chunk => {
                data += chunk.toString();
            });
        });
        return exitCode === 0 ? JSON.parse(ast) : undefined;
    } catch {
        return undefined;
    } finally {
        await rm(tmp, { recursive: true, force: true });
    }
}

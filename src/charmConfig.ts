import * as yaml from 'js-yaml';

export type CharmConfigParameterType = 'string' | 'int' | 'float' | 'boolean';
function isConfigParameterType(value: string): value is CharmConfigParameterType {
    return value === 'string' || value === 'int' || value === 'float' || value === 'boolean';
}

export interface CharmConfigParameter {
    name: string;
    type?: CharmConfigParameterType;
    description?: string;
    default?: string | number | boolean;
    problems: CharmConfigParameterProblem[];
}

export interface CharmConfigParameterProblem {
    message: string;
    parameter?: string;
}

const _PROBLEMS = {
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

export function parseCharmConfigYAML(content: string): [CharmConfigParameter[], CharmConfigParameterProblem[]] {
    const problems: CharmConfigParameterProblem[] = [];
    const doc = yaml.load(content);
    if (!doc || typeof doc !== 'object') {
        problems.push(_PROBLEMS.invalidYAMLFile);
        return [[], problems];
    }
    if (!('options' in doc)) {
        problems.push(_PROBLEMS.optionsFieldMissing);
        return [[], problems];
    }
    if (!doc.options || typeof doc.options !== 'object' || Array.isArray(doc.options)) {
        problems.push(_PROBLEMS.optionsFieldMustBeObject);
        return [[], problems];
    }

    const result: CharmConfigParameter[] = [];
    for (const [name, value] of Object.entries(doc.options)) {
        const entry: CharmConfigParameter = {
            name,
            problems: [],
        };
        result.push(entry);

        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            entry.problems.push(_PROBLEMS.paramEntryMustBeObject(name));
            continue;
        }

        if (!('type' in value)) {
            entry.problems.push(_PROBLEMS.paramEntryMustIncludeType(name));
        } else if (!value.type || typeof value.type !== 'string' || !isConfigParameterType(value.type)) {
            entry.problems.push(_PROBLEMS.paramEntryTypeMustBeValid(name));
        } else {
            entry.type = value.type;
        }

        if ('default' in value) {
            const defaultValue = value.default;
            if (entry.type) {
                let problem: CharmConfigParameterProblem | undefined;

                if (entry.type === 'string' && typeof defaultValue !== 'string') {
                    problem = _PROBLEMS.paramEntryDefaultMustMatchTypeString(name);
                }
                else if (entry.type === 'boolean' && typeof defaultValue !== 'boolean') {
                    problem = _PROBLEMS.paramEntryDefaultMustMatchTypeBoolean(name);
                }
                else if (entry.type === 'int' && (typeof defaultValue !== 'number' || !Number.isInteger(defaultValue))) {
                    problem = _PROBLEMS.paramEntryDefaultMustMatchTypeInteger(name);
                }
                else if (entry.type === 'float' && typeof defaultValue !== 'number') {
                    problem = _PROBLEMS.paramEntryDefaultMustMatchTypeFloat(name);
                }

                if (problem) {
                    entry.problems.push(problem);
                } else {
                    entry.default = defaultValue;
                }
            } else {
                // There's no valid type for the parameter, so we should check if the default value is not essentially invalid.
                if (!(typeof defaultValue === 'string' || typeof defaultValue === 'boolean' || typeof defaultValue === 'number')) {
                    entry.problems.push(_PROBLEMS.paramEntryDefaultMustBeValid(name));
                } else {
                    entry.default = defaultValue;
                }
            }
        }

        if ('description' in value) {
            if (typeof value.description !== 'string') {
                entry.problems.push(_PROBLEMS.paramEntryDescriptionMustBeValid(name));
            } else {
                entry.description = value.description;
            }
        }
    }

    return [result, problems];

}

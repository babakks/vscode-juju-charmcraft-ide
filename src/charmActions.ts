import * as yaml from 'js-yaml';
import { CharmAction, CharmActionProblem, CharmActions } from './charmTypes';
import { toValidSymbol } from './util';

const _PROBLEMS = {
    invalidYAMLFile: { message: "Invalid YAML file." },
    entryMustBeObject: (key: string) => ({ action: key, message: `Action entry \`${key}\` must be an object.` }),
    entryDescriptionMustBeValid: (key: string) => ({ action: key, message: `Description for action \`${key}\` should be a string.` }),
} satisfies Record<string, CharmActionProblem | ((...args: any[]) => CharmActionProblem)>;

export function parseCharmActionsYAML(content: string): CharmActions {
    const problems: CharmActionProblem[] = [];
    const doc = yaml.load(content);
    if (!doc || typeof doc !== 'object') {
        problems.push(_PROBLEMS.invalidYAMLFile);
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
            entry.problems.push(_PROBLEMS.entryMustBeObject(name));
            continue;
        }

        if ('description' in value) {
            if (typeof value.description !== 'string') {
                entry.problems.push(_PROBLEMS.entryDescriptionMustBeValid(name));
            } else {
                entry.description = value.description;
            }
        }
    }

    return { actions, problems };
}

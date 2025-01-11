import { emptyYAMLNode, type MapWithNode, type Problem, type WithNode, type YAMLNode } from "./yaml";

/**
 * Problems specific to `config.yaml`.
 */
export const CONFIG_YAML_PROBLEMS = {
    /**
    * Occurs when the `default` field is assigned with a wrong type of value (e.g., object or array) and also the `type`
    * field (to pinpoint the type of the default value) is missing,
     */
    invalidDefault: { id: 'invalidDefault', message: `Default value must have a valid type; boolean, string, integer, or float.` },
    wrongDefaultType: (expected: CharmConfigYAMLParameterType) => ({ id: 'wrongDefaultType', message: `Default value must match the parameter type; it must be ${expected === 'int' ? 'an integer' : 'a ' + expected}.` }),
} satisfies Record<string, Problem | ((...args: any[]) => Problem)>;

export type CharmConfigYAMLParameterType = 'string' | 'int' | 'float' | 'boolean';
export function isCharmConfigYAMLParameterType(value: string): value is CharmConfigYAMLParameterType {
    return value === 'string' || value === 'int' || value === 'float' || value === 'boolean';
}

export interface CharmConfigYAMLParameter {
    name: string;
    type?: WithNode<CharmConfigYAMLParameterType>;
    description?: WithNode<string>;
    default?: WithNode<string | number | boolean>;
}

export interface CharmConfigYAML {
    parameters?: MapWithNode<CharmConfigYAMLParameter>;
    /**
     * Root node.
     */
    node: YAMLNode;
}

export function emptyConfig(): CharmConfigYAML {
    return {
        node: emptyYAMLNode(),
    };
}

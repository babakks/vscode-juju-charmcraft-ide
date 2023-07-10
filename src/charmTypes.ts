export type CharmConfigParameterType = 'string' | 'int' | 'float' | 'boolean';
export function isConfigParameterType(value: string): value is CharmConfigParameterType {
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

export interface CharmConfig {
    parameters: CharmConfigParameter[];
    problems: CharmConfigParameterProblem[];
}

export interface CharmEvent {
    name: string;
    description?: string;
}
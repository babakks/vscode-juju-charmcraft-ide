/*
 * TODO
 * We have skipped AST-scope granularity (e.g., nodes or problems) for tox
 * configuration model, for now. Maybe at some point in future we decided to add
 * them to the type, after which point the type should look like others (e.g.,
 * actions or config ) where WithNode<T> has replaced primitive types.
 */
export interface CharmToxConfig {
    sections: { [key: string]: CharmToxConfigSection };
}

export interface CharmToxConfigSection {
    /**
     * Section name, e.g., `testenv:lint`.
     */
    name: string;

    /**
     * Environment name, e.g., `lint`.
     */
    env: string;

    /**
     * Environment parent name, e.g., `testenv`.
     */
    parent: string;
}


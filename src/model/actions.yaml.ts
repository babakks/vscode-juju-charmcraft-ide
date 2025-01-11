import { emptyYAMLNode, type MapWithNode, type WithNode, type YAMLNode } from "./yaml";

export interface CharmAction {
    name: string;
    symbol: string;
    description?: WithNode<string>;
}

export interface CharmActions {
    actions?: MapWithNode<CharmAction>;
    /**
     * Root node.
     */
    node: YAMLNode;
}

export function emptyActions(): CharmActions {
    return {
        node: emptyYAMLNode(),
    };
}

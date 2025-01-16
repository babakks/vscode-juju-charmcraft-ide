import type { CharmActions } from '../model/actions.yaml';
import { TextPositionMapper, toValidSymbol } from '../model/common';
import { GENERIC_YAML_PROBLEMS } from '../model/yaml';
import { assignScalarFromPair, readMap, YAMLParser } from './common';

export function parseCharmActionsYAML(text: string): CharmActions {
    const { tree } = new YAMLParser(text).parse();
    if (!tree) {
        return {
            node: {
                kind: 'map',
                problems: [],
                text,
                range: new TextPositionMapper(text).all(),
            }
        };
    }

    const result: CharmActions = {
        node: tree.node,
    };

    result.actions = readMap(tree, (value, key, entry) => {
        if (value.node.kind !== 'map') {
            entry.node.problems.push(GENERIC_YAML_PROBLEMS.expectedMap);
            return;
        }
        entry.value = {
            name: key,
            symbol: toValidSymbol(key),
        };
        entry.value.description = assignScalarFromPair(value, 'description', 'string');
    });
    return result;
}

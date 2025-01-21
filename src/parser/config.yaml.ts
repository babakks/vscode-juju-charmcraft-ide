import { TextPositionMapper } from '../model/common';
import { CONFIG_YAML_PROBLEMS, type CharmConfig } from '../model/config.yaml';
import { GENERIC_YAML_PROBLEMS } from '../model/yaml';
import { assignAnyFromPair, assignScalarFromPair, assignStringEnumFromScalarPair, readMapOfMap, YAMLParser } from './common';

export function parseCharmConfigYAML(text: string): CharmConfig {
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

    const result: CharmConfig = {
        node: tree.node,
    };

    if (tree.node.kind !== 'map') {
        result.node.problems.push(GENERIC_YAML_PROBLEMS.expectedMap);
        return result;
    }

    result.parameters = readMapOfMap(tree, 'options', (map, key, entry) => {
        entry.value = {
            name: key,
            description: assignScalarFromPair(map, 'description', 'string'),
        };

        entry.value.type = assignStringEnumFromScalarPair(map, 'type', ['string', 'int', 'float', 'boolean'], true, entry.node.problems);

        const defaultValue = assignAnyFromPair(map, 'default');
        if (defaultValue?.value !== undefined) {
            entry.value.default = defaultValue;
            if (entry.value.type?.value !== undefined) {
                if (
                    entry.value.type.value === 'string' && typeof entry.value.default.value !== 'string'
                    || entry.value.type.value === 'boolean' && typeof entry.value.default.value !== 'boolean'
                    || entry.value.type.value === 'float' && typeof entry.value.default.value !== 'number'
                    || entry.value.type.value === 'int' && (typeof entry.value.default.value !== 'number' || !Number.isInteger(defaultValue.value))
                ) {
                    entry.value.default.value = undefined; // Dropping invalid value.
                    entry.value.default.node.problems.push(CONFIG_YAML_PROBLEMS.wrongDefaultType(entry.value.type.value));
                }
            } else {
                // Parameter has no `type`, so we should check if the default value is not essentially invalid.
                if (
                    typeof entry.value.default.value !== 'string'
                    && typeof entry.value.default.value !== 'boolean'
                    && typeof entry.value.default.value !== 'number'
                ) {
                    entry.value.default.value = undefined; // Dropping invalid value.
                    entry.value.default.node.problems.push(CONFIG_YAML_PROBLEMS.invalidDefault);
                }
            }
        }
    });
    return result;
}

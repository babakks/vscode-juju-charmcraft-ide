***`actions`***

**Status:** Optional.

**Purpose:** Defines an action.

**Structure:** Map with `string` keys, and map values which are YAML equivalent of a JSON Schema object, except:

1. It includes some new keys specific to actions: `description`, `parallel`, and `execution-group`.
2. It does not currently support the JSON Schema concepts `$schema` and `$ref`.
3. The `additionalProperties` and `required` keys from JSON Schema can be used at the top-level of an action (adjacent to `description` and `params`), but also used anywhere within a nested schema.

See more:
- https://juju.is/docs/sdk/charmcraft-yaml#heading--actions
- https://juju.is/docs/sdk/actions-yaml
- [JSON Schema Docs](https://www.learnjsonschema.com/2020-12/)

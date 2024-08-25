<a href="#heading--actions"><h2 id="heading--actions">`actions`</h2></a>

**Status:** Optional.

**Purpose:** Defines an action.

**Name:** String = user-defined action name.

**Value:** Mapping = the YAML equivalent of a JSON Schema object, except:

1. It includes some new keys specific to actions: `description`, `parallel`, and `execution-group`.
2. It does not currently support the JSON Schema concepts `$schema` and `$ref`.
3. The `additionalProperties` and `required` keys from JSON Schema can be used at the top-level of an action (adjacent to `description` and `params`), but also used anywhere within a nested schema.

> See more: [JSON Schema Docs](https://www.learnjsonschema.com/2020-12/)

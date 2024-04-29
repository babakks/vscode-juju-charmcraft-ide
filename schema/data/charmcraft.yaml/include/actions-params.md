***`params`***

**Status:** Optional.

**Purpose:** To define the fixed parameters for the action. Fixed parameters are those with a name given by a fixed string.

**Structure:** *Type:* Map. *Value:* One or more key-value pairs where each key is a parameter name and each value is the YAML equivalent of a valid JSON Schema. The entire map of `<action>.params` is inserted into the action schema object as a “properties” validation keyword. The Juju CLI may read the “description” annotation keyword of each parameter to present to the user when describing the action.

See more:
- https://juju.is/docs/sdk/charmcraft-yaml#heading--actions-action-params
- https://juju.is/docs/sdk/actions-yaml
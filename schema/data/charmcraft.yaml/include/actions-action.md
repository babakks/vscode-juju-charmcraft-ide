***[Action]***

**Status:** Required, one for each action.

**Purpose:** To define an action supported by the charm.

The information stated here will feed into `juju actions <charm>` and `juju run <charm unit> <action>`, helping a Juju end user know what actions and action parameters are defined for the charm.
> See more: [Juju | `juju actions`](https://juju.is/docs/juju/juju-actions), [Juju | `juju run`](https://juju.is/docs/juju/juju-run)

**Structure:** *Name:* The name of the key (`<action name>`) is defined by the charm author.  It should be a valid Python [identifier](https://docs.python.org/3/reference/lexical_analysis.html#identifiers) except that it may contain hyphens which will be mapped to underscores in the Python event handler.

*Type:* Map.

*Value:* A series of keys-value pairs corresponding to action metadata and to parameter validation, defined as follows:

```text
<action>:
  # Action metadata keys
  description: <string>
  parallel: <boolean>
  execution-group: <string>
  # Parameter validation keys, cf. JSON Schema object
  params:
    <param 1>: <...>
    <param 2>: <...>
    …
  <other key-value pairs>
```

As you can see, the action definition schema defines a typical JSON Schema object, except:
1. It includes some new keys specific to actions: `description`, `parallel`, and `execution-group`.
2. It does not currently support the JSON Schema concepts `$schema` and `$ref`.

See more:
- https://juju.is/docs/sdk/charmcraft-yaml#heading--actions
- https://juju.is/docs/sdk/actions-yaml
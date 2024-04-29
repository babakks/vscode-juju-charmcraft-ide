***`config`***

**Status:** Optional.

**Purpose:** The `config` key allows you to create configuration options for your charm.


```yaml
config:
  options:
    # Each option name is the name by which the charm will query the option.
    <option name>:
      # (Required) The type of the option
      type: string | int | float | boolean | secret
      # (Optional) The default value of the option
      default: <a reasonable default value of the same type as the option>
      # (Optional): A string describing the option. Also appears on charmhub.io
      description: <description string>
```

For the case where the `type` is `secret`, the `<option-name>` is a string that needs to correspond to the secret URI.

**Example:**

```yaml
config:
  options:
    name:
      default: Wiki
      description: The name, or Title of the Wiki
      type: string
    skin:
      default: vector
      description: skin for the Wiki
      type: string
    logo:
      description: URL to fetch logo from
      type: string
    admins:
      description: 'Comma-separated list of admin users to create: user:pass[,user:pass]+'
      type: string
    debug:
      default: false
      type: boolean
      description: turn on debugging features of mediawiki
```

See more:
- [Juju | Application configuration](https://juju.is/docs/juju/configuration)
- https://juju.is/docs/sdk/charmcraft-yaml#heading--config
- https://juju.is/docs/sdk/config-yaml

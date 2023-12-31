<a href="#heading--options"><h2 id="heading--options">`options`</h2></a>

**Status:** Optional.

**Purpose:** The `options` key allows charm authors to declare the configuration options that they have defined for a charm.

**Structure:** The key contains a definition block for each option, where each definition consists of a charm-author-defined option name and an option description, given in 3 fields -- type, description, and default value:

```yaml
options:
  <option name>:
    default: <default value>
    description: <description>
    type: <type>
  <option name>:
    default: <default value>
    description: <description>
    type: <type>
  ...
```

where each field is defined as below:

|  Field Name   | Specification                                                                                                                   | Required? |
| :-----------: | ------------------------------------------------------------------------------------------------------------------------------- | :-------: |
|    `type`     | Specifies the data type of the configuration option. Possible values are: `string`, `int`, `float` and `boolean`.               |    Yes    |
| `description` | Contains an explanation of the configuration item and the resulting behaviour. Might also include a list of acceptable values.  |    No     |
|   `default`   | Defines the default value for the option. Must be of the appropriate type and a sane default value in the context of the charm. |    No     |

In some cases, it may be awkward or impossible to provide a sensible default. In these cases, ensure that it is noted in the description of the configuration option. It is acceptable to provide `null` configuration defaults or simply omit the `default` field, for example:

- `default: `
- `default: ‘’`
- `default: ""`


**Examples:**

```yaml
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
    default:
    description: URL to fetch logo from
    type: string
  admins:
    default:
    description: Comma-separated list of admin users to create: user:pass[,user:pass]+
    type: string
  debug:
    default: false
    type: boolean
    description: turn on debugging features of mediawiki
```

<a href="#heading--option.default"><h2 id="heading--option.default">`[option].default`</h2></a>

**Status:** Optional.

**Purpose:** Defines the default value for the option. Must be of the appropriate type and a sane default value in the context of the charm.

In some cases, it may be awkward or impossible to provide a sensible default. In these cases, ensure that it is noted in the description of the configuration option. It is acceptable to provide `null` configuration defaults or simply omit the `default` field, for example:

- `default: `
- `default: ‘’`
- `default: ""`

**Structure:**

```yaml
default: <default value>
```

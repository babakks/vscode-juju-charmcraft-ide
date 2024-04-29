***`attributes`***

**Status:** Optional.

**Purpose:** Defines attributes that should be ignored when running the `charmcraft analyze` command. 

```yaml
attributes: [<check-name>,...]
```

**Example:**

```yaml
attributes:
- framework
```

See more:
- https://juju.is/docs/sdk/charmcraft-yaml#heading--analysis

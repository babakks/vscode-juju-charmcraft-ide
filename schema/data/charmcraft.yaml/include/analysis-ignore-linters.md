***`linters`***

**Status:** Optional.

**Purpose:** Defines linters that should be ignored when running the `charmcraft analyze` command. 

```yaml
linters: [<check-name>,...]
```

**Example:**

```yaml
linters:
- entrypoint
```

See more:
- https://juju.is/docs/sdk/charmcraft-yaml#heading--analysis

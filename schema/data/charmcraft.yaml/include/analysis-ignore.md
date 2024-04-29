***`ignore`***

**Status:** Optional.

**Purpose:** Defines attributes or linters that should be ignored when running the `charmcraft analyze` command. 

```yaml
ignore:
  attributes: [<check-name>,...]
  linters: [<check-name>,...]
```

**Example:**

```yaml
ignore:
  attributes:
  - framework
  linters:
  - entrypoint
```

See more:
- https://juju.is/docs/sdk/charmcraft-yaml#heading--analysis

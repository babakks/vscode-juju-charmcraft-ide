***`analysis`***

**Status:** Optional.

**Purpose:** Defines how the analysis done on the package will behave. This analysis is run implicitly as part of the `pack` command but can be called explicitly with the `charmcraft analyze` command. 

**Structure:** So far the only thing that can be configured is which attributes or linters will be ignored.

```yaml
analysis:
  ignore:
    attributes: [<check-name>,...]
    linters: [<check-name>,...]
```

**Example:**

```yaml
analysis:
  ignore:
    attributes:
    - framework
    linters:
    - entrypoint
```

See more:
- https://juju.is/docs/sdk/charmcraft-yaml#heading--analysis

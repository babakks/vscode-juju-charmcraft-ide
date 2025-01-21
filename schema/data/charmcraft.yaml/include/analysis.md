<a href="#heading--analysis"><h2 id="heading--analysis">`analysis`</h2></a>

**Status:** Optional.

**Purpose:** Defines how the analysis done on the package will behave. This analysis is run implicitly as part of the `pack` command but can be called explicitly with the `charmcraft analyze` command. 

<!--It controls the behaviour of the analysis done when packing charms or explicitly requested by the `analyze` command.
-->

**Structure:** So far the only thing that can be configured is which attributes or linters will be ignored.

```text
analysis:
  ignore:
    attributes: [<check-name>,...]
    linters: [<check-name>,...]
```

**Example:**

```text
analysis:
  ignore:
    attributes:
    - framework
    linters:
    - entrypoint
```

<a href="#heading--extra-bindings"><h2 id="heading--extra-bindings">`extra-bindings`</h2></a>

**Status:** Optional.

**Purpose:** Extra bindings for the charm. For example binding extra network interfaces.

**Structure:**  A key-only map; key represents the name of the binding:

```text
extra-bindings:
    <binding name>:
```

**Example:**

```text
extra-bindings:
  Ring of Power: null
```

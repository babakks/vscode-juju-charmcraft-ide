<a href="#heading--name"><h2 id="heading--name">`name`</h2></a>

 **Status:** If the `type` key is set to `charm`, required.

**Purpose:** The name of the charm. Determines the charm page URL in Charmhub and the name administrators will ultimately use to deploy the charm. E.g. `juju deploy <name>`.

**Structure:**

```yaml
name: <name>
```

**Example:**

```text
name: traefik-k8s
```

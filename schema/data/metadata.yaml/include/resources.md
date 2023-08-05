<a href="#heading--resources"><h2 id="heading--resources">`resources`</h2></a>

**Status:** Optional.

**Purpose:** The `resources` key is where you define the resources mentioned
under the `resource` key of the [`containers`](#heading--containers) key.

See also: [Resource](https://juju.is/docs/sdk/about-resources)

**Structure:** 

```yaml
resources:
 # Each key represents the name of a resource mentioned in the 'resource' subkey of the 'containers' key.
 <resource name>: {...}
```

**Examples:**

```yaml
resources:
 super-app-image:
  type: oci-image
  description: OCI image for the Super App (hub.docker.com/_/super-app)
```

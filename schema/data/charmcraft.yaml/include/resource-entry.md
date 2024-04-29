<a href="#heading--resource"><h2 id="heading--resource">`[resource]`</h2></a>

**Status:** Optional.

**Purpose:** Each key represents the name of a resource mentioned in the 'resource' subkey of the 'containers' key.

**Structure:** 

```yaml
<resource name>:
 type: file | oci-image
 description: <description>
 filename: <filename>
```

**Examples:**

```yaml
super-app-image:
 type: oci-image
 description: OCI image for the Super App (hub.docker.com/_/super-app)
```

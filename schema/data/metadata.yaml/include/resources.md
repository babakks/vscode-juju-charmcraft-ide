<a href="#heading--resources"><h2 id="heading--resources">`resources`</h2></a>
> See also: [Resource](/t/5609)


**Purpose:** The `resources` key is where you defines the resources mentioned under the `resource` key of the  [`containers`](#heading--containers)  key.

**Structure:** 

<!--
The `resources` block consists
|     Field     |   Type   | Default | Description                                                       |
| :-----------: | :------: | :-----: | ----------------------------------------------------------------- |
|    `type`     | `string` | `file`  | Type of the resource. Supported values are `file` or `oci-image`. |
| `description` | `string` |  `nil`  | Description of the resource                                       |
|  `filename`   | `string` |  `nil`  | Name of the file resource                                         |

-->

```yaml
# (Optional) Additional resources that accompany the charm
resources:
    # Each key represents the name of a resource 
    # mentioned in the 'resource' subkey of the 'containers' key.
    <resource name>:

        # (Required) The type of the resource
        type: file | oci-image

        # (Optional) Description of the resource and its purpose
        description: <description>

        # (Required: when type:file) The filename of the resource as it should 
        # appear in the filesystem
        filename: <filename>
```

**Examples:**

------
[details=Expand to see an example with an OCI-image resource]
```yaml
resources:
    super-app-image:
        type: oci-image
        description: OCI image for the Super App (hub.docker.com/_/super-app)
```
[/details]
----


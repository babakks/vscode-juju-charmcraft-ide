<a href="#heading--resources"><h2 id="heading--resources">`resources`</h2></a>

> See first: [Juju | Charm resource](https://juju.is/docs/juju/charm-resource)

**Status:** Optional.

**Purpose:**  To define a resource for your charm. Note: Kubernetes charms must declare an `oci-image` resource for each container they define in the `containers` mapping.

**Structure:** 

<!--
The `resources` block consists
|     Field     |   Type   | Default | Description                                                       |
| :-----------: | :------: | :-----: | ----------------------------------------------------------------- |
|    `type`     | `string` | `file`  | Type of the resource. Supported values are `file` or `oci-image`. |
| `description` | `string` |  `nil`  | Description of the resource                                       |
|  `filename`   | `string` |  `nil`  | Name of the file resource                                         |


[note type="information"]
Kubernetes charms must declare an `oci-image` resource for each container they define in the `containers` map.
[/note]

An example resource definition:

```yaml
# ...
resources:
  someresource:
    type: file
    filename: superdb.bin
    description: the DB with needed info
  app-image:
    type: oci-image
    description: OCI image for app
# ...
```
-->

```text
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

An example with a file resource:

```text
resources:
  water:
    type: file
    filename: /dev/h2o
```

An example with an OCI-image resource:

```yaml
resources:
    super-app-image:
        type: oci-image
        description: OCI image for the Super App (hub.docker.com/_/super-app)
```

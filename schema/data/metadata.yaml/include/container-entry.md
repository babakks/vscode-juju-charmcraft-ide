<a href="#heading--container"><h2 id="heading--container">`[container]`</h2></a>

**Status:** Required for Kubernetes charms (except for proxy charms running on Kubernetes).

**Purpose:** Each key define a container.

**Structure:** A container can be specified in terms of `resource`, `bases`, and `mounts`, where one of either the `resource` or the `bases` subkeys must be defined, and `mounts` is optional. `resource` stands for the OCI image resource used to create the container; to use it, specify  an OCI image resource name (that you will then define further in the [`resources`](#heading--resources) block). `bases` is a list of bases to be used for resolving a container image, in descending order of preference; to use it, specify a base name (for example, `ubuntu`, `centos`, `windows`, `osx`, `opensuse`), a [channel](https://snapcraft.io/docs/channels), and an architecture.  And `mounts` is a list of mounted storages for this container; to use it, specify the name of the storage to mount from the charm storage and, optionally, the location where to mount the storage.

```yaml
<container name>:
 resource: <resource name>
 bases:
 - name: <base name>
   channel: <track[/risk][/branch]>
   architectures:
   - <architecture>
 mounts:
 - storage: <storage name>
   location: <path>
```

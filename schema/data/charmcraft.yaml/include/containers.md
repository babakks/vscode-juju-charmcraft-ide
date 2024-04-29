<a href="#heading--containers"><h2 id="heading--containers">`containers`</h2></a>

**Status:** Required for Kubernetes charms (except for proxy charms running on Kubernetes).

**Purpose:** The `containers` key allows you to define a map of containers to be created adjacent to the charm (as a sidecar, in the same pod).

**Structure:** This key consists of a list of containers along with their specification. Each container can be specified in terms of `resource`, `bases`, and `mounts`, where one of either the `resource` or the `bases` subkeys must be defined, and `mounts` is optional. `resource` stands for the OCI image resource used to create the container; to use it, specify  an OCI image resource name (that you will then define further in the [`resources`](#heading--resources) block). `bases` is a list of bases to be used for resolving a container image, in descending order of preference; to use it, specify a base name (for example, `ubuntu`, `centos`, `windows`, `osx`, `opensuse`), a [channel](https://snapcraft.io/docs/channels), and an architecture.  And `mounts` is a list of mounted storages for this container; to use it, specify the name of the storage to mount from the charm storage and, optionally, the location where to mount the storage.

```yaml
containers:
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

**Examples:**

```yaml
containers:
 super-app:
  resource: super-app-image
  mounts:
  - storage: logs
  location: /logs
```

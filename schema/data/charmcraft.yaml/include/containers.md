<a href="#heading--containers"><h2 id="heading--containers">`containers`</h2></a>

**Status:** Required for Kubernetes charms (except for proxy charms running on Kubernetes).

**Purpose:** The `containers` key allows you to define a map of containers to be created adjacent to the charm (as a sidecar, in the same pod).

**Structure:** This key consists of a list of containers along with their specification. Each container can be specified in terms of `resource`, `bases`, `uid`, `gid` and `mounts`, where one of either the `resource` or the `bases` subkeys must be defined, and `mounts` is optional. `resource` stands for the OCI image resource used to create the container; to use it, specify  an OCI image resource name (that you will then define further in the `resources` block). `bases` is a list of bases to be used for resolving a container image, in descending order of preference; to use it, specify a base name (for example, `ubuntu`, `centos`, `windows`, `osx`, `opensuse`), a [channel](https://snapcraft.io/docs/channels), and an architecture. `mounts` is a list of mounted storages for this container; to use it, specify the name of the storage to mount from the charm storage and, optionally, the location where to mount the storage. And, starting with Juju 3.5.0, `uid` and `gid` are the UID and, respectively, GID to run the Pebble entry process for this container as; they can be any value from 0-999 or any value from 10,000 (values from 1000-9999 are reserved for users) and the default is 0 (root).

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
    uid: <unix UID>
    gid: <unix GID>
```

<!--
```yaml
# (Optional) A map of containers to be created adjacent to the charm. This field
# is required when the charm is targeting Kubernetes, where each of the specified
# containers will be created as sidecars to the charm in the same pod.
# Exception: Proxy charms running on Kubernetes.
containers:
    # Each key represents the name of a container.
    <container name>:
        # Note: One of either ''resource' or 'bases' must be specified.
        # If you choose 'resource', make sure to define it under the top-level 'resources' key.

        # (Optional) Reference for an entry in the resources field. Specifies
        # the oci-image resource used to create the container. Must not be
        # present if a base/channel is specified.
        resource: <resource name>

        # (Optional) A list of bases in descending order of preference for use
        # in resolving a container image. Must not be present if resource is
        # specified. These bases are listed as base (instead of name) and
        # channel as in the Base definition, as an unnamed top-level object list
        bases:
            # Name of the OS. For example ubuntu/centos/windows/osx/opensuse
            - name: <base name>

              # Channel of the OS in format "track[/risk][/branch]" such as used by
              # Snaps. For example 20.04/stable or 18.04/stable/fips
              channel: <track[/risk][/branch]>

              # List of architectures that this particular charm can run on
              architectures:
                  - <architecture>

        # (Optional) List of mounted storages for this container
        mounts:
            # (Required) Name of the storage to mount from the charm storage
            - storage: <storage name>

              # (Optional) In the case of filesystem storages, the location to
              # mount the storage. For multi-stores, the location acts as the
              # parent directory for each mounted store.
              location: <path>

        # (Optional) UID to run the pebble entry process for this container as.
        # Can be any value from 0-999 or any value from 10,000 (values from 1000-9999 are reserved for users).
        # Default is 0 (root). Added in Juju 3.5.0.
        uid: <unix UID>

        # (Optional) GID to run the pebble entry process for this container as.
        # Can be any value from 0-999 or any value from 10,000 (values from 1000-9999 are reserved for user's primary groups).
        # Default is 0 (root). Added in Juju 3.5.0.
        gid: <unix GID>
```
-->

**Examples:**

An example with `resource` and `mounts`:

```yaml
containers:
    super-app:
        resource: super-app-image
        mounts:
            - storage: logs
              location: /logs
```

<!--The last version of this doc to show all the keys at once, in a long spec with comments, was version 22.-->


> <small> [List of files in the charm project](/t/4454) > `metadata.yaml`</small>

This document describes the `metadata.yaml` file in your charm project.

The `metadata.yaml` file is the only file that must be present in the root directory of a charm. (Although, if you're using [Charmcraft](/t/5528), as we recommend, then you'll also need the [`charmcraft.yaml`](/t/7132) file.)

This file contains identifying and configuration information about the charm. Identifying information is used to describe the charm, its author, and its purpose; it is indexed by [Charmhub](https://charmhub.io/) to enable easy discovery of charms. Configuration information is provided by the charm author to inform [the Juju OLM](https://juju.is/docs/olm) how and where to deploy the charm depending on the intended platform, storage requirements, resources, and possible integrations. 

The file is a YAML dictionary and consists of a number of keys and their values. There are 3 keys that are required for all charms: [`name`](#heading--name), [`summary`](#heading--summary), and [`description`](#heading--description). Then, also keys that are required only for Kubernetes charms, e.g., [`containers`](#heading--containers). Additionally, 15+ optional keys. Finally, any number of arbitrary keys; these can serve to keep track of other choices a charmer might make. 


------------------
[details=Expand to see a minimal valid `metadata.yaml`]

```yaml
name: mongodb
summary: A document database
description: A database that stores JSON-like data. 
```
[/details]

-----------------------------
[details=Expand to see an example `metadata.yaml` file for a Kubernetes charm]

```yaml
name: super-k8s
summary: a really great charm
description: |
    This is a really great charm, whose metadata is suitably complete so as to
    demonstrate as many of the fields as possible.
maintainers:
    - Joe Bloggs <joe.bloggs@email.com>
docs: https://discourse.charmhub.io/t/9999

# The following three fields can be a single string, or a list of strings.
source: https://github.com/foo/super-k8s-operator
issues: https://github.com/foo/super-k8s-operator/issues/
website:
    - https://charmed-super.io/k8s
    - https://super-app.io

containers:
    super-app:
        resource: super-app-image
        mounts:
            - storage: logs
              location: /logs
    
    super-app-helper:
        bases:
            - name: ubuntu
              channel: ubuntu/20.04
              architectures:
                  - amd64
                  - arm64

resources:
    super-app-image:
        type: oci-image
        description: OCI image for the Super App (hub.docker.com/_/super-app)
    
    definitions:
        type: file
        description: A small SQLite3 database of definitions needed by super app
        filename: definitions.db

provides:
    super-worker:
        interface: super-worker

requires:
    ingress:
        interface: ingress
        optional: true
        limit: 1

peers:
    super-replicas:
        interface: super-replicas

storage:
    logs:
        type: filesystem
        location: /logs
        description: Storage mount for application logs
        shared: true

assumes:
    - juju >= 2.9.23 
    - k8s-api

```
[/details]
----------------------------


The rest of this document describes all these keys. Click on a key below or scroll down to find out more.

------------------
[details=Alternatively, expand to see the full spec at once]

```yaml
# (Required) The name of the charm. Determines URL in Charmhub and the name administrators
# will ultimately use to deploy the charm. E.g. `juju deploy <name>`
name: <name>

# (Required) A short, one-line description of the charm
summary: <summary>

# (Required) A full description of the configuration layer
description: |
    <description>

# (Optional) A list of maintainers in the format "First Last <email>"
maintainers:
    - <maintainer>

# (Optional) A string (or a list of strings) containing a link (or links) to project websites.
# In general this is likely to be the upstream project website, or the formal website for the
# charmed offering.
website: <url> | [<urls>]

# (Optional) A string (or a list of strings) containing a link (or links) to the charm source code.
source: <url> | [<urls>]

# (Optional) A string (or a list of strings) containing a link (or links) to the charm bug tracker.
issues: <url> | [<urls>]

# (Optional) A link to a documentation cover page on Discourse
# More details at https://juju.is/docs/sdk/add-docs-to-your-charmhub-page
docs: <url>

# (Optional) A list of terms that any charm user must agree with
terms:
    - <term>

# (Optional) True if the charm is meant to be deployed as a subordinate to a 
# principal charm
subordinate: true | false

# (Optional) A map of containers to be created adjacent to the charm. This field
# is required when the charm is targeting Kubernetes, where each of the specified
# containers will be created as sidecars to the charm in the same pod.
containers:
    # Each key represents the name of the container
    <container name>:
        # Note: One of either resource or bases must be specified.
        
        # (Optional) Reference for an entry in the resources field. Specifies 
        # the oci-image resource used to create the container. Must not be 
        # present if a base/channel is specified
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
    
# (Optional) Additional resources that accompany the charm
resources:
    # Each key represents the name of the resource
    <resource name>:

        # (Required) The type of the resource
        type: file | oci-image

        # (Optional) Description of the resource and its purpose
        description: <description>

        # (Required: when type:file) The filename of the resource as it should 
        # appear in the filesystem
        filename: <filename>

# (Optional) Map of relations provided by this charm
provides:
    # Each key represents the name of the relation as known by this charm
    <relation name>:

        # (Required) The interface schema that this relation conforms to
        interface: <interface name>

        # (Optional) Maximum number of supported connections to this relation
        # endpoint. This field is an integer
        limit: <n>

        # (Optional) Defines if the relation is required. Informational only.
        optional: true | false

        # (Optional) The scope of the relation. Defaults to "global"
        scope: global | container

# (Optional) Map of relations required by this charm
requires:
    # Each key represents the name of the relation as known by this charm
    <relation name>:

        # (Required) The interface schema that this relation conforms to
        interface: <interface name>

        # (Optional) Maximum number of supported connections to this relation
        # endpoint. This field is an integer
        limit: <n>

        # (Optional) Defines if the relation is required. Informational only.
        optional: true | false

        # (Optional) The scope of the relation. Defaults to "global"
        scope: global | container

# (Optional) Mutual relations between units/peers of this charm
peer:
    # Each key represents the name of the relation as known by this charm
    <relation name>:

        # (Required) The interface schema that this relation conforms to
        interface: <interface name>

        # (Optional) Maximum number of supported connections to this relation
        # endpoint. This field is an integer
        limit: <n>

        # (Optional) Defines if the relation is required. Informational only.
        optional: true | false

        # (Optional) The scope of the relation. Defaults to "global"
        scope: global | container

# (Optional) Storage requests for the charm
storage:
  # Each key represents the name of the storage
  <storage name>:

      # (Required) Type of the requested storage
      type: filesystem | block

      # (Optional) Description of the storage requested
      description: <description>

      # (Optional) The mount location for filesystem stores. For multi-stores
      # the location acts as the parent directory for each mounted store.
      location: <location>

      # (Optional) Indicates if all units of the application share the storage
      shared: true | false

      # (Optional) Indicates if the storage should be made read-only (where possible)
      read-only: true | false

      # (Optional) The number of storage instances to be requested
      multiple: <n> | <n>-<m> | <n>- | <n>+

      # (Optional) Minimum size of requested storage in forms G, GiB, GB. Size 
      # multipliers are M, G, T, P, E, Z or Y. With no multiplier supplied, M 
      # is implied.
      minimum-size: <n>| <n><multiplier>

      # (Optional) List of properties, only supported value is "transient"
      properties:
          - transient

# (Optional) Device requests for the charm, for example a GPU
devices:
    # Each key represents the name of the device
    <device name>:

        # (Required) The type of device requested
        type: gpu | nvidia.com/gpu | amd.com/gpu

        # (Optional) Description of the requested device
        description: <description>

        # (Optional) Minimum number of devices required
        countmin: <n>

        # (Optional) Maximum number of devices required
        countmax: <n>

# (Optional) Extra bindings for the charm. For example binding extra network
# interfaces. Key only map, value must be blank. Key represents the name
extra-bindings:
    # Key only map; key represents the name of the binding
    <binding name>:

# (Optional) A set of features that must be provided by the Juju model to ensure that the charm can be successfully deployed. 
# See https://juju.is/docs/olm/supported-features for the full list.
assumes:
    - <feature_name>
    - any-of:
        - <feature_name>
        - <feature_name>
    - all-of:
        - <feature_name>
        - <feature_name>
```

[/details]
----------------------------


**Contents:**

- [`assumes`](#heading--assumes)
- [`containers`](#heading--containers)
- [`description`](#heading--description)
- [`devices`](#heading--devices)
- [`display-name`](#heading--display-name) 
- [`docs`](#heading--docs)
- [`extra-bindings`](#heading--extra-bindings)
- [`issues`](#heading--issues)
- [`maintainers`](#heading--maintainers)
- [`name`](#heading--name)
- [`peer`](#heading--peer)
- [`provides`](#heading--provides)
- [`requires`](#heading--requires)
- [`resources`](#heading--resources)
- [`source`](#heading--source)
- [`storage`](#heading--storage)
- [`subordinate`](#heading--subordinate)
- [`summary`](#heading--summary)
- [`terms`](#heading--terms)
- [`website`](#heading--website)
- [`<other arbitrary keywords>`](#heading--other-arbitrary-keywords)


<a href="#heading--assumes"><h2 id="heading--assumes">`assumes`</h2></a>

<!--Based on https://discourse.charmhub.io/t/assumes/5450#heading--feature-names-and-version-constraints -->

**Status:** Optional. Recommended for Kubernetes charms.

**Purpose:** The `assumes` key  allows charm authors to explicitly state in the metadata of a charm various features that a Juju model must be able to provide to ensure that the charm can be successfully deployed on it. When a charm comes preloaded with such requirements, this enables Juju to perform a pre-deployment check and to display user-friendly error messages if a feature requirement cannot be met by the model that the user is trying to deploy the charm to. If the assumes section of the charm metadata is omitted, Juju will make a best-effort attempt to deploy the charm, and users must rely on the output of `juju status` to figure out whether the deployment was successful. The `assumes` key is available since 2.9.23.

**Structure:** The key consists of a list of features that can be given either directly or, depending on the complexity of the condition you want to enforce, nested under one or both of the boolean expressions `any-of` or `all-of`, as shown below. In order for a charm to be deployed, all entries in the `assumes` block must be satisfied.

```yaml
assumes:
    - <feature_name>
    - any-of:
        - <feature_name>
        - <feature_name>
    - all-of:
        - <feature_name>
        - <feature_name>
```

 The supported feature names are as below:

|||
| --- | --- | --- |
|`juju <comparison predicate> <version number>` <br><br> E.g., `juju < 3.0`. <br> E.g., `juju >= 2.9` |  The charm deploys iff the model runs agent binaries with the specified Juju version(s). |Since 2.9.23|
|`k8s-api` | The charm deploys iff the underlying substrate for the model is Kubernetes. |Since 2.9.23|

The Boolean expressions are defined as below:

|||
|-|-|
|`any-of`| The sub-expression is satisfied if any of the provided child expressions is satisfied.|
|`all-of` |   The sub-expression is satisfied if all of the provided child expressions are satisfied.|

**Examples:**

----
[details=Expand to see a simple example]

```yaml
assumes:
    - juju >= 2.9.23
    - k8s-api
```
[/details]

-------------

[details=Expand to see an example with a nested expression]
```yaml
assumes:
    - any_of:
        - juju >= 2.9
        - k8s-api
```
[/details]

---------


<a href="#heading--containers"><h2 id="heading--containers">`containers`</h2></a>
> See also: [`resources`](#heading--resources)

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
```
-->

**Examples:**

[details=Expand to see an example with `resource` and `mounts`]
```yaml
containers:
    super-app:
        resource: super-app-image
        mounts:
            - storage: logs
              location: /logs
```
[/details]


<a href="#heading--description"><h2 id="heading--description">`description`</h2></a>

**Status:** Required.

**Purpose:** The `description` key is where you provide a full description of the configuration layer.

**Structure:**

```yaml
description: |
  <description>
```

<!--
```yaml
# (Required) A full description of the configuration layer
description: |
    <description>
```
-->

<a href="#heading--devices"><h2 id="heading--devices">`devices`</h2></a>

```yaml

# (Optional) Device requests for the charm, for example a GPU
devices:
    # Each key represents the name of the device
    <device name>:

        # (Required) The type of device requested
        type: gpu | nvidia.com/gpu | amd.com/gpu

        # (Optional) Description of the requested device
        description: <description>

        # (Optional) Minimum number of devices required
        countmin: <n>

        # (Optional) Maximum number of devices required
        countmax: <n>

```

<a href="#heading--display-name"><h2 id="heading--display-name">`display-name`</h2></a>

```yaml
display-name: |
  <display name>
```

<a href="#heading--docs"><h2 id="heading--docs">`docs`</h2></a>
> See also: [How to create an effective README file for your charm](/t/4463)

```yaml
# (Optional) A link to a documentation cover page on Discourse:
docs: <url>
```

<a href="#heading--extra-bindings"><h2 id="heading--extra-bindings">`extra-bindings`</h2></a>

```yaml
# (Optional) Extra bindings for the charm. For example binding extra network
# interfaces. Key only map, value must be blank. Key represents the name.
extra-bindings:
    # Key only map; key represents the name of the binding
    <binding name>:
```

<a href="#heading--issues"><h2 id="heading--issues">`issues`</h2></a>

```yaml
# (Optional) A string (or a list of strings) containing a link (or links) to the charm bug tracker.
issues: <url> | [<urls>]
```
<a href="#heading--maintainers"><h2 id="heading--maintainers">`maintainers`</h2></a>

```yaml
# (Optional) A list of maintainers in the format "First Last <email>"
maintainers:
    - <maintainer>
```

<a href="#heading--name"><h2 id="heading--name">`name`</h2></a>

```yaml
# (Required) The name of the charm. Determines URL in Charmhub and the name administrators
# will ultimately use to deploy the charm. E.g. `juju deploy <name>`
name: <name>
```

<a href="#heading--peer"><h2 id="heading--peer">`peer`</h2></a>

```yaml
# (Optional) Mutual relations between units/peers of this charm
peer:
    # Each key represents the name of the relation as known by this charm
    <relation name>:

        # (Required) The interface schema that this relation conforms to
        interface: <interface name>

        # (Optional) Maximum number of supported connections to this relation
        # endpoint. This field is an integer
        limit: <n>

        # (Optional) Defines if the relation is required. Informational only.
        optional: true | false

        # (Optional) The scope of the relation. Defaults to "global"
        scope: global | container
```

<a href="#heading--provides"><h2 id="heading--provides">`provides`</h2></a>

```yaml
# (Optional) Map of relations provided by this charm
provides:
    # Each key represents the name of the relation as known by this charm
    <relation name>:

        # (Required) The interface schema that this relation conforms to
        interface: <interface name>

        # (Optional) Maximum number of supported connections to this relation
        # endpoint. This field is an integer
        limit: <n>

        # (Optional) Defines if the relation is required. Informational only.
        optional: true | false

        # (Optional) The scope of the relation. Defaults to "global"
        scope: global | container
```

<a href="#heading--requires"><h2 id="heading--requires">`requires`</h2></a>

```yaml
# (Optional) Map of relations required by this charm
requires:
    # Each key represents the name of the relation as known by this charm
    <relation name>:

        # (Required) The interface schema that this relation conforms to
        interface: <interface name>

        # (Optional) Maximum number of supported connections to this relation
        # endpoint. This field is an integer
        limit: <n>

        # (Optional) Defines if the relation is required. Informational only.
        optional: true | false

        # (Optional) The scope of the relation. Defaults to "global"
        scope: global | container

```

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

<a href="#heading--source"><h2 id="heading--source">`source`</h2></a>

```yaml
# (Optional) A string (or a list of strings) containing a link (or links) to the charm source code.
source: <url> | [<urls>]
```

<a href="#heading--storage"><h2 id="heading--storage">`storage`</h2></a>

```yaml
# (Optional) Storage requests for the charm
storage:
  # Each key represents the name of the storage
  <storage name>:

      # (Required) Type of the requested storage
      type: filesystem | block

      # (Optional) Description of the storage requested
      description: <description>

      # (Optional) The mount location for filesystem stores. For multi-stores
      # the location acts as the parent directory for each mounted store.
      location: <location>

      # (Optional) Indicates if all units of the application share the storage
      shared: true | false

      # (Optional) Indicates if the storage should be made read-only (where possible)
      read-only: true | false

      # (Optional) The number of storage instances to be requested
      multiple: <n> | <n>-<m> | <n>- | <n>+

      # (Optional) Minimum size of requested storage in forms G, GiB, GB. Size 
      # multipliers are M, G, T, P, E, Z or Y. With no multiplier supplied, M 
      # is implied.
      minimum-size: <n>| <n><multiplier>

      # (Optional) List of properties, only supported value is "transient"
      properties:
          - transient
```


<a href="#heading--subordinate"><h2 id="heading--subordinate">`subordinate`</h2></a>

```yaml
# (Optional) True if the charm is meant to be deployed as a subordinate to a 
# principal charm
subordinate: true | false
```

<a href="#heading--summary"><h2 id="heading--summary">`summary`</h2></a>

```yaml
# (Required) A short, one-line description of the charm
summary: <summary>
```

<a href="#heading--terms"><h2 id="heading--terms">`terms`</h2></a>

```yaml
# (Optional) A list of terms that any charm user must agree with
terms:
    - <term>
```

<a href="#heading--website"><h2 id="heading--website">`website`</h2></a>

```yaml
# (Optional) A string (or a list of strings) containing a link (or links) to project websites.
# In general this is likely to be the upstream project website, or the formal website for the
# charmed offering.
website: <url> | [<urls>]
```

<a href="#heading--other-arbitrary-keywords"><h2 id="heading--other-arbitrary-keywords">`<other arbitrary keywords>`</h2></a>

In addition to the official fields and keywords mentioned above, a `metadata.yaml` file may also contain other arbitrary keywords. These can serve to keep track of other choices a charmer might make. In some cases these become semi-official, being adopted by many charmers and even incorporated into CI processes. An example is [`upstream-source`](https://github.com/canonical/charmcraft/blob/b22fcdba3b894004468abfbf45caa54d93fbf7d0/charmcraft/templates/init-simple/metadata.yaml.j2#L40-L43).
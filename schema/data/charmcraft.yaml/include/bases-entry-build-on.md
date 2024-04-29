***`build-on`***

**Status:** Required.

**Purpose:** Specifies a list of environments (OS version and architecture) where the charm must be built on. 

When packing in "destructive mode", the base(s) that match(es) the current environment will be used, otherwise an instance will be requested to LXD or Multipass for each specified base to pack in that environment.


**Structure:** This key supports a list of bases where the charm can be built.

```yaml
build-on:
- name: <name>
  channel: <channel>
  architectures:
    - <arch>
```

The list of architecture strings is optional, defaulting to the machine architecture.

Be sure to check [this detailed documentation](https://discourse.charmhub.io/t/charmcraft-bases-provider-support/4713) for more information and the different possibilities of these structures, including several examples.

See more:
- https://juju.is/docs/sdk/charmcraft-yaml#heading--bases

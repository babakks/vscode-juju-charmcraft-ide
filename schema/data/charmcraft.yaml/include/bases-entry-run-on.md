***`run-on`***

**Status:** Optional, defaults to what's specified in the corresponding `build-on`.

**Purpose:** Specifies a list of environments (OS version and architecture) where the charm must be run on. 


**Structure:** This key supports a list of bases where the build charm can be run on.

```yaml
run-on:
  - name: <name>
    channel: <channel>
    architectures:
      - <arch>
```

If `run-on` is not specified, it defaults to what's specified in the corresponding `build-on`. The list of architecture strings is optional, defaulting to the machine architecture.

Be sure to check [this detailed documentation](https://discourse.charmhub.io/t/charmcraft-bases-provider-support/4713) for more information and the different possibilities of these structures, including several examples.

See more:
- https://juju.is/docs/sdk/charmcraft-yaml#heading--bases

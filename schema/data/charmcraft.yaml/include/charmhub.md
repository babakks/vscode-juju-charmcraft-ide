***`charmhub`***

**Status:** Optional.

**Purpose:** Configures Charmcraft's interaction with store servers.

**Structure:** This key allows for the configuration of two values---the base URL for the Charmhub API and the base URL to push binaries to Charmhub. These keys are also optional.

```yaml
charmhub:
  api-url: <api url>
  storage-url: <storage url>
  registry-url: <registry url>
```

The key is used mostly in the context of "private" charm stores, defaulting to the standard Canonical services to operate with charms.

**Example:**

```yaml
charmhub:
  api-url: https://api.staging.charmhub.io
  storage-url: https://storage.staging.snapcraftcontent.com
```

See more:
- https://juju.is/docs/sdk/charmcraft-yaml#heading--charmhub

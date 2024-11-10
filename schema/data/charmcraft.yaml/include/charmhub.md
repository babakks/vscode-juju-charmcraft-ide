<a href="#heading--charmhub"><h2 id="heading--charmhub">`charmhub`</h2></a>


> **Warning:** In Charmcraft 3.0 and up, these keys will no longer be valid in `charmcraft.yaml`. Use the environment variables `CHARMCRAFT_STORE_API_URL`, `CHARMCRAFT_UPLOAD_URL` and `CHARMCRAFT_REGISTRY_URL` instead.

**Status:** Optional.

**Purpose:** Configures Charmcraft's interaction with store servers. 

**Structure:** This key allows for the configuration of two values---the base URL for the Charmhub API and the base URL to push binaries to Charmhub. These keys are also optional.

```
charmhub:
  api-url: <api url>
  storage-url: <storage url>
  registry-url: <registry url>
```

The key is used mostly in the context of "private" charm stores, defaulting to the standard Canonical services to operate with charms.

**Example:**

```text
charmhub:
  api-url: https://api.staging.charmhub.io
  storage-url: https://storage.staging.snapcraftcontent.com
```

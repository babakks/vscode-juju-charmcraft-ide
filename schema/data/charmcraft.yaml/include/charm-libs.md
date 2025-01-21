<a href="#heading--charm-libs"><h2 id="heading--charm-libs">`charm-libs`</h2></a>

**Status:** Optional.

**Purpose:** Declares charm libraries for Charmcraft to include in the charm project. For each lib, make sure to  include both the lib name (in `<charm>.<library>` format) and the lib version (in `"<api version>[.<patch version>]"` format). For example:

```yaml
charm-libs:
    # Fetch postgres_client lib with API version 1 and latest patch:
    - lib: postgresql.postgres_client
      version: "1"

    # Fetch mysql lib with API version 0 and patch version 5:
    - lib: mysql.mysql
      version: "0.5"
```

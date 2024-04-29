<a href="#heading--storage"><h2 id="heading--storage">`[storage]`</h2></a>

**Status:** Optional.

**Purpose:** Each key represents the name of the storage.

**Structure:**

```yaml
<storage name>:
 type: filesystem | block
 description: <description>
 location: <location>
 shared: true | false
 read-only: true | false
 multiple: <n> | <n>-<m> | <n>- | <n>+
 minimum-size: <n>| <n><multiplier>
 properties:
 - transient
```

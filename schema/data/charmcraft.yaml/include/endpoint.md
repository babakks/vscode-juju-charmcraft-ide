<a href="#heading--endpoint"><h2 id="heading--endpoint">`[endpoint]`</h2></a>

**Status:** Optional.

**Purpose:** Each key represents the name of the relation as known by this charm.

**Structure:**

```yaml
<relation name>:
 interface: <interface name>
 limit: <n>
 optional: true | false
 scope: global | container
```

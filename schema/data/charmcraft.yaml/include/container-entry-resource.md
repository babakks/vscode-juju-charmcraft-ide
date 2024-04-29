<a href="#heading--container.resource"><h2 id="heading--container.resource">`[container].resource`</h2></a>

**Status:** Required if `bases` is not assigned.

**Purpose:** Reference for an entry in the resources field. Specifies 
the oci-image resource used to create the container. Must not be 
present if a base/channel is specified.

**Structure:** 

```yaml
resource: <resource name>
```

<a href="#heading--container.bases"><h2 id="heading--container.bases">`[container].bases`</h2></a>

**Status:** Required if `resource` is not assigned.

**Purpose:** A list of bases in descending order of preference for use 
in resolving a container image. Must not be present if resource is 
specified. These bases are listed as base (instead of name) and 
channel as in the Base definition, as an unnamed top-level object list
bases.

**Structure:** 

```yaml
bases:
- name: <base name>
  channel: <track[/risk][/branch]>
  architectures: 
  - <architecture>
```

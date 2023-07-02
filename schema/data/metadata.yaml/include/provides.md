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


<a href="#heading--peer"><h2 id="heading--peer">`peer`</h2></a>

```yaml
# (Optional) Mutual relations between units/peers of this charm
peer:
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


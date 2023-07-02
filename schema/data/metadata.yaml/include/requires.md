<a href="#heading--requires"><h2 id="heading--requires">`requires`</h2></a>

```yaml
# (Optional) Map of relations required by this charm
requires:
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


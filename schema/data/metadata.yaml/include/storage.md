<a href="#heading--storage"><h2 id="heading--storage">`storage`</h2></a>

```yaml
# (Optional) Storage requests for the charm
storage:
  # Each key represents the name of the storage
  <storage name>:

      # (Required) Type of the requested storage
      type: filesystem | block

      # (Optional) Description of the storage requested
      description: <description>

      # (Optional) The mount location for filesystem stores. For multi-stores
      # the location acts as the parent directory for each mounted store.
      location: <location>

      # (Optional) Indicates if all units of the application share the storage
      shared: true | false

      # (Optional) Indicates if the storage should be made read-only (where possible)
      read-only: true | false

      # (Optional) The number of storage instances to be requested
      multiple: <n> | <n>-<m> | <n>- | <n>+

      # (Optional) Minimum size of requested storage in forms G, GiB, GB. Size 
      # multipliers are M, G, T, P, E, Z or Y. With no multiplier supplied, M 
      # is implied.
      minimum-size: <n>| <n><multiplier>

      # (Optional) List of properties, only supported value is "transient"
      properties:
          - transient
```



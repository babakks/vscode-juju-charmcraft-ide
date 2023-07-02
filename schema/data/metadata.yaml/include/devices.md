<a href="#heading--devices"><h2 id="heading--devices">`devices`</h2></a>

```yaml

# (Optional) Device requests for the charm, for example a GPU
devices:
    # Each key represents the name of the device
    <device name>:

        # (Required) The type of device requested
        type: gpu | nvidia.com/gpu | amd.com/gpu

        # (Optional) Description of the requested device
        description: <description>

        # (Optional) Minimum number of devices required
        countmin: <n>

        # (Optional) Maximum number of devices required
        countmax: <n>

```


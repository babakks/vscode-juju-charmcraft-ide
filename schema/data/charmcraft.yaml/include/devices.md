<a href="#heading--devices"><h2 id="heading--devices">`devices`</h2></a>

**Status:** Optional

**Purpose:** Defines the device requests for the charm, for example a GPU.

**Structure:**

```text
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

**Example:**

```text
devices:
  super-cool-gpu:
    type: amd.com/gpu
    description: Some sweet AMD GPU
    countmin: 69
    countmax: 420
  lame-gpu:
    type: nvidia.com/gpu
    description: A GPU I regret buying
    countmin: 0
    countmax: 1
```

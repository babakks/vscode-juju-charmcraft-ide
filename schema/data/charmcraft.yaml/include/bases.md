<a href="#heading--bases"><h2 id="heading--bases">`bases`</h2></a>

> ***Warning:** Changes starting with Charmcraft 3*
>
> `bases` is replaced by `base` , `build-base`, and `platforms`.
>
> ```text
> # The run time base, the base format is <os-name>@<os-release>,
> # accepted bases are:
> # - ubuntu@24.04
> base: <base>
> # The build time base, if not defined the base is also the build time
> # base, in addition to valid bases, the build-base can be "devel"
> # which would use the latest in development Ubuntu Series.
> build-base: <base>
>
> platforms:
>     # The supported platforms, may omit build-for if platform-name
>     # is a valid arch, valid architectures follow the Debian architecture names,
>     # accepted architectures are:
>     # - amd64
>     # - arm64
>     # - armhf
>     # - ppc64el
>     # - riscv64
>     # - s390x
>     <platform-name>:
>         # The build time architecture
>         build-on: <list-of-arch> | <arch>
>         # The run time architecture
>         build-for: <list-of-arch> | <arch>
>
> ```

**Status:** If the [`type`](#heading--type) key is set to `charm`, required. (If the `type` key is set to `bundle`, leads to an error.)

**Purpose:** Specifies a list of environments (OS version and architecture) where the charm must be built on and run on. 

When packing in "destructive mode", the base(s) that match(es) the current environment will be used, otherwise an instance will be requested to LXD or Multipass for each specified base to pack in that environment.


**Structure:** This key supports a list of bases where the charm can be built, and where that build can run. Each item can be expressed using two different internal structures, a short and a long form. The long one is more explicit:

```
bases:
  - build-on:
      - name: <name>
        channel: <channel>
        architectures:
          - <arch>
    run-on:
      - name: <name>
        channel: <channel>
        architectures:
          - <arch>
```

The `run-on` part of each `build-on` is optional, and defaults to what's specified in the corresponding 'build-on'. And in both structures the list of architecture strings is also optional, defaulting to the machine architecture.

The short form is more concise and simple (at the cost of being less flexible):

```
bases:
  - name: <name>
    channel: <channel>
    architectures:
      - <arch>
```

It implies that the specified base is to be used for both `build-on` and `run-on`. And as above, the list of architecture strings is also optional, defaulting to the machine architecture.

Be sure to check [this detailed documentation](https://discourse.charmhub.io/t/charmcraft-bases-provider-support/4713) for more information and the different possibilities of these structures, including several examples.


**Example:**

```text
bases:
- build-on:
  - name: ubuntu
    channel: '22.04'
    architectures:
    - amd64
    - riscv64
  - name: ubuntu
    channel: '20.04'
    architectures:
    - amd64
    - arm64
  run-on:
  - name: ubuntu
    channel: '22.04'
    architectures:
    - amd64
  - name: ubuntu
    channel: '22.04'
    architectures:
    - riscv64
  - name: ubuntu
    channel: '22.04'
    architectures:
    - arm64
- build-on:
  - name: ubuntu
    channel: '24.04'
  run-on:
  - name: ubuntu
    channel: '24.04'
    architectures:
    - amd64
    - arm64
    - riscv64
    - s390x
    - ppc64el
    - armhf
```

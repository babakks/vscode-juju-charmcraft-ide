<a href="#heading--platforms"><h2 id="heading--platforms">`platforms`</h2></a>

*(Starting with Charmcraft 3)*

The supported platforms, may omit build-for if platform-name
is a valid arch, valid architectures follow the Debian architecture names,
accepted architectures are:

- amd64
- arm64
- armhf
- ppc64el
- riscv64
- s390x<>

```text
platforms:
    <platform-name>:
        # The build time architecture
        build-on: <list-of-arch> | <arch>
        # The run time architecture
        build-for: <list-of-arch> | <arch>
```

Platforms can be defined in a shorthand notation:

```
platforms:
  ubuntu@22.04:amd64:
  ubuntu@24.04:amd64:
```

Or they can be defined in standard form:

```
platforms:
  jammy:
    build-on: [ubuntu@22.04:amd64]
    build-for: [ubuntu@22.04:amd64]
  noble:
    build-on: [ubuntu@24.04:amd64]
    build-for: [ubuntu@24.04:amd64]
```

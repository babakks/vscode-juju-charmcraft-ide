<a href="#heading--parts"><h2 id="heading--parts">`parts`</h2></a>

**Status:** Optional. Only used by the `pack` command.

**Purpose:** Configures the various mechanisms to obtain, process and prepare data from different sources that end up being a part of the final charm. It's optional, and only used by the `pack` command. 

**Value:** Map. Keys are user-defined part names. The value of each key is a map where keys are part properties.  Regarding the `plugin` property: In addition to the standard set, Charmcraft provides 3 further plugins: `charm`, `bundle`, `reactive`. 

> See more: [Craft Parts | Part properties](https://canonical-craft-parts.readthedocs-hosted.com/en/latest/common/craft-parts/reference/part_properties.html)

**Example:**

```text
parts:
  libs:
    plugin: dump
    source: /usr/local/lib/
    organize:
      "libxxx.so*": lib/
    prime:
      - lib/
```

**Details:**

<!--The `parts` key configures the different mechanisms to obtain, process and prepare data from different sources that end up being a part of the final charm; it's optional, and only used by the `pack` command.-->

A part is a declarative representation on how to add a source or component to the charm. It specifies the mechanisms to obtain, process and prepare individual subsets of the final artefact (each "part" of the "whole").

Parts have logic encoded in plugins: a plugin is what has the knowledge into how to transform a given source declared in a part into a usable artefact for a charm.

The `parts` key is optional. If not included, it will default to a `charm` or `bundle` part (depending on the project type), which will use a `charm` or `bundle` plugin correspondingly.

Those two plugins and the `reactive` one, all detailed below, are provided by Charmcraft itself and can be used by other custom parts.

Other plugins are provided by the Craft Parts library (which is a Charmcraft dependency), check this [supported plugins](https://snapcraft.io/docs/supported-plugins) page. Furthermore, other plugins can be written if needed, refer to this [writing local plugins](https://snapcraft.io/docs/writing-local-plugins) documentation.

Beyond plugins, Charmcraft gives the possibility of using the full power of the parts lifecycle, allowing to add parts, and also to override and customise steps of a part’s lifecycle (`pull`, `build`, `stage`, and `prime`) using shell scripts directly sourced from `charmcraft.yaml`, both for custom written parts and the ones included by Charmcraft. Please refer to the [Parts Lifecycle](https://snapcraft.io/docs/parts-lifecycle) documentation to learn more about this.



<a href="#heading--the-charm-plugin"><h3 id="heading--the-charm-plugin">The `charm` plugin</h3></a>

Used to pack a Charm that is based on the [Operator Framework](https://ops.readthedocs.io/en/latest/).

Supports the following configuration:

```text
parts:
  my-charm:
    plugin: charm
    charm-entrypoint: <path to an entrypoint script>
    charm-requirements: <list of requirements files>
    charm-python-packages: <list of package names>
    charm-binary-python-packages: <list of package names>
    prime: <list of paths to extra files>
```

In detail:

- `charm-entrypoint`: The charm entry point, relative to the project directory. It is optional (new in charmcraft 1.2), if not defined defaults to `src/charm.py`.

- `charm-requirements`: A list of requirements files specifying Python dependencies. It is optional (new in charmcraft 1.2); if not defined, defaults to a list with one `requirements.txt` entry if that file is present in the project directory.

- `charm-python-packages`: A list of Python packages to install before installing requirements. These packages will be installed from sources and built locally at packing time. It is optional (new in charmcraft 1.4), defaults to empty.

- `charm-binary-python-packages`: A list of python packages to install before installing requirements and regular Python packages. Binary packages are allowed, but they may also be installed from sources if a package is only available in source form. It is optional (new in charmcraft 1.4), defaults to empty.

- `prime`: List of extra file and directory paths to include in the charm. Note that `bundle.yaml`, the entry point file and hooks are included automatically when packing a charm. Additionally, `config.yaml`, `metrics.yaml`, `actions.yaml`, `lxd-profile.yaml`, `templates`, `version`, `lib` and `mod` will be included if they exist in the project directory. It is optional.


<a href="#heading--the-bundle-plugin"><h3 id="heading--the-bundle-plugin">The `bundle` plugin</h3></a>

Used to pack a [charm bundle](https://juju.is/docs/olm/bundles), a collection of charms which have been carefully combined and configured in order to automate a multi-charm solution.

Supports the following configuration:

```text
parts:
  my-bundle:
    prime: <list of paths to extra files>
    plugin: bundle
```

In detail:

- `prime`: List of extra file and directory paths to include in the bundle. Note that `bundle.yaml` and `README.md` are included automatically when packing a bundle. Optional.


<a href="#heading--the-reactive-plugin"><h3 id="heading--the-reactive-plugin">The `reactive` plugin</h3></a>

Used to pack charms using the reactive framework.

Note that this is a framework that has now been superseded by [the Ops library](https://github.com/canonical/operator), please use that framework instead of reactive. Support for reactive in Charmcraft is only to ease the transition of old charms into the new framework.

Supports the following configuration:

```
parts:
  charm:
    source: .
    plugin: reactive
    build-snaps: [charm]
    reactive-charm-build-arguments: <list of command line options>
```

The `reactive_charm_build_arguments` allows to include extra command line arguments in the underlying `charm build` call.



**Example:**

```text
parts:
  im-not-calling-this-what-you-expect:
    plugin: charm
    source: .
    charm-entrypoint: src/charm.py
    charm-binary-python-packages: []
    charm-python-packages: []
    charm-requirements: []
    charm-strict-dependencies: false
  another-part:
    plugin: nil
```

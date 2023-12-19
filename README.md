# Charmcraft IDE

This is a VS Code extension to provide tools for Juju Charms development. To lean more about Juju and Charms please visit official Juju [website][juju].

[juju]: https://juju.is

> ⚠️ *This extension is still in development.*

## Features

### General features

- Control charm belongings via the activity bar view:
  - Create/setup virtual environments.
  - Run Tox environments; lint, format, unit/integration tests, etc.
  - Activate a charm to be the default for Python development environment.

### Python features
- Hover for events or configuration parameters in charm source code.
- Auto-completion for events or configuration parameters in charm source code.
- Go-to-definition support for configuration parameters or actions.
- Diagnostics (e.g., invalid configuration parameter, or event references).
- Run/debug test classes/functions.

### YAML features
  > Note that for this feature to work, you need to install *Red Hat YAML* language server [extension](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml).
  - Schema validation (e.g., `metadata.yaml` or `config.yaml`).
  - Auto-completions (e.g., configurations or actions).
  - Documentation hovers.
  - Diagnostics.

## Configuration

These are some configuration parameters that you can set in `.vscode/settings.json` file of your workspace:

| Parameter                                   | Type     | Default  | Description                                                                           |
| ------------------------------------------- | -------- | -------- | ------------------------------------------------------------------------------------- |
| `charmcraft-ide.ignore`                     | `string` | (empty)  | Relative path Glob pattern of charm directories to ignore.                            |
| `charmcraft-ide.defaultVirtualEnvDirectory` | `string` | `"venv"` | Name of directory to setup/detect Python virtual environments.                        |
| `charmcraft-ide.override`                   | `object` | `{}`     | Charm-specific overrides (See [Charm-specific overrides](#charm-specific-overrides)). |

## Charm-specific overrides

You can override some default configurations for specific charms in your workspace. Note that overridden parameters, takes precedence over other configuration parameters, where relevant. To set overrides, you need to set the `charmcraft-ide.override` parameter with a map whose keys are relative path to the associated charms:

```jsonc
{
    "charmcraft-ide.override": {
        "path/to/charm": {
            "virtualEnvDirectory": ".venv"
        }
    }
}
```

Supported override parameters are as the table below:

| Parameter             | Type     | Description                                   |
| --------------------- | -------- | --------------------------------------------- |
| `virtualEnvDirectory` | `string` | Name of Python virtual environment directory. |

## Feedback

Please kindly provide your feedbacks through submitting issues/PRs in the extension's GitHub repository. 🍏

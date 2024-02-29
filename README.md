# Charmcraft IDE

This is a VS Code extension to provide tools for Juju Charms development. To lean more about Juju and Charms please visit official Juju [website][juju].

[juju]: https://juju.is

> ⚠️ *This extension is still in development.*

> ⚠️ *This extension is only tested on Linux based environments.*

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
- Run linter when saving files.

### YAML features
  > Note that for this feature to work, you need to install *Red Hat YAML* language server [extension](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml).
  - Schema validation (e.g., `metadata.yaml` or `config.yaml`).
  - Auto-completions (e.g., configurations or actions).
  - Documentation hovers.
  - Diagnostics.

## Linting on save

If you have Tox installed (either via a virtual environment set up in your charm's directory, or as a globally installed package) then the *Run Lint on Save* option is already enabled. With this option, when you save a Python file (either source code or test) the designated Tox environment `lint` (which is defined under the `[testenv:lint]` section in `tox.ini` file) will be triggered, and the output will be interpreted and displayed in the editor as diagnostics (i.e., red squiggly lines). You can customize the extension to invoke different Tox environments. It's also possible to run arbitrary shell commands when saving a file. You can check the [Configuration](#configuration) section for more details.

Currently, diagnostics are interpreted for these linters:

- `codespell`
- `flake8` (or `pflake8`)
- `mypy`
- `pydocstyle`
- `pylint`
- `ruff`

ℹ️ To disable the *Run Lint on Save* option, set `charmcraft-ide.runLintOnSave` configuration's `enabled` parameter to `false`.

## Configuration

These are some configuration parameters that you can set in `.vscode/settings.json` file of your workspace:

| Parameter                                   | Type       | Default            | Description                                                                                          |
| ------------------------------------------- | ---------- | ------------------ | ---------------------------------------------------------------------------------------------------- |
| `charmcraft-ide.ignore`                     | `string`   | (empty)            | Relative path Glob pattern of charm directories to ignore.                                           |
| `charmcraft-ide.defaultVirtualEnvDirectory` | `string`   | `"venv"`           | Name of directory to setup/detect Python virtual environments.                                       |
| `charmcraft-ide.runLintOnSave`              | `object`   | `{}`               | Options to configure *Run Lint on Save* feature.                                                     |
| `charmcraft-ide.runLintOnSave.enabled`      | `boolean`  | `true`             | Enables/disables *Run Lint on Save* feature.                                                         |
| `charmcraft-ide.runLintOnSave.tox`          | `string[]` | `["testenv:lint"]` | Linting-related Tox environment(s)/section(s) to run.                                                |
| `charmcraft-ide.runLintOnSave.commands`     | `string[]` | `[]`               | Linting-related commands to run.                                                                     |
| `charmcraft-ide.runLintOnSave.exclude`      | `string[]` | `[]`               | Array of linters to exclude their diagnostics; for example, `["flake8"]`.                            |
| `charmcraft-ide.runLintOnSave.include`      | `string[]` | `[]`               | Array of linters to include their diagnostics and exclude other linters'; for example, `["flake8"]`. |
| `charmcraft-ide.override`                   | `object`   | `{}`               | Charm-specific overrides (See [Charm-specific overrides](#charm-specific-overrides)).                |

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

| Parameter                               | Type       | Description                                                     |
| --------------------------------------- | ---------- | --------------------------------------------------------------- |
| `virtualEnvDirectory`                   | `string`   | Name of Python virtual environment directory.                   |
| `charmcraft-ide.runLintOnSave`          | `object`   | Options to configure *Run Lint on Save* feature.                |
| `charmcraft-ide.runLintOnSave.enabled`  | `boolean`  | (See [Configuration](#configuration) section for more details.) |
| `charmcraft-ide.runLintOnSave.tox`      | `string[]` | (See [Configuration](#configuration) section for more details.) |
| `charmcraft-ide.runLintOnSave.commands` | `string[]` | (See [Configuration](#configuration) section for more details.) |
| `charmcraft-ide.runLintOnSave.exclude`  | `string[]` | (See [Configuration](#configuration) section for more details.) |
| `charmcraft-ide.runLintOnSave.include`  | `string[]` | (See [Configuration](#configuration) section for more details.) |

## Feedback

Please kindly provide your feedbacks through submitting issues/PRs in the extension's GitHub repository. 🍏

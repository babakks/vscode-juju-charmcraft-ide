# Charmcraft IDE

This is a VS Code extension to provide tools for Juju Charms development. To lean more about Juju and Charms please visit official Juju [website][juju].

[juju]: https://juju.is

> ⚠️ *This extension is still in development. Please share your feedbacks/thoughts through submitting issues/PRs.* 🙏

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

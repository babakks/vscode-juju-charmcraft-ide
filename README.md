# Charmcraft IDE

This is a VS Code extension to provide tools for Juju Charms development. To lean more about Juju and Charms please visit official Juju [website][juju].

[juju]: https://juju.is

> ⚠️ *This extension is still in development. Please share your feedbacks/thoughts through submitting issues/PRs.* 🙏

## Features

### Python features
- Hover for events or configuration parameters in charm source code.
- Auto-completion for events or configuration parameters in charm source code.
- Go-to-definition support for configuration parameters or actions.

### YAML features
  > Note that for this feature to work, you need to install *Red Hat YAML* language server [extension](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml).
  - Schema validation (e.g., `metadata.yaml` or `config.yaml`).
  - Auto-completions (e.g., configurations or actions).
  - Documentation hovers.
  - Diagnostics.

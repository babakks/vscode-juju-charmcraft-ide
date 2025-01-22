# Change Log

## 0.0.18

- Fix bug in analyzing source/test files.

## 0.0.17

- Fix duplicate charms in the sidebar tree.

## 0.0.16

- Fix bug in detecting charm directories.
- Fix issues with tree view contextual commands.

## 0.0.15

- Improve charm directory detection criteria.
- Add `charmcraft.yaml` schema and diagnostics.
- Support charms with a single `charmcraft.yaml` manifest.

## 0.0.14

- Allow for custom launch configuration fields when debugging tests.

## 0.0.13

- Show individual configuration parameters and actions in the sidebar tree.

## 0.0.12

- Trigger *Run Lint on Save* if Tox is available (either via virtual environment or as a globally installed package).

## 0.0.11

- Avoid parallel triggering of *Run Lint on Save*.
- Improve *Run Lint on Save* telemetry measurements.

## 0.0.10

- Fix bug with diagnostics' negative line numbers.

## 0.0.9

- Add telemetry to measure *Run Lint on Save* performance.

## 0.0.8

- Add *Run Lint on Save* feature.

## 0.0.7

- Support configuration and charm-specific overrides.
- Fix potential memory leaks.
- Fix unset `OLDPWD` error when setting up virtual environments.

## 0.0.6

- Add run/debug tests feature.
- Improve setting up tox environments.

## 0.0.5

- Introduce Charmcraft tree to the activity bar.

## 0.0.4

- Add source code diagnostics for invalid references (e.g., configuration parameters or events).

## 0.0.3

- Add go-to-definition support form configuration parameters or actions.
- Add YAML diagnostics.

## 0.0.1

- Initial release.

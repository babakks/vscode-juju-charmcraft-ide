<a href="#heading--assumes"><h2 id="heading--assumes">`assumes`</h2></a>

**Status:** Optional. Recommended for Kubernetes charms.

**Purpose:** Allows charm authors to explicitly state in the metadata of a charm various features that a Juju model must be able to provide to ensure that the charm can be successfully deployed on it. When a charm comes preloaded with such requirements, this enables Juju to perform a pre-deployment check and to display user-friendly error messages if a feature requirement cannot be met by the model that the user is trying to deploy the charm to. If the assumes section of the charm metadata is omitted, Juju will make a best-effort attempt to deploy the charm, and users must rely on the output of `juju status` to figure out whether the deployment was successful. The `assumes` key is available since 2.9.23.

**Structure:** The key consists of a list of features that can be given either directly or, depending on the complexity of the condition you want to enforce, nested under one or both of the boolean expressions `any-of` or `all-of`, as shown below. In order for a charm to be deployed, all entries in the `assumes` block must be satisfied.

```yaml
assumes:
    - <feature_name>
    - any-of:
        - <feature_name>
        - <feature_name>
    - all-of:
        - <feature_name>
        - <feature_name>
```

 The supported feature names are as below:

||||
|- | - | - |
|`juju <comparison predicate> <version number>` <p> E.g., `juju < 3.0`. <br> E.g., `juju >= 2.9` |  The charm deploys iff the model runs agent binaries with the specified Juju version(s). |Since 2.9.23|
|`k8s-api` | The charm deploys iff the underlying substrate for the model is Kubernetes. |Since 2.9.23|

The Boolean expressions are defined as below:

|||
|-|-|
|`any-of`| The sub-expression is satisfied if any of the provided child expressions is satisfied.|
|`all-of` |   The sub-expression is satisfied if all of the provided child expressions are satisfied.|

**Examples:**

A simple example:

```text
assumes:
    - juju >= 2.9.23
    - k8s-api
```

An example with a nested expression:

```text
assumes:
- any-of:
  - juju >= 2.9
  - all-of:
    - juju >= 3.0
    - juju < 4.0
- k8s-api
```

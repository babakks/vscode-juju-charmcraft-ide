<a href="#heading--config"><h2 id="heading--config">`config`</h2></a>

> See first: [Juju | Application configuration](https://juju.is/docs/juju/configuration)

**Status:** Optional.

**Purpose:** The `config` key allows you to create configuration options for your charm.


```yaml
config:
  options:
    # Each option name is the name by which the charm will query the option.
    <option name>:
      # (Required) The type of the option
      type: string | int | float | boolean | secret
      # (Optional) The default value of the option
      default: <a reasonable default value of the same type as the option>
      # (Optional): A string describing the option. Also appears on charmhub.io
      description: <description string>
```

For the case where the `type` is `secret`: This is a string that needs to correspond to the secret URI.

**Example:**

```text
config:
  options:
    name:
      default: Wiki
      description: The name, or Title of the Wiki
      type: string
    logo:
      description: URL to fetch logo from
      type: string
    admins:
      description: 'Comma-separated list of admin users to create: user:pass[,user:pass]+'
      type: string
    debug:
      default: false
      type: boolean
      description: turn on debugging features of mediawiki
    port:
      default: 80
      type: int
      description: port on which to serve the wiki
    timeout:
      default: 60.0
      type: float
      description: maximum time before rendering a page will fail
    certificate:
      type: secret
      description: TLS certificate to use for securing connections
```

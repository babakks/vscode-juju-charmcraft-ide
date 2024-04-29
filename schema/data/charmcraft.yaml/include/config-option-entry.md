<a href="#heading--option"><h2 id="heading--option">`[option]`</h2></a>

**Status:** Optional.

**Purpose:** Each key represents a configuration parameter.

**Structure:** Consists of a charm-author-defined option name and an option description, given in 3 fields -- type, description, and default value:

```yaml
<option name>:
 default: <default value>
 description: <description>
 type: <type>
 ...
```

**Examples:**

```yaml
name:
 default: Wiki
 description: The name, or Title of the Wiki
 type: string
```

---

```yaml
skin:
 default: vector
 description: skin for the Wiki
 type: string
```

---

```yaml
logo:
 default:
 description: URL to fetch logo from
 type: string
```

---

```yaml
admins:
 default:
 description: Comma-separated list of admin users to create: user:pass[,user:pass]+
 type: string
```

---

```yaml
debug:
 default: false
 type: boolean
 description: turn on debugging features of mediawiki
```

See more:
- [Juju | Application configuration](https://juju.is/docs/juju/configuration)
- https://juju.is/docs/sdk/charmcraft-yaml#heading--config
- https://juju.is/docs/sdk/config-yaml

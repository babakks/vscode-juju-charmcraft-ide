<a href="#heading--peers-provides-requires"><h2 id="heading--peers-provides-requires">`peers`, `provides`, `requires`</h2></a>

> See also: [Juju | Relation (integration)](https://juju.is/docs/juju/relation)

An example featuring all three relation keys (peers, provides, or requires):
```text
peers:
  friend:
    interface: life
    limit: 150
    optional: true
    scope: container
provides:
  self:
    interface: identity
requires:
  parent:
    interface: birth
    limit: 2
    optional: false
    scope: global
```

------------

Full schema for a chosen endpoint role (peers, provides, or requires):
```
<endpoint role>: # 'peers', 'provides', or 'requires'
    # Each key represents the name of the endpoint as known by this charm
    <endpoint name>:

        # (Required) The interface schema that this relation conforms to
        interface: <endpoint interface name>

        # (Optional) Maximum number of supported connections to this relation
        # endpoint. This field is an integer
        limit: <n>

        # (Optional) Defines if the relation is required. Informational only.
        optional: true | false

        # (Optional) The scope of the relation. Defaults to "global"
        scope: global | container
```

***`<endpoint role>`***

**Status:** If you want to define any kind of integration, required. 

**Purpose:** To define an integration endpoint. 

**Structure:** *Name:* Depending on what kind of an integration you are trying to define: `peers`, `provides`, or `requires`. *Type:* Map. *Value:* One or more key-value pairs denoting a relation and its associated properties.

***`<endpoint role>.<endpoint name>`***

**Status:** Required.

**Purpose:** To define the name of the relation as known by this charm.

**Structure:** *Name: User-defined.* *Type:* string. *Value:*

***`<endpoint role>.<endpoint name>.interface`***  

**Status:** Required.

**Purpose:** To define the interface schema that this relation conforms to.

**Structure:** *Type:* String. *Value:* The name of the interface. Usually defined by the author of the charm providing the interface.  Cannot be `juju`. Cannot begin with `juju-`. Must only contain characters `a-z` and `-` and cannot start with `-`. :warning: The interface name is the only means of establishing whether two charms are compatible for integration; and carries with it nothing more than a mutual promise that the provider and requirer somehow know the communication protocol implied by the name.

***`<endpoint role>.<endpoint name>.limit`***

**Status:** Optional.

**Purpose:** To define the maximum number of supported connections to this relation endpoint.

**Structure:** *Type:* Integer. *Value:* User-defined. *Default value:* `nil`.

***`<endpoint role>.<endpoint name>.optional`***

**Status:** Optional.

**Purpose:** To define if the relation is required. Informational only. 

**Structure:** *Type:* Boolean. *Possible values:* `true`, `false`. *Default value:* `false`.

***`<endpoint role>.<endpoint name>.scope`*** 

**Status:** Optional.

**Purpose:** To define the scope of the relation, that is, the set of units from integrated applications that are reported to the unit as members of the integration. 

**Structure:** *Type:* String. **Possible values:** `container`, `global`. Container-scoped integrations are restricted to reporting details of a single principal unit to a single subordinate, and vice versa, while global integrations consider all possible remote units. Subordinate charms are only valid if they have at least one `requires` integration with `container` scope. *Default value:* `global`.

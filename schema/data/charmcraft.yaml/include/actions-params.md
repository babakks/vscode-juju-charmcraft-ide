<a href="#heading--actions-action-params"><h2 id="heading--actions-action-params">`actions.<action>.params`</h2></a>

**Status:** Optional.

**Purpose:** Holds action parameters.

**Value:** Mapping. Keys are parameter names.

 The entire map of `actions.<action>.params` is inserted into the action schema object as a “properties” validation keyword. The Juju CLI may read the “description” annotation keyword of each parameter to present to the user when describing the action.

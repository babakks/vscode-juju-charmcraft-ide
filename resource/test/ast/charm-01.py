#!/usr/bin/env python3

# (Read test case notes at the end.)

import ops
from ops import CharmBase

class CharmWithEventHandlers(ops.CharmBase):
    def __init__(self, *args):
        super().__init__(*args)
        self.framework.observe(self.on.start, self._on_start)
        self.framework.observe(self.on.config_changed, self._on_config_changed)

    def _on_start(self, event: ops.StartEvent):
        pass

    def _on_config_changed(self, event: ops.ConfigChangedEvent):
        pass

class CharmWithProperties(CharmBase):
    def __init__(self, *args):
        super().__init__(*args)

    @property
    def some_property(self):
        pass

    @some_property.setter
    def some_property(self, value):
        pass

class CharmWithStaticMethods(CharmBase):
    def static_method():
        pass

    @staticmethod
    def static_method_with_decorator(param):
        pass

if __name__ == "__main__":
    ops.main(CharmWithEventHandlers)

# Notes:
# - Base classes are referenced differently.
# - `CharmWithProperties` has getter/setter property methods.
# - `CharmWithEventHandlers` has a few event handlers.
# - The main charm is `CharmWithEventHandlers` (note the entrypoint if-statement).

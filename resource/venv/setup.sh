#!/usr/bin/env bash

# This script should be run in a charm's root directory.

set -e

pip3 install \
    tox \
    black \
    ruff \
    codespell \
    pytest \
    coverage[toml] \
    juju \
    pytest-operator
find . -maxdepth 1 -type f -name 'requirements*.txt' -exec pip3 install -r {} \;

# Setting up tox evnironments.
# (this only works with bash.)
IFS="," read -r -a envs <<< "$(tox list --no-desc | sed -z -e 's/\n/,/g' -e 's/,$//')"
for e in "${envs[@]}"
do
    fullname=$(tox config -e "$e" | head -n1 | grep -P --only-matching '(?<=\[).*(?=\])')
    tox exec -e "$e" -x "$fullname.allowlist_externals=sh" -- sh -c echo "Dependencies installed: $e"
done

cd -

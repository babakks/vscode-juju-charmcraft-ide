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
cd -

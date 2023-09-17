#!/usr/bin/env bash

# This script should be run in a charm's root directory.

set -e

venv_dir="${1:-venv}"
python3 -m venv "$venv_dir"

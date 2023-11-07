#!/usr/bin/env sh

# This script should be run in a charm's root directory.

set -e

venv_dir="${1:-venv}"
rm -rf "$venv_dir"

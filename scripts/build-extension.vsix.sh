#!/usr/bin/env bash
# Produces a publishable .vsix.
#
# Run scripts/build-ast-engine.sh and scripts/build-visualizer.sh first.
#
# Windows PowerShell:
#   npm --workspace @blast-radius/extension run build
#   cd extension ; npx vsce package

set -euo pipefail

echo "==> Building all sub-bundles"
bash scripts/build-ast-engine.sh
bash scripts/build-visualizer.sh

echo "==> tsc (extension)"
npm --workspace @blast-radius/extension run build

echo "==> vsce package"
(cd extension && npx vsce package)

echo "==> .vsix in extension/"

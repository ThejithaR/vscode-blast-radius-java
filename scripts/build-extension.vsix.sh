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

echo "==> Building workspace dependencies"
npm --workspace @blast-radius/git-engine run build
npm --workspace @blast-radius/ai-orchestrator run build

echo "==> Copying workspace dependencies to extension/lib"
mkdir -p extension/lib/git-engine
mkdir -p extension/lib/ai-orchestrator
mkdir -p extension/lib/shared

# Copy only necessary files
cp -r git-engine/dist extension/lib/git-engine/
cp git-engine/package.json extension/lib/git-engine/

cp -r ai-orchestrator/dist extension/lib/ai-orchestrator/
cp ai-orchestrator/package.json extension/lib/ai-orchestrator/

cp -r shared/types extension/lib/shared/
cp shared/package.json extension/lib/shared/

echo "==> tsc (extension)"
cd extension && npm run build && cd ..

echo "==> vsce package"
(cd extension && npx vsce package --baseContentUrl https://github.com/ThejithaR/vscode-blast-radius-java/raw/main/extension --baseImagesUrl https://github.com/ThejithaR/vscode-blast-radius-java/raw/main/extension)

echo "==> .vsix in extension/"

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
mkdir -p extension/lib/ast-engine

# Copy only necessary files
cp -r git-engine/dist extension/lib/git-engine/
cp git-engine/package.json extension/lib/git-engine/

cp -r ai-orchestrator/dist extension/lib/ai-orchestrator/
cp ai-orchestrator/package.json extension/lib/ai-orchestrator/

cp -r shared/types extension/lib/shared/
cp shared/package.json extension/lib/shared/

# Ship the AST engine fat-jar so the extension is self-contained.
# Filename is left versionless (extension code looks it up by a stable name).
AST_JAR=$(ls ast-engine/target/blast-radius-ast*.jar 2>/dev/null | grep -v '/original-' | head -n1)
if [ -z "$AST_JAR" ]; then
    echo "ERROR: AST engine JAR not found under ast-engine/target/ — run scripts/build-ast-engine.sh first"
    exit 1
fi
cp "$AST_JAR" extension/lib/ast-engine/blast-radius-ast.jar
echo "Copied $AST_JAR -> extension/lib/ast-engine/blast-radius-ast.jar"

echo "==> tsc (extension)"
cd extension && npm run build && cd ..

echo "==> vsce package"
(cd extension && npx vsce package --baseContentUrl https://github.com/ThejithaR/vscode-blast-radius-java/raw/main/extension --baseImagesUrl https://github.com/ThejithaR/vscode-blast-radius-java/raw/main/extension)

echo "==> .vsix in extension/"

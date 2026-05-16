#!/usr/bin/env bash
# Installs all workspace dependencies and builds the AST fat-jar.
#
# Prereqs: Node >= 20, npm >= 10, JDK 17, Maven >= 3.9.
#
# Windows: run from Git Bash or WSL. Native PowerShell equivalent:
#   npm install ; mvn -f ast-engine\pom.xml package -DskipTests

set -euo pipefail

echo "==> Installing npm workspace dependencies"
npm install

echo "==> Building AST engine fat-jar"
bash scripts/build-ast-engine.sh

echo ""
echo "Setup complete. Press F5 in VS Code at the repo root to launch the Extension Development Host."

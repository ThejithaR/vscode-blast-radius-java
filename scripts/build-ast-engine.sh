#!/usr/bin/env bash
# Builds the JavaParser AST engine fat-jar and copies it to extension/dist/.
#
# Windows PowerShell:
#   mvn -f ast-engine\pom.xml package -DskipTests
#   New-Item -ItemType Directory -Force extension\dist | Out-Null
#   Copy-Item ast-engine\target\blast-radius-ast.jar extension\dist\blast-radius-ast.jar

set -euo pipefail

echo "==> mvn package (ast-engine)"
#mvn -f ast-engine/pom.xml package -DskipTests

mkdir -p extension/dist
cp ast-engine/target/blast-radius-ast.jar extension/dist/blast-radius-ast.jar

echo "==> Fat-jar copied to extension/dist/blast-radius-ast.jar"

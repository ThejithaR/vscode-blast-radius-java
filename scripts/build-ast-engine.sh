#!/bin/bash
# Build AST engine JAR

set -e

echo "=========================================="
echo "Building AST Engine"
echo "=========================================="

# Navigate to ast-engine directory
cd "$(dirname "$0")/../ast-engine"

# Build with Maven
echo "Running Maven package..."
mvn -q clean package

# Check if a shaded JAR was produced (filename may vary with pom.xml <finalName>)
JAR_FILE=$(ls target/blast-radius-ast*.jar 2>/dev/null | grep -v '^target/original-' | head -n1)
if [ -z "$JAR_FILE" ]; then
    echo "ERROR: No blast-radius-ast JAR found under target/"
    exit 1
fi

echo "✓ JAR built successfully: $JAR_FILE"
echo "=========================================="
echo "AST Engine build complete!"
echo "=========================================="

# Made with Bob

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

# Check if JAR was created
if [ ! -f "target/blast-radius-ast-0.0.1.jar" ]; then
    echo "ERROR: JAR file not found at target/blast-radius-ast-0.0.1.jar"
    exit 1
fi

echo "✓ JAR built successfully: target/blast-radius-ast-0.0.1.jar"
echo "=========================================="
echo "AST Engine build complete!"
echo "=========================================="

# Made with Bob

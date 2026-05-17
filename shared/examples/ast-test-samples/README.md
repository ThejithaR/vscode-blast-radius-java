# AST Engine Test Samples

This directory contains test workspaces and documentation for validating the AST engine implementation.

## Contents

- `synthetic-workspace/` - Minimal Java workspace for unit testing
- `SMOKE-TESTS.md` - Commands for running smoke tests against real codebases
- `test-output-synthetic.json` - Expected output from synthetic workspace test

## Quick Test

**From repo root (`c:\Projects\vscode-blast-radius-java`):**

```bash
# Build the JAR (if not already built)
cd ast-engine
mvn -q package
cd ..

# Run against synthetic workspace
java -jar ast-engine/target/blast-radius-ast.jar \
  --workspace=C:/Projects/vscode-blast-radius-java/shared/examples/ast-test-samples/synthetic-workspace \
  --target=module-a/src/main/java/com/example/core/security/ValidationUtils.java \
  --target-package=com.example.core.security \
  --methods=verifyTokenStructure \
  > test-output-synthetic.json

# Validate
npx ajv-cli validate \
  -s shared/contracts/ast-dependencies-output.schema.json \
  -d test-output-synthetic.json

# Compare with expected
diff test-output-synthetic.json shared/examples/ast-test-samples/test-output-synthetic.json
```

**From anywhere (using absolute paths):**

```bash
java -jar C:/Projects/vscode-blast-radius-java/ast-engine/target/blast-radius-ast.jar \
  --workspace=C:/Projects/vscode-blast-radius-java/shared/examples/ast-test-samples/synthetic-workspace \
  --target=module-a/src/main/java/com/example/core/security/ValidationUtils.java \
  --target-package=com.example.core.security \
  --methods=verifyTokenStructure \
  > test-output-synthetic.json
```

Expected: Exit 0, valid JSON, byte-for-byte match with `test-output-synthetic.json`.

## Test Workspace Structure

The synthetic workspace demonstrates:
- Multi-module Maven project (module-a, module-b)
- Cross-module method calls
- Proper package structure
- Import resolution
- Multiple call sites in different methods

See `synthetic-workspace/` for the complete source.
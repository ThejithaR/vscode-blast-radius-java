# Quick Start Guide - AST Engine Testing

## Prerequisites

1. **Build the JAR** (only needed once, or after code changes):

```bash
cd C:/Projects/vscode-blast-radius-java/ast-engine
mvn -q package
```

This creates: `C:/Projects/vscode-blast-radius-java/ast-engine/target/blast-radius-ast.jar`

2. **Verify carbon-identity-framework location** (for Tests 2-3):
   - Expected: `C:/Projects/carbon-identity-framework`
   - If different, adjust `--workspace` in commands below

---

## Test 1: Synthetic Workspace (Quick Validation)

**Run from anywhere:**

```bash
java -jar C:/Projects/vscode-blast-radius-java/ast-engine/target/blast-radius-ast.jar \
  --workspace=C:/Projects/vscode-blast-radius-java/shared/examples/ast-test-samples/synthetic-workspace \
  --target=module-a/src/main/java/com/example/core/security/ValidationUtils.java \
  --target-package=com.example.core.security \
  --methods=verifyTokenStructure \
  > test-output-synthetic.json
```

**Verify:**

```bash
cd C:/Projects/vscode-blast-radius-java

# Schema validation
npx ajv-cli validate \
  -s shared/contracts/ast-dependencies-output.schema.json \
  -d test-output-synthetic.json

# Compare with expected
diff test-output-synthetic.json shared/examples/ast-test-samples/test-output-synthetic.json
```

**Expected:** Exit 0, valid JSON, no differences in diff output.

---

## Test 2: Carbon Identity Framework - Method Mode

**Run from anywhere:**

```bash
java -Xmx4g -jar C:/Projects/vscode-blast-radius-java/ast-engine/target/blast-radius-ast.jar \
  --workspace=C:/Projects/carbon-identity-framework \
  --target=components/flow-orchestration-framework/org.wso2.carbon.identity.flow.inflow.extensions/src/main/java/org/wso2/carbon/identity/flow/inflow/extensions/executor/InFlowExtensionExecutor.java \
  --target-package=org.wso2.carbon.identity.flow.inflow.extensions.executor \
  --methods=execute,buildErrorResponse,triggerDiagnosticFailure \
  > test-output-carbon-method.json
```

**Note:** `-Xmx4g` allocates 4GB heap (required for large codebase with 87 source roots and ~1700 JARs)

**Verify:**

```bash
cd C:/Projects/vscode-blast-radius-java

# Schema validation
npx ajv-cli validate \
  -s shared/contracts/ast-dependencies-output.schema.json \
  -d test-output-carbon-method.json

# Check results
cat test-output-carbon-method.json | jq '.dependencies | length'
# Should be > 0

cat test-output-carbon-method.json | jq '.dependencies[0]'
# Inspect first dependency
```

**Expected:** Exit 0, valid JSON, non-empty dependencies array.

---

## Test 3: Carbon Identity Framework - Class-Sweep Mode

**Run from anywhere:**

```bash
java -Xmx4g -jar C:/Projects/vscode-blast-radius-java/ast-engine/target/blast-radius-ast.jar \
  --workspace=C:/Projects/carbon-identity-framework \
  --target=components/flow-orchestration-framework/org.wso2.carbon.identity.flow.inflow.extensions/src/main/java/org/wso2/carbon/identity/flow/inflow/extensions/executor/InFlowExtensionExecutor.java \
  --target-package=org.wso2.carbon.identity.flow.inflow.extensions.executor \
  --methods= \
  > test-output-carbon-class.json
```

**Verify:**

```bash
cd C:/Projects/vscode-blast-radius-java

# Schema validation
npx ajv-cli validate \
  -s shared/contracts/ast-dependencies-output.schema.json \
  -d test-output-carbon-class.json

# Compare counts (class-sweep should find >= method mode)
METHOD_COUNT=$(cat test-output-carbon-method.json | jq '.dependencies | length')
CLASS_COUNT=$(cat test-output-carbon-class.json | jq '.dependencies | length')
echo "Method mode: $METHOD_COUNT dependencies"
echo "Class-sweep mode: $CLASS_COUNT dependencies"
```

**Expected:** Exit 0, valid JSON, CLASS_COUNT >= METHOD_COUNT.

---

## Troubleshooting

### "Unable to access jarfile"

- Use absolute path: `C:/Projects/vscode-blast-radius-java/ast-engine/target/blast-radius-ast.jar`
- Verify JAR exists: `ls C:/Projects/vscode-blast-radius-java/ast-engine/target/blast-radius-ast.jar`
- Rebuild if needed: `cd C:/Projects/vscode-blast-radius-java/ast-engine && mvn -q package`

### Out of Memory

- Add `-Xmx4g` (or `-Xmx8g`) before `-jar` in the command
- Close other applications to free memory
- Test with synthetic workspace first (Test 1) to verify setup

### carbon-identity-framework not found

- Clone it: `cd C:/Projects && git clone https://github.com/wso2/carbon-identity-framework.git`
- Or adjust `--workspace` path to your actual location

---

## Full Documentation

- Comprehensive test scenarios: [`SMOKE-TESTS.md`](./SMOKE-TESTS.md)
- Test workspace structure: [`README.md`](./README.md)
- Implementation handover: [`../../ast-engine-plan.md`](../../ast-engine-plan.md)

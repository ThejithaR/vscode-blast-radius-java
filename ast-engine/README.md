# ast-engine/ — JavaParser Static Analyzer

## Mission

Deterministically discover every downstream Java caller of the modified methods, across multi-module Maven and OSGi boundaries. Emit a strict `AstDependenciesOutput` JSON payload to stdout.

## Owner

**Member 3.** This is the heaviest single component — JavaParser type-resolution across an enterprise OSGi codebase.

## Tech Stack

- Java 17 (Temurin recommended)
- Maven ≥ 3.9
- [JavaParser](https://javaparser.org/) `com.github.javaparser:javaparser-symbol-solver-core` ≥ 3.25
- Jackson Databind (JSON serialization)
- `maven-shade-plugin` for fat-jar packaging

**Why Java instead of Python + tree-sitter?** See [docs/OSGI-AND-MAVEN.md](../docs/OSGI-AND-MAVEN.md). TL;DR: only JavaParser's `CombinedTypeSolver` can resolve symbols against JARs in `~/.m2`, which is required for the carbon-identity-framework target.

## Inputs / Outputs

| Direction | Source/Sink | Contract |
|---|---|---|
| In | spawned by `extension/childProcess/astRunner.ts` | CLI args matching [`GitDeltaOutput`](../shared/types/gitDeltaOutput.ts) shape |
| Out | stdout JSON | [`AstDependenciesOutput`](../shared/types/astDependenciesOutput.ts) |

**Important: this component emits *only* the `dependencies` array** — not the full Contract A. The `targetFile`/`targetPackage`/`gitDiff` fields are merged back in by Member 1's `contractAssembler.ts`.

See [examples/ast-input.example.json](./examples/ast-input.example.json) and [examples/ast-dependencies-output.example.json](./examples/ast-dependencies-output.example.json).

## CLI Contract

```bash
java -jar blast-radius-ast.jar \
  --workspace=/abs/path/to/workspace \
  --target=src/main/java/com/example/core/security/ValidationUtils.java \
  --target-package=com.example.core.security \
  --methods=verifyTokenStructure,otherMethod \
  > ast-dependencies-output.json
```

Exit codes:
- `0` — success, valid JSON on stdout
- `1` — usage error (missing args)
- `2` — workspace not found or no `pom.xml` discovered
- `3` — JavaParser exception (details on stderr)

## Implementation Plan

1. **`ProjectScanner`** — walks the workspace, finds all `pom.xml` files, collects the corresponding `src/main/java` source roots. Also discovers `target/dependency/*.jar` (if present) and falls back to `~/.m2/repository/` for resolved JARs.
2. **`TypeSolverBuilder`** — assembles a `CombinedTypeSolver`:
   - `ReflectionTypeSolver()` for JDK
   - one `JavaParserTypeSolver(srcRoot)` per Maven module
   - one `JarTypeSolver(jarPath)` per resolved JAR
3. **`DependencyFinder`** — visits every `CompilationUnit` in the workspace. For each `MethodCallExpr`, attempts `resolve()` and checks if the resolved declaration's containing class FQN matches the target's FQN AND the method name is in `changedMethods`. Records hits.
4. **`ContextLineExtractor`** — for each hit, reads the source file and pulls the exact line where the call sits.
5. **`AstOutputBuilder`** — assembles `AstDependenciesOutput`, serializes via Jackson, prints to stdout.

## Local Development

```bash
cd ast-engine
mvn package                      # produces target/blast-radius-ast.jar (fat-jar)

# Smoke test against a Maven repo
java -jar target/blast-radius-ast.jar \
  --workspace=$HOME/path/to/carbon-identity-framework \
  --target=components/identity-mgt/src/main/java/.../ValidationUtils.java \
  --target-package=com.example.core.security \
  --methods=verifyTokenStructure
```

## Mocking Upstream

Read [examples/ast-input.example.json](./examples/ast-input.example.json) to see what M2 will hand you. The CLI args mirror those fields.

## OSGi & Maven Caveats

See [docs/OSGI-AND-MAVEN.md](../docs/OSGI-AND-MAVEN.md) for the detailed setup. Key edge case: service-locator pattern calls (`OsgiServiceFactory.get(...)`) are invisible to static analysis — flag as a known MVP limitation.

## Future Scope: Maven Central JAR Resolution

The architecture supports cross-repo resolution via `JarTypeSolver` over downloaded sources from Maven Central. See [docs/OSGI-AND-MAVEN.md](../docs/OSGI-AND-MAVEN.md) "Future scope" section. Not in scope for MVP.

## Integration Hooks

- Fat-jar path after build: `target/blast-radius-ast.jar`.
- Copied to `extension/dist/blast-radius-ast.jar` by [scripts/build-ast-engine.sh](../scripts/build-ast-engine.sh).

## Open Questions

- Cold-start cost on a 50-module repo with a fat `~/.m2` — measure during demo prep.
- Whether to support incremental analysis (cache the type solver between invocations) — likely v0.2.

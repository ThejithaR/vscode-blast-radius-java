# `ast-engine/` — Implementation Handover

## 1. How to use this document

**Audience:** IBM Bob, implementing the `ast-engine/` component.

This document is the single entry point for your task. It gives you:

- A short project context so you know *why* this component exists.
- A map of where to look in the repo when you need to understand any other component (don't read everything upfront — use the table in §3 on demand).
- The five locked design decisions you must respect.
- The contract change that must be applied to `shared/` before you touch Java.
- Step-by-step implementation tasks (Task 0 through Task 6).
- A JavaParser API cheat sheet so you can copy import statements and recipes verbatim.

Treat every code block as canonical. Class names, package paths, method signatures, and CLI argument names are stable — do not rename or refactor them.

When in doubt about anything *outside* this task's scope (e.g., how the visualizer renders nodes, how Bob's prompts are structured), follow the pointers in §3 rather than guessing.

---

## 2. Project context

The **Blast Radius Mapper** is a VS Code extension that warns a developer about the *semantic* impact of an in-progress Java change before they open a PR. IDEs already catch structural breaks (wrong signature, wrong type). They are blind to logical breaks — e.g., a timeout reduced from 50s to 50ms compiles fine but silently kills downstream services.

The extension does this in four steps:

1. **Git engine** captures the developer's diff on the active file.
2. **AST engine (this component)** finds every Java file that calls the modified methods.
3. **AI orchestrator** sends the diff + caller context to IBM Bob, which classifies each caller's blast risk.
4. **Visualizer** renders a colour-coded Mermaid graph in a VS Code webview.

Your component is the **static-analysis ground truth**. You emit zero opinions about severity — your only job is to produce the deterministic list of "who calls what, on which line, from which method." Bob owns risk, intent, and reasons.

For longer-form context, see [README.md](README.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## 3. Where to look to understand any component

Each topic below has *one* authoritative file. Follow the link when (and only when) you need it.

| If you need to understand… | Open this |
|---|---|
| The full system architecture and component boundaries | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| The pipeline trace through one diff (M2 → M1 → M3 → M1 → M4 → M5) | [docs/PIPELINE.md](docs/PIPELINE.md) |
| All four contracts (field semantics, who produces, who consumes) | [docs/CONTRACTS.md](docs/CONTRACTS.md) + the four schemas under [shared/contracts/](shared/contracts/) |
| JavaParser + multi-module Maven + OSGi recipe (this is the most important reference for you) | [docs/OSGI-AND-MAVEN.md](docs/OSGI-AND-MAVEN.md) |
| **Your component (the one you're building)** | [ast-engine/README.md](ast-engine/README.md), [ast-engine/pom.xml](ast-engine/pom.xml), and the Java stubs under [ast-engine/src/main/java/com/example/blastradius/ast/](ast-engine/src/main/java/com/example/blastradius/ast/) |
| The upstream producer (git engine, Member 2) — already implemented | [git-engine/README.md](git-engine/README.md), TS type at [shared/types/gitDeltaOutput.ts](shared/types/gitDeltaOutput.ts), example payload [shared/examples/git-delta-output.example.json](shared/examples/git-delta-output.example.json) |
| The downstream consumer (extension orchestrator, Member 1) | [extension/README.md](extension/README.md) |
| Real-world test fixtures captured from carbon-identity-framework | [demo/sample-diffs/](demo/sample-diffs/) — currently `01-method-refactoring.json` and `02-simple-method-change.json` |
| Demo repo setup (carbon-identity-framework clone) | [demo/README.md](demo/README.md) and [docs/SAMPLE-REPO.md](docs/SAMPLE-REPO.md) |

You don't need to read M4 (`ai-orchestrator/`) or M5 (`visualizer/`) source. They consume your output but their internals don't affect what you produce.

---

## 4. What you are building

A **Maven-shaded fat-jar Java CLI** invoked by the extension as a child process. Given (workspace path, target file, target package, list of changed method names), it walks the workspace's Java sources, resolves every call expression against a `CombinedTypeSolver` that spans the workspace and the local Maven cache, and emits `AstDependenciesOutput` JSON on stdout.

The CLI signature, exit codes, and intended invocation are already documented in [ast-engine/README.md](ast-engine/README.md). The Java skeleton classes already exist as stubs under [ast-engine/src/main/java/com/example/blastradius/ast/](ast-engine/src/main/java/com/example/blastradius/ast/) — you are filling in their bodies, not creating them.

---

## 5. Locked design decisions

These were settled in the planning conversation and are non-negotiable for this task.

1. **Single-target per invocation.** The extension is a developer-facing tool, run on a *chosen* file in VS Code. One file per run. A diff may span multiple hunks within that one file — fine, no work needed (the `gitDiff` string handles that as raw text). No list/batch mode.

2. **`changedMethods` empty ⇒ class-level caller sweep.** When git-engine finds no method bodies in the diff (e.g., only imports, fields, or class-level annotations changed) it emits `changedMethods: []`. In that case you must find every file that references the target class via *any* expression — method calls, constructor calls, field access, name expressions, or imports. First reference per caller file becomes its call site.

3. **One dependency entry per caller file. `callSites: []` array inside.** The output schema is changing to support this — see §6. Every dependency object has `callSites` as a uniform array (always present, length ≥ 1). Two call sites of the same target method in different methods of the same caller file produce *two* `callSites[]` entries inside one `Dependency` object.

4. **Severity is NOT in your scope.** You emit no `risk`, no `intent`, no `reason`. Bob assigns severity per call site downstream.

5. **`usageContextLine` is the literal source line** of the call expression. Look up the line by `expr.getBegin().get().line`, read that exact line from the file, strip leading whitespace, keep the rest. No multi-line context, no surrounding statement.

---

## 6. Contract change required — apply this in Task 0

The decision in §5.3 changes the shape of every dependency entry. Today the schema has a scalar `usageContextLine` on each `Dependency`. After your change, it has a `callSites: []` array, where each element is `{ callerMethod, lineNumber, usageContextLine }`.

You own these edits because M3 produces the output. M4 and M5 haven't started consuming the contract yet, so changing it now is clean.

### 6.1 Files to update

| # | File | Change |
|---|---|---|
| 1 | [shared/contracts/ast-dependencies-output.schema.json](shared/contracts/ast-dependencies-output.schema.json) | In `dependencies[].properties`, remove `usageContextLine`. Add `callSites` as required array of objects, each requiring `callerMethod` (string), `lineNumber` (integer, minimum 1), `usageContextLine` (string). Set `minItems: 1` on `callSites`. Keep `additionalProperties: false` everywhere. |
| 2 | [shared/contracts/contract-a.schema.json](shared/contracts/contract-a.schema.json) | Same item-shape change as #1 in `dependencies[]`. |
| 3 | [shared/types/astDependenciesOutput.ts](shared/types/astDependenciesOutput.ts) | Export `CallSite { callerMethod: string; lineNumber: number; usageContextLine: string }`. Change `AstDependency.usageContextLine: string` to `callSites: CallSite[]`. |
| 4 | [shared/types/contractA.ts](shared/types/contractA.ts) | Mirror the dependency item shape (re-export `CallSite` if natural; otherwise inline). |
| 5 | [shared/examples/ast-dependencies-output.example.json](shared/examples/ast-dependencies-output.example.json) | Replace `usageContextLine` field with a 1-element `callSites` array using the canonical content in §6.2. |
| 6 | [shared/examples/contract-a.example.json](shared/examples/contract-a.example.json) | Same change to each dependency. |
| 7 | [ast-engine/examples/ast-dependencies-output.example.json](ast-engine/examples/ast-dependencies-output.example.json) | Byte-for-byte copy of #5. |
| 8 | [extension/examples/ast-output.json](extension/examples/ast-output.json) | Overwrite contents with the canonical example from #5. (File already exists under a shortened name — keep the filename, replace the body.) |
| 9 | [extension/examples/contract-a.example.json](extension/examples/contract-a.example.json) | Byte-for-byte copy of #6. |
| 10 | [ai-orchestrator/examples/contract-a.example.json](ai-orchestrator/examples/contract-a.example.json) | Byte-for-byte copy of #6. |

### 6.2 Canonical updated example (use exactly this for file #5; mirror into the contract-a.example.json files by adding `targetFile`, `targetPackage`, `gitDiff` from the existing example on top)

```json
{
  "dependencies": [
    {
      "filePath": "src/main/java/com/example/api/middleware/JwtAuthFilter.java",
      "packageName": "com.example.api.middleware",
      "importedSymbols": ["ValidationUtils"],
      "callSites": [
        {
          "callerMethod": "doFilter",
          "lineNumber": 87,
          "usageContextLine": "if (!ValidationUtils.verifyTokenStructure(rawToken)) { response.setStatus(401); return; }"
        }
      ]
    },
    {
      "filePath": "src/main/java/com/example/api/controllers/InternalBillingController.java",
      "packageName": "com.example.api.controllers",
      "importedSymbols": ["ValidationUtils"],
      "callSites": [
        {
          "callerMethod": "validatePartnerHeader",
          "lineNumber": 54,
          "usageContextLine": "boolean isValidPartner = ValidationUtils.verifyTokenStructure(header.getAuthToken());"
        }
      ]
    },
    {
      "filePath": "src/main/java/com/example/analytics/logging/AuditLogger.java",
      "packageName": "com.example.analytics.logging",
      "importedSymbols": ["ValidationUtils"],
      "callSites": [
        {
          "callerMethod": "logTokenAnalysis",
          "lineNumber": 142,
          "usageContextLine": "logger.info(\"Token analysis structural integrity outcome: \" + ValidationUtils.verifyTokenStructure(t));"
        }
      ]
    }
  ]
}
```

### 6.3 Downstream impact you do *not* fix (flag only)

- Member 4's Zod schema (`ai-orchestrator/src/schemas/contractB.zod.ts` and any Contract A consumer) — currently stubs; will catch up when M4 starts work.
- Member 5's visualizer node renderer and click-through drawer — currently stubs.

Do not edit M4 or M5 source. Their READMEs and example payloads already point at `shared/` as the source of truth, so updating `shared/` is enough.

---

## 7. CLI contract

This restates [ast-engine/README.md](ast-engine/README.md) — that README is also authoritative; treat any future drift as a bug.

**Invocation (PowerShell — repo's primary environment):**

```powershell
java -jar target\blast-radius-ast.jar `
  --workspace="C:\path\to\workspace" `
  --target="src/main/java/com/example/core/security/ValidationUtils.java" `
  --target-package="com.example.core.security" `
  --methods="verifyTokenStructure,otherMethod" `
  > ast-dependencies-output.json
```

**Bash equivalent (CI / Linux):**

```bash
java -jar target/blast-radius-ast.jar \
  --workspace=/abs/path/to/workspace \
  --target=src/main/java/com/example/core/security/ValidationUtils.java \
  --target-package=com.example.core.security \
  --methods=verifyTokenStructure,otherMethod \
  > ast-dependencies-output.json
```

**Argument rules:**

- `--workspace=<abs-path>` (required). Must exist and be a directory.
- `--target=<workspace-relative-path>` (required). Forward-slash path. The Java simple class name is the file basename minus `.java`.
- `--target-package=<dotted-fqn>` (required). For example, `com.example.core.security`.
- `--methods=<csv>` (optional). Empty string or omitted entirely both trigger **class-sweep mode**. Any non-empty CSV triggers **method mode**.

**Derived:** `targetFqn = targetPackage + "." + simpleClassName`.

**Exit codes:**

| Code | Meaning |
|---|---|
| 0 | Success. Valid JSON written to stdout. |
| 1 | Usage error: missing or malformed required argument. |
| 2 | Workspace not found, or zero `pom.xml` files discovered under it. |
| 3 | Top-level exception escaped (JavaParser internal error, IO failure, etc.). Full stack trace on stderr. |

**stdout vs stderr:** stdout is reserved for the final JSON payload. Every log line, warning, parse-skip, or progress message must go to stderr via `System.err.println(...)`. Do not introduce a logging framework.

---

## 8. Implementation tasks

Implement tasks in the order below. Each task is independently testable.

### Task 0 — Apply the contract change

**Scope:** the 10 files in §6.1. No Java touched in this task.

**Verification:**

```powershell
npx ajv-cli validate `
  -s shared\contracts\ast-dependencies-output.schema.json `
  -d shared\examples\ast-dependencies-output.example.json
npx ajv-cli validate `
  -s shared\contracts\contract-a.schema.json `
  -d shared\examples\contract-a.example.json
```

Both must report `valid`. The per-component copies are byte-for-byte identical, so they validate transitively.

### Task 1 — `BlastRadiusAstCli` + `TargetSpec` + new `CallSite` model

**Files:**

- [ast-engine/src/main/java/com/example/blastradius/ast/BlastRadiusAstCli.java](ast-engine/src/main/java/com/example/blastradius/ast/BlastRadiusAstCli.java)
- [ast-engine/src/main/java/com/example/blastradius/ast/model/TargetSpec.java](ast-engine/src/main/java/com/example/blastradius/ast/model/TargetSpec.java)
- New file: `ast-engine/src/main/java/com/example/blastradius/ast/model/CallSite.java`

**`TargetSpec` record:**

```java
package com.example.blastradius.ast.model;

import java.nio.file.Path;
import java.util.List;

public record TargetSpec(
        Path workspaceRoot,         // absolute
        String targetFile,          // workspace-relative, forward slashes
        String targetPackage,       // dotted
        String simpleClassName,     // derived from targetFile basename
        String targetFqn,           // targetPackage + "." + simpleClassName
        List<String> changedMethods // empty list ⇒ class-sweep mode
) {
    public boolean isMethodMode() { return !changedMethods.isEmpty(); }
}
```

**`CallSite` record:**

```java
package com.example.blastradius.ast.model;

public record CallSite(
        String callerMethod,
        int lineNumber,
        String usageContextLine
) {}
```

**`BlastRadiusAstCli.main(String[] args)` flow:**

```
1. Parse argv into a Map<String,String> via a simple loop matching "--key=value".
   Unknown flags or missing "=" ⇒ stderr "Usage: ..." line, exit 1.
2. Verify required args present (workspace, target, target-package).
   Missing ⇒ stderr "Usage: ...", exit 1.
3. workspaceRoot = Paths.get(args.workspace).toAbsolutePath().normalize().
   If !Files.isDirectory(workspaceRoot) ⇒ exit 2.
4. simpleClassName = basename(target) with ".java" stripped.
   targetFqn = targetPackage + "." + simpleClassName.
   changedMethods = methods CSV split by "," and trimmed, ignoring empty entries.
5. Build TargetSpec.
6. try {
       ProjectScanner scanner = new ProjectScanner();
       List<Path> srcRoots = scanner.findSourceRoots(spec.workspaceRoot());
       if (srcRoots.isEmpty()) {
           System.err.println("No pom.xml found under workspace");
           System.exit(2);
       }
       List<Path> jars = scanner.findResolvedJars(spec.workspaceRoot());
       JavaSymbolSolver solver = new TypeSolverBuilder().build(srcRoots, jars);
       StaticJavaParser.getParserConfiguration().setSymbolResolver(solver);
       List<Dependency> deps = new DependencyFinder().find(spec, srcRoots);
       AstOutputBuilder.printJson(new AstDependenciesOutput(deps));
   } catch (Throwable t) {
       t.printStackTrace(System.err);
       System.exit(3);
   }
```

**Acceptance:** with no args, prints usage to stderr and exits 1. With `--workspace=C:\does\not\exist ...`, exits 2 without writing to stdout.

### Task 2 — `ProjectScanner`

**File:** [ast-engine/src/main/java/com/example/blastradius/ast/ProjectScanner.java](ast-engine/src/main/java/com/example/blastradius/ast/ProjectScanner.java)

Two methods:

```java
public List<Path> findSourceRoots(Path workspaceRoot) throws IOException
public List<Path> findResolvedJars(Path workspaceRoot)
```

**`findSourceRoots`:**

- `Files.walk(workspaceRoot)` and filter to `p.getFileName().toString().equals("pom.xml")`.
- For each, compute `<pomDir>/src/main/java`. Include if `Files.isDirectory(...)`.
- De-dup, return as a deterministic sorted `List<Path>`.
- carbon-identity-framework produces 80–120 source roots. That is expected and fine.

**`findResolvedJars`:**

- **Strategy A (preferred):** walk workspace for any path matching `**/target/dependency/*.jar`. If at least one is found, return that union.
- **Strategy B (fallback):** if Strategy A is empty, walk `~/.m2/repository/` (via `System.getProperty("user.home") + "/.m2/repository"`) for every `*.jar`. **Cap at 5000 jars** to bound startup cost — emit a stderr note if the cap is hit.
- This method must never throw. Wrap each subtree walk in try/catch and skip on `AccessDeniedException` or similar. Return the partial result.

### Task 3 — `TypeSolverBuilder`

**File:** [ast-engine/src/main/java/com/example/blastradius/ast/TypeSolverBuilder.java](ast-engine/src/main/java/com/example/blastradius/ast/TypeSolverBuilder.java)

```java
package com.example.blastradius.ast;

import com.github.javaparser.symbolsolver.JavaSymbolSolver;
import com.github.javaparser.symbolsolver.resolution.typesolvers.CombinedTypeSolver;
import com.github.javaparser.symbolsolver.resolution.typesolvers.JarTypeSolver;
import com.github.javaparser.symbolsolver.resolution.typesolvers.JavaParserTypeSolver;
import com.github.javaparser.symbolsolver.resolution.typesolvers.ReflectionTypeSolver;

import java.io.IOException;
import java.nio.file.Path;
import java.util.List;

public class TypeSolverBuilder {
    public JavaSymbolSolver build(List<Path> srcRoots, List<Path> jars) {
        CombinedTypeSolver combined = new CombinedTypeSolver();
        combined.add(new ReflectionTypeSolver());
        for (Path src : srcRoots) {
            combined.add(new JavaParserTypeSolver(src.toFile()));
        }
        for (Path jar : jars) {
            try {
                combined.add(new JarTypeSolver(jar.toFile()));
            } catch (IOException e) {
                System.err.println("Skipping unreadable jar: " + jar + " (" + e.getMessage() + ")");
            }
        }
        return new JavaSymbolSolver(combined);
    }
}
```

Wrap each `new JarTypeSolver(...)` in try/catch; a malformed JAR otherwise kills the whole pass.

### Task 4 — `DependencyFinder` + `ContextLineExtractor`

**Files:**

- [ast-engine/src/main/java/com/example/blastradius/ast/DependencyFinder.java](ast-engine/src/main/java/com/example/blastradius/ast/DependencyFinder.java)
- [ast-engine/src/main/java/com/example/blastradius/ast/ContextLineExtractor.java](ast-engine/src/main/java/com/example/blastradius/ast/ContextLineExtractor.java)

**Public signature:**

```java
public List<Dependency> find(TargetSpec spec, List<Path> srcRoots) throws IOException
```

**High-level flow:**

```
1. Maintain an accumulator: Map<String, FileHits> keyed by workspace-relative caller filePath,
   where FileHits holds { packageName, importedSymbols (LinkedHashSet<String>), callSites (List<CallSite>) }.
2. For each source root, walk every *.java file (Files.walk + filter on .java).
   Skip the target file itself (compare absolute paths).
3. For each *.java file:
       try {
           CompilationUnit cu = StaticJavaParser.parse(file);
       } catch (Throwable e) {
           System.err.println("parse-skip " + file + ": " + e.getMessage());
           continue;
       }
       String pkg = cu.getPackageDeclaration()
                       .map(p -> p.getNameAsString())
                       .orElse("");
       Set<String> imports = cu.getImports().stream()
           .map(i -> i.getNameAsString())
           .filter(n -> n.equals(spec.targetFqn())
                        || n.startsWith(spec.targetPackage() + "."))
           .collect(Collectors.toCollection(LinkedHashSet::new));
       // method mode OR class-sweep mode — see below
4. After all files walked: for each FileHits with ≥1 call site, build a Dependency.
5. Sort dependencies by filePath alphabetically. Sort callSites within each dependency by lineNumber.
   This makes the output deterministic for testing.
```

**Method mode (`spec.isMethodMode() == true`):**

For each `MethodCallExpr mce` in `cu.findAll(MethodCallExpr.class)`:

```java
try {
    ResolvedMethodDeclaration r = mce.resolve();
    String declaringFqn = r.declaringType().getQualifiedName();
    String methodName   = r.getName();
    if (declaringFqn.equals(spec.targetFqn())
            && spec.changedMethods().contains(methodName)) {
        addCallSite(file, mce);
    }
} catch (UnsolvedSymbolException | UnsupportedOperationException ignored) {
    // resolver couldn't reach this symbol — skip silently
}
```

Also handle constructor calls (`ObjectCreationExpr`): if `spec.changedMethods()` contains `spec.simpleClassName()`, treat `new TargetClass(...)` as a hit. Verify via `oce.resolve().declaringType().getQualifiedName()`.

**Class-sweep mode (`spec.isMethodMode() == false`):**

Walk four expression types, recording any whose resolved owner FQN matches `targetFqn`:

- `MethodCallExpr` — `mce.resolve().declaringType().getQualifiedName()`.
- `ObjectCreationExpr` — `oce.resolve().declaringType().getQualifiedName()`.
- `FieldAccessExpr` — `fae.resolve().declaringType().getQualifiedName()` (catches `TargetClass.CONSTANT`).
- `NameExpr` — if `ne.resolve()` returns a `ResolvedTypeDeclaration`, compare `.getQualifiedName()` to `targetFqn`.

For all four, wrap `resolve()` in the same try/catch as method mode.

**`addCallSite` helper (used by both modes):**

```java
private void addCallSite(Path file, Node expr) {
    int line = expr.getBegin().map(p -> p.line).orElse(-1);
    if (line < 1) return;

    String contextLine = ContextLineExtractor.readLine(file, line);

    String callerMethod = expr.findAncestor(MethodDeclaration.class)
        .map(MethodDeclaration::getNameAsString)
        .orElseGet(() -> expr.findAncestor(ConstructorDeclaration.class)
            .map(ConstructorDeclaration::getNameAsString)
            .orElse("<class-init>"));

    String relPath = spec.workspaceRoot()
        .relativize(file.toAbsolutePath())
        .toString()
        .replace('\\', '/');

    FileHits hits = accumulator.computeIfAbsent(relPath,
        k -> new FileHits(callerPackageName, callerImports));
    // dedup within file: skip if (callerMethod, line) already recorded
    boolean dup = hits.callSites().stream()
        .anyMatch(cs -> cs.callerMethod().equals(callerMethod)
                        && cs.lineNumber() == line);
    if (!dup) {
        hits.callSites().add(new CallSite(callerMethod, line, contextLine));
    }
}
```

`callerPackageName` and `callerImports` are the package and filtered imports computed for the current CU — pass them in via instance state on `DependencyFinder` reset per file, or via a `BiConsumer`-style call from the per-file loop.

**`ContextLineExtractor.readLine(Path file, int lineNumber): String`:**

```java
package com.example.blastradius.ast;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.stream.Stream;

public class ContextLineExtractor {
    public static String readLine(Path file, int lineNumber) {
        try (Stream<String> lines = Files.lines(file, StandardCharsets.UTF_8)) {
            return lines.skip(lineNumber - 1L).findFirst().orElse("").stripLeading();
        } catch (IOException e) {
            return "";
        }
    }
}
```

Strip leading whitespace only. Trailing characters (including trailing comments and braces) are preserved — they help Bob understand context.

**Edge cases — handle silently (stderr note, never throw):**

- `UnsolvedSymbolException` on `resolve()` — common when a JAR is missing. Skip the call.
- `UnsupportedOperationException` from JavaParser internals — same, skip.
- File parse failures (mis-formed Java, encoding) — stderr note, skip the file.
- Target file appearing in the walk — compare via `cu.getStorage().get().getPath()` against `workspaceRoot.resolve(targetFile).toAbsolutePath()` and skip.
- `MethodReferenceExpr` (`obj::method`) — **not in scope** for MVP. Skip silently.

**Performance:** sequential walking is acceptable. On carbon-identity-framework expect 30–60 seconds end-to-end. Do not parallelize.

### Task 5 — `AstOutputBuilder` + update `Dependency` and verify `AstDependenciesOutput`

**Files:**

- [ast-engine/src/main/java/com/example/blastradius/ast/AstOutputBuilder.java](ast-engine/src/main/java/com/example/blastradius/ast/AstOutputBuilder.java)
- [ast-engine/src/main/java/com/example/blastradius/ast/model/Dependency.java](ast-engine/src/main/java/com/example/blastradius/ast/model/Dependency.java)
- [ast-engine/src/main/java/com/example/blastradius/ast/model/AstDependenciesOutput.java](ast-engine/src/main/java/com/example/blastradius/ast/model/AstDependenciesOutput.java) — verify only; the record `(List<Dependency> dependencies)` is already correct.

**Updated `Dependency`:**

```java
package com.example.blastradius.ast.model;

import java.util.List;

public record Dependency(
        String filePath,
        String packageName,
        List<String> importedSymbols,
        List<CallSite> callSites
) {}
```

**`AstOutputBuilder`:**

```java
package com.example.blastradius.ast;

import com.example.blastradius.ast.model.AstDependenciesOutput;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;

import java.io.IOException;

public class AstOutputBuilder {
    public static void printJson(AstDependenciesOutput out) throws IOException {
        ObjectMapper mapper = new ObjectMapper();
        mapper.enable(SerializationFeature.INDENT_OUTPUT);
        mapper.writeValue(System.out, out);
        System.out.println();
    }
}
```

Jackson 2.16 serializes Java records natively — no annotations required. Field order in JSON follows record declaration order, which matches the canonical example: `filePath, packageName, importedSymbols, callSites` for `Dependency`, and `callerMethod, lineNumber, usageContextLine` for `CallSite`.

### Task 6 — Build & smoke-test

**Build:**

```powershell
cd c:\Projects\vscode-blast-radius-java\ast-engine
mvn -q package
```

Produces `target\blast-radius-ast.jar` (shaded fat-jar with `BlastRadiusAstCli` set as `Main-Class`).

**Smoke test 1 — method mode against carbon-identity-framework (requires the demo repo cloned per [demo/README.md](demo/README.md)):**

```powershell
java -jar target\blast-radius-ast.jar `
  --workspace="C:\Projects\vscode-blast-radius-java\demo\repo-under-test\carbon-identity-framework" `
  --target="components/flow-orchestration-framework/org.wso2.carbon.identity.flow.inflow.extensions/src/main/java/org/wso2/carbon/identity/flow/inflow/extensions/executor/InFlowExtensionExecutor.java" `
  --target-package="org.wso2.carbon.identity.flow.inflow.extensions.executor" `
  --methods="execute,buildErrorResponse,triggerDiagnosticFailure" `
  > ast-out.json
```

This matches the fixture in [demo/sample-diffs/01-method-refactoring.json](demo/sample-diffs/01-method-refactoring.json).

**Acceptance:**

- Exit code 0.
- `ast-out.json` validates against [shared/contracts/ast-dependencies-output.schema.json](shared/contracts/ast-dependencies-output.schema.json) — verify with `npx ajv-cli validate -s ... -d ast-out.json`.
- `dependencies[]` is non-empty (the three changed methods are real public callers — at minimum internal flow-orchestration callers should appear).
- Every entry has `callSites.length >= 1`.
- No duplicate `(filePath, callerMethod, lineNumber)` triples.

**Smoke test 2 — class-sweep mode:**

Same command but with `--methods=` empty (or omit the flag entirely). Result should be a *superset* of test 1: every file that references `InFlowExtensionExecutor` as a type appears.

**Smoke test 3 — synthetic mini-workspace (no demo repo needed):**

Create a temporary workspace under `C:\tmp\fake-ws\` mirroring the `ValidationUtils` example:

- `module-a/pom.xml`, `module-a/src/main/java/com/example/core/security/ValidationUtils.java` with `verifyTokenStructure`.
- `module-b/.../JwtAuthFilter.java`, `InternalBillingController.java`, `AuditLogger.java` — each calling `ValidationUtils.verifyTokenStructure(...)`.

Run with `--methods=verifyTokenStructure`. Output `dependencies` must list the three callers, in alphabetical file order, with the call sites and lines matching what the source contains.

---

## 9. JavaParser API cheat sheet

Use these exact imports:

```java
import com.github.javaparser.StaticJavaParser;
import com.github.javaparser.ParserConfiguration;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.Node;
import com.github.javaparser.ast.body.ConstructorDeclaration;
import com.github.javaparser.ast.body.MethodDeclaration;
import com.github.javaparser.ast.expr.FieldAccessExpr;
import com.github.javaparser.ast.expr.MethodCallExpr;
import com.github.javaparser.ast.expr.NameExpr;
import com.github.javaparser.ast.expr.ObjectCreationExpr;
import com.github.javaparser.resolution.UnsolvedSymbolException;
import com.github.javaparser.resolution.declarations.ResolvedMethodDeclaration;
import com.github.javaparser.resolution.declarations.ResolvedTypeDeclaration;
import com.github.javaparser.symbolsolver.JavaSymbolSolver;
import com.github.javaparser.symbolsolver.resolution.typesolvers.CombinedTypeSolver;
import com.github.javaparser.symbolsolver.resolution.typesolvers.JavaParserTypeSolver;
import com.github.javaparser.symbolsolver.resolution.typesolvers.JarTypeSolver;
import com.github.javaparser.symbolsolver.resolution.typesolvers.ReflectionTypeSolver;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
```

**Recipes:**

- Configure parser once: `StaticJavaParser.getParserConfiguration().setSymbolResolver(solver);`
- Parse a file: `CompilationUnit cu = StaticJavaParser.parse(path.toFile());`
- Walk every node of a type: `List<MethodCallExpr> all = cu.findAll(MethodCallExpr.class);`
- Resolve a call: `ResolvedMethodDeclaration r = mce.resolve();` then `r.declaringType().getQualifiedName()` and `r.getName()`.
- Find enclosing method: `expr.findAncestor(MethodDeclaration.class)` returns `Optional<MethodDeclaration>`.
- Position: `expr.getBegin()` returns `Optional<Position>`; `.line` is the 1-based line.
- Package: `cu.getPackageDeclaration().map(p -> p.getNameAsString()).orElse("")`.
- Imports: `cu.getImports().stream().map(i -> i.getNameAsString())`.

The full setup recipe for `CombinedTypeSolver` is in [docs/OSGI-AND-MAVEN.md](docs/OSGI-AND-MAVEN.md) — your `TypeSolverBuilder` is the implementation of that recipe.

---

## 10. Out of scope (do NOT implement)

- Multi-target / batch CLI mode (v0.2).
- Parallelized CompilationUnit walking (v0.2).
- Type-solver caching across CLI invocations (v0.2).
- OSGi `Import-Package` / `bnd.bnd` secondary signal — flagged in [docs/OSGI-AND-MAVEN.md](docs/OSGI-AND-MAVEN.md) as v0.2.
- Maven Central poly-repo source-jar resolution (v0.2 future scope).
- `MethodReferenceExpr` (`obj::method`) handling — v0.2.
- Any severity, risk, intent, or reason fields in output — Bob's job (Member 4).
- Updating M4's Zod schemas or M5's visualizer rendering — those teams will catch up to the new `callSites` shape from `shared/`.

---

## 11. Verification checklist (end-to-end)

Run through this list before declaring done.

1. [ ] `mvn -q package` in `ast-engine/` builds cleanly and emits `target/blast-radius-ast.jar`.
2. [ ] `java -jar target/blast-radius-ast.jar` with no args prints usage to stderr and exits 1.
3. [ ] With `--workspace=C:\does\not\exist ...`, exits 2 without writing JSON to stdout.
4. [ ] **Smoke test 1** (method mode against carbon-identity-framework fixture 01) — exit 0, valid JSON, validates against `shared/contracts/ast-dependencies-output.schema.json`, dependencies non-empty, every entry has callSites with at least one element.
5. [ ] **Smoke test 2** (class-sweep mode, empty `--methods=`) — exit 0, dependency count ≥ smoke-test-1 count.
6. [ ] **Smoke test 3** (synthetic mini-workspace with the `ValidationUtils` example) — output `dependencies` matches the canonical example in §6.2, byte-for-byte after pretty-printing.
7. [ ] `ajv-cli` validation of both `shared/examples/ast-dependencies-output.example.json` and `shared/examples/contract-a.example.json` passes against their updated schemas.
8. [ ] **Merge invariant:** the JS-style spread `{...gitDelta, dependencies: astOut.dependencies}` produces a payload byte-equivalent to `shared/examples/contract-a.example.json`. This is the contract M1's `contractAssembler.ts` will rely on.
9. [ ] Output is **deterministic**: running the same input twice produces byte-identical JSON. Dependencies sorted alphabetically by `filePath`; `callSites` within each dependency sorted by `lineNumber`.
10. [ ] All log lines (parse-skips, jar-skips, scan progress) go to stderr. stdout contains only the final JSON payload + a trailing newline.

When all ten boxes are checked, the AST engine is ready for the orchestrator (Member 1) to wire it into the pipeline.

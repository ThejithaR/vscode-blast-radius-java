# Sample Repository Setup

The MVP is validated against the [WSO2 Carbon Identity Framework](https://github.com/wso2/carbon-identity-framework) — a real Java OSGi codebase with multi-module Maven structure.

## Why this repo

| Property | Why it matters |
|---|---|
| Java OSGi with `bnd.bnd` manifests | Validates that the AST engine handles OSGi `Import-Package` semantics. |
| Multi-module Maven (>50 sub-modules) | Validates `CombinedTypeSolver` wiring across module boundaries. |
| Heavy use of dependency injection (Carbon kernel) | Validates symbol resolution through Spring/OSGi service registries. |
| Real production code with active commits | Real diffs to test, real risk to classify. |

## Setup

```bash
# From the root of vscode-blast-radius-java/
mkdir -p demo/repo-under-test
cd demo/repo-under-test
git clone https://github.com/wso2/carbon-identity-framework.git
cd carbon-identity-framework

# Prime the local Maven cache (large download; ~5–15 min first time)
mvn -DskipTests dependency:resolve
```

`demo/repo-under-test/` is gitignored (see [.gitignore](../.gitignore)) — you don't commit the cloned framework.

## Running the extension against it

1. Open `c:\Projects\vscode-blast-radius-java` in VS Code.
2. Press **F5** to launch the Extension Development Host.
3. In the new window: `File > Open Folder` → `demo/repo-under-test/carbon-identity-framework/`.
4. Pick any file under `components/`, modify a method body, save.
5. **Cmd/Ctrl+Shift+P** → *Blast Radius: Map*.

## Pre-recorded diffs (offline testing)

Member 2 captures 3–5 representative diffs into [demo/sample-diffs/](../demo/sample-diffs/) so the rest of the team can test without running Git locally. Each fixture is a JSON file conforming to `GitDeltaOutput` (see [CONTRACTS.md](CONTRACTS.md)).

## Future scope: poly-repo + Maven Central

The current MVP requires all caller files to live in the same workspace. The architecture supports cross-repo resolution via `JarTypeSolver` against the user's `~/.m2` cache — implementation deferred to v0.2. See [OSGI-AND-MAVEN.md](OSGI-AND-MAVEN.md).

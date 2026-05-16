# demo/

Setup and fixtures for testing the extension against the **WSO2 Carbon Identity Framework** — a real Java OSGi codebase with multi-module Maven structure.

## What's here

- `repo-under-test/` — *(gitignored)* — clone target for [carbon-identity-framework](https://github.com/wso2/carbon-identity-framework).
- `sample-diffs/` — pre-recorded `GitDeltaOutput` JSON fixtures captured from real diffs. Curated by Member 2.

## Clone the sample repo

```bash
mkdir -p demo/repo-under-test
cd demo/repo-under-test
git clone https://github.com/wso2/carbon-identity-framework.git
cd carbon-identity-framework
mvn -DskipTests dependency:resolve   # primes ~/.m2 for JarTypeSolver
```

See [docs/SAMPLE-REPO.md](../docs/SAMPLE-REPO.md) for the full setup story.

## Running the extension against it

After cloning:

1. From the repo root, press F5 in VS Code to launch the Extension Development Host.
2. In the new VS Code window: `File > Open Folder` → `demo/repo-under-test/carbon-identity-framework/`.
3. Open any file under `components/`, modify a method body, save.
4. Cmd/Ctrl+Shift+P → **Blast Radius: Map**.

## Sample diffs (Member 2 populates)

Member 2 captures 3–5 representative changes into `sample-diffs/`, one JSON file per diff, conforming to [`GitDeltaOutput`](../shared/contracts/git-delta-output.schema.json). These fixtures let the rest of the team test M3, M4, and M5 in isolation without running Git locally.

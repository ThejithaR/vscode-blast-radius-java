# JavaParser Setup for OSGi + Multi-Module Maven

The AST engine targets the WSO2 Carbon Identity Framework — Java OSGi, multi-module Maven. This document explains how `ast-engine/` configures JavaParser to resolve symbols correctly in that environment, and the future-scope plan for Maven Central JAR resolution.

## The `CombinedTypeSolver` recipe

JavaParser uses a `TypeSolver` to answer the question "what does this symbol refer to?" — a prerequisite for `MethodCallExpr.resolve()` returning meaningful results. For our target, the type solver must be a composite:

```java
CombinedTypeSolver solver = new CombinedTypeSolver();

// 1. JDK classes (Object, String, etc.)
solver.add(new ReflectionTypeSolver());

// 2. All workspace source roots
for (Path srcRoot : projectScanner.findAllSourceRoots(workspaceRoot)) {
    solver.add(new JavaParserTypeSolver(srcRoot));
}

// 3. JARs from the local Maven cache
for (Path jar : projectScanner.findResolvedJars(workspaceRoot)) {
    solver.add(new JarTypeSolver(jar));
}
```

### Finding source roots in multi-module Maven

`ProjectScanner` walks the workspace looking for `pom.xml` files. For each one it adds `<module-dir>/src/main/java` to the type solver if it exists. This handles arbitrary Maven module nesting.

### Finding resolved JARs

Two strategies, in priority order:

1. **`target/dependency/` (most accurate)** — if the user ran `mvn dependency:copy-dependencies` for the module, every JAR the module needs is in `target/dependency/`. M3 prefers this.
2. **`~/.m2/repository/` walk (fallback)** — scan the local Maven cache for JARs matching the GAV coordinates in each `pom.xml` `<dependency>` block.

## OSGi caveats

OSGi adds a wrinkle: `MANIFEST.MF`'s `Import-Package` declares package-level imports that aren't visible to JavaParser's source-level resolution. Two cases:

1. **Source-available consumer** — the OSGi bundle that *consumes* the modified package is in the workspace. JavaParser resolves it via `JavaParserTypeSolver`. ✅ Works without OSGi awareness.
2. **JAR-only consumer** — the consumer bundle ships only as a JAR. JavaParser resolves it via `JarTypeSolver`. ✅ Works.
3. **Edge case: service-locator pattern** — a consumer calls a method via a runtime-resolved service reference (`OsgiServiceFactory.get(SecurityService.class)`). JavaParser sees only the interface, not the implementation, so the dependency is *not* visible at static analysis time. ⚠️ This is an MVP limitation — flagged in `ast-engine/README.md` as known.

A *secondary*, weaker signal is to grep `bnd.bnd` and `MANIFEST.MF` files for `Import-Package` declarations referencing the target package, and surface those bundles as `LOW_RISK` warnings even if static resolution misses them. Member 3 to assess whether to ship this in the MVP.

## Future scope: poly-repo Maven Central resolution

The MVP assumes all callers live in the same workspace. v0.2 extends to **cross-repo** discovery:

1. The user lists "watched groups" in the extension config (e.g. `org.wso2.carbon.*`).
2. The extension queries Maven Central's REST API to find all artifacts in those groups that depend on the modified artifact's GAV.
3. For each, download the source JAR (`*-sources.jar`) into a cache.
4. Add those source JARs as additional `JavaParserTypeSolver` roots.
5. Run the same dependency-finder pass.

This turns Blast Radius into an organization-wide impact map — not just one repo. Not in scope for the 48-hour MVP.

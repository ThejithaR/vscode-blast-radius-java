<!-- TODO(Member 4): Skill 2 — RiskClassification. -->
<!-- Spec: ../../../visualizer/BOB-SKILLS-SPEC.md#skill-2 -->

For each dependency, assign exactly one risk level using these rules:

- TARGET — reserved for the modified file itself (one node only).
- CRITICAL — compile break, or certain runtime failure on the next invocation. (e.g. method signature changed and caller doesn't provide the new parameter; required exception now thrown.)
- WARNING — logical risk: the call still compiles but behavior diverges in a way the caller likely doesn't expect.
- LOW_RISK — peripheral usage (logging, analytics, metrics) where the divergence does not affect user-facing behavior.
- SAFE — no observable change in behavior for this caller.

Apply package-context weighting (see PackageContextWeighting). The same compile error in `*.api.controllers.*` is CRITICAL while in `*.analytics.logging.*` it may be LOW_RISK.

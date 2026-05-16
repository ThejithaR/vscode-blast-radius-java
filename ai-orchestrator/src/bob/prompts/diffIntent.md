<!-- TODO(Member 4): Skill 1 — DiffIntentAnalysis. -->
<!-- Spec: ../../../visualizer/BOB-SKILLS-SPEC.md#skill-1 -->

Before classifying any dependency, examine the `gitDiff` and determine the *intent* of the change. Categorize it as one of:

- SIGNATURE_CHANGE — added/removed/changed parameters, return type, or visibility
- LOGIC_CHANGE — algorithm or control flow changed, signature unchanged
- CONSTANT_TUNING — only numeric/string constants changed (timeouts, thresholds)
- EXCEPTION_HANDLING — try/catch added, removed, or rethrown differently
- CONCURRENCY_CHANGE — synchronized/async/locks introduced or removed
- SECURITY_LOGIC — auth, crypto, validation logic changed
- RENAME_ONLY — identifiers renamed, no semantic change

This intent drives risk classification per dependency. A SIGNATURE_CHANGE almost always implies CRITICAL for callers; a CONSTANT_TUNING is often WARNING or LOW_RISK depending on call context.

<!-- TODO(Member 4): Skill 4 — EdgeTypeClassification. -->
<!-- Spec: ../../../visualizer/BOB-SKILLS-SPEC.md#skill-4 -->

For each edge from the TARGET to a dependency node, choose the edge type from the destination node's risk:

| Destination risk | Edge type |
|---|---|
| CRITICAL | breaking-dependency |
| WARNING, LOW_RISK | warning-dependency |
| SAFE | safe-dependency |
| TARGET | (no edge — TARGET is the origin) |

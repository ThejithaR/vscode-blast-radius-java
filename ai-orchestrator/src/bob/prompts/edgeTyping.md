For each edge from the TARGET to a dependency node, choose the edge type from the destination node's risk:

| Destination risk | Edge type |
|---|---|
| CRITICAL | breaking-dependency |
| WARNING, LOW_RISK | warning-dependency |
| SAFE | safe-dependency |
| TARGET | (no edge — TARGET is the origin) |

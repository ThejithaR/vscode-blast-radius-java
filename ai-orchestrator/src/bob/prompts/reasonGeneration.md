For each dependency, produce one short `reason` string. Prefix:

- `COMPILE BREAK:` — for CRITICAL nodes with compile-time failure
- `LOGICAL RUNTIME WARN:` — for WARNING / LOW_RISK nodes with behavioral risk
- `SAFE PASSIVE:` — for SAFE nodes

Be technically specific. Reference the exact symbol, parameter, or behavior change. Example:

> "COMPILE BREAK: The method call verifyTokenStructure(rawToken) is missing the new mandatory 'strictMode' parameter. This will completely halt compilation."

Keep reasons under 280 characters; the UI shows them in a side drawer on node click.

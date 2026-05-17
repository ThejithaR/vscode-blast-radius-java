After all dependencies are classified:

1. Set `overallRiskScore` = the worst risk level present among non-TARGET nodes, ordered: CRITICAL > WARNING > LOW_RISK > SAFE. If only TARGET, output SAFE.
2. Write a 2-3 sentence `summary` describing what changed, how many downstream files are affected, and the headline risk. Example:

> "The addition of a mandatory 'strictMode' boolean parameter to verifyTokenStructure() creates breaking compile-time errors in 2 downstream files. Urgent refactoring required."

export type RiskLevel = "TARGET" | "CRITICAL" | "WARNING" | "LOW_RISK" | "SAFE";
export type EdgeType = "breaking-dependency" | "warning-dependency" | "safe-dependency";
export interface ContractBNode {
    id: string;
    filePath: string;
    packageName: string;
    label: string;
    risk: RiskLevel;
    reason: string;
}
export interface ContractBEdge {
    from: string;
    to: string;
    type: EdgeType;
}
export interface ContractB {
    targetFile: string;
    targetPackage: string;
    overallRiskScore: RiskLevel;
    summary: string;
    nodes: ContractBNode[];
    edges: ContractBEdge[];
}
//# sourceMappingURL=contractB.d.ts.map
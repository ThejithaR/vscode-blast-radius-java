export interface ContractA {
  targetFile: string;
  gitDiff: string;
  dependencies: Array<{
    filePath: string;
    usageContextLine: number;
  }>;
}

export interface ContractB {
  overallRiskScore: number;
  summary: string;
  nodes: Array<{
    id: string;
    label: string;
  }>;
  edges: Array<{
    from: string;
    to: string;
    risk: string;
  }>;
}

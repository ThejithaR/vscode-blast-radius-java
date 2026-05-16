export interface CallSite {
  callerMethod: string;
  lineNumber: number;
  usageContextLine: string;
}

export interface AstDependency {
  filePath: string;
  packageName: string;
  importedSymbols: string[];
  callSites: CallSite[];
}

export interface AstDependenciesOutput {
  dependencies: AstDependency[];
}

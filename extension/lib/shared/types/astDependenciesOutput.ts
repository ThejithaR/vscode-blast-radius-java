export interface AstDependency {
  filePath: string;
  packageName: string;
  importedSymbols: string[];
  usageContextLine: string;
}

export interface AstDependenciesOutput {
  dependencies: AstDependency[];
}

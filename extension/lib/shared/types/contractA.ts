import type { AstDependency } from "./astDependenciesOutput";

export interface ContractA {
  targetFile: string;
  targetPackage: string;
  gitDiff: string;
  dependencies: AstDependency[];
}

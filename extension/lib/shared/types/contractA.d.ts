import type { CallSite } from "./astDependenciesOutput";
export interface ContractADependency {
    filePath: string;
    packageName: string;
    importedSymbols: string[];
    callSites: CallSite[];
}
export interface ContractA {
    targetFile: string;
    targetPackage: string;
    gitDiff: string;
    dependencies: ContractADependency[];
}
//# sourceMappingURL=contractA.d.ts.map
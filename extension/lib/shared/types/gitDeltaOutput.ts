export interface GitDeltaOutput {
  targetFile: string;
  targetPackage: string;
  gitDiff: string;
  changedMethods: string[];
}

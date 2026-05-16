package com.example.blastradius.ast.model;

import java.util.List;

// TODO(Member 3): immutable record matching AstDependency: filePath, packageName, importedSymbols, usageContextLine.
public record Dependency(
        String filePath,
        String packageName,
        List<String> importedSymbols,
        String usageContextLine
) {
}

package com.example.blastradius.ast.model;

import java.util.List;

public record Dependency(
        String filePath,
        String packageName,
        List<String> importedSymbols,
        List<CallSite> callSites
) {}

// Made with Bob

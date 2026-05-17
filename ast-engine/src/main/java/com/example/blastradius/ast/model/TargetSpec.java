package com.example.blastradius.ast.model;

import java.nio.file.Path;
import java.util.List;

public record TargetSpec(
        Path workspaceRoot,         // absolute
        String targetFile,          // workspace-relative, forward slashes
        String targetPackage,       // dotted
        String simpleClassName,     // derived from targetFile basename
        String targetFqn,           // targetPackage + "." + simpleClassName
        List<String> changedMethods // empty list ⇒ class-sweep mode
) {
    public boolean isMethodMode() { return !changedMethods.isEmpty(); }
}

// Made with Bob

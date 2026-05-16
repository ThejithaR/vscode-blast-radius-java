package com.example.blastradius.ast.model;

import java.util.List;

// TODO(Member 3): Jackson-serializable wrapper { dependencies: [...] }. Mirrors shared/types/astDependenciesOutput.ts.
public record AstDependenciesOutput(List<Dependency> dependencies) {
}

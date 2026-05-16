package com.example.blastradius.ast;

import com.github.javaparser.symbolsolver.JavaSymbolSolver;
import com.github.javaparser.symbolsolver.resolution.typesolvers.CombinedTypeSolver;
import com.github.javaparser.symbolsolver.resolution.typesolvers.JarTypeSolver;
import com.github.javaparser.symbolsolver.resolution.typesolvers.JavaParserTypeSolver;
import com.github.javaparser.symbolsolver.resolution.typesolvers.ReflectionTypeSolver;

import java.io.IOException;
import java.nio.file.Path;
import java.util.List;

public class TypeSolverBuilder {
    public JavaSymbolSolver build(List<Path> srcRoots, List<Path> jars) {
        CombinedTypeSolver combined = new CombinedTypeSolver();
        combined.add(new ReflectionTypeSolver());
        
        for (Path src : srcRoots) {
            combined.add(new JavaParserTypeSolver(src.toFile()));
        }
        
        for (Path jar : jars) {
            try {
                combined.add(new JarTypeSolver(jar.toFile()));
            } catch (IOException e) {
                System.err.println("Skipping unreadable jar: " + jar + " (" + e.getMessage() + ")");
            }
        }
        
        return new JavaSymbolSolver(combined);
    }
}

// Made with Bob

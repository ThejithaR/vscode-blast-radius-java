package com.example.blastradius.ast;

import com.example.blastradius.ast.model.AstDependenciesOutput;
import com.example.blastradius.ast.model.Dependency;
import com.example.blastradius.ast.model.TargetSpec;
import com.github.javaparser.StaticJavaParser;
import com.github.javaparser.symbolsolver.JavaSymbolSolver;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class BlastRadiusAstCli {
    public static void main(String[] args) {
        try {
            // Parse arguments into a map
            Map<String, String> argsMap = parseArguments(args);
            
            // Validate required arguments
            if (!argsMap.containsKey("workspace") || !argsMap.containsKey("target") || !argsMap.containsKey("target-package")) {
                System.err.println("Usage: java -jar blast-radius-ast.jar --workspace=<path> --target=<file> --target-package=<package> [--methods=<csv>]");
                System.exit(1);
            }
            
            // Extract arguments
            String workspaceStr = argsMap.get("workspace");
            String targetFile = argsMap.get("target");
            String targetPackage = argsMap.get("target-package");
            String methodsCsv = argsMap.getOrDefault("methods", "");
            
            // Validate workspace exists
            Path workspaceRoot = Paths.get(workspaceStr).toAbsolutePath().normalize();
            if (!Files.isDirectory(workspaceRoot)) {
                System.err.println("Workspace directory not found: " + workspaceRoot);
                System.exit(2);
            }
            
            // Derive simple class name from target file
            String simpleClassName = deriveClassName(targetFile);
            String targetFqn = targetPackage + "." + simpleClassName;
            
            // Parse changed methods
            List<String> changedMethods = parseMethodsCsv(methodsCsv);
            
            // Build TargetSpec
            TargetSpec spec = new TargetSpec(
                workspaceRoot,
                targetFile,
                targetPackage,
                simpleClassName,
                targetFqn,
                changedMethods
            );
            
            // Execute pipeline
            ProjectScanner scanner = new ProjectScanner();
            List<Path> srcRoots = scanner.findSourceRoots(spec.workspaceRoot());
            
            if (srcRoots.isEmpty()) {
                System.err.println("No pom.xml found under workspace");
                System.exit(2);
            }
            
            System.err.println("Found " + srcRoots.size() + " source roots");
            
            List<Path> jars = scanner.findResolvedJars(spec.workspaceRoot());
            System.err.println("Found " + jars.size() + " JAR files");
            
            TypeSolverBuilder builder = new TypeSolverBuilder();
            JavaSymbolSolver solver = builder.build(srcRoots, jars);
            StaticJavaParser.getParserConfiguration().setSymbolResolver(solver);
            
            List<Dependency> deps = new DependencyFinder().find(spec, srcRoots, builder.getCombinedSolver());
            
            AstOutputBuilder.printJson(new AstDependenciesOutput(deps));
            
        } catch (Throwable t) {
            t.printStackTrace(System.err);
            System.exit(3);
        }
    }
    
    private static Map<String, String> parseArguments(String[] args) {
        Map<String, String> result = new HashMap<>();
        for (String arg : args) {
            if (!arg.startsWith("--")) {
                System.err.println("Invalid argument format: " + arg);
                System.exit(1);
            }
            int eqIndex = arg.indexOf('=');
            if (eqIndex == -1) {
                System.err.println("Invalid argument format (missing '='): " + arg);
                System.exit(1);
            }
            String key = arg.substring(2, eqIndex);
            String value = arg.substring(eqIndex + 1);
            result.put(key, value);
        }
        return result;
    }
    
    private static String deriveClassName(String targetFile) {
        // Extract filename from path
        String filename = targetFile;
        int lastSlash = Math.max(targetFile.lastIndexOf('/'), targetFile.lastIndexOf('\\'));
        if (lastSlash >= 0) {
            filename = targetFile.substring(lastSlash + 1);
        }
        // Remove .java extension
        if (filename.endsWith(".java")) {
            return filename.substring(0, filename.length() - 5);
        }
        return filename;
    }
    
    private static List<String> parseMethodsCsv(String csv) {
        List<String> methods = new ArrayList<>();
        if (csv == null || csv.trim().isEmpty()) {
            return methods;
        }
        for (String method : csv.split(",")) {
            String trimmed = method.trim();
            if (!trimmed.isEmpty()) {
                methods.add(trimmed);
            }
        }
        return methods;
    }
}

// Made with Bob

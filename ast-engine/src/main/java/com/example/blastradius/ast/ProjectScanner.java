package com.example.blastradius.ast;

import java.io.IOException;
import java.nio.file.AccessDeniedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;

public class ProjectScanner {
    
    public List<Path> findSourceRoots(Path workspaceRoot) throws IOException {
        List<Path> sourceRoots = new ArrayList<>();
        
        // Walk workspace and find all pom.xml files
        try (Stream<Path> paths = Files.walk(workspaceRoot)) {
            List<Path> pomFiles = paths
                .filter(p -> p.getFileName().toString().equals("pom.xml"))
                .collect(Collectors.toList());
            
            // For each pom.xml, check if src/main/java exists
            for (Path pomFile : pomFiles) {
                Path pomDir = pomFile.getParent();
                Path srcMainJava = pomDir.resolve("src/main/java");
                if (Files.isDirectory(srcMainJava)) {
                    sourceRoots.add(srcMainJava);
                }
            }
        }
        
        // De-duplicate and sort
        return sourceRoots.stream()
            .distinct()
            .sorted()
            .collect(Collectors.toList());
    }
    
    public List<Path> findResolvedJars(Path workspaceRoot) {
        List<Path> jars = new ArrayList<>();
        
        // Strategy A: Look for target/dependency/*.jar in workspace
        try (Stream<Path> paths = Files.walk(workspaceRoot)) {
            List<Path> workspaceJars = paths
                .filter(p -> p.toString().contains("target" + java.io.File.separator + "dependency"))
                .filter(p -> p.toString().endsWith(".jar"))
                .collect(Collectors.toList());
            
            if (!workspaceJars.isEmpty()) {
                jars.addAll(workspaceJars);
                return jars.stream().distinct().sorted().collect(Collectors.toList());
            }
        } catch (IOException e) {
            System.err.println("Warning: Could not scan workspace for JARs: " + e.getMessage());
        }
        
        // Strategy B: Fallback to ~/.m2/repository
        String userHome = System.getProperty("user.home");
        Path m2Repo = Path.of(userHome, ".m2", "repository");
        
        if (Files.isDirectory(m2Repo)) {
            try (Stream<Path> paths = Files.walk(m2Repo)) {
                List<Path> m2Jars = paths
                    .filter(p -> p.toString().endsWith(".jar"))
                    .limit(5000)  // Cap at 5000 jars
                    .collect(Collectors.toList());
                
                if (m2Jars.size() >= 5000) {
                    System.err.println("Warning: Capped JAR discovery at 5000 files from ~/.m2/repository");
                }
                
                jars.addAll(m2Jars);
            } catch (AccessDeniedException e) {
                System.err.println("Warning: Access denied to some paths in ~/.m2/repository");
            } catch (IOException e) {
                System.err.println("Warning: Could not scan ~/.m2/repository: " + e.getMessage());
            }
        }
        
        return jars.stream().distinct().sorted().collect(Collectors.toList());
    }
}

// Made with Bob

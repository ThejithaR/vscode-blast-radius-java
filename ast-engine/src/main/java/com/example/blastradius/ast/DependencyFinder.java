package com.example.blastradius.ast;

import com.example.blastradius.ast.model.CallSite;
import com.example.blastradius.ast.model.Dependency;
import com.example.blastradius.ast.model.TargetSpec;
import com.github.javaparser.StaticJavaParser;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.Node;
import com.github.javaparser.ast.body.ConstructorDeclaration;
import com.github.javaparser.ast.body.MethodDeclaration;
import com.github.javaparser.ast.expr.FieldAccessExpr;
import com.github.javaparser.ast.expr.MethodCallExpr;
import com.github.javaparser.ast.expr.NameExpr;
import com.github.javaparser.ast.expr.ObjectCreationExpr;
import com.github.javaparser.resolution.UnsolvedSymbolException;
import com.github.javaparser.resolution.declarations.ResolvedClassDeclaration;
import com.github.javaparser.resolution.declarations.ResolvedInterfaceDeclaration;
import com.github.javaparser.resolution.declarations.ResolvedMethodDeclaration;
import com.github.javaparser.resolution.declarations.ResolvedReferenceTypeDeclaration;
import com.github.javaparser.resolution.declarations.ResolvedTypeDeclaration;
import com.github.javaparser.resolution.declarations.ResolvedValueDeclaration;
import com.github.javaparser.resolution.types.ResolvedReferenceType;
import com.github.javaparser.symbolsolver.resolution.typesolvers.CombinedTypeSolver;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;

public class DependencyFinder {
    
    private TargetSpec spec;
    private Map<String, FileHits> accumulator;
    private String currentPackageName;
    private Set<String> currentImports;
    private CombinedTypeSolver typeSolver;
    private Map<String, Boolean> implementationCache;
    
    public List<Dependency> find(TargetSpec spec, List<Path> srcRoots, CombinedTypeSolver solver) throws IOException {
        this.spec = spec;
        this.accumulator = new HashMap<>();
        this.typeSolver = solver;
        this.implementationCache = new HashMap<>();
        
        Path targetAbsPath = spec.workspaceRoot().resolve(spec.targetFile()).toAbsolutePath().normalize();
        
        // Walk all source roots
        for (Path srcRoot : srcRoots) {
            try (Stream<Path> paths = Files.walk(srcRoot)) {
                List<Path> javaFiles = paths
                    .filter(p -> p.toString().endsWith(".java"))
                    .collect(Collectors.toList());
                
                for (Path file : javaFiles) {
                    // Skip the target file itself
                    if (file.toAbsolutePath().normalize().equals(targetAbsPath)) {
                        continue;
                    }
                    
                    processFile(file);
                }
            }
        }
        
        // Build final dependency list
        List<Dependency> dependencies = new ArrayList<>();
        for (Map.Entry<String, FileHits> entry : accumulator.entrySet()) {
            FileHits hits = entry.getValue();
            if (!hits.callSites.isEmpty()) {
                // Sort call sites by line number
                hits.callSites.sort(Comparator.comparingInt(CallSite::lineNumber));
                
                dependencies.add(new Dependency(
                    entry.getKey(),
                    hits.packageName,
                    new ArrayList<>(hits.importedSymbols),
                    hits.callSites
                ));
            }
        }
        
        // Sort dependencies by file path
        dependencies.sort(Comparator.comparing(Dependency::filePath));
        
        return dependencies;
    }
    
    private void processFile(Path file) {
        try {
            CompilationUnit cu = StaticJavaParser.parse(file.toFile());
            
            // Extract package name
            currentPackageName = cu.getPackageDeclaration()
                .map(p -> p.getNameAsString())
                .orElse("");
            
            // Extract relevant imports
            currentImports = cu.getImports().stream()
                .map(i -> i.getNameAsString())
                .filter(n -> n.equals(spec.targetFqn()) 
                          || n.startsWith(spec.targetPackage() + "."))
                .collect(Collectors.toCollection(LinkedHashSet::new));
            
            // Process based on mode
            if (spec.isMethodMode()) {
                processMethodMode(file, cu);
            } else {
                processClassSweepMode(file, cu);
            }
            
        } catch (Throwable e) {
            System.err.println("parse-skip " + file + ": " + e.getMessage());
        }
    }
    
    private void processMethodMode(Path file, CompilationUnit cu) {
        // Process method calls
        for (MethodCallExpr mce : cu.findAll(MethodCallExpr.class)) {
            try {
                ResolvedMethodDeclaration r = mce.resolve();
                String declaringFqn = r.declaringType().getQualifiedName();
                String methodName = r.getName();
                
                // Direct match OR polymorphic match through interface/superclass
                if ((declaringFqn.equals(spec.targetFqn())
                        || isTargetImplementation(declaringFqn))
                        && spec.changedMethods().contains(methodName)) {
                    addCallSite(file, mce);
                }
            } catch (UnsolvedSymbolException | UnsupportedOperationException ignored) {
                // Skip unresolved symbols
            }
        }
        
        // Process constructor calls
        for (ObjectCreationExpr oce : cu.findAll(ObjectCreationExpr.class)) {
            try {
                String declaringFqn = oce.resolve().declaringType().getQualifiedName();
                
                if (declaringFqn.equals(spec.targetFqn())
                        && spec.changedMethods().contains(spec.simpleClassName())) {
                    addCallSite(file, oce);
                }
            } catch (UnsolvedSymbolException | UnsupportedOperationException ignored) {
                // Skip unresolved symbols
            }
        }
    }
    
    private void processClassSweepMode(Path file, CompilationUnit cu) {
        // Process method calls
        for (MethodCallExpr mce : cu.findAll(MethodCallExpr.class)) {
            try {
                ResolvedMethodDeclaration r = mce.resolve();
                String declaringFqn = r.declaringType().getQualifiedName();
                
                // Direct match OR polymorphic match
                if (declaringFqn.equals(spec.targetFqn())
                        || isTargetImplementation(declaringFqn)) {
                    addCallSite(file, mce);
                }
            } catch (UnsolvedSymbolException | UnsupportedOperationException ignored) {
                // Skip unresolved symbols
            }
        }
        
        // Process constructor calls
        for (ObjectCreationExpr oce : cu.findAll(ObjectCreationExpr.class)) {
            try {
                String declaringFqn = oce.resolve().declaringType().getQualifiedName();
                
                if (declaringFqn.equals(spec.targetFqn())) {
                    addCallSite(file, oce);
                }
            } catch (UnsolvedSymbolException | UnsupportedOperationException ignored) {
                // Skip unresolved symbols
            }
        }
        
        // Process field access
        for (FieldAccessExpr fae : cu.findAll(FieldAccessExpr.class)) {
            try {
                ResolvedValueDeclaration resolved = fae.resolve();
                if (resolved.isField()) {
                    String declaringFqn = resolved.asField().declaringType().getQualifiedName();
                    
                    if (declaringFqn.equals(spec.targetFqn())) {
                        addCallSite(file, fae);
                    }
                }
            } catch (UnsolvedSymbolException | UnsupportedOperationException ignored) {
                // Skip unresolved symbols
            }
        }
        
        // Process name expressions
        for (NameExpr ne : cu.findAll(NameExpr.class)) {
            try {
                if (ne.resolve() instanceof ResolvedTypeDeclaration) {
                    ResolvedTypeDeclaration rtd = (ResolvedTypeDeclaration) ne.resolve();
                    String fqn = rtd.getQualifiedName();
                    
                    if (fqn.equals(spec.targetFqn())) {
                        addCallSite(file, ne);
                    }
                }
            } catch (UnsolvedSymbolException | UnsupportedOperationException ignored) {
                // Skip unresolved symbols
            }
        }
    }
    
    private void addCallSite(Path file, Node expr) {
        int line = expr.getBegin().map(p -> p.line).orElse(-1);
        if (line < 1) return;
        
        String contextLine = ContextLineExtractor.readLine(file, line);
        
        String callerMethod = expr.findAncestor(MethodDeclaration.class)
            .map(MethodDeclaration::getNameAsString)
            .orElseGet(() -> expr.findAncestor(ConstructorDeclaration.class)
                .map(ConstructorDeclaration::getNameAsString)
                .orElse("<class-init>"));
        
        String relPath = spec.workspaceRoot()
            .relativize(file.toAbsolutePath())
            .toString()
            .replace('\\', '/');
        
        FileHits hits = accumulator.computeIfAbsent(relPath,
            k -> new FileHits(currentPackageName, currentImports));
        
        // Dedup within file: skip if (callerMethod, line) already recorded
        boolean dup = hits.callSites.stream()
            .anyMatch(cs -> cs.callerMethod().equals(callerMethod) 
                         && cs.lineNumber() == line);
        
        if (!dup) {
            hits.callSites.add(new CallSite(callerMethod, line, contextLine));
        }
    }
    
    /**
     * Check if the target class implements/extends the declaring type.
     * Uses caching to avoid repeated type resolution.
     */
    private boolean isTargetImplementation(String declaringFqn) {
        // Check cache first
        if (implementationCache.containsKey(declaringFqn)) {
            return implementationCache.get(declaringFqn);
        }
        
        boolean result = checkTypeHierarchy(declaringFqn);
        implementationCache.put(declaringFqn, result);
        return result;
    }
    
    /**
     * Resolve both types and check if target is a subtype of declaring type.
     */
    private boolean checkTypeHierarchy(String declaringFqn) {
        try {
            // Resolve both types
            ResolvedReferenceTypeDeclaration declaring = typeSolver.solveType(declaringFqn);
            ResolvedReferenceTypeDeclaration target = typeSolver.solveType(spec.targetFqn());
            
            // Check if target is subtype of declaring
            return isSubtypeOf(target, declaring);
        } catch (Exception e) {
            // Conservative: if can't resolve, assume no match
            return false;
        }
    }
    
    /**
     * Check if subtype implements/extends supertype.
     * Checks direct match, all interfaces, and all ancestors.
     */
    private boolean isSubtypeOf(ResolvedReferenceTypeDeclaration subtype,
                                ResolvedReferenceTypeDeclaration supertype) {
        // Direct match
        if (subtype.getQualifiedName().equals(supertype.getQualifiedName())) {
            return true;
        }
        
        // Check if subtype is a class
        if (subtype.isClass()) {
            ResolvedClassDeclaration classDecl = subtype.asClass();
            
            // Check all interfaces
            for (ResolvedReferenceType iface : classDecl.getAllInterfaces()) {
                if (iface.getQualifiedName().equals(supertype.getQualifiedName())) {
                    return true;
                }
            }
            
            // Check all ancestors (superclasses)
            for (ResolvedReferenceType ancestor : classDecl.getAllAncestors()) {
                if (ancestor.getQualifiedName().equals(supertype.getQualifiedName())) {
                    return true;
                }
            }
        }
        
        // Check if subtype is an interface
        if (subtype.isInterface()) {
            ResolvedInterfaceDeclaration ifaceDecl = subtype.asInterface();
            
            // Check all extended interfaces
            for (ResolvedReferenceType extended : ifaceDecl.getAllInterfacesExtended()) {
                if (extended.getQualifiedName().equals(supertype.getQualifiedName())) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    private static class FileHits {
        String packageName;
        Set<String> importedSymbols;
        List<CallSite> callSites;
        
        FileHits(String packageName, Set<String> importedSymbols) {
            this.packageName = packageName;
            this.importedSymbols = new LinkedHashSet<>(importedSymbols);
            this.callSites = new ArrayList<>();
        }
    }
}

// Made with Bob

package com.example.blastradius.ast.model;

public record CallSite(
        String callerMethod,
        int lineNumber,
        String usageContextLine
) {}

// Made with Bob

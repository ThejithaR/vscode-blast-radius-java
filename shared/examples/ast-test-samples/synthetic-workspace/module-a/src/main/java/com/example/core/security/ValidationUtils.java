package com.example.core.security;

public class ValidationUtils {
    public static boolean verifyTokenStructure(String token) {
        if (token == null || token.isEmpty()) {
            return false;
        }
        String[] parts = token.split("\\.");
        return parts.length == 3;
    }
}

// Made with Bob

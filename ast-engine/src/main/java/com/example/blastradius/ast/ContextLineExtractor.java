package com.example.blastradius.ast;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.stream.Stream;

public class ContextLineExtractor {
    public static String readLine(Path file, int lineNumber) {
        try (Stream<String> lines = Files.lines(file, StandardCharsets.UTF_8)) {
            return lines.skip(lineNumber - 1L).findFirst().orElse("").stripLeading();
        } catch (IOException e) {
            return "";
        }
    }
}

// Made with Bob

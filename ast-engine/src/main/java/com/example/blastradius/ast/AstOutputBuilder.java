package com.example.blastradius.ast;

import com.example.blastradius.ast.model.AstDependenciesOutput;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;

import java.io.IOException;

public class AstOutputBuilder {
    public static void printJson(AstDependenciesOutput out) throws IOException {
        ObjectMapper mapper = new ObjectMapper();
        mapper.enable(SerializationFeature.INDENT_OUTPUT);
        mapper.writeValue(System.out, out);
        System.out.println();
    }
}

// Made with Bob

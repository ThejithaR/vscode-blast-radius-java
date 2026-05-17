// Load environment variables from parent directory .env file
require('dotenv').config({ path: '../.env' });

const { analyze } = require('../dist/ai-orchestrator/src/index.js');

// Example Contract A
const contractA = {
  targetFile: 'src/main/java/com/example/core/security/ValidationUtils.java',
  targetPackage: 'com.example.core.security',
  gitDiff: `@@ -24,8 +24,9 @@
 public class ValidationUtils {
-    public static boolean verifyTokenStructure(String token) {
-        return token != null && token.split("\\.").length == 3;
+    public static boolean verifyTokenStructure(String token, boolean strictMode) {
+        // Strict mode forces signature validation
+        if (strictMode) { return CryptographyEngine.validateSignature(token); }
+        return token != null && token.contains("Bearer ");
     }
 }`,
  dependencies: [
    {
      filePath: 'src/main/java/com/example/api/middleware/JwtAuthFilter.java',
      packageName: 'com.example.api.middleware',
      importedSymbols: ['ValidationUtils'],
      usageContextLine: 'if (!ValidationUtils.verifyTokenStructure(rawToken)) { response.setStatus(401); return; }'
    },
    {
      filePath: 'src/main/java/com/example/api/controllers/InternalBillingController.java',
      packageName: 'com.example.api.controllers',
      importedSymbols: ['ValidationUtils'],
      usageContextLine: 'boolean isValidPartner = ValidationUtils.verifyTokenStructure(header.getAuthToken());'
    }
  ]
};

// Analyze and get Contract B
analyze(contractA)
  .then(contractB => {
    console.log('✓ Analysis complete!');
    console.log('Overall Risk:', contractB.overallRiskScore);
    console.log('Summary:', contractB.summary);
    console.log('Nodes:', contractB.nodes.length);
    console.log('Edges:', contractB.edges.length);
    console.log('\nFull Contract B:');
    console.log(JSON.stringify(contractB, null, 2));
  })
  .catch(error => {
    console.error('✗ Analysis failed:', error.message);
    process.exit(1);
  });
/**
 * Manual test script for git-engine
 * 
 * This script tests the git-engine against a real file in carbon-identity-framework.
 * 
 * Usage:
 *   1. Make a change to any Java file in carbon-identity-framework
 *   2. Run: node git-engine/test-manual.js
 */

const path = require('path');
const { extract, validateFile } = require('./dist/index.js');

// Configuration
const WORKSPACE_ROOT = path.resolve(__dirname, '../../carbon-identity-framework');
const TEST_FILE = 'components/flow-orchestration-framework/org.wso2.carbon.identity.flow.inflow.extensions/src/main/java/org/wso2/carbon/identity/flow/inflow/extensions/model/ContextPath.java';

async function runTest() {
  console.log('='.repeat(80));
  console.log('Git-Engine Manual Test');
  console.log('='.repeat(80));
  console.log();

  const absolutePath = path.join(WORKSPACE_ROOT, TEST_FILE);
  
  console.log('Configuration:');
  console.log('  Workspace Root:', WORKSPACE_ROOT);
  console.log('  Test File:', TEST_FILE);
  console.log('  Absolute Path:', absolutePath);
  console.log();

  // Step 1: Validate file
  console.log('Step 1: Validating file...');
  const validation = validateFile(absolutePath, WORKSPACE_ROOT);
  
  if (!validation.valid) {
    console.error('❌ Validation failed:', validation.error);
    console.log();
    console.log('Possible reasons:');
    console.log('  - File has no uncommitted changes (make a change and save)');
    console.log('  - Not in a git repository');
    console.log('  - File is not a Java file');
    console.log();
    process.exit(1);
  }
  
  console.log('✅ Validation passed');
  console.log();

  // Step 2: Extract git delta
  console.log('Step 2: Extracting git delta...');
  try {
    const startTime = Date.now();
    const gitDelta = await extract(absolutePath, WORKSPACE_ROOT);
    const duration = Date.now() - startTime;
    
    console.log('✅ Extraction successful');
    console.log(`   Duration: ${duration}ms`);
    console.log();

    // Step 3: Display results
    console.log('='.repeat(80));
    console.log('Results:');
    console.log('='.repeat(80));
    console.log();
    
    console.log('Target File:');
    console.log('  ', gitDelta.targetFile);
    console.log();
    
    console.log('Target Package:');
    console.log('  ', gitDelta.targetPackage);
    console.log();
    
    console.log('Changed Methods:');
    if (gitDelta.changedMethods.length === 0) {
      console.log('   (none detected)');
    } else {
      gitDelta.changedMethods.forEach(method => {
        console.log('  -', method);
      });
    }
    console.log();
    
    console.log('Git Diff (first 500 chars):');
    console.log('---');
    console.log(gitDelta.gitDiff.substring(0, 500));
    if (gitDelta.gitDiff.length > 500) {
      console.log('...(truncated)');
    }
    console.log('---');
    console.log();
    
    console.log('Full Output (JSON):');
    console.log(JSON.stringify(gitDelta, null, 2));
    console.log();
    
    console.log('='.repeat(80));
    console.log('✅ Test completed successfully!');
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('❌ Extraction failed:', error.message);
    console.error();
    console.error('Stack trace:');
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
runTest().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});

// Made with Bob

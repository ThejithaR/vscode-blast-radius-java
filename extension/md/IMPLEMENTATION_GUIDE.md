# 🎯 Blast Radius Extension - Complete Implementation Guide

## 📋 Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [File Structure & Responsibilities](#file-structure--responsibilities)
4. [Data Flow](#data-flow)
5. [Input/Output Formats](#inputoutput-formats)
6. [Detailed Component Analysis](#detailed-component-analysis)
7. [Execution Flow](#execution-flow)
8. [Error Handling](#error-handling)

---

## Overview

The **Blast Radius Extension** is a VS Code extension that analyzes the impact of Java code changes by:
1. Detecting git changes in the active file
2. Finding all downstream dependencies using AST analysis
3. Using AI to assess semantic risk
4. Generating a visual markdown report

**Key Principle**: The extension acts as an **orchestrator** that coordinates 4 independent components through strict JSON contracts.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    VS Code Extension Host                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              extension.ts (Entry Point)                 │ │
│  │  - Registers command: "blastRadius.map"                │ │
│  │  - Activates on command execution                      │ │
│  └────────────────┬───────────────────────────────────────┘ │
│                   │                                          │
│  ┌────────────────▼───────────────────────────────────────┐ │
│  │           pipeline.ts (Orchestrator)                    │ │
│  │  - Coordinates 5-step analysis pipeline                │ │
│  │  - Manages data flow between components                │ │
│  └────┬────────┬────────┬────────┬─────────────────────────┘ │
│       │        │        │        │                           │
│  ┌────▼────┐ ┌▼─────┐ ┌▼──────┐ ┌▼────────┐                │
│  │Git Eng. │ │AST   │ │AI Orch│ │Visualiz.│                │
│  │Service  │ │Service│ │Service│ │Service  │                │
│  └─────────┘ └──────┘ └───────┘ └─────────┘                │
└─────────────────────────────────────────────────────────────┘
```

---

## File Structure & Responsibilities

### 📁 Core Files

#### **extension.ts** - Extension Entry Point
- **Purpose**: VS Code extension lifecycle management
- **Responsibilities**:
  - Registers the `blastRadius.map` command
  - Validates active editor exists
  - Triggers the pipeline
  - Handles top-level errors
- **Input**: User command from Command Palette
- **Output**: Calls `runPipeline(filePath)`

#### **orchestrator/pipeline.ts** - Main Orchestrator
- **Purpose**: Coordinates the entire analysis pipeline
- **Responsibilities**:
  - Executes 5 sequential steps
  - Manages data flow between services
  - Writes intermediate outputs to temp/
  - Generates final report
  - Opens markdown preview
- **Input**: Target file path (string)
- **Output**: Markdown report in reports/

#### **orchestrator/contractAssembler.ts** - Data Merger
- **Purpose**: Merges Git and AST outputs into Contract A
- **Responsibilities**:
  - Combines GitDeltaOutput + AstDependenciesOutput
  - Validates merged data structure
  - Adds metadata (timestamp, version)
- **Input**: GitDeltaOutput, AstDependenciesOutput
- **Output**: ContractA

### 📁 Services Layer

#### **services/gitEngineService.ts** - Git Analysis
- **Purpose**: Extract git changes from target file
- **Responsibilities**:
  - Validates file exists
  - Executes git-engine CLI (Node.js)
  - Parses JSON output
  - Falls back to example data if git-engine not built
- **Input**: File path (string)
- **Output**: GitDeltaOutput
  ```typescript
  {
    targetFile: string,
    gitDiff: string,
    changedMethods: Array<{
      methodName: string,
      startLine: number,
      endLine: number
    }>
  }
  ```

#### **services/astEngineService.ts** - AST Analysis
- **Purpose**: Find downstream dependencies using JavaParser
- **Responsibilities**:
  - Spawns Java JAR process
  - Writes input JSON to temp/
  - Reads output JSON from temp/
  - Validates dependency structure
  - Falls back to example data if JAR not built
- **Input**: GitDeltaOutput
- **Output**: AstDependenciesOutput
  ```typescript
  {
    dependencies: Array<{
      sourceFile: string,
      sourceLine: number,
      sourceSymbol: string,
      targetFile: string,
      targetSymbol: string,
      dependencyType: string,
      context?: string
    }>,
    metadata: {
      projectRoot: string,
      analyzedFiles: number,
      timestamp: string
    }
  }
  ```

#### **services/aiService.ts** - AI Risk Analysis
- **Purpose**: Analyze semantic risk using AI orchestrator
- **Responsibilities**:
  - Executes ai-orchestrator CLI (Node.js)
  - Writes Contract A to temp/
  - Reads Contract B from temp/
  - Checks for API key (ANTHROPIC_API_KEY or BOB_API_KEY)
  - Falls back to example data if no API key or not built
- **Input**: ContractA
- **Output**: ContractB
  ```typescript
  {
    metadata: { timestamp, targetFile, analysisVersion },
    nodes: Array<{
      id: string,
      label: string,
      type: string,
      file: string,
      line?: number,
      riskLevel: "critical" | "high" | "medium" | "low",
      riskScore: number,
      reasons: string[]
    }>,
    edges: Array<{
      source: string,
      target: string,
      type: string,
      label?: string
    }>,
    summary: {
      totalNodes: number,
      totalEdges: number,
      riskDistribution: { critical, high, medium, low },
      overallRisk: string,
      keyFindings: string[]
    }
  }
  ```

#### **services/visualizerService.ts** - Report Generation
- **Purpose**: Convert Contract B to markdown report
- **Responsibilities**:
  - Generates formatted markdown with emojis
  - Creates risk distribution table
  - Groups nodes by risk level
  - Generates Mermaid diagram
  - Applies color styling
- **Input**: ContractB
- **Output**: Markdown string

### 📁 Utilities

#### **utils/logger.ts** - Logging System
- **Purpose**: Centralized logging to VS Code Output Channel
- **Methods**:
  - `info(message)` - General information
  - `success(message)` - Success with ✓
  - `error(message, error?)` - Errors with ✗
  - `warn(message)` - Warnings with ⚠
  - `show()` - Display output channel
  - `clear()` - Clear output channel

#### **utils/fileManager.ts** - File Operations
- **Purpose**: File system operations with error handling
- **Methods**:
  - `ensureDirectories()` - Create temp/ and reports/
  - `writeJson(path, data)` - Write JSON with formatting
  - `readJson(path)` - Read and parse JSON
  - `writeMarkdown(path, content)` - Write markdown files
  - `fileExists(path)` - Check file existence
  - `deleteFile(path)` - Delete file safely

### 📁 Contracts (Type Definitions)

#### **contracts/contractA.ts**
```typescript
interface ContractA {
  targetFile: string;
  gitDiff: string;
  dependencies: any[];
}
```

---

## Data Flow

### Step-by-Step Pipeline Execution

```
User Action (Cmd+Shift+P → "Blast Radius: Map")
    ↓
extension.ts: activate() → registerCommand()
    ↓
extension.ts: Get active editor file path
    ↓
pipeline.ts: runPipeline(filePath)
    ↓
┌───────────────────────────────────────────────────────────┐
│ STEP 1: Git Engine                                        │
│ gitEngineService.getGitDelta(targetFile)                  │
│   → Executes: node git-engine/dist/index.js <file>       │
│   → Output: temp/git-output.json (GitDeltaOutput)        │
└───────────────────────────────────────────────────────────┘
    ↓
┌───────────────────────────────────────────────────────────┐
│ STEP 2: AST Engine                                        │
│ astEngineService.runAstEngine(gitOutput)                  │
│   → Writes: temp/ast-input.json                          │
│   → Executes: java -jar ast-engine.jar input output      │
│   → Reads: temp/ast-dependencies-output.json             │
│   → Output: temp/ast-output.json (AstDependenciesOutput) │
└───────────────────────────────────────────────────────────┘
    ↓
┌───────────────────────────────────────────────────────────┐
│ STEP 3: Contract Assembly                                 │
│ contractAssembler.assembleContractA(gitOutput, astOutput) │
│   → Merges both outputs                                   │
│   → Adds metadata                                         │
│   → Output: temp/contract-a.json (ContractA)             │
└───────────────────────────────────────────────────────────┘
    ↓
┌───────────────────────────────────────────────────────────┐
│ STEP 4: AI Analysis                                       │
│ aiService.analyzeRisk(contractA)                          │
│   → Writes: temp/contract-a.json                         │
│   → Executes: node ai-orchestrator/dist/index.js         │
│   → Reads: temp/contract-b.json                          │
│   → Output: temp/contract-b.json (ContractB)             │
└───────────────────────────────────────────────────────────┘
    ↓
┌───────────────────────────────────────────────────────────┐
│ STEP 5: Visualization                                     │
│ visualizerService.generateMarkdown(contractB)            │
│   → Generates formatted markdown                          │
│   → Creates Mermaid diagram                               │
│   → Output: reports/blast-radius-report.md               │
└───────────────────────────────────────────────────────────┘
    ↓
pipeline.ts: Open markdown preview
    ↓
VS Code: Display report to user
```

---

## Input/Output Formats

### 🔹 GitDeltaOutput (Git Engine → Extension)
```json
{
  "targetFile": "src/main/java/com/example/TokenValidator.java",
  "gitDiff": "@@ -15,7 +15,7 @@\n-    timeout = 5000;\n+    timeout = 50;\n",
  "changedMethods": [
    {
      "methodName": "verifyTokenStructure",
      "startLine": 15,
      "endLine": 30
    }
  ]
}
```

### 🔹 AstDependenciesOutput (AST Engine → Extension)
```json
{
  "dependencies": [
    {
      "sourceFile": "src/main/java/com/example/AuthService.java",
      "sourceLine": 42,
      "sourceSymbol": "authenticate",
      "targetFile": "src/main/java/com/example/TokenValidator.java",
      "targetSymbol": "verifyTokenStructure",
      "dependencyType": "METHOD_CALL",
      "context": "boolean isValid = validator.verifyTokenStructure(token);"
    }
  ],
  "metadata": {
    "projectRoot": "/workspace",
    "analyzedFiles": 150,
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### 🔹 ContractA (Extension → AI Orchestrator)
```json
{
  "metadata": {
    "timestamp": "2024-01-15T10:30:00Z",
    "targetFile": "src/main/java/com/example/TokenValidator.java",
    "analysisVersion": "1.0.0"
  },
  "targetFile": "src/main/java/com/example/TokenValidator.java",
  "gitDiff": "@@ -15,7 +15,7 @@\n-    timeout = 5000;\n+    timeout = 50;\n",
  "changedMethods": [
    {
      "methodName": "verifyTokenStructure",
      "startLine": 15,
      "endLine": 30
    }
  ],
  "dependencies": [
    {
      "sourceFile": "src/main/java/com/example/AuthService.java",
      "sourceLine": 42,
      "sourceSymbol": "authenticate",
      "targetFile": "src/main/java/com/example/TokenValidator.java",
      "targetSymbol": "verifyTokenStructure",
      "dependencyType": "METHOD_CALL",
      "context": "boolean isValid = validator.verifyTokenStructure(token);"
    }
  ]
}
```

### 🔹 ContractB (AI Orchestrator → Extension → Visualizer)
```json
{
  "metadata": {
    "timestamp": "2024-01-15T10:35:00Z",
    "targetFile": "src/main/java/com/example/TokenValidator.java",
    "analysisVersion": "1.0.0"
  },
  "nodes": [
    {
      "id": "node_1",
      "label": "TokenValidator.verifyTokenStructure",
      "type": "TARGET",
      "file": "src/main/java/com/example/TokenValidator.java",
      "line": 15,
      "riskLevel": "critical",
      "riskScore": 95,
      "reasons": [
        "Timeout reduced from 5000ms to 50ms - likely to cause timeouts",
        "Critical authentication path affected"
      ]
    },
    {
      "id": "node_2",
      "label": "AuthService.authenticate",
      "type": "CALLER",
      "file": "src/main/java/com/example/AuthService.java",
      "line": 42,
      "riskLevel": "high",
      "riskScore": 85,
      "reasons": [
        "Directly calls modified method in authentication flow",
        "May fail with timeout exceptions"
      ]
    }
  ],
  "edges": [
    {
      "source": "node_2",
      "target": "node_1",
      "type": "METHOD_CALL",
      "label": "calls"
    }
  ],
  "summary": {
    "totalNodes": 2,
    "totalEdges": 1,
    "riskDistribution": {
      "critical": 1,
      "high": 1,
      "medium": 0,
      "low": 0
    },
    "overallRisk": "CRITICAL",
    "keyFindings": [
      "Timeout reduction affects critical authentication path",
      "1 critical and 1 high-risk components identified",
      "Recommend reverting timeout change or updating all callers"
    ]
  }
}
```

---

## Detailed Component Analysis

### 🔧 extension.ts - Lifecycle Management

**Activation Flow:**
```typescript
1. VS Code loads extension
2. activate(context) called
3. Register command "blastRadius.map"
4. Add to context.subscriptions for cleanup
```

**Command Execution:**
```typescript
1. User triggers command
2. Check if editor exists → Error if not
3. Get file path from editor.document.uri.fsPath
4. Call runPipeline(filePath)
5. Catch and display errors
```

**Deactivation:**
```typescript
1. deactivate() called on extension unload
2. Cleanup subscriptions automatically
```

### 🔧 pipeline.ts - Orchestration Logic

**Key Features:**
- Sequential execution (each step waits for previous)
- Comprehensive logging at each step
- Intermediate file persistence (temp/ directory)
- Execution time tracking
- Automatic markdown preview opening

**Error Handling:**
- Try-catch around entire pipeline
- Logs errors with stack traces
- Shows user-friendly error messages
- Calculates duration even on failure

**Output Management:**
```
temp/
  ├── git-output.json       (Step 1 output)
  ├── ast-input.json        (Step 2 input)
  ├── ast-output.json       (Step 2 output)
  ├── contract-a.json       (Step 3 output)
  └── contract-b.json       (Step 4 output)

reports/
  └── blast-radius-report.md (Step 5 output)
```

### 🔧 Service Layer - External Process Management

**Common Pattern:**
```typescript
1. Validate input
2. Check if external tool exists
3. If not exists → Use example data (development mode)
4. Execute external process (spawn/exec)
5. Parse output
6. Validate output structure
7. Return typed result
8. On error → Try fallback to example data
```

**Process Execution:**
- **Git Engine**: `node git-engine/dist/index.js <file>`
- **AST Engine**: `java -jar ast-engine.jar <input> <output>`
- **AI Orchestrator**: `node ai-orchestrator/dist/index.js <input> <output>`

**Timeouts:**
- Git Engine: 30 seconds
- AST Engine: 2 minutes (120 seconds)
- AI Orchestrator: 5 minutes (300 seconds)

**Buffer Sizes:**
- Git Engine: 10MB
- AST Engine: 20MB
- AI Orchestrator: 20MB

---

## Execution Flow

### Normal Flow (All Components Built)

```
1. User: Cmd+Shift+P → "Blast Radius: Map"
2. Extension: Validate editor, get file path
3. Pipeline: Start timer, show output channel
4. Git Service: Execute git-engine → GitDeltaOutput
5. AST Service: Execute ast-engine → AstDependenciesOutput
6. Assembler: Merge → ContractA
7. AI Service: Execute ai-orchestrator → ContractB
8. Visualizer: Generate markdown
9. Pipeline: Open preview, show success message
10. User: View report in markdown preview
```

### Development Flow (Using Example Data)

```
1. User: Cmd+Shift+P → "Blast Radius: Map"
2. Extension: Validate editor, get file path
3. Pipeline: Start timer, show output channel
4. Git Service: git-engine not found → Load examples/git-output.json
5. AST Service: JAR not found → Load examples/ast-output.json
6. Assembler: Merge example data → ContractA
7. AI Service: No API key → Load examples/contract-b.json
8. Visualizer: Generate markdown from example
9. Pipeline: Open preview, show success message
10. User: View example report
```

### Error Flow

```
1. User: Cmd+Shift+P → "Blast Radius: Map"
2. Extension: No active editor → Show error, abort
   OR
3. Pipeline: Git service fails → Log error, show message, abort
   OR
4. Pipeline: AST service fails → Log error, show message, abort
   OR
5. Pipeline: AI service fails → Log error, show message, abort
   OR
6. Pipeline: Visualizer fails → Log error, show message, abort
```

---

## Error Handling

### Error Handling Strategy

**Layered Error Handling:**
```
Level 1: Service Layer
  - Validates inputs
  - Catches process execution errors
  - Falls back to example data
  - Throws descriptive errors

Level 2: Pipeline Layer
  - Catches service errors
  - Logs to output channel
  - Shows user notifications
  - Calculates execution time

Level 3: Extension Layer
  - Catches pipeline errors
  - Shows error messages
  - Prevents extension crash
```

### Common Error Scenarios

| Error | Detection | Handling |
|-------|-----------|----------|
| No active editor | extension.ts | Show error message, abort |
| File doesn't exist | gitEngineService | Throw error with file path |
| Git engine not built | gitEngineService | Warn, use example data |
| AST JAR not built | astEngineService | Warn, use example data |
| AI orchestrator not built | aiService | Warn, use example data |
| No API key | aiService | Warn, use example data |
| Process timeout | All services | Throw timeout error |
| Invalid JSON output | All services | Throw parse error |
| Missing required fields | All services | Throw validation error |
| Markdown generation fails | visualizerService | Throw with details |

### Logging Levels

```typescript
logger.info()    // General progress updates
logger.success() // Step completion (with ✓)
logger.warn()    // Non-fatal issues (with ⚠)
logger.error()   // Failures (with ✗ and stack trace)
```

---

## Development Tips

### Running the Extension

1. **Open in VS Code**: Open the project root
2. **Press F5**: Launches Extension Development Host
3. **Open Java Project**: In the new window
4. **Open Java File**: Any .java file
5. **Run Command**: Cmd+Shift+P → "Blast Radius: Map"

### Debugging

- **Output Channel**: View → Output → "Blast Radius"
- **Breakpoints**: Set in any .ts file
- **Console**: Debug Console shows extension logs
- **Temp Files**: Check temp/ directory for intermediate outputs

### Testing Without External Components

The extension automatically falls back to example data when:
- git-engine/dist/index.js doesn't exist
- ast-engine JAR doesn't exist
- No API key is configured

This allows testing the extension flow without building all components.

### Building for Production

```bash
# Build all components
./scripts/setup.sh

# Package extension
cd extension
npm run package
# Creates: blast-radius-mapper-0.0.1.vsix
```

---

## Summary

The extension is a **well-structured orchestrator** that:

✅ **Separates concerns** - Each service handles one external component  
✅ **Validates data** - At every step of the pipeline  
✅ **Handles errors gracefully** - With fallbacks and clear messages  
✅ **Logs comprehensively** - For debugging and monitoring  
✅ **Supports development** - With example data fallbacks  
✅ **Follows contracts** - Strict JSON schemas between components  
✅ **Manages state** - Through file system (temp/ directory)  
✅ **Provides feedback** - Through VS Code UI and output channel  

The architecture enables **independent development** of each component while maintaining **integration readiness** through well-defined contracts.
# Running the Blast Radius Extension

## Prerequisites

1. **VSCode** installed
2. **Node.js** and **npm** installed
3. **Java** and **Maven** installed (for AST engine)
4. **Git** repository with uncommitted changes

## Build Steps

### 1. Build All Components

```bash
# From project root
npm install

# Build git-engine
npm run build --workspace=git-engine

# Build AST engine (Java)
cd ast-engine
mvn clean package
cd ..

# Build AI orchestrator
npm run build --workspace=ai-orchestrator

# Build extension
npm run build --workspace=extension
```

### 2. Set Environment Variables (Optional)

For full AI analysis functionality:

```bash
# Windows PowerShell
$env:ANTHROPIC_API_KEY="your-api-key-here"

# Windows CMD
set ANTHROPIC_API_KEY=your-api-key-here

# Linux/Mac
export ANTHROPIC_API_KEY="your-api-key-here"
```

## Running the Extension

### Method 1: Debug Mode (Recommended for Testing)

1. Open this project in VSCode
2. Press `F5` or go to **Run > Start Debugging**
3. This will open a new "Extension Development Host" window
4. In the new window, open a Java project
5. Open a Java file in the editor
6. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
7. Type "Blast Radius: Map" and press Enter
8. The analysis will run and show a markdown report

### Method 2: Install as VSIX

```bash
# Package the extension
cd extension
npm run package

# This creates: blast-radius-mapper-0.0.1.vsix
```

Then in VSCode:
1. Go to Extensions view (`Ctrl+Shift+X`)
2. Click the `...` menu at the top
3. Select "Install from VSIX..."
4. Choose the generated `.vsix` file

## What Happens When You Run It

1. **Git Analysis**: Extracts changes from the active file
2. **AST Analysis**: Analyzes Java dependencies using JavaParser
3. **Contract Assembly**: Combines git and AST data
4. **AI Analysis**: Generates risk assessment (if API key available)
5. **Report Generation**: Creates markdown report with:
   - Risk distribution
   - Impacted components
   - Dependency graph (Mermaid diagram)
   - Detailed findings

## Output Locations

- **Logs**: VSCode Output panel (select "Blast Radius")
- **Temp Files**: `./temp/` directory
  - `git-output.json`
  - `ast-output.json`
  - `contract-a.json`
  - `contract-b.json`
- **Report**: `./reports/blast-radius-report.md`

## Troubleshooting

### Extension Won't Activate
- Check VSCode Output panel for errors
- Ensure extension is built: `npm run build --workspace=extension`

### "No active editor found"
- Make sure you have a file open in the editor
- The file should be part of a workspace

### Git Engine Fails
- Ensure git-engine is built: `npm run build --workspace=git-engine`
- Check that you have uncommitted changes in git
- Falls back to example data if git-engine not found

### AST Engine Fails
- Ensure Java is installed: `java -version`
- Ensure Maven built the JAR: `ls ast-engine/target/*.jar`
- Falls back to example data if JAR not found

### AI Analysis Returns Empty
- Check if API key is set: `echo $ANTHROPIC_API_KEY`
- Falls back to example data if no API key

## Testing with Example Data

The extension will automatically fall back to example data if components are missing:
- `extension/src/examples/git-output.json`
- `extension/src/examples/ast-output.json`
- `extension/src/examples/contract-b.json`

This allows you to test the extension without building all components.

## Viewing Logs

1. Open VSCode Output panel: `View > Output`
2. Select "Blast Radius" from the dropdown
3. You'll see detailed logs with timestamps:
   ```
   [2024-01-01T12:00:00.000Z] [INFO] Starting Blast Radius Analysis Pipeline
   [2024-01-01T12:00:01.000Z] [SUCCESS] ✓ Git changes extracted: 3 methods changed
   ```

## Expected Behavior

### Success Case
1. Command executes
2. Progress shown in Output panel
3. Markdown report opens automatically
4. Success notification appears
5. Report shows in preview mode

### Fallback Case (Missing Components)
1. Warnings in Output panel
2. Falls back to example data
3. Report still generates
4. Shows example analysis results

## Next Steps

After running successfully:
1. Review the generated report
2. Check the temp files for intermediate data
3. Examine the logs for any warnings
4. Test with different Java files
5. Try with actual git changes vs example data

## Support

If issues persist:
1. Check `IMPROVEMENTS_SUMMARY.md` for known limitations
2. Review logs in Output panel
3. Verify all build steps completed successfully
4. Ensure prerequisites are installed
import { cpSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = join(packageRoot, 'src', 'bob', 'prompts');
const targetDirs = [
  join(packageRoot, 'dist', 'bob', 'prompts'),
  join(packageRoot, 'dist', 'ai-orchestrator', 'src', 'bob', 'prompts')
];

for (const targetDir of targetDirs) {
  mkdirSync(targetDir, { recursive: true });
  cpSync(sourceDir, targetDir, { recursive: true });
}

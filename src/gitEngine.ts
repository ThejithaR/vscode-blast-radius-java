import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function getGitDiff(targetFile: string, cwd: string): Promise<string> {
  const { stdout } = await execFileAsync('git', ['diff', '--unified=0', '--', targetFile], { cwd });
  return stdout;
}

export function extractModifiedLines(diffText: string): number[] {
  const modifiedLines = new Set<number>();
  const hunkRegex = /^@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,(\d+))?\s+@@/gm;

  let match: RegExpExecArray | null;
  while ((match = hunkRegex.exec(diffText)) !== null) {
    const start = Number(match[1]);
    const count = Number(match[2] ?? '1');

    for (let line = start; line < start + count; line += 1) {
      modifiedLines.add(line);
    }
  }

  return Array.from(modifiedLines).sort((a, b) => a - b);
}

import { runPipeline } from "../orchestrator/pipeline.js";

export async function analyzeCommand(file: string) {
  await runPipeline(file);
}
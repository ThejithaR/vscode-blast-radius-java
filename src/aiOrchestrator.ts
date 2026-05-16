import { z } from 'zod';
import type { ContractA, ContractB } from './contracts';

const contractBSchema = z.object({
  overallRiskScore: z.number().min(0).max(100),
  summary: z.string(),
  nodes: z.array(
    z.object({
      id: z.string(),
      label: z.string()
    })
  ),
  edges: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
      risk: z.string()
    })
  )
});

export async function evaluateBlastRadius(contractA: ContractA): Promise<ContractB> {
  const fallback: ContractB = {
    overallRiskScore: 20,
    summary: `Stub analysis for ${contractA.targetFile}`,
    nodes: [
      { id: 'changed', label: contractA.targetFile }
    ],
    edges: []
  };

  const parsed = contractBSchema.safeParse(fallback);
  if (!parsed.success) {
    throw new Error(`Invalid ContractB payload: ${parsed.error.message}`);
  }

  return parsed.data;
}

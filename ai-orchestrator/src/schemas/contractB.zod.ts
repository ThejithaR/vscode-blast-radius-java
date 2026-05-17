import { z } from 'zod';

/**
 * Zod schema for Contract B validation.
 * Mirrors shared/contracts/contract-b.schema.json
 * 
 * This schema validates IBM Bob's JSON output before it's consumed by the visualizer.
 * On validation failure, the self-healing loop uses the error details to guide Bob's correction.
 */

// Risk level enum - used for both nodes and overall score
export const RiskEnum = z.enum([
  'TARGET',
  'CRITICAL',
  'WARNING',
  'LOW_RISK',
  'SAFE'
]);

// Edge type enum - determines visual styling in the graph
export const EdgeTypeEnum = z.enum([
  'breaking-dependency',
  'warning-dependency',
  'safe-dependency'
]);

// Node schema - represents a file in the dependency graph
export const NodeSchema = z.object({
  id: z.string(),
  filePath: z.string(),
  packageName: z.string(),
  label: z.string(),
  risk: RiskEnum,
  reason: z.string()
});

// Edge schema - represents a dependency relationship
export const EdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  type: EdgeTypeEnum
});

// Complete Contract B schema
export const contractBSchema = z.object({
  targetFile: z.string(),
  targetPackage: z.string(),
  overallRiskScore: RiskEnum,
  summary: z.string(),
  nodes: z.array(NodeSchema),
  edges: z.array(EdgeSchema)
}).strict(); // Strict mode prevents additional properties

// Export inferred TypeScript types
export type Risk = z.infer<typeof RiskEnum>;
export type EdgeType = z.infer<typeof EdgeTypeEnum>;
export type Node = z.infer<typeof NodeSchema>;
export type Edge = z.infer<typeof EdgeSchema>;
export type ContractB = z.infer<typeof contractBSchema>;

// Made with Bob

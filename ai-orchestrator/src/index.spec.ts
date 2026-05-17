import { describe, it } from 'node:test';
import assert from 'node:assert';
import { contractBSchema } from './schemas/contractB.zod';
import { buildPrompt } from './bob/promptBuilder';
import { truncateContractA, estimateTokens, calculateTokenLimits } from './retry/tokenManager';
import type { ContractA } from '@blast-radius/shared';

/**
 * Unit tests for AI Orchestrator components.
 * 
 * Run with: npm test
 */

describe('AI Orchestrator', () => {
  describe('contractBSchema', () => {
    it('should validate the canonical Contract B example', () => {
      const example = require('../examples/contract-b.example.json');
      
      // Should not throw
      const result = contractBSchema.parse(example);
      
      assert.strictEqual(result.overallRiskScore, 'CRITICAL');
      assert.strictEqual(result.nodes.length, 4);
      assert.strictEqual(result.edges.length, 3);
    });

    it('should reject invalid risk enum values', () => {
      const invalid = {
        targetFile: 'test.java',
        targetPackage: 'com.test',
        overallRiskScore: 'INVALID_RISK',
        summary: 'Test',
        nodes: [],
        edges: []
      };

      assert.throws(() => {
        contractBSchema.parse(invalid);
      });
    });

    it('should reject missing required fields', () => {
      const invalid = {
        targetFile: 'test.java',
        // Missing targetPackage
        overallRiskScore: 'SAFE',
        summary: 'Test',
        nodes: [],
        edges: []
      };

      assert.throws(() => {
        contractBSchema.parse(invalid);
      });
    });
  });

  describe('buildPrompt', () => {
    it('should build prompts from Contract A', () => {
      const contractA: ContractA = {
        targetFile: 'test.java',
        targetPackage: 'com.test',
        gitDiff: 'diff content',
        dependencies: []
      };

      const prompts = buildPrompt(contractA);

      assert.ok(prompts.system.length > 0);
      assert.ok(prompts.system.includes('enterprise software risk evaluator'));
      assert.ok(prompts.system.includes('DiffIntentAnalysis'));
      assert.ok(prompts.system.includes('RiskClassification'));
      
      assert.ok(prompts.user.length > 0);
      assert.ok(prompts.user.includes('test.java'));
    });

    it('should concatenate all prompt files in order', () => {
      const contractA: ContractA = {
        targetFile: 'test.java',
        targetPackage: 'com.test',
        gitDiff: 'diff',
        dependencies: []
      };

      const prompts = buildPrompt(contractA);
      const system = prompts.system;

      // Check order: system -> diffIntent -> riskClassification -> reasonGeneration -> edgeTyping -> overallSummary
      const systemIndex = system.indexOf('enterprise software risk evaluator');
      const diffIndex = system.indexOf('SIGNATURE_CHANGE');
      const riskIndex = system.indexOf('TARGET — reserved for the modified file');
      const reasonIndex = system.indexOf('COMPILE BREAK:');
      const edgeIndex = system.indexOf('breaking-dependency');
      const summaryIndex = system.indexOf('overallRiskScore');

      assert.ok(systemIndex < diffIndex);
      assert.ok(diffIndex < riskIndex);
      assert.ok(riskIndex < reasonIndex);
      assert.ok(reasonIndex < edgeIndex);
      assert.ok(edgeIndex < summaryIndex);
    });
  });

  describe('tokenManager', () => {
    it('should estimate tokens correctly', () => {
      const text = 'This is a test string with approximately 10 words in it.';
      const tokens = estimateTokens(text);
      
      // Rough estimate: 1 token ≈ 4 chars
      assert.ok(tokens > 0);
      assert.ok(tokens < text.length); // Should be less than character count
    });

    it('should not truncate small Contract A', () => {
      const contractA: ContractA = {
        targetFile: 'test.java',
        targetPackage: 'com.test',
        gitDiff: 'small diff',
        dependencies: [
          {
            filePath: 'caller.java',
            packageName: 'com.test',
            importedSymbols: ['TestClass'],
            usageContextLine: 'TestClass.method();'
          }
        ]
      };

      const limits = {
        maxContextWindow: 8192,
        systemPromptTokens: 1500,
        reserveForResponse: 2048
      };

      const truncated = truncateContractA(contractA, limits);

      // Should be unchanged
      assert.strictEqual(truncated.dependencies[0].usageContextLine, 'TestClass.method();');
    });

    it('should truncate large usageContextLine', () => {
      const longLine = 'x'.repeat(10000); // Very long line
      
      const contractA: ContractA = {
        targetFile: 'test.java',
        targetPackage: 'com.test',
        gitDiff: 'diff',
        dependencies: [
          {
            filePath: 'caller.java',
            packageName: 'com.test',
            importedSymbols: ['TestClass'],
            usageContextLine: longLine
          }
        ]
      };

      const limits = {
        maxContextWindow: 1000, // Small limit to force truncation
        systemPromptTokens: 500,
        reserveForResponse: 200
      };

      const truncated = truncateContractA(contractA, limits);

      // Should be truncated
      assert.ok(truncated.dependencies[0].usageContextLine.length < longLine.length);
      assert.ok(truncated.dependencies[0].usageContextLine.endsWith('...'));
    });

    it('should never drop dependencies', () => {
      const contractA: ContractA = {
        targetFile: 'test.java',
        targetPackage: 'com.test',
        gitDiff: 'diff',
        dependencies: [
          { filePath: 'a.java', packageName: 'com.test', importedSymbols: [], usageContextLine: 'x'.repeat(5000) },
          { filePath: 'b.java', packageName: 'com.test', importedSymbols: [], usageContextLine: 'x'.repeat(5000) },
          { filePath: 'c.java', packageName: 'com.test', importedSymbols: [], usageContextLine: 'x'.repeat(5000) }
        ]
      };

      const limits = {
        maxContextWindow: 1000,
        systemPromptTokens: 500,
        reserveForResponse: 200
      };

      const truncated = truncateContractA(contractA, limits);

      // All dependencies should still be present
      assert.strictEqual(truncated.dependencies.length, 3);
    });

    it('should calculate token limits from system prompt', () => {
      const systemPrompt = 'x'.repeat(4000); // ~1000 tokens
      const limits = calculateTokenLimits(systemPrompt, 8192);

      assert.strictEqual(limits.maxContextWindow, 8192);
      assert.strictEqual(limits.systemPromptTokens, 1000);
      assert.strictEqual(limits.reserveForResponse, 2048);
    });
  });
});

// Made with Bob

/**
 * Rule Registry Tests
 * 
 * TDD: RED phase - Tests for Lint Rule Plugin system
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  RuleRegistry,
  createRule,
  type LintRule,
  type RuleContext,
  type RuleSeverity
} from '@/core/rule-registry.js';

describe('RuleRegistry', () => {
  let tempDir: string;

  beforeEach(() => {
    RuleRegistry.reset();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tsi-rules-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = RuleRegistry.getInstance();
      const instance2 = RuleRegistry.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should return new instance after reset', () => {
      const instance1 = RuleRegistry.getInstance();
      RuleRegistry.reset();
      const instance2 = RuleRegistry.getInstance();
      
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Built-in Rules', () => {
    it('should have built-in rules loaded by default', () => {
      const registry = RuleRegistry.getInstance();
      const rules = registry.getAllRules();
      
      expect(rules.length).toBeGreaterThan(0);
    });

    it('should have metadata/required rule', () => {
      const registry = RuleRegistry.getInstance();
      const rule = registry.getRule('metadata/required');
      
      expect(rule).toBeDefined();
      expect(rule?.name).toBe('metadata/required');
    });

    it('should have metadata/duplicate rule', () => {
      const registry = RuleRegistry.getInstance();
      const rule = registry.getRule('metadata/duplicate');
      
      expect(rule).toBeDefined();
    });

    it('should have metadata/stale-hash rule', () => {
      const registry = RuleRegistry.getInstance();
      const rule = registry.getRule('metadata/stale-hash');
      
      expect(rule).toBeDefined();
    });
  });

  describe('register()', () => {
    it('should register a custom rule', () => {
      const registry = RuleRegistry.getInstance();
      
      const customRule: LintRule = {
        name: 'custom/test-rule',
        description: 'A test rule',
        defaultSeverity: 'warn',
        validate: () => null
      };
      
      registry.register(customRule);
      
      const rule = registry.getRule('custom/test-rule');
      expect(rule).toBeDefined();
      expect(rule?.description).toBe('A test rule');
    });

    it('should allow overriding existing rules', () => {
      const registry = RuleRegistry.getInstance();
      
      const overrideRule: LintRule = {
        name: 'metadata/required',
        description: 'Overridden rule',
        defaultSeverity: 'error',
        validate: () => null
      };
      
      registry.register(overrideRule);
      
      const rule = registry.getRule('metadata/required');
      expect(rule?.description).toBe('Overridden rule');
    });

    it('should return the registry for chaining', () => {
      const registry = RuleRegistry.getInstance();
      
      const result = registry.register({
        name: 'custom/chain-test',
        description: 'Test',
        defaultSeverity: 'warn',
        validate: () => null
      });
      
      expect(result).toBe(registry);
    });
  });

  describe('unregister()', () => {
    it('should remove a registered rule', () => {
      const registry = RuleRegistry.getInstance();
      
      registry.register({
        name: 'custom/to-remove',
        description: 'Will be removed',
        defaultSeverity: 'warn',
        validate: () => null
      });
      
      expect(registry.getRule('custom/to-remove')).toBeDefined();
      
      registry.unregister('custom/to-remove');
      
      expect(registry.getRule('custom/to-remove')).toBeUndefined();
    });

    it('should not throw when removing non-existent rule', () => {
      const registry = RuleRegistry.getInstance();
      
      expect(() => registry.unregister('non-existent')).not.toThrow();
    });
  });

  describe('runRule()', () => {
    it('should run a rule and return result', () => {
      const registry = RuleRegistry.getInstance();
      
      registry.register({
        name: 'custom/always-error',
        description: 'Always returns error',
        defaultSeverity: 'error',
        validate: () => ({
          rule: 'custom/always-error',
          message: 'This always fails',
          fixable: false
        })
      });
      
      const context: RuleContext = {
        filepath: '/test/file.ts',
        content: 'const x = 1;',
        config: {} as any
      };
      
      const result = registry.runRule('custom/always-error', context);
      
      expect(result).not.toBeNull();
      expect(result?.message).toBe('This always fails');
    });

    it('should return null when rule passes', () => {
      const registry = RuleRegistry.getInstance();
      
      registry.register({
        name: 'custom/always-pass',
        description: 'Always passes',
        defaultSeverity: 'warn',
        validate: () => null
      });
      
      const context: RuleContext = {
        filepath: '/test/file.ts',
        content: 'const x = 1;',
        config: {} as any
      };
      
      const result = registry.runRule('custom/always-pass', context);
      
      expect(result).toBeNull();
    });

    it('should throw for non-existent rule', () => {
      const registry = RuleRegistry.getInstance();
      
      const context: RuleContext = {
        filepath: '/test/file.ts',
        content: 'const x = 1;',
        config: {} as any
      };
      
      expect(() => registry.runRule('non-existent', context)).toThrow('Rule not found');
    });
  });

  describe('runAllRules()', () => {
    it('should run all registered rules', () => {
      const registry = RuleRegistry.getInstance();
      
      // Add some test rules
      registry.register({
        name: 'test/rule-1',
        description: 'Test rule 1',
        defaultSeverity: 'error',
        validate: () => ({ rule: 'test/rule-1', message: 'Error 1', fixable: false })
      });
      
      registry.register({
        name: 'test/rule-2',
        description: 'Test rule 2',
        defaultSeverity: 'warn',
        validate: () => null // passes
      });
      
      const context: RuleContext = {
        filepath: '/test/file.ts',
        content: 'const x = 1;',
        config: {} as any
      };
      
      const results = registry.runAllRules(context);
      
      // Should have results from rules that returned issues
      expect(Array.isArray(results)).toBe(true);
    });

    it('should respect rule severity configuration', () => {
      const registry = RuleRegistry.getInstance();
      
      registry.register({
        name: 'test/configurable',
        description: 'Configurable rule',
        defaultSeverity: 'warn',
        validate: () => ({ rule: 'test/configurable', message: 'Issue', fixable: false })
      });
      
      const context: RuleContext = {
        filepath: '/test/file.ts',
        content: 'const x = 1;',
        config: {
          rules: {
            'test/configurable': 'off'
          }
        } as any
      };
      
      const results = registry.runAllRules(context);
      
      // Should not include results from disabled rules
      const testResult = results.find(r => r.rule === 'test/configurable');
      expect(testResult).toBeUndefined();
    });
  });

  describe('createRule helper', () => {
    it('should create a valid rule object', () => {
      const rule = createRule({
        name: 'helper/test',
        description: 'Created with helper',
        validate: (ctx) => {
          if (!ctx.content.includes('export')) {
            return {
              rule: 'helper/test',
              message: 'No exports found',
              fixable: false
            };
          }
          return null;
        }
      });
      
      expect(rule.name).toBe('helper/test');
      expect(rule.defaultSeverity).toBe('error'); // default
      expect(rule.validate).toBeDefined();
    });

    it('should allow custom default severity', () => {
      const rule = createRule({
        name: 'helper/warn-test',
        description: 'Warning rule',
        defaultSeverity: 'warn',
        validate: () => null
      });
      
      expect(rule.defaultSeverity).toBe('warn');
    });
  });

  describe('loadRulesFromFile()', () => {
    it('should load rules from a JavaScript file', async () => {
      // Create a rules file
      const rulesFile = path.join(tempDir, 'custom-rules.js');
      fs.writeFileSync(rulesFile, `
        module.exports = {
          rules: [
            {
              name: 'loaded/from-file',
              description: 'Loaded from file',
              defaultSeverity: 'warn',
              validate: () => null
            }
          ]
        };
      `);
      
      const registry = RuleRegistry.getInstance();
      await registry.loadRulesFromFile(rulesFile);
      
      const rule = registry.getRule('loaded/from-file');
      expect(rule).toBeDefined();
      expect(rule?.description).toBe('Loaded from file');
    });

    it('should throw for invalid rules file', async () => {
      const invalidFile = path.join(tempDir, 'invalid.js');
      fs.writeFileSync(invalidFile, 'not valid module');
      
      const registry = RuleRegistry.getInstance();
      
      await expect(registry.loadRulesFromFile(invalidFile)).rejects.toThrow();
    });

    it('should throw for non-existent file', async () => {
      const registry = RuleRegistry.getInstance();
      
      await expect(
        registry.loadRulesFromFile('/non/existent/file.js')
      ).rejects.toThrow('Rules file not found');
    });
  });

  describe('getRuleNames()', () => {
    it('should return array of rule names', () => {
      const registry = RuleRegistry.getInstance();
      const names = registry.getRuleNames();
      
      expect(Array.isArray(names)).toBe(true);
      expect(names).toContain('metadata/required');
    });
  });

  describe('getRulesByCategory()', () => {
    it('should return rules filtered by category prefix', () => {
      const registry = RuleRegistry.getInstance();
      
      registry.register({
        name: 'custom/rule-a',
        description: 'Custom A',
        defaultSeverity: 'warn',
        validate: () => null
      });
      
      registry.register({
        name: 'custom/rule-b',
        description: 'Custom B',
        defaultSeverity: 'warn',
        validate: () => null
      });
      
      const customRules = registry.getRulesByCategory('custom');
      
      expect(customRules.length).toBe(2);
      expect(customRules.every(r => r.name.startsWith('custom/'))).toBe(true);
    });

    it('should return empty array for unknown category', () => {
      const registry = RuleRegistry.getInstance();
      const rules = registry.getRulesByCategory('unknown-category');
      
      expect(rules).toEqual([]);
    });
  });
});


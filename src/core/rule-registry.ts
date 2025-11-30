/**
 * Rule Registry
 * 
 * Plugin system for lint rules. Allows registration of custom rules
 * and provides a centralized way to manage and run validation rules.
 * 
 * Features:
 * - Singleton pattern with reset for testing
 * - Built-in rules loaded by default
 * - Custom rule registration
 * - Rule loading from external files
 * - Category-based rule filtering
 */

import fs from 'fs';
import path from 'path';
import type { IntrospectConfig } from '../types/config.js';
import { generateContentHashFromString, extractStoredHashFromString } from './hasher.js';
import { analyzeDependencies } from './analyzer.js';

// ============================================
// Types
// ============================================

/**
 * Severity level for lint rules
 */
export type RuleSeverity = 'error' | 'warn' | 'off';

/**
 * Result returned when a rule finds an issue
 */
export interface RuleResult {
  rule: string;
  message: string;
  fixable: boolean;
}

/**
 * Context passed to rule validation functions
 */
export interface RuleContext {
  filepath: string;
  content: string;
  config: IntrospectConfig;
}

/**
 * Lint rule definition
 */
export interface LintRule {
  /** Unique rule name (e.g., 'metadata/required') */
  name: string;
  /** Human-readable description */
  description: string;
  /** Default severity when not configured */
  defaultSeverity: RuleSeverity;
  /** Validation function */
  validate: (context: RuleContext) => RuleResult | null;
  /** Optional: whether this rule's issues are auto-fixable */
  fixable?: boolean;
  /** Optional: documentation URL */
  docs?: string;
}

/**
 * Options for creating a rule
 */
export interface CreateRuleOptions {
  name: string;
  description: string;
  defaultSeverity?: RuleSeverity;
  validate: (context: RuleContext) => RuleResult | null;
  fixable?: boolean;
  docs?: string;
}

/**
 * Structure for rules file export
 */
export interface RulesFileExport {
  rules: LintRule[];
}

// ============================================
// Rule Registry
// ============================================

/**
 * Centralized registry for lint rules.
 * 
 * @example
 * ```typescript
 * const registry = RuleRegistry.getInstance();
 * 
 * // Register custom rule
 * registry.register({
 *   name: 'custom/no-console',
 *   description: 'Disallow console statements',
 *   defaultSeverity: 'warn',
 *   validate: (ctx) => {
 *     if (ctx.content.includes('console.')) {
 *       return { rule: 'custom/no-console', message: 'Found console statement', fixable: false };
 *     }
 *     return null;
 *   }
 * });
 * 
 * // Run rules
 * const results = registry.runAllRules({ filepath: 'test.ts', content: '...', config: cfg });
 * ```
 */
export class RuleRegistry {
  private static instance: RuleRegistry | null = null;
  private rules = new Map<string, LintRule>();

  private constructor() {
    this.loadBuiltinRules();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): RuleRegistry {
    this.instance ??= new RuleRegistry();
    return this.instance;
  }

  /**
   * Reset singleton (for testing)
   */
  static reset(): void {
    this.instance = null;
  }

  /**
   * Register a lint rule
   * @returns this for chaining
   */
  register(rule: LintRule): this {
    this.rules.set(rule.name, rule);
    return this;
  }

  /**
   * Unregister a lint rule
   */
  unregister(name: string): void {
    this.rules.delete(name);
  }

  /**
   * Get a rule by name
   */
  getRule(name: string): LintRule | undefined {
    return this.rules.get(name);
  }

  /**
   * Get all registered rules
   */
  getAllRules(): LintRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get rule names
   */
  getRuleNames(): string[] {
    return Array.from(this.rules.keys());
  }

  /**
   * Get rules by category (prefix)
   * @param category - Category prefix (e.g., 'metadata', 'custom')
   */
  getRulesByCategory(category: string): LintRule[] {
    return this.getAllRules().filter(rule => 
      rule.name.startsWith(`${category}/`)
    );
  }

  /**
   * Run a specific rule
   * @throws Error if rule not found
   */
  runRule(name: string, context: RuleContext): RuleResult | null {
    const rule = this.rules.get(name);
    if (!rule) {
      throw new Error(`Rule not found: ${name}`);
    }
    return rule.validate(context);
  }

  /**
   * Run all registered rules
   * @returns Array of rule results (issues found)
   */
  runAllRules(context: RuleContext): RuleResult[] {
    const results: RuleResult[] = [];

    for (const rule of this.rules.values()) {
      // Check if rule is disabled in config
      const configRules = context.config?.rules as unknown as Record<string, RuleSeverity> | undefined;
      const severity = configRules?.[rule.name] ?? rule.defaultSeverity;
      
      if (severity === 'off') {
        continue;
      }

      const result = rule.validate(context);
      if (result) {
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Load rules from an external file
   * @param filepath - Path to rules file (JS/TS module)
   */
  async loadRulesFromFile(filepath: string): Promise<void> {
    const resolvedPath = path.resolve(filepath);
    
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Rules file not found: ${resolvedPath}`);
    }

    try {
      // Use require for CommonJS modules
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const module = require(resolvedPath) as RulesFileExport;
      
      if (!module.rules || !Array.isArray(module.rules)) {
        throw new Error('Rules file must export { rules: LintRule[] }');
      }

      for (const rule of module.rules) {
        this.register(rule);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Rules file not found')) {
        throw error;
      }
      throw new Error(`Failed to load rules from ${filepath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Load built-in rules
   */
  private loadBuiltinRules(): void {
    // metadata/required - Missing metadata export
    this.register({
      name: 'metadata/required',
      description: 'Require __metadata export in files',
      defaultSeverity: 'error',
      fixable: true,
      validate: (ctx) => {
        if (!ctx.content.includes('export const __metadata')) {
          return {
            rule: 'metadata/required',
            message: 'Missing __metadata export',
            fixable: true
          };
        }
        return null;
      }
    });

    // metadata/duplicate - Multiple metadata blocks
    this.register({
      name: 'metadata/duplicate',
      description: 'Detect duplicate __metadata blocks',
      defaultSeverity: 'error',
      fixable: true,
      validate: (ctx) => {
        const matches = ctx.content.match(/export const __metadata/g);
        const count = matches ? matches.length : 0;
        
        if (count > 1) {
          return {
            rule: 'metadata/duplicate',
            message: `Found ${count} duplicate __metadata blocks. Run 'generate --overwrite' to fix.`,
            fixable: true
          };
        }
        return null;
      }
    });

    // metadata/stale-hash - Content changed but hash not updated
    this.register({
      name: 'metadata/stale-hash',
      description: 'Detect stale content hash',
      defaultSeverity: 'error',
      fixable: false,
      validate: (ctx) => {
        const storedHash = extractStoredHashFromString(ctx.content);
        if (!storedHash) {return null;}

        const currentHash = generateContentHashFromString(ctx.content);
        if (storedHash !== currentHash) {
          return {
            rule: 'metadata/stale-hash',
            message: `Content changed (hash: ${currentHash}) but metadata not updated (stored: ${storedHash}). Update contentHash and updatedAt.`,
            fixable: false
          };
        }
        return null;
      }
    });

    // metadata/required-fields - Required fields missing
    this.register({
      name: 'metadata/required-fields',
      description: 'Require specific metadata fields',
      defaultSeverity: 'error',
      fixable: false,
      validate: (ctx) => {
        if (!ctx.content.includes('export const __metadata')) {return null;}

        const requiredFields = ctx.config?.requiredFields ?? ['module', 'filename', 'description', 'updatedAt', 'status'];
        const missing = requiredFields.filter(field => {
          const regex = new RegExp(`${field}\\s*:`);
          return !regex.test(ctx.content);
        });

        if (missing.length > 0) {
          return {
            rule: 'metadata/required-fields',
            message: `Missing required metadata fields: ${missing.join(', ')}`,
            fixable: false
          };
        }
        return null;
      }
    });

    // metadata/deps-mismatch - Dependencies mismatch
    this.register({
      name: 'metadata/deps-mismatch',
      description: 'Detect undeclared dependencies',
      defaultSeverity: 'warn',
      fixable: false,
      validate: (ctx) => {
        if (!ctx.content.includes('export const __metadata')) {return null;}

        const srcDir = path.resolve(process.cwd(), ctx.config?.srcDir ?? 'src');
        const actualDeps = analyzeDependencies(ctx.filepath, srcDir);

        const internalMatch = /internal:\s*\[([\s\S]*?)\]/.exec(ctx.content);
        if (!internalMatch?.[1]) {return null;}

        const declaredInternal = internalMatch[1]
          .split(',')
          .map(s => s.trim().replace(/['"]/g, ''))
          .filter(s => s.length > 0);

        const missing = actualDeps.internal.filter(d => !declaredInternal.includes(d));

        if (missing.length > 0) {
          return {
            rule: 'metadata/deps-mismatch',
            message: `Undeclared internal dependencies: ${missing.join(', ')}`,
            fixable: false
          };
        }
        return null;
      }
    });

    // metadata/untracked-todos - Inline TODOs not in metadata
    this.register({
      name: 'metadata/untracked-todos',
      description: 'Detect untracked TODO comments',
      defaultSeverity: 'warn',
      fixable: false,
      validate: (ctx) => {
        const codeOnly = ctx.content.replace(
          /export const __metadata[\s\S]*?\n\};/m,
          ''
        );

        const todoMatches = codeOnly.match(/\/\/\s*(TODO|FIXME|HACK|XXX):/gi);
        if (todoMatches && todoMatches.length > 0) {
          return {
            rule: 'metadata/untracked-todos',
            message: `Found ${todoMatches.length} inline TODO/FIXME comments not tracked in metadata.todos`,
            fixable: false
          };
        }
        return null;
      }
    });

    // metadata/stale-update - updatedAt older than staleDays
    this.register({
      name: 'metadata/stale-update',
      description: 'Detect stale updatedAt date',
      defaultSeverity: 'warn',
      fixable: false,
      validate: (ctx) => {
        const match = /updatedAt:\s*['"](\d{4}-\d{2}-\d{2})['"]/.exec(ctx.content);
        if (!match?.[1]) {return null;}

        const updatedAt = new Date(match[1]);
        const staleDays = ctx.config?.staleDays ?? 30;
        const daysSinceUpdate = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);

        if (daysSinceUpdate > staleDays) {
          return {
            rule: 'metadata/stale-update',
            message: `Last updated ${Math.floor(daysSinceUpdate)} days ago. Consider reviewing.`,
            fixable: false
          };
        }
        return null;
      }
    });

    // metadata/empty-changelog - No changelog entries
    this.register({
      name: 'metadata/empty-changelog',
      description: 'Detect empty changelog',
      defaultSeverity: 'off', // Off by default
      fixable: false,
      validate: (ctx) => {
        if (!ctx.content.includes('export const __metadata')) {return null;}

        const changelogMatch = /changelog:\s*\[\s*\]/.exec(ctx.content);
        if (changelogMatch) {
          return {
            rule: 'metadata/empty-changelog',
            message: 'Empty changelog. Consider documenting version history.',
            fixable: false
          };
        }
        return null;
      }
    });
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Create a lint rule with defaults
 */
export function createRule(options: CreateRuleOptions): LintRule {
  const rule: LintRule = {
    name: options.name,
    description: options.description,
    defaultSeverity: options.defaultSeverity ?? 'error',
    validate: options.validate
  };
  
  if (options.fixable !== undefined) {
    rule.fixable = options.fixable;
  }
  if (options.docs !== undefined) {
    rule.docs = options.docs;
  }
  
  return rule;
}

/**
 * Get the rule registry instance
 */
export function getRuleRegistry(): RuleRegistry {
  return RuleRegistry.getInstance();
}


/**
 * Validation Engine
 *
 * Validates TypeScript files have proper, up-to-date metadata
 * 
 * Provides both traditional async/promise API and Result-based API
 * for explicit error handling.
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { generateContentHash, extractStoredHash } from './hasher.js';
import { analyzeDependencies } from './analyzer.js';
import type { IntrospectConfig, ValidationRules } from '../types/config.js';
import { DEFAULT_CONFIG } from '../types/config.js';
import { type Result, Ok, Err, type ResultError } from '../types/result.js';

// ============================================
// Types
// ============================================

export interface LintError {
  rule: keyof ValidationRules;
  message: string;
  fixable: boolean;
}

export interface LintWarning {
  rule: keyof ValidationRules;
  message: string;
}

export interface LintResult {
  file: string;
  relativePath: string;
  errors: LintError[];
  warnings: LintWarning[];
}

export interface ValidationResult {
  results: LintResult[];
  totalErrors: number;
  totalWarnings: number;
  filesChecked: number;
  filesWithIssues: number;
  passed: boolean;
}

// ============================================
// Validation Rules
// ============================================

type RuleFunction = (filepath: string, content: string, config: IntrospectConfig) => LintError | LintWarning | null;

const RULES: Record<keyof ValidationRules, RuleFunction> = {
  // ERROR: Missing metadata export
  'metadata/required': (_filepath, content) => {
    if (!content.includes('export const __metadata')) {
      return {
        rule: 'metadata/required',
        message: 'Missing __metadata export',
        fixable: true
      };
    }
    return null;
  },

  // ERROR: Duplicate metadata blocks
  'metadata/duplicate': (_filepath, content) => {
    const matches = content.match(/export const __metadata/g);
    const count = matches ? matches.length : 0;
    
    if (count > 1) {
      return {
        rule: 'metadata/duplicate',
        message: `Found ${count} duplicate __metadata blocks. Run 'generate --overwrite' to fix.`,
        fixable: true
      };
    }
    return null;
  },

  // ERROR: Content changed but hash not updated
  'metadata/stale-hash': (filepath, _content) => {
    const storedHash = extractStoredHash(filepath);
    if (!storedHash) {return null;} // Handled by metadata/required

    const currentHash = generateContentHash(filepath);
    if (storedHash !== currentHash) {
      return {
        rule: 'metadata/stale-hash',
        message: `Content changed (hash: ${currentHash}) but metadata not updated (stored: ${storedHash}). Update contentHash and updatedAt.`,
        fixable: false
      };
    }
    return null;
  },

  // ERROR: Required fields missing
  'metadata/required-fields': (_filepath, content, config) => {
    if (!content.includes('export const __metadata')) {return null;}

    const missing = config.requiredFields.filter(field => {
      const regex = new RegExp(`${field}\\s*:`);
      return !regex.test(content);
    });

    if (missing.length > 0) {
      return {
        rule: 'metadata/required-fields',
        message: `Missing required metadata fields: ${missing.join(', ')}`,
        fixable: false
      };
    }
    return null;
  },

  // ERROR/WARN: Dependencies mismatch
  'metadata/deps-mismatch': (filepath, content, config) => {
    if (!content.includes('export const __metadata')) {return null;}

    const srcDir = path.resolve(process.cwd(), config.srcDir);
    const actualDeps = analyzeDependencies(filepath, srcDir);

    // Extract declared internal deps from metadata
    const internalMatch = /internal:\s*\[([\s\S]*?)\]/.exec(content);
    if (!internalMatch?.[1]) {return null;}

    const declaredInternal = internalMatch[1]
      .split(',')
      .map(s => s.trim().replace(/['"]/g, ''))
      .filter(s => s.length > 0);

    // Find missing declarations
    const missing = actualDeps.internal.filter(d => !declaredInternal.includes(d));

    if (missing.length > 0) {
      return {
        rule: 'metadata/deps-mismatch',
        message: `Undeclared internal dependencies: ${missing.join(', ')}`
      };
    }
    return null;
  },

  // WARNING: Inline TODO/FIXME not in metadata
  'metadata/untracked-todos': (_filepath, content) => {
    // Skip the metadata block when searching for TODOs
    const codeOnly = content.replace(
      /export const __metadata[\s\S]*?\n\};/m,
      ''
    );

    const todoMatches = codeOnly.match(/\/\/\s*(TODO|FIXME|HACK|XXX):/gi);
    if (todoMatches && todoMatches.length > 0) {
      return {
        rule: 'metadata/untracked-todos',
        message: `Found ${todoMatches.length} inline TODO/FIXME comments not tracked in metadata.todos`
      };
    }
    return null;
  },

  // WARNING: updatedAt older than staleDays
  'metadata/stale-update': (_filepath, content, config) => {
    const match = /updatedAt:\s*['"](\d{4}-\d{2}-\d{2})['"]/.exec(content);
    if (!match?.[1]) {return null;}

    const updatedAt = new Date(match[1]);
    const daysSinceUpdate = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceUpdate > config.staleDays) {
      return {
        rule: 'metadata/stale-update',
        message: `Last updated ${Math.floor(daysSinceUpdate)} days ago. Consider reviewing.`
      };
    }
    return null;
  },

  // WARNING: No changelog entries
  'metadata/empty-changelog': (_filepath, content) => {
    if (!content.includes('export const __metadata')) {return null;}

    const changelogMatch = /changelog:\s*\[\s*\]/.exec(content);
    if (changelogMatch) {
      return {
        rule: 'metadata/empty-changelog',
        message: 'Empty changelog. Consider documenting version history.'
      };
    }
    return null;
  }
};

// Rules that are warnings by default
const WARNING_RULES = new Set<keyof ValidationRules>([
  'metadata/untracked-todos',
  'metadata/stale-update',
  'metadata/empty-changelog',
  'metadata/deps-mismatch'
]);

// ============================================
// Validator Class
// ============================================

export class Validator {
  private config: IntrospectConfig;

  constructor(config: Partial<IntrospectConfig> = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      rules: { ...DEFAULT_CONFIG.rules, ...config.rules },
      hooks: { ...DEFAULT_CONFIG.hooks, ...config.hooks }
    };
  }

  /**
   * Lint a single file
   */
  async lintFile(filepath: string): Promise<LintResult> {
    // Input validation
    if (!filepath || typeof filepath !== 'string') {
      throw new Error(`Invalid filepath: ${filepath}`);
    }

    if (!fs.existsSync(filepath)) {
      throw new Error(`File does not exist: ${filepath}`);
    }

    const stat = fs.statSync(filepath);
    if (!stat.isFile()) {
      throw new Error(`Path is not a file: ${filepath}`);
    }

    if (!filepath.endsWith('.ts') && !filepath.endsWith('.tsx')) {
      throw new Error(`File is not a TypeScript file: ${filepath}`);
    }

    let content: string;
    try {
      content = fs.readFileSync(filepath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read file ${filepath}: ${error instanceof Error ? error.message : String(error)}`);
    }

    const relativePath = path.relative(process.cwd(), filepath);

    const result: LintResult = {
      file: filepath,
      relativePath,
      errors: [],
      warnings: []
    };

    // Run all rules
    for (const [ruleName, ruleFunc] of Object.entries(RULES)) {
      const rule = ruleName as keyof ValidationRules;
      const severity = this.config.rules[rule];

      if (severity === 'off') {continue;}

      const issue = ruleFunc(filepath, content, this.config);
      if (!issue) {continue;}

      // Determine if this is an error or warning based on config
      const isWarningRule = WARNING_RULES.has(rule);
      const isError = severity === 'error' || (!isWarningRule && severity !== 'warn');

      if (isError && 'fixable' in issue) {
        result.errors.push(issue);
      } else {
        result.warnings.push({ rule, message: issue.message });
      }
    }

    return result;
  }

  /**
   * Validate all files in the project
   */
  async validate(specificFiles?: string[]): Promise<ValidationResult> {
    let files: string[];

    if (specificFiles && specificFiles.length > 0) {
      // Expand directories to their contained .ts files
      const expandedFiles: string[] = [];
      
      for (const f of specificFiles) {
        if (!fs.existsSync(f)) {continue;}
        
        const stat = fs.statSync(f);
        if (stat.isDirectory()) {
          // Glob for TypeScript files in directory
          const dirFiles = await glob(this.config.include, {
            cwd: f,
            ignore: this.config.exclude,
            absolute: true
          });
          expandedFiles.push(...dirFiles);
        } else if (f.endsWith('.ts') && !f.endsWith('.d.ts')) {
          expandedFiles.push(f);
        }
      }
      
      files = expandedFiles;
    } else {
      const srcDir = path.resolve(process.cwd(), this.config.srcDir);

      files = await glob(this.config.include, {
        cwd: srcDir,
        ignore: this.config.exclude,
        absolute: true
      });
    }

    const results: LintResult[] = [];
    let totalErrors = 0;
    let totalWarnings = 0;

    for (const file of files) {
      const result = await this.lintFile(file);

      if (result.errors.length > 0 || result.warnings.length > 0) {
        results.push(result);
        totalErrors += result.errors.length;
        totalWarnings += result.warnings.length;
      }
    }

    const passed = this.config.strictMode
      ? totalErrors === 0 && totalWarnings === 0
      : totalErrors === 0;

    return {
      results,
      totalErrors,
      totalWarnings,
      filesChecked: files.length,
      filesWithIssues: results.length,
      passed
    };
  }
}

// ============================================
// Convenience Functions
// ============================================

export async function validate(config: Partial<IntrospectConfig> = {}): Promise<ValidationResult> {
  const validator = new Validator(config);
  return validator.validate();
}

export async function lintFiles(files: string[], config: Partial<IntrospectConfig> = {}): Promise<ValidationResult> {
  const validator = new Validator(config);
  return validator.validate(files);
}

// ============================================
// Result-Based API
// ============================================

/**
 * Error codes for validation operations
 */
export type ValidationErrorCode = 
  | 'INVALID_FILEPATH'
  | 'FILE_NOT_FOUND'
  | 'NOT_A_FILE'
  | 'NOT_TYPESCRIPT'
  | 'READ_ERROR'
  | 'VALIDATION_FAILED';

/**
 * Validation error with structured data
 */
export interface ValidationError extends ResultError {
  code: ValidationErrorCode;
  filepath?: string;
}

/**
 * Lint a single file using Result pattern
 * 
 * @example
 * ```typescript
 * const result = await lintFileResult('/path/to/file.ts');
 * match(result, {
 *   ok: (lint) => console.log(`Found ${lint.errors.length} errors`),
 *   err: (error) => console.error(`Failed: ${error.message}`)
 * });
 * ```
 */
export async function lintFileResult(
  filepath: string,
  config: Partial<IntrospectConfig> = {}
): Promise<Result<LintResult, ValidationError>> {
  // Input validation
  if (!filepath || typeof filepath !== 'string') {
    return Err({
      code: 'INVALID_FILEPATH',
      message: `Invalid filepath: ${filepath}`,
      filepath
    });
  }

  if (!fs.existsSync(filepath)) {
    return Err({
      code: 'FILE_NOT_FOUND',
      message: `File does not exist: ${filepath}`,
      filepath
    });
  }

  const stat = fs.statSync(filepath);
  if (!stat.isFile()) {
    return Err({
      code: 'NOT_A_FILE',
      message: `Path is not a file: ${filepath}`,
      filepath
    });
  }

  if (!filepath.endsWith('.ts') && !filepath.endsWith('.tsx')) {
    return Err({
      code: 'NOT_TYPESCRIPT',
      message: `File is not a TypeScript file: ${filepath}`,
      filepath
    });
  }

  try {
    const validator = new Validator(config);
    const result = await validator.lintFile(filepath);
    return Ok(result);
  } catch (error) {
    return Err({
      code: 'READ_ERROR',
      message: `Failed to lint file: ${error instanceof Error ? error.message : String(error)}`,
      filepath
    });
  }
}

/**
 * Validate files using Result pattern
 * 
 * @example
 * ```typescript
 * const result = await validateResult();
 * if (isOk(result)) {
 *   const { passed, totalErrors } = result.value;
 *   console.log(`Validation ${passed ? 'passed' : 'failed'} with ${totalErrors} errors`);
 * }
 * ```
 */
export async function validateResult(
  config: Partial<IntrospectConfig> = {},
  specificFiles?: string[]
): Promise<Result<ValidationResult, ValidationError>> {
  try {
    const validator = new Validator(config);
    const result = await validator.validate(specificFiles);
    return Ok(result);
  } catch (error) {
    return Err({
      code: 'VALIDATION_FAILED',
      message: `Validation failed: ${error instanceof Error ? error.message : String(error)}`
    });
  }
}

/**
 * Check if a file has valid metadata using Result pattern
 * 
 * Convenience function that returns a simple boolean result.
 * 
 * @example
 * ```typescript
 * const isValid = await hasValidMetadataResult('/path/to/file.ts');
 * match(isValid, {
 *   ok: (valid) => console.log(valid ? 'Valid!' : 'Invalid'),
 *   err: (e) => console.error(e.message)
 * });
 * ```
 */
export async function hasValidMetadataResult(
  filepath: string,
  config: Partial<IntrospectConfig> = {}
): Promise<Result<boolean, ValidationError>> {
  const result = await lintFileResult(filepath, config);
  
  if (result.ok) {
    return Ok(result.value.errors.length === 0);
  }
  
  return result;
}


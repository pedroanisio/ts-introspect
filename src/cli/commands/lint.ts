/**
 * Lint Command
 *
 * Validate metadata in TypeScript files.
 * AI-focused: JSON output by default, structured error responses.
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { Validator, type ValidationResult } from '../../core/validator.js';
import { DEFAULT_CONFIG, type IntrospectConfig } from '../../types/config.js';
import {
  outputJson,
  success,
  outputError,
  ErrorCode,
  ExitCode,
  isHumanFormat,
  human,
  type OutputFormat,
} from '../output.js';

interface LintOptions {
  strict?: boolean;
  format?: OutputFormat;
  config?: string;
}

export async function lintCommand(
  files: string[] | undefined,
  options: LintOptions
): Promise<void> {
  const format = options.format ?? 'json';

  // Load config
  let config: IntrospectConfig;
  try {
    config = loadConfig(options.config);
  } catch (err) {
    outputError(
      ErrorCode.CONFIG_ERROR,
      `Failed to load config: ${err instanceof Error ? err.message : String(err)}`,
      500
    );
  }

  if (options.strict) {
    config.strictMode = true;
  }

  // Human-friendly progress output (only for non-JSON formats)
  if (isHumanFormat(format)) {
    human.info('\n🔍 Running Introspection Linter...\n');
  }

  const validator = new Validator(config);

  // Resolve files if provided
  const resolvedFiles = files?.map(f => path.resolve(process.cwd(), f));
  
  let result: ValidationResult;
  try {
    result = await validator.validate(resolvedFiles);
  } catch (err) {
    outputError(
      ErrorCode.SYSTEM_ERROR,
      `Validation failed: ${err instanceof Error ? err.message : String(err)}`,
      500
    );
  }

  // Output based on format
  if (format === 'json') {
    outputJsonResult(result);
  } else if (format === 'table') {
    outputTableResult(result);
  } else {
    outputTextResult(result);
  }

  // Exit with appropriate code
  if (!result.passed) {
    process.exit(ExitCode.USER_ERROR);
  }
}

function loadConfig(configPath?: string): IntrospectConfig {
  const paths = configPath
    ? [path.resolve(process.cwd(), configPath)]
    : [
      path.resolve(process.cwd(), 'introspect.config.json'),
      path.resolve(process.cwd(), '.introspectrc.json'),
      path.resolve(process.cwd(), '.introspectrc')
    ];

  for (const p of paths) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf-8');
      const userConfig = JSON.parse(content) as Partial<IntrospectConfig>;
      return {
        ...DEFAULT_CONFIG,
        ...userConfig,
        rules: { ...DEFAULT_CONFIG.rules, ...userConfig.rules },
        hooks: { ...DEFAULT_CONFIG.hooks, ...userConfig.hooks }
      };
    }
  }

  return DEFAULT_CONFIG;
}

function outputJsonResult(result: ValidationResult): void {
  // Structured JSON output
  outputJson(success({
    passed: result.passed,
    summary: {
      files_checked: result.filesChecked,
      files_with_issues: result.filesWithIssues,
      total_errors: result.totalErrors,
      total_warnings: result.totalWarnings,
    },
    results: result.results.map(item => ({
      file: item.file,
      relative_path: item.relativePath,
      errors: item.errors.map(e => ({
        rule: e.rule,
        message: e.message,
        fixable: e.fixable,
      })),
      warnings: item.warnings.map(w => ({
        rule: w.rule,
        message: w.message,
      })),
    })),
  }));
}

function outputTableResult(result: ValidationResult): void {
  // Table header
  console.log('| File | Type | Rule | Message |');
  console.log('|------|------|------|---------|');

  for (const item of result.results) {
    for (const error of item.errors) {
      console.log(`| ${item.relativePath} | ERROR | ${error.rule} | ${error.message} |`);
    }
    for (const warning of item.warnings) {
      console.log(`| ${item.relativePath} | WARN | ${warning.rule} | ${warning.message} |`);
    }
  }

  console.log('');
  console.log(`**Summary:** ${result.totalErrors} errors, ${result.totalWarnings} warnings in ${result.filesChecked} files`);
  console.log(`**Result:** ${result.passed ? 'PASSED' : 'FAILED'}`);
}

function outputTextResult(result: ValidationResult): void {
  for (const item of result.results) {
    console.log(chalk.white(`📄 ${item.relativePath}`));

    for (const error of item.errors) {
      console.log(chalk.red(`   ❌ [${error.rule}] ${error.message}`));
    }

    for (const warning of item.warnings) {
      console.log(chalk.yellow(`   ⚠️  [${warning.rule}] ${warning.message}`));
    }

    console.log('');
  }

  // Summary
  console.log(chalk.gray('─'.repeat(50)));
  console.log(chalk.white(`📊 Summary: ${chalk.red(`${result.totalErrors} errors`)}, ${chalk.yellow(`${result.totalWarnings} warnings`)}`));
  console.log(chalk.white(`   Files checked: ${result.filesChecked}`));
  console.log(chalk.white(`   Files with issues: ${result.filesWithIssues}`));

  if (result.passed) {
    console.log(chalk.green('\n✅ Linting passed\n'));
  } else {
    console.log(chalk.red('\n❌ Linting failed\n'));
  }
}

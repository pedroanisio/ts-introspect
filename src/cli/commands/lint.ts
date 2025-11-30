/**
 * Lint Command
 *
 * Validate metadata in TypeScript files.
 * AI-focused: JSON output by default, structured error responses.
 * Uses tslog per ADR-001
 */

import path from 'path';
import chalk from 'chalk';
import { Validator, type ValidationResult } from '../../core/validator.js';
import { ConfigService } from '../../core/config-service.js';
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
import { stdout } from '../logger.js';

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

  // Load config using ConfigService
  const configService = ConfigService.getInstance();
  let config;
  try {
    config = configService.load(options.config);
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
  stdout('| File | Type | Rule | Message |');
  stdout('|------|------|------|---------|');

  for (const item of result.results) {
    for (const error of item.errors) {
      stdout(`| ${item.relativePath} | ERROR | ${error.rule} | ${error.message} |`);
    }
    for (const warning of item.warnings) {
      stdout(`| ${item.relativePath} | WARN | ${warning.rule} | ${warning.message} |`);
    }
  }

  stdout('');
  stdout(`**Summary:** ${result.totalErrors} errors, ${result.totalWarnings} warnings in ${result.filesChecked} files`);
  stdout(`**Result:** ${result.passed ? 'PASSED' : 'FAILED'}`);
}

function outputTextResult(result: ValidationResult): void {
  for (const item of result.results) {
    stdout(chalk.white(`📄 ${item.relativePath}`));

    for (const error of item.errors) {
      stdout(chalk.red(`   ❌ [${error.rule}] ${error.message}`));
    }

    for (const warning of item.warnings) {
      stdout(chalk.yellow(`   ⚠️  [${warning.rule}] ${warning.message}`));
    }

    stdout('');
  }

  // Summary
  stdout(chalk.gray('─'.repeat(50)));
  stdout(chalk.white(`📊 Summary: ${chalk.red(`${result.totalErrors} errors`)}, ${chalk.yellow(`${result.totalWarnings} warnings`)}`));
  stdout(chalk.white(`   Files checked: ${result.filesChecked}`));
  stdout(chalk.white(`   Files with issues: ${result.filesWithIssues}`));

  if (result.passed) {
    stdout(chalk.green('\n✅ Linting passed\n'));
  } else {
    stdout(chalk.red('\n❌ Linting failed\n'));
  }
}

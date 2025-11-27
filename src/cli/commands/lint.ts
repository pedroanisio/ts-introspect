/**
 * Lint Command
 *
 * Validate metadata in TypeScript files
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { Validator, type ValidationResult } from '../../core/validator.js';
import { DEFAULT_CONFIG, type IntrospectConfig } from '../../types/config.js';

interface LintOptions {
  strict?: boolean;
  format?: 'pretty' | 'json' | 'compact';
  config?: string;
}

export async function lintCommand(
  files: string[] | undefined,
  options: LintOptions
): Promise<void> {
  // Load config
  const config = loadConfig(options.config);
  if (options.strict) {
    config.strictMode = true;
  }

  console.log(chalk.blue('\n🔍 Running Introspection Linter...\n'));

  const validator = new Validator(config);

  // Resolve files if provided
  const resolvedFiles = files?.map(f => path.resolve(process.cwd(), f));
  const result = await validator.validate(resolvedFiles);

  // Output based on format
  switch (options.format) {
    case 'json':
      outputJson(result);
      break;
    case 'compact':
      outputCompact(result);
      break;
    default:
      outputPretty(result);
  }

  // Exit with appropriate code
  if (!result.passed) {
    process.exit(1);
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
      try {
        const content = fs.readFileSync(p, 'utf-8');
        const userConfig = JSON.parse(content) as Partial<IntrospectConfig>;
        return {
          ...DEFAULT_CONFIG,
          ...userConfig,
          rules: { ...DEFAULT_CONFIG.rules, ...userConfig.rules },
          hooks: { ...DEFAULT_CONFIG.hooks, ...userConfig.hooks }
        };
      } catch {
        console.log(chalk.yellow(`⚠️  Could not parse config: ${p}`));
      }
    }
  }

  return DEFAULT_CONFIG;
}

function outputPretty(result: ValidationResult): void {
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

function outputCompact(result: ValidationResult): void {
  for (const item of result.results) {
    for (const error of item.errors) {
      console.log(`${item.relativePath}: error [${error.rule}] ${error.message}`);
    }
    for (const warning of item.warnings) {
      console.log(`${item.relativePath}: warning [${warning.rule}] ${warning.message}`);
    }
  }

  console.log(`\n${result.totalErrors} errors, ${result.totalWarnings} warnings`);
}

function outputJson(result: ValidationResult): void {
  console.log(JSON.stringify(result, null, 2));
}


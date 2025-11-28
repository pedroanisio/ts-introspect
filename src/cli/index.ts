#!/usr/bin/env node
/**
 * ts-introspect CLI
 *
 * AI-focused command-line interface for self-documenting TypeScript modules.
 * 
 * Design principles (following https://raw.githubusercontent.com/pedroanisio/pedroanisio.github.io/refs/heads/main/building-ai-focused-cli.md):
 * - JSON output by default (machine-readable)
 * - Structured error responses with exit codes
 * - Self-describing interfaces (--schema, --list-commands)
 * - Named parameters only (no positional magic)
 * - Non-interactive operation
 */

import { Command } from 'commander';
import { lintCommand } from './commands/lint.js';
import { generateCommand } from './commands/generate.js';
import { initCommand } from './commands/init.js';
import { reportCommand } from './commands/report.js';
import { depsCommand } from './commands/deps.js';
import { hooksCommand } from './commands/hooks.js';
import { docsCommand } from './commands/docs.js';
import { adrCommand } from './commands/adr.js';
import {
  CLI_VERSION,
  API_VERSION,
  getCliSchema,
  getOpenApiSchema,
  outputJson,
  success,
  outputError,
  ErrorCode,
} from './output.js';

// Handle global options before setting up commander
const args = process.argv.slice(2);

if (args.includes('--api-version')) {
  outputJson(success({ api_version: API_VERSION }));
  process.exit(0);
}

if (args.includes('--list-commands')) {
  outputJson(success(getCliSchema().commands));
  process.exit(0);
}

const schemaIndex = args.indexOf('--schema');
if (schemaIndex !== -1) {
  const schemaType = args[schemaIndex + 1];
  if (schemaType === 'openapi') {
    console.log(JSON.stringify(getOpenApiSchema(), null, 2));
  } else if (schemaType === 'json') {
    outputJson(success(getCliSchema()));
  } else {
    outputError(
      ErrorCode.VALIDATION_ERROR,
      `Invalid schema type: ${schemaType ?? 'undefined'}`,
      400,
      { field: 'schema', provided: schemaType ?? 'undefined', expected: 'json | openapi' }
    );
  }
  process.exit(0);
}

const program = new Command();

program
  .name('ts-introspect')
  .description('Self-documenting TypeScript modules with enforced metadata')
  .version(CLI_VERSION, '-v, --version', 'Output CLI version')
  .option('--api-version', 'Output API version')
  .option('--schema <type>', 'Output schema: json, openapi')
  .option('--list-commands', 'List all available commands as JSON');

// ============================================
// Commands
// ============================================

// tsi init - Initialize in a project
program
  .command('init')
  .description('Initialize ts-introspect in your project')
  .option('--force', 'Overwrite existing configuration')
  .option('--format <type>', 'Output format: json, text', 'json')
  .action(initCommand);

// tsi lint - Validate metadata
program
  .command('lint')
  .description('Validate metadata in TypeScript files')
  .argument('[files...]', 'Files or directories to lint')
  .option('-s, --strict', 'Treat warnings as errors')
  .option('--format <type>', 'Output format: json, table, text', 'json')
  .option('-c, --config <path>', 'Config file path')
  .action(lintCommand);

// tsi generate - Generate metadata stubs
program
  .command('generate')
  .description('Generate metadata stubs for files')
  .argument('[files...]', 'Files or directories to generate metadata for')
  .option('-o, --overwrite', 'Overwrite existing metadata')
  .option('-e, --exclude <patterns...>', 'Additional patterns to exclude')
  .option('--include-barrel-exports', 'Include files re-exported via "export * from"')
  .option('--format <type>', 'Output format: json, text', 'json')
  .action((files, options) => {
    void generateCommand(files, {
      ...options,
      skipBarrelExports: !options.includeBarrelExports
    });
  });

// tsi report - Generate reports
program
  .command('report')
  .description('Generate introspection reports')
  .option('-t, --type <type>', 'Report type: todos, fixes, deps, summary, all', 'summary')
  .option('-o, --output <path>', 'Output file path')
  .option('--format <type>', 'Output format: json, table, text, markdown, html', 'json')
  .option('--theme <name>', 'HTML theme: classic, dark, light, dracula, nord', 'classic')
  .action(reportCommand);

// tsi deps - Analyze dependencies
program
  .command('deps')
  .description('Analyze file dependencies')
  .argument('[file]', 'File to analyze')
  .option('--graph', 'Show dependency graph')
  .option('--who-uses <module>', 'Find who imports a module')
  .option('--unused', 'Find unused modules')
  .option('--circular', 'Find circular dependencies')
  .option('--format <type>', 'Output format: json, table, text', 'json')
  .action(depsCommand);

// tsi hooks - Manage git hooks
program
  .command('hooks')
  .description('Manage git hooks')
  .option('--install', 'Install git hooks')
  .option('--uninstall', 'Remove git hooks')
  .option('--check', 'Check if hooks are installed')
  .option('--format <type>', 'Output format: json, text', 'json')
  .action(hooksCommand);

// tsi docs - Generate documentation
program
  .command('docs')
  .description('Generate developer documentation (ADR, guides)')
  .option('--adr', 'Generate Architecture Decision Record')
  .option('--quickstart', 'Generate Quick Start guide')
  .option('--all', 'Generate all documentation')
  .option('-o, --output <dir>', 'Output directory', 'docs')
  .option('--adr-number <n>', 'ADR number', '1')
  .option('--template <type>', 'ADR template: introspection, code-markers', 'introspection')
  .option('--format <type>', 'Output format: json, text', 'json')
  .action(docsCommand);

// tsi adr - Manage Architecture Decision Records
program
  .command('adr')
  .description('Manage Architecture Decision Records (JSONL format)')
  .option('-l, --list', 'List all ADRs')
  .option('-t, --table', 'Output as markdown table (deprecated: use --format=table)')
  .option('-s, --show <id>', 'Show specific ADR by ID')
  .option('--status <status>', 'Filter by status: proposed, approved, deprecated, superseded')
  .option('-a, --add', 'Add new ADR')
  .option('--id <id>', 'ADR ID (auto-generated if not provided)')
  .option('--title <title>', 'ADR title')
  .option('--decision <decision>', 'ADR decision')
  .option('--rationale <rationale>', 'ADR rationale')
  .option('-e, --export <id>', 'Export ADR to markdown')
  .option('--export-all', 'Export all ADRs to markdown')
  .option('-v, --validate', 'Validate all ADRs')
  .option('-f, --file <path>', 'JSONL file path', 'docs/adrs.jsonl')
  .option('--format <type>', 'Output format: json, table, markdown', 'json')
  .action(adrCommand);

// ============================================
// Error Handling
// ============================================

program.exitOverride((err) => {
  if (err.code === 'commander.unknownCommand') {
    outputError(
      ErrorCode.COMMAND_ERROR,
      `Unknown command: ${err.message}`,
      400
    );
  }
  if (err.code === 'commander.missingMandatoryOptionValue') {
    outputError(
      ErrorCode.VALIDATION_ERROR,
      err.message,
      400
    );
  }
  process.exit(1);
});

program.parse();

#!/usr/bin/env node
/**
 * ts-introspect CLI
 *
 * Self-documenting TypeScript modules with enforced metadata
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

const VERSION = '1.0.0';

const program = new Command();

program
  .name('ts-introspect')
  .description('Self-documenting TypeScript modules with enforced metadata')
  .version(VERSION);

// tsi init - Initialize in a project
program
  .command('init')
  .description('Initialize ts-introspect in your project')
  .option('--force', 'Overwrite existing configuration')
  .action(initCommand);

// tsi lint - Validate metadata
program
  .command('lint [files...]')
  .description('Validate metadata in TypeScript files')
  .option('-s, --strict', 'Treat warnings as errors')
  .option('--format <type>', 'Output format: pretty, json, compact', 'pretty')
  .option('-c, --config <path>', 'Config file path')
  .action(lintCommand);

// tsi generate - Generate metadata stubs
program
  .command('generate [files...]')
  .description('Generate metadata stubs for files')
  .option('-o, --overwrite', 'Overwrite existing metadata')
  .option('-e, --exclude <patterns...>', 'Additional patterns to exclude')
  .option('--include-barrel-exports', 'Include files re-exported via "export * from"')
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
  .option('--format <type>', 'Output format: text, json, markdown, html', 'text')
  .option('--html', 'Generate comprehensive HTML report')
  .action(reportCommand);

// tsi deps - Analyze dependencies
program
  .command('deps [file]')
  .description('Analyze file dependencies')
  .option('--graph', 'Show dependency graph')
  .option('--who-uses <module>', 'Find who imports a module')
  .option('--unused', 'Find unused modules')
  .action(depsCommand);

// tsi hooks - Manage git hooks
program
  .command('hooks')
  .description('Manage git hooks')
  .option('--install', 'Install git hooks')
  .option('--uninstall', 'Remove git hooks')
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
  .action(docsCommand);

// tsi adr - Manage Architecture Decision Records
program
  .command('adr')
  .description('Manage Architecture Decision Records (JSONL format)')
  .option('-l, --list', 'List all ADRs')
  .option('-t, --table', 'Output as markdown table')
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
  .action(adrCommand);

program.parse();


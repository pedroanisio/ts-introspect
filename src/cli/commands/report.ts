/**
 * Report Command
 *
 * Generate introspection reports
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { glob } from 'glob';
import { IntrospectionRegistry } from '../../core/registry.js';
import { DependencyAnalyzer } from '../../core/analyzer.js';
import { DEFAULT_CONFIG } from '../../types/config.js';
import { generateHtmlReport, generateReportData } from '../../generators/html-report.js';

interface ReportOptions {
  type?: 'todos' | 'fixes' | 'deps' | 'summary' | 'all';
  output?: string;
  format?: 'text' | 'json' | 'markdown' | 'html';
  html?: boolean;
}

export async function reportCommand(options: ReportOptions): Promise<void> {
  const registry = new IntrospectionRegistry();
  const srcDir = path.resolve(process.cwd(), DEFAULT_CONFIG.srcDir);

  console.log(chalk.blue('\n📊 Loading project metadata...\n'));

  await registry.loadAll(srcDir, false);
  
  const errors = registry.getErrors();
  if (errors.length > 0) {
    console.log(chalk.yellow(`⚠️  Encountered ${errors.length} errors while loading metadata:\n`));
    for (const { file, error } of errors.slice(0, 10)) {
      console.log(chalk.gray(`  ${file}: ${error}`));
    }
    if (errors.length > 10) {
      console.log(chalk.gray(`  ... and ${errors.length - 10} more`));
    }
    console.log('');
  }

  // Determine format
  const format = options.html ? 'html' : (options.format ?? 'text');

  // For HTML, always generate full report
  if (format === 'html') {
    await generateHtmlReportOutput(registry, srcDir, options.output);
    return;
  }

  if (registry.size() === 0) {
    console.log(chalk.yellow('⚠️  No modules with metadata found.'));
    console.log(chalk.gray('   Run `tsi generate` to add metadata to your files.\n'));
    return;
  }

  const reportType = options.type ?? 'summary';
  let output = '';

  switch (reportType) {
    case 'todos':
      output = generateTodosReport(registry, format);
      break;
    case 'fixes':
      output = generateFixesReport(registry, format);
      break;
    case 'summary':
      output = generateSummaryReport(registry, format);
      break;
    case 'all':
      output = [
        generateSummaryReport(registry, format),
        generateTodosReport(registry, format),
        generateFixesReport(registry, format)
      ].join('\n\n');
      break;
    default:
      output = generateSummaryReport(registry, format);
  }

  // Output to file or console
  if (options.output) {
    const outputPath = path.resolve(process.cwd(), options.output);
    fs.writeFileSync(outputPath, output);
    console.log(chalk.green(`✅ Report saved to ${outputPath}\n`));
  } else {
    console.log(output);
  }
}

async function generateHtmlReportOutput(
  registry: IntrospectionRegistry,
  srcDir: string,
  outputPath?: string
): Promise<void> {
  console.log(chalk.blue('🔍 Analyzing dependencies...\n'));

  // Analyze dependencies
  const analyzer = new DependencyAnalyzer(srcDir);
  await analyzer.analyze();
  const graph = analyzer.getGraph();
  const circularDeps = analyzer.findCircularDependencies();
  const unusedModules = analyzer.getUnusedModules();

  // Count total files
  const allFiles = await glob('**/*.ts', {
    cwd: srcDir,
    ignore: ['**/*.d.ts', '**/*.test.ts', '**/*.spec.ts', '**/node_modules/**']
  });
  const totalFiles = allFiles.length;

  // Get project name from package.json
  let projectName = 'Project';
  try {
    const pkgPath = path.resolve(process.cwd(), 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { name?: string };
      projectName = pkg.name ?? 'Project';
    }
  } catch {
    // Use default
  }

  // Generate report data
  const reportData = await generateReportData(
    registry,
    projectName,
    graph ?? undefined,
    circularDeps,
    unusedModules
  );

  // Generate HTML
  const html = generateHtmlReport(reportData, totalFiles);

  // Determine output path
  const finalPath = outputPath 
    ? path.resolve(process.cwd(), outputPath)
    : path.resolve(process.cwd(), 'introspection-report.html');

  fs.writeFileSync(finalPath, html);

  console.log(chalk.green(`✅ HTML report generated: ${finalPath}`));
  console.log(chalk.gray(`\n   Open in browser: file://${finalPath}\n`));

  // Print summary
  console.log(chalk.bold('📊 Report Summary:'));
  console.log(chalk.gray('─'.repeat(40)));
  console.log(`   ${chalk.cyan('Modules with metadata:')} ${registry.size()}`);
  console.log(`   ${chalk.cyan('Total TypeScript files:')} ${totalFiles}`);
  console.log(`   ${chalk.cyan('Coverage:')} ${totalFiles > 0 ? Math.round((registry.size() / totalFiles) * 100) : 0}%`);
  console.log(`   ${chalk.yellow('Open TODOs:')} ${registry.getAllTodos().length}`);
  console.log(`   ${chalk.red('Open Fixes:')} ${registry.getAllFixes().length}`);
  
  if (circularDeps.length > 0) {
    console.log(`   ${chalk.red('Circular dependencies:')} ${circularDeps.length}`);
  }
  
  if (unusedModules.length > 0) {
    console.log(`   ${chalk.yellow('Unused modules:')} ${unusedModules.length}`);
  }
  
  console.log('');
}

function generateSummaryReport(
  registry: IntrospectionRegistry,
  format?: string
): string {
  const summary = registry.getSummary();
  const recentlyUpdated = registry.getRecentlyUpdated(7);

  if (format === 'json') {
    return JSON.stringify({ summary, recentlyUpdated: recentlyUpdated.map(m => m.module) }, null, 2);
  }

  if (format === 'markdown') {
    return `# Project Introspection Summary

## Overview
- **Total Modules**: ${summary.totalModules}
- **Open TODOs**: ${summary.todoCount}
- **Open Fixes**: ${summary.fixCount}
- **Recently Updated**: ${summary.recentlyUpdated} (last 7 days)

## Status Breakdown
| Status | Count |
|--------|-------|
| Stable | ${summary.statusBreakdown.stable} |
| Beta | ${summary.statusBreakdown.beta} |
| Experimental | ${summary.statusBreakdown.experimental} |
| Deprecated | ${summary.statusBreakdown.deprecated} |

## Recently Updated Modules
${recentlyUpdated.map(m => `- \`${m.module}\` (${m.updatedAt})`).join('\n') || '_None_'}
`;
  }

  // Text format
  let output = chalk.bold('📊 PROJECT SUMMARY\n');
  output += chalk.gray('─'.repeat(40)) + '\n\n';

  output += `${chalk.white('Total Modules:')} ${chalk.cyan(summary.totalModules)}\n`;
  output += `${chalk.white('Open TODOs:')}    ${chalk.yellow(summary.todoCount)}\n`;
  output += `${chalk.white('Open Fixes:')}    ${chalk.red(summary.fixCount)}\n`;
  output += `${chalk.white('Recent Updates:')} ${chalk.green(summary.recentlyUpdated)} (7 days)\n\n`;

  output += chalk.bold('Status Breakdown:\n');
  output += `  ${chalk.green('stable')}:       ${summary.statusBreakdown.stable}\n`;
  output += `  ${chalk.blue('beta')}:         ${summary.statusBreakdown.beta}\n`;
  output += `  ${chalk.yellow('experimental')}: ${summary.statusBreakdown.experimental}\n`;
  output += `  ${chalk.gray('deprecated')}:   ${summary.statusBreakdown.deprecated}\n\n`;

  if (recentlyUpdated.length > 0) {
    output += chalk.bold('Recently Updated:\n');
    for (const m of recentlyUpdated.slice(0, 5)) {
      output += `  ${chalk.cyan(m.module)} ${chalk.gray(`(${m.updatedAt})`)}\n`;
    }
    output += '\n';
  }

  return output;
}

function generateTodosReport(
  registry: IntrospectionRegistry,
  format?: string
): string {
  const todos = registry.getAllTodos();

  if (format === 'json') {
    return JSON.stringify({ todos }, null, 2);
  }

  if (format === 'markdown') {
    if (todos.length === 0) {
      return '## TODOs\n\n_No open TODOs_\n';
    }

    let output = '## TODOs\n\n';
    output += '| Priority | Module | Description | Status |\n';
    output += '|----------|--------|-------------|--------|\n';

    for (const todo of todos) {
      output += `| ${todo.priority} | \`${todo.module}\` | ${todo.description} | ${todo.status} |\n`;
    }

    return output;
  }

  // Text format
  let output = chalk.bold('📋 ALL TODOs\n');
  output += chalk.gray('─'.repeat(40)) + '\n\n';

  if (todos.length === 0) {
    output += chalk.gray('  No open TODOs\n\n');
    return output;
  }

  const priorityColors: Record<string, (s: string) => string> = {
    critical: chalk.red,
    high: chalk.yellow,
    medium: chalk.blue,
    low: chalk.gray
  };

  for (const todo of todos) {
    const colorFn = priorityColors[todo.priority] ?? chalk.white;
    output += `[${colorFn(todo.priority.toUpperCase())}] ${chalk.cyan(todo.module)}\n`;
    output += `  └─ ${chalk.white(todo.id)}: ${todo.description}\n`;
    output += `     ${chalk.gray(`Status: ${todo.status} | Created: ${todo.createdAt}`)}\n\n`;
  }

  return output;
}

function generateFixesReport(
  registry: IntrospectionRegistry,
  format?: string
): string {
  const fixes = registry.getAllFixes();

  if (format === 'json') {
    return JSON.stringify({ fixes }, null, 2);
  }

  if (format === 'markdown') {
    if (fixes.length === 0) {
      return '## Fixes\n\n_No open fixes_\n';
    }

    let output = '## Open Fixes\n\n';
    output += '| Severity | Module | Description | Status |\n';
    output += '|----------|--------|-------------|--------|\n';

    for (const fix of fixes) {
      output += `| ${fix.severity} | \`${fix.module}\` | ${fix.description} | ${fix.status} |\n`;
    }

    return output;
  }

  // Text format
  let output = chalk.bold('🔧 OPEN FIXES\n');
  output += chalk.gray('─'.repeat(40)) + '\n\n';

  if (fixes.length === 0) {
    output += chalk.gray('  No open fixes\n\n');
    return output;
  }

  const severityColors: Record<string, (s: string) => string> = {
    critical: chalk.red,
    major: chalk.yellow,
    minor: chalk.blue,
    trivial: chalk.gray
  };

  for (const fix of fixes) {
    const colorFn = severityColors[fix.severity] ?? chalk.white;
    output += `[${colorFn(fix.severity.toUpperCase())}] ${chalk.cyan(fix.module)}\n`;
    output += `  └─ ${chalk.white(fix.id)}: ${fix.description}\n`;
    output += `     ${chalk.gray(`Status: ${fix.status}`)}\n\n`;
  }

  return output;
}

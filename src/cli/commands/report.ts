/**
 * Report Command
 *
 * Generate introspection reports.
 * AI-focused: JSON output by default.
 * Uses tslog per ADR-001
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { glob } from 'glob';
import { IntrospectionRegistry } from '../../core/registry.js';
import { DependencyAnalyzer } from '../../core/analyzer.js';
import { DEFAULT_CONFIG } from '../../types/config.js';
import { generateHtmlReport, generateReportData } from '../../generators/html-report.js';
import {
  outputJson,
  success,
  outputError,
  ErrorCode,
  isHumanFormat,
  human,
  type OutputFormat,
} from '../output.js';
import { stdout } from '../logger.js';

interface ReportOptions {
  type?: 'todos' | 'fixes' | 'deps' | 'summary' | 'all';
  output?: string;
  format?: OutputFormat | 'markdown' | 'html';
  theme?: string;
}

export async function reportCommand(options: ReportOptions): Promise<void> {
  const format = options.format ?? 'json';
  const registry = new IntrospectionRegistry();
  const srcDir = path.resolve(process.cwd(), DEFAULT_CONFIG.srcDir);

  if (isHumanFormat(format)) {
    human.info('\n📊 Loading project metadata...\n');
  }

  try {
    await registry.loadAll(srcDir, false);
  } catch (err) {
    outputError(
      ErrorCode.SYSTEM_ERROR,
      `Failed to load metadata: ${err instanceof Error ? err.message : String(err)}`,
      500
    );
  }

  const errors = registry.getErrors();
  if (errors.length > 0 && isHumanFormat(format)) {
    human.warn(`⚠️  Encountered ${errors.length} errors while loading metadata:\n`);
    for (const { file, error } of errors.slice(0, 10)) {
      human.dim(`  ${file}: ${error}`);
    }
    if (errors.length > 10) {
      human.dim(`  ... and ${errors.length - 10} more`);
    }
    stdout('');
  }

  // For HTML, always generate full report
  if (format === 'html') {
    await generateHtmlReportOutput(registry, srcDir, options.output, options.theme);
    return;
  }

  if (registry.size() === 0) {
    if (format === 'json') {
      outputJson(success({
        warning: 'No modules with metadata found',
        hint: 'Run `tsi generate` to add metadata to your files',
        summary: null,
      }));
    } else {
      human.warn('⚠️  No modules with metadata found.');
      human.dim('   Run `tsi generate` to add metadata to your files.\n');
    }
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
      if (format === 'json') {
        output = generateAllReportJson(registry);
      } else {
        output = [
          generateSummaryReport(registry, format),
          generateTodosReport(registry, format),
          generateFixesReport(registry, format)
        ].join('\n\n');
      }
      break;
    default:
      output = generateSummaryReport(registry, format);
  }

  // Output to file or console
  if (options.output) {
    const outputPath = path.resolve(process.cwd(), options.output);
    fs.writeFileSync(outputPath, output);
    if (format === 'json') {
      outputJson(success({ saved_to: outputPath }));
    } else {
      human.success(`✅ Report saved to ${outputPath}\n`);
    }
  } else {
    stdout(output);
  }
}

async function generateHtmlReportOutput(
  registry: IntrospectionRegistry,
  srcDir: string,
  outputPath?: string,
  theme?: string
): Promise<void> {
  if (!process.stdout.isTTY) {
    // Silent in non-TTY
  } else {
    human.info('🔍 Analyzing dependencies...\n');
  }

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
  const html = generateHtmlReport(reportData, totalFiles, { theme: theme ?? 'classic' });

  // Determine output path
  const finalPath = outputPath 
    ? path.resolve(process.cwd(), outputPath)
    : path.resolve(process.cwd(), 'introspection-report.html');

  fs.writeFileSync(finalPath, html);

  // Output result
  outputJson(success({
    report_path: finalPath,
    project_name: projectName,
    summary: {
      modules_with_metadata: registry.size(),
      total_files: totalFiles,
      coverage_percent: totalFiles > 0 ? Math.round((registry.size() / totalFiles) * 100) : 0,
      open_todos: registry.getAllTodos().length,
      open_fixes: registry.getAllFixes().length,
      circular_dependencies: circularDeps.length,
      unused_modules: unusedModules.length,
    }
  }));
}

function generateAllReportJson(registry: IntrospectionRegistry): string {
  const summary = registry.getSummary();
  const todos = registry.getAllTodos();
  const fixes = registry.getAllFixes();
  const recentlyUpdated = registry.getRecentlyUpdated(7);

  return JSON.stringify({
    success: true,
    result: {
      summary: {
        total_modules: summary.totalModules,
        todo_count: summary.todoCount,
        fix_count: summary.fixCount,
        recently_updated: summary.recentlyUpdated,
        status_breakdown: summary.statusBreakdown,
      },
      todos: todos.map(t => ({
        id: t.id,
        module: t.module,
        description: t.description,
        priority: t.priority,
        status: t.status,
        created_at: t.createdAt,
      })),
      fixes: fixes.map(f => ({
        id: f.id,
        module: f.module,
        description: f.description,
        severity: f.severity,
        status: f.status,
        created_at: f.createdAt,
      })),
      recently_updated: recentlyUpdated.map(m => ({
        module: m.module,
        updated_at: m.updatedAt,
      })),
    }
  }, null, 2);
}

function generateSummaryReport(
  registry: IntrospectionRegistry,
  format?: string
): string {
  const summary = registry.getSummary();
  const recentlyUpdated = registry.getRecentlyUpdated(7);

  if (format === 'json') {
    return JSON.stringify({
      success: true,
      result: {
        summary: {
          total_modules: summary.totalModules,
          todo_count: summary.todoCount,
          fix_count: summary.fixCount,
          recently_updated: summary.recentlyUpdated,
          status_breakdown: summary.statusBreakdown,
        },
        recently_updated_modules: recentlyUpdated.map(m => ({
          module: m.module,
          updated_at: m.updatedAt,
        })),
      }
    }, null, 2);
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

  if (format === 'table') {
    return `| Metric | Value |
|--------|-------|
| Total Modules | ${summary.totalModules} |
| Open TODOs | ${summary.todoCount} |
| Open Fixes | ${summary.fixCount} |
| Recently Updated | ${summary.recentlyUpdated} |
| Stable | ${summary.statusBreakdown.stable} |
| Beta | ${summary.statusBreakdown.beta} |
| Experimental | ${summary.statusBreakdown.experimental} |
| Deprecated | ${summary.statusBreakdown.deprecated} |`;
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
    return JSON.stringify({
      success: true,
      result: {
        count: todos.length,
        todos: todos.map(t => ({
          id: t.id,
          module: t.module,
          description: t.description,
          priority: t.priority,
          status: t.status,
          created_at: t.createdAt,
        })),
      }
    }, null, 2);
  }

  if (format === 'markdown' || format === 'table') {
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
    return JSON.stringify({
      success: true,
      result: {
        count: fixes.length,
        fixes: fixes.map(f => ({
          id: f.id,
          module: f.module,
          description: f.description,
          severity: f.severity,
          status: f.status,
          created_at: f.createdAt,
        })),
      }
    }, null, 2);
  }

  if (format === 'markdown' || format === 'table') {
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

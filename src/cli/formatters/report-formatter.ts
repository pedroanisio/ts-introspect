/**
 * Report Formatter
 * 
 * Specialized formatter for introspection reports.
 */

import chalk from 'chalk';
import type {
  OutputFormatter,
  OutputFormatType,
  FormatOptions
} from './index.js';

// ============================================
// Types
// ============================================

export interface TodoItem {
  id: string;
  description: string;
  module?: string;
  priority?: string;
  status?: string;
  createdAt?: string;
}

export interface FixItem {
  id: string;
  description: string;
  module?: string;
  severity?: string;
  status?: string;
  createdAt?: string;
}

export interface ReportSummary {
  totalModules: number;
  todoCount: number;
  fixCount: number;
  recentlyUpdated?: number;
  statusBreakdown?: Record<string, number>;
}

export interface ReportData {
  summary: ReportSummary;
  todos?: TodoItem[];
  fixes?: FixItem[];
  recentlyUpdatedModules?: { module: string; updatedAt: string }[];
}

// ============================================
// Report Formatter
// ============================================

/**
 * Formats report data with appropriate styling per format type
 */
export class ReportFormatter implements OutputFormatter<ReportData> {
  private formatType: OutputFormatType;

  constructor(format: OutputFormatType = 'json', _options: FormatOptions = {}) {
    this.formatType = format;
  }

  format(data: ReportData): string {
    switch (this.formatType) {
      case 'json':
        return this.formatJson(data);
      case 'table':
        return this.formatTable(data);
      case 'markdown':
        return this.formatMarkdown(data);
      case 'text':
      default:
        return this.formatText(data);
    }
  }

  private formatJson(data: ReportData): string {
    return JSON.stringify({
      success: true,
      result: {
        summary: {
          total_modules: data.summary.totalModules,
          todo_count: data.summary.todoCount,
          fix_count: data.summary.fixCount,
          recently_updated: data.summary.recentlyUpdated ?? 0,
          status_breakdown: data.summary.statusBreakdown ?? {}
        },
        todos: data.todos?.map(t => ({
          id: t.id,
          module: t.module,
          description: t.description,
          priority: t.priority,
          status: t.status,
          created_at: t.createdAt
        })) ?? [],
        fixes: data.fixes?.map(f => ({
          id: f.id,
          module: f.module,
          description: f.description,
          severity: f.severity,
          status: f.status,
          created_at: f.createdAt
        })) ?? []
      }
    }, null, 2);
  }

  private formatTable(data: ReportData): string {
    const lines: string[] = [];

    // Summary table
    lines.push('## Summary\n');
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    lines.push(`| Total Modules | ${data.summary.totalModules} |`);
    lines.push(`| Open TODOs | ${data.summary.todoCount} |`);
    lines.push(`| Open Fixes | ${data.summary.fixCount} |`);
    if (data.summary.recentlyUpdated !== undefined) {
      lines.push(`| Recently Updated | ${data.summary.recentlyUpdated} |`);
    }
    lines.push('');

    // Status breakdown if available
    if (data.summary.statusBreakdown) {
      lines.push('## Status Breakdown\n');
      lines.push('| Status | Count |');
      lines.push('|--------|-------|');
      for (const [status, count] of Object.entries(data.summary.statusBreakdown)) {
        lines.push(`| ${status} | ${count} |`);
      }
      lines.push('');
    }

    // TODOs table
    if (data.todos && data.todos.length > 0) {
      lines.push('## TODOs\n');
      lines.push('| ID | Module | Description | Priority | Status |');
      lines.push('|----|--------|-------------|----------|--------|');
      for (const todo of data.todos) {
        lines.push(`| ${todo.id} | ${todo.module ?? '-'} | ${todo.description} | ${todo.priority ?? '-'} | ${todo.status ?? '-'} |`);
      }
      lines.push('');
    }

    // Fixes table
    if (data.fixes && data.fixes.length > 0) {
      lines.push('## Fixes\n');
      lines.push('| ID | Module | Description | Severity | Status |');
      lines.push('|----|--------|-------------|----------|--------|');
      for (const fix of data.fixes) {
        lines.push(`| ${fix.id} | ${fix.module ?? '-'} | ${fix.description} | ${fix.severity ?? '-'} | ${fix.status ?? '-'} |`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  private formatMarkdown(data: ReportData): string {
    const lines: string[] = [];

    lines.push('# Project Introspection Report\n');

    // Summary
    lines.push('## Overview\n');
    lines.push(`- **Total Modules**: ${data.summary.totalModules}`);
    lines.push(`- **Open TODOs**: ${data.summary.todoCount}`);
    lines.push(`- **Open Fixes**: ${data.summary.fixCount}`);
    if (data.summary.recentlyUpdated !== undefined) {
      lines.push(`- **Recently Updated**: ${data.summary.recentlyUpdated} (last 7 days)`);
    }
    lines.push('');

    // Status breakdown
    if (data.summary.statusBreakdown) {
      lines.push('## Status Breakdown\n');
      lines.push('| Status | Count |');
      lines.push('|--------|-------|');
      for (const [status, count] of Object.entries(data.summary.statusBreakdown)) {
        lines.push(`| ${status} | ${count} |`);
      }
      lines.push('');
    }

    // TODOs
    if (data.todos && data.todos.length > 0) {
      lines.push('## TODOs\n');
      for (const todo of data.todos) {
        const priority = todo.priority ? `[${todo.priority.toUpperCase()}]` : '';
        lines.push(`### ${todo.id} ${priority}\n`);
        if (todo.module) {
          lines.push(`**Module**: \`${todo.module}\`\n`);
        }
        lines.push(`${todo.description}\n`);
        if (todo.status) {
          lines.push(`**Status**: ${todo.status}\n`);
        }
      }
    }

    // Fixes
    if (data.fixes && data.fixes.length > 0) {
      lines.push('## Open Fixes\n');
      for (const fix of data.fixes) {
        const severity = fix.severity ? `[${fix.severity.toUpperCase()}]` : '';
        lines.push(`### ${fix.id} ${severity}\n`);
        if (fix.module) {
          lines.push(`**Module**: \`${fix.module}\`\n`);
        }
        lines.push(`${fix.description}\n`);
        if (fix.status) {
          lines.push(`**Status**: ${fix.status}\n`);
        }
      }
    }

    return lines.join('\n');
  }

  private formatText(data: ReportData): string {
    const lines: string[] = [];

    // Header
    lines.push(chalk.bold('📊 PROJECT SUMMARY'));
    lines.push(chalk.gray('─'.repeat(40)));
    lines.push('');

    // Summary
    lines.push(`${chalk.white('Total Modules:')} ${chalk.cyan(data.summary.totalModules)}`);
    lines.push(`${chalk.white('Open TODOs:')}    ${chalk.yellow(data.summary.todoCount)}`);
    lines.push(`${chalk.white('Open Fixes:')}    ${chalk.red(data.summary.fixCount)}`);
    if (data.summary.recentlyUpdated !== undefined) {
      lines.push(`${chalk.white('Recent Updates:')} ${chalk.green(data.summary.recentlyUpdated)} (7 days)`);
    }
    lines.push('');

    // Status breakdown
    if (data.summary.statusBreakdown) {
      lines.push(chalk.bold('Status Breakdown:'));
      for (const [status, count] of Object.entries(data.summary.statusBreakdown)) {
        const color = status === 'stable' ? chalk.green :
                     status === 'deprecated' ? chalk.gray :
                     status === 'experimental' ? chalk.yellow : chalk.blue;
        lines.push(`  ${color(status)}: ${count}`);
      }
      lines.push('');
    }

    // TODOs
    if (data.todos && data.todos.length > 0) {
      lines.push(chalk.bold('📋 TODOs'));
      lines.push(chalk.gray('─'.repeat(40)));
      for (const todo of data.todos) {
        const priorityColor = 
          todo.priority === 'critical' ? chalk.red :
          todo.priority === 'high' ? chalk.yellow :
          todo.priority === 'medium' ? chalk.blue : chalk.gray;
        
        lines.push(`[${priorityColor(todo.priority?.toUpperCase() ?? 'MEDIUM')}] ${chalk.cyan(todo.module ?? 'unknown')}`);
        lines.push(`  └─ ${chalk.white(todo.id)}: ${todo.description}`);
        if (todo.status) {
          lines.push(`     ${chalk.gray(`Status: ${todo.status}`)}`);
        }
      }
      lines.push('');
    }

    // Fixes
    if (data.fixes && data.fixes.length > 0) {
      lines.push(chalk.bold('🔧 OPEN FIXES'));
      lines.push(chalk.gray('─'.repeat(40)));
      for (const fix of data.fixes) {
        const severityColor = 
          fix.severity === 'critical' ? chalk.red :
          fix.severity === 'major' ? chalk.yellow :
          fix.severity === 'minor' ? chalk.blue : chalk.gray;
        
        lines.push(`[${severityColor(fix.severity?.toUpperCase() ?? 'MINOR')}] ${chalk.cyan(fix.module ?? 'unknown')}`);
        lines.push(`  └─ ${chalk.white(fix.id)}: ${fix.description}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}


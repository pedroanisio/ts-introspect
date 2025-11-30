/**
 * Lint Result Formatter
 * 
 * Specialized formatter for lint/validation results.
 */

import chalk from 'chalk';
import {
  getFormatter,
  type OutputFormatter,
  type OutputFormatType,
  type FormatOptions
} from './index.js';

// ============================================
// Types
// ============================================

export interface LintError {
  rule: string;
  message: string;
  fixable?: boolean;
}

export interface LintWarning {
  rule: string;
  message: string;
}

export interface LintFileResult {
  file: string;
  relativePath?: string;
  errors: LintError[];
  warnings: LintWarning[];
}

export interface LintSummary {
  totalErrors: number;
  totalWarnings: number;
  filesChecked: number;
  filesWithIssues: number;
  passed: boolean;
}

// ============================================
// Lint Result Formatter
// ============================================

/**
 * Formats lint results with appropriate styling per format type
 */
export class LintResultFormatter implements OutputFormatter<LintFileResult[]> {
  private formatType: OutputFormatType;

  constructor(format: OutputFormatType = 'json', _options: FormatOptions = {}) {
    this.formatType = format;
  }

  format(results: LintFileResult[]): string {
    switch (this.formatType) {
      case 'json':
        return this.formatJson(results);
      case 'table':
        return this.formatTable(results);
      case 'markdown':
        return this.formatMarkdown(results);
      case 'text':
      default:
        return this.formatText(results);
    }
  }

  private formatJson(results: LintFileResult[]): string {
    const summary = this.calculateSummary(results);
    return JSON.stringify({
      summary,
      results: results.map(r => ({
        file: r.file,
        relative_path: r.relativePath ?? r.file,
        errors: r.errors,
        warnings: r.warnings
      }))
    }, null, 2);
  }

  private formatTable(results: LintFileResult[]): string {
    const rows: { File: string; Type: string; Rule: string; Message: string }[] = [];

    for (const result of results) {
      const file = result.relativePath ?? result.file;
      for (const error of result.errors) {
        rows.push({ File: file, Type: 'ERROR', Rule: error.rule, Message: error.message });
      }
      for (const warning of result.warnings) {
        rows.push({ File: file, Type: 'WARN', Rule: warning.rule, Message: warning.message });
      }
    }

    if (rows.length === 0) {
      return '_No issues found_';
    }

    const formatter = getFormatter<typeof rows>('table');
    const summary = this.calculateSummary(results);
    
    return `${formatter.format(rows)}\n\n**Summary:** ${summary.totalErrors} errors, ${summary.totalWarnings} warnings`;
  }

  private formatMarkdown(results: LintFileResult[]): string {
    const summary = this.calculateSummary(results);
    const lines: string[] = [];

    lines.push('# Lint Results\n');
    lines.push(`- **Files checked:** ${summary.filesChecked}`);
    lines.push(`- **Errors:** ${summary.totalErrors}`);
    lines.push(`- **Warnings:** ${summary.totalWarnings}`);
    lines.push(`- **Status:** ${summary.passed ? '✅ Passed' : '❌ Failed'}`);
    lines.push('');

    for (const result of results) {
      if (result.errors.length === 0 && result.warnings.length === 0) {
        continue;
      }

      const file = result.relativePath ?? result.file;
      lines.push(`## \`${file}\`\n`);

      if (result.errors.length > 0) {
        lines.push('### Errors\n');
        for (const error of result.errors) {
          lines.push(`- **[${error.rule}]** ${error.message}`);
        }
        lines.push('');
      }

      if (result.warnings.length > 0) {
        lines.push('### Warnings\n');
        for (const warning of result.warnings) {
          lines.push(`- **[${warning.rule}]** ${warning.message}`);
        }
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  private formatText(results: LintFileResult[]): string {
    const summary = this.calculateSummary(results);
    const lines: string[] = [];

    for (const result of results) {
      if (result.errors.length === 0 && result.warnings.length === 0) {
        continue;
      }

      const file = result.relativePath ?? result.file;
      lines.push(chalk.white(`📄 ${file}`));

      for (const error of result.errors) {
        lines.push(chalk.red(`   ❌ [${error.rule}] ${error.message}`));
      }

      for (const warning of result.warnings) {
        lines.push(chalk.yellow(`   ⚠️  [${warning.rule}] ${warning.message}`));
      }

      lines.push('');
    }

    // Summary
    lines.push(chalk.gray('─'.repeat(50)));
    lines.push(`📊 Summary: ${chalk.red(`${summary.totalErrors} error${summary.totalErrors !== 1 ? 's' : ''}`)}, ${chalk.yellow(`${summary.totalWarnings} warning${summary.totalWarnings !== 1 ? 's' : ''}`)}`);
    lines.push(`   Files checked: ${summary.filesChecked}`);
    lines.push(`   Files with issues: ${summary.filesWithIssues}`);

    if (summary.passed) {
      lines.push(chalk.green('\n✅ Linting passed'));
    } else {
      lines.push(chalk.red('\n❌ Linting failed'));
    }

    return lines.join('\n');
  }

  private calculateSummary(results: LintFileResult[]): LintSummary {
    let totalErrors = 0;
    let totalWarnings = 0;
    let filesWithIssues = 0;

    for (const result of results) {
      totalErrors += result.errors.length;
      totalWarnings += result.warnings.length;
      if (result.errors.length > 0 || result.warnings.length > 0) {
        filesWithIssues++;
      }
    }

    return {
      totalErrors,
      totalWarnings,
      filesChecked: results.length,
      filesWithIssues,
      passed: totalErrors === 0
    };
  }
}


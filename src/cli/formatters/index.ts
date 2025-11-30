/**
 * Output Formatters
 * 
 * Strategy Pattern implementation for flexible output formatting.
 * Provides consistent interface for JSON, table, text, and markdown output.
 */

// ============================================
// Types
// ============================================

/**
 * Format options shared across formatters
 */
export interface FormatOptions {
  /** Compact output (no indentation/whitespace) */
  compact?: boolean;
  /** Custom column names for table format */
  columns?: string[];
  /** Header name mapping */
  headers?: Record<string, string>;
  /** Bullet point prefix for lists */
  bulletPrefix?: string;
  /** Heading level for markdown */
  headingLevel?: number;
}

/**
 * Supported output format types
 */
export type OutputFormatType = 'json' | 'table' | 'text' | 'markdown';

// ============================================
// Base Interface
// ============================================

/**
 * OutputFormatter interface (Strategy Pattern)
 * 
 * All formatters must implement this interface to ensure
 * consistent formatting capabilities across the application.
 */
export interface OutputFormatter<T> {
  /**
   * Format data to string output
   * @param data - Data to format
   * @returns Formatted string
   */
  format(data: T): string;
}

// ============================================
// JSON Formatter
// ============================================

/**
 * Formats data as JSON string
 */
export class JsonFormatter<T> implements OutputFormatter<T> {
  private options: FormatOptions;

  constructor(options: FormatOptions = {}) {
    this.options = options;
  }

  format(data: T): string {
    if (this.options.compact) {
      return JSON.stringify(data);
    }
    return JSON.stringify(data, null, 2);
  }
}

// ============================================
// Table Formatter
// ============================================

/**
 * Formats data as markdown table
 */
export class TableFormatter<T> implements OutputFormatter<T> {
  private options: FormatOptions;

  constructor(options: FormatOptions = {}) {
    this.options = options;
  }

  format(data: T): string {
    // Normalize to array
    const items = Array.isArray(data) ? data : [data];
    
    if (items.length === 0) {
      return '_No data_';
    }

    // Get columns from first item or options
    const firstItem = items[0] as Record<string, unknown>;
    if (!firstItem || typeof firstItem !== 'object') {
      return '_No data_';
    }

    const allColumns = Object.keys(firstItem);
    const columns = this.options.columns ?? allColumns;
    
    // Build header row
    const headers = this.options.headers ?? {};
    const headerRow = columns.map(col => headers[col] ?? col);
    
    // Build separator
    const separator = columns.map(() => '------');
    
    // Build data rows
    const rows = items.map(item => {
      const record = item as Record<string, unknown>;
      return columns.map(col => {
        const value = record[col];
        return this.escapeCell(this.stringify(value));
      });
    });

    // Assemble table
    const lines = [
      `| ${headerRow.join(' | ')} |`,
      `|${separator.join('|')}|`,
      ...rows.map(row => `| ${row.join(' | ')} |`)
    ];

    return lines.join('\n');
  }

  private escapeCell(value: string): string {
    // Escape pipe characters
    return value.replace(/\|/g, '\\|');
  }

  private stringify(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return JSON.stringify(value);
  }
}

// ============================================
// Text Formatter
// ============================================

/**
 * Formats data as human-readable text
 */
export class TextFormatter<T> implements OutputFormatter<T> {
  private options: FormatOptions;

  constructor(options: FormatOptions = {}) {
    this.options = options;
  }

  format(data: T): string {
    return this.formatValue(data, 0);
  }

  private formatValue(value: unknown, indent: number): string {
    const prefix = '  '.repeat(indent);
    const bulletPrefix = this.options.bulletPrefix ?? '• ';

    // Handle primitives
    if (value === null || value === undefined) {
      return 'null';
    }
    
    if (typeof value === 'string') {
      return value;
    }
    
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    // Handle arrays
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return '_empty_';
      }
      
      // Simple string/number arrays get bullet points
      if (value.every(v => typeof v === 'string' || typeof v === 'number')) {
        return value.map(v => `${prefix}${bulletPrefix}${v}`).join('\n');
      }
      
      // Complex arrays recurse
      return value.map(v => this.formatValue(v, indent)).join('\n');
    }

    // Handle objects
    if (typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>);
      if (entries.length === 0) {
        return '{}';
      }

      return entries.map(([key, val]) => {
        if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
          // Nested object
          return `${prefix}${key}:\n${this.formatValue(val, indent + 1)}`;
        } else if (Array.isArray(val)) {
          // Array value
          return `${prefix}${key}:\n${this.formatValue(val, indent + 1)}`;
        } else {
          // Simple value
          return `${prefix}${key}: ${this.stringify(val)}`;
        }
      }).join('\n');
    }

    return this.stringify(value);
  }

  private stringify(value: unknown): string {
    if (value === null || value === undefined) {
      return 'null';
    }
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return JSON.stringify(value);
  }
}

// ============================================
// Markdown Formatter
// ============================================

/**
 * Formats data as markdown document
 */
export class MarkdownFormatter<T> implements OutputFormatter<T> {
  private options: FormatOptions;

  constructor(options: FormatOptions = {}) {
    this.options = options;
  }

  format(data: T): string {
    return this.formatValue(data, this.options.headingLevel ?? 1);
  }

  private formatValue(value: unknown, headingLevel: number): string {
    // Handle primitives
    if (value === null || value === undefined) {
      return '_null_';
    }
    
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    // Handle arrays
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return '_empty_';
      }
      return value.map(v => `- ${this.formatValue(v, headingLevel)}`).join('\n');
    }

    // Handle objects
    if (typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>);
      if (entries.length === 0) {
        return '_empty object_';
      }

      const heading = '#'.repeat(Math.min(headingLevel, 6));

      return entries.map(([key, val]) => {
        if (Array.isArray(val)) {
          return `**${key}**:\n${this.formatValue(val, headingLevel + 1)}`;
        } else if (typeof val === 'object' && val !== null) {
          return `${heading} ${key}\n${this.formatValue(val, headingLevel + 1)}`;
        } else {
          return `**${key}**: ${this.stringify(val)}`;
        }
      }).join('\n');
    }

    return this.stringify(value);
  }

  private stringify(value: unknown): string {
    if (value === null || value === undefined) {
      return '_null_';
    }
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return JSON.stringify(value);
  }
}

// ============================================
// Factory Function
// ============================================

/**
 * Get formatter instance by format type
 * 
 * @param format - Output format type
 * @param options - Formatter options
 * @returns Formatter instance
 * 
 * @example
 * ```typescript
 * const formatter = getFormatter<MyData>('json');
 * const output = formatter.format(myData);
 * ```
 */
export function getFormatter<T>(
  format: OutputFormatType,
  options: FormatOptions = {}
): OutputFormatter<T> {
  switch (format) {
    case 'json':
      return new JsonFormatter<T>(options);
    case 'table':
      return new TableFormatter<T>(options);
    case 'text':
      return new TextFormatter<T>(options);
    case 'markdown':
      return new MarkdownFormatter<T>(options);
    default:
      // Default to JSON for unknown formats
      return new JsonFormatter<T>(options);
  }
}


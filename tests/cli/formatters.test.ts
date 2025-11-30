/**
 * Output Formatters Tests
 * 
 * TDD: RED phase - Tests for Strategy Pattern formatters
 */

import { describe, it, expect } from 'vitest';
import {
  OutputFormatter,
  JsonFormatter,
  TableFormatter,
  TextFormatter,
  MarkdownFormatter,
  getFormatter,
  type FormatOptions
} from '@/cli/formatters/index.js';

// Test data types
interface LintResult {
  file: string;
  errors: Array<{ rule: string; message: string }>;
  warnings: Array<{ rule: string; message: string }>;
}

interface Summary {
  total: number;
  passed: number;
  failed: number;
}

describe('Output Formatters', () => {
  // Sample test data
  const lintResults: LintResult[] = [
    {
      file: 'src/test.ts',
      errors: [{ rule: 'metadata/required', message: 'Missing metadata' }],
      warnings: [{ rule: 'metadata/stale', message: 'Stale metadata' }]
    },
    {
      file: 'src/utils.ts',
      errors: [],
      warnings: []
    }
  ];

  const summary: Summary = {
    total: 10,
    passed: 8,
    failed: 2
  };

  describe('JsonFormatter', () => {
    it('should format data as JSON string', () => {
      const formatter = new JsonFormatter<Summary>();
      const result = formatter.format(summary);
      
      expect(result).toBe(JSON.stringify(summary, null, 2));
    });

    it('should handle nested objects', () => {
      const formatter = new JsonFormatter<LintResult[]>();
      const result = formatter.format(lintResults);
      
      const parsed = JSON.parse(result);
      expect(parsed).toEqual(lintResults);
    });

    it('should handle arrays', () => {
      const formatter = new JsonFormatter<string[]>();
      const result = formatter.format(['a', 'b', 'c']);
      
      expect(result).toBe(JSON.stringify(['a', 'b', 'c'], null, 2));
    });

    it('should handle null and undefined', () => {
      const formatter = new JsonFormatter<null>();
      expect(formatter.format(null)).toBe('null');
    });

    it('should support compact option', () => {
      const formatter = new JsonFormatter<Summary>({ compact: true });
      const result = formatter.format(summary);
      
      expect(result).toBe(JSON.stringify(summary));
      expect(result).not.toContain('\n');
    });
  });

  describe('TableFormatter', () => {
    it('should format array of objects as markdown table', () => {
      const data = [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 }
      ];
      const formatter = new TableFormatter<typeof data>();
      const result = formatter.format(data);
      
      expect(result).toContain('| name | age |');
      expect(result).toMatch(/\|[-]+\|[-]+\|/); // Separator with dashes
      expect(result).toContain('| Alice | 30 |');
      expect(result).toContain('| Bob | 25 |');
    });

    it('should handle empty array', () => {
      const formatter = new TableFormatter<never[]>();
      const result = formatter.format([]);
      
      expect(result).toBe('_No data_');
    });

    it('should support custom columns', () => {
      const data = [
        { name: 'Alice', age: 30, city: 'NYC' },
        { name: 'Bob', age: 25, city: 'LA' }
      ];
      const formatter = new TableFormatter<typeof data>({
        columns: ['name', 'city']
      });
      const result = formatter.format(data);
      
      expect(result).toContain('| name | city |');
      expect(result).not.toContain('age');
    });

    it('should support column headers mapping', () => {
      const data = [{ fileName: 'test.ts', errorCount: 5 }];
      const formatter = new TableFormatter<typeof data>({
        headers: { fileName: 'File', errorCount: 'Errors' }
      });
      const result = formatter.format(data);
      
      expect(result).toContain('| File | Errors |');
    });

    it('should handle non-array input by wrapping in array', () => {
      const data = { name: 'Single', value: 42 };
      const formatter = new TableFormatter<typeof data>();
      const result = formatter.format(data);
      
      expect(result).toContain('| name | value |');
      expect(result).toContain('| Single | 42 |');
    });

    it('should escape pipe characters in values', () => {
      const data = [{ text: 'Hello | World' }];
      const formatter = new TableFormatter<typeof data>();
      const result = formatter.format(data);
      
      expect(result).toContain('Hello \\| World');
    });
  });

  describe('TextFormatter', () => {
    it('should format simple object as key-value pairs', () => {
      const formatter = new TextFormatter<Summary>();
      const result = formatter.format(summary);
      
      expect(result).toContain('total: 10');
      expect(result).toContain('passed: 8');
      expect(result).toContain('failed: 2');
    });

    it('should format array with bullet points', () => {
      const data = ['Item 1', 'Item 2', 'Item 3'];
      const formatter = new TextFormatter<string[]>();
      const result = formatter.format(data);
      
      expect(result).toContain('• Item 1');
      expect(result).toContain('• Item 2');
      expect(result).toContain('• Item 3');
    });

    it('should handle nested objects with indentation', () => {
      const data = {
        parent: {
          child: 'value'
        }
      };
      const formatter = new TextFormatter<typeof data>();
      const result = formatter.format(data);
      
      expect(result).toContain('parent:');
      expect(result).toContain('  child: value');
    });

    it('should support custom prefix', () => {
      const data = ['a', 'b'];
      const formatter = new TextFormatter<string[]>({ bulletPrefix: '→ ' });
      const result = formatter.format(data);
      
      expect(result).toContain('→ a');
      expect(result).toContain('→ b');
    });

    it('should handle primitives', () => {
      const formatter = new TextFormatter<string>();
      expect(formatter.format('Hello')).toBe('Hello');
      
      const numFormatter = new TextFormatter<number>();
      expect(numFormatter.format(42)).toBe('42');
    });
  });

  describe('MarkdownFormatter', () => {
    it('should format data as markdown', () => {
      const data = {
        title: 'Report',
        items: ['a', 'b'],
        count: 2
      };
      const formatter = new MarkdownFormatter<typeof data>();
      const result = formatter.format(data);
      
      expect(result).toContain('**title**: Report');
      expect(result).toContain('**items**:');
      expect(result).toContain('- a');
      expect(result).toContain('- b');
      expect(result).toContain('**count**: 2');
    });

    it('should support heading level option', () => {
      const data = { 
        section: { 
          nested: 'Content' 
        } 
      };
      const formatter = new MarkdownFormatter<typeof data>({
        headingLevel: 2
      });
      const result = formatter.format(data);
      
      // Should use ## for h2 level sections (nested objects get headings)
      expect(result).toMatch(/##/);
    });
  });

  describe('getFormatter factory', () => {
    it('should return JsonFormatter for "json"', () => {
      const formatter = getFormatter<Summary>('json');
      expect(formatter).toBeInstanceOf(JsonFormatter);
    });

    it('should return TableFormatter for "table"', () => {
      const formatter = getFormatter<Summary>('table');
      expect(formatter).toBeInstanceOf(TableFormatter);
    });

    it('should return TextFormatter for "text"', () => {
      const formatter = getFormatter<Summary>('text');
      expect(formatter).toBeInstanceOf(TextFormatter);
    });

    it('should return MarkdownFormatter for "markdown"', () => {
      const formatter = getFormatter<Summary>('markdown');
      expect(formatter).toBeInstanceOf(MarkdownFormatter);
    });

    it('should default to JsonFormatter for unknown format', () => {
      const formatter = getFormatter<Summary>('unknown' as any);
      expect(formatter).toBeInstanceOf(JsonFormatter);
    });

    it('should pass options to formatter', () => {
      const formatter = getFormatter<Summary>('json', { compact: true });
      const result = formatter.format(summary);
      
      expect(result).not.toContain('\n');
    });
  });

  describe('OutputFormatter interface contract', () => {
    const formatters = [
      new JsonFormatter<Summary>(),
      new TableFormatter<Summary>(),
      new TextFormatter<Summary>(),
      new MarkdownFormatter<Summary>()
    ];

    it.each(formatters)('formatter should return string', (formatter) => {
      const result = formatter.format(summary);
      expect(typeof result).toBe('string');
    });

    it.each(formatters)('formatter should handle empty object', (formatter) => {
      const result = formatter.format({} as Summary);
      expect(typeof result).toBe('string');
    });
  });

  describe('Specialized formatters', () => {
    describe('LintResultFormatter', () => {
      it('should format lint results with proper structure', async () => {
        const { LintResultFormatter } = await import('@/cli/formatters/lint-formatter.js');
        const formatter = new LintResultFormatter('text');
        const result = formatter.format(lintResults);
        
        expect(result).toContain('src/test.ts');
        expect(result).toContain('Missing metadata');
        expect(result).toContain('Stale metadata');
      });

      it('should show error/warning counts in summary', async () => {
        const { LintResultFormatter } = await import('@/cli/formatters/lint-formatter.js');
        const formatter = new LintResultFormatter('text');
        const result = formatter.format(lintResults);
        
        expect(result).toMatch(/\d+ error/);
        expect(result).toMatch(/\d+ warning/);
      });
    });

    describe('ReportFormatter', () => {
      it('should format report data appropriately', async () => {
        const { ReportFormatter } = await import('@/cli/formatters/report-formatter.js');
        const reportData = {
          summary: { totalModules: 10, todoCount: 5, fixCount: 2 },
          todos: [{ id: 'TODO-1', description: 'Fix bug' }],
          fixes: []
        };
        
        const formatter = new ReportFormatter('markdown');
        const result = formatter.format(reportData);
        
        expect(result).toContain('10'); // totalModules
        expect(result).toContain('TODO-1');
      });
    });
  });
});


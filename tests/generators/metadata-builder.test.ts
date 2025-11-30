/**
 * MetadataBuilder Tests
 * 
 * TDD: RED phase - Tests for Builder Pattern metadata generation
 */

import { describe, it, expect } from 'vitest';
import {
  MetadataBuilder,
  type MetadataBuilderOptions
} from '@/generators/metadata-builder.js';

describe('MetadataBuilder', () => {
  describe('Basic Building', () => {
    it('should create builder with required fields', () => {
      const builder = new MetadataBuilder({
        module: 'core/utils',
        filename: 'utils.ts'
      });
      
      const result = builder.build();
      
      expect(result).toContain("module: 'core/utils'");
      expect(result).toContain("filename: 'utils.ts'");
    });

    it('should generate valid TypeScript export', () => {
      const builder = new MetadataBuilder({
        module: 'test',
        filename: 'test.ts'
      });
      
      const result = builder.build();
      
      expect(result).toContain('export const __metadata');
      expect(result).toContain('as const;');
    });

    it('should include header comment', () => {
      const builder = new MetadataBuilder({
        module: 'test',
        filename: 'test.ts'
      });
      
      const result = builder.build();
      
      expect(result).toContain('// ============================================');
      expect(result).toContain('// FILE INTROSPECTION METADATA');
      expect(result).toContain('/** @internal');
    });
  });

  describe('Fluent API', () => {
    it('should set description', () => {
      const result = new MetadataBuilder({
        module: 'test',
        filename: 'test.ts'
      })
        .description('A useful utility module')
        .build();
      
      expect(result).toContain("description: 'A useful utility module'");
    });

    it('should set responsibilities', () => {
      const result = new MetadataBuilder({
        module: 'test',
        filename: 'test.ts'
      })
        .responsibilities(['Handle data validation', 'Parse input'])
        .build();
      
      expect(result).toContain("'Handle data validation'");
      expect(result).toContain("'Parse input'");
    });

    it('should set exports', () => {
      const result = new MetadataBuilder({
        module: 'test',
        filename: 'test.ts'
      })
        .exports(['MyClass', 'helperFunction', 'CONSTANT'])
        .build();
      
      expect(result).toContain("exports: ['MyClass', 'helperFunction', 'CONSTANT']");
    });

    it('should set status', () => {
      const result = new MetadataBuilder({
        module: 'test',
        filename: 'test.ts'
      })
        .status('experimental')
        .build();
      
      expect(result).toContain("status: 'experimental'");
    });

    it('should set dates', () => {
      const result = new MetadataBuilder({
        module: 'test',
        filename: 'test.ts'
      })
        .createdAt('2024-01-15')
        .updatedAt('2024-06-20')
        .build();
      
      expect(result).toContain("createdAt: '2024-01-15'");
      expect(result).toContain("updatedAt: '2024-06-20'");
    });

    it('should support method chaining', () => {
      const builder = new MetadataBuilder({
        module: 'test',
        filename: 'test.ts'
      });
      
      const result = builder
        .description('Test module')
        .status('stable')
        .exports(['foo', 'bar'])
        .build();
      
      expect(result).toContain("description: 'Test module'");
      expect(result).toContain("status: 'stable'");
      expect(result).toContain("exports: ['foo', 'bar']");
    });
  });

  describe('Dependencies', () => {
    it('should set internal dependencies', () => {
      const result = new MetadataBuilder({
        module: 'test',
        filename: 'test.ts'
      })
        .internalDeps(['./utils', './helpers'])
        .build();
      
      expect(result).toContain("internal: ['./utils', './helpers']");
    });

    it('should set external dependencies', () => {
      const result = new MetadataBuilder({
        module: 'test',
        filename: 'test.ts'
      })
        .externalDeps(['lodash', 'react'])
        .build();
      
      expect(result).toContain("external: ['lodash', 'react']");
    });

    it('should set type dependencies', () => {
      const result = new MetadataBuilder({
        module: 'test',
        filename: 'test.ts'
      })
        .typeDeps(['./types', '@types/node'])
        .build();
      
      expect(result).toContain("types: ['./types', '@types/node']");
    });

    it('should set all dependencies at once', () => {
      const result = new MetadataBuilder({
        module: 'test',
        filename: 'test.ts'
      })
        .dependencies({
          internal: ['./a', './b'],
          external: ['pkg'],
          types: ['./types']
        })
        .build();
      
      expect(result).toContain("internal: ['./a', './b']");
      expect(result).toContain("external: ['pkg']");
      expect(result).toContain("types: ['./types']");
    });
  });

  describe('React Metadata', () => {
    it('should set component type', () => {
      const result = new MetadataBuilder({
        module: 'components/Button',
        filename: 'Button.tsx'
      })
        .componentType('functional')
        .build();
      
      expect(result).toContain("componentType: 'functional'");
    });

    it('should set props info', () => {
      const result = new MetadataBuilder({
        module: 'components/Button',
        filename: 'Button.tsx'
      })
        .props({
          interfaceName: 'ButtonProps',
          properties: [
            { name: 'onClick', type: '() => void', required: true },
            { name: 'disabled', type: 'boolean', required: false }
          ]
        })
        .build();
      
      expect(result).toContain("interfaceName: 'ButtonProps'");
      expect(result).toContain("name: 'onClick'");
      expect(result).toContain("type: '() => void'");
    });

    it('should set hooks', () => {
      const result = new MetadataBuilder({
        module: 'components/Button',
        filename: 'Button.tsx'
      })
        .hooks([
          { name: 'useState', isCustom: false },
          { name: 'useCustomHook', isCustom: true }
        ])
        .build();
      
      expect(result).toContain("{ name: 'useState', isCustom: false }");
      expect(result).toContain("{ name: 'useCustomHook', isCustom: true }");
    });

    it('should set contexts', () => {
      const result = new MetadataBuilder({
        module: 'components/Button',
        filename: 'Button.tsx'
      })
        .contexts(['ThemeContext', 'UserContext'])
        .build();
      
      expect(result).toContain("contexts: ['ThemeContext', 'UserContext']");
    });

    it('should set renders (child components)', () => {
      const result = new MetadataBuilder({
        module: 'components/Button',
        filename: 'Button.tsx'
      })
        .renders(['Icon', 'Spinner', 'Text'])
        .build();
      
      expect(result).toContain("renders: ['Icon', 'Spinner', 'Text']");
    });

    it('should set forwardRef flag', () => {
      const result = new MetadataBuilder({
        module: 'components/Button',
        filename: 'Button.tsx'
      })
        .forwardRef(true)
        .build();
      
      expect(result).toContain('forwardRef: true');
    });

    it('should set memoized flag', () => {
      const result = new MetadataBuilder({
        module: 'components/Button',
        filename: 'Button.tsx'
      })
        .memoized(true)
        .build();
      
      expect(result).toContain('memoized: true');
    });
  });

  describe('Optional Fields', () => {
    it('should set notes', () => {
      const result = new MetadataBuilder({
        module: 'test',
        filename: 'test.ts'
      })
        .notes('This module is critical for the auth flow')
        .build();
      
      expect(result).toContain("notes: 'This module is critical for the auth flow'");
    });

    it('should set seeAlso references', () => {
      const result = new MetadataBuilder({
        module: 'test',
        filename: 'test.ts'
      })
        .seeAlso(['./related-module', './another-module'])
        .build();
      
      expect(result).toContain("seeAlso: ['./related-module', './another-module']");
    });

    it('should set tags', () => {
      const result = new MetadataBuilder({
        module: 'test',
        filename: 'test.ts'
      })
        .tags(['api', 'core', 'auth'])
        .build();
      
      expect(result).toContain("tags: ['api', 'core', 'auth']");
    });
  });

  describe('Changelog', () => {
    it('should set changelog entries', () => {
      const result = new MetadataBuilder({
        module: 'test',
        filename: 'test.ts'
      })
        .changelog([
          { version: '1.0.0', date: '2024-01-01', changes: ['Initial release'] },
          { version: '1.1.0', date: '2024-03-15', changes: ['Added feature X', 'Fixed bug Y'] }
        ])
        .build();
      
      expect(result).toContain("version: '1.0.0'");
      expect(result).toContain("'Initial release'");
      expect(result).toContain("version: '1.1.0'");
      expect(result).toContain("'Added feature X'");
    });
  });

  describe('Todos and Fixes', () => {
    it('should set todo items', () => {
      const result = new MetadataBuilder({
        module: 'test',
        filename: 'test.ts'
      })
        .todos([
          { id: 'TODO-1', description: 'Add unit tests', priority: 'high', status: 'pending', createdAt: '2024-01-01' }
        ])
        .build();
      
      expect(result).toContain("id: 'TODO-1'");
      expect(result).toContain("description: 'Add unit tests'");
      expect(result).toContain("priority: 'high'");
    });

    it('should set fix items', () => {
      const result = new MetadataBuilder({
        module: 'test',
        filename: 'test.ts'
      })
        .fixes([
          { id: 'FIX-1', description: 'Memory leak', severity: 'critical', status: 'open', createdAt: '2024-01-01' }
        ])
        .build();
      
      expect(result).toContain("id: 'FIX-1'");
      expect(result).toContain("description: 'Memory leak'");
      expect(result).toContain("severity: 'critical'");
    });
  });

  describe('Internal Meta', () => {
    it('should set content hash', () => {
      const result = new MetadataBuilder({
        module: 'test',
        filename: 'test.ts'
      })
        .contentHash('abc123def456')
        .build();
      
      expect(result).toContain("contentHash: 'abc123def456'");
    });

    it('should set lastValidated', () => {
      const result = new MetadataBuilder({
        module: 'test',
        filename: 'test.ts'
      })
        .lastValidated('2024-06-20')
        .build();
      
      expect(result).toContain("lastValidated: '2024-06-20'");
    });

    it('should set generatedDeps', () => {
      const result = new MetadataBuilder({
        module: 'test',
        filename: 'test.ts'
      })
        .generatedDeps(['./auto-detected', './another'])
        .build();
      
      expect(result).toContain("generatedDeps: ['./auto-detected', './another']");
    });
  });

  describe('String Escaping', () => {
    it('should escape single quotes in strings', () => {
      const result = new MetadataBuilder({
        module: 'test',
        filename: 'test.ts'
      })
        .description("It's a great module")
        .build();
      
      expect(result).toContain("description: 'It\\'s a great module'");
    });

    it('should handle special characters in arrays', () => {
      const result = new MetadataBuilder({
        module: 'test',
        filename: 'test.ts'
      })
        .tags(["it's", "has'quote"])
        .build();
      
      expect(result).toContain("'it\\'s'");
      expect(result).toContain("'has\\'quote'");
    });
  });

  describe('Default Values', () => {
    it('should use default description when not set', () => {
      const result = new MetadataBuilder({
        module: 'test',
        filename: 'test.ts'
      }).build();
      
      expect(result).toContain("description: 'TODO: Add description'");
    });

    it('should use default status when not set', () => {
      const result = new MetadataBuilder({
        module: 'test',
        filename: 'test.ts'
      }).build();
      
      expect(result).toContain("status: 'stable'");
    });

    it('should use today for dates when not set', () => {
      const today = new Date().toISOString().split('T')[0];
      const result = new MetadataBuilder({
        module: 'test',
        filename: 'test.ts'
      }).build();
      
      expect(result).toContain(`createdAt: '${today}'`);
      expect(result).toContain(`updatedAt: '${today}'`);
    });
  });

  describe('buildObject()', () => {
    it('should return metadata as object instead of string', () => {
      const builder = new MetadataBuilder({
        module: 'test',
        filename: 'test.ts'
      })
        .description('Test module')
        .status('stable');
      
      const obj = builder.buildObject();
      
      expect(obj.module).toBe('test');
      expect(obj.filename).toBe('test.ts');
      expect(obj.description).toBe('Test module');
      expect(obj.status).toBe('stable');
    });
  });
});


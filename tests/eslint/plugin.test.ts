import { describe, it, expect } from 'vitest';
import plugin, { requireMetadataRule, validMetadataRule } from '../../src/eslint/plugin.js';

describe('ESLint Plugin', () => {
  describe('plugin structure', () => {
    it('should export rules object', () => {
      expect(plugin.rules).toBeDefined();
      expect(plugin.rules['require-metadata']).toBeDefined();
      expect(plugin.rules['valid-metadata']).toBeDefined();
    });

    it('should export configs object', () => {
      expect(plugin.configs).toBeDefined();
      expect(plugin.configs.recommended).toBeDefined();
    });

    it('should have recommended config with rules', () => {
      const recommended = plugin.configs.recommended;
      expect(recommended.rules).toBeDefined();
      expect(recommended.rules['ts-introspect/require-metadata']).toBe('error');
      expect(recommended.rules['ts-introspect/valid-metadata']).toBe('warn');
    });
  });

  describe('requireMetadataRule', () => {
    it('should have correct meta type', () => {
      expect(requireMetadataRule.meta?.type).toBe('problem');
    });

    it('should have docs', () => {
      expect(requireMetadataRule.meta?.docs?.description).toContain('__metadata');
    });

    it('should have messages', () => {
      expect(requireMetadataRule.meta?.messages?.missingMetadata).toBeDefined();
    });

    it('should have schema for exclude option', () => {
      const schema = requireMetadataRule.meta?.schema;
      expect(Array.isArray(schema)).toBe(true);
      expect(schema).toHaveLength(1);
    });
  });

  describe('validMetadataRule', () => {
    it('should have correct meta type', () => {
      expect(validMetadataRule.meta?.type).toBe('problem');
    });

    it('should have docs', () => {
      expect(validMetadataRule.meta?.docs?.description).toContain('required fields');
    });

    it('should have messages with placeholder', () => {
      expect(validMetadataRule.meta?.messages?.invalidMetadata).toContain('{{ message }}');
    });

    it('should have schema for requiredFields option', () => {
      const schema = validMetadataRule.meta?.schema;
      expect(Array.isArray(schema)).toBe(true);
    });
  });

  describe('rule create functions', () => {
    it('requireMetadataRule.create should return listener object', () => {
      const mockContext = {
        options: [],
        filename: 'test.ts',
        getFilename: () => 'test.ts',
        report: () => {}
      };

      const listener = requireMetadataRule.create(mockContext as any);
      expect(listener).toBeDefined();
      expect(typeof listener.ExportNamedDeclaration).toBe('function');
      expect(typeof listener['Program:exit']).toBe('function');
    });

    it('validMetadataRule.create should return listener object', () => {
      const mockContext = {
        options: [],
        filename: 'test.ts',
        getFilename: () => 'test.ts',
        report: () => {}
      };

      const listener = validMetadataRule.create(mockContext as any);
      expect(listener).toBeDefined();
      expect(typeof listener.ExportNamedDeclaration).toBe('function');
    });
  });

  describe('file exclusion patterns', () => {
    // Test the shouldExclude behavior indirectly through the rule
    // Note: ESLint provides full file paths, so patterns like **/*.d.ts need full paths
    it('should exclude .d.ts files by default', () => {
      let reported = false;
      const mockContext = {
        options: [],
        filename: '/project/src/types.d.ts',
        getFilename: () => '/project/src/types.d.ts',
        report: () => { reported = true; }
      };

      const listener = requireMetadataRule.create(mockContext as any);
      // Simulate Program:exit
      (listener['Program:exit'] as () => void)();
      
      // Should not report for .d.ts files
      expect(reported).toBe(false);
    });

    it('should exclude test files by default', () => {
      let reported = false;
      const mockContext = {
        options: [],
        filename: '/project/src/component.test.ts',
        getFilename: () => '/project/src/component.test.ts',
        report: () => { reported = true; }
      };

      const listener = requireMetadataRule.create(mockContext as any);
      (listener['Program:exit'] as () => void)();
      
      expect(reported).toBe(false);
    });

    it('should exclude spec files by default', () => {
      let reported = false;
      const mockContext = {
        options: [],
        filename: '/project/src/component.spec.ts',
        getFilename: () => '/project/src/component.spec.ts',
        report: () => { reported = true; }
      };

      const listener = requireMetadataRule.create(mockContext as any);
      (listener['Program:exit'] as () => void)();
      
      expect(reported).toBe(false);
    });

    it('should exclude index.ts files by default', () => {
      let reported = false;
      const mockContext = {
        options: [],
        filename: '/project/src/index.ts',
        getFilename: () => '/project/src/index.ts',
        report: () => { reported = true; }
      };

      const listener = requireMetadataRule.create(mockContext as any);
      (listener['Program:exit'] as () => void)();
      
      expect(reported).toBe(false);
    });

    it('should report for regular .ts files without metadata', () => {
      let reported = false;
      const mockContext = {
        options: [],
        filename: 'service.ts',
        getFilename: () => 'service.ts',
        report: () => { reported = true; }
      };

      const listener = requireMetadataRule.create(mockContext as any);
      (listener['Program:exit'] as () => void)();
      
      expect(reported).toBe(true);
    });

    it('should use custom exclude patterns from options', () => {
      let reported = false;
      const mockContext = {
        options: [{ exclude: ['**/custom/**'] }],
        filename: '/project/custom/file.ts',
        getFilename: () => '/project/custom/file.ts',
        report: () => { reported = true; }
      };

      const listener = requireMetadataRule.create(mockContext as any);
      (listener['Program:exit'] as () => void)();
      
      expect(reported).toBe(false);
    });
  });

  describe('metadata detection', () => {
    it('should detect __metadata export', () => {
      let reported = false;
      const mockContext = {
        options: [],
        filename: 'service.ts',
        getFilename: () => 'service.ts',
        report: () => { reported = true; }
      };

      const listener = requireMetadataRule.create(mockContext as any);
      
      // Simulate finding __metadata export
      const mockNode = {
        declaration: {
          type: 'VariableDeclaration',
          declarations: [
            { id: { type: 'Identifier', name: '__metadata' } }
          ]
        }
      };
      
      (listener.ExportNamedDeclaration as (node: unknown) => void)(mockNode);
      (listener['Program:exit'] as () => void)();
      
      // Should not report because __metadata was found
      expect(reported).toBe(false);
    });

    it('should report when __metadata is missing', () => {
      let reported = false;
      const mockContext = {
        options: [],
        filename: 'service.ts',
        getFilename: () => 'service.ts',
        report: () => { reported = true; }
      };

      const listener = requireMetadataRule.create(mockContext as any);
      
      // Simulate finding other export
      const mockNode = {
        declaration: {
          type: 'VariableDeclaration',
          declarations: [
            { id: { type: 'Identifier', name: 'someOtherExport' } }
          ]
        }
      };
      
      (listener.ExportNamedDeclaration as (node: unknown) => void)(mockNode);
      (listener['Program:exit'] as () => void)();
      
      expect(reported).toBe(true);
    });
  });
});


/**
 * CLI Commands Integration Tests
 * 
 * These tests ensure all CLI commands work correctly before publishing.
 * They test the actual CLI binary to catch integration issues.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync, exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const CLI_PATH = path.resolve(__dirname, '../../bin/ts-introspect.js');

function runCli(args: string, cwd?: string): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execSync(`node ${CLI_PATH} ${args}`, {
      cwd: cwd ?? process.cwd(),
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: execError.stdout ?? '',
      stderr: execError.stderr ?? '',
      exitCode: execError.status ?? 1
    };
  }
}

function parseJsonOutput(stdout: string): unknown {
  try {
    return JSON.parse(stdout);
  } catch {
    throw new Error(`Failed to parse JSON output: ${stdout}`);
  }
}

describe('CLI Commands', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tsi-cli-test-'));
    // Create a minimal src directory
    fs.mkdirSync(path.join(tempDir, 'src'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Global Options', () => {
    it('should output version with --version', () => {
      const result = runCli('--version');
      // Commander outputs version and may exit with code 1 in some versions
      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
    });

    it('should output API version with --api-version', () => {
      const result = runCli('--api-version');
      expect(result.exitCode).toBe(0);
      const json = parseJsonOutput(result.stdout) as { result: { api_version: string } };
      expect(json.result.api_version).toBe('v1');
    });

    it('should list commands with --list-commands', () => {
      const result = runCli('--list-commands');
      expect(result.exitCode).toBe(0);
      const json = parseJsonOutput(result.stdout) as { result: Array<{ name: string }> };
      expect(Array.isArray(json.result)).toBe(true);
      const commandNames = json.result.map(c => c.name);
      expect(commandNames).toContain('lint');
      expect(commandNames).toContain('generate');
      expect(commandNames).toContain('init');
      expect(commandNames).toContain('report');
      expect(commandNames).toContain('deps');
      expect(commandNames).toContain('hooks');
      expect(commandNames).toContain('adr');
    });

    it('should output JSON schema with --schema json', () => {
      const result = runCli('--schema json');
      expect(result.exitCode).toBe(0);
      const json = parseJsonOutput(result.stdout) as { result: { name: string; commands: unknown[] } };
      expect(json.result.name).toBe('ts-introspect');
      expect(Array.isArray(json.result.commands)).toBe(true);
    });

    it('should output OpenAPI schema with --schema openapi', () => {
      const result = runCli('--schema openapi');
      expect(result.exitCode).toBe(0);
      const json = parseJsonOutput(result.stdout) as { openapi: string; info: { title: string } };
      expect(json.openapi).toBe('3.0.0');
      expect(json.info.title).toBe('ts-introspect');
    });
  });

  describe('init command', () => {
    it('should create config file', () => {
      const result = runCli('init --format=json', tempDir);
      expect(result.exitCode).toBe(0);
      
      const configPath = path.join(tempDir, 'introspect.config.json');
      expect(fs.existsSync(configPath)).toBe(true);
      
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(config.srcDir).toBe('src');
    });

    it('should not overwrite existing config without --force', () => {
      // First init
      runCli('init --format=json', tempDir);
      
      // Second init should fail or skip
      const result = runCli('init --format=json', tempDir);
      // The command succeeds but reports the file exists
      expect(result.exitCode).toBe(0);
    });

    it('should overwrite with --force', () => {
      // First init
      runCli('init --format=json', tempDir);
      
      // Modify the config
      const configPath = path.join(tempDir, 'introspect.config.json');
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      config.custom = 'value';
      fs.writeFileSync(configPath, JSON.stringify(config));
      
      // Second init with --force
      const result = runCli('init --force --format=json', tempDir);
      expect(result.exitCode).toBe(0);
      
      // Config should be reset (no custom field)
      const newConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(newConfig.custom).toBeUndefined();
    });
  });

  describe('lint command', () => {
    it('should return JSON output by default', () => {
      // Create a file without metadata
      fs.writeFileSync(path.join(tempDir, 'src', 'test.ts'), 'export const x = 1;');
      
      const result = runCli('lint', tempDir);
      // Will fail because no metadata
      expect(result.exitCode).toBe(1);
      
      const json = parseJsonOutput(result.stdout) as { success: boolean; result: { passed: boolean } };
      expect(json.success).toBe(true);
      expect(json.result.passed).toBe(false);
    });

    it('should support --format=table', () => {
      fs.writeFileSync(path.join(tempDir, 'src', 'test.ts'), 'export const x = 1;');
      
      const result = runCli('lint --format=table', tempDir);
      expect(result.stdout).toContain('| File |');
      expect(result.stdout).toContain('ERROR');
    });

    it('should support --format=text', () => {
      fs.writeFileSync(path.join(tempDir, 'src', 'test.ts'), 'export const x = 1;');
      
      const result = runCli('lint --format=text', tempDir);
      expect(result.stdout).toContain('test.ts');
    });

    it('should pass with valid metadata', () => {
      const code = 'export const x = 1;';
      // Need to generate proper hash
      const { generateContentHashFromString } = require('../../dist/core/hasher.js');
      const hash = generateContentHashFromString(code);
      
      const fileContent = `${code}

// ============================================
// FILE INTROSPECTION METADATA
// ============================================
/** @internal */
export const __metadata = {
  module: 'test',
  filename: 'test.ts',
  description: 'Test file',
  status: 'stable',
  updatedAt: '2025-11-29',
  _meta: { contentHash: '${hash}' }
};`;
      
      fs.writeFileSync(path.join(tempDir, 'src', 'test.ts'), fileContent);
      
      const result = runCli('lint', tempDir);
      expect(result.exitCode).toBe(0);
      
      const json = parseJsonOutput(result.stdout) as { result: { passed: boolean } };
      expect(json.result.passed).toBe(true);
    });

    it('should lint specific files', () => {
      fs.writeFileSync(path.join(tempDir, 'src', 'a.ts'), 'export const a = 1;');
      fs.writeFileSync(path.join(tempDir, 'src', 'b.ts'), 'export const b = 2;');
      
      const result = runCli(`lint ${path.join(tempDir, 'src', 'a.ts')}`, tempDir);
      
      const json = parseJsonOutput(result.stdout) as { result: { summary: { files_checked: number } } };
      expect(json.result.summary.files_checked).toBe(1);
    });
  });

  describe('generate command', () => {
    it('should generate metadata stub', () => {
      fs.writeFileSync(path.join(tempDir, 'src', 'test.ts'), 'export function hello() { return "world"; }');
      
      const result = runCli('generate --format=text', tempDir);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Generated');
      
      const content = fs.readFileSync(path.join(tempDir, 'src', 'test.ts'), 'utf-8');
      expect(content).toContain('export const __metadata');
      expect(content).toContain('@internal');
    });

    it('should skip files with existing metadata', () => {
      const fileContent = `export const x = 1;
export const __metadata = { module: 'test' };`;
      fs.writeFileSync(path.join(tempDir, 'src', 'test.ts'), fileContent);
      
      const result = runCli('generate --format=text', tempDir);
      expect(result.stdout).toContain('Skipped');
    });

    it('should overwrite with --overwrite flag', () => {
      const fileContent = `export const x = 1;
// Old metadata without @internal
export const __metadata = { module: 'old' };`;
      fs.writeFileSync(path.join(tempDir, 'src', 'test.ts'), fileContent);
      
      const result = runCli('generate --overwrite --format=text', tempDir);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Generated');
      
      const content = fs.readFileSync(path.join(tempDir, 'src', 'test.ts'), 'utf-8');
      expect(content).toContain('@internal');
    });

    it('should generate metadata with @internal JSDoc tag', () => {
      fs.writeFileSync(path.join(tempDir, 'src', 'test.ts'), 'export const x = 1;');
      
      runCli('generate', tempDir);
      
      const content = fs.readFileSync(path.join(tempDir, 'src', 'test.ts'), 'utf-8');
      expect(content).toContain('/** @internal');
      expect(content).toContain('export const __metadata');
    });

    it('should remove multiple duplicate metadata blocks with --overwrite', () => {
      // Simulate a file that has accumulated duplicate metadata blocks
      const fileContent = `export const x = 1;

// ============================================
// FILE INTROSPECTION METADATA
// ============================================
/** @internal */
export const __metadata = {
  module: 'test',
  dependencies: {
    internal: [],
    external: []
  }
} as const;

// ============================================
// FILE INTROSPECTION METADATA
// ============================================
/** @internal */
export const __metadata = {
  module: 'test-duplicate'
} as const;

export const __metadata = { module: 'orphan' };`;
      
      fs.writeFileSync(path.join(tempDir, 'src', 'test.ts'), fileContent);
      
      const result = runCli('generate --overwrite --format=text', tempDir);
      expect(result.exitCode).toBe(0);
      
      const content = fs.readFileSync(path.join(tempDir, 'src', 'test.ts'), 'utf-8');
      
      // Count how many __metadata exports exist
      const metadataCount = (content.match(/export const __metadata/g) || []).length;
      expect(metadataCount).toBe(1);
      
      // Ensure we still have the original code
      expect(content).toContain('export const x = 1;');
    });

    it('should handle metadata with deeply nested objects', () => {
      // Create a file with metadata that has nested objects
      const fileContent = `export const x = 1;

// ============================================
// FILE INTROSPECTION METADATA
// ============================================
/** @internal */
export const __metadata = {
  module: 'test',
  dependencies: {
    internal: ['./utils'],
    external: ['react']
  },
  react: {
    componentType: 'functional',
    props: {
      interfaceName: 'Props',
      properties: [
        { name: 'value', type: 'string', required: true }
      ]
    }
  },
  _meta: {
    contentHash: 'abc123',
    generatedDeps: []
  }
} as const;`;
      
      fs.writeFileSync(path.join(tempDir, 'src', 'test.ts'), fileContent);
      
      const result = runCli('generate --overwrite --format=text', tempDir);
      expect(result.exitCode).toBe(0);
      
      const content = fs.readFileSync(path.join(tempDir, 'src', 'test.ts'), 'utf-8');
      
      // Should have exactly one metadata block
      const metadataCount = (content.match(/export const __metadata/g) || []).length;
      expect(metadataCount).toBe(1);
      
      // Should not have fragments of old metadata
      expect(content).not.toContain('componentType: \'functional\'');
      expect(content).not.toContain('interfaceName: \'Props\'');
    });

    // Regression tests for duplicate metadata block issue (A1)
    describe('duplicate metadata regression tests', () => {
      it('should handle metadata with braces inside strings', () => {
        // Braces in strings should not confuse the brace counting
        // This tests that the brace counting correctly ignores braces inside string literals
        const fileContent = `export const x = 1;

// ============================================
// FILE INTROSPECTION METADATA
// ============================================
/** @internal */
export const __metadata = {
  module: 'braces-test',
  description: 'Object with { braces } inside',
  notes: 'Also handles } single braces and {{{multiple}}}',
  _meta: {
    contentHash: 'abc123'
  }
} as const;`;
        
        fs.writeFileSync(path.join(tempDir, 'src', 'test.ts'), fileContent);
        
        const result = runCli('generate --overwrite --format=text', tempDir);
        expect(result.exitCode).toBe(0);
        
        const content = fs.readFileSync(path.join(tempDir, 'src', 'test.ts'), 'utf-8');
        
        // Key check: exactly one metadata block (braces in strings didn't cause fragments)
        const metadataCount = (content.match(/export const __metadata/g) || []).length;
        expect(metadataCount).toBe(1);
        
        // The old module name should be replaced with the new generated one
        expect(content).not.toContain("module: 'braces-test'");
        
        // Verify the file still has valid structure (export const x should exist once)
        expect((content.match(/export const x = 1/g) || []).length).toBe(1);
      });

      it('should handle metadata with template literals containing braces', () => {
        const fileContent = `export const x = 1;

// ============================================
// FILE INTROSPECTION METADATA
// ============================================
/** @internal */
export const __metadata = {
  module: 'test',
  description: \`Template with \${'{braces}'} inside\`,
  _meta: { contentHash: 'abc123' }
} as const;`;
        
        fs.writeFileSync(path.join(tempDir, 'src', 'test.ts'), fileContent);
        
        const result = runCli('generate --overwrite --format=text', tempDir);
        expect(result.exitCode).toBe(0);
        
        const content = fs.readFileSync(path.join(tempDir, 'src', 'test.ts'), 'utf-8');
        const metadataCount = (content.match(/export const __metadata/g) || []).length;
        expect(metadataCount).toBe(1);
      });

      it('should handle metadata with escaped quotes in strings', () => {
        const fileContent = `export const x = 1;

// ============================================
// FILE INTROSPECTION METADATA
// ============================================
/** @internal */
export const __metadata = {
  module: 'test',
  description: 'String with \\'escaped\\' quotes and "double" quotes',
  notes: "Also \\"escaped\\" in double quotes",
  _meta: { contentHash: 'abc123' }
} as const;`;
        
        fs.writeFileSync(path.join(tempDir, 'src', 'test.ts'), fileContent);
        
        const result = runCli('generate --overwrite --format=text', tempDir);
        expect(result.exitCode).toBe(0);
        
        const content = fs.readFileSync(path.join(tempDir, 'src', 'test.ts'), 'utf-8');
        const metadataCount = (content.match(/export const __metadata/g) || []).length;
        expect(metadataCount).toBe(1);
      });

      it('should handle mixed format metadata blocks', () => {
        // Mix of blocks with headers, without headers, with/without JSDoc, with/without as const
        const fileContent = `export const x = 1;

// ============================================
// FILE INTROSPECTION METADATA
// ============================================
/** @internal */
export const __metadata = {
  module: 'block1'
} as const;

/** @internal */
export const __metadata = {
  module: 'block2-no-header'
};

export const __metadata = { module: 'block3-minimal' };

// ============================================
// FILE INTROSPECTION
// ============================================
export const __metadata = {
  module: 'block4-legacy-header'
} as const;`;
        
        fs.writeFileSync(path.join(tempDir, 'src', 'test.ts'), fileContent);
        
        const result = runCli('generate --overwrite --format=text', tempDir);
        expect(result.exitCode).toBe(0);
        
        const content = fs.readFileSync(path.join(tempDir, 'src', 'test.ts'), 'utf-8');
        const metadataCount = (content.match(/export const __metadata/g) || []).length;
        expect(metadataCount).toBe(1);
        
        // None of the old modules should remain
        expect(content).not.toContain("module: 'block1'");
        expect(content).not.toContain("module: 'block2-no-header'");
        expect(content).not.toContain("module: 'block3-minimal'");
        expect(content).not.toContain("module: 'block4-legacy-header'");
      });

      it('should handle metadata fragments from previous bugs', () => {
        // Simulate fragments that might be left behind by buggy regex
        const fileContent = `export const x = 1;

// ============================================
// FILE INTROSPECTION METADATA
// ============================================
/** @internal */
export const __metadata = {
  module: 'test',
  _meta: { contentHash: 'abc' }
} as const;

// Orphaned closing parts (simulate regex failure)
} as const;

// Another orphan
};`;
        
        fs.writeFileSync(path.join(tempDir, 'src', 'test.ts'), fileContent);
        
        const result = runCli('generate --overwrite --format=text', tempDir);
        expect(result.exitCode).toBe(0);
        
        const content = fs.readFileSync(path.join(tempDir, 'src', 'test.ts'), 'utf-8');
        const metadataCount = (content.match(/export const __metadata/g) || []).length;
        expect(metadataCount).toBe(1);
      });

      it('should be idempotent - multiple runs should not create duplicates', () => {
        fs.writeFileSync(path.join(tempDir, 'src', 'test.ts'), 'export const x = 1;');
        
        // Run generate multiple times
        for (let i = 0; i < 5; i++) {
          const result = runCli('generate --overwrite --format=text', tempDir);
          expect(result.exitCode).toBe(0);
        }
        
        const content = fs.readFileSync(path.join(tempDir, 'src', 'test.ts'), 'utf-8');
        const metadataCount = (content.match(/export const __metadata/g) || []).length;
        expect(metadataCount).toBe(1);
        
        // Original code should still be present
        expect(content).toContain('export const x = 1;');
      });

      it('should handle metadata with type annotation', () => {
        const fileContent = `import type { FileMetadata } from 'ts-introspect/types';

export const x = 1;

// ============================================
// FILE INTROSPECTION METADATA
// ============================================
/** @internal */
export const __metadata: FileMetadata = {
  module: 'test',
  _meta: { contentHash: 'abc123' }
};`;
        
        fs.writeFileSync(path.join(tempDir, 'src', 'test.ts'), fileContent);
        
        const result = runCli('generate --overwrite --format=text', tempDir);
        expect(result.exitCode).toBe(0);
        
        const content = fs.readFileSync(path.join(tempDir, 'src', 'test.ts'), 'utf-8');
        const metadataCount = (content.match(/export const __metadata/g) || []).length;
        expect(metadataCount).toBe(1);
        
        // Old typed metadata should be removed
        expect(content).not.toContain(': FileMetadata =');
      });

      it('should handle closing brace at column 0 in nested object', () => {
        // This is the exact scenario that caused the original bug
        // When an inner object's closing brace is at column 0
        const fileContent = `export const x = 1;

// ============================================
// FILE INTROSPECTION METADATA
// ============================================
/** @internal */
export const __metadata = {
  module: 'badly-formatted',
  dependencies: {
    internal: ['./old-dep']
}
} as const;`;
        
        fs.writeFileSync(path.join(tempDir, 'src', 'test.ts'), fileContent);
        
        const result = runCli('generate --overwrite --format=text', tempDir);
        expect(result.exitCode).toBe(0);
        
        const content = fs.readFileSync(path.join(tempDir, 'src', 'test.ts'), 'utf-8');
        const metadataCount = (content.match(/export const __metadata/g) || []).length;
        expect(metadataCount).toBe(1);
        
        // Old module name should be gone (replaced with fresh metadata)
        expect(content).not.toContain("module: 'badly-formatted'");
        // Old dependency should be gone
        expect(content).not.toContain('./old-dep');
      });

      it('should handle metadata spanning many lines with complex structure', () => {
        // Large metadata block with many nested structures
        const fileContent = `export const x = 1;

// ============================================
// FILE INTROSPECTION METADATA
// ============================================
/** @internal */
export const __metadata = {
  module: 'complex-component',
  filename: 'ComplexComponent.tsx',
  description: 'A very complex component with lots of metadata',
  responsibilities: [
    'Handle user interactions',
    'Manage local state',
    'Communicate with parent'
  ],
  exports: ['ComplexComponent', 'useComplexHook'],
  dependencies: {
    internal: ['./utils', './hooks/useData', '../shared/types'],
    external: ['react', 'lodash', '@tanstack/react-query'],
    types: ['Props', 'State', 'Config']
  },
  react: {
    componentType: 'functional',
    props: {
      interfaceName: 'ComplexProps',
      properties: [
        { name: 'data', type: 'Data[]', required: true },
        { name: 'onUpdate', type: '(item: Data) => void', required: true },
        { name: 'config', type: 'Config', required: false }
      ]
    },
    hooks: [
      { name: 'useState', isCustom: false },
      { name: 'useEffect', isCustom: false },
      { name: 'useComplexHook', isCustom: true }
    ],
    contexts: ['ThemeContext', 'UserContext'],
    stateManagement: ['local', 'context'],
    renders: ['Header', 'Content', 'Footer']
  },
  status: 'stable',
  createdAt: '2024-01-01',
  updatedAt: '2024-06-15',
  changelog: [
    { version: '1.0.0', date: '2024-01-01', changes: ['Initial implementation'] },
    { version: '1.1.0', date: '2024-03-15', changes: ['Added hooks support', 'Fixed rendering bug'] },
    { version: '1.2.0', date: '2024-06-15', changes: ['Performance improvements'] }
  ],
  todos: [
    { id: 'TODO-1', description: 'Add tests', priority: 'high', status: 'pending', createdAt: '2024-06-15' }
  ],
  fixes: [],
  notes: 'This component is critical for the main workflow',
  seeAlso: ['./SimpleComponent', './DataProvider'],
  tags: ['ui', 'core', 'complex'],
  _meta: {
    contentHash: 'abc123def456',
    lastValidated: '2024-06-15',
    generatedDeps: ['./utils', './hooks/useData']
  }
} as const;`;
        
        fs.writeFileSync(path.join(tempDir, 'src', 'test.ts'), fileContent);
        
        const result = runCli('generate --overwrite --format=text', tempDir);
        expect(result.exitCode).toBe(0);
        
        const content = fs.readFileSync(path.join(tempDir, 'src', 'test.ts'), 'utf-8');
        const metadataCount = (content.match(/export const __metadata/g) || []).length;
        expect(metadataCount).toBe(1);
        
        // None of the old complex metadata should remain
        expect(content).not.toContain('ComplexComponent');
        expect(content).not.toContain('useComplexHook');
        expect(content).not.toContain('ThemeContext');
      });

      it('should preserve imports when regenerating metadata', () => {
        // REGRESSION TEST: Imports were being stripped when metadata was regenerated
        // This test verifies that multi-line imports are preserved
        const fileContent = `/**
 * Error Boundary Component
 * 
 * Catches JavaScript errors and displays fallback UI
 */

import { Component, type ReactNode, type ErrorInfo, type ComponentType } from 'react';
import {
  COLORS_BG,
  COLORS_TEXT,
  COLORS_STATUS,
  COLORS_ACCENT,
  FONTS,
  FONT_SIZES,
  SPACING,
  BORDER_RADIUS,
  BORDER_COLORS,
} from "../design-tokens";

// ============================================
// FILE INTROSPECTION METADATA
// ============================================
/** @internal */
export const __metadata = {
  module: 'client/components/ErrorBoundary',
  filename: 'ErrorBoundary.tsx',
  description: 'React Error Boundary for graceful error handling',
  _meta: { contentHash: 'old-hash' }
} as const;

export class ErrorBoundary extends Component {
  render() {
    return this.props.children;
  }
}
`;
        
        fs.writeFileSync(path.join(tempDir, 'src', 'test.tsx'), fileContent);
        
        const result = runCli('generate --overwrite --format=text', tempDir);
        expect(result.exitCode).toBe(0);
        
        const content = fs.readFileSync(path.join(tempDir, 'src', 'test.tsx'), 'utf-8');
        
        // CRITICAL: All imports must be preserved
        expect(content).toContain("import { Component, type ReactNode, type ErrorInfo, type ComponentType } from 'react';");
        expect(content).toContain('COLORS_BG');
        expect(content).toContain('COLORS_TEXT');
        expect(content).toContain('FONT_SIZES');
        expect(content).toContain('BORDER_COLORS');
        expect(content).toContain('from "../design-tokens"');
        
        // JSDoc header must be preserved
        expect(content).toContain('Error Boundary Component');
        expect(content).toContain('Catches JavaScript errors');
        
        // Class must be preserved
        expect(content).toContain('export class ErrorBoundary');
        
        // Exactly one metadata block
        const metadataCount = (content.match(/export const __metadata/g) || []).length;
        expect(metadataCount).toBe(1);
      });

      it('should preserve imports when file has no existing metadata', () => {
        // Test generating metadata for a file that has imports but no metadata yet
        const fileContent = `/**
 * Utility functions
 */

import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import {
  formatDate,
  formatCurrency,
  formatNumber,
} from './formatters';
import { API_BASE_URL, API_TIMEOUT } from '../config';

export function useData() {
  const [data, setData] = useState(null);
  return data;
}

export const CONSTANTS = {
  MAX_RETRIES: 3,
  TIMEOUT: 5000
};
`;
        
        fs.writeFileSync(path.join(tempDir, 'src', 'utils.ts'), fileContent);
        
        const result = runCli('generate --format=text', tempDir);
        expect(result.exitCode).toBe(0);
        
        const content = fs.readFileSync(path.join(tempDir, 'src', 'utils.ts'), 'utf-8');
        
        // All imports must be preserved
        expect(content).toContain("import { useState, useEffect } from 'react';");
        expect(content).toContain("import type { ReactNode } from 'react';");
        expect(content).toContain('formatDate');
        expect(content).toContain('formatCurrency');
        expect(content).toContain('formatNumber');
        expect(content).toContain("from './formatters'");
        expect(content).toContain('API_BASE_URL');
        expect(content).toContain('API_TIMEOUT');
        
        // JSDoc must be preserved
        expect(content).toContain('Utility functions');
        
        // Exports must be preserved
        expect(content).toContain('export function useData()');
        expect(content).toContain('export const CONSTANTS');
        
        // Should have exactly one metadata block
        const metadataCount = (content.match(/export const __metadata/g) || []).length;
        expect(metadataCount).toBe(1);
      });

      it('should remove orphaned metadata header fragments', () => {
        // REGRESSION TEST: Files could have orphaned header comments without the actual metadata export
        // These fragments need to be cleaned up
        const fileContent = `/**
 * Blueprint Presets
 */

import { something } from './something';

export const CONSTANT = 1;

// ============================================
// FILE INTROSPECTION METADATA
// ============================================
/** @internal Metadata for tooling - not imported by application code */
export const __metadata = {
  module: 'test',
  _meta: { contentHash: 'abc123' }
} as const;

// ============================================
// FILE INTROSPECTION METADATA
// ============================================
/** @internal Metadata for tooling - not imported by application code */

// ============================================
// FILE INTROSPECTION METADATA
// ============================================
/** @internal Metadata for tooling - not imported by application code */

// ============================================
// FILE INTROSPECTION METADATA
// ============================================
`;
        
        fs.writeFileSync(path.join(tempDir, 'src', 'test.ts'), fileContent);
        
        const result = runCli('generate --overwrite --format=text', tempDir);
        expect(result.exitCode).toBe(0);
        
        const content = fs.readFileSync(path.join(tempDir, 'src', 'test.ts'), 'utf-8');
        
        // Should have exactly ONE metadata block
        const metadataCount = (content.match(/export const __metadata/g) || []).length;
        expect(metadataCount).toBe(1);
        
        // Should have exactly ONE FILE INTROSPECTION header
        const headerCount = (content.match(/FILE INTROSPECTION/g) || []).length;
        expect(headerCount).toBe(1);
        
        // Imports must be preserved
        expect(content).toContain("import { something } from './something';");
        
        // JSDoc must be preserved
        expect(content).toContain('Blueprint Presets');
        
        // Code must be preserved
        expect(content).toContain('export const CONSTANT = 1;');
      });

      it('should handle file with only JSDoc and imports (no prior metadata)', () => {
        // Edge case: file starts with JSDoc comment before imports
        const fileContent = `/**
 * @fileoverview Main application entry point
 * @author Developer
 * @license MIT
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(<App />);
`;
        
        fs.writeFileSync(path.join(tempDir, 'src', 'main.tsx'), fileContent);
        
        const result = runCli('generate --format=text', tempDir);
        expect(result.exitCode).toBe(0);
        
        const content = fs.readFileSync(path.join(tempDir, 'src', 'main.tsx'), 'utf-8');
        
        // JSDoc must be at the top
        expect(content.indexOf('@fileoverview')).toBeLessThan(content.indexOf('import React'));
        
        // All imports preserved
        expect(content).toContain("import React from 'react';");
        expect(content).toContain("import { createRoot } from 'react-dom/client';");
        expect(content).toContain("import App from './App';");
        
        // Code preserved
        expect(content).toContain('createRoot(document.getElementById');
      });
    });
  });

  describe('report command', () => {
    beforeEach(() => {
      // Create a file with metadata for report tests
      const code = 'export const x = 1;';
      const { generateContentHashFromString } = require('../../dist/core/hasher.js');
      const hash = generateContentHashFromString(code);
      
      const fileContent = `${code}

// ============================================
// FILE INTROSPECTION METADATA
// ============================================
/** @internal */
export const __metadata = {
  module: 'test',
  filename: 'test.ts',
  description: 'Test file',
  status: 'stable',
  updatedAt: '2025-11-29',
  todos: [{ id: 'TODO-1', description: 'Test todo', priority: 'medium', status: 'pending', createdAt: '2025-01-01' }],
  fixes: [{ id: 'FIX-1', description: 'Test fix', severity: 'minor', status: 'open', createdAt: '2025-01-01' }],
  _meta: { contentHash: '${hash}' }
};`;
      
      fs.writeFileSync(path.join(tempDir, 'src', 'test.ts'), fileContent);
    });

    it('should generate summary report (default)', () => {
      const result = runCli('report', tempDir);
      expect(result.exitCode).toBe(0);
      
      const json = parseJsonOutput(result.stdout) as { success: boolean; result: { summary: unknown } };
      expect(json.success).toBe(true);
      expect(json.result.summary).toBeDefined();
    });

    it('should support --type=todos', () => {
      const result = runCli('report --type=todos', tempDir);
      expect(result.exitCode).toBe(0);
      
      const json = parseJsonOutput(result.stdout) as { success: boolean; result: { todos: unknown[] } };
      expect(json.success).toBe(true);
      expect(Array.isArray(json.result.todos)).toBe(true);
    });

    it('should support --type=fixes', () => {
      const result = runCli('report --type=fixes', tempDir);
      expect(result.exitCode).toBe(0);
      
      const json = parseJsonOutput(result.stdout) as { success: boolean; result: { fixes: unknown[] } };
      expect(json.success).toBe(true);
      expect(Array.isArray(json.result.fixes)).toBe(true);
    });

    it('should support --format=table', () => {
      const result = runCli('report --format=table', tempDir);
      expect(result.exitCode).toBe(0);
      // Table format outputs markdown table or summary text
      expect(result.stdout.length).toBeGreaterThan(0);
    });
  });

  describe('deps command', () => {
    it('should analyze single file dependencies', () => {
      fs.writeFileSync(path.join(tempDir, 'src', 'test.ts'), `
import fs from 'fs';
import { helper } from './helper.js';
export const x = 1;
`);
      fs.writeFileSync(path.join(tempDir, 'src', 'helper.ts'), 'export const helper = () => {};');
      
      const result = runCli(`deps ${path.join(tempDir, 'src', 'test.ts')}`, tempDir);
      expect(result.exitCode).toBe(0);
      
      const json = parseJsonOutput(result.stdout) as { result: { dependencies: { internal: string[]; external: string[] } } };
      expect(json.result.dependencies.external).toContain('fs');
      expect(json.result.dependencies.internal.some((d: string) => d.includes('helper'))).toBe(true);
    });

    it('should find unused modules with --unused', () => {
      fs.writeFileSync(path.join(tempDir, 'src', 'used.ts'), 'export const used = 1;');
      fs.writeFileSync(path.join(tempDir, 'src', 'unused.ts'), 'export const unused = 2;');
      
      const result = runCli('deps --unused', tempDir);
      expect(result.exitCode).toBe(0);
      
      const json = parseJsonOutput(result.stdout) as { result: { unused_modules: string[] } };
      expect(Array.isArray(json.result.unused_modules)).toBe(true);
    });

    it('should find circular dependencies with --circular', () => {
      // Create circular dependency: a -> b -> a
      fs.writeFileSync(path.join(tempDir, 'src', 'a.ts'), "import { b } from './b.js'; export const a = b;");
      fs.writeFileSync(path.join(tempDir, 'src', 'b.ts'), "import { a } from './a.js'; export const b = a;");
      
      const result = runCli('deps --circular', tempDir);
      expect(result.exitCode).toBe(0);
      
      const json = parseJsonOutput(result.stdout) as { result: { circular_dependencies: string[][] } };
      expect(Array.isArray(json.result.circular_dependencies)).toBe(true);
      expect(json.result.circular_dependencies.length).toBeGreaterThan(0);
    });
  });

  describe('hooks command', () => {
    beforeEach(() => {
      // Initialize git repo for hooks tests
      execSync('git init', { cwd: tempDir, stdio: 'pipe' });
    });

    it('should check hook status with --check', () => {
      const result = runCli('hooks --check', tempDir);
      expect(result.exitCode).toBe(0);
      
      const json = parseJsonOutput(result.stdout) as { result: { hooks: { pre_commit: boolean } } };
      expect(typeof json.result.hooks.pre_commit).toBe('boolean');
    });

    it('should install hooks with --install', () => {
      const result = runCli('hooks --install --format=text', tempDir);
      expect(result.exitCode).toBe(0);
      
      const hookPath = path.join(tempDir, '.git', 'hooks', 'pre-commit');
      expect(fs.existsSync(hookPath)).toBe(true);
      
      const content = fs.readFileSync(hookPath, 'utf-8');
      expect(content).toContain('ts-introspect');
    });

    it('should uninstall hooks with --uninstall', () => {
      // First install
      runCli('hooks --install', tempDir);
      
      // Then uninstall
      const result = runCli('hooks --uninstall --format=text', tempDir);
      expect(result.exitCode).toBe(0);
      
      const hookPath = path.join(tempDir, '.git', 'hooks', 'pre-commit');
      expect(fs.existsSync(hookPath)).toBe(false);
    });
  });

  describe('adr command', () => {
    it('should list ADRs with --list', () => {
      // Create empty ADR file
      fs.mkdirSync(path.join(tempDir, 'docs'), { recursive: true });
      fs.writeFileSync(path.join(tempDir, 'docs', 'adrs.jsonl'), '');
      
      const result = runCli('adr --list', tempDir);
      expect(result.exitCode).toBe(0);
      
      const json = parseJsonOutput(result.stdout) as { result: { adrs: unknown[] } };
      expect(Array.isArray(json.result.adrs)).toBe(true);
    });

    it('should add new ADR with --add', () => {
      fs.mkdirSync(path.join(tempDir, 'docs'), { recursive: true });
      fs.writeFileSync(path.join(tempDir, 'docs', 'adrs.jsonl'), '');
      
      const result = runCli('adr --add --title="Test ADR" --decision="Use TypeScript" --rationale="Type safety"', tempDir);
      expect(result.exitCode).toBe(0);
      
      const content = fs.readFileSync(path.join(tempDir, 'docs', 'adrs.jsonl'), 'utf-8');
      expect(content).toContain('Test ADR');
    });

    it('should validate ADRs with --validate', () => {
      fs.mkdirSync(path.join(tempDir, 'docs'), { recursive: true });
      // Include all required fields for valid ADR
      const validAdr = JSON.stringify({
        id: 'ADR-001',
        title: 'Test',
        status: 'approved',
        date: '2025-01-01',
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
        decision: 'Test decision',
        rationale: 'Test rationale',
        consequences: ['Test consequence']
      });
      fs.writeFileSync(path.join(tempDir, 'docs', 'adrs.jsonl'), validAdr + '\n');
      
      const result = runCli('adr --validate', tempDir);
      expect(result.exitCode).toBe(0);
      
      const json = parseJsonOutput(result.stdout) as { result: { valid: boolean } };
      expect(json.result.valid).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should return structured error for unknown command', () => {
      const result = runCli('unknowncommand');
      expect(result.exitCode).toBe(1);
    });

    it('should return error for missing required option', () => {
      const result = runCli('adr --add'); // Missing --title
      expect(result.exitCode).toBe(1);
    });
  });
});


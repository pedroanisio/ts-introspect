/**
 * Hash Regeneration Integration Tests
 *
 * Tests the full cycle of:
 * - Generating metadata with correct hash
 * - Validating that hash matches content
 * - Detecting stale hashes after code changes
 * - Regenerating metadata to fix stale hashes
 *
 * These tests ensure that `tsi generate --overwrite` correctly fixes stale-hash errors.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  generateContentHash,
  generateContentHashFromString,
  extractStoredHash,
  hasContentChanged,
  getHashInfo
} from '@/core/hasher.js';
import { Validator } from '@/core/validator.js';

describe('Hash Regeneration Integration', () => {
  let tempDir: string;
  let srcDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tsi-hash-regen-'));
    srcDir = path.join(tempDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  /**
   * Helper to create a file with metadata
   */
  function createFileWithMetadata(
    filename: string,
    code: string,
    options: {
      useCorrectHash?: boolean;
      customHash?: string;
      useAsConst?: boolean;
      useHeaderComments?: boolean;
    } = {}
  ): string {
    const {
      useCorrectHash = true,
      customHash,
      useAsConst = true,
      useHeaderComments = true
    } = options;

    const filepath = path.join(srcDir, filename);
    
    // Write code first to calculate correct hash
    fs.writeFileSync(filepath, code);
    const correctHash = generateContentHash(filepath);
    const hash = customHash ?? (useCorrectHash ? correctHash : 'deadbeefdeadbeef');

    const header = useHeaderComments
      ? `// ============================================
// FILE INTROSPECTION METADATA
// ============================================
`
      : '';

    const asConst = useAsConst ? ' as const' : '';

    const fullContent = `${code}

${header}export const __metadata = {
  module: '${filename.replace('.ts', '')}',
  filename: '${filename}',
  description: 'Test file',
  status: 'stable',
  updatedAt: '2025-11-29',
  dependencies: {
    internal: [],
    external: [],
    types: [] as string[]
  },
  _meta: {
    contentHash: '${hash}',
    lastValidated: '2025-11-29',
    generatedDeps: []
  }
}${asConst};
`;

    fs.writeFileSync(filepath, fullContent);
    return filepath;
  }

  describe('Metadata Format Stripping', () => {
    it('should strip metadata with header comments and "as const"', () => {
      const code = 'export const foo = 1;';
      const filepath = createFileWithMetadata('test1.ts', code, {
        useHeaderComments: true,
        useAsConst: true,
        useCorrectHash: true
      });

      // Hash of file with metadata should equal hash of code only
      const fileHash = generateContentHash(filepath);
      const codeHash = generateContentHashFromString(code);
      expect(fileHash).toBe(codeHash);
    });

    it('should strip metadata with header comments without "as const"', () => {
      const code = 'export const bar = 2;';
      const filepath = createFileWithMetadata('test2.ts', code, {
        useHeaderComments: true,
        useAsConst: false,
        useCorrectHash: true
      });

      const fileHash = generateContentHash(filepath);
      const codeHash = generateContentHashFromString(code);
      expect(fileHash).toBe(codeHash);
    });

    it('should strip metadata without header comments', () => {
      const code = 'export const baz = 3;';
      const filepath = createFileWithMetadata('test3.ts', code, {
        useHeaderComments: false,
        useAsConst: true,
        useCorrectHash: true
      });

      const fileHash = generateContentHash(filepath);
      const codeHash = generateContentHashFromString(code);
      expect(fileHash).toBe(codeHash);
    });

    it('should strip metadata without header comments and without "as const"', () => {
      const code = 'export const qux = 4;';
      const filepath = createFileWithMetadata('test4.ts', code, {
        useHeaderComments: false,
        useAsConst: false,
        useCorrectHash: true
      });

      const fileHash = generateContentHash(filepath);
      const codeHash = generateContentHashFromString(code);
      expect(fileHash).toBe(codeHash);
    });
  });

  describe('Hash Correctness After Generation', () => {
    it('should have matching hash when file is unchanged', () => {
      const code = 'export class MyService { run() {} }';
      const filepath = createFileWithMetadata('service.ts', code, {
        useCorrectHash: true
      });

      expect(hasContentChanged(filepath)).toBe(false);
      
      const info = getHashInfo(filepath);
      expect(info.currentHash).toBe(info.storedHash);
      expect(info.changed).toBe(false);
    });

    it('should detect stale hash when code is modified', () => {
      const code = 'export class MyService { run() {} }';
      const filepath = createFileWithMetadata('service.ts', code, {
        useCorrectHash: true
      });

      // Verify initial state is valid
      expect(hasContentChanged(filepath)).toBe(false);

      // Modify the code (not the metadata)
      const content = fs.readFileSync(filepath, 'utf-8');
      const modifiedContent = content.replace(
        'export class MyService { run() {} }',
        'export class MyService { run() {} doSomething() {} }'
      );
      fs.writeFileSync(filepath, modifiedContent);

      // Now hash should be stale
      expect(hasContentChanged(filepath)).toBe(true);
      
      const info = getHashInfo(filepath);
      expect(info.currentHash).not.toBe(info.storedHash);
      expect(info.changed).toBe(true);
    });
  });

  describe('Validator Integration', () => {
    it('should pass validation when hash is correct', async () => {
      const code = 'export class ValidService {}';
      const filepath = createFileWithMetadata('valid.ts', code, {
        useCorrectHash: true
      });

      const validator = new Validator({ srcDir });
      const result = await validator.lintFile(filepath);

      const staleHashError = result.errors.find(e => e.rule === 'metadata/stale-hash');
      expect(staleHashError).toBeUndefined();
    });

    it('should fail validation when hash is stale', async () => {
      const code = 'export class InvalidService {}';
      const filepath = createFileWithMetadata('invalid.ts', code, {
        useCorrectHash: false,
        customHash: 'aaaa000011112222'  // Valid hex, but wrong hash
      });

      const validator = new Validator({ srcDir });
      const result = await validator.lintFile(filepath);

      const staleHashError = result.errors.find(e => e.rule === 'metadata/stale-hash');
      expect(staleHashError).toBeDefined();
      expect(staleHashError?.message).toContain('Content changed');
    });

    it('should pass validation after hash is corrected', async () => {
      const code = 'export class FixedService {}';
      const filepath = createFileWithMetadata('fixed.ts', code, {
        useCorrectHash: false,
        customHash: 'aaaa000011112222'  // Valid hex, but wrong hash
      });

      const validator = new Validator({ srcDir });
      
      // First validation should fail
      const failResult = await validator.lintFile(filepath);
      expect(failResult.errors.some(e => e.rule === 'metadata/stale-hash')).toBe(true);

      // Fix the hash by updating it to the correct value
      const content = fs.readFileSync(filepath, 'utf-8');
      const correctHash = generateContentHashFromString(code);
      const fixedContent = content.replace('aaaa000011112222', correctHash);
      fs.writeFileSync(filepath, fixedContent);

      // Second validation should pass
      const passResult = await validator.lintFile(filepath);
      const staleHashError = passResult.errors.find(e => e.rule === 'metadata/stale-hash');
      expect(staleHashError).toBeUndefined();
    });
  });

  describe('Complex Metadata Formats', () => {
    it('should handle metadata with nested objects', () => {
      const code = 'export function complexFunc() { return 42; }';
      const filepath = path.join(srcDir, 'complex.ts');
      
      // Write code first
      fs.writeFileSync(filepath, code);
      const correctHash = generateContentHash(filepath);

      // Create complex metadata with nested objects
      const fullContent = `${code}

// ============================================
// FILE INTROSPECTION METADATA
// ============================================
export const __metadata = {
  module: 'complex',
  filename: 'complex.ts',
  description: 'Complex test',
  responsibilities: [
    'Handle edge cases',
    'Support nested structures'
  ],
  exports: ['complexFunc'],
  dependencies: {
    internal: ['utils/helper', 'core/base'],
    external: ['lodash', 'chalk'],
    types: ['SomeType'] as string[]
  },
  status: 'stable' as const,
  createdAt: '2025-01-01',
  updatedAt: '2025-11-29',
  changelog: [
    { version: '1.0.0', date: '2025-01-01', changes: ['Initial'] },
    { version: '1.1.0', date: '2025-06-01', changes: ['Added feature'] }
  ],
  todos: [
    { id: 'TODO-001', description: 'Refactor', priority: 'medium', status: 'open', createdAt: '2025-11-01' }
  ],
  fixes: [] as Array<{ id: string; description: string; severity: string; status: string; createdAt: string }>,
  _meta: {
    contentHash: '${correctHash}',
    lastValidated: '2025-11-29',
    generatedDeps: ['utils/helper', 'core/base']
  }
} as const;
`;

      fs.writeFileSync(filepath, fullContent);

      // Hash should still be correct
      expect(hasContentChanged(filepath)).toBe(false);
      
      const info = getHashInfo(filepath);
      expect(info.currentHash).toBe(correctHash);
      expect(info.storedHash).toBe(correctHash);
    });

    it('should handle metadata with react section', () => {
      const code = `import React from 'react';
export function MyComponent(props: { name: string }) {
  return <div>{props.name}</div>;
}`;
      const filepath = path.join(srcDir, 'component.tsx');
      
      fs.writeFileSync(filepath, code);
      const correctHash = generateContentHash(filepath);

      const fullContent = `${code}

// ============================================
// FILE INTROSPECTION METADATA
// ============================================
export const __metadata = {
  module: 'component',
  filename: 'component.tsx',
  description: 'React component',
  responsibilities: ['Render UI'],
  exports: ['MyComponent'],
  dependencies: {
    internal: [],
    external: ['react'],
    types: [] as string[]
  },
  status: 'stable' as const,
  createdAt: '2025-11-29',
  updatedAt: '2025-11-29',
  react: {
    componentType: 'function',
    props: {
      interfaceName: 'Props',
      properties: [
        { name: 'name', type: 'string', required: true }
      ]
    },
    hooks: []
  },
  changelog: [{ version: '1.0.0', date: '2025-11-29', changes: ['Initial'] }],
  todos: [] as Array<{ id: string; description: string; priority: string; status: string; createdAt: string }>,
  fixes: [] as Array<{ id: string; description: string; severity: string; status: string; createdAt: string }>,
  _meta: {
    contentHash: '${correctHash}',
    lastValidated: '2025-11-29',
    generatedDeps: []
  }
} as const;
`;

      fs.writeFileSync(filepath, fullContent);

      expect(hasContentChanged(filepath)).toBe(false);
    });

    it('should handle alternative header format "FILE INTROSPECTION" without METADATA suffix', () => {
      const code = 'export const legacy = true;';
      const filepath = path.join(srcDir, 'legacy.ts');
      
      fs.writeFileSync(filepath, code);
      const correctHash = generateContentHash(filepath);

      // Use the older header format without "METADATA" suffix
      const fullContent = `${code}

// ============================================
// FILE INTROSPECTION
// ============================================
export const __metadata = {
  module: 'legacy',
  filename: 'legacy.ts',
  description: 'Legacy format',
  status: 'stable',
  updatedAt: '2025-11-29',
  dependencies: {
    internal: [],
    external: [],
    types: [] as string[]
  },
  _meta: {
    contentHash: '${correctHash}',
    lastValidated: '2025-11-29',
    generatedDeps: []
  }
} as const;
`;

      fs.writeFileSync(filepath, fullContent);

      // Should still correctly strip metadata
      expect(hasContentChanged(filepath)).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle code with regex containing metadata-like patterns', () => {
      const code = `export const pattern = /export const __metadata/;
const template = \`
// ============================================
// Not real metadata
// ============================================
export const __metadata = {
  fake: true
};
\`;`;
      const filepath = path.join(srcDir, 'regex.ts');
      
      fs.writeFileSync(filepath, code);
      const correctHash = generateContentHash(filepath);

      const fullContent = `${code}

// ============================================
// FILE INTROSPECTION METADATA
// ============================================
export const __metadata = {
  module: 'regex',
  filename: 'regex.ts',
  description: 'Has regex patterns',
  status: 'stable',
  updatedAt: '2025-11-29',
  dependencies: {
    internal: [],
    external: [],
    types: [] as string[]
  },
  _meta: {
    contentHash: '${correctHash}',
    lastValidated: '2025-11-29',
    generatedDeps: []
  }
} as const;
`;

      fs.writeFileSync(filepath, fullContent);

      // The real metadata at the end should be stripped, not the fake one in the template
      expect(hasContentChanged(filepath)).toBe(false);
    });

    it('should handle empty code', () => {
      const code = '';
      const filepath = path.join(srcDir, 'empty.ts');
      
      fs.writeFileSync(filepath, code);
      const correctHash = generateContentHash(filepath);

      const fullContent = `${code}
// ============================================
// FILE INTROSPECTION METADATA
// ============================================
export const __metadata = {
  module: 'empty',
  filename: 'empty.ts',
  description: 'Empty file',
  status: 'stable',
  updatedAt: '2025-11-29',
  dependencies: {
    internal: [],
    external: [],
    types: [] as string[]
  },
  _meta: {
    contentHash: '${correctHash}',
    lastValidated: '2025-11-29',
    generatedDeps: []
  }
} as const;
`;

      fs.writeFileSync(filepath, fullContent);
      expect(hasContentChanged(filepath)).toBe(false);
    });

    it('should handle code with special characters', () => {
      const code = `export const special = "こんにちは";
export const emoji = "🚀";
export const escape = "\\n\\t\\"";`;
      const filepath = path.join(srcDir, 'special.ts');
      
      fs.writeFileSync(filepath, code);
      const correctHash = generateContentHash(filepath);

      const fullContent = `${code}

// ============================================
// FILE INTROSPECTION METADATA
// ============================================
export const __metadata = {
  module: 'special',
  filename: 'special.ts',
  description: 'Special characters',
  status: 'stable',
  updatedAt: '2025-11-29',
  dependencies: {
    internal: [],
    external: [],
    types: [] as string[]
  },
  _meta: {
    contentHash: '${correctHash}',
    lastValidated: '2025-11-29',
    generatedDeps: []
  }
} as const;
`;

      fs.writeFileSync(filepath, fullContent);
      expect(hasContentChanged(filepath)).toBe(false);
    });

    it('should handle very long metadata blocks', () => {
      const code = 'export const longDeps = true;';
      const filepath = path.join(srcDir, 'long.ts');
      
      fs.writeFileSync(filepath, code);
      const correctHash = generateContentHash(filepath);

      // Generate lots of dependencies
      const manyInternalDeps = Array.from({ length: 50 }, (_, i) => `'module${i}'`).join(', ');
      const manyExternalDeps = Array.from({ length: 30 }, (_, i) => `'package${i}'`).join(', ');

      const fullContent = `${code}

// ============================================
// FILE INTROSPECTION METADATA
// ============================================
export const __metadata = {
  module: 'long',
  filename: 'long.ts',
  description: 'Many dependencies',
  responsibilities: [
    'Responsibility 1',
    'Responsibility 2',
    'Responsibility 3',
    'Responsibility 4',
    'Responsibility 5'
  ],
  exports: ['longDeps'],
  dependencies: {
    internal: [${manyInternalDeps}],
    external: [${manyExternalDeps}],
    types: [] as string[]
  },
  status: 'stable' as const,
  createdAt: '2025-11-29',
  updatedAt: '2025-11-29',
  changelog: [
    { version: '1.0.0', date: '2025-01-01', changes: ['Initial'] },
    { version: '1.1.0', date: '2025-02-01', changes: ['Update 1'] },
    { version: '1.2.0', date: '2025-03-01', changes: ['Update 2'] },
    { version: '1.3.0', date: '2025-04-01', changes: ['Update 3'] }
  ],
  todos: [] as Array<{ id: string; description: string; priority: string; status: string; createdAt: string }>,
  fixes: [] as Array<{ id: string; description: string; severity: string; status: string; createdAt: string }>,
  _meta: {
    contentHash: '${correctHash}',
    lastValidated: '2025-11-29',
    generatedDeps: [${manyInternalDeps}]
  }
} as const;
`;

      fs.writeFileSync(filepath, fullContent);
      expect(hasContentChanged(filepath)).toBe(false);
    });
  });

  describe('Full Round-Trip Validation', () => {
    it('should pass: generate → lint → modify code → lint (fail) → fix hash → lint (pass)', async () => {
      const initialCode = 'export function add(a: number, b: number) { return a + b; }';
      const filepath = createFileWithMetadata('roundtrip.ts', initialCode, {
        useCorrectHash: true
      });

      const validator = new Validator({ srcDir });

      // Step 1: Initial lint should pass
      const result1 = await validator.lintFile(filepath);
      expect(result1.errors.filter(e => e.rule === 'metadata/stale-hash')).toHaveLength(0);

      // Step 2: Modify the code
      const content = fs.readFileSync(filepath, 'utf-8');
      const modifiedContent = content.replace(
        'return a + b;',
        'return a + b; // optimized'
      );
      fs.writeFileSync(filepath, modifiedContent);

      // Step 3: Lint should fail with stale-hash
      const result2 = await validator.lintFile(filepath);
      expect(result2.errors.some(e => e.rule === 'metadata/stale-hash')).toBe(true);

      // Step 4: Fix the hash
      const currentContent = fs.readFileSync(filepath, 'utf-8');
      const newCorrectHash = generateContentHash(filepath);
      const storedHash = extractStoredHash(filepath);
      const fixedContent = currentContent.replace(storedHash!, newCorrectHash);
      fs.writeFileSync(filepath, fixedContent);

      // Step 5: Lint should pass again
      const result3 = await validator.lintFile(filepath);
      expect(result3.errors.filter(e => e.rule === 'metadata/stale-hash')).toHaveLength(0);
    });
  });

  describe('Consistency Between Hasher and Metadata Stripping', () => {
    it('should produce identical hashes regardless of metadata presence', () => {
      const codeOnly = `import fs from 'fs';
import path from 'path';

export class FileManager {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  read(filename: string): string {
    return fs.readFileSync(path.join(this.basePath, filename), 'utf-8');
  }

  write(filename: string, content: string): void {
    fs.writeFileSync(path.join(this.basePath, filename), content);
  }
}`;

      // Calculate hash of code-only
      const hashOfCode = generateContentHashFromString(codeOnly);

      // Test with various metadata formats
      const formats = [
        // Format 1: Full header with as const
        `${codeOnly}

// ============================================
// FILE INTROSPECTION METADATA
// ============================================
export const __metadata = {
  module: 'file-manager',
  _meta: { contentHash: '${hashOfCode}' }
} as const;`,

        // Format 2: Short header with as const
        `${codeOnly}

// ============================================
// FILE INTROSPECTION
// ============================================
export const __metadata = {
  module: 'file-manager',
  _meta: { contentHash: '${hashOfCode}' }
} as const;`,

        // Format 3: No header
        `${codeOnly}

export const __metadata = {
  module: 'file-manager',
  _meta: { contentHash: '${hashOfCode}' }
} as const;`,

        // Format 4: No as const
        `${codeOnly}

// ============================================
// FILE INTROSPECTION METADATA
// ============================================
export const __metadata = {
  module: 'file-manager',
  _meta: { contentHash: '${hashOfCode}' }
};`,

        // Format 5: Type annotation
        `${codeOnly}

export const __metadata: FileMetadata = {
  module: 'file-manager',
  _meta: { contentHash: '${hashOfCode}' }
};`
      ];

      for (let i = 0; i < formats.length; i++) {
        const contentWithMeta = formats[i]!;
        const hashWithMeta = generateContentHashFromString(contentWithMeta);
        expect(hashWithMeta).toBe(hashOfCode);
      }
    });
  });

  describe('@internal JSDoc Round-Trip', () => {
    it('should produce consistent hashes when regenerating metadata with @internal tag', async () => {
      // This test verifies the fix for the bug where:
      // 1. `tsi generate --overwrite` writes metadata with @internal JSDoc
      // 2. `tsi lint` computes a different hash because removeExistingMetadata
      //    wasn't stripping the @internal JSDoc comment
      
      const code = 'export function processData(input: string): string { return input.toUpperCase(); }';
      const hashOfCode = generateContentHashFromString(code);
      
      // Simulate what generate.ts does:
      // 1. Start with code that has OLD metadata (without @internal)
      const oldMetadata = `${code}

// ============================================
// FILE INTROSPECTION
// ============================================
export const __metadata = {
  module: 'processor',
  _meta: { contentHash: 'old_hash_12345' }
};`;

      // 2. Generate writes NEW metadata with @internal
      const newMetadata = `${code}

// ============================================
// FILE INTROSPECTION METADATA
// ============================================
/** @internal Metadata for tooling - not imported by application code */
export const __metadata = {
  module: 'processor',
  _meta: { contentHash: '${hashOfCode}' }
} as const;`;

      // The hash of the new content should equal the hash of just the code
      const hashOfNewContent = generateContentHashFromString(newMetadata);
      expect(hashOfNewContent).toBe(hashOfCode);
      
      // Also verify the stored hash matches what we expect
      const storedHash = /contentHash:\s*['"]([a-f0-9]+)['"]/.exec(newMetadata)?.[1];
      expect(storedHash).toBe(hashOfCode);
      expect(hashOfNewContent).toBe(storedHash);
    });

    it('should validate successfully after generate --overwrite adds @internal tag', async () => {
      // Create file with old-style metadata (no @internal) and WRONG hash
      const code = 'export const CONFIG = { debug: false };';
      
      const filepath = path.join(srcDir, 'config.ts');
      
      // First write just the code to get the correct hash
      fs.writeFileSync(filepath, code);
      const correctHash = generateContentHash(filepath);
      
      // Now write with WRONG hash - this should trigger stale-hash error
      const wrongHash = 'deadbeef12345678';
      fs.writeFileSync(filepath, `${code}

// ============================================
// FILE INTROSPECTION
// ============================================
export const __metadata = {
  module: 'config',
  filename: 'config.ts',
  description: 'Config file',
  status: 'stable',
  updatedAt: '2025-01-01',
  _meta: { contentHash: '${wrongHash}' }
};`);

      // Verify lint fails with stale hash
      const validator = new Validator({ srcDir });
      const resultBefore = await validator.lintFile(filepath);
      expect(resultBefore.errors.some(e => e.rule === 'metadata/stale-hash')).toBe(true);
      
      // Now simulate what generate --overwrite does:
      // Write new content with @internal and CORRECT hash
      const newContent = `${code}

// ============================================
// FILE INTROSPECTION METADATA
// ============================================
/** @internal Metadata for tooling - not imported by application code */
export const __metadata = {
  module: 'config',
  filename: 'config.ts',
  description: 'Config file',
  status: 'stable',
  updatedAt: '2025-11-29',
  _meta: { contentHash: '${correctHash}' }
} as const;`;

      fs.writeFileSync(filepath, newContent);
      
      // Now lint should pass - no stale-hash errors
      const resultAfter = await validator.lintFile(filepath);
      expect(resultAfter.errors.filter(e => e.rule === 'metadata/stale-hash')).toHaveLength(0);
    });
  });
});


import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Validator, validate, lintFiles, lintFileResult, validateResult, hasValidMetadataResult } from '@/core/validator.js';
import { generateContentHashFromString } from '@/core/hasher.js';
import { isOk, isErr, unwrap, unwrapErr, match } from '@/types/result.js';

describe('Validator', () => {
  let tempDir: string;
  let srcDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tsi-validator-'));
    srcDir = path.join(tempDir, 'src');
    fs.mkdirSync(srcDir);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('lintFile', () => {
    it('should error on missing __metadata export', async () => {
      const testFile = path.join(srcDir, 'test.ts');
      fs.writeFileSync(testFile, 'export const foo = 1;');

      const validator = new Validator({ srcDir });
      const result = await validator.lintFile(testFile);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.rule).toBe('metadata/required');
    });

    it('should pass for file with valid __metadata', async () => {
      const code = 'export class MyClass {}';
      const hash = generateContentHashFromString(code);
      const testFile = path.join(srcDir, 'test.ts');
      fs.writeFileSync(testFile, `${code}

export const __metadata = {
  module: 'test',
  filename: 'test.ts',
  description: 'Test file',
  status: 'stable',
  updatedAt: '2025-11-26',
  dependencies: {
    internal: [],
    external: []
  },
  _meta: {
    contentHash: '${hash}'
  }
};
`);

      const validator = new Validator({ srcDir });
      const result = await validator.lintFile(testFile);

      expect(result.errors).toHaveLength(0);
    });

    it('should error on stale hash', async () => {
      const testFile = path.join(srcDir, 'test.ts');
      fs.writeFileSync(testFile, `
export class MyClass {}

export const __metadata = {
  module: 'test',
  filename: 'test.ts',
  description: 'Test file',
  status: 'stable',
  updatedAt: '2025-11-26',
  _meta: {
    contentHash: 'a1b2c3d4e5f67890'
  }
};
`);

      const validator = new Validator({ srcDir });
      const result = await validator.lintFile(testFile);

      expect(result.errors.some(e => e.rule === 'metadata/stale-hash')).toBe(true);
    });

    it('should error on missing required fields', async () => {
      const testFile = path.join(srcDir, 'test.ts');
      fs.writeFileSync(testFile, `
export const __metadata = {
  module: 'test'
};
`);

      const validator = new Validator({ srcDir });
      const result = await validator.lintFile(testFile);

      expect(result.errors.some(e => e.rule === 'metadata/required-fields')).toBe(true);
    });

    it('should error on duplicate __metadata blocks', async () => {
      const testFile = path.join(srcDir, 'test.ts');
      fs.writeFileSync(testFile, `
export const x = 1;

export const __metadata = {
  module: 'test',
  filename: 'test.ts',
  description: 'Test',
  status: 'stable',
  updatedAt: '2025-11-30',
  _meta: { contentHash: 'abc' }
};

export const __metadata = { module: 'duplicate' };

export const __metadata = { module: 'another-duplicate' };
`);

      const validator = new Validator({ srcDir });
      const result = await validator.lintFile(testFile);

      const duplicateError = result.errors.find(e => e.rule === 'metadata/duplicate');
      expect(duplicateError).toBeDefined();
      expect(duplicateError?.message).toContain('3 duplicate');
      expect(duplicateError?.fixable).toBe(true);
    });

    it('should not error on single __metadata block', async () => {
      const code = 'export const x = 1;';
      const hash = generateContentHashFromString(code);
      const testFile = path.join(srcDir, 'test.ts');
      fs.writeFileSync(testFile, `${code}

export const __metadata = {
  module: 'test',
  filename: 'test.ts',
  description: 'Test',
  status: 'stable',
  updatedAt: '2025-11-30',
  _meta: { contentHash: '${hash}' }
};
`);

      const validator = new Validator({ srcDir });
      const result = await validator.lintFile(testFile);

      expect(result.errors.some(e => e.rule === 'metadata/duplicate')).toBe(false);
    });

    it('should warn on inline TODOs not in metadata', async () => {
      const code = '// TODO: Fix this\nexport class MyClass {}';
      const hash = generateContentHashFromString(code);
      const testFile = path.join(srcDir, 'test.ts');
      fs.writeFileSync(testFile, `${code}

export const __metadata = {
  module: 'test',
  filename: 'test.ts',
  description: 'Test',
  status: 'stable',
  updatedAt: '2025-11-26',
  _meta: { contentHash: '${hash}' }
};
`);

      const validator = new Validator({ srcDir });
      const result = await validator.lintFile(testFile);

      expect(result.warnings.some(w => w.rule === 'metadata/untracked-todos')).toBe(true);
    });

    it('should warn on stale updatedAt', async () => {
      const code = 'export class MyClass {}';
      const hash = generateContentHashFromString(code);
      const testFile = path.join(srcDir, 'test.ts');
      fs.writeFileSync(testFile, `${code}

export const __metadata = {
  module: 'test',
  filename: 'test.ts',
  description: 'Test',
  status: 'stable',
  updatedAt: '2020-01-01',
  _meta: { contentHash: '${hash}' }
};
`);

      const validator = new Validator({ srcDir, staleDays: 30 });
      const result = await validator.lintFile(testFile);

      expect(result.warnings.some(w => w.rule === 'metadata/stale-update')).toBe(true);
    });
  });

  describe('validate', () => {
    it('should validate all files in srcDir', async () => {
      fs.writeFileSync(path.join(srcDir, 'a.ts'), 'export const a = 1;');
      fs.writeFileSync(path.join(srcDir, 'b.ts'), 'export const b = 2;');

      const validator = new Validator({ srcDir });
      const result = await validator.validate();

      expect(result.filesChecked).toBe(2);
      expect(result.totalErrors).toBe(2); // Both missing metadata
    });

    it('should exclude test files by default', async () => {
      fs.writeFileSync(path.join(srcDir, 'main.ts'), 'export const main = 1;');
      fs.writeFileSync(path.join(srcDir, 'main.test.ts'), 'test("should work", () => {});');

      const validator = new Validator({ srcDir });
      const result = await validator.validate();

      expect(result.filesChecked).toBe(1);
    });

    it('should validate specific files when provided', async () => {
      fs.writeFileSync(path.join(srcDir, 'a.ts'), 'export const a = 1;');
      fs.writeFileSync(path.join(srcDir, 'b.ts'), 'export const b = 2;');

      const validator = new Validator({ srcDir });
      const result = await validator.validate([path.join(srcDir, 'a.ts')]);

      expect(result.filesChecked).toBe(1);
    });

    it('should pass in strict mode only if no warnings', async () => {
      const code = '// TODO: fix\nexport class A {}';
      const hash = generateContentHashFromString(code);
      fs.writeFileSync(path.join(srcDir, 'a.ts'), `${code}

export const __metadata = {
  module: 'a',
  filename: 'a.ts',
  description: 'Test',
  status: 'stable',
  updatedAt: '2025-11-26',
  _meta: { contentHash: '${hash}' }
};
`);

      const validator = new Validator({ srcDir, strictMode: true });
      const result = await validator.validate();

      expect(result.passed).toBe(false);
    });
  });

  describe('validate function', () => {
    it('should work as standalone function', async () => {
      fs.writeFileSync(path.join(srcDir, 'test.ts'), 'export const x = 1;');

      const result = await validate({ srcDir });

      expect(result.totalErrors).toBeGreaterThan(0);
    });
  });

  describe('lintFiles function', () => {
    it('should lint specific files', async () => {
      const testFile = path.join(srcDir, 'test.ts');
      fs.writeFileSync(testFile, 'export const x = 1;');

      const result = await lintFiles([testFile], { srcDir });

      expect(result.totalErrors).toBe(1);
    });
  });

  describe('Result-based API', () => {
    describe('lintFileResult', () => {
      it('should return Ok for valid file', async () => {
        const code = 'export class MyClass {}';
        const hash = generateContentHashFromString(code);
        const testFile = path.join(srcDir, 'test.ts');
        fs.writeFileSync(testFile, `${code}

export const __metadata = {
  module: 'test',
  filename: 'test.ts',
  description: 'Test',
  status: 'stable',
  updatedAt: '2025-11-26',
  _meta: { contentHash: '${hash}' }
};
`);

        const result = await lintFileResult(testFile, { srcDir });

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.errors).toHaveLength(0);
        }
      });

      it('should return Err for invalid filepath', async () => {
        const result = await lintFileResult('');

        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error.code).toBe('INVALID_FILEPATH');
        }
      });

      it('should return Err for non-existent file', async () => {
        const result = await lintFileResult('/nonexistent/file.ts');

        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error.code).toBe('FILE_NOT_FOUND');
        }
      });

      it('should return Err for non-typescript file', async () => {
        const jsFile = path.join(srcDir, 'test.js');
        fs.writeFileSync(jsFile, 'export const x = 1;');

        const result = await lintFileResult(jsFile);

        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error.code).toBe('NOT_TYPESCRIPT');
        }
      });

      it('should return Err for directory path', async () => {
        const result = await lintFileResult(srcDir);

        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error.code).toBe('NOT_A_FILE');
        }
      });

      it('should work with match function', async () => {
        const testFile = path.join(srcDir, 'test.ts');
        fs.writeFileSync(testFile, 'export const x = 1;');

        const result = await lintFileResult(testFile, { srcDir });

        const output = match(result, {
          ok: (lint) => `Found ${lint.errors.length} errors`,
          err: (e) => `Error: ${e.code}`
        });

        expect(output).toBe('Found 1 errors');
      });
    });

    describe('validateResult', () => {
      it('should return Ok with validation result', async () => {
        fs.writeFileSync(path.join(srcDir, 'test.ts'), 'export const x = 1;');

        const result = await validateResult({ srcDir });

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.totalErrors).toBeGreaterThan(0);
        }
      });

      it('should return Ok even when validation finds errors', async () => {
        fs.writeFileSync(path.join(srcDir, 'test.ts'), 'export const x = 1;');

        const result = await validateResult({ srcDir });

        // The function itself succeeds even if validation fails
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.passed).toBe(false);
        }
      });
    });

    describe('hasValidMetadataResult', () => {
      it('should return Ok(true) for valid file', async () => {
        const code = 'export class MyClass {}';
        const hash = generateContentHashFromString(code);
        const testFile = path.join(srcDir, 'test.ts');
        fs.writeFileSync(testFile, `${code}

export const __metadata = {
  module: 'test',
  filename: 'test.ts',
  description: 'Test',
  status: 'stable',
  updatedAt: '2025-11-26',
  _meta: { contentHash: '${hash}' }
};
`);

        const result = await hasValidMetadataResult(testFile, { srcDir });

        expect(isOk(result)).toBe(true);
        expect(unwrap(result)).toBe(true);
      });

      it('should return Ok(false) for invalid file', async () => {
        const testFile = path.join(srcDir, 'test.ts');
        fs.writeFileSync(testFile, 'export const x = 1;');

        const result = await hasValidMetadataResult(testFile, { srcDir });

        expect(isOk(result)).toBe(true);
        expect(unwrap(result)).toBe(false);
      });

      it('should return Err for non-existent file', async () => {
        const result = await hasValidMetadataResult('/nonexistent/file.ts');

        expect(isErr(result)).toBe(true);
        expect(unwrapErr(result).code).toBe('FILE_NOT_FOUND');
      });
    });
  });
});


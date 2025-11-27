import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  generateContentHash,
  generateContentHashFromString,
  extractStoredHash,
  extractStoredHashFromString,
  hasContentChanged,
  getHashInfo
} from '../../src/core/hasher.js';

describe('Hasher', () => {
  let tempDir: string;
  let testFile: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tsi-test-'));
    testFile = path.join(tempDir, 'test.ts');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('generateContentHashFromString', () => {
    it('should generate consistent hash for same content', () => {
      const content = 'const foo = "bar";';
      const hash1 = generateContentHashFromString(content);
      const hash2 = generateContentHashFromString(content);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(16); // Short hash
    });

    it('should generate different hash for different content', () => {
      const hash1 = generateContentHashFromString('const foo = "bar";');
      const hash2 = generateContentHashFromString('const foo = "baz";');

      expect(hash1).not.toBe(hash2);
    });

    it('should exclude __metadata block from hash calculation', () => {
      const codeOnly = 'const foo = "bar";';
      const codeWithMetadata = `${codeOnly}

// ============================================
// FILE INTROSPECTION
// ============================================
export const __metadata = {
  module: 'test',
  contentHash: 'abc123'
};`;

      const hash1 = generateContentHashFromString(codeOnly);
      const hash2 = generateContentHashFromString(codeWithMetadata);

      expect(hash1).toBe(hash2);
    });
  });

  describe('generateContentHash', () => {
    it('should generate hash from file', () => {
      fs.writeFileSync(testFile, 'const x = 1;');

      const hash = generateContentHash(testFile);

      expect(hash).toHaveLength(16);
      expect(hash).toMatch(/^[a-f0-9]+$/);
    });
  });

  describe('extractStoredHashFromString', () => {
    it('should extract hash from content', () => {
      const content = `
export const __metadata = {
  contentHash: 'abc123def456789',
  other: 'field'
};`;

      const hash = extractStoredHashFromString(content);

      expect(hash).toBe('abc123def456789');
    });

    it('should return null if no hash found', () => {
      const content = 'const foo = "bar";';

      const hash = extractStoredHashFromString(content);

      expect(hash).toBeNull();
    });

    it('should handle double quotes', () => {
      const content = 'contentHash: "abc123def456789a"';

      const hash = extractStoredHashFromString(content);

      expect(hash).toBe('abc123def456789a');
    });
  });

  describe('extractStoredHash', () => {
    it('should extract hash from file', () => {
      // Hash must be valid hex (0-9, a-f)
      fs.writeFileSync(testFile, "contentHash: 'abcd1234ef567890'");

      const hash = extractStoredHash(testFile);

      expect(hash).toBe('abcd1234ef567890');
    });
  });

  describe('hasContentChanged', () => {
    it('should return true if no stored hash', () => {
      fs.writeFileSync(testFile, 'const foo = 1;');

      expect(hasContentChanged(testFile)).toBe(true);
    });

    it('should return false if hash matches', () => {
      // Write code with __metadata block - the hash generator strips this out
      const code = `const foo = 1;

export const __metadata = {
  contentHash: 'PLACEHOLDER'
};`;
      // First calculate what the hash would be for just "const foo = 1;"
      fs.writeFileSync(testFile, 'const foo = 1;');
      const correctHash = generateContentHash(testFile);

      // Now write full content with the correct hash
      const fullContent = code.replace('PLACEHOLDER', correctHash);
      fs.writeFileSync(testFile, fullContent);

      // Should not detect change because __metadata block is excluded from hash
      expect(hasContentChanged(testFile)).toBe(false);
    });

    it('should return true if hash does not match', () => {
      fs.writeFileSync(testFile, "const foo = 1;\ncontentHash: 'a1b2c3d4e5f67890'");

      expect(hasContentChanged(testFile)).toBe(true);
    });
  });

  describe('getHashInfo', () => {
    it('should return complete hash info', () => {
      const code = 'const x = 42;';
      fs.writeFileSync(testFile, code);
      const hash = generateContentHash(testFile);
      fs.writeFileSync(testFile, `${code}\ncontentHash: '${hash}'`);

      const info = getHashInfo(testFile);

      expect(info.filepath).toBe(testFile);
      expect(info.storedHash).toBe(hash);
      // The current hash will be different because we added the contentHash line
      // which changes the content. This is expected behavior.
      expect(info.changed).toBe(true); // Content changed by adding hash line
    });

    it('should detect changes', () => {
      fs.writeFileSync(testFile, "const x = 42;\ncontentHash: 'a1b2c3d4e5f67890'");

      const info = getHashInfo(testFile);

      expect(info.changed).toBe(true);
      expect(info.storedHash).toBe('a1b2c3d4e5f67890');
      expect(info.currentHash).not.toBe(info.storedHash);
    });

    it('should return null stored hash if none exists', () => {
      fs.writeFileSync(testFile, 'const x = 42;');

      const info = getHashInfo(testFile);

      expect(info.storedHash).toBeNull();
      expect(info.changed).toBe(true);
    });
  });
});


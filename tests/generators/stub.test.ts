import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { generateMetadataStub, generateMetadataObject } from '@/generators/stub.js';

describe('Stub Generator', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tsi-stub-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('generateMetadataStub', () => {
    it('should generate valid metadata stub string', () => {
      const content = `
import fs from 'fs';
import { helper } from './utils.js';

export class MyService {
  doSomething() {}
}
`;
      const stub = generateMetadataStub({
        filepath: path.join(tempDir, 'src', 'services', 'my-service.ts'),
        content,
        srcDir: path.join(tempDir, 'src')
      });

      expect(stub).toContain("module: 'services/my-service'");
      expect(stub).toContain("filename: 'my-service.ts'");
      expect(stub).toContain('export const __metadata');
      expect(stub).toContain("status: 'stable'");
    });

    it('should include detected exports', () => {
      const content = `
export class UserService {}
export function createUser() {}
export const USER_ROLE = 'admin';
`;
      const stub = generateMetadataStub({
        filepath: path.join(tempDir, 'src', 'user.ts'),
        content,
        srcDir: path.join(tempDir, 'src')
      });

      expect(stub).toContain("'UserService'");
      expect(stub).toContain("'createUser'");
      expect(stub).toContain("'USER_ROLE'");
    });

    it('should include detected dependencies', () => {
      const content = `
import fs from 'fs';
import { Client } from '@anthropic-ai/sdk';
import { helper } from './utils.js';
`;
      const stub = generateMetadataStub({
        filepath: path.join(tempDir, 'src', 'test.ts'),
        content,
        srcDir: path.join(tempDir, 'src')
      });

      expect(stub).toContain("'fs'");
      expect(stub).toContain("'@anthropic-ai/sdk'");
    });

    it('should include content hash', () => {
      const content = 'export const x = 1;';
      const stub = generateMetadataStub({
        filepath: path.join(tempDir, 'src', 'test.ts'),
        content,
        srcDir: path.join(tempDir, 'src')
      });

      expect(stub).toMatch(/contentHash: '[a-f0-9]+'/);
    });

    it('should use provided author', () => {
      const content = 'export const x = 1;';
      const stub = generateMetadataStub({
        filepath: path.join(tempDir, 'src', 'test.ts'),
        content,
        srcDir: path.join(tempDir, 'src'),
        author: 'john.doe'
      });

      expect(stub).toContain("author: 'john.doe'");
    });

    it('should use current date for timestamps', () => {
      const content = 'export const x = 1;';
      const today = new Date().toISOString().split('T')[0];
      const stub = generateMetadataStub({
        filepath: path.join(tempDir, 'src', 'test.ts'),
        content,
        srcDir: path.join(tempDir, 'src')
      });

      expect(stub).toContain(`createdAt: '${today}'`);
      expect(stub).toContain(`updatedAt: '${today}'`);
    });
  });

  describe('generateMetadataObject', () => {
    it('should generate valid FileMetadata object', () => {
      const content = `
export class MyClass {}
export function myFunc() {}
`;
      const meta = generateMetadataObject({
        filepath: path.join(tempDir, 'src', 'my-file.ts'),
        content,
        srcDir: path.join(tempDir, 'src')
      });

      expect(meta.module).toBe('my-file');
      expect(meta.filename).toBe('my-file.ts');
      expect(meta.status).toBe('stable');
      expect(meta.exports).toContain('MyClass');
      expect(meta.exports).toContain('myFunc');
      expect(meta._meta.contentHash).toHaveLength(16);
    });

    it('should detect external dependencies', () => {
      const content = "import chalk from 'chalk';";
      const meta = generateMetadataObject({
        filepath: path.join(tempDir, 'src', 'test.ts'),
        content,
        srcDir: path.join(tempDir, 'src')
      });

      expect(meta.dependencies.external).toContain('chalk');
    });

    it('should include initial changelog entry', () => {
      const content = 'export const x = 1;';
      const today = new Date().toISOString().split('T')[0]!;
      const meta = generateMetadataObject({
        filepath: path.join(tempDir, 'src', 'test.ts'),
        content,
        srcDir: path.join(tempDir, 'src'),
        author: 'developer'
      });

      expect(meta.changelog).toHaveLength(1);
      expect(meta.changelog[0]?.version).toBe('1.0.0');
      expect(meta.changelog[0]?.date).toBe(today);
      expect(meta.changelog[0]?.author).toBe('developer');
    });

    it('should have empty todos and fixes', () => {
      const content = 'export const x = 1;';
      const meta = generateMetadataObject({
        filepath: path.join(tempDir, 'src', 'test.ts'),
        content,
        srcDir: path.join(tempDir, 'src')
      });

      expect(meta.todos).toEqual([]);
      expect(meta.fixes).toEqual([]);
    });
  });
});


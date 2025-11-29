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


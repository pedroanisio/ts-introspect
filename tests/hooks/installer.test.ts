import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { installHooks, uninstallHooks, checkHooksInstalled } from '../../src/hooks/installer.js';

describe('Hooks Installer', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tsi-hooks-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('installHooks', () => {
    it('should throw if not in a git repository', async () => {
      await expect(installHooks()).rejects.toThrow('Not a git repository');
    });

    it('should create pre-commit hook in .git/hooks', async () => {
      // Create .git directory
      fs.mkdirSync(path.join(tempDir, '.git'));

      await installHooks();

      const hookPath = path.join(tempDir, '.git', 'hooks', 'pre-commit');
      expect(fs.existsSync(hookPath)).toBe(true);

      const content = fs.readFileSync(hookPath, 'utf-8');
      expect(content).toContain('ts-introspect');
      expect(content).toContain('#!/bin/bash');
    });

    it('should create hooks directory if it does not exist', async () => {
      fs.mkdirSync(path.join(tempDir, '.git'));

      await installHooks();

      expect(fs.existsSync(path.join(tempDir, '.git', 'hooks'))).toBe(true);
    });

    it('should update existing ts-introspect hook', async () => {
      fs.mkdirSync(path.join(tempDir, '.git', 'hooks'), { recursive: true });
      const hookPath = path.join(tempDir, '.git', 'hooks', 'pre-commit');
      fs.writeFileSync(hookPath, '#!/bin/bash\n# ts-introspect old version\necho old');

      await installHooks();

      const content = fs.readFileSync(hookPath, 'utf-8');
      expect(content).toContain('tsi lint');
      expect(content).not.toContain('echo old');
    });

    it('should append to existing non-ts-introspect hook', async () => {
      fs.mkdirSync(path.join(tempDir, '.git', 'hooks'), { recursive: true });
      const hookPath = path.join(tempDir, '.git', 'hooks', 'pre-commit');
      fs.writeFileSync(hookPath, '#!/bin/bash\necho "other hook"');

      await installHooks();

      const content = fs.readFileSync(hookPath, 'utf-8');
      expect(content).toContain('echo "other hook"');
      expect(content).toContain('ts-introspect');
    });

    it('should make hook executable', async () => {
      fs.mkdirSync(path.join(tempDir, '.git'));

      await installHooks();

      const hookPath = path.join(tempDir, '.git', 'hooks', 'pre-commit');
      const stats = fs.statSync(hookPath);
      // Check if owner has execute permission
      expect(stats.mode & 0o100).toBeTruthy();
    });
  });

  describe('uninstallHooks', () => {
    it('should throw if not in a git repository', async () => {
      await expect(uninstallHooks()).rejects.toThrow('Not a git repository');
    });

    it('should do nothing if no hook exists', async () => {
      fs.mkdirSync(path.join(tempDir, '.git', 'hooks'), { recursive: true });

      await expect(uninstallHooks()).resolves.toBeUndefined();
    });

    it('should remove hook if it is solely ts-introspect', async () => {
      fs.mkdirSync(path.join(tempDir, '.git', 'hooks'), { recursive: true });
      const hookPath = path.join(tempDir, '.git', 'hooks', 'pre-commit');

      // Install first
      await installHooks();
      expect(fs.existsSync(hookPath)).toBe(true);

      // Then uninstall
      await uninstallHooks();
      expect(fs.existsSync(hookPath)).toBe(false);
    });

    it('should remove only ts-introspect section from mixed hook', async () => {
      fs.mkdirSync(path.join(tempDir, '.git', 'hooks'), { recursive: true });
      const hookPath = path.join(tempDir, '.git', 'hooks', 'pre-commit');

      // Create a hook with other content first
      fs.writeFileSync(hookPath, '#!/bin/bash\necho "other hook"\n\n# ts-introspect pre-commit hook\necho introspect\nexit 0\n');

      await uninstallHooks();

      const content = fs.readFileSync(hookPath, 'utf-8');
      expect(content).toContain('other hook');
      expect(content).not.toContain('ts-introspect');
    });
  });

  describe('checkHooksInstalled', () => {
    it('should return false if not in a git repository', async () => {
      const result = await checkHooksInstalled();
      expect(result.preCommit).toBe(false);
    });

    it('should return false if no hook exists', async () => {
      fs.mkdirSync(path.join(tempDir, '.git', 'hooks'), { recursive: true });

      const result = await checkHooksInstalled();
      expect(result.preCommit).toBe(false);
    });

    it('should return true if ts-introspect hook is installed', async () => {
      fs.mkdirSync(path.join(tempDir, '.git'));

      await installHooks();

      const result = await checkHooksInstalled();
      expect(result.preCommit).toBe(true);
    });

    it('should return false if hook exists but is not ts-introspect', async () => {
      fs.mkdirSync(path.join(tempDir, '.git', 'hooks'), { recursive: true });
      fs.writeFileSync(
        path.join(tempDir, '.git', 'hooks', 'pre-commit'),
        '#!/bin/bash\necho "other hook"'
      );

      const result = await checkHooksInstalled();
      expect(result.preCommit).toBe(false);
    });
  });

  describe('git worktree support', () => {
    it('should follow gitdir file for worktrees', async () => {
      // Create main repo
      const mainRepo = path.join(tempDir, 'main-repo');
      fs.mkdirSync(path.join(mainRepo, '.git', 'hooks'), { recursive: true });

      // Create worktree with .git file pointing to main repo
      const worktree = path.join(tempDir, 'worktree');
      fs.mkdirSync(worktree);
      fs.writeFileSync(
        path.join(worktree, '.git'),
        `gitdir: ${path.join(mainRepo, '.git')}`
      );

      process.chdir(worktree);

      await installHooks();

      // Hook should be in main repo's hooks dir
      const hookPath = path.join(mainRepo, '.git', 'hooks', 'pre-commit');
      expect(fs.existsSync(hookPath)).toBe(true);
    });
  });
});


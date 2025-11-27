import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { IntrospectionRegistry } from '../../src/core/registry.js';
import type { FileMetadata } from '../../src/types/metadata.js';

describe('IntrospectionRegistry', () => {
  let tempDir: string;
  let srcDir: string;
  let registry: IntrospectionRegistry;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tsi-registry-'));
    srcDir = path.join(tempDir, 'src');
    fs.mkdirSync(srcDir);
    registry = new IntrospectionRegistry();
    IntrospectionRegistry.reset();
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const createMetadata = (overrides: Partial<FileMetadata> = {}): FileMetadata => ({
    module: 'test/module',
    filename: 'module.ts',
    description: 'Test module',
    responsibilities: ['Testing'],
    exports: ['TestClass'],
    dependencies: { internal: [], external: [] },
    status: 'stable',
    createdAt: '2025-01-01',
    updatedAt: '2025-11-26',
    changelog: [],
    todos: [],
    fixes: [],
    _meta: { contentHash: 'abc123', lastValidated: '2025-11-26', generatedDeps: [] },
    ...overrides
  });

  describe('register', () => {
    it('should register a module', () => {
      const meta = createMetadata();

      registry.register(meta);

      expect(registry.size()).toBe(1);
      expect(registry.getModule('test/module')).toEqual(meta);
    });

    it('should overwrite existing module', () => {
      registry.register(createMetadata({ description: 'First' }));
      registry.register(createMetadata({ description: 'Second' }));

      expect(registry.size()).toBe(1);
      expect(registry.getModule('test/module')?.description).toBe('Second');
    });
  });

  describe('loadAll', () => {
    it('should load metadata from files', async () => {
      fs.writeFileSync(path.join(srcDir, 'test.ts'), `
export const __metadata = {
  module: 'test',
  filename: 'test.ts',
  description: 'A test module',
  status: 'stable',
  updatedAt: '2025-11-26'
};
`);

      await registry.loadAll(srcDir);

      expect(registry.size()).toBe(1);
      expect(registry.getModule('test')?.description).toBe('A test module');
    });

    it('should skip files without metadata', async () => {
      fs.writeFileSync(path.join(srcDir, 'no-meta.ts'), 'export const x = 1;');
      fs.writeFileSync(path.join(srcDir, 'has-meta.ts'), `
export const __metadata = {
  module: 'has-meta',
  filename: 'has-meta.ts',
  description: 'Has metadata'
};
`);

      await registry.loadAll(srcDir);

      expect(registry.size()).toBe(1);
    });
  });

  describe('getAllModules', () => {
    it('should return all registered modules', () => {
      registry.register(createMetadata({ module: 'a' }));
      registry.register(createMetadata({ module: 'b' }));
      registry.register(createMetadata({ module: 'c' }));

      const modules = registry.getAllModules();

      expect(modules).toHaveLength(3);
    });
  });

  describe('getAllTodos', () => {
    it('should aggregate todos from all modules', () => {
      registry.register(createMetadata({
        module: 'a',
        todos: [
          { id: 'TODO-1', description: 'First', priority: 'high', status: 'pending', createdAt: '2025-01-01' }
        ]
      }));
      registry.register(createMetadata({
        module: 'b',
        todos: [
          { id: 'TODO-2', description: 'Second', priority: 'low', status: 'pending', createdAt: '2025-01-01' }
        ]
      }));

      const todos = registry.getAllTodos();

      expect(todos).toHaveLength(2);
      expect(todos[0]?.priority).toBe('high'); // Sorted by priority
      expect(todos[1]?.priority).toBe('low');
    });

    it('should include module path in todos', () => {
      registry.register(createMetadata({
        module: 'my/module',
        todos: [
          { id: 'TODO-1', description: 'Test', priority: 'medium', status: 'pending', createdAt: '2025-01-01' }
        ]
      }));

      const todos = registry.getAllTodos();

      expect(todos[0]?.module).toBe('my/module');
    });
  });

  describe('getAllFixes', () => {
    it('should aggregate open fixes from all modules', () => {
      registry.register(createMetadata({
        module: 'a',
        fixes: [
          { id: 'FIX-1', description: 'Open', severity: 'major', status: 'open', createdAt: '2025-01-01' },
          { id: 'FIX-2', description: 'Fixed', severity: 'minor', status: 'fixed', createdAt: '2025-01-01' }
        ]
      }));

      const fixes = registry.getAllFixes();

      expect(fixes).toHaveLength(1);
      expect(fixes[0]?.id).toBe('FIX-1');
    });
  });

  describe('getRecentlyUpdated', () => {
    it('should return modules updated within specified days', () => {
      const today = new Date().toISOString().split('T')[0]!;
      const oldDate = '2020-01-01';

      registry.register(createMetadata({ module: 'recent', updatedAt: today }));
      registry.register(createMetadata({ module: 'old', updatedAt: oldDate }));

      const recent = registry.getRecentlyUpdated(7);

      expect(recent).toHaveLength(1);
      expect(recent[0]?.module).toBe('recent');
    });
  });

  describe('getByStatus', () => {
    it('should filter modules by status', () => {
      registry.register(createMetadata({ module: 'stable1', status: 'stable' }));
      registry.register(createMetadata({ module: 'stable2', status: 'stable' }));
      registry.register(createMetadata({ module: 'beta', status: 'beta' }));
      registry.register(createMetadata({ module: 'deprecated', status: 'deprecated' }));

      expect(registry.getByStatus('stable')).toHaveLength(2);
      expect(registry.getByStatus('beta')).toHaveLength(1);
      expect(registry.getByStatus('deprecated')).toHaveLength(1);
      expect(registry.getByStatus('experimental')).toHaveLength(0);
    });
  });

  describe('search', () => {
    it('should search by module path', () => {
      registry.register(createMetadata({ module: 'users/service' }));
      registry.register(createMetadata({ module: 'products/service' }));

      const results = registry.search('users');

      expect(results).toHaveLength(1);
      expect(results[0]?.module).toBe('users/service');
    });

    it('should search by description', () => {
      registry.register(createMetadata({ module: 'a', description: 'Handles user authentication' }));
      registry.register(createMetadata({ module: 'b', description: 'Manages products' }));

      const results = registry.search('authentication');

      expect(results).toHaveLength(1);
    });

    it('should be case insensitive', () => {
      registry.register(createMetadata({ module: 'UserService' }));

      expect(registry.search('userservice')).toHaveLength(1);
      expect(registry.search('USERSERVICE')).toHaveLength(1);
    });
  });

  describe('getSummary', () => {
    it('should generate correct summary', () => {
      const today = new Date().toISOString().split('T')[0]!;
      registry.register(createMetadata({
        module: 'a',
        status: 'stable',
        updatedAt: today,
        todos: [{ id: 'T1', description: '', priority: 'low', status: 'pending', createdAt: today }]
      }));
      registry.register(createMetadata({
        module: 'b',
        status: 'beta',
        updatedAt: '2020-01-01',
        fixes: [{ id: 'F1', description: '', severity: 'minor', status: 'open', createdAt: today }]
      }));

      const summary = registry.getSummary();

      expect(summary.totalModules).toBe(2);
      expect(summary.todoCount).toBe(1);
      expect(summary.fixCount).toBe(1);
      expect(summary.statusBreakdown.stable).toBe(1);
      expect(summary.statusBreakdown.beta).toBe(1);
      expect(summary.recentlyUpdated).toBe(1);
    });
  });

  describe('singleton', () => {
    it('should return same instance', () => {
      const instance1 = IntrospectionRegistry.getInstance();
      const instance2 = IntrospectionRegistry.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should reset correctly', () => {
      const instance1 = IntrospectionRegistry.getInstance();
      instance1.register(createMetadata());
      expect(instance1.size()).toBe(1);

      IntrospectionRegistry.reset();
      const instance2 = IntrospectionRegistry.getInstance();

      expect(instance2.size()).toBe(0);
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('clear', () => {
    it('should clear all modules', () => {
      registry.register(createMetadata({ module: 'a' }));
      registry.register(createMetadata({ module: 'b' }));
      expect(registry.size()).toBe(2);

      registry.clear();

      expect(registry.size()).toBe(0);
      expect(registry.isLoaded()).toBe(false);
    });
  });
});


/**
 * ConfigService Tests
 * 
 * TDD: RED phase - These tests define the expected behavior
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { ConfigService } from '@/core/config-service.js';
import { DEFAULT_CONFIG } from '@/types/config.js';

describe('ConfigService', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    // Reset singleton between tests
    ConfigService.reset();
    
    // Create temp directory and change to it
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tsi-config-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = ConfigService.getInstance();
      const instance2 = ConfigService.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should return new instance after reset', () => {
      const instance1 = ConfigService.getInstance();
      ConfigService.reset();
      const instance2 = ConfigService.getInstance();
      
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('load()', () => {
    it('should return DEFAULT_CONFIG when no config file exists', () => {
      const service = ConfigService.getInstance();
      const config = service.load();
      
      expect(config).toEqual(DEFAULT_CONFIG);
    });

    it('should load config from introspect.config.json', () => {
      const customConfig = {
        srcDir: 'custom-src',
        staleDays: 60
      };
      fs.writeFileSync(
        path.join(tempDir, 'introspect.config.json'),
        JSON.stringify(customConfig)
      );

      const service = ConfigService.getInstance();
      const config = service.load();

      expect(config.srcDir).toBe('custom-src');
      expect(config.staleDays).toBe(60);
      // Should preserve defaults for non-specified fields
      expect(config.strictMode).toBe(DEFAULT_CONFIG.strictMode);
    });

    it('should load config from .introspectrc.json', () => {
      const customConfig = { srcDir: 'from-rc' };
      fs.writeFileSync(
        path.join(tempDir, '.introspectrc.json'),
        JSON.stringify(customConfig)
      );

      const service = ConfigService.getInstance();
      const config = service.load();

      expect(config.srcDir).toBe('from-rc');
    });

    it('should load config from .introspectrc', () => {
      const customConfig = { srcDir: 'from-dotrc' };
      fs.writeFileSync(
        path.join(tempDir, '.introspectrc'),
        JSON.stringify(customConfig)
      );

      const service = ConfigService.getInstance();
      const config = service.load();

      expect(config.srcDir).toBe('from-dotrc');
    });

    it('should load config from ts-introspect.config.json', () => {
      const customConfig = { srcDir: 'from-ts-introspect' };
      fs.writeFileSync(
        path.join(tempDir, 'ts-introspect.config.json'),
        JSON.stringify(customConfig)
      );

      const service = ConfigService.getInstance();
      const config = service.load();

      expect(config.srcDir).toBe('from-ts-introspect');
    });

    it('should prioritize introspect.config.json over other config files', () => {
      fs.writeFileSync(
        path.join(tempDir, 'introspect.config.json'),
        JSON.stringify({ srcDir: 'priority-1' })
      );
      fs.writeFileSync(
        path.join(tempDir, '.introspectrc.json'),
        JSON.stringify({ srcDir: 'priority-2' })
      );

      const service = ConfigService.getInstance();
      const config = service.load();

      expect(config.srcDir).toBe('priority-1');
    });

    it('should load from explicit path when provided', () => {
      const customPath = path.join(tempDir, 'custom', 'my-config.json');
      fs.mkdirSync(path.dirname(customPath), { recursive: true });
      fs.writeFileSync(customPath, JSON.stringify({ srcDir: 'explicit-path' }));

      const service = ConfigService.getInstance();
      const config = service.load(customPath);

      expect(config.srcDir).toBe('explicit-path');
    });

    it('should throw error for non-existent explicit path', () => {
      const service = ConfigService.getInstance();
      
      expect(() => service.load('/non/existent/path.json')).toThrow('Config file not found');
    });

    it('should throw error for invalid JSON', () => {
      fs.writeFileSync(
        path.join(tempDir, 'introspect.config.json'),
        'not valid json {'
      );

      const service = ConfigService.getInstance();
      
      expect(() => service.load()).toThrow('Failed to parse config');
    });

    it('should deep merge rules configuration', () => {
      const customConfig = {
        rules: {
          'metadata/required': 'warn' as const
        }
      };
      fs.writeFileSync(
        path.join(tempDir, 'introspect.config.json'),
        JSON.stringify(customConfig)
      );

      const service = ConfigService.getInstance();
      const config = service.load();

      // Custom rule should be overridden
      expect(config.rules['metadata/required']).toBe('warn');
      // Other rules should be preserved from defaults
      expect(config.rules['metadata/stale-hash']).toBe(DEFAULT_CONFIG.rules['metadata/stale-hash']);
    });

    it('should deep merge hooks configuration', () => {
      const customConfig = {
        hooks: {
          preCommit: false
        }
      };
      fs.writeFileSync(
        path.join(tempDir, 'introspect.config.json'),
        JSON.stringify(customConfig)
      );

      const service = ConfigService.getInstance();
      const config = service.load();

      expect(config.hooks.preCommit).toBe(false);
      expect(config.hooks.commitMsg).toBe(DEFAULT_CONFIG.hooks.commitMsg);
    });
  });

  describe('Caching', () => {
    it('should cache config after first load', () => {
      fs.writeFileSync(
        path.join(tempDir, 'introspect.config.json'),
        JSON.stringify({ srcDir: 'cached' })
      );

      const service = ConfigService.getInstance();
      const config1 = service.load();
      
      // Modify the file
      fs.writeFileSync(
        path.join(tempDir, 'introspect.config.json'),
        JSON.stringify({ srcDir: 'modified' })
      );
      
      // Should return cached value
      const config2 = service.load();
      
      expect(config1).toBe(config2);
      expect(config2.srcDir).toBe('cached');
    });

    it('should reload config when forceReload is true', () => {
      fs.writeFileSync(
        path.join(tempDir, 'introspect.config.json'),
        JSON.stringify({ srcDir: 'initial' })
      );

      const service = ConfigService.getInstance();
      service.load();
      
      // Modify the file
      fs.writeFileSync(
        path.join(tempDir, 'introspect.config.json'),
        JSON.stringify({ srcDir: 'modified' })
      );
      
      // Force reload
      const config = service.load(undefined, { forceReload: true });
      
      expect(config.srcDir).toBe('modified');
    });

    it('should invalidate cache with invalidateCache()', () => {
      fs.writeFileSync(
        path.join(tempDir, 'introspect.config.json'),
        JSON.stringify({ srcDir: 'initial' })
      );

      const service = ConfigService.getInstance();
      service.load();
      
      // Modify the file
      fs.writeFileSync(
        path.join(tempDir, 'introspect.config.json'),
        JSON.stringify({ srcDir: 'modified' })
      );
      
      service.invalidateCache();
      const config = service.load();
      
      expect(config.srcDir).toBe('modified');
    });
  });

  describe('getConfig()', () => {
    it('should return cached config if available', () => {
      fs.writeFileSync(
        path.join(tempDir, 'introspect.config.json'),
        JSON.stringify({ srcDir: 'test' })
      );

      const service = ConfigService.getInstance();
      service.load();
      
      const config = service.getConfig();
      
      expect(config.srcDir).toBe('test');
    });

    it('should auto-load if no cached config', () => {
      fs.writeFileSync(
        path.join(tempDir, 'introspect.config.json'),
        JSON.stringify({ srcDir: 'auto-loaded' })
      );

      const service = ConfigService.getInstance();
      // Don't call load() first
      const config = service.getConfig();
      
      expect(config.srcDir).toBe('auto-loaded');
    });
  });

  describe('getSrcDir()', () => {
    it('should return resolved absolute srcDir path', () => {
      fs.writeFileSync(
        path.join(tempDir, 'introspect.config.json'),
        JSON.stringify({ srcDir: 'my-src' })
      );

      const service = ConfigService.getInstance();
      const srcDir = service.getSrcDir();
      
      expect(srcDir).toBe(path.resolve(tempDir, 'my-src'));
      expect(path.isAbsolute(srcDir)).toBe(true);
    });

    it('should use default srcDir when not configured', () => {
      const service = ConfigService.getInstance();
      const srcDir = service.getSrcDir();
      
      expect(srcDir).toBe(path.resolve(tempDir, DEFAULT_CONFIG.srcDir));
    });
  });

  describe('isLoaded()', () => {
    it('should return false before load', () => {
      const service = ConfigService.getInstance();
      expect(service.isLoaded()).toBe(false);
    });

    it('should return true after load', () => {
      const service = ConfigService.getInstance();
      service.load();
      expect(service.isLoaded()).toBe(true);
    });

    it('should return false after invalidateCache', () => {
      const service = ConfigService.getInstance();
      service.load();
      service.invalidateCache();
      expect(service.isLoaded()).toBe(false);
    });
  });
});


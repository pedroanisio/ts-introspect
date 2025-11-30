/**
 * ConfigService
 * 
 * Centralized configuration loading with caching.
 * Eliminates duplicated config loading logic across commands.
 * 
 * Follows Singleton pattern with reset capability for testing.
 */

import fs from 'fs';
import path from 'path';
import { DEFAULT_CONFIG, type IntrospectConfig } from '../types/config.js';

/**
 * Options for config loading
 */
export interface LoadOptions {
  /** Force reload config even if cached */
  forceReload?: boolean;
}

/**
 * Default config file names to search for (in priority order)
 */
const CONFIG_FILE_NAMES = [
  'introspect.config.json',
  'ts-introspect.config.json',
  '.introspectrc.json',
  '.introspectrc'
];

/**
 * ConfigService provides centralized configuration management.
 * 
 * Features:
 * - Singleton pattern with reset for testing
 * - Automatic config file discovery
 * - Deep merging of user config with defaults
 * - Caching with invalidation support
 * - Explicit path loading
 * 
 * @example
 * ```typescript
 * const config = ConfigService.getInstance();
 * const cfg = config.load();
 * const srcDir = config.getSrcDir();
 * ```
 */
export class ConfigService {
  private static instance: ConfigService | null = null;
  private cachedConfig: IntrospectConfig | null = null;
  private loaded = false;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ConfigService {
    this.instance ??= new ConfigService();
    return this.instance;
  }

  /**
   * Reset singleton (for testing)
   */
  static reset(): void {
    this.instance = null;
  }

  /**
   * Load configuration from file or return defaults.
   * 
   * Search order for auto-discovery:
   * 1. introspect.config.json
   * 2. ts-introspect.config.json
   * 3. .introspectrc.json
   * 4. .introspectrc
   * 
   * @param configPath - Explicit path to config file (optional)
   * @param options - Load options
   * @returns Merged configuration
   * @throws Error if explicit path doesn't exist or JSON is invalid
   */
  load(configPath?: string, options: LoadOptions = {}): IntrospectConfig {
    // Return cached if available and not forcing reload
    if (this.cachedConfig && !options.forceReload) {
      return this.cachedConfig;
    }

    let config: IntrospectConfig;

    if (configPath) {
      // Explicit path - must exist
      config = this.loadFromExplicitPath(configPath);
    } else {
      // Auto-discover config file
      config = this.discoverAndLoad();
    }

    // Cache the result
    this.cachedConfig = config;
    this.loaded = true;

    return config;
  }

  /**
   * Get config, auto-loading if not already loaded
   */
  getConfig(): IntrospectConfig {
    if (!this.cachedConfig) {
      return this.load();
    }
    return this.cachedConfig;
  }

  /**
   * Get resolved absolute source directory path
   */
  getSrcDir(): string {
    const config = this.getConfig();
    return path.resolve(process.cwd(), config.srcDir);
  }

  /**
   * Check if config has been loaded
   */
  isLoaded(): boolean {
    return this.loaded;
  }

  /**
   * Invalidate cached config
   */
  invalidateCache(): void {
    this.cachedConfig = null;
    this.loaded = false;
  }

  /**
   * Load config from an explicit path
   */
  private loadFromExplicitPath(configPath: string): IntrospectConfig {
    const resolvedPath = path.resolve(process.cwd(), configPath);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Config file not found: ${resolvedPath}`);
    }

    return this.parseAndMerge(resolvedPath);
  }

  /**
   * Auto-discover and load config file
   */
  private discoverAndLoad(): IntrospectConfig {
    const cwd = process.cwd();

    for (const filename of CONFIG_FILE_NAMES) {
      const configPath = path.join(cwd, filename);
      if (fs.existsSync(configPath)) {
        return this.parseAndMerge(configPath);
      }
    }

    // No config file found - return defaults
    return { ...DEFAULT_CONFIG };
  }

  /**
   * Parse config file and merge with defaults
   */
  private parseAndMerge(configPath: string): IntrospectConfig {
    let content: string;
    try {
      content = fs.readFileSync(configPath, 'utf-8');
    } catch {
      throw new Error(`Failed to read config file: ${configPath}`);
    }

    let userConfig: Partial<IntrospectConfig>;
    try {
      userConfig = JSON.parse(content) as Partial<IntrospectConfig>;
    } catch {
      throw new Error(`Failed to parse config file (invalid JSON): ${configPath}`);
    }

    // Deep merge with defaults
    return {
      ...DEFAULT_CONFIG,
      ...userConfig,
      rules: {
        ...DEFAULT_CONFIG.rules,
        ...userConfig.rules
      },
      hooks: {
        ...DEFAULT_CONFIG.hooks,
        ...userConfig.hooks
      }
    };
  }
}

/**
 * Convenience function to get config instance
 */
export function getConfigService(): ConfigService {
  return ConfigService.getInstance();
}


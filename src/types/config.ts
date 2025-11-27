/**
 * ts-introspect Configuration Types
 */

// ============================================
// Rule Severity
// ============================================

export type RuleSeverity = 'error' | 'warn' | 'off';

// ============================================
// Validation Rules
// ============================================

export interface ValidationRules {
  'metadata/required': RuleSeverity;
  'metadata/stale-hash': RuleSeverity;
  'metadata/required-fields': RuleSeverity;
  'metadata/deps-mismatch': RuleSeverity;
  'metadata/untracked-todos': RuleSeverity;
  'metadata/stale-update': RuleSeverity;
  'metadata/empty-changelog': RuleSeverity;
}

// ============================================
// Hooks Configuration
// ============================================

export interface HooksConfig {
  preCommit: boolean;
  commitMsg: boolean;
}

// ============================================
// Main Configuration
// ============================================

export interface IntrospectConfig {
  // Source settings
  srcDir: string;
  include: string[];
  exclude: string[];

  // Validation rules
  rules: ValidationRules;

  // Behavior
  staleDays: number;
  requiredFields: string[];
  strictMode: boolean;

  // Output
  outputFormat: 'pretty' | 'json' | 'compact';

  // Git hooks
  hooks: HooksConfig;
}

// ============================================
// Default Exclude Patterns
// ============================================

export const DEFAULT_EXCLUDE_PATTERNS = [
  // Type declarations
  '**/*.d.ts',

  // Index/barrel files (simple re-exports)
  '**/index.ts',

  // Test files
  '**/*.test.ts',
  '**/*.spec.ts',
  '**/*.test.tsx',
  '**/*.spec.tsx',

  // Test directories
  '**/__tests__/**',
  '**/__mocks__/**',
  '**/test/**',
  '**/tests/**',
  '**/testing/**',

  // Test utilities
  '**/*.fixture.ts',
  '**/*.mock.ts',
  '**/testUtils.ts',
  '**/test-utils.ts',

  // Test setup
  '**/setup.ts',
  '**/setupTests.ts',
  '**/jest.setup.ts',
  '**/vitest.setup.ts',
  '**/jest.config.ts',
  '**/vitest.config.ts',

  // Build/config files
  '**/webpack.config.ts',
  '**/rollup.config.ts',
  '**/vite.config.ts',

  // Generated files
  '**/*.generated.ts',
  '**/generated/**'
];

// ============================================
// Default Configuration
// ============================================

export const DEFAULT_CONFIG: IntrospectConfig = {
  srcDir: 'src',
  include: ['**/*.ts'],
  exclude: DEFAULT_EXCLUDE_PATTERNS,

  rules: {
    'metadata/required': 'error',
    'metadata/stale-hash': 'error',
    'metadata/required-fields': 'error',
    'metadata/deps-mismatch': 'warn',
    'metadata/untracked-todos': 'warn',
    'metadata/stale-update': 'warn',
    'metadata/empty-changelog': 'off'
  },

  staleDays: 30,
  requiredFields: ['module', 'filename', 'description', 'updatedAt', 'status'],
  strictMode: false,

  outputFormat: 'pretty',

  hooks: {
    preCommit: true,
    commitMsg: false
  }
};

// ============================================
// Config Helper
// ============================================

export function defineConfig(config: Partial<IntrospectConfig>): IntrospectConfig {
  return {
    ...DEFAULT_CONFIG,
    ...config,
    rules: {
      ...DEFAULT_CONFIG.rules,
      ...config.rules
    },
    hooks: {
      ...DEFAULT_CONFIG.hooks,
      ...config.hooks
    }
  };
}


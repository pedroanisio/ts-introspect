# ts-introspect

Self-documenting TypeScript modules with enforced metadata, dependency tracking, and validation.

## Features

- 📝 **Self-documenting files** - Each file describes what it does, its dependencies, and status
- 🔍 **Dependency tracking** - Automatic analysis of imports and usage
- ✅ **Validation** - Lint-like checks for metadata completeness and freshness
- 🪝 **Git hooks** - Enforce metadata updates on commit
- 📊 **Reports** - Generate project-wide TODO lists, dependency graphs, and summaries
- 🔌 **ESLint plugin** - Integrate with your existing linting workflow

## Installation

```bash
# Global installation
npm install -g ts-introspect

# Or as a dev dependency
npm install -D ts-introspect
```

## Quick Start

### 1. Initialize in your project

```bash
tsi init
```

This creates `introspect.config.json` and installs git hooks.

### 2. Generate metadata for existing files

```bash
tsi generate
```

### 3. Validate your project

```bash
tsi lint
```

## Usage

### Adding Metadata to Files

```typescript
import type { FileMetadata } from 'ts-introspect/types';

// ============================================
// FILE INTROSPECTION
// ============================================
export const __metadata: FileMetadata = {
  module: 'services/user-service',
  filename: 'user-service.ts',

  description: 'User management service handling CRUD operations',
  responsibilities: [
    'User creation and validation',
    'Password hashing',
    'Profile updates'
  ],
  exports: ['UserService', 'createUser'],

  dependencies: {
    internal: ['utils/crypto', 'db/client'],
    external: ['bcrypt', 'zod']
  },

  status: 'stable',

  createdAt: '2025-10-01',
  updatedAt: '2025-11-26',

  changelog: [
    {
      version: '1.1.0',
      date: '2025-11-26',
      author: 'developer',
      changes: ['Added email verification']
    }
  ],

  todos: [
    {
      id: 'TODO-001',
      description: 'Add rate limiting',
      priority: 'medium',
      status: 'pending',
      createdAt: '2025-11-20'
    }
  ],

  fixes: [],

  _meta: {
    contentHash: 'a1b2c3d4e5f6',
    lastValidated: '2025-11-26',
    generatedDeps: ['utils/crypto', 'db/client']
  }
};

// Your actual code below...
export class UserService {
  // ...
}
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `tsi init` | Initialize ts-introspect in your project |
| `tsi lint [files...]` | Validate metadata in files |
| `tsi lint --strict` | Treat warnings as errors |
| `tsi generate [files...]` | Generate metadata stubs |
| `tsi report` | Show project summary |
| `tsi report --type todos` | List all TODOs |
| `tsi report --type fixes` | List open fixes |
| `tsi deps [file]` | Analyze dependencies |
| `tsi deps --who-uses <module>` | Find module usages |
| `tsi deps --unused` | Find unused modules |
| `tsi hooks --install` | Install git hooks |
| `tsi hooks --uninstall` | Remove git hooks |

## Configuration

Create `introspect.config.json` in your project root:

```json
{
  "srcDir": "src",
  "include": ["**/*.ts"],
  "exclude": [
    "**/*.d.ts",
    "**/index.ts",
    "**/*.test.ts",
    "**/*.spec.ts",
    "**/__tests__/**"
  ],
  "rules": {
    "metadata/required": "error",
    "metadata/stale-hash": "error",
    "metadata/required-fields": "error",
    "metadata/deps-mismatch": "warn",
    "metadata/untracked-todos": "warn",
    "metadata/stale-update": "warn",
    "metadata/empty-changelog": "off"
  },
  "staleDays": 30,
  "requiredFields": ["module", "filename", "description", "updatedAt", "status"],
  "strictMode": false,
  "outputFormat": "pretty",
  "hooks": {
    "preCommit": true
  }
}
```

## ESLint Integration

### ESLint Flat Config (eslint.config.js)

```javascript
import introspectPlugin from 'ts-introspect/eslint';

export default [
  {
    plugins: {
      introspect: introspectPlugin
    },
    rules: {
      'introspect/require-metadata': 'error',
      'introspect/valid-metadata': 'warn'
    }
  }
];
```

## Programmatic API

```typescript
import {
  validate,
  IntrospectionRegistry,
  analyzeDependencies,
  buildDependencyGraph
} from 'ts-introspect';

// Validate project
const results = await validate({ srcDir: 'src', strictMode: true });
console.log(`Errors: ${results.totalErrors}, Warnings: ${results.totalWarnings}`);

// Query metadata at runtime
const registry = new IntrospectionRegistry();
await registry.loadAll('src');

const todos = registry.getAllTodos();
const summary = registry.getSummary();

// Analyze dependencies
const deps = analyzeDependencies('src/services/user-service.ts');
console.log('Internal deps:', deps.internal);
console.log('External deps:', deps.external);

// Build dependency graph
const graph = await buildDependencyGraph('src');
```

## Validation Rules

| Rule | Type | Description |
|------|------|-------------|
| `metadata/required` | Error | File must export `__metadata` |
| `metadata/stale-hash` | Error | Content hash must match stored hash |
| `metadata/required-fields` | Error | Required fields must be present |
| `metadata/deps-mismatch` | Warning | Dependencies must match imports |
| `metadata/untracked-todos` | Warning | Inline TODOs should be in metadata |
| `metadata/stale-update` | Warning | `updatedAt` shouldn't be too old |
| `metadata/empty-changelog` | Off | Changelog shouldn't be empty |

## File Exclusions

By default, these files are excluded from validation:

- `*.d.ts` - Type declaration files
- `index.ts` - Barrel/re-export files
- `*.test.ts`, `*.spec.ts` - Test files
- `__tests__/**`, `__mocks__/**` - Test directories
- `*.fixture.ts`, `*.mock.ts` - Test utilities

## License

MIT


# ts-introspect

Self-documenting TypeScript modules with enforced metadata, dependency tracking, and validation.

**Works with TypeScript and React (TSX) projects.**

## Features

- 📝 **Self-documenting files** - Each file describes what it does, its dependencies, and status
- 🔍 **Dependency tracking** - Automatic analysis of imports and usage
- ✅ **Validation** - Lint-like checks for metadata completeness and freshness
- 🪝 **Git hooks** - Enforce metadata updates on commit
- 📊 **Reports** - Generate project-wide TODO lists, dependency graphs, and summaries
- 🔌 **ESLint plugin** - Integrate with your existing linting workflow
- ⚛️ **React support** - Auto-detect components, hooks, props, and context usage

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

### Adding Metadata to TypeScript Files

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

### Adding Metadata to React Components

For `.tsx` files, ts-introspect automatically detects React-specific patterns:

```tsx
import type { FileMetadata } from 'ts-introspect/types';

// ============================================
// FILE INTROSPECTION
// ============================================
export const __metadata: FileMetadata = {
  module: 'components/UserCard',
  filename: 'UserCard.tsx',

  description: 'Displays user profile information in a card layout',
  responsibilities: [
    'Render user avatar and name',
    'Handle loading and error states',
    'Emit click events for profile navigation'
  ],
  exports: ['UserCard', 'UserCardProps'],

  dependencies: {
    internal: ['hooks/useUser', 'components/Avatar', 'utils/formatDate'],
    external: ['react', '@tanstack/react-query']
  },

  status: 'stable',

  createdAt: '2025-01-15',
  updatedAt: '2025-11-28',

  // React-specific metadata (auto-generated)
  react: {
    componentType: 'ui',
    props: {
      interfaceName: 'UserCardProps',
      properties: [
        { name: 'userId', type: 'string', required: true },
        { name: 'onClick', type: '() => void', required: false },
        { name: 'variant', type: "'default' | 'compact'", required: false }
      ]
    },
    hooks: [
      { name: 'useState', isCustom: false },
      { name: 'useUser', isCustom: true }
    ],
    contexts: ['ThemeContext'],
    stateManagement: ['react-query'],
    renders: ['Avatar', 'Badge', 'Button'],
    memoized: true
  },

  changelog: [],
  todos: [],
  fixes: [],

  _meta: {
    contentHash: 'abc123def456',
    lastValidated: '2025-11-28',
    generatedDeps: ['hooks/useUser', 'components/Avatar']
  }
};

// Component code below...
export interface UserCardProps {
  userId: string;
  onClick?: () => void;
  variant?: 'default' | 'compact';
}

export const UserCard = memo(function UserCard({ userId, onClick, variant = 'default' }: UserCardProps) {
  const { data: user, isLoading } = useUser(userId);
  const theme = useContext(ThemeContext);

  if (isLoading) return <Skeleton />;

  return (
    <div className={styles[variant]} onClick={onClick}>
      <Avatar src={user.avatar} />
      <span>{user.name}</span>
      <Badge status={user.status} />
    </div>
  );
});
```

### React Metadata Fields

The `react` field is automatically populated when you run `tsi generate` on `.tsx` files:

| Field | Description |
|-------|-------------|
| `componentType` | Classification: `page`, `layout`, `feature`, `ui`, `provider`, `hoc`, `hook` |
| `props` | Interface name and property definitions |
| `hooks` | List of hooks used (built-in and custom) |
| `contexts` | React contexts consumed via `useContext` |
| `stateManagement` | Detected libraries: `redux`, `zustand`, `jotai`, `react-query` |
| `renders` | Child components rendered in JSX |
| `forwardRef` | Whether component uses `React.forwardRef` |
| `memoized` | Whether component uses `React.memo` |

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
| `tsi report --html` | Generate HTML report |
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
  "include": ["**/*.ts", "**/*.tsx"],
  "exclude": [
    "**/*.d.ts",
    "**/index.ts",
    "**/index.tsx",
    "**/*.test.ts",
    "**/*.test.tsx",
    "**/*.spec.ts",
    "**/*.spec.tsx",
    "**/__tests__/**",
    "**/*.stories.tsx"
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
  analyzeReactComponent,
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

// Analyze React component
const reactInfo = analyzeReactComponent('src/components/UserCard.tsx');
if (reactInfo) {
  console.log('Component type:', reactInfo.componentType);
  console.log('Hooks used:', reactInfo.hooks);
  console.log('Props:', reactInfo.props);
}

// Build dependency graph
const graph = await buildDependencyGraph('src');
```

## React Project Best Practices

### What to Document

| Component Type | Recommended |
|----------------|-------------|
| **Pages/Routes** | ✅ Yes - Track data requirements, layouts used |
| **Feature components** | ✅ Yes - Document business logic, state |
| **Shared UI components** | ✅ Yes - Document props, variants, accessibility |
| **Custom hooks** | ✅ Yes - Document parameters, return values, side effects |
| **Context providers** | ✅ Yes - Document state shape, consumers |
| **Higher-order components** | ✅ Yes - Document wrapped component contract |
| **Simple wrappers** | ⚠️ Optional - May be unnecessary overhead |
| **Generated code** | ❌ No - Exclude from config |

### What to Exclude

Add these to your config's `exclude` array:

```json
{
  "exclude": [
    "**/*.d.ts",
    "**/index.ts",
    "**/index.tsx",
    "**/*.test.ts",
    "**/*.test.tsx",
    "**/*.spec.ts",
    "**/*.spec.tsx",
    "**/__tests__/**",
    "**/__mocks__/**",
    "**/*.stories.tsx",
    "**/*.stories.ts",
    "**/stories/**",
    "**/.storybook/**",
    "**/generated/**",
    "**/*.generated.ts"
  ]
}
```

### Example Project Structure

```
src/
├── components/
│   ├── ui/           # UI primitives (Button, Input, etc.)
│   │   ├── Button.tsx          # ✅ Document props, variants
│   │   └── index.ts            # ❌ Excluded (barrel)
│   └── features/     # Feature components
│       └── UserProfile.tsx     # ✅ Document with react metadata
├── hooks/
│   ├── useAuth.ts              # ✅ Document with hook type
│   └── useLocalStorage.ts      # ✅ Document generic hook
├── pages/
│   ├── HomePage.tsx            # ✅ Document as page component
│   └── UserPage.tsx            # ✅ Document data requirements
├── contexts/
│   └── ThemeProvider.tsx       # ✅ Document context shape
├── services/
│   └── api.ts                  # ✅ Standard TS metadata
└── utils/
    └── formatters.ts           # ✅ Standard TS metadata
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
- `index.ts`, `index.tsx` - Barrel/re-export files
- `*.test.ts`, `*.spec.ts`, `*.test.tsx`, `*.spec.tsx` - Test files
- `__tests__/**`, `__mocks__/**` - Test directories
- `*.fixture.ts`, `*.mock.ts` - Test utilities
- `*.stories.ts`, `*.stories.tsx` - Storybook files

## HTML Reports

Generate beautiful HTML reports with dependency graphs and analytics:

```bash
tsi report --html -o report.html
```

Reports include:
- Project summary with coverage metrics
- Status distribution charts
- TODO priority breakdown
- Interactive dependency graph
- Module listing with metadata
- Recently updated files

Available themes: `classic`, `dark`, `light`, `dracula`, `nord`

```bash
tsi report --html --theme dark -o report.html
```

## License

MIT

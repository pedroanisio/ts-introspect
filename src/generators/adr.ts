/**
 * ADR Generator
 *
 * Generates Architecture Decision Records for the introspection system
 */

import fs from 'fs';
import path from 'path';

// ============================================
// Types
// ============================================

export type AdrTemplate = 'introspection' | 'code-markers';

export interface AdrOptions {
  projectName?: string;
  outputDir?: string;
  adrNumber?: number;
  template?: AdrTemplate;
}

const DEFAULT_ADR_NUMBER = 1;

// ADR template metadata for filenames and titles
const ADR_TEMPLATES: Record<AdrTemplate, { filename: string; title: string }> = {
  'introspection': {
    filename: 'typescript-introspection',
    title: 'TypeScript File Introspection System'
  },
  'code-markers': {
    filename: 'code-markers-convention',
    title: 'Code Markers Convention (TODO, FIX, HACK, etc.)'
  }
};

// ============================================
// Main Generator (Dispatcher)
// ============================================

export function generateAdr(options: AdrOptions = {}): string {
  const template = options.template ?? 'introspection';
  
  switch (template) {
    case 'code-markers':
      return generateCodeMarkersAdr(options);
    case 'introspection':
    default:
      return generateIntrospectionAdr(options);
  }
}

// ============================================
// Introspection ADR Template
// ============================================

function generateIntrospectionAdr(options: AdrOptions = {}): string {
  const projectName = options.projectName ?? 'Project';
  const date = new Date().toISOString().split('T')[0];

  return `# ADR-${String(options.adrNumber ?? DEFAULT_ADR_NUMBER).padStart(4, '0')}: TypeScript File Introspection System

## Status

**Accepted** — ${date}

## Context

As ${projectName} grows, we need a systematic way to:
- Document what each module does and why it exists
- Track dependencies between modules
- Manage TODOs and fixes across the codebase
- Detect when code changes but documentation becomes stale
- Enable automated analysis of the codebase structure

Traditional comments and external documentation often become outdated. We need documentation that lives with the code and can be validated programmatically.

## Decision

We adopt **ts-introspect**, a self-documenting TypeScript system where every source file exports a \`__metadata\` object containing structured information about the module.

### The Metadata Structure

Every TypeScript file in \`src/\` must export a \`__metadata\` constant:

\`\`\`typescript
import type { FileMetadata } from 'ts-introspect/types';

export const __metadata: FileMetadata = {
  // Required: Module identification
  module: 'core/my-module',           // Path from src/ without extension
  filename: 'my-module.ts',           // Just the filename
  
  // Required: What this module does
  description: 'Handles user authentication and session management',
  responsibilities: [
    'Validate user credentials',
    'Manage session tokens',
    'Handle logout flows'
  ],
  
  // Required: What this module exports
  exports: ['AuthService', 'validateToken', 'SESSION_TIMEOUT'],
  
  // Required: Dependencies
  dependencies: {
    internal: ['core/user-service', 'utils/crypto'],  // Other project modules
    external: ['jsonwebtoken', 'bcrypt'],             // npm packages
    types: ['types/auth.types']                       // Type-only imports
  },
  
  // Required: Lifecycle
  status: 'stable',  // 'stable' | 'beta' | 'experimental' | 'deprecated'
  createdAt: '2025-01-15',
  updatedAt: '2025-03-20',
  
  // Required: Version history
  changelog: [
    {
      version: '2.0.0',
      date: '2025-03-20',
      author: 'jane.doe',
      changes: ['Migrated to JWT from session cookies', 'Added refresh token support']
    },
    {
      version: '1.0.0',
      date: '2025-01-15',
      author: 'john.smith',
      changes: ['Initial implementation']
    }
  ],
  
  // Optional: Planned work
  todos: [
    {
      id: 'TODO-001',
      description: 'Add OAuth2 provider support',
      priority: 'high',      // 'critical' | 'high' | 'medium' | 'low'
      status: 'pending',     // 'pending' | 'in_progress' | 'completed'
      createdAt: '2025-03-15',
      assignee: 'dev-team'
    }
  ],
  
  // Optional: Known issues
  fixes: [
    {
      id: 'FIX-001',
      description: 'Token refresh race condition under high load',
      severity: 'minor',     // 'critical' | 'major' | 'minor' | 'trivial'
      status: 'open',        // 'open' | 'investigating' | 'fixed'
      createdAt: '2025-03-18',
      relatedIssue: 'JIRA-1234'
    }
  ],
  
  // Optional: Categorization
  tags: ['auth', 'security', 'core'],
  
  // Internal: Managed by tooling
  _meta: {
    contentHash: 'sha256:abc123...',  // Auto-generated hash of file content
    lastValidated: '2025-03-20',
    generatedDeps: ['core/user-service', 'utils/crypto']
  }
};
\`\`\`

### Enforcement Rules

The following rules are enforced via \`tsi lint\`:

| Rule | Severity | Description |
|------|----------|-------------|
| \`metadata/required\` | Error | Every .ts file must export \`__metadata\` |
| \`metadata/valid-module\` | Error | Module path must match file location |
| \`metadata/stale-hash\` | Error | Content hash must match current file |
| \`metadata/deps-mismatch\` | Warning | Declared deps should match actual imports |
| \`metadata/untracked-todos\` | Warning | Inline TODO comments should be in metadata |
| \`metadata/stale-update\` | Warning | Files not updated in 90+ days flagged |
| \`metadata/empty-changelog\` | Warning | Changelog should have entries |

### Workflow Integration

#### Pre-commit Hook
\`\`\`bash
# Install git hooks
tsi hooks --install
\`\`\`

This validates all staged .ts files before commit.

#### CI/CD Pipeline
\`\`\`yaml
# In your CI config
- name: Validate Introspection
  run: npx tsi lint src/ --strict
\`\`\`

#### ESLint Integration
\`\`\`javascript
// .eslintrc.js
module.exports = {
  plugins: ['ts-introspect'],
  rules: {
    'ts-introspect/require-metadata': 'error',
    'ts-introspect/valid-metadata': 'warn'
  }
};
\`\`\`

### CLI Commands

| Command | Description |
|---------|-------------|
| \`tsi init\` | Initialize ts-introspect in project |
| \`tsi lint [files...]\` | Validate metadata |
| \`tsi generate [files...]\` | Generate metadata stubs |
| \`tsi report --html\` | Generate HTML report |
| \`tsi deps [file]\` | Analyze dependencies |
| \`tsi hooks --install\` | Install git hooks |

### Generating Metadata for Existing Files

\`\`\`bash
# Generate for a single file
tsi generate src/core/my-module.ts

# Generate for a directory
tsi generate src/

# Overwrite existing metadata
tsi generate src/ --overwrite
\`\`\`

The generator auto-detects:
- Exports (functions, classes, constants)
- Dependencies (imports)
- Content hash

You need to fill in:
- Description and responsibilities
- Changelog entries
- TODOs and fixes (as needed)

### Updating Metadata When Code Changes

When you modify a file:

1. **Update the \`updatedAt\` date**
2. **Add a changelog entry**
3. **Run \`tsi lint\`** to verify (or let pre-commit do it)

The content hash ensures you can't forget — if code changes but metadata doesn't, the lint fails.

### What Files Are Excluded

By default, these are excluded:
- \`*.test.ts\`, \`*.spec.ts\` — Test files
- \`*.d.ts\` — Declaration files
- \`index.ts\` files (can use \`IndexMetadata\` if needed)

Configure exclusions in \`introspect.config.json\`:
\`\`\`json
{
  "exclude": [
    "**/*.test.ts",
    "**/*.spec.ts",
    "**/fixtures/**"
  ]
}
\`\`\`

## Consequences

### Positive
- Every file is self-documenting with enforced structure
- Dependencies are explicitly declared and validated
- TODOs/fixes are tracked in a queryable format
- Stale documentation is automatically detected
- HTML reports provide project-wide visibility
- Onboarding developers can understand any file quickly

### Negative
- Initial overhead to add metadata to existing files
- Developers must maintain metadata with code changes
- Small increase in file size

### Mitigations
- \`tsi generate\` automates initial metadata creation
- Pre-commit hooks catch forgotten updates
- Metadata updates become habit with enforcement

## References

- [ts-introspect Documentation](https://github.com/your-org/ts-introspect)
- [ADR: Architecture Decision Records](https://adr.github.io/)
`;
}

// ============================================
// Code Markers ADR Template
// ============================================

function generateCodeMarkersAdr(options: AdrOptions = {}): string {
  const date = new Date().toISOString().split('T')[0];
  const adrNum = String(options.adrNumber ?? 7).padStart(4, '0');

  return `# ADR-${adrNum}: Code Markers Convention (TODO, FIX, HACK, etc.)

## Status

**Accepted** — ${date}

## Context

Code markers like \`TODO\`, \`FIXME\`, \`HACK\`, and \`XXX\` are ubiquitous in software development. However, without standardization they create problems:

- **Lost context**: Markers accumulate without owners, priorities, or deadlines
- **Invisible debt**: No aggregate view of outstanding work
- **Stale markers**: Comments from years ago linger in the codebase
- **No accountability**: No way to assign or track progress
- **Noise**: Different styles make searching inconsistent

Our \`ts-introspect\` system provides structured tracking for \`todos\` and \`fixes\` in the \`__metadata\` export. This ADR establishes conventions for when and how to use code markers.

## Decision

We adopt a **two-tier marker system**: lightweight inline markers for immediate context, with **mandatory tracking** in \`__metadata\` for anything that persists beyond the current work session.

---

### Tier 1: Inline Markers (Short-Lived)

Use these **only** during active development. Must be resolved or promoted to \`__metadata\` before merging.

| Marker | Purpose | Example |
|--------|---------|---------|
| \`// TODO:\` | Incomplete implementation in current PR | \`// TODO: handle edge case for empty arrays\` |
| \`// FIXME:\` | Known bug to fix before merge | \`// FIXME: off-by-one error in loop\` |
| \`// HACK:\` | Temporary workaround that needs cleanup | \`// HACK: using any to bypass broken types\` |
| \`// XXX:\` | Dangerous/fragile code needing attention | \`// XXX: race condition if called concurrently\` |

**Rules for inline markers:**
- ✅ Must be resolved before PR merge, OR
- ✅ Must be promoted to \`__metadata.todos\` or \`__metadata.fixes\`
- ❌ Never commit long-lived inline markers
- ❌ Never use for "someday" tasks

The \`metadata/untracked-todos\` validation rule (enabled by default) will **warn** if inline markers exist without corresponding metadata entries.

---

### Tier 2: Structured Metadata (Persistent)

For planned work and known issues that should outlive the current PR, use \`__metadata.todos\` and \`__metadata.fixes\`.

#### TODOs: Planned Enhancements

\`\`\`typescript
todos: [
  {
    id: 'TODO-001',                    // REQUIRED: Unique ID (format: TODO-NNN)
    description: 'Add OAuth2 support', // REQUIRED: What needs to be done
    priority: 'high',                  // REQUIRED: critical | high | medium | low
    status: 'pending',                 // REQUIRED: pending | in-progress | blocked | done
    createdAt: '${date}',              // REQUIRED: When identified
    assignee: 'auth-team',             // OPTIONAL: Owner/team
    targetVersion: 'v2.0',             // OPTIONAL: Release target
    tags: ['auth', 'feature']          // OPTIONAL: Categorization
  }
]
\`\`\`

**When to use TODOs:**
- Feature enhancements
- Refactoring tasks
- Performance optimizations
- Documentation improvements
- Test coverage gaps

#### FIXes: Known Defects

\`\`\`typescript
fixes: [
  {
    id: 'FIX-001',                             // REQUIRED: Unique ID (format: FIX-NNN)
    description: 'Memory leak in event listener', // REQUIRED: What's broken
    severity: 'major',                         // REQUIRED: critical | major | minor | trivial
    status: 'investigating',                   // REQUIRED: open | investigating | fixed
    createdAt: '${date}',                      // REQUIRED: When discovered
    resolvedAt: '${date}',                     // SET when status='fixed'
    relatedTodos: ['TODO-003']                 // OPTIONAL: Related work items
  }
]
\`\`\`

**When to use FIXes:**
- Bugs (confirmed defects)
- Security vulnerabilities
- Data corruption risks
- Breaking edge cases

---

### Priority and Severity Guidelines

#### TODO Priority

| Level | Definition | SLA |
|-------|------------|-----|
| \`critical\` | Blocks release or other work | Must fix this sprint |
| \`high\` | Significant impact on functionality | Plan for next sprint |
| \`medium\` | Improvement with clear value | Backlog priority |
| \`low\` | Nice-to-have, no urgency | Backlog |

#### FIX Severity

| Level | Definition | Response |
|-------|------------|----------|
| \`critical\` | System down, data loss, security breach | Drop everything, fix now |
| \`major\` | Feature broken, workaround exists | Fix within 48h |
| \`minor\` | Edge case, cosmetic issue | Normal backlog |
| \`trivial\` | Typos, minor UI glitches | Fix when convenient |

---

### ID Generation

Use sequential IDs within each file:

\`\`\`typescript
// First TODO in this file
{ id: 'TODO-001', ... }

// Second TODO in this file  
{ id: 'TODO-002', ... }

// First FIX in this file
{ id: 'FIX-001', ... }
\`\`\`

For project-wide uniqueness, prepend module path in reports:
- \`core/middleware:TODO-001\`
- \`utils/helpers:FIX-002\`

---

### Lifecycle

\`\`\`
┌─────────────────────────────────────────────────────────────────┐
│  INLINE COMMENT (dev time only)                                 │
│  // TODO: implement validation                                  │
└─────────────────────┬───────────────────────────────────────────┘
                      │
          ┌───────────┴───────────┐
          │                       │
          ▼                       ▼
   ┌──────────────┐      ┌──────────────────────────────┐
   │ RESOLVED     │      │ PROMOTED to __metadata       │
   │ (code done)  │      │ status: 'pending'            │
   └──────────────┘      └──────────────┬───────────────┘
                                        │
                         ┌──────────────┼──────────────┐
                         │              │              │
                         ▼              ▼              ▼
                   ┌──────────┐  ┌────────────┐  ┌──────────┐
                   │ pending  │  │in-progress │  │ blocked  │
                   └────┬─────┘  └─────┬──────┘  └────┬─────┘
                        │              │              │
                        └──────────────┼──────────────┘
                                       │
                                       ▼
                               ┌──────────────┐
                               │    done      │
                               │ (keep 30d)   │
                               └──────────────┘
                                       │
                                       ▼
                               ┌──────────────┐
                               │   REMOVED    │
                               │ from metadata│
                               └──────────────┘
\`\`\`

**Retention policy:**
- \`done\` / \`fixed\` items: Keep for 30 days (for changelog/history)
- Then remove from \`__metadata\`
- History preserved in git + changelog entries

---

### Forbidden Markers

Do NOT use these — they have no semantic meaning in our system:

| ❌ Marker | Why | Use Instead |
|-----------|-----|-------------|
| \`// NOTE:\` | Not actionable | Regular comment or JSDoc |
| \`// WARNING:\` | Not actionable | JSDoc \`@deprecated\` or FIX |
| \`// BUG:\` | Ambiguous | \`// FIXME:\` → \`fixes[]\` |
| \`// OPTIMIZE:\` | Vague | \`todos[]\` with description |
| \`// REVIEW:\` | Process marker | PR comment |

---

### Querying Markers

Use \`ts-introspect\` CLI to aggregate across the project:

\`\`\`bash
# List all TODOs sorted by priority
tsi report --type todos

# List all open FIXes sorted by severity
tsi report --type fixes

# Generate HTML dashboard
tsi report --html -o reports/status.html
\`\`\`

---

### PR Checklist

Before merging any PR:

- [ ] No unresolved inline \`TODO:\`, \`FIXME:\`, \`HACK:\`, \`XXX:\`
- [ ] Any new long-term work added to \`__metadata.todos\`
- [ ] Any discovered bugs added to \`__metadata.fixes\`
- [ ] \`tsi lint\` passes without \`untracked-todos\` warnings
- [ ] \`updatedAt\` refreshed if metadata changed

---

### Example: Complete Module with Markers

\`\`\`typescript
import type { FileMetadata } from 'ts-introspect/types';

// ============================================
// FILE INTROSPECTION
// ============================================
export const __metadata: FileMetadata = {
  module: 'core/auth-service',
  filename: 'auth-service.ts',
  description: 'Handles user authentication and session management',
  responsibilities: ['Validate credentials', 'Manage sessions'],
  exports: ['AuthService', 'validateToken'],
  dependencies: {
    internal: ['utils/crypto'],
    external: ['jsonwebtoken']
  },
  status: 'stable',
  createdAt: '2025-01-15',
  updatedAt: '${date}',
  changelog: [
    { version: '1.1.0', date: '${date}', author: 'dev', changes: ['Added refresh tokens'] }
  ],
  
  todos: [
    {
      id: 'TODO-001',
      description: 'Add support for OAuth2 providers (Google, GitHub)',
      priority: 'high',
      status: 'pending',
      createdAt: '2025-11-20',
      targetVersion: 'v2.0'
    },
    {
      id: 'TODO-002',
      description: 'Implement rate limiting for login attempts',
      priority: 'medium',
      status: 'in-progress',
      createdAt: '2025-11-25',
      assignee: 'security-team'
    }
  ],
  
  fixes: [
    {
      id: 'FIX-001',
      description: 'Token refresh fails silently when clock skew > 30s',
      severity: 'minor',
      status: 'investigating',
      createdAt: '2025-11-24'
    }
  ],
  
  _meta: {
    contentHash: 'a1b2c3d4e5f6g7h8',
    lastValidated: '${date}',
    generatedDeps: ['utils/crypto']
  }
};

// ============================================
// IMPLEMENTATION
// ============================================

export class AuthService {
  // Implementation with NO inline markers
  // (all tracked in __metadata above)
}
\`\`\`

## Consequences

### Positive

- **Visibility**: All planned work and bugs queryable via CLI
- **Accountability**: Owners, priorities, and dates tracked
- **Clean code**: No stale inline comments cluttering files
- **Reports**: Generate HTML dashboards for planning
- **Enforcement**: Pre-commit hooks catch violations

### Negative

- **Overhead**: Must promote inline markers to metadata
- **Learning curve**: Team must learn the convention
- **Tooling dependency**: Requires ts-introspect integration

### Mitigations

- IDE snippets for quick metadata entry
- Pre-commit enforcement makes it habit
- \`tsi report\` provides clear visibility

## References

- [ADR-0001: TypeScript Introspection System](./ADR-0001-typescript-introspection.md)
- [ts-introspect Documentation](../packages/ts-introspect/README.md)
`;
}

// ============================================
// File Writer
// ============================================

export function writeAdr(options: AdrOptions = {}): string {
  const outputDir = options.outputDir ?? 'docs/adr';
  const adrNumber = options.adrNumber ?? DEFAULT_ADR_NUMBER;
  const template = options.template ?? 'introspection';
  const templateInfo = ADR_TEMPLATES[template];
  const filename = `ADR-${String(adrNumber).padStart(4, '0')}-${templateInfo.filename}.md`;
  
  const outputPath = path.resolve(process.cwd(), outputDir, filename);
  const dir = path.dirname(outputPath);
  
  // Ensure directory exists
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  const content = generateAdr(options);
  fs.writeFileSync(outputPath, content);
  
  return outputPath;
}

export function generateQuickStartGuide(): string {
  return `# ts-introspect Quick Start Guide

Self-documenting TypeScript modules with enforced metadata, dependency tracking, and validation.

**Works with TypeScript (.ts) and React (.tsx) projects.**

## Installation

\`\`\`bash
npm install ts-introspect --save-dev
\`\`\`

## Initialize

\`\`\`bash
npx tsi init
\`\`\`

## Add Metadata to Files

\`\`\`bash
# Auto-generate stub for a file
npx tsi generate src/my-file.ts

# Generate for entire directory
npx tsi generate src/

# Overwrite existing metadata
npx tsi generate src/ --overwrite
\`\`\`

## Validate

\`\`\`bash
# Check all files (JSON output by default)
npx tsi lint src/

# Human-readable output
npx tsi lint src/ --format=text

# Strict mode (warnings become errors)
npx tsi lint src/ --strict
\`\`\`

## Generate Reports

\`\`\`bash
# Summary report (JSON)
npx tsi report

# HTML visual report
npx tsi report --format=html

# List all TODOs
npx tsi report --type=todos

# List all fixes
npx tsi report --type=fixes
\`\`\`

## Analyze Dependencies

\`\`\`bash
# Show dependency summary
npx tsi deps

# Find circular dependencies
npx tsi deps --circular

# Find unused modules
npx tsi deps --unused

# Find who uses a module
npx tsi deps --who-uses core/utils
\`\`\`

## Manage Architecture Decision Records (ADRs)

\`\`\`bash
# List all ADRs
npx tsi adr --list

# Add a new ADR
npx tsi adr --add --title="Use TypeScript" --decision="TypeScript over JavaScript" --rationale="Type safety"

# Export ADRs to markdown
npx tsi adr --export-all

# Validate ADRs
npx tsi adr --validate
\`\`\`

## Generate Documentation Templates

\`\`\`bash
# Generate all documentation templates
npx tsi docs

# Generate specific template
npx tsi docs --template=introspection
npx tsi docs --template=code-markers
\`\`\`

## Install Git Hooks

\`\`\`bash
npx tsi hooks --install
\`\`\`

## AI-Focused CLI

The CLI outputs JSON by default for machine consumption (AI agents, CI/CD):

\`\`\`bash
# Get API version
npx tsi --api-version

# Get CLI schema (for AI agents)
npx tsi --schema=json
npx tsi --schema=openapi

# List all commands with parameters
npx tsi --list-commands

# Human-friendly output (opt-in)
npx tsi lint --format=text
npx tsi deps --format=table
\`\`\`

## Minimal Metadata Example

\`\`\`typescript
import type { FileMetadata } from 'ts-introspect/types';

export const __metadata: FileMetadata = {
  module: 'utils/helpers',
  filename: 'helpers.ts',
  description: 'Common utility functions',
  responsibilities: ['Provide reusable helper functions'],
  exports: ['formatDate', 'slugify', 'debounce'],
  dependencies: {
    internal: [],
    external: ['lodash']
  },
  status: 'stable',
  createdAt: '2025-01-01',
  updatedAt: '2025-01-01',
  changelog: [{ version: '1.0.0', date: '2025-01-01', changes: ['Initial'] }],
  todos: [],
  fixes: [],
  _meta: {
    contentHash: 'will-be-generated',
    lastValidated: '2025-01-01',
    generatedDeps: []
  }
};
\`\`\`

## React Component Metadata Example

For \`.tsx\` files, React-specific metadata is auto-detected:

\`\`\`tsx
import type { FileMetadata } from 'ts-introspect/types';

export const __metadata: FileMetadata = {
  module: 'components/Button',
  filename: 'Button.tsx',
  description: 'Reusable button component',
  responsibilities: ['Render button with variants', 'Handle click events'],
  exports: ['Button', 'ButtonProps'],
  dependencies: {
    internal: ['hooks/useTheme'],
    external: ['react']
  },
  status: 'stable',
  createdAt: '2025-01-01',
  updatedAt: '2025-01-01',
  
  // React-specific (auto-generated)
  react: {
    componentType: 'ui',
    props: {
      interfaceName: 'ButtonProps',
      properties: [
        { name: 'variant', type: "'primary' | 'secondary'", required: false },
        { name: 'onClick', type: '() => void', required: true }
      ]
    },
    hooks: [
      { name: 'useState', isCustom: false },
      { name: 'useTheme', isCustom: true }
    ],
    memoized: true
  },
  
  changelog: [],
  todos: [],
  fixes: [],
  _meta: {
    contentHash: 'will-be-generated',
    lastValidated: '2025-01-01',
    generatedDeps: []
  }
};
\`\`\`

## Need Help?

\`\`\`bash
npx tsi --help
npx tsi <command> --help
\`\`\`

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | User error (invalid input, validation failed) |
| 2 | System error (file access, etc.) |
`;
}

export function writeQuickStartGuide(outputDir = 'docs'): string {
  const outputPath = path.resolve(process.cwd(), outputDir, 'INTROSPECTION-QUICKSTART.md');
  const dir = path.dirname(outputPath);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(outputPath, generateQuickStartGuide());
  return outputPath;
}


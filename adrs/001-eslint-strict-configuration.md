# ADR-001: Strict ESLint Configuration

## Status
Accepted

## Date
2025-11-27

## Context

As `ts-introspect` is a developer tool that enforces code quality through metadata and validation, the codebase itself must exemplify strict coding standards. We needed a linting strategy that:

1. Catches bugs at compile/lint time rather than runtime
2. Enforces consistent code style across the project
3. Leverages TypeScript's type system for maximum safety
4. Works with ESLint 9+ flat config format

## Decision

We adopt **typescript-eslint's strictTypeChecked and stylisticTypeChecked** presets as our base configuration, with additional custom rules for maximum type safety.

### Key Rules Enabled

#### Type Safety (Error Level)
- `@typescript-eslint/no-explicit-any` - No implicit any types
- `@typescript-eslint/no-unsafe-*` - Prevent unsafe type operations
- `@typescript-eslint/strict-boolean-expressions` - Explicit boolean checks
- `@typescript-eslint/no-floating-promises` - All promises must be handled
- `@typescript-eslint/no-unnecessary-condition` - Remove dead code paths

#### Code Quality (Error Level)
- `@typescript-eslint/explicit-function-return-type` - Document return types
- `@typescript-eslint/explicit-module-boundary-types` - Clear API contracts
- `@typescript-eslint/consistent-type-imports` - Use `import type` syntax
- `eqeqeq` - Strict equality only
- `curly` - Always use braces

#### Import Hygiene
- `@typescript-eslint/consistent-type-imports` - Prefer type imports
- `@typescript-eslint/consistent-type-exports` - Consistent type exports
- `@typescript-eslint/no-import-type-side-effects` - No side-effect type imports

### Configuration File

```javascript
// eslint.config.js (ESLint 9+ flat config)
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  // ... custom rules
);
```

## Consequences

### Positive
- Catches type-related bugs before runtime
- Self-documenting code through explicit types
- Consistent codebase style
- Better IDE support and autocomplete
- Aligns with our mission of enforcing code quality

### Negative
- Stricter rules require more explicit type annotations
- Some valid patterns may need type assertions
- Initial migration effort to fix existing violations

### Mitigations
- `argsIgnorePattern: '^_'` for intentionally unused parameters
- `allowExpressions: true` for inline arrow functions
- CLI files (`src/cli/**`) allow `console.log` and skip return type requirements
- Ignored paths: `dist/`, `coverage/`, `node_modules/`, `tests/`, `bin/`, `templates/`

## Related
- ESLint 9 Flat Config: https://eslint.org/docs/latest/use/configure/configuration-files
- typescript-eslint: https://typescript-eslint.io/


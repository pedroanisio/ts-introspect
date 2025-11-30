# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.10] - 2025-11-30

### Fixed

- **Orphaned header fragments** - Fixed bug where orphaned metadata header comments (without actual metadata export) were not cleaned up
  - These fragments could accumulate from previous buggy versions
  - Added `removeOrphanedMetadataHeaders()` to clean up header-only fragments
  - Added regression test

## [1.0.9] - 2025-11-30

### Fixed

- **Import stripping bug** - Fixed critical bug where `tsi generate --overwrite` would strip imports and file-level JSDoc comments
  - Root cause: Forward-matching regex `(?:\/\*\*[\s\S]*?\*\/)` could match from file's first `/**` to metadata's JSDoc
  - Fix: Anchor on `export const __metadata` and search backwards for block boundaries
  - Added regression tests to prevent recurrence

### Added

- **MetadataBuilder Pattern** - Fluent builder API for generating metadata stubs programmatically
  - Method chaining for all metadata fields
  - React component support (props, hooks, contexts, renders)
  - `build()` for TypeScript code, `buildObject()` for JS objects
  - `generateMetadataStubWithBuilder()` export for programmatic use

- **Result Pattern** - Type-safe error handling without exceptions
  - `Ok<T>` and `Err<E>` constructors
  - Type guards: `isOk()`, `isErr()`
  - Unwrap utilities: `unwrap()`, `unwrapOr()`, `unwrapErr()`
  - Transformations: `map()`, `mapErr()`, `andThen()`, `orElse()`
  - Pattern matching: `match()`
  - Error wrapping: `tryCatch()`, `tryCatchAsync()`, `collect()`

- **Result-based Validation API** - Alternative validation functions returning `Result<T, E>`
  - `lintFileResult()` - Lint a single file with explicit error handling
  - `validateResult()` - Validate project with Result wrapper
  - `hasValidMetadataResult()` - Quick validity check returning Result

- **ConfigService** - Centralized configuration management (Singleton pattern)
  - `ConfigService.getInstance()` for accessing config
  - Automatic config file discovery and loading
  - Config caching with invalidation support

- **Output Formatters** - Strategy pattern for flexible output formatting
  - `JsonFormatter`, `TableFormatter`, `TextFormatter`, `MarkdownFormatter`
  - `getFormatter()` factory function
  - Specialized `LintResultFormatter` and `ReportFormatter`

- **RuleRegistry** - Plugin system for lint rules
  - `RuleRegistry.getInstance()` for rule management
  - `register()`, `unregister()`, `getRule()`, `getAllRules()`
  - Built-in rule loading
  - External rule loading support

### Changed

- Test suite expanded from 297 to 384 tests

## [1.0.3] - 2025-11-29

### Fixed

- **Self-dependency bug** - Removed erroneous self-reference (`ts-introspect`) from package dependencies
- **VERSION constant drift** - Synchronized `VERSION` exports in `src/index.ts` and `src/cli/output.ts` with `package.json`
- **Hash calculation with JSDoc** - Fixed hasher to strip `@internal` JSDoc comments when calculating content hash, preventing false stale-hash errors

### Added

- **Knip integration** - Generated `__metadata` exports now include `@internal` JSDoc tag to prevent false-positive "unused export" warnings in Knip
  - Both `tsi generate` (new files) and `tsi generate --overwrite` (existing files) now add the tag
- **Knip documentation** - Added "Knip Integration" section to README explaining the `tags: ["-@internal"]` configuration
- **Hash regression tests** - Added tests to ensure JSDoc tags on metadata don't affect content hash calculation
- **CLI integration tests** - Added comprehensive tests for all CLI commands (32 tests) to prevent publishing with broken commands
- **Enhanced pre-commit hook** - Now runs both metadata validation AND tests before commit

### Changed

- Updated `knip.json` with `tags` configuration to ignore `@internal` exports
- Updated `templates/metadata.template.ts` with `@internal` JSDoc tag
- Updated `src/generators/stub.ts` (programmatic API) and `src/cli/commands/generate.ts` (CLI) with `@internal` JSDoc tag

## [1.0.0] - 2025-11-28

### Added

- **Core Metadata System**
  - `FileMetadata` type for self-documenting TypeScript modules
  - Support for `description`, `responsibilities`, `exports`, `dependencies`
  - Status tracking (`draft`, `experimental`, `stable`, `deprecated`, `archived`)
  - Changelog entries with version, date, author, and changes
  - TODO and FIX tracking with priorities and IDs

- **React Support**
  - Automatic detection of React components in `.tsx` files
  - Component classification (`page`, `layout`, `feature`, `ui`, `provider`, `hoc`, `hook`)
  - Props interface extraction with property details
  - Hooks detection (built-in and custom)
  - Context usage tracking
  - State management library detection (Redux, Zustand, Jotai, React Query)
  - Memoization and forwardRef detection

- **CLI Commands**
  - `tsi init` - Initialize project with config and git hooks
  - `tsi lint` - Validate metadata in TypeScript files
  - `tsi generate` - Generate metadata stubs for files
  - `tsi report` - Generate project reports (summary, todos, fixes, deps)
  - `tsi deps` - Analyze file dependencies with graph visualization
  - `tsi adr` - Manage Architecture Decision Records (JSONL format)
  - `tsi hooks` - Install/uninstall git pre-commit hooks
  - `tsi docs` - Generate documentation

- **AI-Focused CLI Design**
  - JSON output by default for machine consumption
  - Structured error responses with HTTP-style codes
  - Self-describing interfaces (`--api-version`, `--schema`, `--list-commands`)
  - Semantic exit codes (0=success, 1=user error, 2=system error)
  - Human-friendly output opt-in (`--format=text|table`)

- **HTML Reports**
  - Interactive dependency graph with D3.js visualization
  - Project summary with coverage metrics
  - Status distribution charts
  - TODO priority breakdown
  - Module listing with metadata
  - Multiple themes: `classic`, `dark`, `light`, `dracula`, `nord`

- **Validation Rules**
  - `metadata/required` - File must export `__metadata`
  - `metadata/stale-hash` - Content hash must match stored hash
  - `metadata/required-fields` - Required fields must be present
  - `metadata/deps-mismatch` - Dependencies must match imports
  - `metadata/untracked-todos` - Inline TODOs should be in metadata
  - `metadata/stale-update` - `updatedAt` shouldn't be too old
  - `metadata/empty-changelog` - Changelog shouldn't be empty

- **ESLint Plugin**
  - `introspect/require-metadata` rule
  - `introspect/valid-metadata` rule
  - Support for ESLint flat config

- **Git Hooks**
  - Pre-commit hook for metadata validation
  - Automatic installation via `tsi hooks --install`

- **Developer Experience**
  - tslog-based logging (ADR-001)
  - TypeScript strict mode (ADR-002)
  - Knip for dead code detection (ADR-003)
  - Comprehensive test suite (200 tests)

[1.0.3]: https://github.com/pedroanisio/ts-introspect/releases/tag/v1.0.3
[1.0.0]: https://github.com/pedroanisio/ts-introspect/releases/tag/v1.0.0


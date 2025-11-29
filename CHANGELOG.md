# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.3] - 2025-11-29

### Fixed

- **Self-dependency bug** - Removed erroneous self-reference (`ts-introspect`) from package dependencies
- **VERSION constant drift** - Synchronized `VERSION` exports in `src/index.ts` and `src/cli/output.ts` with `package.json`

### Added

- **Knip integration** - Generated `__metadata` exports now include `@internal` JSDoc tag to prevent false-positive "unused export" warnings in Knip
  - Both `tsi generate` (new files) and `tsi generate --overwrite` (existing files) now add the tag
- **Knip documentation** - Added "Knip Integration" section to README explaining the `tags: ["-@internal"]` configuration

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
  - Comprehensive test suite (165 tests)

[1.0.3]: https://github.com/pedroanisio/ts-introspect/releases/tag/v1.0.3
[1.0.0]: https://github.com/pedroanisio/ts-introspect/releases/tag/v1.0.0


/**
 * ts-introspect
 *
 * Self-documenting TypeScript modules with enforced metadata
 *
 * @example
 * // In your TypeScript files:
 * import type { FileMetadata } from 'ts-introspect/types';
 *
 * export const __metadata: FileMetadata = {
 *   module: 'my-module',
 *   // ...
 * };
 *
 * @example
 * // Programmatic API:
 * import { IntrospectionRegistry, validate, analyzeDependencies } from 'ts-introspect';
 *
 * const results = await validate({ srcDir: 'src' });
 * const deps = analyzeDependencies('src/my-file.ts');
 */

// ============================================
// Types
// ============================================

export type {
  FileMetadata,
  IndexMetadata,
  TodoItem,
  FixItem,
  ChangelogEntry,
  DependencyInfo,
  InternalMeta,
  TodoPriority,
  TodoStatus,
  FixSeverity,
  FixStatus,
  ModuleStatus,
  // React types
  ComponentType,
  PropInfo,
  HookInfo,
  ReactInfo
} from './types/metadata.js';

export { isFullMetadata } from './types/metadata.js';

export type {
  IntrospectConfig,
  ValidationRules,
  RuleSeverity,
  HooksConfig
} from './types/config.js';

export {
  DEFAULT_CONFIG,
  DEFAULT_EXCLUDE_PATTERNS,
  defineConfig
} from './types/config.js';

// ============================================
// Core Functionality
// ============================================

// Hasher
export {
  generateContentHash,
  generateContentHashFromString,
  extractStoredHash,
  extractStoredHashFromString,
  hasContentChanged,
  getHashInfo,
  type HashInfo
} from './core/hasher.js';

// Analyzer
export {
  analyzeDependencies,
  analyzeExports,
  analyzeReactComponent,
  buildDependencyGraph,
  DependencyAnalyzer,
  type DependencyInfo as AnalyzedDependencies,
  type FileUsageInfo,
  type ExportInfo
} from './core/analyzer.js';

// Validator
export {
  Validator,
  validate,
  lintFiles,
  // Result-based API
  lintFileResult,
  validateResult,
  hasValidMetadataResult,
  type LintError,
  type LintWarning,
  type LintResult,
  type ValidationResult,
  type ValidationError,
  type ValidationErrorCode
} from './core/validator.js';

// Registry
export {
  IntrospectionRegistry,
  registry,
  type RegisteredMetadata,
  type TodoWithModule,
  type FixWithModule,
  type RegistrySummary
} from './core/registry.js';

// Config Service
export {
  ConfigService,
  getConfigService,
  type LoadOptions
} from './core/config-service.js';

// Rule Registry (Plugin System)
export {
  RuleRegistry,
  getRuleRegistry,
  createRule,
  type LintRule,
  type RuleContext,
  type RuleResult,
  type CreateRuleOptions
} from './core/rule-registry.js';

// Output Formatters
export {
  JsonFormatter,
  TableFormatter,
  TextFormatter,
  MarkdownFormatter,
  getFormatter,
  type OutputFormatter,
  type OutputFormatType,
  type FormatOptions
} from './cli/formatters/index.js';

export {
  LintResultFormatter
} from './cli/formatters/lint-formatter.js';

export {
  ReportFormatter
} from './cli/formatters/report-formatter.js';

// ============================================
// Generators
// ============================================

export {
  generateMetadataStub,
  generateMetadataObject,
  type StubOptions
} from './generators/stub.js';

export {
  generateHtmlReport,
  generateReportData,
  type HtmlReportData,
  type HtmlReportOptions,
  type ThemeName
} from './generators/html-report.js';

export {
  generateAdr,
  writeAdr,
  generateQuickStartGuide,
  writeQuickStartGuide,
  type AdrOptions,
  type AdrTemplate
} from './generators/adr.js';

// MetadataBuilder
export {
  MetadataBuilder,
  type MetadataBuilderOptions,
  type PropsInfo,
  type DependenciesInfo
} from './generators/metadata-builder.js';

export { generateMetadataStubWithBuilder } from './cli/commands/generate.js';

// ============================================
// Result Pattern
// ============================================

export type {
  Result,
  OkResult,
  ErrResult,
  ResultError,
  MatchHandlers
} from './types/result.js';

export {
  Ok,
  Err,
  isOk,
  isErr,
  unwrap,
  unwrapOr,
  unwrapErr,
  map,
  mapErr,
  andThen,
  orElse,
  match,
  tryCatch,
  tryCatchAsync,
  collect
} from './types/result.js';

// ============================================
// ADR (Architecture Decision Records)
// ============================================

export type {
  Adr,
  AdrStatus,
  AdrValidationError
} from './types/adr.js';

export {
  parseAdrLine,
  serializeAdr,
  parseAdrJsonl,
  serializeAdrsToJsonl,
  validateAdr,
  adrToMarkdown,
  adrsToTable
} from './types/adr.js';

// ============================================
// Hooks
// ============================================

export {
  installHooks,
  uninstallHooks,
  checkHooksInstalled
} from './hooks/installer.js';

// ============================================
// Version
// ============================================

export const VERSION = '1.0.10';


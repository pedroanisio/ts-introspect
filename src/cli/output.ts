/**
 * CLI Output Helpers
 * 
 * AI-focused structured output following best practices from:
 * https://raw.githubusercontent.com/pedroanisio/pedroanisio.github.io/refs/heads/main/building-ai-focused-cli.md
 * 
 * Key principles:
 * - JSON output by default (machine-readable)
 * - Structured error responses with codes
 * - HTTP-style exit code semantics
 * - Self-describing interfaces
 * 
 * Uses tslog per ADR-001
 */

import chalk from 'chalk';
import { stdout, stderr, stderrJson } from './logger.js';

// ============================================
// Constants
// ============================================

export const CLI_VERSION = '1.0.10';
export const API_VERSION = 'v1';

// ============================================
// Types
// ============================================

export type OutputFormat = 'json' | 'yaml' | 'table' | 'text';

export interface CliSuccess<T = unknown> {
  success: true;
  version: string;
  api_version: string;
  timestamp: string;
  result: T;
}

export interface CliErrorDetails {
  field?: string;
  provided?: string;
  expected?: string;
  [key: string]: unknown;
}

export interface CliError {
  success: false;
  error: {
    code: string;
    http_equivalent: number;
    message: string;
    details?: CliErrorDetails | undefined;
    documentation_url?: string | undefined;
  };
}

export type CliResponse<T = unknown> = CliSuccess<T> | CliError;

// ============================================
// Exit Codes (HTTP-style semantics)
// ============================================

export const ExitCode = {
  SUCCESS: 0,           // Success
  USER_ERROR: 1,        // 4xx-style - user error, don't retry
  SYSTEM_ERROR: 2,      // 5xx-style - system error, retry possible
  RATE_LIMITED: 3,      // 429-style - retry with backoff
  VALIDATION_ERROR: 1,  // Invalid input
  NOT_FOUND: 1,         // Resource not found
} as const;

// ============================================
// Error Codes
// ============================================

export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFIG_ERROR: 'CONFIG_ERROR',
  FILE_ERROR: 'FILE_ERROR',
  PARSE_ERROR: 'PARSE_ERROR',
  COMMAND_ERROR: 'COMMAND_ERROR',
  SYSTEM_ERROR: 'SYSTEM_ERROR',
} as const;

// ============================================
// Output Helpers
// ============================================

/**
 * Generate a successful response
 */
export function success<T>(result: T): CliSuccess<T> {
  return {
    success: true,
    version: CLI_VERSION,
    api_version: API_VERSION,
    timestamp: new Date().toISOString(),
    result,
  };
}

/**
 * Generate an error response
 */
export function error(
  code: string,
  message: string,
  httpEquivalent = 400,
  details?: CliErrorDetails
): CliError {
  return {
    success: false,
    error: {
      code,
      http_equivalent: httpEquivalent,
      message,
      details,
      documentation_url: `https://github.com/pedroanisio/ts-introspect#${code.toLowerCase()}`,
    },
  };
}

/**
 * Output JSON response to stdout
 */
export function outputJson(response: CliResponse): void {
  stdout(JSON.stringify(response, null, 2));
}

/**
 * Output success and exit
 */
export function outputSuccess(result: unknown, format: OutputFormat = 'json'): void {
  if (format === 'json') {
    outputJson(success(result));
  } else {
    // For non-JSON, just output the result directly
    stdout(JSON.stringify(result, null, 2));
  }
}

/**
 * Output error and exit with appropriate code
 */
export function outputError(
  code: string,
  message: string,
  httpEquivalent = 400,
  details?: CliErrorDetails
): never {
  const response = error(code, message, httpEquivalent, details);
  
  // Always output JSON for errors (machine-readable)
  stderrJson(response);
  
  // Map HTTP codes to exit codes
  let exitCode = ExitCode.USER_ERROR as number;
  if (httpEquivalent >= 500) {
    exitCode = ExitCode.SYSTEM_ERROR;
  } else if (httpEquivalent === 429) {
    exitCode = ExitCode.RATE_LIMITED;
  }
  
  process.exit(exitCode);
}

// ============================================
// Human-Friendly Output (opt-in)
// ============================================

/**
 * Output human-friendly text (for --format=table or --format=text)
 */
export function outputHuman(message: string): void {
  stdout(message);
}

/**
 * Output colored text for human consumption
 * Uses stdout for direct output (not structured logging)
 */
export const human = {
  info: (msg: string) => stdout(chalk.blue(msg)),
  success: (msg: string) => stdout(chalk.green(msg)),
  warn: (msg: string) => stdout(chalk.yellow(msg)),
  error: (msg: string) => stderr(chalk.red(msg)),
  dim: (msg: string) => stdout(chalk.gray(msg)),
};

// ============================================
// Schema Generation
// ============================================

export interface CommandSchema {
  name: string;
  description: string;
  parameters: ParameterSchema[];
  examples?: string[];
}

export interface ParameterSchema {
  name: string;
  description: string;
  type: 'string' | 'boolean' | 'number' | 'array';
  required: boolean;
  default?: unknown;
  enum?: string[];
}

/**
 * Get CLI schema for self-description
 */
export function getCliSchema(): {
  name: string;
  version: string;
  api_version: string;
  description: string;
  commands: CommandSchema[];
} {
  return {
    name: 'ts-introspect',
    version: CLI_VERSION,
    api_version: API_VERSION,
    description: 'Self-documenting TypeScript modules with enforced metadata, dependency tracking, and validation',
    commands: [
      {
        name: 'init',
        description: 'Initialize ts-introspect in your project',
        parameters: [
          { name: 'force', description: 'Overwrite existing configuration', type: 'boolean', required: false }
        ],
        examples: ['tsi init', 'tsi init --force']
      },
      {
        name: 'lint',
        description: 'Validate metadata in TypeScript files',
        parameters: [
          { name: 'files', description: 'Files or directories to lint', type: 'array', required: false },
          { name: 'strict', description: 'Treat warnings as errors', type: 'boolean', required: false },
          { name: 'format', description: 'Output format', type: 'string', required: false, default: 'json', enum: ['json', 'table', 'text'] },
          { name: 'config', description: 'Config file path', type: 'string', required: false }
        ],
        examples: ['tsi lint', 'tsi lint src/', 'tsi lint --format=json']
      },
      {
        name: 'generate',
        description: 'Generate metadata stubs for files',
        parameters: [
          { name: 'files', description: 'Files or directories to generate metadata for', type: 'array', required: false },
          { name: 'overwrite', description: 'Overwrite existing metadata', type: 'boolean', required: false },
          { name: 'exclude', description: 'Additional patterns to exclude', type: 'array', required: false }
        ],
        examples: ['tsi generate', 'tsi generate src/services/', 'tsi generate --overwrite']
      },
      {
        name: 'report',
        description: 'Generate introspection reports',
        parameters: [
          { name: 'type', description: 'Report type', type: 'string', required: false, default: 'summary', enum: ['todos', 'fixes', 'deps', 'summary', 'all'] },
          { name: 'output', description: 'Output file path', type: 'string', required: false },
          { name: 'format', description: 'Output format', type: 'string', required: false, default: 'json', enum: ['json', 'table', 'text', 'html', 'markdown'] }
        ],
        examples: ['tsi report', 'tsi report --type=todos', 'tsi report --format=html']
      },
      {
        name: 'deps',
        description: 'Analyze file dependencies',
        parameters: [
          { name: 'file', description: 'File to analyze', type: 'string', required: false },
          { name: 'graph', description: 'Show dependency graph', type: 'boolean', required: false },
          { name: 'who-uses', description: 'Find who imports a module', type: 'string', required: false },
          { name: 'unused', description: 'Find unused modules', type: 'boolean', required: false },
          { name: 'format', description: 'Output format', type: 'string', required: false, default: 'json', enum: ['json', 'table', 'text'] }
        ],
        examples: ['tsi deps', 'tsi deps src/core/analyzer.ts', 'tsi deps --unused']
      },
      {
        name: 'adr',
        description: 'Manage Architecture Decision Records (JSONL format)',
        parameters: [
          { name: 'list', description: 'List all ADRs', type: 'boolean', required: false },
          { name: 'add', description: 'Add new ADR', type: 'boolean', required: false },
          { name: 'show', description: 'Show specific ADR by ID', type: 'string', required: false },
          { name: 'validate', description: 'Validate all ADRs', type: 'boolean', required: false },
          { name: 'format', description: 'Output format', type: 'string', required: false, default: 'json', enum: ['json', 'table', 'markdown'] }
        ],
        examples: ['tsi adr --list', 'tsi adr --add --title="Use TypeScript"']
      },
      {
        name: 'hooks',
        description: 'Manage git hooks',
        parameters: [
          { name: 'install', description: 'Install git hooks', type: 'boolean', required: false },
          { name: 'uninstall', description: 'Remove git hooks', type: 'boolean', required: false }
        ],
        examples: ['tsi hooks --install', 'tsi hooks --uninstall']
      }
    ]
  };
}

/**
 * Get OpenAPI-style schema
 */
export function getOpenApiSchema(): object {
  const cliSchema = getCliSchema();
  
  return {
    openapi: '3.0.0',
    info: {
      title: cliSchema.name,
      version: cliSchema.version,
      description: cliSchema.description
    },
    paths: Object.fromEntries(
      cliSchema.commands.map(cmd => [
        `/${cmd.name}`,
        {
          post: {
            summary: cmd.description,
            parameters: cmd.parameters.map(p => ({
              name: p.name,
              in: 'query',
              required: p.required,
              schema: {
                type: p.type,
                default: p.default,
                enum: p.enum
              },
              description: p.description
            })),
            responses: {
              '200': {
                description: 'Successful operation',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        success: { type: 'boolean' },
                        version: { type: 'string' },
                        api_version: { type: 'string' },
                        timestamp: { type: 'string' },
                        result: { type: 'object' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      ])
    )
  };
}

/**
 * Check if output should be human-friendly
 */
export function isHumanFormat(format?: string): boolean {
  return format === 'table' || format === 'text';
}

/**
 * Determine if running in CI/non-TTY environment
 */
export function isNonInteractive(): boolean {
  return !process.stdout.isTTY || process.env['CI'] === 'true';
}


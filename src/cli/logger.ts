/**
 * CLI Logger
 * 
 * Centralized logging following ADR-001: tslog over console.log
 * Integrates with ADR-004: AI-focused CLI (JSON for machines, pretty for humans)
 */

import { Logger, type ILogObj } from 'tslog';

// ============================================
// Logger Configuration
// ============================================

/**
 * Determine if output should be pretty (human) or JSON (machine)
 */
function shouldUsePrettyOutput(): boolean {
  // Use pretty output only for TTY and non-JSON format
  return process.stdout.isTTY && process.env['TSI_FORMAT'] !== 'json';
}

/**
 * Create the main logger instance
 * - Pretty output for humans (TTY)
 * - JSON output for machines (CI/CD, pipes)
 */
function createLogger(): Logger<ILogObj> {
  const isPretty = shouldUsePrettyOutput();
  
  return new Logger({
    name: 'tsi',
    type: isPretty ? 'pretty' : 'json',
    minLevel: process.env['TSI_LOG_LEVEL'] === 'debug' ? 0 : 3, // 0=silly, 3=info
    prettyLogTemplate: '{{logLevelName}} ',
    prettyLogTimeZone: 'local',
    stylePrettyLogs: isPretty,
    prettyLogStyles: {
      logLevelName: {
        '*': ['bold', 'black', 'bgWhiteBright', 'dim'],
        SILLY: ['bold', 'white'],
        TRACE: ['bold', 'whiteBright'],
        DEBUG: ['bold', 'green'],
        INFO: ['bold', 'blue'],
        WARN: ['bold', 'yellow'],
        ERROR: ['bold', 'red'],
        FATAL: ['bold', 'redBright'],
      },
    },
  });
}

// ============================================
// Logger Instance
// ============================================

export const logger = createLogger();

// ============================================
// Convenience Functions (CLI Output)
// ============================================

/**
 * Output to stdout (for results, not logs)
 * This bypasses the logger for direct output
 */
export function stdout(message: string): void {
  process.stdout.write(message + '\n');
}

/**
 * Output to stderr (for errors)
 */
export function stderr(message: string): void {
  process.stderr.write(message + '\n');
}

/**
 * Output JSON to stdout (for machine consumption)
 */
export function stdoutJson(data: unknown): void {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}

/**
 * Output JSON to stderr (for error responses)
 */
export function stderrJson(data: unknown): void {
  process.stderr.write(JSON.stringify(data, null, 2) + '\n');
}

// ============================================
// Re-export for convenience
// ============================================

export { Logger };
export type { ILogObj };


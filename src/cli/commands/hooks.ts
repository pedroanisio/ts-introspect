/**
 * Hooks Command
 *
 * Manage git hooks.
 * AI-focused: JSON output by default.
 * Uses tslog per ADR-001
 */

import chalk from 'chalk';
import { installHooks, uninstallHooks, checkHooksInstalled } from '../../hooks/installer.js';
import {
  outputJson,
  success,
  outputError,
  ErrorCode,
  isHumanFormat,
  human,
  type OutputFormat,
} from '../output.js';
import { stdout } from '../logger.js';

interface HooksOptions {
  install?: boolean;
  uninstall?: boolean;
  check?: boolean;
  format?: OutputFormat;
}

export async function hooksCommand(options: HooksOptions): Promise<void> {
  const format = options.format ?? 'json';

  if (options.uninstall) {
    if (isHumanFormat(format)) {
      human.info('\n🪝 Removing git hooks...\n');
    }

    try {
      await uninstallHooks();
      
      if (format === 'json') {
        outputJson(success({
          action: 'uninstall',
          status: 'success',
          message: 'Git hooks removed',
        }));
      } else {
        human.success('✅ Git hooks removed\n');
      }
    } catch (error) {
      outputError(
        ErrorCode.SYSTEM_ERROR,
        `Failed to remove hooks: ${(error as Error).message}`,
        500
      );
    }

    return;
  }

  if (options.install) {
    if (isHumanFormat(format)) {
      human.info('\n🪝 Installing git hooks...\n');
    }

    try {
      await installHooks();
      
      if (format === 'json') {
        outputJson(success({
          action: 'install',
          status: 'success',
          message: 'Git hooks installed',
        }));
      } else {
        human.success('✅ Git hooks installed\n');
      }
    } catch (error) {
      outputError(
        ErrorCode.SYSTEM_ERROR,
        `Failed to install hooks: ${(error as Error).message}`,
        500
      );
    }

    return;
  }

  // Default: show status (or explicit --check)
  const status = await checkHooksInstalled();

  if (format === 'json') {
    outputJson(success({
      action: 'check',
      hooks: {
        pre_commit: status.preCommit,
      },
      all_installed: status.preCommit,
    }));
    return;
  }

  if (format === 'table') {
    stdout('| Hook | Installed |');
    stdout('|------|-----------|');
    stdout(`| pre-commit | ${status.preCommit ? '✓' : '✗'} |`);
    return;
  }

  // Text format
  stdout(chalk.blue('\n🪝 Git Hooks Status\n'));

  if (status.preCommit) {
    stdout(chalk.green('  ✓ pre-commit hook installed'));
  } else {
    stdout(chalk.gray('  ○ pre-commit hook not installed'));
  }

  stdout('');
  stdout(chalk.gray('  Use --install to install hooks'));
  stdout(chalk.gray('  Use --uninstall to remove hooks\n'));
}

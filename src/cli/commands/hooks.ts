/**
 * Hooks Command
 *
 * Manage git hooks.
 * AI-focused: JSON output by default.
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
    console.log('| Hook | Installed |');
    console.log('|------|-----------|');
    console.log(`| pre-commit | ${status.preCommit ? '✓' : '✗'} |`);
    return;
  }

  // Text format
  console.log(chalk.blue('\n🪝 Git Hooks Status\n'));

  if (status.preCommit) {
    console.log(chalk.green('  ✓ pre-commit hook installed'));
  } else {
    console.log(chalk.gray('  ○ pre-commit hook not installed'));
  }

  console.log('');
  console.log(chalk.gray('  Use --install to install hooks'));
  console.log(chalk.gray('  Use --uninstall to remove hooks\n'));
}

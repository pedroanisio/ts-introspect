/**
 * Hooks Command
 *
 * Manage git hooks
 */

import chalk from 'chalk';
import { installHooks, uninstallHooks, checkHooksInstalled } from '../../hooks/installer.js';

interface HooksOptions {
  install?: boolean;
  uninstall?: boolean;
}

export async function hooksCommand(options: HooksOptions): Promise<void> {
  if (options.uninstall) {
    console.log(chalk.blue('\n🪝 Removing git hooks...\n'));

    try {
      await uninstallHooks();
      console.log(chalk.green('✅ Git hooks removed\n'));
    } catch (error) {
      console.log(chalk.red(`❌ Failed to remove hooks: ${(error as Error).message}\n`));
      process.exit(1);
    }

    return;
  }

  if (options.install) {
    console.log(chalk.blue('\n🪝 Installing git hooks...\n'));

    try {
      await installHooks();
      console.log(chalk.green('✅ Git hooks installed\n'));
    } catch (error) {
      console.log(chalk.red(`❌ Failed to install hooks: ${(error as Error).message}\n`));
      process.exit(1);
    }

    return;
  }

  // Default: show status
  console.log(chalk.blue('\n🪝 Git Hooks Status\n'));

  const status = await checkHooksInstalled();

  if (status.preCommit) {
    console.log(chalk.green('  ✓ pre-commit hook installed'));
  } else {
    console.log(chalk.gray('  ○ pre-commit hook not installed'));
  }

  console.log('');
  console.log(chalk.gray('  Use --install to install hooks'));
  console.log(chalk.gray('  Use --uninstall to remove hooks\n'));
}


/**
 * Init Command
 *
 * Initialize ts-introspect in a project
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { DEFAULT_CONFIG } from '../../types/config.js';
import { installHooks } from '../../hooks/installer.js';

interface InitOptions {
  force?: boolean;
}

export async function initCommand(options: InitOptions): Promise<void> {
  const configPath = path.resolve(process.cwd(), 'introspect.config.json');

  console.log(chalk.blue('\n📦 Initializing ts-introspect...\n'));

  // Check if already initialized
  if (fs.existsSync(configPath) && !options.force) {
    console.log(chalk.yellow('⚠️  Configuration already exists. Use --force to overwrite.\n'));
    return;
  }

  // Create config file
  const config = {
    $schema: 'https://unpkg.com/ts-introspect/schema.json',
    ...DEFAULT_CONFIG
  };

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  console.log(chalk.green(`✅ Created ${chalk.bold('introspect.config.json')}`));

  // Add to package.json scripts
  const pkgPath = path.resolve(process.cwd(), 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as {
        scripts?: Record<string, string>;
      };
      pkg.scripts = pkg.scripts ?? {};

      const scriptsToAdd: Record<string, string> = {
        'introspect': 'tsi report',
        'introspect:lint': 'tsi lint',
        'introspect:generate': 'tsi generate'
      };

      let added = false;
      for (const [name, cmd] of Object.entries(scriptsToAdd)) {
        if (!pkg.scripts[name]) {
          pkg.scripts[name] = cmd;
          added = true;
        }
      }

      // Add to precommit if it exists
      if (pkg.scripts['precommit'] && !pkg.scripts['precommit'].includes('tsi lint')) {
        pkg.scripts['precommit'] = `${pkg.scripts['precommit']} && tsi lint`;
        added = true;
      }

      if (added) {
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
        console.log(chalk.green(`✅ Added scripts to ${chalk.bold('package.json')}`));
      }
    } catch {
      console.log(chalk.yellow('⚠️  Could not update package.json'));
    }
  }

  // Install git hooks
  console.log(chalk.blue('\n🪝 Installing git hooks...'));
  try {
    await installHooks();
    console.log(chalk.green('✅ Git hooks installed'));
  } catch {
    console.log(chalk.yellow('⚠️  Could not install git hooks (no .git directory?)'));
  }

  // Print next steps
  console.log(chalk.blue('\n📋 Next steps:\n'));
  console.log('   1. Run ' + chalk.cyan('tsi generate') + ' to add metadata to existing files');
  console.log('   2. Run ' + chalk.cyan('tsi lint') + ' to validate metadata');
  console.log('   3. Run ' + chalk.cyan('tsi report') + ' to see project overview\n');

  console.log(chalk.green('✨ ts-introspect initialized successfully!\n'));
}


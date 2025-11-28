/**
 * Init Command
 *
 * Initialize ts-introspect in a project.
 * AI-focused: JSON output by default.
 * Uses tslog per ADR-001
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { DEFAULT_CONFIG } from '../../types/config.js';
import { installHooks } from '../../hooks/installer.js';
import { stdout } from '../logger.js';
import {
  outputJson,
  success,
  isHumanFormat,
  human,
  type OutputFormat,
} from '../output.js';

interface InitOptions {
  force?: boolean;
  format?: OutputFormat;
}

export async function initCommand(options: InitOptions): Promise<void> {
  const format = options.format ?? 'json';
  const configPath = path.resolve(process.cwd(), 'introspect.config.json');

  if (isHumanFormat(format)) {
    human.info('\n📦 Initializing ts-introspect...\n');
  }

  // Check if already initialized
  if (fs.existsSync(configPath) && !options.force) {
    if (format === 'json') {
      outputJson(success({
        action: 'init',
        status: 'skipped',
        message: 'Configuration already exists. Use --force to overwrite.',
        config_path: configPath,
      }));
    } else {
      human.warn('⚠️  Configuration already exists. Use --force to overwrite.\n');
    }
    return;
  }

  // Create config file
  const config = {
    $schema: 'https://unpkg.com/ts-introspect/schema.json',
    ...DEFAULT_CONFIG
  };

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  
  const actions: string[] = ['created_config'];
  
  if (isHumanFormat(format)) {
    human.success(`✅ Created ${chalk.bold('introspect.config.json')}`);
  }

  // Add to package.json scripts
  const pkgPath = path.resolve(process.cwd(), 'package.json');
  let scriptsAdded = false;
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
        scriptsAdded = true;
        actions.push('added_scripts');
        if (isHumanFormat(format)) {
          human.success(`✅ Added scripts to ${chalk.bold('package.json')}`);
        }
      }
    } catch {
      if (isHumanFormat(format)) {
        human.warn('⚠️  Could not update package.json');
      }
    }
  }

  // Install git hooks
  let hooksInstalled = false;
  if (isHumanFormat(format)) {
    stdout(chalk.blue('\n🪝 Installing git hooks...'));
  }
  try {
    await installHooks();
    hooksInstalled = true;
    actions.push('installed_hooks');
    if (isHumanFormat(format)) {
      human.success('✅ Git hooks installed');
    }
  } catch {
    if (isHumanFormat(format)) {
      human.warn('⚠️  Could not install git hooks (no .git directory?)');
    }
  }

  // Output based on format
  if (format === 'json') {
    outputJson(success({
      action: 'init',
      status: 'success',
      config_path: path.relative(process.cwd(), configPath),
      scripts_added: scriptsAdded,
      hooks_installed: hooksInstalled,
      actions,
    }));
  } else {
    // Print next steps
    stdout(chalk.blue('\n📋 Next steps:\n'));
    stdout('   1. Run ' + chalk.cyan('tsi generate') + ' to add metadata to existing files');
    stdout('   2. Run ' + chalk.cyan('tsi lint') + ' to validate metadata');
    stdout('   3. Run ' + chalk.cyan('tsi report') + ' to see project overview\n');
    stdout(chalk.green('✨ ts-introspect initialized successfully!\n'));
  }
}


/**
 * Deps Command
 *
 * Analyze file dependencies
 */

import path from 'path';
import chalk from 'chalk';
import { DependencyAnalyzer, analyzeDependencies } from '../../core/analyzer.js';
import { DEFAULT_CONFIG } from '../../types/config.js';

interface DepsOptions {
  graph?: boolean;
  whoUses?: string;
  unused?: boolean;
}

export async function depsCommand(
  file: string | undefined,
  options: DepsOptions
): Promise<void> {
  const srcDir = path.resolve(process.cwd(), DEFAULT_CONFIG.srcDir);
  const analyzer = new DependencyAnalyzer(srcDir);

  console.log(chalk.blue('\n🔗 Analyzing dependencies...\n'));

  await analyzer.analyze();

  if (options.whoUses) {
    // Find who imports a specific module
    showWhoUses(analyzer, options.whoUses);
    return;
  }

  if (options.unused) {
    // Find unused modules
    showUnused(analyzer);
    return;
  }

  if (options.graph) {
    // Show full dependency graph
    showGraph(analyzer);
    return;
  }

  if (file) {
    // Analyze specific file
    const filepath = path.resolve(process.cwd(), file);
    showFileDeps(filepath, analyzer);
    return;
  }

  // Default: show summary
  showSummary(analyzer);
}

function showFileDeps(filepath: string, analyzer: DependencyAnalyzer): void {
  const deps = analyzeDependencies(filepath);
  const relativePath = path.relative(process.cwd(), filepath).replace(/\.ts$/, '');

  console.log(chalk.bold(`📄 ${relativePath}\n`));

  console.log(chalk.white('Internal Dependencies:'));
  if (deps.internal.length === 0) {
    console.log(chalk.gray('  (none)'));
  } else {
    for (const dep of deps.internal) {
      console.log(chalk.cyan(`  → ${dep}`));
    }
  }

  console.log('');

  console.log(chalk.white('External Dependencies:'));
  if (deps.external.length === 0) {
    console.log(chalk.gray('  (none)'));
  } else {
    for (const dep of deps.external) {
      console.log(chalk.yellow(`  → ${dep}`));
    }
  }

  console.log('');

  if (deps.types.length > 0) {
    console.log(chalk.white('Type-only Dependencies:'));
    for (const dep of deps.types) {
      console.log(chalk.gray(`  → ${dep}`));
    }
    console.log('');
  }

  // Show who uses this file
  const srcDir = path.resolve(process.cwd(), DEFAULT_CONFIG.srcDir);
  const moduleRelative = path.relative(srcDir, filepath).replace(/\.ts$/, '');
  const usedBy = analyzer.getUsedBy(moduleRelative);

  console.log(chalk.white('Used By:'));
  if (usedBy.length === 0) {
    console.log(chalk.gray('  (no internal usages found)'));
  } else {
    for (const user of usedBy) {
      console.log(chalk.green(`  ← ${user}`));
    }
  }

  console.log('');
}

function showWhoUses(analyzer: DependencyAnalyzer, module: string): void {
  // Normalize the module path
  const normalizedModule = module.replace(/\.ts$/, '').replace(/^src\//, '');
  const usedBy = analyzer.getUsedBy(normalizedModule);

  console.log(chalk.bold(`🔍 Who uses "${normalizedModule}"?\n`));

  if (usedBy.length === 0) {
    console.log(chalk.gray('  No internal usages found.'));
    console.log(chalk.gray('  (May be used as entry point or by external code)\n'));
    return;
  }

  for (const user of usedBy) {
    console.log(chalk.green(`  ← ${user}`));
  }

  console.log(`\n  ${chalk.white(`Total: ${usedBy.length} modules`)}\n`);
}

function showUnused(analyzer: DependencyAnalyzer): void {
  const unused = analyzer.getUnusedModules();

  console.log(chalk.bold('📦 Unused Modules\n'));

  if (unused.length === 0) {
    console.log(chalk.green('  All modules are being used! ✓\n'));
    return;
  }

  console.log(chalk.yellow('  The following modules are not imported by any other module:\n'));

  for (const module of unused) {
    console.log(chalk.gray(`  ○ ${module}`));
  }

  console.log(chalk.gray('\n  Note: Entry points and exported APIs may appear here.\n'));
}

function showGraph(analyzer: DependencyAnalyzer): void {
  const graph = analyzer.getGraph();

  if (!graph) {
    console.log(chalk.red('No dependency graph available.\n'));
    return;
  }

  console.log(chalk.bold('📊 Dependency Graph\n'));

  // Sort by number of usedBy (most used first)
  const sorted = [...graph.entries()].sort((a, b) => b[1].usedBy.length - a[1].usedBy.length);

  for (const [module, info] of sorted) {
    const usedByCount = info.usedBy.length;
    const usesCount = info.uses.length;

    const indicator = usedByCount > 3 ? chalk.green('●') :
      usedByCount > 0 ? chalk.yellow('●') : chalk.gray('○');

    console.log(`${indicator} ${chalk.cyan(module)} ${chalk.gray(`(←${usedByCount} →${usesCount})`)}`);
  }

  // Check for circular dependencies
  console.log('');
  const cycles = analyzer.findCircularDependencies();

  if (cycles.length > 0) {
    console.log(chalk.yellow.bold('⚠️  Circular Dependencies Detected:\n'));
    for (const cycle of cycles) {
      console.log(chalk.yellow(`  ${cycle.join(' → ')} → ${cycle[0]}`));
    }
    console.log('');
  } else {
    console.log(chalk.green('✓ No circular dependencies detected\n'));
  }
}

function showSummary(analyzer: DependencyAnalyzer): void {
  const graph = analyzer.getGraph();

  if (!graph) {
    console.log(chalk.red('Could not analyze dependencies.\n'));
    return;
  }

  const totalModules = graph.size;
  const unused = analyzer.getUnusedModules();
  const cycles = analyzer.findCircularDependencies();

  // Calculate most used modules
  const mostUsed = [...graph.entries()]
    .sort((a, b) => b[1].usedBy.length - a[1].usedBy.length)
    .slice(0, 5);

  console.log(chalk.bold('📊 Dependency Summary\n'));
  console.log(`  ${chalk.white('Total Modules:')} ${chalk.cyan(totalModules)}`);
  console.log(`  ${chalk.white('Unused Modules:')} ${chalk.yellow(unused.length)}`);
  console.log(`  ${chalk.white('Circular Deps:')} ${cycles.length > 0 ? chalk.red(cycles.length) : chalk.green('0')}`);

  if (mostUsed.length > 0) {
    console.log(chalk.white('\n  Most Used Modules:'));
    for (const [module, info] of mostUsed) {
      if (info.usedBy.length > 0) {
        console.log(`    ${chalk.cyan(module)} ${chalk.gray(`(${info.usedBy.length} usages)`)}`);
      }
    }
  }

  console.log('');
}


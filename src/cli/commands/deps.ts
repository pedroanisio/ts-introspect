/**
 * Deps Command
 *
 * Analyze file dependencies.
 * AI-focused: JSON output by default.
 */

import path from 'path';
import chalk from 'chalk';
import { DependencyAnalyzer, analyzeDependencies } from '../../core/analyzer.js';
import { DEFAULT_CONFIG } from '../../types/config.js';
import {
  outputJson,
  success,
  outputError,
  ErrorCode,
  isHumanFormat,
  human,
  type OutputFormat,
} from '../output.js';

interface DepsOptions {
  graph?: boolean;
  whoUses?: string;
  unused?: boolean;
  circular?: boolean;
  format?: OutputFormat;
}

export async function depsCommand(
  file: string | undefined,
  options: DepsOptions
): Promise<void> {
  const format = options.format ?? 'json';
  const srcDir = path.resolve(process.cwd(), DEFAULT_CONFIG.srcDir);
  const analyzer = new DependencyAnalyzer(srcDir);

  if (isHumanFormat(format)) {
    human.info('\n🔗 Analyzing dependencies...\n');
  }

  try {
    await analyzer.analyze();
  } catch (err) {
    outputError(
      ErrorCode.SYSTEM_ERROR,
      `Failed to analyze dependencies: ${err instanceof Error ? err.message : String(err)}`,
      500
    );
  }

  if (options.whoUses) {
    showWhoUses(analyzer, options.whoUses, format);
    return;
  }

  if (options.unused) {
    showUnused(analyzer, format);
    return;
  }

  if (options.circular) {
    showCircular(analyzer, format);
    return;
  }

  if (options.graph) {
    showGraph(analyzer, format);
    return;
  }

  if (file) {
    const filepath = path.resolve(process.cwd(), file);
    showFileDeps(filepath, analyzer, srcDir, format);
    return;
  }

  // Default: show summary
  showSummary(analyzer, format);
}

function showFileDeps(
  filepath: string,
  analyzer: DependencyAnalyzer,
  srcDir: string,
  format: OutputFormat
): void {
  const deps = analyzeDependencies(filepath);
  const relativePath = path.relative(process.cwd(), filepath).replace(/\.ts$/, '');
  const moduleRelative = path.relative(srcDir, filepath).replace(/\.ts$/, '');
  const usedBy = analyzer.getUsedBy(moduleRelative);

  if (format === 'json') {
    outputJson(success({
      file: relativePath,
      dependencies: {
        internal: deps.internal,
        external: deps.external,
        types: deps.types,
      },
      used_by: usedBy,
    }));
    return;
  }

  if (format === 'table') {
    console.log(`# Dependencies for: ${relativePath}\n`);
    console.log('| Type | Dependency |');
    console.log('|------|------------|');
    for (const dep of deps.internal) {
      console.log(`| internal | ${dep} |`);
    }
    for (const dep of deps.external) {
      console.log(`| external | ${dep} |`);
    }
    for (const dep of deps.types) {
      console.log(`| type-only | ${dep} |`);
    }
    console.log('\n## Used By\n');
    for (const user of usedBy) {
      console.log(`- ${user}`);
    }
    return;
  }

  // Text format
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

function showWhoUses(
  analyzer: DependencyAnalyzer,
  module: string,
  format: OutputFormat
): void {
  const normalizedModule = module.replace(/\.ts$/, '').replace(/^src\//, '');
  const usedBy = analyzer.getUsedBy(normalizedModule);

  if (format === 'json') {
    outputJson(success({
      module: normalizedModule,
      used_by: usedBy,
      count: usedBy.length,
    }));
    return;
  }

  if (format === 'table') {
    console.log(`| Module | Uses "${normalizedModule}" |`);
    console.log('|--------|------|');
    for (const user of usedBy) {
      console.log(`| ${user} | ✓ |`);
    }
    console.log(`\n**Total:** ${usedBy.length}`);
    return;
  }

  // Text format
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

function showUnused(analyzer: DependencyAnalyzer, format: OutputFormat): void {
  const unused = analyzer.getUnusedModules();

  if (format === 'json') {
    outputJson(success({
      unused_modules: unused,
      count: unused.length,
    }));
    return;
  }

  if (format === 'table') {
    console.log('| Unused Module |');
    console.log('|---------------|');
    for (const module of unused) {
      console.log(`| ${module} |`);
    }
    console.log(`\n**Total:** ${unused.length}`);
    return;
  }

  // Text format
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

function showCircular(analyzer: DependencyAnalyzer, format: OutputFormat): void {
  const cycles = analyzer.findCircularDependencies();

  if (format === 'json') {
    outputJson(success({
      circular_dependencies: cycles.map(cycle => ({
        cycle,
        length: cycle.length,
      })),
      count: cycles.length,
    }));
    return;
  }

  if (format === 'table') {
    console.log('| Circular Dependency |');
    console.log('|---------------------|');
    for (const cycle of cycles) {
      console.log(`| ${cycle.join(' → ')} → ${cycle[0]} |`);
    }
    console.log(`\n**Total:** ${cycles.length}`);
    return;
  }

  // Text format
  console.log(chalk.bold('🔄 Circular Dependencies\n'));

  if (cycles.length === 0) {
    console.log(chalk.green('  ✓ No circular dependencies detected\n'));
    return;
  }

  console.log(chalk.yellow(`  Found ${cycles.length} circular dependency chains:\n`));
  for (const cycle of cycles) {
    console.log(chalk.yellow(`  ${cycle.join(' → ')} → ${cycle[0]}`));
  }
  console.log('');
}

function showGraph(analyzer: DependencyAnalyzer, format: OutputFormat): void {
  const graph = analyzer.getGraph();

  if (!graph) {
    outputError(ErrorCode.SYSTEM_ERROR, 'No dependency graph available', 500);
  }

  const sorted = [...graph.entries()].sort((a, b) => b[1].usedBy.length - a[1].usedBy.length);
  const cycles = analyzer.findCircularDependencies();

  if (format === 'json') {
    outputJson(success({
      modules: sorted.map(([module, info]) => ({
        module,
        used_by: info.usedBy,
        uses: info.uses,
        used_by_count: info.usedBy.length,
        uses_count: info.uses.length,
      })),
      total_modules: graph.size,
      circular_dependencies: cycles,
    }));
    return;
  }

  if (format === 'table') {
    console.log('| Module | Used By | Uses |');
    console.log('|--------|---------|------|');
    for (const [module, info] of sorted) {
      console.log(`| ${module} | ${info.usedBy.length} | ${info.uses.length} |`);
    }
    return;
  }

  // Text format
  console.log(chalk.bold('📊 Dependency Graph\n'));

  for (const [module, info] of sorted) {
    const usedByCount = info.usedBy.length;
    const usesCount = info.uses.length;

    const indicator = usedByCount > 3 ? chalk.green('●') :
      usedByCount > 0 ? chalk.yellow('●') : chalk.gray('○');

    console.log(`${indicator} ${chalk.cyan(module)} ${chalk.gray(`(←${usedByCount} →${usesCount})`)}`);
  }

  console.log('');
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

function showSummary(analyzer: DependencyAnalyzer, format: OutputFormat): void {
  const graph = analyzer.getGraph();

  if (!graph) {
    outputError(ErrorCode.SYSTEM_ERROR, 'Could not analyze dependencies', 500);
  }

  const totalModules = graph.size;
  const unused = analyzer.getUnusedModules();
  const cycles = analyzer.findCircularDependencies();

  const mostUsed = [...graph.entries()]
    .sort((a, b) => b[1].usedBy.length - a[1].usedBy.length)
    .slice(0, 5)
    .filter(([, info]) => info.usedBy.length > 0);

  if (format === 'json') {
    outputJson(success({
      summary: {
        total_modules: totalModules,
        unused_modules: unused.length,
        circular_dependencies: cycles.length,
      },
      most_used: mostUsed.map(([module, info]) => ({
        module,
        usage_count: info.usedBy.length,
      })),
      unused_modules: unused,
      circular_dependencies: cycles,
    }));
    return;
  }

  if (format === 'table') {
    console.log('| Metric | Value |');
    console.log('|--------|-------|');
    console.log(`| Total Modules | ${totalModules} |`);
    console.log(`| Unused Modules | ${unused.length} |`);
    console.log(`| Circular Deps | ${cycles.length} |`);
    return;
  }

  // Text format
  console.log(chalk.bold('📊 Dependency Summary\n'));
  console.log(`  ${chalk.white('Total Modules:')} ${chalk.cyan(totalModules)}`);
  console.log(`  ${chalk.white('Unused Modules:')} ${chalk.yellow(unused.length)}`);
  console.log(`  ${chalk.white('Circular Deps:')} ${cycles.length > 0 ? chalk.red(cycles.length) : chalk.green('0')}`);

  if (mostUsed.length > 0) {
    console.log(chalk.white('\n  Most Used Modules:'));
    for (const [module, info] of mostUsed) {
      console.log(`    ${chalk.cyan(module)} ${chalk.gray(`(${info.usedBy.length} usages)`)}`);
    }
  }

  console.log('');
}

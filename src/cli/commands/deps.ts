/**
 * Deps Command
 *
 * Analyze file dependencies.
 * AI-focused: JSON output by default.
 * Uses tslog per ADR-001
 */

import path from 'path';
import chalk from 'chalk';
import { DependencyAnalyzer, analyzeDependencies } from '../../core/analyzer.js';
import { ConfigService } from '../../core/config-service.js';
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
  const srcDir = ConfigService.getInstance().getSrcDir();
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
    stdout(`# Dependencies for: ${relativePath}\n`);
    stdout('| Type | Dependency |');
    stdout('|------|------------|');
    for (const dep of deps.internal) {
      stdout(`| internal | ${dep} |`);
    }
    for (const dep of deps.external) {
      stdout(`| external | ${dep} |`);
    }
    for (const dep of deps.types) {
      stdout(`| type-only | ${dep} |`);
    }
    stdout('\n## Used By\n');
    for (const user of usedBy) {
      stdout(`- ${user}`);
    }
    return;
  }

  // Text format
  stdout(chalk.bold(`📄 ${relativePath}\n`));

  stdout(chalk.white('Internal Dependencies:'));
  if (deps.internal.length === 0) {
    stdout(chalk.gray('  (none)'));
  } else {
    for (const dep of deps.internal) {
      stdout(chalk.cyan(`  → ${dep}`));
    }
  }

  stdout('');
  stdout(chalk.white('External Dependencies:'));
  if (deps.external.length === 0) {
    stdout(chalk.gray('  (none)'));
  } else {
    for (const dep of deps.external) {
      stdout(chalk.yellow(`  → ${dep}`));
    }
  }
  stdout('');

  if (deps.types.length > 0) {
    stdout(chalk.white('Type-only Dependencies:'));
    for (const dep of deps.types) {
      stdout(chalk.gray(`  → ${dep}`));
    }
    stdout('');
  }

  stdout(chalk.white('Used By:'));
  if (usedBy.length === 0) {
    stdout(chalk.gray('  (no internal usages found)'));
  } else {
    for (const user of usedBy) {
      stdout(chalk.green(`  ← ${user}`));
    }
  }
  stdout('');
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
    stdout(`| Module | Uses "${normalizedModule}" |`);
    stdout('|--------|------|');
    for (const user of usedBy) {
      stdout(`| ${user} | ✓ |`);
    }
    stdout(`\n**Total:** ${usedBy.length}`);
    return;
  }

  // Text format
  stdout(chalk.bold(`🔍 Who uses "${normalizedModule}"?\n`));

  if (usedBy.length === 0) {
    stdout(chalk.gray('  No internal usages found.'));
    stdout(chalk.gray('  (May be used as entry point or by external code)\n'));
    return;
  }

  for (const user of usedBy) {
    stdout(chalk.green(`  ← ${user}`));
  }
  stdout(`\n  ${chalk.white(`Total: ${usedBy.length} modules`)}\n`);
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
    stdout('| Unused Module |');
    stdout('|---------------|');
    for (const module of unused) {
      stdout(`| ${module} |`);
    }
    stdout(`\n**Total:** ${unused.length}`);
    return;
  }

  // Text format
  stdout(chalk.bold('📦 Unused Modules\n'));

  if (unused.length === 0) {
    stdout(chalk.green('  All modules are being used! ✓\n'));
    return;
  }

  stdout(chalk.yellow('  The following modules are not imported by any other module:\n'));
  for (const module of unused) {
    stdout(chalk.gray(`  ○ ${module}`));
  }
  stdout(chalk.gray('\n  Note: Entry points and exported APIs may appear here.\n'));
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
    stdout('| Circular Dependency |');
    stdout('|---------------------|');
    for (const cycle of cycles) {
      stdout(`| ${cycle.join(' → ')} → ${cycle[0]} |`);
    }
    stdout(`\n**Total:** ${cycles.length}`);
    return;
  }

  // Text format
  stdout(chalk.bold('🔄 Circular Dependencies\n'));

  if (cycles.length === 0) {
    stdout(chalk.green('  ✓ No circular dependencies detected\n'));
    return;
  }

  stdout(chalk.yellow(`  Found ${cycles.length} circular dependency chains:\n`));
  for (const cycle of cycles) {
    stdout(chalk.yellow(`  ${cycle.join(' → ')} → ${cycle[0]}`));
  }
  stdout('');
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
    stdout('| Module | Used By | Uses |');
    stdout('|--------|---------|------|');
    for (const [module, info] of sorted) {
      stdout(`| ${module} | ${info.usedBy.length} | ${info.uses.length} |`);
    }
    return;
  }

  // Text format
  stdout(chalk.bold('📊 Dependency Graph\n'));

  for (const [module, info] of sorted) {
    const usedByCount = info.usedBy.length;
    const usesCount = info.uses.length;

    const indicator = usedByCount > 3 ? chalk.green('●') :
      usedByCount > 0 ? chalk.yellow('●') : chalk.gray('○');

    stdout(`${indicator} ${chalk.cyan(module)} ${chalk.gray(`(←${usedByCount} →${usesCount})`)}`);
  }

  stdout('');
  if (cycles.length > 0) {
    stdout(chalk.yellow.bold('⚠️  Circular Dependencies Detected:\n'));
    for (const cycle of cycles) {
      stdout(chalk.yellow(`  ${cycle.join(' → ')} → ${cycle[0]}`));
    }
    stdout('');
  } else {
    stdout(chalk.green('✓ No circular dependencies detected\n'));
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
    stdout('| Metric | Value |');
    stdout('|--------|-------|');
    stdout(`| Total Modules | ${totalModules} |`);
    stdout(`| Unused Modules | ${unused.length} |`);
    stdout(`| Circular Deps | ${cycles.length} |`);
    return;
  }

  // Text format
  stdout(chalk.bold('📊 Dependency Summary\n'));
  stdout(`  ${chalk.white('Total Modules:')} ${chalk.cyan(totalModules)}`);
  stdout(`  ${chalk.white('Unused Modules:')} ${chalk.yellow(unused.length)}`);
  stdout(`  ${chalk.white('Circular Deps:')} ${cycles.length > 0 ? chalk.red(cycles.length) : chalk.green('0')}`);

  if (mostUsed.length > 0) {
    stdout(chalk.white('\n  Most Used Modules:'));
    for (const [module, info] of mostUsed) {
      stdout(`    ${chalk.cyan(module)} ${chalk.gray(`(${info.usedBy.length} usages)`)}`);
    }
  }

  stdout('');
}

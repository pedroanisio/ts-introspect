/**
 * Docs Command
 *
 * Generate documentation for the introspection system
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { writeAdr, writeQuickStartGuide, type AdrTemplate } from '../../generators/adr.js';

interface DocsOptions {
  adr?: boolean;
  quickstart?: boolean;
  all?: boolean;
  output?: string;
  adrNumber?: string;
  template?: string;
}

export async function docsCommand(options: DocsOptions): Promise<void> {
  console.log(chalk.blue('\n📚 Generating documentation...\n'));

  // Get project name from package.json
  let projectName = 'Project';
  try {
    const pkgPath = path.resolve(process.cwd(), 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { name?: string };
      projectName = pkg.name ?? 'Project';
    }
  } catch {
    // Use default
  }

  const outputDir = options.output ?? 'docs';
  let generated = 0;

  // Default to --all if no specific option provided
  const generateAll = options.all || (!options.adr && !options.quickstart);

  if (options.adr || generateAll) {
    const template = (options.template as AdrTemplate) ?? 'introspection';
    const adrNumber = options.adrNumber ? parseInt(options.adrNumber, 10) : 1;
    
    const adrPath = writeAdr({
      projectName,
      outputDir: path.join(outputDir, 'adr'),
      adrNumber,
      template
    });
    console.log(chalk.green(`✅ ADR generated: ${path.relative(process.cwd(), adrPath)}`));
    generated++;
  }

  if (options.quickstart || generateAll) {
    const guidePath = writeQuickStartGuide(outputDir);
    console.log(chalk.green(`✅ Quick Start guide: ${path.relative(process.cwd(), guidePath)}`));
    generated++;
  }

  console.log(chalk.blue(`\n📊 Generated ${generated} documentation file(s)\n`));
  
  console.log(chalk.gray('These files explain to developers how to use the introspection system.'));
  console.log(chalk.gray('Consider adding them to your repository and linking from your main README.\n'));
}


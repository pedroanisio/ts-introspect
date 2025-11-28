/**
 * Docs Command
 *
 * Generate documentation for the introspection system.
 * AI-focused: JSON output by default.
 * Uses tslog per ADR-001
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { writeAdr, writeQuickStartGuide, type AdrTemplate } from '../../generators/adr.js';
import { stdout } from '../logger.js';
import {
  outputJson,
  success,
  isHumanFormat,
  human,
  type OutputFormat,
} from '../output.js';

interface DocsOptions {
  adr?: boolean;
  quickstart?: boolean;
  all?: boolean;
  output?: string;
  adrNumber?: string;
  template?: string;
  format?: OutputFormat;
}

// All available ADR templates
const ADR_TEMPLATES: { template: AdrTemplate; adrNumber: number }[] = [
  { template: 'introspection', adrNumber: 1 },
  { template: 'code-markers', adrNumber: 2 },
];

export async function docsCommand(options: DocsOptions): Promise<void> {
  const format = options.format ?? 'json';

  if (isHumanFormat(format)) {
    human.info('\n📚 Generating documentation...\n');
  }

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
  const generatedFiles: string[] = [];

  // Default to --all if no specific option provided
  const generateAll = options.all || (!options.adr && !options.quickstart);

  if (options.adr || generateAll) {
    // If specific template requested, generate only that one
    if (options.template) {
      const template = options.template as AdrTemplate;
      const adrNumber = options.adrNumber ? parseInt(options.adrNumber, 10) : 1;
      
      const adrPath = writeAdr({
        projectName,
        outputDir: path.join(outputDir, 'adr'),
        adrNumber,
        template
      });
      const relativePath = path.relative(process.cwd(), adrPath);
      generatedFiles.push(relativePath);
      if (isHumanFormat(format)) {
        human.success(`✅ ADR generated: ${relativePath}`);
      }
    } else {
      // Generate ALL template ADRs
      for (const { template, adrNumber } of ADR_TEMPLATES) {
        const adrPath = writeAdr({
          projectName,
          outputDir: path.join(outputDir, 'adr'),
          adrNumber,
          template
        });
        const relativePath = path.relative(process.cwd(), adrPath);
        generatedFiles.push(relativePath);
        if (isHumanFormat(format)) {
          human.success(`✅ ADR generated: ${relativePath}`);
        }
      }
    }
  }

  if (options.quickstart || generateAll) {
    const guidePath = writeQuickStartGuide(outputDir);
    const relativePath = path.relative(process.cwd(), guidePath);
    generatedFiles.push(relativePath);
    if (isHumanFormat(format)) {
      human.success(`✅ Quick Start guide: ${relativePath}`);
    }
  }

  // Output based on format
  if (format === 'json') {
    outputJson(success({
      action: 'generate_docs',
      files_generated: generatedFiles.length,
      files: generatedFiles,
      output_directory: outputDir,
    }));
  } else {
    stdout(chalk.blue(`\n📊 Generated ${generatedFiles.length} documentation file(s)\n`));
    stdout(chalk.gray('These files explain to developers how to use the introspection system.'));
    stdout(chalk.gray('Consider adding them to your repository and linking from your main README.\n'));
  }
}


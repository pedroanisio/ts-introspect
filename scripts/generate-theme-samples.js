#!/usr/bin/env node
/**
 * Generate sample reports for all available themes
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

// Dynamic imports
const { IntrospectionRegistry } = await import(path.join(rootDir, 'dist/core/registry.js'));
const { DependencyAnalyzer } = await import(path.join(rootDir, 'dist/core/analyzer.js'));
const { generateHtmlReport, generateReportData } = await import(path.join(rootDir, 'dist/generators/html-report.js'));
const { getAvailableThemes } = await import(path.join(rootDir, 'dist/generators/themes/index.js'));

// Output directory from args or default
const outputDir = process.argv[2] || path.join(rootDir, '..', '..', '..', 'temp');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log('🎨 Generating themed reports...\n');

// Source directory
const srcDir = path.join(rootDir, 'src');

// Load project metadata
const registry = new IntrospectionRegistry();
await registry.loadAll(srcDir, false);

// Analyze dependencies
const analyzer = new DependencyAnalyzer(srcDir);
await analyzer.analyze();
const graph = analyzer.getGraph();
const circularDeps = analyzer.findCircularDependencies();
const unusedModules = analyzer.getUnusedModules();

// Count total files
const allFiles = await glob('**/*.ts', {
  cwd: srcDir,
  ignore: ['**/*.d.ts', '**/*.test.ts', '**/*.spec.ts', '**/node_modules/**']
});
const totalFiles = allFiles.length;

// Generate report data
const reportData = await generateReportData(
  registry,
  'ts-introspect',
  graph ?? undefined,
  circularDeps,
  unusedModules
);

// Get available themes
const themes = getAvailableThemes();
console.log(`Available themes: ${themes.join(', ')}\n`);

// Generate report for each theme
for (const theme of themes) {
  const html = generateHtmlReport(reportData, totalFiles, { theme });
  const outputPath = path.join(outputDir, `report-${theme}.html`);
  fs.writeFileSync(outputPath, html);
  console.log(`✓ Generated: report-${theme}.html`);
}

console.log(`\n📁 Reports saved to: ${outputDir}\n`);
console.log('Open in browser:');
themes.forEach(theme => {
  console.log(`  file://${path.join(outputDir, `report-${theme}.html`)}`);
});
console.log('');

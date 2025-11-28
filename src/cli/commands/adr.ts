/**
 * ADR Command
 *
 * Manage Architecture Decision Records stored in JSONL format.
 * AI-focused: JSON output by default.
 * Uses tslog per ADR-001
 */

import fs from "fs";
import path from "path";
import chalk from "chalk";
import {
  type Adr,
  type AdrStatus,
  parseAdrJsonl,
  serializeAdrsToJsonl,
  validateAdr,
  adrToMarkdown,
  adrsToTable,
} from "../../types/adr.js";
import { stdout } from "../logger.js";
import {
  outputJson,
  success,
  outputError,
  ErrorCode,
  human,
  type OutputFormat,
} from "../output.js";

const DEFAULT_JSONL_PATH = "docs/adrs.jsonl";

interface AdrCommandOptions {
  list?: boolean;
  add?: boolean;
  show?: string;
  export?: string;
  exportAll?: boolean;
  validate?: boolean;
  table?: boolean;
  status?: string;
  file?: string;
  id?: string;
  title?: string;
  decision?: string;
  rationale?: string;
  format?: OutputFormat | 'markdown';
}

function getJsonlPath(options: AdrCommandOptions): string {
  return path.resolve(process.cwd(), options.file ?? DEFAULT_JSONL_PATH);
}

function loadAdrs(jsonlPath: string): Adr[] {
  if (!fs.existsSync(jsonlPath)) {
    return [];
  }
  const content = fs.readFileSync(jsonlPath, "utf-8");
  return parseAdrJsonl(content);
}

function saveAdrs(jsonlPath: string, adrs: Adr[]): void {
  const dir = path.dirname(jsonlPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(jsonlPath, serializeAdrsToJsonl(adrs));
}

function getNextId(adrs: Adr[]): string {
  const ids = adrs.map((a) => parseInt(a.id.replace("ADR-", ""), 10)).filter((n) => !isNaN(n));
  const max = ids.length > 0 ? Math.max(...ids) : 0;
  return `ADR-${String(max + 1).padStart(3, "0")}`;
}

export async function adrCommand(options: AdrCommandOptions): Promise<void> {
  const format = options.format ?? 'json';
  const jsonlPath = getJsonlPath(options);
  const adrs = loadAdrs(jsonlPath);

  // List ADRs
  if (options.list) {
    const filtered = options.status
      ? adrs.filter((a) => a.status === options.status)
      : adrs;

    if (format === 'json') {
      outputJson(success({
        adrs: filtered,
        count: filtered.length,
        file: path.relative(process.cwd(), jsonlPath),
      }));
      return;
    }

    if (adrs.length === 0) {
      human.warn("\nNo ADRs found.\n");
      human.dim(`Create one with: tsi adr --add --title "Title" --decision "..." --rationale "..."\n`);
      return;
    }

    human.info("\n📋 Architecture Decision Records\n");

    if (options.table || format === 'table') {
      stdout(adrsToTable(filtered));
    } else if (format === 'markdown') {
      for (const adr of filtered) {
        stdout(adrToMarkdown(adr));
        stdout('\n---\n');
      }
    } else {
      for (const adr of filtered) {
        const statusIcon = {
          proposed: chalk.yellow("📝"),
          approved: chalk.green("✅"),
          deprecated: chalk.red("⚠️"),
          superseded: chalk.gray("🔄"),
        }[adr.status];

        stdout(`${statusIcon} ${chalk.bold(adr.id)}: ${adr.title}`);
        stdout(chalk.gray(`   ${adr.decision}`));
        stdout('');
      }
    }

    stdout(chalk.gray(`\nTotal: ${filtered.length} ADR(s) in ${path.relative(process.cwd(), jsonlPath)}\n`));
    return;
  }

  // Show specific ADR
  if (options.show) {
    const adr = adrs.find((a) => a.id === options.show);
    if (!adr) {
      if (format === 'json') {
        outputError(ErrorCode.NOT_FOUND, `ADR ${options.show} not found`, 404);
      }
      human.error(`\n❌ ADR ${options.show} not found.\n`);
      return;
    }

    if (format === 'json') {
      outputJson(success(adr));
      return;
    }

    if (format === 'markdown') {
      stdout(adrToMarkdown(adr));
      return;
    }

    human.info(`\n📄 ${adr.id}: ${adr.title}\n`);
    stdout(adrToMarkdown(adr));
    return;
  }

  // Export single ADR to markdown
  if (options.export) {
    const adr = adrs.find((a) => a.id === options.export);
    if (!adr) {
      if (format === 'json') {
        outputError(ErrorCode.NOT_FOUND, `ADR ${options.export} not found`, 404);
      }
      human.error(`\n❌ ADR ${options.export} not found.\n`);
      return;
    }

    const filename = `${adr.id}-${adr.title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}.md`;
    const outputPath = path.resolve(process.cwd(), "docs/adr", filename);
    const dir = path.dirname(outputPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, adrToMarkdown(adr));
    
    if (format === 'json') {
      outputJson(success({
        action: 'export',
        adr_id: adr.id,
        exported_to: path.relative(process.cwd(), outputPath),
      }));
    } else {
      human.success(`\n✅ Exported: ${path.relative(process.cwd(), outputPath)}\n`);
    }
    return;
  }

  // Export all ADRs to markdown
  if (options.exportAll) {
    const outputDir = path.resolve(process.cwd(), "docs/adr");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const exportedFiles: string[] = [];
    for (const adr of adrs) {
      const filename = `${adr.id}-${adr.title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}.md`;
      const outputPath = path.join(outputDir, filename);
      fs.writeFileSync(outputPath, adrToMarkdown(adr));
      exportedFiles.push(path.relative(process.cwd(), outputPath));
    }

    if (format === 'json') {
      outputJson(success({
        action: 'export_all',
        count: exportedFiles.length,
        exported_to: path.relative(process.cwd(), outputDir),
        files: exportedFiles,
      }));
    } else {
      human.success(`\n✅ Exported ${exportedFiles.length} ADR(s) to ${path.relative(process.cwd(), outputDir)}/\n`);
    }
    return;
  }

  // Validate ADRs
  if (options.validate) {
    const validationResults: { id: string; title: string; errors: { field: string; message: string }[] }[] = [];
    
    for (const adr of adrs) {
      const errors = validateAdr(adr);
      if (errors.length > 0) {
        validationResults.push({
          id: adr.id,
          title: adr.title,
          errors,
        });
      }
    }

    if (format === 'json') {
      outputJson(success({
        action: 'validate',
        total_adrs: adrs.length,
        valid: validationResults.length === 0,
        errors_count: validationResults.length,
        validation_errors: validationResults,
      }));
      return;
    }

    human.info("\n🔍 Validating ADRs...\n");
    
    if (validationResults.length === 0) {
      human.success(`✅ All ${adrs.length} ADR(s) are valid.\n`);
    } else {
      for (const result of validationResults) {
        human.error(`❌ ${result.id}: ${result.title}`);
        for (const err of result.errors) {
          stdout(chalk.red(`   - ${err.field}: ${err.message}`));
        }
        stdout('');
      }
    }
    return;
  }

  // Add new ADR
  if (options.add) {
    if (!options.title || !options.decision || !options.rationale) {
      if (format === 'json') {
        outputError(
          ErrorCode.VALIDATION_ERROR,
          "Missing required fields: title, decision, rationale",
          400,
          { required: ['title', 'decision', 'rationale'] }
        );
      }
      human.error("\n❌ Missing required fields.\n");
      human.dim("Usage: tsi adr --add --title \"Title\" --decision \"...\" --rationale \"...\"\n");
      human.dim("Optional: --status <proposed|approved> --id <ADR-NNN>\n");
      return;
    }

    const today = new Date().toISOString().split("T")[0]!;
    const newAdr: Adr = {
      id: options.id ?? getNextId(adrs),
      title: options.title,
      status: (options.status as AdrStatus) ?? "proposed",
      decision: options.decision,
      rationale: options.rationale,
      createdAt: today,
      updatedAt: today,
    };

    const errors = validateAdr(newAdr);
    if (errors.length > 0) {
      if (format === 'json') {
        outputError(
          ErrorCode.VALIDATION_ERROR,
          "ADR validation failed",
          400,
          { validation_errors: errors }
        );
      }
      human.error("\n❌ Validation errors:\n");
      for (const err of errors) {
        stdout(chalk.red(`   - ${err.field}: ${err.message}`));
      }
      return;
    }

    adrs.push(newAdr);
    saveAdrs(jsonlPath, adrs);

    if (format === 'json') {
      outputJson(success({
        action: 'add',
        adr: newAdr,
        saved_to: path.relative(process.cwd(), jsonlPath),
      }));
    } else {
      human.success(`\n✅ Added ${newAdr.id}: ${newAdr.title}\n`);
      human.dim(`   Saved to: ${path.relative(process.cwd(), jsonlPath)}\n`);
    }
    return;
  }

  // Default: show help or list in JSON format
  if (format === 'json') {
    outputJson(success({
      adrs: adrs,
      count: adrs.length,
      file: path.relative(process.cwd(), jsonlPath),
    }));
    return;
  }

  human.info("\n📋 ADR Management Commands\n");
  stdout("  tsi adr --list                      List all ADRs");
  stdout("  tsi adr --list --format=table       List as markdown table");
  stdout("  tsi adr --list --status approved    Filter by status");
  stdout("  tsi adr --show ADR-001              Show specific ADR");
  stdout("  tsi adr --validate                  Validate all ADRs");
  stdout("  tsi adr --export ADR-001            Export ADR to markdown");
  stdout("  tsi adr --export-all                Export all ADRs to markdown");
  stdout("  tsi adr --add --title \"...\" --decision \"...\" --rationale \"...\"");
  stdout('');
  stdout(chalk.gray(`  ADR storage: ${path.relative(process.cwd(), jsonlPath)}\n`));
}

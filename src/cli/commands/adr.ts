/**
 * ADR Command
 *
 * Manage Architecture Decision Records stored in JSONL format
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
  const jsonlPath = getJsonlPath(options);
  const adrs = loadAdrs(jsonlPath);

  // List ADRs
  if (options.list) {
    if (adrs.length === 0) {
      console.log(chalk.yellow("\nNo ADRs found.\n"));
      console.log(chalk.gray(`Create one with: tsi adr --add --title "Title" --decision "..." --rationale "..."\n`));
      return;
    }

    console.log(chalk.blue("\n📋 Architecture Decision Records\n"));

    const filtered = options.status
      ? adrs.filter((a) => a.status === options.status)
      : adrs;

    if (options.table) {
      console.log(adrsToTable(filtered));
    } else {
      for (const adr of filtered) {
        const statusIcon = {
          proposed: chalk.yellow("📝"),
          approved: chalk.green("✅"),
          deprecated: chalk.red("⚠️"),
          superseded: chalk.gray("🔄"),
        }[adr.status];

        console.log(`${statusIcon} ${chalk.bold(adr.id)}: ${adr.title}`);
        console.log(chalk.gray(`   ${adr.decision}`));
        console.log();
      }
    }

    console.log(chalk.gray(`\nTotal: ${filtered.length} ADR(s) in ${path.relative(process.cwd(), jsonlPath)}\n`));
    return;
  }

  // Show specific ADR
  if (options.show) {
    const adr = adrs.find((a) => a.id === options.show);
    if (!adr) {
      console.log(chalk.red(`\n❌ ADR ${options.show} not found.\n`));
      return;
    }

    console.log(chalk.blue(`\n📄 ${adr.id}: ${adr.title}\n`));
    console.log(adrToMarkdown(adr));
    return;
  }

  // Export single ADR to markdown
  if (options.export) {
    const adr = adrs.find((a) => a.id === options.export);
    if (!adr) {
      console.log(chalk.red(`\n❌ ADR ${options.export} not found.\n`));
      return;
    }

    const filename = `${adr.id}-${adr.title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}.md`;
    const outputPath = path.resolve(process.cwd(), "docs/adr", filename);
    const dir = path.dirname(outputPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, adrToMarkdown(adr));
    console.log(chalk.green(`\n✅ Exported: ${path.relative(process.cwd(), outputPath)}\n`));
    return;
  }

  // Export all ADRs to markdown
  if (options.exportAll) {
    const outputDir = path.resolve(process.cwd(), "docs/adr");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    let count = 0;
    for (const adr of adrs) {
      const filename = `${adr.id}-${adr.title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}.md`;
      const outputPath = path.join(outputDir, filename);
      fs.writeFileSync(outputPath, adrToMarkdown(adr));
      count++;
    }

    console.log(chalk.green(`\n✅ Exported ${count} ADR(s) to ${path.relative(process.cwd(), outputDir)}/\n`));
    return;
  }

  // Validate ADRs
  if (options.validate) {
    console.log(chalk.blue("\n🔍 Validating ADRs...\n"));

    let hasErrors = false;
    for (const adr of adrs) {
      const errors = validateAdr(adr);
      if (errors.length > 0) {
        hasErrors = true;
        console.log(chalk.red(`❌ ${adr.id}: ${adr.title}`));
        for (const err of errors) {
          console.log(chalk.red(`   - ${err.field}: ${err.message}`));
        }
        console.log();
      }
    }

    if (!hasErrors) {
      console.log(chalk.green(`✅ All ${adrs.length} ADR(s) are valid.\n`));
    }
    return;
  }

  // Add new ADR
  if (options.add) {
    if (!options.title || !options.decision || !options.rationale) {
      console.log(chalk.red("\n❌ Missing required fields.\n"));
      console.log(chalk.gray("Usage: tsi adr --add --title \"Title\" --decision \"...\" --rationale \"...\"\n"));
      console.log(chalk.gray("Optional: --status <proposed|approved> --id <ADR-NNN>\n"));
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
      console.log(chalk.red("\n❌ Validation errors:\n"));
      for (const err of errors) {
        console.log(chalk.red(`   - ${err.field}: ${err.message}`));
      }
      return;
    }

    adrs.push(newAdr);
    saveAdrs(jsonlPath, adrs);

    console.log(chalk.green(`\n✅ Added ${newAdr.id}: ${newAdr.title}\n`));
    console.log(chalk.gray(`   Saved to: ${path.relative(process.cwd(), jsonlPath)}\n`));
    return;
  }

  // Default: show help
  console.log(chalk.blue("\n📋 ADR Management Commands\n"));
  console.log("  tsi adr --list                      List all ADRs");
  console.log("  tsi adr --list --table              List as markdown table");
  console.log("  tsi adr --list --status approved    Filter by status");
  console.log("  tsi adr --show ADR-001              Show specific ADR");
  console.log("  tsi adr --validate                  Validate all ADRs");
  console.log("  tsi adr --export ADR-001            Export ADR to markdown");
  console.log("  tsi adr --export-all                Export all ADRs to markdown");
  console.log("  tsi adr --add --title \"...\" --decision \"...\" --rationale \"...\"");
  console.log();
  console.log(chalk.gray(`  ADR storage: ${path.relative(process.cwd(), jsonlPath)}\n`));
}


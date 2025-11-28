/**
 * ts-introspect - Architecture Decision Record Types
 *
 * Structured ADR format stored as JSONL for queryability
 */

// ============================================
// ADR Status
// ============================================

export type AdrStatus = "proposed" | "approved" | "deprecated" | "superseded";

// ============================================
// Core ADR Interface
// ============================================

export interface Adr {
  id: string;
  title: string;
  status: AdrStatus;
  decision: string;
  rationale: string;
  createdAt: string;
  updatedAt: string;
  supersededBy?: string;
  tags?: string[];
  context?: string;
  consequences?: {
    positive?: string[];
    negative?: string[];
  };
}

// ============================================
// JSONL Parsing/Serialization
// ============================================

export function parseAdrLine(line: string): Adr {
  return JSON.parse(line) as Adr;
}

export function serializeAdr(adr: Adr): string {
  return JSON.stringify(adr);
}

export function parseAdrJsonl(content: string): Adr[] {
  return content
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map(parseAdrLine);
}

export function serializeAdrsToJsonl(adrs: Adr[]): string {
  return adrs.map(serializeAdr).join("\n") + "\n";
}

// ============================================
// ADR Validation
// ============================================

export interface AdrValidationError {
  field: string;
  message: string;
}

export function validateAdr(adr: Partial<Adr>): AdrValidationError[] {
  const errors: AdrValidationError[] = [];

  if (!adr.id || !/^ADR-\d{3,4}$/.test(adr.id)) {
    errors.push({ field: "id", message: "ID must match pattern ADR-NNN or ADR-NNNN" });
  }

  if (!adr.title || adr.title.trim().length === 0) {
    errors.push({ field: "title", message: "Title is required" });
  }

  if (!adr.status || !["proposed", "approved", "deprecated", "superseded"].includes(adr.status)) {
    errors.push({ field: "status", message: "Status must be: proposed, approved, deprecated, or superseded" });
  }

  if (!adr.decision || adr.decision.trim().length === 0) {
    errors.push({ field: "decision", message: "Decision is required" });
  }

  if (!adr.rationale || adr.rationale.trim().length === 0) {
    errors.push({ field: "rationale", message: "Rationale is required" });
  }

  if (!adr.createdAt || !/^\d{4}-\d{2}-\d{2}$/.test(adr.createdAt)) {
    errors.push({ field: "createdAt", message: "createdAt must be YYYY-MM-DD format" });
  }

  if (!adr.updatedAt || !/^\d{4}-\d{2}-\d{2}$/.test(adr.updatedAt)) {
    errors.push({ field: "updatedAt", message: "updatedAt must be YYYY-MM-DD format" });
  }

  if (adr.status === "superseded" && !adr.supersededBy) {
    errors.push({ field: "supersededBy", message: "supersededBy is required when status is superseded" });
  }

  return errors;
}

// ============================================
// Markdown Generation
// ============================================

export function adrToMarkdown(adr: Adr): string {
  const lines: string[] = [
    `# ${adr.id}: ${adr.title}`,
    "",
    "## Status",
    "",
    `**${adr.status.charAt(0).toUpperCase() + adr.status.slice(1)}** — ${adr.updatedAt}`,
    "",
  ];

  if (adr.context) {
    lines.push("## Context", "", adr.context, "");
  }

  lines.push("## Decision", "", adr.decision, "");
  lines.push("## Rationale", "", adr.rationale, "");

  if (adr.consequences) {
    lines.push("## Consequences", "");
    if (adr.consequences.positive?.length) {
      lines.push("### Positive", "");
      adr.consequences.positive.forEach((c) => lines.push(`- ${c}`));
      lines.push("");
    }
    if (adr.consequences.negative?.length) {
      lines.push("### Negative", "");
      adr.consequences.negative.forEach((c) => lines.push(`- ${c}`));
      lines.push("");
    }
  }

  if (adr.supersededBy) {
    lines.push("## Superseded By", "", `This ADR has been superseded by ${adr.supersededBy}.`, "");
  }

  if (adr.tags?.length) {
    lines.push("---", "", `**Tags:** ${adr.tags.join(", ")}`, "");
  }

  return lines.join("\n");
}

// ============================================
// Table Generation
// ============================================

export function adrsToTable(adrs: Adr[]): string {
  const lines: string[] = [
    "| ID | Title | Status | Decision |",
    "|-----|-------|--------|----------|",
  ];

  for (const adr of adrs) {
    const statusIcon = {
      proposed: "📝",
      approved: "✅",
      deprecated: "⚠️",
      superseded: "🔄",
    }[adr.status];

    lines.push(`| ${adr.id} | ${adr.title} | ${statusIcon} ${adr.status} | ${adr.decision} |`);
  }

  return lines.join("\n");
}




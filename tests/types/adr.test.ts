import { describe, it, expect } from 'vitest';
import {
  parseAdrLine,
  serializeAdr,
  parseAdrJsonl,
  serializeAdrsToJsonl,
  validateAdr,
  adrToMarkdown,
  adrsToTable,
  type Adr
} from '../../src/types/adr.js';

describe('ADR Types', () => {
  const validAdr: Adr = {
    id: 'ADR-001',
    title: 'Use TypeScript',
    status: 'approved',
    decision: 'We will use TypeScript for all new code',
    rationale: 'Type safety improves maintainability',
    createdAt: '2025-01-01',
    updatedAt: '2025-01-15'
  };

  describe('parseAdrLine', () => {
    it('should parse a valid JSON line to Adr', () => {
      const json = JSON.stringify(validAdr);
      const result = parseAdrLine(json);
      expect(result).toEqual(validAdr);
    });

    it('should preserve optional fields', () => {
      const adrWithOptional: Adr = {
        ...validAdr,
        tags: ['typescript', 'architecture'],
        context: 'We need better type safety',
        consequences: {
          positive: ['Better IDE support'],
          negative: ['Learning curve']
        }
      };
      const json = JSON.stringify(adrWithOptional);
      const result = parseAdrLine(json);
      expect(result.tags).toEqual(['typescript', 'architecture']);
      expect(result.context).toBe('We need better type safety');
      expect(result.consequences?.positive).toContain('Better IDE support');
    });
  });

  describe('serializeAdr', () => {
    it('should serialize Adr to JSON string', () => {
      const result = serializeAdr(validAdr);
      expect(JSON.parse(result)).toEqual(validAdr);
    });

    it('should produce single-line JSON', () => {
      const result = serializeAdr(validAdr);
      expect(result).not.toContain('\n');
    });
  });

  describe('parseAdrJsonl', () => {
    it('should parse multiple lines', () => {
      const adr2: Adr = { ...validAdr, id: 'ADR-002', title: 'Use ESM' };
      const content = `${JSON.stringify(validAdr)}\n${JSON.stringify(adr2)}`;
      const result = parseAdrJsonl(content);
      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe('ADR-001');
      expect(result[1]?.id).toBe('ADR-002');
    });

    it('should skip empty lines', () => {
      const content = `${JSON.stringify(validAdr)}\n\n\n${JSON.stringify({ ...validAdr, id: 'ADR-002' })}`;
      const result = parseAdrJsonl(content);
      expect(result).toHaveLength(2);
    });

    it('should handle single ADR', () => {
      const content = JSON.stringify(validAdr);
      const result = parseAdrJsonl(content);
      expect(result).toHaveLength(1);
    });
  });

  describe('serializeAdrsToJsonl', () => {
    it('should serialize array to JSONL format', () => {
      const adrs = [validAdr, { ...validAdr, id: 'ADR-002' }];
      const result = serializeAdrsToJsonl(adrs);
      const lines = result.trim().split('\n');
      expect(lines).toHaveLength(2);
      expect(JSON.parse(lines[0]!).id).toBe('ADR-001');
      expect(JSON.parse(lines[1]!).id).toBe('ADR-002');
    });

    it('should end with newline', () => {
      const result = serializeAdrsToJsonl([validAdr]);
      expect(result.endsWith('\n')).toBe(true);
    });
  });

  describe('validateAdr', () => {
    it('should return empty array for valid ADR', () => {
      const errors = validateAdr(validAdr);
      expect(errors).toHaveLength(0);
    });

    it('should validate ID format ADR-NNN', () => {
      const errors = validateAdr({ ...validAdr, id: 'INVALID' });
      expect(errors.some(e => e.field === 'id')).toBe(true);
    });

    it('should accept ID format ADR-NNNN', () => {
      const errors = validateAdr({ ...validAdr, id: 'ADR-1234' });
      expect(errors.some(e => e.field === 'id')).toBe(false);
    });

    it('should require title', () => {
      const errors = validateAdr({ ...validAdr, title: '' });
      expect(errors.some(e => e.field === 'title')).toBe(true);
    });

    it('should validate status enum', () => {
      const errors = validateAdr({ ...validAdr, status: 'invalid' as Adr['status'] });
      expect(errors.some(e => e.field === 'status')).toBe(true);
    });

    it('should require decision', () => {
      const errors = validateAdr({ ...validAdr, decision: '' });
      expect(errors.some(e => e.field === 'decision')).toBe(true);
    });

    it('should require rationale', () => {
      const errors = validateAdr({ ...validAdr, rationale: '' });
      expect(errors.some(e => e.field === 'rationale')).toBe(true);
    });

    it('should validate date format for createdAt', () => {
      const errors = validateAdr({ ...validAdr, createdAt: 'Jan 1 2025' });
      expect(errors.some(e => e.field === 'createdAt')).toBe(true);
    });

    it('should validate date format for updatedAt', () => {
      const errors = validateAdr({ ...validAdr, updatedAt: '2025/01/15' });
      expect(errors.some(e => e.field === 'updatedAt')).toBe(true);
    });

    it('should require supersededBy when status is superseded', () => {
      const errors = validateAdr({ ...validAdr, status: 'superseded' });
      expect(errors.some(e => e.field === 'supersededBy')).toBe(true);
    });

    it('should accept superseded status with supersededBy', () => {
      const errors = validateAdr({ ...validAdr, status: 'superseded', supersededBy: 'ADR-002' });
      expect(errors.some(e => e.field === 'supersededBy')).toBe(false);
    });
  });

  describe('adrToMarkdown', () => {
    it('should generate markdown with title', () => {
      const md = adrToMarkdown(validAdr);
      expect(md).toContain('# ADR-001: Use TypeScript');
    });

    it('should include status section', () => {
      const md = adrToMarkdown(validAdr);
      expect(md).toContain('## Status');
      expect(md).toContain('**Approved**');
    });

    it('should include decision section', () => {
      const md = adrToMarkdown(validAdr);
      expect(md).toContain('## Decision');
      expect(md).toContain('We will use TypeScript');
    });

    it('should include rationale section', () => {
      const md = adrToMarkdown(validAdr);
      expect(md).toContain('## Rationale');
      expect(md).toContain('Type safety');
    });

    it('should include context if present', () => {
      const adr = { ...validAdr, context: 'Legacy codebase needs modernization' };
      const md = adrToMarkdown(adr);
      expect(md).toContain('## Context');
      expect(md).toContain('Legacy codebase');
    });

    it('should include consequences if present', () => {
      const adr: Adr = {
        ...validAdr,
        consequences: {
          positive: ['Better tooling'],
          negative: ['Migration effort']
        }
      };
      const md = adrToMarkdown(adr);
      expect(md).toContain('## Consequences');
      expect(md).toContain('### Positive');
      expect(md).toContain('- Better tooling');
      expect(md).toContain('### Negative');
      expect(md).toContain('- Migration effort');
    });

    it('should include supersededBy notice', () => {
      const adr = { ...validAdr, status: 'superseded' as const, supersededBy: 'ADR-002' };
      const md = adrToMarkdown(adr);
      expect(md).toContain('## Superseded By');
      expect(md).toContain('ADR-002');
    });

    it('should include tags if present', () => {
      const adr = { ...validAdr, tags: ['typescript', 'tooling'] };
      const md = adrToMarkdown(adr);
      expect(md).toContain('**Tags:**');
      expect(md).toContain('typescript, tooling');
    });
  });

  describe('adrsToTable', () => {
    it('should generate markdown table', () => {
      const table = adrsToTable([validAdr]);
      expect(table).toContain('| ID | Title | Status | Decision |');
      expect(table).toContain('|-----|-------|--------|----------|');
    });

    it('should include ADR rows', () => {
      const table = adrsToTable([validAdr]);
      expect(table).toContain('| ADR-001 |');
      expect(table).toContain('Use TypeScript');
    });

    it('should show status icons', () => {
      const adrs: Adr[] = [
        { ...validAdr, status: 'proposed' },
        { ...validAdr, id: 'ADR-002', status: 'approved' },
        { ...validAdr, id: 'ADR-003', status: 'deprecated' },
        { ...validAdr, id: 'ADR-004', status: 'superseded', supersededBy: 'ADR-005' }
      ];
      const table = adrsToTable(adrs);
      expect(table).toContain('📝 proposed');
      expect(table).toContain('✅ approved');
      expect(table).toContain('⚠️ deprecated');
      expect(table).toContain('🔄 superseded');
    });

    it('should handle multiple ADRs', () => {
      const adrs = [
        validAdr,
        { ...validAdr, id: 'ADR-002', title: 'Use ESM' }
      ];
      const table = adrsToTable(adrs);
      const lines = table.split('\n');
      expect(lines).toHaveLength(4); // header + separator + 2 rows
    });
  });
});


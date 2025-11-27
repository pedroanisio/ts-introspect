/**
 * Content Hash Utilities
 *
 * Generates and extracts content hashes for change detection
 */

import crypto from 'crypto';
import fs from 'fs';

/**
 * Generate hash of file content excluding the __metadata block
 * This ensures only actual code changes trigger validation
 */
export function generateContentHash(filepath: string): string {
  const content = fs.readFileSync(filepath, 'utf-8');
  return generateContentHashFromString(content);
}

/**
 * Generate hash from content string
 */
export function generateContentHashFromString(content: string): string {
  // Remove the __metadata export block for hashing
  // Supports both formats:
  //   - `export const __metadata = { ... };`
  //   - `export const __metadata = { ... } as const;`
  const codeOnly = content
    // Format 1: With header comments (FILE INTROSPECTION or FILE INTROSPECTION METADATA)
    .replace(
      /\/\/ =+\s*\n\/\/ FILE INTROSPECTION(?:\s+METADATA)?\s*\n\/\/ =+\s*\nexport const __metadata[\s\S]*?\n\}(?:\s*as\s+const)?;/m,
      ''
    )
    // Format 2: Without header comments
    .replace(
      /export const __metadata[^=]*=\s*\{[\s\S]*?\n\}(?:\s*as\s+const)?;/m,
      ''
    );

  return crypto
    .createHash('sha256')
    .update(codeOnly.trim())
    .digest('hex')
    .substring(0, 16); // Short hash is sufficient
}

/**
 * Extract current hash from file's metadata
 */
export function extractStoredHash(filepath: string): string | null {
  const content = fs.readFileSync(filepath, 'utf-8');
  return extractStoredHashFromString(content);
}

/**
 * Extract hash from content string
 */
export function extractStoredHashFromString(content: string): string | null {
  const match = /contentHash:\s*['"]([a-f0-9]+)['"]/.exec(content);
  return match?.[1] ?? null;
}

/**
 * Check if file content has changed since last validation
 */
export function hasContentChanged(filepath: string): boolean {
  const storedHash = extractStoredHash(filepath);
  if (!storedHash) {return true;} // No stored hash means needs validation

  const currentHash = generateContentHash(filepath);
  return storedHash !== currentHash;
}

/**
 * Get hash info for a file
 */
export interface HashInfo {
  filepath: string;
  currentHash: string;
  storedHash: string | null;
  changed: boolean;
}

export function getHashInfo(filepath: string): HashInfo {
  const currentHash = generateContentHash(filepath);
  const storedHash = extractStoredHash(filepath);

  return {
    filepath,
    currentHash,
    storedHash,
    changed: storedHash !== currentHash
  };
}


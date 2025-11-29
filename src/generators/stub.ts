/**
 * Metadata Stub Generator
 *
 * Generates metadata stubs for TypeScript files
 */

import path from 'path';
import { generateContentHashFromString } from '../core/hasher.js';
import { analyzeExports, analyzeDependencies } from '../core/analyzer.js';
import type { FileMetadata } from '../types/metadata.js';

export interface StubOptions {
  filepath: string;
  content: string;
  srcDir: string;
  author?: string;
}

/**
 * Generate a metadata stub for a file
 */
export function generateMetadataStub(options: StubOptions): string {
  const { filepath, content, srcDir, author = 'TODO' } = options;

  const filename = path.basename(filepath);
  const relativePath = path.relative(srcDir, filepath).replace(/\.ts$/, '');
  const hash = generateContentHashFromString(content);
  const today = new Date().toISOString().split('T')[0];

  // Extract exports using TypeScript Compiler API
  const exportInfos = analyzeExports(filepath, content);
  const exports = exportInfos
    .filter(e => e.name !== '__metadata')
    .map(e => e.name);

  // Extract dependencies using TypeScript Compiler API
  const deps = analyzeDependencies(filepath, srcDir, content);

  return `
// ============================================
// FILE INTROSPECTION
// ============================================
/** @internal Metadata for tooling - not imported by application code */
export const __metadata: FileMetadata = {
  module: '${relativePath}',
  filename: '${filename}',

  description: 'TODO: Add description',
  responsibilities: [
    'TODO: List responsibilities'
  ],
  exports: [${exports.map(e => `'${e}'`).join(', ')}],

  dependencies: {
    internal: [${deps.internal.map(d => `'${d}'`).join(', ')}],
    external: [${deps.external.map(d => `'${d}'`).join(', ')}]
  },

  status: 'stable',

  createdAt: '${today}',
  updatedAt: '${today}',

  changelog: [
    {
      version: '1.0.0',
      date: '${today}',
      author: '${author}',
      changes: ['Initial implementation']
    }
  ],

  todos: [],
  fixes: [],

  _meta: {
    contentHash: '${hash}',
    lastValidated: '${today}',
    generatedDeps: [${deps.internal.map(d => `'${d}'`).join(', ')}]
  }
};
`;
}

/**
 * Generate a complete FileMetadata object
 */
export function generateMetadataObject(options: StubOptions): FileMetadata {
  const { filepath, content, srcDir, author = 'unknown' } = options;

  const filename = path.basename(filepath);
  const relativePath = path.relative(srcDir, filepath).replace(/\.ts$/, '');
  const hash = generateContentHashFromString(content);
  const today = new Date().toISOString().split('T')[0]!;

  // Extract exports using TypeScript Compiler API
  const exportInfos = analyzeExports(filepath, content);
  const exports = exportInfos
    .filter(e => e.name !== '__metadata')
    .map(e => e.name);

  // Extract dependencies using TypeScript Compiler API
  const deps = analyzeDependencies(filepath, srcDir, content);

  return {
    module: relativePath,
    filename,
    description: 'TODO: Add description',
    responsibilities: ['TODO: List responsibilities'],
    exports,
    dependencies: {
      internal: deps.internal,
      external: deps.external,
      types: deps.types
    },
    status: 'stable',
    createdAt: today,
    updatedAt: today,
    changelog: [
      {
        version: '1.0.0',
        date: today,
        author,
        changes: ['Initial implementation']
      }
    ],
    todos: [],
    fixes: [],
    _meta: {
      contentHash: hash,
      lastValidated: today,
      generatedDeps: deps.internal
    }
  };
}



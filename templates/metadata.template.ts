/**
 * Metadata Template
 *
 * Copy this template to your TypeScript files and fill in the details
 */

import type { FileMetadata } from 'ts-introspect/types';

// ============================================
// FILE INTROSPECTION
// ============================================
/** @internal Metadata for tooling - not imported by application code */
export const __metadata: FileMetadata = {
  // Identity
  module: '{{MODULE_PATH}}',
  filename: '{{FILENAME}}',

  // Documentation
  description: '{{DESCRIPTION}}',
  responsibilities: [
    '{{RESPONSIBILITY_1}}',
    '{{RESPONSIBILITY_2}}'
  ],
  exports: ['{{EXPORT_1}}', '{{EXPORT_2}}'],

  // Dependencies
  dependencies: {
    internal: ['{{INTERNAL_DEP_1}}'],
    external: ['{{EXTERNAL_DEP_1}}']
  },

  // Status: 'stable' | 'beta' | 'experimental' | 'deprecated'
  status: 'stable',

  // Timestamps (YYYY-MM-DD format)
  createdAt: '{{CREATED_DATE}}',
  updatedAt: '{{UPDATED_DATE}}',

  // Changelog
  changelog: [
    {
      version: '1.0.0',
      date: '{{CREATED_DATE}}',
      author: '{{AUTHOR}}',
      changes: ['Initial implementation']
    }
  ],

  // Issue tracking
  todos: [
    // {
    //   id: 'TODO-001',
    //   description: 'Example TODO item',
    //   priority: 'medium', // 'critical' | 'high' | 'medium' | 'low'
    //   status: 'pending',  // 'pending' | 'in-progress' | 'blocked' | 'done'
    //   createdAt: '{{CREATED_DATE}}'
    // }
  ],

  fixes: [
    // {
    //   id: 'FIX-001',
    //   description: 'Example fix item',
    //   severity: 'minor',      // 'critical' | 'major' | 'minor' | 'trivial'
    //   status: 'open',         // 'open' | 'investigating' | 'fixed'
    //   createdAt: '{{CREATED_DATE}}'
    // }
  ],

  // Optional fields
  // notes: 'Additional notes about this module',
  // seeAlso: ['related/module', 'another/module'],
  // tags: ['api', 'core', 'utils'],

  // Internal (auto-managed by ts-introspect)
  _meta: {
    contentHash: '{{CONTENT_HASH}}',
    lastValidated: '{{UPDATED_DATE}}',
    generatedDeps: []
  }
};


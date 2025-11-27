/**
 * ESLint Plugin: ts-introspect
 *
 * Custom rules for enforcing metadata in TypeScript files
 *
 * Usage in eslint.config.js:
 *   import introspectPlugin from 'ts-introspect/eslint';
 *
 *   export default [
 *     {
 *       plugins: { introspect: introspectPlugin },
 *       rules: {
 *         'introspect/require-metadata': 'error'
 *       }
 *     }
 *   ];
 */

import type { Rule } from 'eslint';
import path from 'path';
import { DEFAULT_EXCLUDE_PATTERNS } from '../types/config.js';

// ============================================
// AST Node Types (simplified)
// ============================================

interface VariableDeclarator {
  id: { type: string; name: string };
  init?: {
    type: string;
    properties: {
      type: string;
      key: { type: string; name: string };
    }[];
  };
}

interface ExportNamedDeclarationNode {
  declaration?: {
    type: string;
    declarations: VariableDeclarator[];
  };
}

// ============================================
// Rule: require-metadata
// ============================================

const requireMetadataRule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require __metadata export in TypeScript files',
      recommended: true
    },
    messages: {
      missingMetadata: 'File must export __metadata object for introspection'
    },
    schema: [
      {
        type: 'object',
        properties: {
          exclude: {
            type: 'array',
            items: { type: 'string' }
          }
        },
        additionalProperties: false
      }
    ]
  },
  create(context: Rule.RuleContext): Rule.RuleListener {
    let hasMetadataExport = false;

    // Get exclude patterns from options or use defaults
    const options = context.options[0] as { exclude?: string[] } | undefined;
    const excludePatterns = options?.exclude ?? DEFAULT_EXCLUDE_PATTERNS;

    return {
      ExportNamedDeclaration(node): void {
        const exportNode = node as unknown as ExportNamedDeclarationNode;

        if (exportNode.declaration?.type === 'VariableDeclaration') {
          for (const decl of exportNode.declaration.declarations) {
            if (decl.id.type === 'Identifier' && decl.id.name === '__metadata') {
              hasMetadataExport = true;
            }
          }
        }
      },
      'Program:exit'(): void {
        const filename = context.filename;

        // Check if file should be excluded
        if (shouldExclude(filename, excludePatterns)) {
          return;
        }

        if (!hasMetadataExport) {
          context.report({
            loc: { line: 1, column: 0 },
            messageId: 'missingMetadata'
          });
        }
      }
    };
  }
};

// ============================================
// Rule: valid-metadata
// ============================================

const validMetadataRule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Validate __metadata export has required fields',
      recommended: true
    },
    messages: {
      invalidMetadata: 'Invalid __metadata: {{ message }}'
    },
    schema: [
      {
        type: 'object',
        properties: {
          requiredFields: {
            type: 'array',
            items: { type: 'string' }
          }
        },
        additionalProperties: false
      }
    ]
  },
  create(context: Rule.RuleContext): Rule.RuleListener {
    const options = context.options[0] as { requiredFields?: string[] } | undefined;
    const requiredFields = options?.requiredFields ?? [
      'module',
      'filename',
      'description',
      'status',
      'updatedAt'
    ];

    return {
      ExportNamedDeclaration(node): void {
        const exportNode = node as unknown as ExportNamedDeclarationNode;

        if (exportNode.declaration?.type !== 'VariableDeclaration') {return;}

        for (const decl of exportNode.declaration.declarations) {
          if (decl.id.type !== 'Identifier' || decl.id.name !== '__metadata') {continue;}

          // Check if init is an object expression (may be wrapped in TSAsExpression for `as const`)
          let objectExpr = decl.init as {
            type: string;
            expression?: { type: string; properties: { type: string; key: { type: string; name: string } }[] };
            properties: { type: string; key: { type: string; name: string } }[];
          } | undefined;
          
          // Handle `as const` cast: TSAsExpression wraps the ObjectExpression
          if (objectExpr?.type === 'TSAsExpression' && objectExpr.expression) {
            objectExpr = objectExpr.expression as typeof objectExpr;
          }
          
          if (objectExpr?.type !== 'ObjectExpression') {
            context.report({
              loc: { line: 1, column: 0 },
              messageId: 'invalidMetadata',
              data: { message: '__metadata must be an object literal' }
            });
            return;
          }

          // Get all property names
          const propertyNames = new Set<string>();
          for (const prop of objectExpr.properties) {
            if (prop.type === 'Property' && prop.key.type === 'Identifier') {
              propertyNames.add(prop.key.name);
            }
          }

          // Check for missing required fields
          const missing = requiredFields.filter(f => !propertyNames.has(f));
          if (missing.length > 0) {
            context.report({
              loc: { line: 1, column: 0 },
              messageId: 'invalidMetadata',
              data: { message: `Missing required fields: ${missing.join(', ')}` }
            });
          }
        }
      }
    };
  }
};

// ============================================
// Helper Functions
// ============================================

function shouldExclude(filename: string, patterns: string[]): boolean {
  const normalizedPath = filename.replace(/\\/g, '/');
  const basename = path.basename(normalizedPath);

  for (const pattern of patterns) {
    // Simple pattern matching
    const normalizedPattern = pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*');
    const regex = new RegExp(normalizedPattern);

    if (regex.test(normalizedPath) || regex.test(basename)) {
      return true;
    }
  }

  return false;
}

// ============================================
// Plugin Export
// ============================================

const plugin = {
  rules: {
    'require-metadata': requireMetadataRule,
    'valid-metadata': validMetadataRule
  },
  configs: {
    recommended: {
      rules: {
        'ts-introspect/require-metadata': 'error' as const,
        'ts-introspect/valid-metadata': 'warn' as const
      }
    }
  }
};

export default plugin;
export { requireMetadataRule, validMetadataRule };

/**
 * Introspection Registry
 *
 * Collects and queries metadata from all modules at runtime
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import ts from 'typescript';
import type {
  FileMetadata,
  IndexMetadata,
  TodoItem,
  FixItem,
  ModuleStatus
} from '../types/metadata.js';
import { isFullMetadata } from '../types/metadata.js';
import { logger } from '../cli/logger.js';

// ============================================
// Types
// ============================================

export type RegisteredMetadata = FileMetadata | IndexMetadata;

export interface TodoWithModule extends TodoItem {
  module: string;
}

export interface FixWithModule extends FixItem {
  module: string;
}

export interface RegistrySummary {
  totalModules: number;
  todoCount: number;
  fixCount: number;
  statusBreakdown: Record<ModuleStatus, number>;
  recentlyUpdated: number;
}

// ============================================
// Registry Class
// ============================================

export class IntrospectionRegistry {
  private static instance: IntrospectionRegistry | null = null;
  private modules = new Map<string, RegisteredMetadata>();
  private loaded = false;
  private verbose = false;
  private errors: { file: string; error: string }[] = [];

  /**
   * Get singleton instance
   */
  static getInstance(): IntrospectionRegistry {
    this.instance ??= new IntrospectionRegistry();
    return this.instance;
  }

  /**
   * Reset singleton (for testing)
   */
  static reset(): void {
    this.instance = null;
  }

  /**
   * Register a module's metadata
   */
  register(metadata: RegisteredMetadata): void {
    this.modules.set(metadata.module, metadata);
  }

  /**
   * Load all metadata from source directory
   */
  async loadAll(srcDir: string, verbose = false): Promise<void> {
    this.verbose = verbose;
    this.errors = [];

    if (!fs.existsSync(srcDir)) {
      const error = `Source directory does not exist: ${srcDir}`;
      this.errors.push({ file: srcDir, error });
      if (verbose) {logger.error(error);}
      return;
    }

    const files = await glob('**/*.ts', {
      cwd: srcDir,
      ignore: ['**/*.d.ts', '**/node_modules/**'],
      absolute: true
    });

    for (const file of files) {
      try {
        if (!fs.existsSync(file)) {
          const error = `File does not exist: ${file}`;
          this.errors.push({ file, error });
          if (verbose) {logger.warn(error);}
          continue;
        }

        const content = fs.readFileSync(file, 'utf-8');

        // Check if file has metadata
        if (!content.includes('export const __metadata')) {continue;}

        // Extract metadata using TypeScript Compiler API
        const metadata = this.extractMetadataFromContent(content, file, srcDir);
        if (metadata) {
          this.register(metadata);
        } else if (verbose) {
          logger.warn(`Could not extract metadata from: ${file}`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        this.errors.push({ file, error: errorMsg });
        if (verbose) {
          logger.error(`Error processing ${file}: ${errorMsg}`);
        }
      }
    }

    this.loaded = true;
  }

  /**
   * Get errors encountered during loading
   */
  getErrors(): { file: string; error: string }[] {
    return [...this.errors];
  }

  /**
   * Clear errors
   */
  clearErrors(): void {
    this.errors = [];
  }

  /**
   * Extract metadata from file content using TypeScript Compiler API
   */
  private extractMetadataFromContent(
    content: string,
    filepath: string,
    srcDir: string
  ): RegisteredMetadata | null {
    try {
      const sourceFile = ts.createSourceFile(
        filepath,
        content,
        ts.ScriptTarget.Latest,
        true
      );

      let metadataNode: ts.ObjectLiteralExpression | null = null;

      // Helper to unwrap `as const` assertions
      function unwrapAsConst(expr: ts.Expression): ts.Expression {
        // Handle `as const` (TSAsExpression) and type assertions
        if (ts.isAsExpression(expr)) {
          return unwrapAsConst(expr.expression);
        }
        // Handle `<Type>expr` syntax (rare but possible)
        if (ts.isTypeAssertionExpression(expr)) {
          return unwrapAsConst(expr.expression);
        }
        // Handle parenthesized expressions
        if (ts.isParenthesizedExpression(expr)) {
          return unwrapAsConst(expr.expression);
        }
        return expr;
      }

      // Find the __metadata export
      function visit(node: ts.Node) {
        if (ts.isVariableStatement(node)) {
          for (const decl of node.declarationList.declarations) {
            if (ts.isIdentifier(decl.name) && decl.name.text === '__metadata') {
              if (decl.initializer) {
                const unwrapped = unwrapAsConst(decl.initializer);
                if (ts.isObjectLiteralExpression(unwrapped)) {
                  metadataNode = unwrapped;
                  return;
                }
              }
            }
          }
        }
        ts.forEachChild(node, visit);
      }

      visit(sourceFile);

      if (!metadataNode) {
        // Fallback to path-based metadata
        const relativePath = path.relative(srcDir, filepath).replace(/\.ts$/, '');
        return {
          module: relativePath,
          filename: path.basename(filepath),
          description: 'No description',
          reexports: []
        };
      }

      // Extract properties from object literal
      // We know metadataNode is ObjectLiteralExpression from the visit function
      const props = new Map<string, ts.Expression>();
      const node: ts.ObjectLiteralExpression = metadataNode;
      for (const prop of node.properties) {
        if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
          props.set(prop.name.text, prop.initializer);
        }
      }

      const moduleName = this.extractStringValue(props.get('module')) ?? 
        path.relative(srcDir, filepath).replace(/\.ts$/, '');
      const fileName = this.extractStringValue(props.get('filename')) ?? 
        path.basename(filepath);
      const description = this.extractStringValue(props.get('description')) ?? 'No description';

      // Check if this is index metadata (has reexports)
      const reexportsProp = props.get('reexports');
      if (reexportsProp) {
        return {
          module: moduleName,
          filename: fileName,
          description,
          reexports: this.extractArrayValue(reexportsProp)
        };
      }

      // Full metadata
      const status = (this.extractStringValue(props.get('status')) as ModuleStatus) ?? 'stable';
      const createdAt = this.extractStringValue(props.get('createdAt')) ?? 
        new Date().toISOString().split('T')[0]!;
      const updatedAt = this.extractStringValue(props.get('updatedAt')) ?? 
        new Date().toISOString().split('T')[0]!;

      const dependenciesProp = props.get('dependencies');
      const dependencies = dependenciesProp && ts.isObjectLiteralExpression(dependenciesProp)
        ? {
            internal: this.extractNestedArray(dependenciesProp, 'internal'),
            external: this.extractNestedArray(dependenciesProp, 'external'),
            types: this.extractNestedArray(dependenciesProp, 'types')
          }
        : { internal: [], external: [], types: [] };

      const _metaProp = props.get('_meta');
      const _meta = _metaProp && ts.isObjectLiteralExpression(_metaProp)
        ? {
            contentHash: this.extractStringValue(this.extractProperty(_metaProp, 'contentHash')) ?? '',
            lastValidated: this.extractStringValue(this.extractProperty(_metaProp, 'lastValidated')) ?? '',
            generatedDeps: this.extractArrayValue(this.extractProperty(_metaProp, 'generatedDeps')) ?? []
          }
        : {
            contentHash: '',
            lastValidated: '',
            generatedDeps: []
          };

      return {
        module: moduleName,
        filename: fileName,
        description,
        responsibilities: this.extractArrayValue(props.get('responsibilities')) ?? [],
        exports: this.extractArrayValue(props.get('exports')) ?? [],
        dependencies,
        status,
        createdAt,
        updatedAt,
        changelog: [], // Complex structure, skip for now
        todos: this.extractTodosFromAST(props.get('todos')),
        fixes: this.extractFixesFromAST(props.get('fixes')),
        _meta
      };
    } catch (error) {
      if (this.verbose) {
        logger.warn(`Failed to parse metadata from ${filepath}: ${error instanceof Error ? error.message : String(error)}`);
      }
      // Fallback to path-based metadata
      const relativePath = path.relative(srcDir, filepath).replace(/\.ts$/, '');
      return {
        module: relativePath,
        filename: path.basename(filepath),
        description: 'No description',
        reexports: []
      };
    }
  }

  private extractStringValue(expr: ts.Expression | undefined): string | null {
    if (!expr) {return null;}
    if (ts.isStringLiteral(expr)) {return expr.text;}
    if (ts.isNoSubstitutionTemplateLiteral(expr)) {return expr.text;}
    return null;
  }

  private extractArrayValue(expr: ts.Expression | undefined): string[] {
    if (!expr || !ts.isArrayLiteralExpression(expr)) {return [];}
    
    const result: string[] = [];
    for (const element of expr.elements) {
      if (ts.isStringLiteral(element) || ts.isNoSubstitutionTemplateLiteral(element)) {
        result.push(element.text);
      }
    }
    return result;
  }

  private extractProperty(obj: ts.ObjectLiteralExpression, propName: string): ts.Expression | undefined {
    for (const prop of obj.properties) {
      if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name) && prop.name.text === propName) {
        return prop.initializer;
      }
    }
    return undefined;
  }

  private extractNestedArray(obj: ts.ObjectLiteralExpression, propName: string): string[] {
    const prop = this.extractProperty(obj, propName);
    return this.extractArrayValue(prop);
  }

  private extractTodosFromAST(expr: ts.Expression | undefined): TodoItem[] {
    if (!expr || !ts.isArrayLiteralExpression(expr)) {return [];}
    
    const todos: TodoItem[] = [];
    const today = new Date().toISOString().split('T')[0]!;

    for (const element of expr.elements) {
      if (!ts.isObjectLiteralExpression(element)) {continue;}

      const props = new Map<string, ts.Expression>();
      for (const prop of element.properties) {
        if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
          props.set(prop.name.text, prop.initializer);
        }
      }

      const id = this.extractStringValue(props.get('id'));
      if (!id) {continue;}

      todos.push({
        id,
        description: this.extractStringValue(props.get('description')) ?? 'No description',
        priority: (this.extractStringValue(props.get('priority')) as TodoItem['priority']) ?? 'medium',
        status: (this.extractStringValue(props.get('status')) as TodoItem['status']) ?? 'pending',
        createdAt: this.extractStringValue(props.get('createdAt')) ?? today
      });
    }

    return todos;
  }

  private extractFixesFromAST(expr: ts.Expression | undefined): FixItem[] {
    if (!expr || !ts.isArrayLiteralExpression(expr)) {return [];}
    
    const fixes: FixItem[] = [];
    const today = new Date().toISOString().split('T')[0]!;

    for (const element of expr.elements) {
      if (!ts.isObjectLiteralExpression(element)) {continue;}

      const props = new Map<string, ts.Expression>();
      for (const prop of element.properties) {
        if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
          props.set(prop.name.text, prop.initializer);
        }
      }

      const id = this.extractStringValue(props.get('id'));
      if (!id) {continue;}

      fixes.push({
        id,
        description: this.extractStringValue(props.get('description')) ?? 'No description',
        severity: (this.extractStringValue(props.get('severity')) as FixItem['severity']) ?? 'minor',
        status: (this.extractStringValue(props.get('status')) as FixItem['status']) ?? 'open',
        createdAt: this.extractStringValue(props.get('createdAt')) ?? today
      });
    }

    return fixes;
  }

  // ============================================
  // Query Methods
  // ============================================

  /**
   * Get metadata for a specific module
   */
  getModule(modulePath: string): RegisteredMetadata | undefined {
    return this.modules.get(modulePath);
  }

  /**
   * Get all registered modules
   */
  getAllModules(): RegisteredMetadata[] {
    return Array.from(this.modules.values());
  }

  /**
   * Get all full metadata modules (not index files)
   */
  getFullModules(): FileMetadata[] {
    return this.getAllModules().filter(isFullMetadata);
  }

  /**
   * Get all TODOs across the project
   */
  getAllTodos(): TodoWithModule[] {
    const todos: TodoWithModule[] = [];

    for (const meta of this.getFullModules()) {
      for (const todo of meta.todos) {
        todos.push({ ...todo, module: meta.module });
      }
    }

    // Sort by priority
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return todos.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }

  /**
   * Get all open fixes across the project
   */
  getAllFixes(): FixWithModule[] {
    const fixes: FixWithModule[] = [];

    for (const meta of this.getFullModules()) {
      for (const fix of meta.fixes) {
        if (fix.status !== 'fixed') {
          fixes.push({ ...fix, module: meta.module });
        }
      }
    }

    // Sort by severity
    const severityOrder = { critical: 0, major: 1, minor: 2, trivial: 3 };
    return fixes.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  }

  /**
   * Get recently updated modules
   */
  getRecentlyUpdated(days = 7): FileMetadata[] {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    return this.getFullModules()
      .filter(m => new Date(m.updatedAt) >= cutoff)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  /**
   * Get modules by status
   */
  getByStatus(status: ModuleStatus): FileMetadata[] {
    return this.getFullModules().filter(m => m.status === status);
  }

  /**
   * Get modules by tag
   */
  getByTag(tag: string): FileMetadata[] {
    return this.getFullModules().filter(m => m.tags?.includes(tag));
  }

  /**
   * Search modules by description
   */
  search(query: string): RegisteredMetadata[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllModules().filter(
      m =>
        m.module.toLowerCase().includes(lowerQuery) ||
        m.description.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Generate project summary
   */
  getSummary(): RegistrySummary {
    const modules = this.getFullModules();
    const statusBreakdown: Record<ModuleStatus, number> = {
      stable: 0,
      beta: 0,
      experimental: 0,
      deprecated: 0
    };

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    let recentlyUpdated = 0;

    for (const m of modules) {
      statusBreakdown[m.status]++;
      if (new Date(m.updatedAt) >= sevenDaysAgo) {
        recentlyUpdated++;
      }
    }

    return {
      totalModules: this.modules.size,
      todoCount: this.getAllTodos().length,
      fixCount: this.getAllFixes().length,
      statusBreakdown,
      recentlyUpdated
    };
  }

  /**
   * Check if registry is loaded
   */
  isLoaded(): boolean {
    return this.loaded;
  }

  /**
   * Get count of registered modules
   */
  size(): number {
    return this.modules.size;
  }

  /**
   * Clear all registered modules
   */
  clear(): void {
    this.modules.clear();
    this.loaded = false;
  }
}

// Export singleton accessor
export const registry = IntrospectionRegistry.getInstance();


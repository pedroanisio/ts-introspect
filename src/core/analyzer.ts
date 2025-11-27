/**
 * Dependency Analyzer
 *
 * Analyzes TypeScript files to extract import/export information
 * using the TypeScript Compiler API
 */

import ts from 'typescript';
import path from 'path';
import fs from 'fs';
import { glob } from 'glob';

// ============================================
// Types
// ============================================

export interface DependencyInfo {
  internal: string[];
  external: string[];
  types: string[];
}

export interface FileUsageInfo {
  usedBy: string[];
  uses: string[];
}

export interface ExportInfo {
  name: string;
  kind: 'class' | 'function' | 'interface' | 'type' | 'const' | 'enum' | 'unknown';
}

// ============================================
// Dependency Analysis
// ============================================

/**
 * Analyze dependencies of a single file
 * @param filepath - Path to the file to analyze
 * @param srcDir - Optional source directory for resolving relative paths
 * @param content - Optional file content (if not provided, reads from disk)
 */
export function analyzeDependencies(filepath: string, srcDir?: string, content?: string): DependencyInfo {
  if (content === undefined) {
    if (!fs.existsSync(filepath)) {
      throw new Error(`File does not exist: ${filepath}`);
    }
    content = fs.readFileSync(filepath, 'utf-8');
  }
  const sourceFile = ts.createSourceFile(
    filepath,
    content,
    ts.ScriptTarget.Latest,
    true
  );

  const deps: DependencyInfo = {
    internal: [],
    external: [],
    types: []
  };

  function visit(node: ts.Node) {
    // Handle import declarations
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;
      if (ts.isStringLiteral(moduleSpecifier)) {
        const importPath = moduleSpecifier.text;
        const isTypeOnly = node.importClause?.isTypeOnly ?? false;

        if (importPath.startsWith('.')) {
          // Internal import
          const resolved = resolveInternalImport(filepath, importPath, srcDir);
          if (isTypeOnly) {
            if (!deps.types.includes(resolved)) {
              deps.types.push(resolved);
            }
          } else {
            if (!deps.internal.includes(resolved)) {
              deps.internal.push(resolved);
            }
          }
        } else {
          // External package
          const pkgName = importPath.startsWith('@')
            ? importPath.split('/').slice(0, 2).join('/')
            : importPath.split('/')[0] ?? importPath;

          if (pkgName && !deps.external.includes(pkgName)) {
            deps.external.push(pkgName);
          }
        }
      }
    }

    // Handle re-exports: export { X } from './module.js' or export * from './module.js'
    if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      if (ts.isStringLiteral(node.moduleSpecifier)) {
        const importPath = node.moduleSpecifier.text;
        const isTypeOnly = node.isTypeOnly ?? false;

        if (importPath.startsWith('.')) {
          // Internal re-export
          const resolved = resolveInternalImport(filepath, importPath, srcDir);
          if (isTypeOnly) {
            if (!deps.types.includes(resolved)) {
              deps.types.push(resolved);
            }
          } else {
            if (!deps.internal.includes(resolved)) {
              deps.internal.push(resolved);
            }
          }
        } else {
          // External package re-export
          const pkgName = importPath.startsWith('@')
            ? importPath.split('/').slice(0, 2).join('/')
            : importPath.split('/')[0] ?? importPath;

          if (pkgName && !deps.external.includes(pkgName)) {
            deps.external.push(pkgName);
          }
        }
      }
    }

    // Handle dynamic imports
    if (ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const arg = node.arguments[0];
      if (arg && ts.isStringLiteral(arg)) {
        const importPath = arg.text;
        if (importPath.startsWith('.')) {
          const resolved = resolveInternalImport(filepath, importPath, srcDir);
          if (!deps.internal.includes(resolved)) {
            deps.internal.push(resolved);
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  // Sort for consistent output
  deps.internal.sort();
  deps.external.sort();
  deps.types.sort();

  return deps;
}

/**
 * Resolve relative import path to module path
 * @param fromFile - The file making the import
 * @param importPath - The relative import path
 * @param srcDir - The source directory to make paths relative to
 */
function resolveInternalImport(fromFile: string, importPath: string, srcDir?: string): string {
  const dir = path.dirname(fromFile);
  let resolved = path.resolve(dir, importPath);

  // Remove .js extension (TypeScript convention)
  resolved = resolved.replace(/\.js$/, '');

  // Make relative to srcDir if provided
  if (srcDir) {
    const normalizedSrcDir = path.resolve(srcDir);
    const normalizedResolved = path.resolve(resolved);
    
    if (normalizedResolved.startsWith(normalizedSrcDir + path.sep)) {
      return path.relative(normalizedSrcDir, normalizedResolved).replace(/\\/g, '/');
    }
  }

  // Fallback: try to find /src/ pattern (for backward compatibility)
  const srcIndex = resolved.indexOf('/src/');
  if (srcIndex !== -1) {
    return resolved.substring(srcIndex + 5); // Remove /src/ prefix
  }

  return resolved;
}

// ============================================
// Export Analysis
// ============================================

/**
 * Extract exports from a file
 * @param filepath - Path to the file (used for TypeScript source file creation)
 * @param content - Optional file content (if not provided, reads from disk)
 */
export function analyzeExports(filepath: string, content?: string): ExportInfo[] {
  content ??= fs.readFileSync(filepath, 'utf-8');
  const sourceFile = ts.createSourceFile(
    filepath,
    content,
    ts.ScriptTarget.Latest,
    true
  );

  const exports: ExportInfo[] = [];

  function visit(node: ts.Node) {
    // Check for export modifier
    const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
    const isExported = modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);

    if (isExported) {
      if (ts.isClassDeclaration(node) && node.name) {
        exports.push({ name: node.name.text, kind: 'class' });
      } else if (ts.isFunctionDeclaration(node) && node.name) {
        exports.push({ name: node.name.text, kind: 'function' });
      } else if (ts.isInterfaceDeclaration(node)) {
        exports.push({ name: node.name.text, kind: 'interface' });
      } else if (ts.isTypeAliasDeclaration(node)) {
        exports.push({ name: node.name.text, kind: 'type' });
      } else if (ts.isEnumDeclaration(node)) {
        exports.push({ name: node.name.text, kind: 'enum' });
      } else if (ts.isVariableStatement(node)) {
        for (const decl of node.declarationList.declarations) {
          if (ts.isIdentifier(decl.name)) {
            // Skip __metadata
            if (decl.name.text !== '__metadata') {
              exports.push({ name: decl.name.text, kind: 'const' });
            }
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return exports;
}

// ============================================
// Dependency Graph
// ============================================

/**
 * Build full dependency graph for a project
 */
export async function buildDependencyGraph(srcDir: string): Promise<Map<string, FileUsageInfo>> {
  const graph = new Map<string, FileUsageInfo>();
  const files = await getAllTsFiles(srcDir);

  // Initialize all files
  for (const file of files) {
    const relativePath = path.relative(srcDir, file).replace(/\.ts$/, '');
    graph.set(relativePath, { usedBy: [], uses: [] });
  }

  // Analyze each file
  for (const file of files) {
    const relativePath = path.relative(srcDir, file).replace(/\.ts$/, '').replace(/\\/g, '/');
    try {
      const deps = analyzeDependencies(file, srcDir);

      const info = graph.get(relativePath);
      if (info) {
        info.uses = [...deps.internal, ...deps.types];

        // Update usedBy for dependencies
        for (const dep of info.uses) {
          const depInfo = graph.get(dep);
          if (depInfo && !depInfo.usedBy.includes(relativePath)) {
            depInfo.usedBy.push(relativePath);
          }
        }
      }
    } catch (error) {
      // Skip files that can't be analyzed
      console.warn(`⚠️  Failed to analyze ${file}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return graph;
}

/**
 * Get all TypeScript files in directory
 */
async function getAllTsFiles(dir: string): Promise<string[]> {
  const pattern = '**/*.ts';
  const files = await glob(pattern, {
    cwd: dir,
    ignore: ['**/*.d.ts', '**/node_modules/**'],
    absolute: true
  });
  return files;
}

// ============================================
// Dependency Analyzer Class
// ============================================

export class DependencyAnalyzer {
  private srcDir: string;
  private graph: Map<string, FileUsageInfo> | null = null;

  constructor(srcDir: string) {
    if (!fs.existsSync(srcDir)) {
      throw new Error(`Source directory does not exist: ${srcDir}`);
    }
    this.srcDir = path.resolve(srcDir);
  }

  async analyze(): Promise<Map<string, FileUsageInfo>> {
    this.graph = await buildDependencyGraph(this.srcDir);
    return this.graph;
  }

  getGraph(): Map<string, FileUsageInfo> | null {
    return this.graph;
  }

  getUsedBy(module: string): string[] {
    return this.graph?.get(module)?.usedBy ?? [];
  }

  getUses(module: string): string[] {
    return this.graph?.get(module)?.uses ?? [];
  }

  /**
   * Find modules that are not imported by anyone
   */
  getUnusedModules(): string[] {
    if (!this.graph) {return [];}

    const unused: string[] = [];
    for (const [module, info] of this.graph) {
      // Skip index files and entry points
      if (module.endsWith('index') || module === 'index') {continue;}

      if (info.usedBy.length === 0) {
        unused.push(module);
      }
    }
    return unused;
  }

  /**
   * Find circular dependencies
   */
  findCircularDependencies(): string[][] {
    if (!this.graph) {return [];}

    const cycles: string[][] = [];
    const visited = new Set<string>();
    const stack = new Set<string>();
    const cycleSet = new Set<string>(); // Track cycles to avoid duplicates

    const dfs = (module: string, path: string[]): void => {
      if (stack.has(module)) {
        // Found a cycle - module is in the current path
        const cycleStart = path.indexOf(module);
        const cycle = [...path.slice(cycleStart), module];
        
        // Create a canonical representation to avoid duplicates
        const cycleKey = cycle.sort().join(' -> ');
        if (!cycleSet.has(cycleKey)) {
          cycleSet.add(cycleKey);
          cycles.push(cycle);
        }
        return;
      }

      if (visited.has(module)) {return;}

      visited.add(module);
      stack.add(module);

      const info = this.graph?.get(module);
      if (info && this.graph) {
        for (const dep of info.uses) {
          // Only traverse if dependency exists in graph
          if (this.graph.has(dep)) {
            dfs(dep, [...path, module]);
          }
        }
      }

      stack.delete(module);
    };

    for (const module of this.graph.keys()) {
      if (!visited.has(module)) {
        dfs(module, []);
      }
    }

    return cycles;
  }
}


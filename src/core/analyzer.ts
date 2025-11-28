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
import type { ReactInfo, PropInfo, HookInfo, ComponentType } from '../types/metadata.js';

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
// React Analysis
// ============================================

/**
 * Built-in React hooks for detection
 */
const REACT_HOOKS = new Set([
  'useState', 'useEffect', 'useContext', 'useReducer', 'useCallback',
  'useMemo', 'useRef', 'useImperativeHandle', 'useLayoutEffect',
  'useDebugValue', 'useDeferredValue', 'useTransition', 'useId',
  'useSyncExternalStore', 'useInsertionEffect'
]);

/**
 * Analyze React-specific patterns in a file
 * @param filepath - Path to the file to analyze
 * @param content - Optional file content (if not provided, reads from disk)
 */
export function analyzeReactComponent(filepath: string, content?: string): ReactInfo | null {
  // Only analyze .tsx files
  if (!filepath.endsWith('.tsx')) {
    return null;
  }

  if (content === undefined) {
    if (!fs.existsSync(filepath)) {
      return null;
    }
    content = fs.readFileSync(filepath, 'utf-8');
  }

  // Quick check: does it look like a React component?
  if (!content.includes('react') && !content.includes('React')) {
    return null;
  }

  const sourceFile = ts.createSourceFile(
    filepath,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );

  const reactInfo: ReactInfo = {};
  const hooks: HookInfo[] = [];
  const contexts: string[] = [];
  const renders: string[] = [];
  const stateManagement: string[] = [];
  let propsInterfaceName: string | null = null;
  const propsProperties: PropInfo[] = [];
  let hasJsx = false;

  // Track component names and their props interfaces
  const componentPropsMap = new Map<string, string>();

  // First pass: collect all interface and type definitions
  const typeDefinitions = new Map<string, PropInfo[]>();
  
  function collectTypes(node: ts.Node) {
    if (ts.isInterfaceDeclaration(node)) {
      const props: PropInfo[] = [];
      for (const member of node.members) {
        if (ts.isPropertySignature(member) && member.name && ts.isIdentifier(member.name)) {
          props.push({
            name: member.name.text,
            type: member.type ? member.type.getText(sourceFile) : 'unknown',
            required: !member.questionToken
          });
        }
      }
      if (props.length > 0) {
        typeDefinitions.set(node.name.text, props);
      }
    }
    
    if (ts.isTypeAliasDeclaration(node) && ts.isTypeLiteralNode(node.type)) {
      const props: PropInfo[] = [];
      for (const member of node.type.members) {
        if (ts.isPropertySignature(member) && member.name && ts.isIdentifier(member.name)) {
          props.push({
            name: member.name.text,
            type: member.type ? member.type.getText(sourceFile) : 'unknown',
            required: !member.questionToken
          });
        }
      }
      if (props.length > 0) {
        typeDefinitions.set(node.name.text, props);
      }
    }
    
    ts.forEachChild(node, collectTypes);
  }
  
  collectTypes(sourceFile);

  // Helper to extract props type name from a parameter
  function extractPropsFromParam(param: ts.ParameterDeclaration): string | null {
    // Case 1: Typed parameter - function MyComp(props: MyProps)
    if (param.type && ts.isTypeReferenceNode(param.type)) {
      const typeName = param.type.typeName;
      if (ts.isIdentifier(typeName)) {
        return typeName.text;
      }
    }
    // Case 2: Destructured parameter with type - function MyComp({ foo, bar }: MyProps)
    if (ts.isObjectBindingPattern(param.name) && param.type && ts.isTypeReferenceNode(param.type)) {
      const typeName = param.type.typeName;
      if (ts.isIdentifier(typeName)) {
        return typeName.text;
      }
    }
    return null;
  }

  function visit(node: ts.Node) {
    // Detect function components with props type
    if (ts.isFunctionDeclaration(node) && node.name) {
      const params = node.parameters;
      if (params.length > 0) {
        const firstParam = params[0];
        if (firstParam) {
          const propsType = extractPropsFromParam(firstParam);
          if (propsType) {
            componentPropsMap.set(node.name.text, propsType);
            propsInterfaceName = propsType;
          }
        }
      }
    }

    // Detect arrow function components
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.initializer) {
          // Arrow function with type annotation on parameter
          if (ts.isArrowFunction(decl.initializer)) {
            const params = decl.initializer.parameters;
            if (params.length > 0) {
              const firstParam = params[0];
              if (firstParam) {
                const propsType = extractPropsFromParam(firstParam);
                if (propsType) {
                  componentPropsMap.set(decl.name.text, propsType);
                  propsInterfaceName = propsType;
                }
              }
            }
          }
          // React.FC<Props> or FC<Props> pattern
          if (decl.type && ts.isTypeReferenceNode(decl.type)) {
            const typeName = decl.type.typeName;
            let fcTypeName: string | null = null;
            
            if (ts.isIdentifier(typeName) && (typeName.text === 'FC' || typeName.text === 'FunctionComponent')) {
              fcTypeName = typeName.text;
            } else if (ts.isQualifiedName(typeName) && ts.isIdentifier(typeName.right) && 
                       (typeName.right.text === 'FC' || typeName.right.text === 'FunctionComponent')) {
              fcTypeName = typeName.right.text;
            }

            if (fcTypeName && decl.type.typeArguments && decl.type.typeArguments.length > 0) {
              const typeArg = decl.type.typeArguments[0];
              if (typeArg && ts.isTypeReferenceNode(typeArg) && ts.isIdentifier(typeArg.typeName)) {
                componentPropsMap.set(decl.name.text, typeArg.typeName.text);
                propsInterfaceName = typeArg.typeName.text;
              }
            }
          }
        }
      }
    }

    // Detect hooks usage
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      let hookName: string | null = null;

      if (ts.isIdentifier(expr)) {
        hookName = expr.text;
      } else if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.name)) {
        hookName = expr.name.text;
      }

      if (hookName?.startsWith('use')) {
        const isBuiltIn = REACT_HOOKS.has(hookName);
        const existingHook = hooks.find(h => h.name === hookName);
        
        if (!existingHook) {
          const hookInfo: HookInfo = {
            name: hookName,
            isCustom: !isBuiltIn
          };

          // For useContext, try to extract the context name
          if (hookName === 'useContext' && node.arguments.length > 0) {
            const arg = node.arguments[0];
            if (arg && ts.isIdentifier(arg)) {
              contexts.push(arg.text);
            }
          }

          hooks.push(hookInfo);
        }
      }

      // Detect state management
      if (hookName === 'useSelector' || hookName === 'useDispatch') {
        if (!stateManagement.includes('redux')) {
          stateManagement.push('redux');
        }
      }
      if (hookName === 'useStore' || hookName === 'useAtom') {
        // Check import to distinguish zustand vs jotai
        if (content?.includes('from \'zustand\'') || content?.includes('from "zustand"')) {
          if (!stateManagement.includes('zustand')) {
            stateManagement.push('zustand');
          }
        }
        if (content?.includes('from \'jotai\'') || content?.includes('from "jotai"')) {
          if (!stateManagement.includes('jotai')) {
            stateManagement.push('jotai');
          }
        }
      }
      if (hookName === 'useQuery' || hookName === 'useMutation') {
        if (content?.includes('@tanstack/react-query') || content?.includes('react-query')) {
          if (!stateManagement.includes('react-query')) {
            stateManagement.push('react-query');
          }
        }
      }
    }

    // Detect forwardRef
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      if (ts.isIdentifier(expr) && expr.text === 'forwardRef') {
        reactInfo.forwardRef = true;
      } else if (ts.isPropertyAccessExpression(expr) && 
                 ts.isIdentifier(expr.name) && expr.name.text === 'forwardRef') {
        reactInfo.forwardRef = true;
      }
    }

    // Detect memo
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      if (ts.isIdentifier(expr) && expr.text === 'memo') {
        reactInfo.memoized = true;
      } else if (ts.isPropertyAccessExpression(expr) && 
                 ts.isIdentifier(expr.name) && expr.name.text === 'memo') {
        reactInfo.memoized = true;
      }
    }

    // Detect JSX elements (child components)
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      hasJsx = true;
      const tagName = node.tagName;
      if (ts.isIdentifier(tagName)) {
        const name = tagName.text;
        // Capital letter = component, not HTML element
        const firstChar = name.charAt(0);
        if (firstChar && firstChar === firstChar.toUpperCase() && !renders.includes(name)) {
          renders.push(name);
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  
  // After visit, look up props interface from collected type definitions
  if (propsInterfaceName) {
    const propsDef = typeDefinitions.get(propsInterfaceName);
    if (propsDef) {
      propsProperties.push(...propsDef);
    }
  }

  // Determine component type based on file path and content
  const filename = path.basename(filepath).toLowerCase();
  const dirPath = path.dirname(filepath).toLowerCase();
  
  let componentType: ComponentType | undefined;
  
  if (dirPath.includes('/pages/') || dirPath.includes('/app/') || filename.includes('page')) {
    componentType = 'page';
  } else if (dirPath.includes('/layouts/') || filename.includes('layout')) {
    componentType = 'layout';
  } else if (dirPath.includes('/providers/') || filename.includes('provider') || content.includes('createContext')) {
    componentType = 'provider';
  } else if (dirPath.includes('/hooks/') || filename.startsWith('use')) {
    componentType = 'hook';
  } else if (dirPath.includes('/components/ui/') || dirPath.includes('/ui/')) {
    componentType = 'ui';
  } else if (dirPath.includes('/features/') || dirPath.includes('/components/')) {
    componentType = 'feature';
  }

  // Only return if we found React-specific patterns
  if (hooks.length === 0 && !propsInterfaceName && renders.length === 0 && 
      !reactInfo.forwardRef && !reactInfo.memoized && !hasJsx) {
    return null;
  }

  if (componentType) {
    reactInfo.componentType = componentType;
  }

  if (propsInterfaceName && propsProperties.length > 0) {
    reactInfo.props = {
      interfaceName: propsInterfaceName,
      properties: propsProperties
    };
  }

  if (hooks.length > 0) {
    reactInfo.hooks = hooks;
  }

  if (contexts.length > 0) {
    reactInfo.contexts = contexts;
  }

  if (stateManagement.length > 0) {
    reactInfo.stateManagement = stateManagement;
  }

  if (renders.length > 0) {
    reactInfo.renders = renders.filter(r => r !== 'Fragment'); // Exclude Fragment
  }

  return reactInfo;
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


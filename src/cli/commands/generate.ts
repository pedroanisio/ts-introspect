/**
 * Generate Command
 *
 * Generate metadata stubs for files
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { glob } from 'glob';
import * as ts from 'typescript';
import { generateContentHash } from '../../core/hasher.js';
import { analyzeDependencies, analyzeExports, analyzeReactComponent } from '../../core/analyzer.js';
import { DEFAULT_CONFIG } from '../../types/config.js';
import type { FileMetadata, ReactInfo } from '../../types/metadata.js';
import { stdout } from '../logger.js';

interface ExtractedMetadata {
  description?: string;
  responsibilities?: string[];
  status?: FileMetadata['status'];
  createdAt?: string;
  changelog?: string; // Raw text to preserve structure
  todos?: string; // Raw text to preserve structure
  fixes?: string; // Raw text to preserve structure
  dependencies?: {
    internal: string[];
    external: string[];
    types: string[];
  };
  notes?: string;
  seeAlso?: string[];
  tags?: string[];
  react?: ReactInfo;
}

interface GenerateOptions {
  overwrite?: boolean;
  exclude?: string[];
  skipBarrelExports?: boolean;
}

export async function generateCommand(
  files: string[] | undefined,
  options: GenerateOptions
): Promise<void> {
  stdout(chalk.blue('\n📝 Generating metadata stubs...\n'));

  let targetFiles: string[];

  if (files && files.length > 0) {
    // Expand directories to their contained .ts files
    const expandedFiles: string[] = [];
    
    for (const f of files) {
      const resolved = path.resolve(process.cwd(), f);
      
      if (!fs.existsSync(resolved)) {
        stdout(chalk.yellow(`⚠️  Path not found: ${f}`));
        continue;
      }
      
      const stat = fs.statSync(resolved);
      if (stat.isDirectory()) {
        // Glob for TypeScript files in directory
        const dirFiles = await glob(DEFAULT_CONFIG.include, {
          cwd: resolved,
          ignore: DEFAULT_CONFIG.exclude,
          absolute: true
        });
        expandedFiles.push(...dirFiles);
      } else if ((resolved.endsWith('.ts') || resolved.endsWith('.tsx')) && !resolved.endsWith('.d.ts')) {
        expandedFiles.push(resolved);
      }
    }
    
    targetFiles = expandedFiles;
  } else {
    // Find all TypeScript files without metadata
    const srcDir = path.resolve(process.cwd(), DEFAULT_CONFIG.srcDir);

    targetFiles = await glob(DEFAULT_CONFIG.include, {
      cwd: srcDir,
      ignore: DEFAULT_CONFIG.exclude,
      absolute: true
    });
  }

  // Build set of files that are barrel-exported (via export * from)
  const barrelExportedFiles = new Set<string>();
  if (options.skipBarrelExports !== false) {
    for (const filepath of targetFiles) {
      const dir = path.dirname(filepath);
      const indexPath = path.join(dir, 'index.ts');
      
      if (fs.existsSync(indexPath) && filepath !== indexPath) {
        const indexContent = fs.readFileSync(indexPath, 'utf-8');
        const ext = path.extname(filepath);
        const filename = path.basename(filepath, ext);
        
        // Check if this file is re-exported with export * from
        const reExportPattern = new RegExp(`export\\s*\\*\\s*from\\s*['"]\\.\\/${filename}(\\.js)?['"]`);
        if (reExportPattern.test(indexContent)) {
          barrelExportedFiles.add(filepath);
        }
      }
    }
  }

  // Apply additional exclude patterns
  const additionalExcludes = options.exclude ?? [];
  
  let generated = 0;
  let skipped = 0;
  let skippedBarrel = 0;

  for (const filepath of targetFiles) {
    if (!fs.existsSync(filepath)) {
      stdout(chalk.yellow(`⚠️  File not found: ${filepath}`));
      continue;
    }

    // Check if file matches additional exclude patterns
    const relativePath = path.relative(process.cwd(), filepath);
    const shouldExclude = additionalExcludes.some(pattern => {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(relativePath);
    });
    
    if (shouldExclude) {
      skipped++;
      continue;
    }

    // Check if file is barrel-exported
    if (barrelExportedFiles.has(filepath)) {
      skippedBarrel++;
      continue;
    }

    const content = fs.readFileSync(filepath, 'utf-8');

    // Count existing metadata blocks
    const metadataMatches = content.match(/export const __metadata/g);
    const metadataCount = metadataMatches ? metadataMatches.length : 0;
    
    // Check if already has metadata
    if (metadataCount > 0 && !options.overwrite) {
      if (metadataCount > 1) {
        stdout(chalk.yellow(`⚠️  Skipped (has ${metadataCount} metadata blocks, use --overwrite to fix): ${relativePath}`));
      }
      skipped++;
      continue;
    }
    
    // Warn if overwriting and multiple blocks exist
    if (metadataCount > 1 && options.overwrite) {
      stdout(chalk.yellow(`⚠️  Removing ${metadataCount} duplicate metadata blocks: ${relativePath}`));
    }

    // Generate or update metadata stub
    const srcDir = path.resolve(process.cwd(), DEFAULT_CONFIG.srcDir);
    const existingMetadata = extractExistingMetadata(content, filepath, srcDir);
    const stub = generateMetadataStub({
      filepath,
      content,
      srcDir,
      existingMetadata
    });

    // Insert into file (this will remove all existing metadata blocks first)
    const newContent = insertMetadata(content, stub);
    fs.writeFileSync(filepath, newContent);

    stdout(chalk.green(`✅ Generated: ${relativePath}`));
    generated++;
  }

  stdout(chalk.blue(`\n📊 Summary:`));
  stdout(`   Generated: ${generated}`);
  stdout(`   Skipped (existing): ${skipped}`);
  if (skippedBarrel > 0) {
    stdout(`   Skipped (barrel exports): ${skippedBarrel}`);
    stdout(chalk.gray(`   (Files re-exported via 'export * from' - use named exports to include)`));
  }
  stdout('');
}

/**
 * Extract existing metadata from file content to preserve user-provided values
 */
function extractExistingMetadata(
  content: string,
  filepath: string,
  _srcDir: string
): ExtractedMetadata | null {
  try {
    const sourceFile = ts.createSourceFile(
      filepath,
      content,
      ts.ScriptTarget.Latest,
      true
    );

    let metadataNode: ts.ObjectLiteralExpression | null = null;

    function unwrapAsConst(expr: ts.Expression): ts.Expression {
      if (ts.isAsExpression(expr)) {return unwrapAsConst(expr.expression);}
      if (ts.isTypeAssertionExpression(expr)) {return unwrapAsConst(expr.expression);}
      if (ts.isParenthesizedExpression(expr)) {return unwrapAsConst(expr.expression);}
      return expr;
    }

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

    if (!metadataNode) {return null;}

    const props = new Map<string, ts.Expression>();
    const node: ts.ObjectLiteralExpression = metadataNode;
    for (const prop of node.properties) {
      if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
        props.set(prop.name.text, prop.initializer);
      }
    }

    const extractString = (expr: ts.Expression | undefined): string | null => {
      if (!expr) {return null;}
      if (ts.isStringLiteral(expr)) {return expr.text;}
      if (ts.isNoSubstitutionTemplateLiteral(expr)) {return expr.text;}
      return null;
    };

    const extractArray = (expr: ts.Expression | undefined): string[] => {
      if (!expr || !ts.isArrayLiteralExpression(expr)) {return [];}
      const result: string[] = [];
      for (const element of expr.elements) {
        if (ts.isStringLiteral(element) || ts.isNoSubstitutionTemplateLiteral(element)) {
          result.push(element.text);
        }
      }
      return result;
    };

    const extractProperty = (obj: ts.ObjectLiteralExpression, propName: string): ts.Expression | undefined => {
      for (const prop of obj.properties) {
        if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name) && prop.name.text === propName) {
          return prop.initializer;
        }
      }
      return undefined;
    };

    const extractNestedArray = (obj: ts.ObjectLiteralExpression, propName: string): string[] => {
      return extractArray(extractProperty(obj, propName));
    };

    // Extract changelog as raw text to preserve structure
    const changelogProp = props.get('changelog');
    let changelogText = '';
    if (changelogProp && ts.isArrayLiteralExpression(changelogProp)) {
      // Get the raw text of the changelog array
      const start = changelogProp.getStart(sourceFile);
      const end = changelogProp.getEnd();
      changelogText = content.substring(start, end);
    }

    // Extract todos and fixes as raw text to preserve structure
    const todosProp = props.get('todos');
    let todosText = '';
    if (todosProp && ts.isArrayLiteralExpression(todosProp)) {
      const start = todosProp.getStart(sourceFile);
      const end = todosProp.getEnd();
      todosText = content.substring(start, end);
    }

    const fixesProp = props.get('fixes');
    let fixesText = '';
    if (fixesProp && ts.isArrayLiteralExpression(fixesProp)) {
      const start = fixesProp.getStart(sourceFile);
      const end = fixesProp.getEnd();
      fixesText = content.substring(start, end);
    }

    const dependenciesProp = props.get('dependencies');
    const dependencies = dependenciesProp && ts.isObjectLiteralExpression(dependenciesProp)
      ? {
          internal: extractNestedArray(dependenciesProp, 'internal'),
          external: extractNestedArray(dependenciesProp, 'external'),
          types: extractNestedArray(dependenciesProp, 'types')
        }
      : null;

    const result: ExtractedMetadata = {};
    
    const desc = extractString(props.get('description'));
    if (desc) {result.description = desc;}
    
    const resp = extractArray(props.get('responsibilities'));
    if (resp.length > 0) {result.responsibilities = resp;}
    
    const statusVal = extractString(props.get('status'));
    if (statusVal) {result.status = statusVal as FileMetadata['status'];}
    
    const created = extractString(props.get('createdAt'));
    if (created) {result.createdAt = created;}
    
    if (changelogText) {result.changelog = changelogText;}
    if (todosText) {result.todos = todosText;}
    if (fixesText) {result.fixes = fixesText;}
    if (dependencies) {result.dependencies = dependencies;}
    
    const notesVal = extractString(props.get('notes'));
    if (notesVal) {result.notes = notesVal;}
    
    const seeAlsoVal = extractArray(props.get('seeAlso'));
    if (seeAlsoVal.length > 0) {result.seeAlso = seeAlsoVal;}
    
    const tagsVal = extractArray(props.get('tags'));
    if (tagsVal.length > 0) {result.tags = tagsVal;}
    
    return result;
  } catch {
    return null;
  }
}

function generateMetadataStub(options: {
  filepath: string;
  content: string;
  srcDir: string;
  existingMetadata?: ExtractedMetadata | null;
}): string {
  const { filepath, content, srcDir, existingMetadata } = options;
  const filename = path.basename(filepath);
  const ext = path.extname(filepath);
  const relativePath = path.relative(srcDir, filepath).replace(/\.(ts|tsx)$/, '');

  const deps = analyzeDependencies(filepath, srcDir);
  const exports = analyzeExports(filepath);
  const hash = generateContentHash(filepath);
  const today = new Date().toISOString().split('T')[0];

  const exportNames = exports
    .filter(e => e.name !== '__metadata')
    .map(e => `'${e.name}'`);

  const internalDeps = deps.internal.map(d => `'${d}'`);
  const externalDeps = deps.external.map(d => `'${d}'`);
  const typeDeps = (existingMetadata?.dependencies?.types ?? deps.types ?? []).map(d => `'${d}'`);

  // Preserve existing values or use defaults
  const description = existingMetadata?.description && 
    !existingMetadata.description.includes('TODO: Add description')
    ? existingMetadata.description
    : 'TODO: Add description';
  
  const responsibilities = existingMetadata?.responsibilities && 
    existingMetadata.responsibilities.length > 0 &&
    !existingMetadata.responsibilities[0]?.includes('TODO: List responsibilities')
    ? `[\n    ${existingMetadata.responsibilities.map(r => `'${r.replace(/'/g, "\\'")}'`).join(',\n    ')}\n  ]`
    : "['TODO: List responsibilities']";
  
  const status = existingMetadata?.status ?? 'stable';
  const createdAt = existingMetadata?.createdAt ?? today;
  
  // Preserve changelog if it exists and is not the default
  const changelog = existingMetadata?.changelog && 
    !existingMetadata.changelog.includes('Initial implementation')
    ? existingMetadata.changelog
    : `[{ version: '1.0.0', date: '${createdAt}', changes: ['Initial implementation'] }]`;
  
  // Preserve todos and fixes if they exist
  const todos = existingMetadata?.todos && typeof existingMetadata.todos === 'string' && existingMetadata.todos.trim() !== '[]'
    ? existingMetadata.todos
    : '[] as Array<{ id: string; description: string; priority: string; status: string; createdAt: string }>';
  
  const fixes = existingMetadata?.fixes && typeof existingMetadata.fixes === 'string' && existingMetadata.fixes.trim() !== '[]'
    ? existingMetadata.fixes
    : '[] as Array<{ id: string; description: string; severity: string; status: string; createdAt: string }>';

  // Preserve optional fields
  const notes = existingMetadata?.notes ? `\n  notes: '${existingMetadata.notes.replace(/'/g, "\\'")}',` : '';
  const seeAlso = existingMetadata?.seeAlso && existingMetadata.seeAlso.length > 0
    ? `\n  seeAlso: [${existingMetadata.seeAlso.map(s => `'${s}'`).join(', ')}],`
    : '';
  const tags = existingMetadata?.tags && existingMetadata.tags.length > 0
    ? `\n  tags: [${existingMetadata.tags.map(t => `'${t}'`).join(', ')}],`
    : '';

  // React-specific analysis for .tsx files
  let reactSection = '';
  if (ext === '.tsx') {
    const reactInfo = analyzeReactComponent(filepath, content);
    if (reactInfo) {
      const parts: string[] = [];
      
      if (reactInfo.componentType) {
        parts.push(`componentType: '${reactInfo.componentType}'`);
      }
      
      if (reactInfo.props) {
        const propsStr = reactInfo.props.properties
          .map(p => `{ name: '${p.name}', type: '${p.type.replace(/'/g, "\\'")}', required: ${p.required} }`)
          .join(',\n        ');
        parts.push(`props: {\n      interfaceName: '${reactInfo.props.interfaceName}',\n      properties: [\n        ${propsStr}\n      ]\n    }`);
      }
      
      if (reactInfo.hooks && reactInfo.hooks.length > 0) {
        const hooksStr = reactInfo.hooks
          .map(h => `{ name: '${h.name}', isCustom: ${h.isCustom} }`)
          .join(', ');
        parts.push(`hooks: [${hooksStr}]`);
      }
      
      if (reactInfo.contexts && reactInfo.contexts.length > 0) {
        parts.push(`contexts: [${reactInfo.contexts.map(c => `'${c}'`).join(', ')}]`);
      }
      
      if (reactInfo.stateManagement && reactInfo.stateManagement.length > 0) {
        parts.push(`stateManagement: [${reactInfo.stateManagement.map(s => `'${s}'`).join(', ')}]`);
      }
      
      if (reactInfo.renders && reactInfo.renders.length > 0) {
        parts.push(`renders: [${reactInfo.renders.map(r => `'${r}'`).join(', ')}]`);
      }
      
      if (reactInfo.forwardRef) {
        parts.push(`forwardRef: true`);
      }
      
      if (reactInfo.memoized) {
        parts.push(`memoized: true`);
      }
      
      if (parts.length > 0) {
        reactSection = `\n  react: {\n    ${parts.join(',\n    ')}\n  },`;
      }
    }
  }

  return `
// ============================================
// FILE INTROSPECTION METADATA
// ============================================
/** @internal Metadata for tooling - not imported by application code */
export const __metadata = {
  module: '${relativePath}',
  filename: '${filename}',
  description: '${description.replace(/'/g, "\\'")}',
  responsibilities: ${responsibilities},
  exports: [${exportNames.join(', ')}],
  dependencies: {
    internal: [${internalDeps.join(', ')}],
    external: [${externalDeps.join(', ')}],
    types: [${typeDeps.join(', ')}] as string[]
  },
  status: '${status}' as const,
  createdAt: '${createdAt}',
  updatedAt: '${today}',${notes}${seeAlso}${tags}${reactSection}
  changelog: ${changelog},
  todos: ${todos},
  fixes: ${fixes},
  _meta: {
    contentHash: '${hash}',
    lastValidated: '${today}',
    generatedDeps: [${internalDeps.join(', ')}]
  }
} as const;
`;
}

/**
 * Remove all existing metadata blocks from content
 * This prevents duplicates when overwriting
 */
function removeExistingMetadata(content: string): string {
  // Remove metadata blocks with header comments (FILE INTROSPECTION or FILE INTROSPECTION METADATA)
  let cleaned = content.replace(
    /\/\/ =+\s*\n\/\/ FILE INTROSPECTION(?:\s+METADATA)?\s*\n\/\/ =+\s*\nexport const __metadata[\s\S]*?\n\}(?:\s*as\s+const)?;/gm,
    ''
  );
  
  // Remove metadata blocks without header comments
  cleaned = cleaned.replace(
    /export const __metadata[^=]*=\s*\{[\s\S]*?\n\}(?:\s*as\s+const)?;/gm,
    ''
  );
  
  // Clean up multiple consecutive empty lines that might result from removal
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  return cleaned;
}

function insertMetadata(content: string, stub: string): string {
  // First, remove any existing metadata blocks to prevent duplicates
  const cleanedContent = removeExistingMetadata(content);
  const lines = cleanedContent.split('\n');
  
  // Find the end of all import statements (handling multi-line imports)
  let lastImportEndLine = -1;
  let inMultiLineImport = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmedLine = line.trim();
    
    // Start of an import
    if (trimmedLine.startsWith('import ') || trimmedLine.startsWith('import{')) {
      inMultiLineImport = !trimmedLine.includes(';') && !trimmedLine.endsWith("';") && !trimmedLine.endsWith('";');
      if (!inMultiLineImport) {
        lastImportEndLine = i;
      }
    }
    // Inside a multi-line import
    else if (inMultiLineImport) {
      // Check if this line ends the import (has 'from' and ends with semicolon)
      if (trimmedLine.includes('from ') && trimmedLine.endsWith(';')) {
        lastImportEndLine = i;
        inMultiLineImport = false;
      }
      // Also check for just a closing that ends the import
      else if (trimmedLine.endsWith("';") || trimmedLine.endsWith('";')) {
        lastImportEndLine = i;
        inMultiLineImport = false;
      }
    }
  }
  
  // Insert position is after the last import
  let insertIndex = lastImportEndLine + 1;
  
  // Skip empty lines and comments after imports
  while (insertIndex < lines.length) {
    const line = lines[insertIndex]?.trim() ?? '';
    if (line === '' || line.startsWith('//')) {
      insertIndex++;
    } else {
      break;
    }
  }
  
  // Build the new content
  const beforeImports = lines.slice(0, lastImportEndLine + 1);
  const afterImports = lines.slice(lastImportEndLine + 1);
  
  const result: string[] = [...beforeImports];
  
  // Add the metadata stub
  result.push(stub);
  
  // Add the rest of the file
  result.push(...afterImports);
  
  return result.join('\n');
}


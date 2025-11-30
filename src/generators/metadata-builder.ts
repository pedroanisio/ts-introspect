/**
 * MetadataBuilder
 * 
 * Builder Pattern implementation for generating metadata stubs.
 * Provides a fluent API for constructing metadata objects cleanly.
 * 
 * @example
 * ```typescript
 * const stub = new MetadataBuilder({
 *   module: 'core/utils',
 *   filename: 'utils.ts'
 * })
 *   .description('Utility functions')
 *   .status('stable')
 *   .exports(['formatDate', 'parseJSON'])
 *   .internalDeps(['./helpers'])
 *   .build();
 * ```
 */

import type {
  FileMetadata,
  ModuleStatus,
  TodoItem,
  FixItem,
  ChangelogEntry,
  PropInfo,
  HookInfo,
  ComponentType
} from '../types/metadata.js';

// ============================================
// Types
// ============================================

/**
 * Required options for MetadataBuilder
 */
export interface MetadataBuilderOptions {
  /** Module path (relative to src) */
  module: string;
  /** Filename */
  filename: string;
}

/**
 * Props info for React components
 */
export interface PropsInfo {
  interfaceName: string;
  properties: PropInfo[];
}

/**
 * Dependencies structure
 */
export interface DependenciesInfo {
  internal: string[];
  external: string[];
  types: string[];
}

// ============================================
// MetadataBuilder
// ============================================

/**
 * Builder for constructing metadata stubs with a fluent API.
 */
export class MetadataBuilder {
  private _module: string;
  private _filename: string;
  private _description = 'TODO: Add description';
  private _responsibilities: string[] = ['TODO: List responsibilities'];
  private _exports: string[] = [];
  private _status: ModuleStatus = 'stable';
  private _createdAt: string;
  private _updatedAt: string;
  private _notes?: string;
  private _seeAlso?: string[];
  private _tags?: string[];
  
  // Dependencies
  private _internalDeps: string[] = [];
  private _externalDeps: string[] = [];
  private _typeDeps: string[] = [];
  
  // React
  private _componentType?: ComponentType;
  private _props?: PropsInfo;
  private _hooks?: HookInfo[];
  private _contexts?: string[];
  private _stateManagement?: string[];
  private _renders?: string[];
  private _forwardRef?: boolean;
  private _memoized?: boolean;
  
  // Changelog
  private _changelog: ChangelogEntry[] = [];
  
  // Todos/Fixes
  private _todos: TodoItem[] = [];
  private _fixes: FixItem[] = [];
  
  // Internal meta
  private _contentHash = '';
  private _lastValidated: string;
  private _generatedDeps: string[] = [];

  constructor(options: MetadataBuilderOptions) {
    this._module = options.module;
    this._filename = options.filename;
    
    const today = new Date().toISOString().split('T')[0]!;
    this._createdAt = today;
    this._updatedAt = today;
    this._lastValidated = today;
  }

  // ============================================
  // Basic Fields
  // ============================================

  description(desc: string): this {
    this._description = desc;
    return this;
  }

  responsibilities(items: string[]): this {
    this._responsibilities = items;
    return this;
  }

  exports(items: string[]): this {
    this._exports = items;
    return this;
  }

  status(s: ModuleStatus): this {
    this._status = s;
    return this;
  }

  createdAt(date: string): this {
    this._createdAt = date;
    return this;
  }

  updatedAt(date: string): this {
    this._updatedAt = date;
    return this;
  }

  // ============================================
  // Dependencies
  // ============================================

  internalDeps(deps: string[]): this {
    this._internalDeps = deps;
    return this;
  }

  externalDeps(deps: string[]): this {
    this._externalDeps = deps;
    return this;
  }

  typeDeps(deps: string[]): this {
    this._typeDeps = deps;
    return this;
  }

  dependencies(deps: DependenciesInfo): this {
    this._internalDeps = deps.internal;
    this._externalDeps = deps.external;
    this._typeDeps = deps.types;
    return this;
  }

  // ============================================
  // React Fields
  // ============================================

  componentType(type: ComponentType): this {
    this._componentType = type;
    return this;
  }

  props(info: PropsInfo): this {
    this._props = info;
    return this;
  }

  hooks(items: HookInfo[]): this {
    this._hooks = items;
    return this;
  }

  contexts(items: string[]): this {
    this._contexts = items;
    return this;
  }

  stateManagement(items: string[]): this {
    this._stateManagement = items;
    return this;
  }

  renders(items: string[]): this {
    this._renders = items;
    return this;
  }

  forwardRef(value: boolean): this {
    this._forwardRef = value;
    return this;
  }

  memoized(value: boolean): this {
    this._memoized = value;
    return this;
  }

  // ============================================
  // Optional Fields
  // ============================================

  notes(text: string): this {
    this._notes = text;
    return this;
  }

  seeAlso(refs: string[]): this {
    this._seeAlso = refs;
    return this;
  }

  tags(items: string[]): this {
    this._tags = items;
    return this;
  }

  // ============================================
  // Changelog
  // ============================================

  changelog(entries: ChangelogEntry[]): this {
    this._changelog = entries;
    return this;
  }

  // ============================================
  // Todos & Fixes
  // ============================================

  todos(items: TodoItem[]): this {
    this._todos = items;
    return this;
  }

  fixes(items: FixItem[]): this {
    this._fixes = items;
    return this;
  }

  // ============================================
  // Internal Meta
  // ============================================

  contentHash(hash: string): this {
    this._contentHash = hash;
    return this;
  }

  lastValidated(date: string): this {
    this._lastValidated = date;
    return this;
  }

  generatedDeps(deps: string[]): this {
    this._generatedDeps = deps;
    return this;
  }

  // ============================================
  // Build Methods
  // ============================================

  /**
   * Build metadata as TypeScript code string
   */
  build(): string {
    const lines: string[] = [];
    
    // Header
    lines.push('// ============================================');
    lines.push('// FILE INTROSPECTION METADATA');
    lines.push('// ============================================');
    lines.push('/** @internal Metadata for tooling - not imported by application code */');
    lines.push('export const __metadata = {');
    
    // Required fields
    lines.push(`  module: '${this.escape(this._module)}',`);
    lines.push(`  filename: '${this.escape(this._filename)}',`);
    lines.push(`  description: '${this.escape(this._description)}',`);
    lines.push(`  responsibilities: [${this.formatStringArray(this._responsibilities)}],`);
    lines.push(`  exports: [${this.formatStringArray(this._exports)}],`);
    
    // Dependencies
    lines.push('  dependencies: {');
    lines.push(`    internal: [${this.formatStringArray(this._internalDeps)}],`);
    lines.push(`    external: [${this.formatStringArray(this._externalDeps)}],`);
    lines.push(`    types: [${this.formatStringArray(this._typeDeps)}] as string[]`);
    lines.push('  },');
    
    // Status & dates
    lines.push(`  status: '${this._status}' as const,`);
    lines.push(`  createdAt: '${this._createdAt}',`);
    lines.push(`  updatedAt: '${this._updatedAt}',`);
    
    // Optional fields
    if (this._notes) {
      lines.push(`  notes: '${this.escape(this._notes)}',`);
    }
    if (this._seeAlso && this._seeAlso.length > 0) {
      lines.push(`  seeAlso: [${this.formatStringArray(this._seeAlso)}],`);
    }
    if (this._tags && this._tags.length > 0) {
      lines.push(`  tags: [${this.formatStringArray(this._tags)}],`);
    }
    
    // React section
    if (this.hasReactInfo()) {
      lines.push('  react: {');
      const reactLines: string[] = [];
      
      if (this._componentType) {
        reactLines.push(`    componentType: '${this._componentType}'`);
      }
      if (this._props) {
        const propsStr = this._props.properties
          .map(p => `{ name: '${this.escape(p.name)}', type: '${this.escape(p.type)}', required: ${p.required} }`)
          .join(',\n        ');
        reactLines.push(`    props: {\n      interfaceName: '${this._props.interfaceName}',\n      properties: [\n        ${propsStr}\n      ]\n    }`);
      }
      if (this._hooks && this._hooks.length > 0) {
        const hooksStr = this._hooks
          .map(h => `{ name: '${h.name}', isCustom: ${h.isCustom} }`)
          .join(', ');
        reactLines.push(`    hooks: [${hooksStr}]`);
      }
      if (this._contexts && this._contexts.length > 0) {
        reactLines.push(`    contexts: [${this.formatStringArray(this._contexts)}]`);
      }
      if (this._stateManagement && this._stateManagement.length > 0) {
        reactLines.push(`    stateManagement: [${this.formatStringArray(this._stateManagement)}]`);
      }
      if (this._renders && this._renders.length > 0) {
        reactLines.push(`    renders: [${this.formatStringArray(this._renders)}]`);
      }
      if (this._forwardRef) {
        reactLines.push('    forwardRef: true');
      }
      if (this._memoized) {
        reactLines.push('    memoized: true');
      }
      
      lines.push(reactLines.join(',\n'));
      lines.push('  },');
    }
    
    // Changelog
    if (this._changelog.length > 0) {
      const changelogStr = this._changelog
        .map(entry => {
          const changesStr = entry.changes.map(c => `'${this.escape(c)}'`).join(', ');
          return `{ version: '${entry.version}', date: '${entry.date}', changes: [${changesStr}] }`;
        })
        .join(',\n    ');
      lines.push(`  changelog: [\n    ${changelogStr}\n  ],`);
    } else {
      lines.push(`  changelog: [{ version: '1.0.0', date: '${this._createdAt}', changes: ['Initial implementation'] }],`);
    }
    
    // Todos
    if (this._todos.length > 0) {
      const todosStr = this._todos
        .map(t => `{ id: '${t.id}', description: '${this.escape(t.description)}', priority: '${t.priority}', status: '${t.status}', createdAt: '${t.createdAt}' }`)
        .join(',\n    ');
      lines.push(`  todos: [\n    ${todosStr}\n  ],`);
    } else {
      lines.push('  todos: [] as Array<{ id: string; description: string; priority: string; status: string; createdAt: string }>,');
    }
    
    // Fixes
    if (this._fixes.length > 0) {
      const fixesStr = this._fixes
        .map(f => `{ id: '${f.id}', description: '${this.escape(f.description)}', severity: '${f.severity}', status: '${f.status}', createdAt: '${f.createdAt}' }`)
        .join(',\n    ');
      lines.push(`  fixes: [\n    ${fixesStr}\n  ],`);
    } else {
      lines.push('  fixes: [] as Array<{ id: string; description: string; severity: string; status: string; createdAt: string }>,');
    }
    
    // Internal meta
    lines.push('  _meta: {');
    lines.push(`    contentHash: '${this._contentHash}',`);
    lines.push(`    lastValidated: '${this._lastValidated}',`);
    lines.push(`    generatedDeps: [${this.formatStringArray(this._generatedDeps)}]`);
    lines.push('  }');
    
    lines.push('} as const;');
    
    return lines.join('\n');
  }

  /**
   * Build metadata as object
   */
  buildObject(): Partial<FileMetadata> {
    const obj: Partial<FileMetadata> = {
      module: this._module,
      filename: this._filename,
      description: this._description,
      responsibilities: this._responsibilities,
      exports: this._exports,
      dependencies: {
        internal: this._internalDeps,
        external: this._externalDeps,
        types: this._typeDeps
      },
      status: this._status,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
      changelog: this._changelog.length > 0 ? this._changelog : [
        { version: '1.0.0', date: this._createdAt, author: '', changes: ['Initial implementation'] }
      ],
      todos: this._todos,
      fixes: this._fixes,
      _meta: {
        contentHash: this._contentHash,
        lastValidated: this._lastValidated,
        generatedDeps: this._generatedDeps
      }
    };

    if (this._notes) {obj.notes = this._notes;}
    if (this._seeAlso) {obj.seeAlso = this._seeAlso;}
    if (this._tags) {obj.tags = this._tags;}

    if (this.hasReactInfo()) {
      obj.react = {};
      if (this._componentType) {obj.react.componentType = this._componentType;}
      if (this._props) {obj.react.props = this._props;}
      if (this._hooks) {obj.react.hooks = this._hooks;}
      if (this._contexts) {obj.react.contexts = this._contexts;}
      if (this._stateManagement) {obj.react.stateManagement = this._stateManagement;}
      if (this._renders) {obj.react.renders = this._renders;}
      if (this._forwardRef) {obj.react.forwardRef = this._forwardRef;}
      if (this._memoized) {obj.react.memoized = this._memoized;}
    }

    return obj;
  }

  // ============================================
  // Helpers
  // ============================================

  private escape(str: string): string {
    return str.replace(/'/g, "\\'");
  }

  private formatStringArray(arr: string[]): string {
    if (arr.length === 0) {return '';}
    return arr.map(s => `'${this.escape(s)}'`).join(', ');
  }

  private hasReactInfo(): boolean {
    return !!(
      this._componentType ||
      this._props ||
      (this._hooks && this._hooks.length > 0) ||
      (this._contexts && this._contexts.length > 0) ||
      (this._stateManagement && this._stateManagement.length > 0) ||
      (this._renders && this._renders.length > 0) ||
      this._forwardRef ||
      this._memoized
    );
  }
}


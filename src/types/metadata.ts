/**
 * ts-introspect - File Metadata Types
 *
 * Import these types in your projects:
 * import type { FileMetadata } from 'ts-introspect/types';
 */

// ============================================
// Priority & Status Enums
// ============================================

export type TodoPriority = 'critical' | 'high' | 'medium' | 'low';
export type TodoStatus = 'pending' | 'in-progress' | 'blocked' | 'done';
export type FixSeverity = 'critical' | 'major' | 'minor' | 'trivial';
export type FixStatus = 'open' | 'investigating' | 'fixed';
export type ModuleStatus = 'stable' | 'beta' | 'experimental' | 'deprecated';
export type ComponentType = 'page' | 'layout' | 'feature' | 'ui' | 'provider' | 'hoc' | 'hook';

// ============================================
// Issue Tracking
// ============================================

export interface TodoItem {
  id: string;
  description: string;
  priority: TodoPriority;
  status: TodoStatus;
  assignee?: string;
  createdAt: string;
  targetVersion?: string;
  tags?: string[];
}

export interface FixItem {
  id: string;
  description: string;
  severity: FixSeverity;
  status: FixStatus;
  createdAt: string;
  resolvedAt?: string;
  relatedTodos?: string[];
}

// ============================================
// Changelog
// ============================================

export interface ChangelogEntry {
  version: string;
  date: string;
  author: string;
  changes: string[];
  breaking?: boolean;
}

// ============================================
// Dependencies
// ============================================

export interface DependencyInfo {
  internal: string[];
  external: string[];
  types?: string[];
}

// ============================================
// React-Specific Types
// ============================================

export interface PropInfo {
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

export interface HookInfo {
  name: string;
  isCustom: boolean;
  dependencies?: string[];
}

export interface ReactInfo {
  /** Component classification */
  componentType?: ComponentType;
  /** Props interface name and details */
  props?: {
    interfaceName: string;
    properties: PropInfo[];
  };
  /** Hooks used by this component */
  hooks?: HookInfo[];
  /** Context providers consumed */
  contexts?: string[];
  /** State management (redux, zustand, etc.) */
  stateManagement?: string[];
  /** Child components rendered */
  renders?: string[];
  /** Whether component uses forwardRef */
  forwardRef?: boolean;
  /** Whether component is memoized */
  memoized?: boolean;
}

// ============================================
// Internal Metadata (Auto-managed)
// ============================================

export interface InternalMeta {
  contentHash: string;
  lastValidated: string;
  generatedDeps: string[];
}

// ============================================
// Main File Metadata Interface
// ============================================

export interface FileMetadata {
  // Identity
  module: string;
  filename: string;

  // Documentation
  description: string;
  responsibilities: string[];
  exports: string[];

  // Dependencies
  dependencies: DependencyInfo;

  // Status
  status: ModuleStatus;

  // Timestamps
  createdAt: string;
  updatedAt: string;

  // History
  changelog: ChangelogEntry[];

  // Issues
  todos: TodoItem[];
  fixes: FixItem[];

  // Optional
  notes?: string;
  seeAlso?: string[];
  tags?: string[];

  // React-specific (for .tsx files)
  react?: ReactInfo;

  // Internal (auto-managed)
  _meta: InternalMeta;
}

// Partial metadata for index/barrel files
export type IndexMetadata = Pick<FileMetadata, 'module' | 'filename' | 'description'> & {
  reexports: string[];
};

// Type guard
export function isFullMetadata(meta: FileMetadata | IndexMetadata): meta is FileMetadata {
  return 'responsibilities' in meta;
}


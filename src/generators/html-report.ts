/**
 * HTML Report Generator
 *
 * Generates comprehensive HTML reports for project introspection
 * with a refined, editorial design aesthetic
 */

import type { FileMetadata } from '../types/metadata.js';
import type {
  IntrospectionRegistry,
  TodoWithModule,
  FixWithModule,
  RegistrySummary,
} from '../core/registry.js';
import type { FileUsageInfo } from '../core/analyzer.js';
import { generateGraphVisualizationScript } from './graph-visualization.js';
import { logger } from '../cli/logger.js';
import {
  type Theme,
  getTheme,
  getAvailableThemes,
  generateFullCss,
  CSS_STYLES,
} from './themes/index.js';

// ============================================
// Types
// ============================================

export type ThemeName = 'classic' | 'dark' | 'light' | 'dracula' | 'nord';

export interface HtmlReportOptions {
  /** Theme name: 'classic' (default), 'dark', 'light', 'dracula', 'nord', or custom */
  theme?: string;
  /** Custom theme object (takes precedence over theme name) */
  customTheme?: Theme;
}

export interface HtmlReportData {
  projectName: string;
  generatedAt: string;
  summary: RegistrySummary;
  modules: FileMetadata[];
  todos: TodoWithModule[];
  fixes: FixWithModule[];
  recentlyUpdated: FileMetadata[];
  dependencyGraph?: Map<string, FileUsageInfo>;
  circularDeps?: string[][];
  unusedModules?: string[];
}

// ============================================
// Utilities
// ============================================

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angle: number
): { x: number; y: number } {
  const rad = ((angle - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

// ============================================
// Chart Generators
// ============================================

function generateProgressRing(percentage: number): string {
    const circumference = 2 * Math.PI * 42;
    const offset = circumference - (percentage / 100) * circumference;
  
    return `
      <svg class="progress-ring" viewBox="0 0 100 100">
        <defs>
          <linearGradient id="progress-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#22d3ee" />
            <stop offset="100%" stop-color="#a78bfa" />
          </linearGradient>
        </defs>
        <circle class="progress-ring-bg" cx="50" cy="50" r="42" />
        <circle 
          class="progress-ring-fill" 
          cx="50" cy="50" r="42"
          stroke-dasharray="${circumference}"
          stroke-dashoffset="${offset}"
        />
        <text class="progress-text" x="50" y="47" text-anchor="middle">${Math.round(percentage)}%</text>
        <text class="progress-label" x="50" y="60" text-anchor="middle">coverage</text>
      </svg>
    `;
  }
  
  function generateDonutChart(
    data: { label: string; value: number; color: string }[]
  ): string {
    const total = data.reduce((sum, d) => sum + d.value, 0);
    if (total === 0) {
      return '<p style="color: var(--text-muted); text-align: center;">No data available</p>';
    }
  
    let currentAngle = 0;
    const paths: string[] = [];
    const cx = 80,
      cy = 80,
      r = 65,
      innerR = 40;
  
    for (const item of data) {
      if (item.value === 0) {continue;}
  
      const angle = (item.value / total) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
  
      const start1 = polarToCartesian(cx, cy, r, startAngle);
      const end1 = polarToCartesian(cx, cy, r, endAngle);
      const start2 = polarToCartesian(cx, cy, innerR, endAngle);
      const end2 = polarToCartesian(cx, cy, innerR, startAngle);
  
      const largeArc = angle > 180 ? 1 : 0;
  
      paths.push(`
        <path
          d="M ${start1.x} ${start1.y}
             A ${r} ${r} 0 ${largeArc} 1 ${end1.x} ${end1.y}
             L ${start2.x} ${start2.y}
             A ${innerR} ${innerR} 0 ${largeArc} 0 ${end2.x} ${end2.y}
             Z"
          fill="${item.color}"
        >
          <title>${item.label}: ${item.value} (${Math.round((item.value / total) * 100)}%)</title>
        </path>
      `);
  
      currentAngle = endAngle;
    }
  
    const legend = data
      .filter((d) => d.value > 0)
      .map(
        (d) => `
      <div class="legend-item">
        <span class="legend-dot" style="background: ${d.color}"></span>
        <span>${d.label}: ${d.value}</span>
      </div>
    `
      )
      .join('');
  
    return `
      <svg class="donut-chart" viewBox="0 0 160 160">
        ${paths.join('')}
        <text x="80" y="76" text-anchor="middle" font-size="24" font-weight="700" fill="var(--text-primary)">${total}</text>
        <text x="80" y="92" text-anchor="middle" font-size="11" fill="var(--text-muted)">total</text>
      </svg>
      <div class="chart-legend">${legend}</div>
    `;
  }
  
  function generateBarChart(
    data: { label: string; value: number; color: string }[]
  ): string {
    const maxValue = Math.max(...data.map((d) => d.value), 1);
  
    const bars = data
      .map((d) => {
        const width = (d.value / maxValue) * 100;
        return `
        <div class="bar-row">
          <span class="bar-label">${d.label}</span>
          <div class="bar-track">
            <div class="bar-fill ${d.label.toLowerCase()}" style="width: ${Math.max(width, d.value > 0 ? 12 : 0)}%">
              ${d.value > 0 ? d.value : ''}
            </div>
          </div>
        </div>
      `;
      })
      .join('');
  
    return `<div class="bar-chart">${bars}</div>`;
  }
// ============================================
// Section Generators
// ============================================

function generateSummarySection(data: HtmlReportData, totalFiles: number): string {
  const coverage =
    totalFiles > 0 ? Math.round((data.summary.totalModules / totalFiles) * 100) : 0;

  return `
    <section id="summary" class="section">
      <div class="section-header">
        <div class="section-icon">📊</div>
        <h2 class="section-title">Project Summary</h2>
      </div>
      
      <div class="stats-grid">
        <div class="stat-card">
          <div class="progress-container">
            ${generateProgressRing(coverage)}
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${data.summary.totalModules}</div>
          <div class="stat-label">Documented Modules</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${totalFiles}</div>
          <div class="stat-label">Total Files</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${data.summary.todoCount}</div>
          <div class="stat-label">Open TODOs</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${data.summary.fixCount}</div>
          <div class="stat-label">Open Fixes</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${data.summary.recentlyUpdated}</div>
          <div class="stat-label">Updated (7d)</div>
        </div>
      </div>
      
      <div class="status-row">
        <div class="status-pill stable">
          <span>✓ Stable</span>
          <span class="status-count">${data.summary.statusBreakdown.stable}</span>
        </div>
        <div class="status-pill beta">
          <span>◐ Beta</span>
          <span class="status-count">${data.summary.statusBreakdown.beta}</span>
        </div>
        <div class="status-pill experimental">
          <span>⚗ Experimental</span>
          <span class="status-count">${data.summary.statusBreakdown.experimental}</span>
        </div>
        <div class="status-pill deprecated">
          <span>⚠ Deprecated</span>
          <span class="status-count">${data.summary.statusBreakdown.deprecated}</span>
        </div>
      </div>
    </section>
  `;
}

function generateChartsSection(data: HtmlReportData): string {
  const statusData = [
    { label: 'Stable', value: data.summary.statusBreakdown.stable, color: '#4ade80' },
    { label: 'Beta', value: data.summary.statusBreakdown.beta, color: '#60a5fa' },
    { label: 'Experimental', value: data.summary.statusBreakdown.experimental, color: '#fbbf24' },
    { label: 'Deprecated', value: data.summary.statusBreakdown.deprecated, color: '#f87171' },
  ];

  const todoPriorities = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const todo of data.todos) {
    if (todo.priority in todoPriorities) {
      todoPriorities[todo.priority as keyof typeof todoPriorities]++;
    }
  }

  const todoData = [
    { label: 'Critical', value: todoPriorities.critical, color: '#f87171' },
    { label: 'High', value: todoPriorities.high, color: '#fb923c' },
    { label: 'Medium', value: todoPriorities.medium, color: '#fbbf24' },
    { label: 'Low', value: todoPriorities.low, color: '#60a5fa' },
  ];

  return `
    <section id="charts" class="section">
      <div class="section-header">
        <div class="section-icon">📈</div>
        <h2 class="section-title">Analytics</h2>
      </div>
      
      <div class="charts-row">
        <div class="chart-card">
          <h4 class="chart-title">Status Distribution</h4>
          ${generateDonutChart(statusData)}
        </div>
        <div class="chart-card">
          <h4 class="chart-title">TODO Priorities</h4>
          ${data.todos.length > 0 ? generateBarChart(todoData) : '<p style="color: var(--text-muted); text-align: center; padding: 40px 0;">No TODOs 🎉</p>'}
        </div>
      </div>
    </section>
  `;
}

function generateDependencyGraphSection(data: HtmlReportData): string {
  if (!data.dependencyGraph || data.dependencyGraph.size === 0) {
    return '';
  }

  const nodes: { id: string; group: string; deps: number; usedBy: number }[] = [];
  const links: { source: string; target: string }[] = [];

  for (const [module, info] of data.dependencyGraph) {
    let group = 'other';
    if (module.startsWith('core/')) {group = 'core';}
    else if (module.startsWith('types/')) {group = 'types';}
    else if (module.startsWith('utils/')) {group = 'utils';}
    else if (module.startsWith('config/')) {group = 'config';}
    else if (module.startsWith('tools/')) {group = 'tools';}
    else if (module.startsWith('agents/')) {group = 'agents';}

    nodes.push({
      id: module,
      group,
      deps: info.uses.length,
      usedBy: info.usedBy.length,
    });

    for (const dep of info.uses) {
      if (data.dependencyGraph.has(dep)) {
        links.push({ source: module, target: dep });
      }
    }
  }

  const graphScript = generateGraphVisualizationScript({ nodes, links });

  return `
    <section id="graph" class="section">
      <div class="section-header">
        <div class="section-icon">🕸️</div>
        <h2 class="section-title">Dependency Graph</h2>
      </div>
      
      <div class="graph-wrapper">
        <div class="graph-toolbar">
          <input type="text" class="graph-search" placeholder="Search modules..." id="graph-search">
          <div class="graph-filters">
            <button class="graph-filter-btn active" data-filter="all">All</button>
            <button class="graph-filter-btn" data-filter="core">Core</button>
            <button class="graph-filter-btn" data-filter="tools">Tools</button>
            <button class="graph-filter-btn" data-filter="config">Config</button>
            <button class="graph-filter-btn" data-filter="agents">Agents</button>
          </div>
          <div class="graph-controls">
            <button class="graph-control-btn" id="zoom-in" title="Zoom In">+</button>
            <button class="graph-control-btn" id="zoom-out" title="Zoom Out">−</button>
            <button class="graph-control-btn" id="zoom-reset" title="Reset">⟲</button>
          </div>
        </div>
        
        <div class="graph-canvas" id="dependency-graph">
          <div class="graph-tooltip" id="graph-tooltip"></div>
        </div>
        
        <div class="graph-legend">
          <div class="legend-item"><span class="legend-dot" style="background: #60a5fa"></span> Core</div>
          <div class="legend-item"><span class="legend-dot" style="background: #4ade80"></span> Tools</div>
          <div class="legend-item"><span class="legend-dot" style="background: #fbbf24"></span> Config</div>
          <div class="legend-item"><span class="legend-dot" style="background: #a78bfa"></span> Agents</div>
          <div class="legend-item"><span class="legend-dot" style="background: #f472b6"></span> Utils</div>
          <div class="legend-item"><span class="legend-dot" style="background: #a1a1aa"></span> Other</div>
        </div>
      </div>
    </section>
    
    <script>${graphScript}</script>
  `;
}

function generateModulesSection(modules: FileMetadata[]): string {
  if (modules.length === 0) {
    return `
      <section id="modules" class="section">
        <div class="section-header">
          <div class="section-icon">📦</div>
          <h2 class="section-title">Modules</h2>
        </div>
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <p class="empty-title">No modules with metadata found</p>
          <p class="empty-desc">Run <code>tsi generate</code> to add metadata to your files.</p>
        </div>
      </section>
    `;
  }

  const moduleCards = modules
    .map(
      (m) => `
    <div class="module-card">
      <div class="module-header">
        <span class="module-name">${escapeHtml(m.module)}</span>
        <span class="badge ${m.status}">${m.status}</span>
      </div>
      <p class="module-desc">${escapeHtml(m.description)}</p>
      <div class="module-meta">
        <span class="module-meta-item">📄 ${escapeHtml(m.filename)}</span>
        <span class="module-meta-item">📅 ${m.updatedAt}</span>
        ${m.exports.length > 0 ? `<span class="module-meta-item">📤 ${m.exports.length} exports</span>` : ''}
        ${m.todos.length > 0 ? `<span class="module-meta-item">📋 ${m.todos.length} TODOs</span>` : ''}
        ${m.fixes.length > 0 ? `<span class="module-meta-item">🔧 ${m.fixes.length} fixes</span>` : ''}
      </div>
    </div>
  `
    )
    .join('');

  return `
    <section id="modules" class="section">
      <div class="section-header">
        <div class="section-icon">📦</div>
        <h2 class="section-title">Modules</h2>
        <span class="section-count">${modules.length}</span>
      </div>
      <div class="module-grid">${moduleCards}</div>
    </section>
  `;
}

function generateTodosSection(todos: TodoWithModule[]): string {
  if (todos.length === 0) {
    return `
      <section id="todos" class="section">
        <div class="section-header">
          <div class="section-icon">📋</div>
          <h2 class="section-title">TODOs</h2>
        </div>
        <div class="empty-state">
          <div class="empty-icon">✅</div>
          <p class="empty-title">No open TODOs</p>
          <p class="empty-desc">Great job keeping your codebase clean!</p>
        </div>
      </section>
    `;
  }

  const rows = todos
    .map(
      (t) => `
    <tr>
      <td><span class="badge ${t.priority}">${t.priority}</span></td>
      <td><span class="cell-module">${escapeHtml(t.module)}</span></td>
      <td class="cell-desc">${escapeHtml(t.description)}</td>
      <td><span class="badge ${t.status.replace('_', '-')}">${t.status}</span></td>
      <td class="cell-date">${t.createdAt}</td>
    </tr>
  `
    )
    .join('');

  return `
    <section id="todos" class="section">
      <div class="section-header">
        <div class="section-icon">📋</div>
        <h2 class="section-title">TODOs</h2>
        <span class="section-count">${todos.length}</span>
      </div>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Priority</th>
              <th>Module</th>
              <th>Description</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>
  `;
}

function generateFixesSection(fixes: FixWithModule[]): string {
  if (fixes.length === 0) {
    return `
      <section id="fixes" class="section">
        <div class="section-header">
          <div class="section-icon">🔧</div>
          <h2 class="section-title">Fixes</h2>
        </div>
        <div class="empty-state">
          <div class="empty-icon">🎉</div>
          <p class="empty-title">No open fixes</p>
          <p class="empty-desc">All issues have been resolved!</p>
        </div>
      </section>
    `;
  }

  const rows = fixes
    .map(
      (f) => `
    <tr>
      <td><span class="badge ${f.severity}">${f.severity}</span></td>
      <td><span class="cell-module">${escapeHtml(f.module)}</span></td>
      <td class="cell-desc">${escapeHtml(f.description)}</td>
      <td><span class="badge ${f.status}">${f.status}</span></td>
    </tr>
  `
    )
    .join('');

  return `
    <section id="fixes" class="section">
      <div class="section-header">
        <div class="section-icon">🔧</div>
        <h2 class="section-title">Fixes</h2>
        <span class="section-count">${fixes.length}</span>
      </div>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Severity</th>
              <th>Module</th>
              <th>Description</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>
  `;
}

function generateRecentSection(modules: FileMetadata[]): string {
  if (modules.length === 0) {
    return '';
  }

  const rows = modules
    .slice(0, 10)
    .map(
      (m) => `
    <tr>
      <td><span class="cell-module">${escapeHtml(m.module)}</span></td>
      <td class="cell-desc">${escapeHtml(m.description.substring(0, 80))}${m.description.length > 80 ? '...' : ''}</td>
      <td><span class="badge ${m.status}">${m.status}</span></td>
      <td class="cell-date">${m.updatedAt}</td>
    </tr>
  `
    )
    .join('');

  return `
    <section id="recent" class="section">
      <div class="section-header">
        <div class="section-icon">🕐</div>
        <h2 class="section-title">Recently Updated</h2>
        <span class="section-count">${Math.min(modules.length, 10)}</span>
      </div>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Module</th>
              <th>Description</th>
              <th>Status</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>
  `;
}

function generateDepsSection(data: HtmlReportData): string {
  if (!data.dependencyGraph || data.dependencyGraph.size === 0) {
    return '';
  }

  let content = '';

  // Circular dependencies
  if (data.circularDeps && data.circularDeps.length > 0) {
    const cycles = data.circularDeps
      .map(
        (cycle) => `
      <div class="cycle-item">
        ${cycle.map((m) => `<span class="cycle-node">${escapeHtml(m)}</span>`).join('<span class="cycle-arrow">→</span>')}
        <span class="cycle-arrow">→</span>
        <span class="cycle-node">${escapeHtml(cycle[0] ?? '')}</span>
      </div>
    `
      )
      .join('');

    content += `
      <div class="warning-box">
        <h4 class="warning-title">⚠️ Circular Dependencies (${data.circularDeps.length})</h4>
        <p class="warning-desc">Circular dependencies can cause initialization issues and make code harder to maintain.</p>
        ${cycles}
      </div>
    `;
  }

  // Unused modules
  if (data.unusedModules && data.unusedModules.length > 0) {
    content += `
      <div class="unused-box">
        <h4 class="unused-title">⚠️ Potentially Unused Modules (${data.unusedModules.length})</h4>
        <p class="warning-desc">These modules are not imported by any other module. They may be entry points or candidates for removal.</p>
        <div class="unused-list">
          ${data.unusedModules.map((m) => `<span class="unused-item">${escapeHtml(m)}</span>`).join('')}
        </div>
      </div>
    `;
  }

  // Stats
  let totalDeps = 0;
  let maxDeps = 0;
  let maxDepsModule = '';
  let maxUsedBy = 0;
  let maxUsedByModule = '';

  for (const [module, info] of data.dependencyGraph) {
    totalDeps += info.uses.length;
    if (info.uses.length > maxDeps) {
      maxDeps = info.uses.length;
      maxDepsModule = module;
    }
    if (info.usedBy.length > maxUsedBy) {
      maxUsedBy = info.usedBy.length;
      maxUsedByModule = module;
    }
  }

  content += `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${data.dependencyGraph.size}</div>
        <div class="stat-label">Total Modules</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${totalDeps}</div>
        <div class="stat-label">Total Dependencies</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="font-size: 18px; color: var(--text-primary);">${escapeHtml(maxDepsModule.split('/').pop() ?? maxDepsModule)}</div>
        <div class="stat-label">Most Dependencies (${maxDeps})</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="font-size: 18px; color: var(--text-primary);">${escapeHtml(maxUsedByModule.split('/').pop() ?? maxUsedByModule)}</div>
        <div class="stat-label">Most Used (${maxUsedBy})</div>
      </div>
    </div>
  `;

  return `
    <section id="deps" class="section">
      <div class="section-header">
        <div class="section-icon">📊</div>
        <h2 class="section-title">Dependency Analysis</h2>
      </div>
      ${content}
    </section>
  `;
}

// ============================================
// Main Export
// ============================================

export function generateHtmlReport(
  data: HtmlReportData,
  totalFiles = 0,
  options: HtmlReportOptions = {}
): string {
  // Resolve theme
  let css = CSS_STYLES;
  if (options.customTheme) {
    css = generateFullCss(options.customTheme);
  } else if (options.theme && options.theme !== 'classic') {
    const theme = getTheme(options.theme);
    if (theme) {
      css = generateFullCss(theme);
    } else {
      logger.warn(`Theme '${options.theme}' not found. Available: ${getAvailableThemes().join(', ')}. Using 'classic'.`);
    }
  }

  const navLinks = [
    { href: '#summary', icon: '📊', label: 'Summary' },
    { href: '#charts', icon: '📈', label: 'Charts' },
    ...(data.dependencyGraph ? [{ href: '#graph', icon: '🕸️', label: 'Graph' }] : []),
    { href: '#modules', icon: '📦', label: 'Modules' },
    { href: '#todos', icon: '📋', label: 'TODOs' },
    { href: '#fixes', icon: '🔧', label: 'Fixes' },
    ...(data.recentlyUpdated.length > 0 ? [{ href: '#recent', icon: '🕐', label: 'Recent' }] : []),
    ...(data.dependencyGraph ? [{ href: '#deps', icon: '📊', label: 'Dependencies' }] : []),
  ];

  const navHtml = navLinks
    .map((link) => `<a href="${link.href}" class="nav-link">${link.icon} ${link.label}</a>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(data.projectName)} — Introspection Report</title>
  <script src="https://unpkg.com/lucide@latest"></script>
  <style>${css}</style>
</head>
<body>
  <div class="wrapper">
    <header class="header">
      <div class="header-content">
        <p class="header-eyebrow">Introspection Report</p>
        <h1>${escapeHtml(data.projectName)}</h1>
        <p class="header-meta">Generated ${data.generatedAt}</p>
      </div>
    </header>

    <nav class="nav">
      <div class="nav-inner">${navHtml}</div>
    </nav>

    <main>
      ${generateSummarySection(data, totalFiles)}
      ${generateChartsSection(data)}
      ${generateDependencyGraphSection(data)}
      ${generateModulesSection(data.modules)}
      ${generateTodosSection(data.todos)}
      ${generateFixesSection(data.fixes)}
      ${generateRecentSection(data.recentlyUpdated)}
      ${generateDepsSection(data)}
    </main>

    <footer class="footer">
      <p class="footer-text">
        Generated by <a href="https://github.com/your-org/ts-introspect" class="footer-link">ts-introspect</a>
      </p>
    </footer>
  </div>

  <script>
    // Initialize Lucide icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }

    // Smooth scroll navigation
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', e => {
        const href = link.getAttribute('href');
        if (href?.startsWith('#')) {
          e.preventDefault();
          document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });

    // Filter buttons
    document.querySelectorAll('.graph-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.graph-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  </script>
</body>
</html>`;
}

export async function generateReportData(
  registry: IntrospectionRegistry,
  projectName: string,
  dependencyGraph?: Map<string, FileUsageInfo>,
  circularDeps?: string[][],
  unusedModules?: string[]
): Promise<HtmlReportData> {
  const data: HtmlReportData = {
    projectName,
    generatedAt: new Date().toLocaleString(),
    summary: registry.getSummary(),
    modules: registry.getFullModules(),
    todos: registry.getAllTodos(),
    fixes: registry.getAllFixes(),
    recentlyUpdated: registry.getRecentlyUpdated(7),
  };

  if (dependencyGraph) {
    data.dependencyGraph = dependencyGraph;
  }
  if (circularDeps) {
    data.circularDeps = circularDeps;
  }
  if (unusedModules) {
    data.unusedModules = unusedModules;
  }

  return data;
}
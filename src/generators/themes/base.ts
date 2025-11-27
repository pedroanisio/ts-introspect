/**
 * Theme Base System
 *
 * Core theme types, registry, and shared CSS
 */

// ============================================
// Theme Types
// ============================================

export interface ThemeVariables {
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  bgElevated: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderSubtle: string;
  accent: string;
  accentSecondary: string;
  success: string;
  warning: string;
  error: string;
  info: string;
}

export interface Theme {
  name: string;
  displayName: string;
  variables: ThemeVariables;
}

// ============================================
// Theme Registry
// ============================================

const themes = new Map<string, Theme>();

export function registerTheme(theme: Theme): void {
  themes.set(theme.name, theme);
}

export function getTheme(name: string): Theme | undefined {
  return themes.get(name);
}

export function getAvailableThemes(): string[] {
  return Array.from(themes.keys());
}

export function getAllThemes(): Theme[] {
  return Array.from(themes.values());
}

// ============================================
// CSS Variable Generation
// ============================================

export function generateCssVariables(theme: Theme): string {
  const v = theme.variables;
  return `
  --bg-primary: ${v.bgPrimary};
  --bg-secondary: ${v.bgSecondary};
  --bg-tertiary: ${v.bgTertiary};
  --bg-elevated: ${v.bgElevated};
  --text-primary: ${v.textPrimary};
  --text-secondary: ${v.textSecondary};
  --text-muted: ${v.textMuted};
  --border: ${v.border};
  --border-subtle: ${v.borderSubtle};
  --accent: ${v.accent};
  --accent-secondary: ${v.accentSecondary};
  --success: ${v.success};
  --warning: ${v.warning};
  --error: ${v.error};
  --info: ${v.info};`;
}

// ============================================
// Base CSS (shared across all themes)
// ============================================

export const BASE_CSS = `
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Satoshi:wght@400;500;700;900&display=swap');

*, *::before, *::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  font-family: var(--font-display);
  background: var(--bg-primary);
  color: var(--text-primary);
  line-height: 1.6;
  min-height: 100vh;
  font-size: 15px;
}

/* Layout */
.wrapper {
  max-width: 1320px;
  margin: 0 auto;
  padding: 0 24px;
}

/* Header */
.header {
  padding: 80px 0 60px;
  position: relative;
  overflow: hidden;
}

.header::before {
  content: '';
  position: absolute;
  inset: 0;
  background: 
    radial-gradient(ellipse 80% 50% at 50% -20%, color-mix(in srgb, var(--accent) 15%, transparent), transparent),
    radial-gradient(ellipse 60% 40% at 80% 60%, color-mix(in srgb, var(--accent-secondary) 10%, transparent), transparent);
  pointer-events: none;
}

.header-content {
  position: relative;
  z-index: 1;
}

.header-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 16px;
}

.header-eyebrow::before {
  content: '';
  width: 24px;
  height: 1px;
  background: var(--accent);
}

.header h1 {
  font-size: clamp(2.5rem, 5vw, 4rem);
  font-weight: 900;
  letter-spacing: -0.03em;
  line-height: 1.1;
  margin-bottom: 12px;
  background: linear-gradient(135deg, var(--text-primary) 0%, var(--text-secondary) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.header-meta {
  font-size: 14px;
  color: var(--text-muted);
  font-family: var(--font-mono);
}

/* Navigation */
.nav {
  position: sticky;
  top: 0;
  z-index: 100;
  background: color-mix(in srgb, var(--bg-primary) 85%, transparent);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
  padding: 16px 0;
  margin-bottom: 48px;
}

.nav-inner {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.nav-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  text-decoration: none;
  border-radius: var(--radius-sm);
  transition: var(--transition);
}

.nav-link:hover {
  color: var(--text-primary);
  background: var(--bg-tertiary);
}

/* Sections */
.section {
  margin-bottom: 64px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}

.section-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  background: var(--bg-tertiary);
  font-size: 18px;
}

.section-title {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.section-count {
  margin-left: auto;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  font-family: var(--font-mono);
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
}

.stat-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 24px;
  transition: var(--transition);
}

.stat-card:hover {
  border-color: var(--border-subtle);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.stat-value {
  font-size: 32px;
  font-weight: 900;
  letter-spacing: -0.03em;
  color: var(--accent);
  line-height: 1;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 13px;
  color: var(--text-muted);
  font-weight: 500;
}

/* Status Pills */
.status-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.status-pill {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  flex: 1;
  min-width: 140px;
}

.status-pill.stable {
  background: color-mix(in srgb, var(--success) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--success) 20%, transparent);
  color: var(--success);
}

.status-pill.beta {
  background: color-mix(in srgb, var(--info) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--info) 20%, transparent);
  color: var(--info);
}

.status-pill.experimental {
  background: color-mix(in srgb, var(--warning) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--warning) 20%, transparent);
  color: var(--warning);
}

.status-pill.deprecated {
  background: color-mix(in srgb, var(--error) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--error) 20%, transparent);
  color: var(--error);
}

.status-count {
  font-family: var(--font-mono);
  font-weight: 700;
  font-size: 18px;
  margin-left: auto;
}

/* Progress Ring */
.progress-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.progress-ring {
  width: 100px;
  height: 100px;
}

.progress-ring-bg {
  fill: none;
  stroke: var(--bg-tertiary);
  stroke-width: 8;
}

.progress-ring-fill {
  fill: none;
  stroke: url(#progress-gradient);
  stroke-width: 8;
  stroke-linecap: round;
  transform: rotate(-90deg);
  transform-origin: center;
  transition: stroke-dashoffset 0.6s ease;
}

.progress-text {
  font-size: 20px;
  font-weight: 700;
  fill: var(--text-primary);
}

.progress-label {
  font-size: 10px;
  fill: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Tables */
.table-container {
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

thead {
  background: var(--bg-tertiary);
}

th {
  padding: 14px 16px;
  text-align: left;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  white-space: nowrap;
}

td {
  padding: 14px 16px;
  border-top: 1px solid var(--border);
  vertical-align: top;
}

tr:hover td {
  background: color-mix(in srgb, var(--text-primary) 2%, transparent);
}

.cell-module {
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--accent);
}

.cell-desc {
  color: var(--text-secondary);
  max-width: 400px;
}

.cell-date {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
}

/* Badges */
.badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  border-radius: 999px;
  white-space: nowrap;
}

.badge.critical { background: color-mix(in srgb, var(--error) 15%, transparent); color: var(--error); }
.badge.high, .badge.major { background: color-mix(in srgb, #fb923c 15%, transparent); color: #fb923c; }
.badge.medium { background: color-mix(in srgb, var(--warning) 15%, transparent); color: var(--warning); }
.badge.low, .badge.minor { background: color-mix(in srgb, var(--info) 15%, transparent); color: var(--info); }
.badge.trivial { background: color-mix(in srgb, var(--text-secondary) 15%, transparent); color: var(--text-secondary); }
.badge.stable { background: color-mix(in srgb, var(--success) 15%, transparent); color: var(--success); }
.badge.beta { background: color-mix(in srgb, var(--info) 15%, transparent); color: var(--info); }
.badge.experimental { background: color-mix(in srgb, var(--warning) 15%, transparent); color: var(--warning); }
.badge.deprecated { background: color-mix(in srgb, var(--error) 15%, transparent); color: var(--error); }
.badge.pending { background: color-mix(in srgb, var(--warning) 15%, transparent); color: var(--warning); }
.badge.in-progress { background: color-mix(in srgb, var(--info) 15%, transparent); color: var(--info); }
.badge.completed { background: color-mix(in srgb, var(--success) 15%, transparent); color: var(--success); }
.badge.open { background: color-mix(in srgb, var(--error) 15%, transparent); color: var(--error); }
.badge.investigating { background: color-mix(in srgb, var(--accent-secondary) 15%, transparent); color: var(--accent-secondary); }

/* Module Grid */
.module-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 16px;
}

.module-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 20px;
  transition: var(--transition);
}

.module-card:hover {
  border-color: var(--border-subtle);
  box-shadow: var(--shadow-sm);
}

.module-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.module-name {
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 600;
  color: var(--accent);
  word-break: break-word;
}

.module-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-bottom: 16px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.module-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 12px;
  color: var(--text-muted);
}

.module-meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Charts */
.charts-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
  margin-bottom: 32px;
}

.chart-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 24px;
}

.chart-title {
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin-bottom: 20px;
  text-align: center;
}

.donut-chart {
  display: block;
  width: 160px;
  height: 160px;
  margin: 0 auto 16px;
}

.chart-legend {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
  margin-top: 16px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* Bar Chart */
.bar-chart {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.bar-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.bar-label {
  width: 70px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  text-align: right;
  flex-shrink: 0;
}

.bar-track {
  flex: 1;
  height: 28px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 10px;
  font-size: 12px;
  font-weight: 600;
  color: white;
  min-width: fit-content;
  transition: width 0.5s ease;
}

.bar-fill.critical { background: linear-gradient(90deg, #dc2626, #f87171); }
.bar-fill.high { background: linear-gradient(90deg, #ea580c, #fb923c); }
.bar-fill.medium { background: linear-gradient(90deg, #ca8a04, #fbbf24); }
.bar-fill.low { background: linear-gradient(90deg, #2563eb, #60a5fa); }

/* Graph Section */
.graph-wrapper {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.graph-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
}

.graph-search {
  padding: 8px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 13px;
  font-family: var(--font-mono);
  width: 200px;
  outline: none;
  transition: var(--transition);
}

.graph-search:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 15%, transparent);
}

.graph-search::placeholder {
  color: var(--text-muted);
}

.graph-filters {
  display: flex;
  gap: 4px;
}

.graph-filter-btn {
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: var(--transition);
}

.graph-filter-btn:hover {
  color: var(--text-primary);
  background: var(--bg-elevated);
}

.graph-filter-btn.active {
  color: var(--bg-primary);
  background: var(--accent);
  border-color: var(--accent);
}

.graph-controls {
  display: flex;
  gap: 4px;
  margin-left: auto;
}

.graph-control-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: var(--transition);
}

.graph-control-btn:hover {
  color: var(--text-primary);
  background: var(--bg-elevated);
}

.graph-canvas {
  position: relative;
  width: 100%;
  height: 500px;
}

.graph-canvas svg {
  width: 100%;
  height: 100%;
}

.graph-tooltip {
  position: absolute;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  padding: 12px;
  font-size: 13px;
  pointer-events: none;
  z-index: 1000;
  max-width: 260px;
  box-shadow: var(--shadow-lg);
  opacity: 0;
  transition: opacity 0.15s;
}

.graph-tooltip.visible {
  opacity: 1;
}

.graph-tooltip-title {
  font-family: var(--font-mono);
  font-weight: 600;
  color: var(--accent);
  margin-bottom: 8px;
  word-break: break-word;
}

.graph-tooltip-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.graph-tooltip-stat {
  text-align: center;
  padding: 6px;
  background: var(--bg-secondary);
  border-radius: 4px;
}

.graph-tooltip-stat-value {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}

.graph-tooltip-stat-label {
  font-size: 10px;
  color: var(--text-muted);
  text-transform: uppercase;
}

.graph-legend {
  display: flex;
  justify-content: center;
  gap: 16px;
  padding: 16px;
  border-top: 1px solid var(--border);
  flex-wrap: wrap;
}

.graph-node {
  cursor: pointer;
  transition: opacity 0.2s;
}

.graph-node circle {
  transition: var(--transition);
}

.graph-node:hover circle {
  filter: brightness(1.2);
}

.graph-node.dimmed {
  opacity: 0.15;
}

.graph-node text {
  font-size: 10px;
  fill: var(--text-primary);
  pointer-events: none;
}

.graph-link {
  stroke: var(--border-subtle);
  stroke-opacity: 0.5;
  fill: none;
  transition: var(--transition);
}

.graph-link.highlighted {
  stroke: var(--accent);
  stroke-opacity: 1;
  stroke-width: 2;
}

.graph-link.dimmed {
  stroke-opacity: 0.1;
}

/* Dependency Warnings */
.warning-box {
  background: color-mix(in srgb, var(--error) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--error) 20%, transparent);
  border-radius: var(--radius-md);
  padding: 20px;
  margin-bottom: 24px;
}

.warning-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--error);
  margin-bottom: 12px;
}

.warning-desc {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 16px;
}

.cycle-item {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.cycle-node {
  display: inline-flex;
  padding: 4px 10px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 12px;
}

.cycle-arrow {
  color: var(--text-muted);
  font-size: 12px;
}

/* Unused Modules */
.unused-box {
  background: color-mix(in srgb, var(--warning) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--warning) 20%, transparent);
  border-radius: var(--radius-md);
  padding: 20px;
  margin-bottom: 24px;
}

.unused-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--warning);
  margin-bottom: 12px;
}

.unused-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.unused-item {
  display: inline-flex;
  padding: 6px 12px;
  background: color-mix(in srgb, var(--warning) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--warning) 20%, transparent);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--warning);
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.empty-desc {
  font-size: 13px;
  color: var(--text-muted);
}

.empty-desc code {
  background: var(--bg-tertiary);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: var(--font-mono);
}

/* Footer */
.footer {
  border-top: 1px solid var(--border);
  padding: 40px 0;
  margin-top: 80px;
  text-align: center;
}

.footer-text {
  font-size: 13px;
  color: var(--text-muted);
}

.footer-link {
  color: var(--accent);
  text-decoration: none;
}

.footer-link:hover {
  text-decoration: underline;
}

/* Scrollbar */
::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

::-webkit-scrollbar-track {
  background: var(--bg-secondary);
}

::-webkit-scrollbar-thumb {
  background: var(--bg-tertiary);
  border-radius: 5px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--bg-elevated);
}

/* Responsive */
@media (max-width: 768px) {
  .wrapper {
    padding: 0 16px;
  }

  .header {
    padding: 48px 0 40px;
  }

  .header h1 {
    font-size: 2rem;
  }

  .module-grid {
    grid-template-columns: 1fr;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .status-row {
    flex-direction: column;
  }

  .graph-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .graph-search {
    width: 100%;
  }

  .graph-controls {
    margin-left: 0;
  }
}

/* Print */
@media print {
  body {
    background: white;
    color: black;
  }

  .nav {
    display: none;
  }

  .section {
    break-inside: avoid;
  }
}
`;

// ============================================
// CSS Generation
// ============================================

export function generateFullCss(theme: Theme): string {
  return `:root {
  --font-display: 'Satoshi', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 12px 40px rgba(0, 0, 0, 0.5);
  --transition: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
${generateCssVariables(theme)}
}
${BASE_CSS}`;
}

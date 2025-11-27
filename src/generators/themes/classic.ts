/**
 * Classic Theme
 *
 * Clean, editorial design with cyan accent
 */

import { type Theme, registerTheme, generateFullCss } from './base.js';

export const classicTheme: Theme = {
  name: 'classic',
  displayName: 'Classic',
  variables: {
    bgPrimary: '#09090b',
    bgSecondary: '#18181b',
    bgTertiary: '#27272a',
    bgElevated: '#3f3f46',
    textPrimary: '#fafafa',
    textSecondary: '#a1a1aa',
    textMuted: '#71717a',
    border: '#27272a',
    borderSubtle: '#3f3f46',
    accent: '#22d3ee',
    accentSecondary: '#a78bfa',
    success: '#4ade80',
    warning: '#fbbf24',
    error: '#f87171',
    info: '#60a5fa',
  },
};

registerTheme(classicTheme);

export const CSS_STYLES = generateFullCss(classicTheme);

/**
 * Dark Theme
 *
 * GitHub-inspired dark theme
 */

import { type Theme, registerTheme, generateFullCss } from './base.js';

export const darkTheme: Theme = {
  name: 'dark',
  displayName: 'Dark',
  variables: {
    bgPrimary: '#0d1117',
    bgSecondary: '#161b22',
    bgTertiary: '#21262d',
    bgElevated: '#30363d',
    textPrimary: '#f0f6fc',
    textSecondary: '#8b949e',
    textMuted: '#6e7681',
    border: '#30363d',
    borderSubtle: '#484f58',
    accent: '#58a6ff',
    accentSecondary: '#a371f7',
    success: '#3fb950',
    warning: '#d29922',
    error: '#f85149',
    info: '#58a6ff',
  },
};

registerTheme(darkTheme);

export const CSS_STYLES_DARK = generateFullCss(darkTheme);

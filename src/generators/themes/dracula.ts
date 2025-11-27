/**
 * Dracula Theme
 *
 * Popular dark theme with vibrant colors
 * Inspired by https://draculatheme.com/
 */

import { type Theme, registerTheme, generateFullCss } from './base.js';

export const draculaTheme: Theme = {
  name: 'dracula',
  displayName: 'Dracula',
  variables: {
    bgPrimary: '#282a36',
    bgSecondary: '#1e1f29',
    bgTertiary: '#343746',
    bgElevated: '#44475a',
    textPrimary: '#f8f8f2',
    textSecondary: '#bfbfbf',
    textMuted: '#6272a4',
    border: '#44475a',
    borderSubtle: '#6272a4',
    accent: '#8be9fd',
    accentSecondary: '#bd93f9',
    success: '#50fa7b',
    warning: '#f1fa8c',
    error: '#ff5555',
    info: '#8be9fd',
  },
};

registerTheme(draculaTheme);

export const CSS_STYLES_DRACULA = generateFullCss(draculaTheme);

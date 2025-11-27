/**
 * Light Theme
 *
 * Clean, bright theme for daytime use
 */

import { type Theme, registerTheme, generateFullCss } from './base.js';

export const lightTheme: Theme = {
  name: 'light',
  displayName: 'Light',
  variables: {
    bgPrimary: '#ffffff',
    bgSecondary: '#f6f8fa',
    bgTertiary: '#eaeef2',
    bgElevated: '#d0d7de',
    textPrimary: '#1f2328',
    textSecondary: '#656d76',
    textMuted: '#8c959f',
    border: '#d0d7de',
    borderSubtle: '#afb8c1',
    accent: '#0969da',
    accentSecondary: '#8250df',
    success: '#1a7f37',
    warning: '#9a6700',
    error: '#cf222e',
    info: '#0969da',
  },
};

registerTheme(lightTheme);

export const CSS_STYLES_LIGHT = generateFullCss(lightTheme);

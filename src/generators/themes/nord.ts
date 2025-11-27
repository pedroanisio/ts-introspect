/**
 * Nord Theme
 *
 * Arctic, north-bluish color palette
 * Inspired by https://nordtheme.com/
 */

import { type Theme, registerTheme, generateFullCss } from './base.js';

export const nordTheme: Theme = {
  name: 'nord',
  displayName: 'Nord',
  variables: {
    bgPrimary: '#2e3440',
    bgSecondary: '#3b4252',
    bgTertiary: '#434c5e',
    bgElevated: '#4c566a',
    textPrimary: '#eceff4',
    textSecondary: '#d8dee9',
    textMuted: '#81a1c1',
    border: '#4c566a',
    borderSubtle: '#5e6779',
    accent: '#88c0d0',
    accentSecondary: '#b48ead',
    success: '#a3be8c',
    warning: '#ebcb8b',
    error: '#bf616a',
    info: '#81a1c1',
  },
};

registerTheme(nordTheme);

export const CSS_STYLES_NORD = generateFullCss(nordTheme);

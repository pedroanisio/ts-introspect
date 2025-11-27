/**
 * Theme System
 *
 * Re-exports all themes and utilities
 */

// Base utilities
export {
  type Theme,
  type ThemeVariables,
  registerTheme,
  getTheme,
  getAvailableThemes,
  getAllThemes,
  generateCssVariables,
  generateFullCss,
  BASE_CSS,
} from './base.js';

// Individual themes
export { classicTheme, CSS_STYLES } from './classic.js';
export { darkTheme, CSS_STYLES_DARK } from './dark.js';
export { lightTheme, CSS_STYLES_LIGHT } from './light.js';
export { draculaTheme, CSS_STYLES_DRACULA } from './dracula.js';
export { nordTheme, CSS_STYLES_NORD } from './nord.js';

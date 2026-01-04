/**
 * Shared font types for consistency across main and renderer processes
 */

export type FontCategory =
  | 'monospace'
  | 'serif'
  | 'sans-serif'
  | 'display'
  | 'other';

export interface SystemFont {
  name: string;
  category: FontCategory;
}

export interface FontConfig {
  family: string;
  size: number;
}

export interface FontSettings {
  editor: FontConfig;
  table: FontConfig;
  ui: FontConfig;
  syncAll: boolean;
}

// UI font category labels
export const FONT_CATEGORY_LABELS: Record<FontCategory, string> = {
  monospace: 'Monospace',
  'sans-serif': 'Sans-Serif',
  serif: 'Serif',
  display: 'Display',
  other: 'Other',
};

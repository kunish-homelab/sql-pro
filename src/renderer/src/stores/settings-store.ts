import type { FontConfig, FontSettings } from '@shared/types/font';
import type { RendererSettingsState } from '@shared/types/renderer-store';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createHybridStorage } from '@/lib/electron-storage';

// Common monospace fonts available on different platforms
export const MONOSPACE_FONTS = [
  { name: 'System Default', value: '' },
  { name: 'SF Mono', value: 'SF Mono' },
  { name: 'Menlo', value: 'Menlo' },
  { name: 'Monaco', value: 'Monaco' },
  { name: 'Consolas', value: 'Consolas' },
  { name: 'Fira Code', value: 'Fira Code' },
  { name: 'JetBrains Mono', value: 'JetBrains Mono' },
  { name: 'Source Code Pro', value: 'Source Code Pro' },
  { name: 'IBM Plex Mono', value: 'IBM Plex Mono' },
  { name: 'Cascadia Code', value: 'Cascadia Code' },
  { name: 'Ubuntu Mono', value: 'Ubuntu Mono' },
  { name: 'Roboto Mono', value: 'Roboto Mono' },
  { name: 'Hack', value: 'Hack' },
  { name: 'Inconsolata', value: 'Inconsolata' },
] as const;

// Font categories (app-level categories: editor, table, ui)
export type AppFontCategory = 'editor' | 'table' | 'ui';

// Page size options for data browser
export const PAGE_SIZE_OPTIONS = [50, 100, 200, 500, 1000, 'all'] as const;
export type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];

interface SettingsState {
  // Vim modes (independent)
  editorVimMode: boolean; // Monaco editor vim mode
  appVimMode: boolean; // Sidebar + DataTable vim navigation

  // Font settings
  fonts: FontSettings;

  // Tab settings
  tabSize: number;

  // Data browser settings
  pageSize: PageSizeOption;

  // Session settings
  restoreSession: boolean;

  // Sidebar settings
  sidebarCollapsed: boolean;

  // Actions
  setEditorVimMode: (enabled: boolean) => void;
  setAppVimMode: (enabled: boolean) => void;
  setFont: (category: AppFontCategory, config: Partial<FontConfig>) => void;
  setSyncAll: (sync: boolean) => void;
  setTabSize: (size: number) => void;
  setPageSize: (size: PageSizeOption) => void;
  setRestoreSession: (enabled: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
}

const DEFAULT_FONT_CONFIG: FontConfig = {
  family: '',
  size: 14,
};

const DEFAULT_FONTS: FontSettings = {
  editor: { ...DEFAULT_FONT_CONFIG },
  table: { ...DEFAULT_FONT_CONFIG },
  ui: { ...DEFAULT_FONT_CONFIG, size: 13 },
  syncAll: true,
};

// Migration function to handle old settings format (from localStorage)
interface OldSettingsFormat {
  editorMode?: 'vim' | 'normal';
  fontSize?: number;
  fontFamily?: string;
  tabSize?: number;
}

function migrateOldSettings(
  persisted: unknown
): Partial<RendererSettingsState> | undefined {
  if (!persisted || typeof persisted !== 'object') return undefined;

  const old = persisted as OldSettingsFormat & Partial<RendererSettingsState>;

  // Check if already migrated (has fonts object)
  if ('fonts' in old && old.fonts) {
    return old as Partial<RendererSettingsState>;
  }

  // Migrate from old format
  const editorVimMode = old.editorMode === 'vim';
  const fontSize = old.fontSize ?? 14;
  const fontFamily = old.fontFamily ?? '';

  return {
    editorVimMode,
    appVimMode: false,
    fonts: {
      editor: { family: fontFamily, size: fontSize },
      table: { family: fontFamily, size: fontSize },
      ui: { family: fontFamily, size: 13 },
      syncAll: true,
    },
    tabSize: old.tabSize ?? 2,
  };
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      // Default to vim mode for editor
      editorVimMode: true,
      appVimMode: false,

      fonts: DEFAULT_FONTS,

      tabSize: 2,

      pageSize: 100,

      restoreSession: true,

      sidebarCollapsed: false,

      setEditorVimMode: (enabled) => set({ editorVimMode: enabled }),

      setAppVimMode: (enabled) => set({ appVimMode: enabled }),

      setFont: (category, config) => {
        const { fonts } = get();
        const newConfig = { ...fonts[category], ...config };

        if (fonts.syncAll) {
          // Sync all fonts when syncAll is enabled
          set({
            fonts: {
              ...fonts,
              editor: { ...newConfig },
              table: { ...newConfig },
              ui: { ...newConfig },
            },
          });
        } else {
          // Only update the specific category
          set({
            fonts: {
              ...fonts,
              [category]: newConfig,
            },
          });
        }
      },

      setSyncAll: (sync) => {
        const { fonts } = get();
        if (sync) {
          // When enabling sync, use editor font as the source of truth
          const editorFont = fonts.editor;
          set({
            fonts: {
              editor: { ...editorFont },
              table: { ...editorFont },
              ui: { ...editorFont },
              syncAll: true,
            },
          });
        } else {
          set({
            fonts: {
              ...fonts,
              syncAll: false,
            },
          });
        }
      },

      setTabSize: (size) => set({ tabSize: size }),

      setPageSize: (size) => set({ pageSize: size }),

      setRestoreSession: (enabled) => set({ restoreSession: enabled }),

      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
    }),
    {
      name: 'settings', // Store key in electron-store
      storage: createHybridStorage('settings'),
      migrate: migrateOldSettings,
      version: 2, // Bump version for electron-store migration
    }
  )
);

// Re-export shared types for convenience
export type { FontConfig, FontSettings } from '@shared/types/font';

// Selector hooks for convenience
export const useEditorFont = () => useSettingsStore((s) => s.fonts.editor);
export const useTableFont = () => useSettingsStore((s) => s.fonts.table);
export const useUIFont = () => useSettingsStore((s) => s.fonts.ui);
export const usePageSize = () => useSettingsStore((s) => s.pageSize);

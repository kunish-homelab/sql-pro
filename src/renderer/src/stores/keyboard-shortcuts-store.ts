import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Modifier keys for shortcuts
 */
export interface ShortcutModifiers {
  cmd?: boolean; // Cmd on Mac, Ctrl on Windows/Linux
  ctrl?: boolean; // Always Ctrl (rarely used, mainly for Ctrl+K/J vim-style)
  shift?: boolean;
  alt?: boolean;
}

/**
 * A keyboard shortcut binding
 */
export interface ShortcutBinding {
  key: string; // The key (e.g., 'k', 'Enter', 'ArrowUp')
  modifiers: ShortcutModifiers;
}

/**
 * All available shortcut actions in the application
 */
export type ShortcutAction =
  // Navigation
  | 'nav.data-browser'
  | 'nav.query-editor'
  | 'nav.search-tables'
  | 'nav.schema-compare'
  // View
  | 'view.toggle-history'
  // Actions
  | 'action.command-palette'
  | 'action.refresh-schema'
  | 'action.refresh-table'
  | 'action.execute-query'
  | 'action.view-changes'
  | 'action.open-database'
  | 'action.new-window'
  // Settings
  | 'settings.open'
  // Help
  | 'help.shortcuts';

/**
 * Metadata for each shortcut action
 */
export interface ShortcutActionMeta {
  id: ShortcutAction;
  label: string;
  description: string;
  category: 'navigation' | 'view' | 'actions' | 'settings' | 'help';
  // Some shortcuts can be disabled (e.g., editor-specific ones)
  scope?: 'global' | 'editor' | 'data-grid';
}

/**
 * All available shortcut actions with metadata
 */
export const SHORTCUT_ACTIONS: ShortcutActionMeta[] = [
  // Navigation
  {
    id: 'nav.data-browser',
    label: 'Open Data Browser',
    description: 'Switch to the data browser tab',
    category: 'navigation',
    scope: 'global',
  },
  {
    id: 'nav.query-editor',
    label: 'Open SQL Query',
    description: 'Switch to the query editor tab',
    category: 'navigation',
    scope: 'global',
  },
  {
    id: 'nav.search-tables',
    label: 'Search Tables',
    description: 'Focus the table search input',
    category: 'navigation',
    scope: 'global',
  },
  {
    id: 'nav.schema-compare',
    label: 'Open Schema Compare',
    description: 'Switch to the schema comparison tab',
    category: 'navigation',
    scope: 'global',
  },
  // View
  {
    id: 'view.toggle-history',
    label: 'Toggle Query History',
    description: 'Show or hide the query history panel',
    category: 'view',
    scope: 'global',
  },
  // Actions
  {
    id: 'action.command-palette',
    label: 'Command Palette',
    description: 'Open the command palette',
    category: 'actions',
    scope: 'global',
  },
  {
    id: 'action.refresh-schema',
    label: 'Refresh Schema',
    description: 'Reload the database schema',
    category: 'actions',
    scope: 'global',
  },
  {
    id: 'action.refresh-table',
    label: 'Refresh Table',
    description: 'Reload the current table data',
    category: 'actions',
    scope: 'global',
  },
  {
    id: 'action.execute-query',
    label: 'Execute Query',
    description: 'Run the current SQL query',
    category: 'actions',
    scope: 'editor',
  },
  {
    id: 'action.view-changes',
    label: 'View Unsaved Changes',
    description: 'Open the pending changes diff preview',
    category: 'actions',
    scope: 'global',
  },
  {
    id: 'action.open-database',
    label: 'Open Database',
    description: 'Open a database file',
    category: 'actions',
    scope: 'global',
  },
  {
    id: 'action.new-window',
    label: 'New Window',
    description: 'Open a new application window',
    category: 'actions',
    scope: 'global',
  },
  // Settings
  {
    id: 'settings.open',
    label: 'Open Settings',
    description: 'Open the settings dialog',
    category: 'settings',
    scope: 'global',
  },
  // Help
  {
    id: 'help.shortcuts',
    label: 'Show Keyboard Shortcuts',
    description: 'Open the keyboard shortcuts help',
    category: 'help',
    scope: 'global',
  },
];

/**
 * A complete shortcut preset configuration
 */
export type ShortcutPreset = Record<ShortcutAction, ShortcutBinding | null>;

/**
 * Available preset names
 */
export type PresetName = 'default' | 'vscode' | 'sublime' | 'custom';

/**
 * Default shortcuts (SQL Pro native)
 */
export const DEFAULT_SHORTCUTS: ShortcutPreset = {
  'nav.data-browser': { key: '1', modifiers: { cmd: true } },
  'nav.query-editor': { key: '2', modifiers: { cmd: true } },
  'nav.search-tables': { key: 'p', modifiers: { cmd: true, shift: true } },
  'nav.schema-compare': { key: '5', modifiers: { cmd: true } },
  'view.toggle-history': { key: 'h', modifiers: { cmd: true } },
  'action.command-palette': { key: 'k', modifiers: { cmd: true } },
  'action.refresh-schema': { key: 'r', modifiers: { cmd: true, shift: true } },
  'action.refresh-table': { key: 'r', modifiers: { cmd: true } },
  'action.execute-query': { key: 'Enter', modifiers: { cmd: true } },
  'action.view-changes': { key: 's', modifiers: { cmd: true, shift: true } },
  'action.open-database': { key: 'o', modifiers: { cmd: true } },
  'action.new-window': { key: 'n', modifiers: { cmd: true, shift: true } },
  'settings.open': { key: ',', modifiers: { cmd: true } },
  'help.shortcuts': { key: '/', modifiers: { cmd: true } },
};

/**
 * VS Code-style shortcuts
 */
export const VSCODE_SHORTCUTS: ShortcutPreset = {
  'nav.data-browser': { key: '1', modifiers: { cmd: true } },
  'nav.query-editor': { key: '2', modifiers: { cmd: true } },
  'nav.search-tables': { key: 'p', modifiers: { cmd: true } },
  'nav.schema-compare': { key: '5', modifiers: { cmd: true } },
  'view.toggle-history': { key: 'h', modifiers: { cmd: true, shift: true } },
  'action.command-palette': { key: 'p', modifiers: { cmd: true, shift: true } },
  'action.refresh-schema': { key: 'r', modifiers: { cmd: true, shift: true } },
  'action.refresh-table': { key: 'r', modifiers: { cmd: true } },
  'action.execute-query': { key: 'Enter', modifiers: { cmd: true } },
  'action.view-changes': { key: 's', modifiers: { cmd: true, shift: true } },
  'action.open-database': { key: 'o', modifiers: { cmd: true } },
  'action.new-window': { key: 'n', modifiers: { cmd: true, shift: true } },
  'settings.open': { key: ',', modifiers: { cmd: true } },
  'help.shortcuts': { key: 'k', modifiers: { cmd: true } },
};

/**
 * Sublime Text-style shortcuts
 */
export const SUBLIME_SHORTCUTS: ShortcutPreset = {
  'nav.data-browser': { key: '1', modifiers: { cmd: true } },
  'nav.query-editor': { key: '2', modifiers: { cmd: true } },
  'nav.search-tables': { key: 'p', modifiers: { cmd: true } },
  'nav.schema-compare': { key: '5', modifiers: { cmd: true } },
  'view.toggle-history': { key: 'h', modifiers: { cmd: true, alt: true } },
  'action.command-palette': { key: 'p', modifiers: { cmd: true, shift: true } },
  'action.refresh-schema': { key: 'r', modifiers: { cmd: true, shift: true } },
  'action.refresh-table': { key: 'r', modifiers: { cmd: true } },
  'action.execute-query': { key: 'b', modifiers: { cmd: true } },
  'action.view-changes': { key: 's', modifiers: { cmd: true, shift: true } },
  'action.open-database': { key: 'o', modifiers: { cmd: true } },
  'action.new-window': { key: 'n', modifiers: { cmd: true, shift: true } },
  'settings.open': { key: ',', modifiers: { cmd: true } },
  'help.shortcuts': { key: '/', modifiers: { cmd: true } },
};

/**
 * All available presets
 */
export const SHORTCUT_PRESETS: Record<
  Exclude<PresetName, 'custom'>,
  ShortcutPreset
> = {
  default: DEFAULT_SHORTCUTS,
  vscode: VSCODE_SHORTCUTS,
  sublime: SUBLIME_SHORTCUTS,
};

/**
 * Preset metadata
 */
export const PRESET_INFO: Record<
  PresetName,
  { label: string; description: string }
> = {
  default: {
    label: 'SQL Pro',
    description: 'Default SQL Pro shortcuts',
  },
  vscode: {
    label: 'VS Code',
    description: 'Visual Studio Code-style shortcuts',
  },
  sublime: {
    label: 'Sublime Text',
    description: 'Sublime Text-style shortcuts',
  },
  custom: {
    label: 'Custom',
    description: 'Your customized shortcuts',
  },
};

/**
 * Check if the current platform is Mac
 */
export const isMac = (): boolean =>
  typeof navigator !== 'undefined' && navigator.platform.includes('Mac');

/**
 * Format a shortcut binding for display
 */
export function formatShortcutBinding(binding: ShortcutBinding | null): string {
  if (!binding) return 'Not set';

  const mac = isMac();
  const parts: string[] = [];

  if (binding.modifiers.cmd) {
    parts.push(mac ? '⌘' : 'Ctrl');
  }
  if (binding.modifiers.ctrl && !binding.modifiers.cmd) {
    parts.push('Ctrl');
  }
  if (binding.modifiers.alt) {
    parts.push(mac ? '⌥' : 'Alt');
  }
  if (binding.modifiers.shift) {
    parts.push(mac ? '⇧' : 'Shift');
  }

  // Format special keys
  let keyDisplay = binding.key;
  if (binding.key === 'Enter') keyDisplay = '↵';
  else if (binding.key === 'Escape') keyDisplay = 'Esc';
  else if (binding.key === 'ArrowUp') keyDisplay = '↑';
  else if (binding.key === 'ArrowDown') keyDisplay = '↓';
  else if (binding.key === 'ArrowLeft') keyDisplay = '←';
  else if (binding.key === 'ArrowRight') keyDisplay = '→';
  else keyDisplay = binding.key.toUpperCase();

  parts.push(keyDisplay);

  return mac ? parts.join('') : parts.join('+');
}

/**
 * Parse a keyboard event into a shortcut binding
 */
export function parseKeyboardEvent(e: KeyboardEvent): ShortcutBinding | null {
  // Ignore modifier-only key presses
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
    return null;
  }

  return {
    key: e.key.length === 1 ? e.key.toLowerCase() : e.key,
    modifiers: {
      cmd: e.metaKey || e.ctrlKey,
      shift: e.shiftKey,
      alt: e.altKey,
    },
  };
}

/**
 * Check if a keyboard event matches a shortcut binding
 */
export function matchesBinding(
  e: KeyboardEvent,
  binding: ShortcutBinding | null
): boolean {
  if (!binding) return false;

  const cmdOrCtrl = e.metaKey || e.ctrlKey;
  const matchesCmdOrCtrl = binding.modifiers.cmd ? cmdOrCtrl : !cmdOrCtrl;
  const matchesShift = binding.modifiers.shift ? e.shiftKey : !e.shiftKey;
  const matchesAlt = binding.modifiers.alt ? e.altKey : !e.altKey;

  // Normalize key comparison
  const eventKey = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const bindingKey =
    binding.key.length === 1 ? binding.key.toLowerCase() : binding.key;

  return (
    matchesCmdOrCtrl && matchesShift && matchesAlt && eventKey === bindingKey
  );
}

/**
 * Check if two bindings are the same
 */
export function bindingsEqual(
  a: ShortcutBinding | null,
  b: ShortcutBinding | null
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;

  return (
    a.key.toLowerCase() === b.key.toLowerCase() &&
    !!a.modifiers.cmd === !!b.modifiers.cmd &&
    !!a.modifiers.ctrl === !!b.modifiers.ctrl &&
    !!a.modifiers.shift === !!b.modifiers.shift &&
    !!a.modifiers.alt === !!b.modifiers.alt
  );
}

/**
 * Export format for shortcuts
 */
export interface ShortcutsExport {
  version: number;
  preset: PresetName;
  shortcuts: ShortcutPreset;
  exportedAt: string;
}

interface KeyboardShortcutsState {
  // Current preset
  activePreset: PresetName;

  // Custom shortcuts (used when preset is 'custom')
  customShortcuts: ShortcutPreset;

  // Vim mode shortcuts are separate
  vimShortcutsEnabled: boolean;

  // Actions
  setPreset: (preset: PresetName) => void;
  setShortcut: (
    action: ShortcutAction,
    binding: ShortcutBinding | null
  ) => void;
  resetToPreset: (preset: Exclude<PresetName, 'custom'>) => void;
  getShortcut: (action: ShortcutAction) => ShortcutBinding | null;
  getActiveShortcuts: () => ShortcutPreset;
  findConflicts: (
    action: ShortcutAction,
    binding: ShortcutBinding
  ) => ShortcutAction[];
  setVimShortcutsEnabled: (enabled: boolean) => void;
  exportShortcuts: () => ShortcutsExport;
  importShortcuts: (data: ShortcutsExport) => boolean;
}

export const useKeyboardShortcutsStore = create<KeyboardShortcutsState>()(
  persist(
    (set, get) => ({
      activePreset: 'default',
      customShortcuts: { ...DEFAULT_SHORTCUTS },
      vimShortcutsEnabled: true,

      setPreset: (preset) => set({ activePreset: preset }),

      setShortcut: (action, binding) => {
        const { customShortcuts } = get();
        set({
          activePreset: 'custom',
          customShortcuts: {
            ...customShortcuts,
            [action]: binding,
          },
        });
      },

      resetToPreset: (preset) => {
        set({
          activePreset: preset,
          customShortcuts: { ...SHORTCUT_PRESETS[preset] },
        });
      },

      getShortcut: (action) => {
        const { activePreset, customShortcuts } = get();
        if (activePreset === 'custom') {
          return customShortcuts[action];
        }
        return SHORTCUT_PRESETS[activePreset][action];
      },

      getActiveShortcuts: () => {
        const { activePreset, customShortcuts } = get();
        if (activePreset === 'custom') {
          return customShortcuts;
        }
        return SHORTCUT_PRESETS[activePreset];
      },

      findConflicts: (action, binding) => {
        const shortcuts = get().getActiveShortcuts();
        const conflicts: ShortcutAction[] = [];

        for (const [otherAction, otherBinding] of Object.entries(shortcuts)) {
          if (otherAction !== action && bindingsEqual(binding, otherBinding)) {
            conflicts.push(otherAction as ShortcutAction);
          }
        }

        return conflicts;
      },

      setVimShortcutsEnabled: (enabled) =>
        set({ vimShortcutsEnabled: enabled }),

      exportShortcuts: () => {
        const { activePreset, customShortcuts } = get();
        return {
          version: 1,
          preset: activePreset,
          shortcuts:
            activePreset === 'custom'
              ? customShortcuts
              : SHORTCUT_PRESETS[activePreset],
          exportedAt: new Date().toISOString(),
        };
      },

      importShortcuts: (data) => {
        try {
          if (data.version !== 1) {
            console.error('Unsupported shortcuts export version');
            return false;
          }

          // Validate all actions exist
          const validActions = new Set(SHORTCUT_ACTIONS.map((a) => a.id));
          for (const action of Object.keys(data.shortcuts)) {
            if (!validActions.has(action as ShortcutAction)) {
              console.error(`Unknown shortcut action: ${action}`);
              return false;
            }
          }

          set({
            activePreset: 'custom',
            customShortcuts: data.shortcuts,
          });

          return true;
        } catch (error) {
          console.error('Failed to import shortcuts:', error);
          return false;
        }
      },
    }),
    {
      name: 'sql-pro-keyboard-shortcuts',
      version: 1,
    }
  )
);

// Selector hooks
export const useShortcut = (action: ShortcutAction) =>
  useKeyboardShortcutsStore((s) => s.getShortcut(action));

export const useActiveShortcuts = () =>
  useKeyboardShortcutsStore((s) => s.getActiveShortcuts());

import type { LucideIcon } from 'lucide-react';
import { create } from 'zustand';

export interface Command {
  id: string;
  label: string;
  shortcut?: string; // Display format like "⌘K" or "Ctrl+K"
  icon?: LucideIcon;
  category: 'navigation' | 'view' | 'actions' | 'settings' | 'help';
  keywords?: string[]; // Additional search terms
  action: () => void;
  disabled?: () => boolean;
}

interface CommandPaletteState {
  isOpen: boolean;
  search: string;
  selectedIndex: number;
  commands: Command[];

  // Actions
  open: () => void;
  close: () => void;
  toggle: () => void;
  setSearch: (search: string) => void;
  setSelectedIndex: (index: number) => void;
  registerCommand: (command: Command) => void;
  registerCommands: (commands: Command[]) => void;
  unregisterCommand: (id: string) => void;
  executeCommand: (id: string) => void;
  executeSelected: () => void;
  moveSelection: (direction: 'up' | 'down') => void;
}

export const useCommandPaletteStore = create<CommandPaletteState>()(
  (set, get) => ({
    isOpen: false,
    search: '',
    selectedIndex: 0,
    commands: [],

    open: () => set({ isOpen: true, search: '', selectedIndex: 0 }),
    close: () => set({ isOpen: false, search: '', selectedIndex: 0 }),
    toggle: () => {
      const { isOpen } = get();
      if (isOpen) {
        get().close();
      } else {
        get().open();
      }
    },

    setSearch: (search) => set({ search, selectedIndex: 0 }),
    setSelectedIndex: (selectedIndex) => set({ selectedIndex }),

    registerCommand: (command) => {
      set((state) => {
        // Avoid duplicates
        if (state.commands.some((c) => c.id === command.id)) {
          return state;
        }
        return { commands: [...state.commands, command] };
      });
    },

    registerCommands: (commands) => {
      const { commands: existingCommands } = get();
      const existingIds = new Set(existingCommands.map((c) => c.id));
      const newCommands = commands.filter((c) => !existingIds.has(c.id));

      // Only update if there are actually new commands to add
      if (newCommands.length > 0) {
        set({ commands: [...existingCommands, ...newCommands] });
      }
    },

    unregisterCommand: (id) => {
      set((state) => ({
        commands: state.commands.filter((c) => c.id !== id),
      }));
    },

    executeCommand: (id) => {
      const { commands, close } = get();
      const command = commands.find((c) => c.id === id);
      if (command && !command.disabled?.()) {
        close();
        // Execute after closing to ensure UI updates first
        setTimeout(() => command.action(), 0);
      }
    },

    executeSelected: () => {
      const { commands, search, selectedIndex, executeCommand } = get();
      const filtered = getFilteredCommands(commands, search);
      const selected = filtered[selectedIndex];
      if (selected) {
        executeCommand(selected.id);
      }
    },

    moveSelection: (direction) => {
      const { commands, search, selectedIndex } = get();
      const filtered = getFilteredCommands(commands, search);
      const maxIndex = filtered.length - 1;

      if (direction === 'up') {
        set({ selectedIndex: Math.max(0, selectedIndex - 1) });
      } else {
        set({ selectedIndex: Math.min(maxIndex, selectedIndex + 1) });
      }
    },
  })
);

// Category order for consistent sorting (must match UI)
const CATEGORY_ORDER = ['actions', 'navigation', 'view', 'settings', 'help'];

// Helper function to filter commands based on search
export function getFilteredCommands(
  commands: Command[],
  search: string
): Command[] {
  const filtered = commands.filter((c) => !c.disabled?.());

  let matched: Command[];

  if (!search.trim()) {
    matched = filtered;
  } else {
    const query = search.toLowerCase().trim();

    matched = filtered.filter((command) => {
      const label = command.label.toLowerCase();
      const category = command.category.toLowerCase();
      const keywords = command.keywords?.join(' ').toLowerCase() || '';

      return (
        label.includes(query) ||
        category.includes(query) ||
        keywords.includes(query)
      );
    });
  }

  // Sort by category order to match UI display order
  return matched.sort((a, b) => {
    const aIndex = CATEGORY_ORDER.indexOf(a.category);
    const bIndex = CATEGORY_ORDER.indexOf(b.category);

    if (aIndex !== bIndex) {
      return aIndex - bIndex;
    }

    // Within same category, sort by label
    return a.label.localeCompare(b.label);
  });
}

// Selector for filtered commands
export const useFilteredCommands = () =>
  useCommandPaletteStore((state) =>
    getFilteredCommands(state.commands, state.search)
  );

// Helper to format shortcuts for display
export function formatShortcut(
  key: string,
  modifiers: { cmd?: boolean; ctrl?: boolean; shift?: boolean; alt?: boolean }
): string {
  const isMac =
    typeof navigator !== 'undefined' && navigator.platform.includes('Mac');
  const parts: string[] = [];

  if (modifiers.cmd || modifiers.ctrl) {
    parts.push(isMac ? '⌘' : 'Ctrl');
  }
  if (modifiers.alt) {
    parts.push(isMac ? '⌥' : 'Alt');
  }
  if (modifiers.shift) {
    parts.push(isMac ? '⇧' : 'Shift');
  }

  parts.push(key.toUpperCase());

  return isMac ? parts.join('') : parts.join('+');
}

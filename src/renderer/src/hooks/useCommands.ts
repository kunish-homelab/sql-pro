import type { Command } from '@/stores';
import { useNavigate } from '@tanstack/react-router';
import {
  Code,
  Database,
  FileDown,
  FileText,
  GitCompare,
  HelpCircle,
  History,
  Keyboard,
  Monitor,
  Moon,
  PanelLeft,
  RefreshCw,
  Search,
  Settings,
  Sun,
  Table,
  X,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import { sqlPro } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import {
  formatShortcutBinding,
  matchesBinding,
  useChangesStore,
  useCommandPaletteStore,
  useConnectionStore,
  useKeyboardShortcutsStore,
  useSettingsStore,
  useTableDataStore,
  useThemeStore,
} from '@/stores';

/**
 * Hook that registers all application commands and sets up the global keyboard shortcut.
 * Should be called once at the app root level.
 */
export function useCommands() {
  const navigate = useNavigate();
  const toggle = useCommandPaletteStore((s) => s.toggle);
  const registerCommands = useCommandPaletteStore((s) => s.registerCommands);

  // Use refs to store latest values for use in command actions
  // This prevents re-registering commands when these values change
  const themeStoreRef = useRef(useThemeStore.getState());
  const connectionStoreRef = useRef(useConnectionStore.getState());
  const changesStoreRef = useRef(useChangesStore.getState());
  const tableDataStoreRef = useRef(useTableDataStore.getState());
  const settingsStoreRef = useRef(useSettingsStore.getState());
  const shortcutsStoreRef = useRef(useKeyboardShortcutsStore.getState());

  // Keep refs up to date
  useEffect(() => {
    const unsubTheme = useThemeStore.subscribe((s) => {
      themeStoreRef.current = s;
    });
    const unsubConnection = useConnectionStore.subscribe((s) => {
      connectionStoreRef.current = s;
    });
    const unsubChanges = useChangesStore.subscribe((s) => {
      changesStoreRef.current = s;
    });
    const unsubTableData = useTableDataStore.subscribe((s) => {
      tableDataStoreRef.current = s;
    });
    const unsubSettings = useSettingsStore.subscribe((s) => {
      settingsStoreRef.current = s;
    });
    const unsubShortcuts = useKeyboardShortcutsStore.subscribe((s) => {
      shortcutsStoreRef.current = s;
    });

    return () => {
      unsubTheme();
      unsubConnection();
      unsubChanges();
      unsubTableData();
      unsubSettings();
      unsubShortcuts();
    };
  }, []);

  // Global keyboard shortcuts - now using customizable shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const { getShortcut } = shortcutsStoreRef.current;

      // Command palette shortcut
      const commandPaletteBinding = getShortcut('action.command-palette');
      if (matchesBinding(e, commandPaletteBinding)) {
        e.preventDefault();
        toggle();
        return;
      }

      // Refresh table shortcut (prevent browser refresh)
      const refreshTableBinding = getShortcut('action.refresh-table');
      if (matchesBinding(e, refreshTableBinding)) {
        e.preventDefault();
        const { activeConnectionId } = connectionStoreRef.current;
        if (activeConnectionId) {
          queryClient.invalidateQueries({
            queryKey: ['tableData', activeConnectionId],
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggle]);

  // Register commands only once on mount
  useEffect(() => {
    // Helper to get formatted shortcut from store
    const getShortcutDisplay = (actionId: string): string | undefined => {
      const binding = shortcutsStoreRef.current.getShortcut(
        actionId as Parameters<typeof shortcutsStoreRef.current.getShortcut>[0]
      );
      return binding ? formatShortcutBinding(binding) : undefined;
    };

    const commands: Command[] = [
      // Navigation commands
      {
        id: 'nav.data-browser',
        label: 'Open Data Browser',
        shortcut: getShortcutDisplay('nav.data-browser'),
        icon: Table,
        category: 'navigation',
        keywords: ['data', 'browser', 'table'],
        action: () => {
          document
            .querySelector<HTMLButtonElement>('[data-tab="data"]')
            ?.click();
        },
      },
      {
        id: 'nav.query-editor',
        label: 'Open SQL Query',
        shortcut: getShortcutDisplay('nav.query-editor'),
        icon: Code,
        category: 'navigation',
        keywords: ['sql', 'query', 'editor'],
        action: () => {
          document
            .querySelector<HTMLButtonElement>('[data-tab="query"]')
            ?.click();
        },
      },
      {
        id: 'nav.search-tables',
        label: 'Search Tables',
        shortcut: getShortcutDisplay('nav.search-tables'),
        icon: Search,
        category: 'navigation',
        keywords: ['search', 'tables', 'find', 'filter'],
        action: () => {
          document
            .querySelector<HTMLInputElement>('input[placeholder*="Search"]')
            ?.focus();
        },
      },
      {
        id: 'nav.schema-compare',
        label: 'Open Schema Compare',
        shortcut: getShortcutDisplay('nav.schema-compare'),
        icon: GitCompare,
        category: 'navigation',
        keywords: ['schema', 'compare', 'comparison', 'diff', 'migration'],
        action: () => {
          document
            .querySelector<HTMLButtonElement>('[data-tab="compare"]')
            ?.click();
        },
      },

      // View commands
      {
        id: 'view.theme-light',
        label: 'Switch to Light Theme',
        icon: Sun,
        category: 'view',
        keywords: ['theme', 'light', 'appearance'],
        action: () => themeStoreRef.current.setTheme('light'),
        disabled: () => themeStoreRef.current.theme === 'light',
      },
      {
        id: 'view.theme-dark',
        label: 'Switch to Dark Theme',
        icon: Moon,
        category: 'view',
        keywords: ['theme', 'dark', 'appearance'],
        action: () => themeStoreRef.current.setTheme('dark'),
        disabled: () => themeStoreRef.current.theme === 'dark',
      },
      {
        id: 'view.theme-system',
        label: 'Use System Theme',
        icon: Monitor,
        category: 'view',
        keywords: ['theme', 'system', 'auto', 'appearance'],
        action: () => themeStoreRef.current.setTheme('system'),
        disabled: () => themeStoreRef.current.theme === 'system',
      },
      {
        id: 'view.toggle-history',
        label: 'Toggle Query History',
        shortcut: getShortcutDisplay('view.toggle-history'),
        icon: History,
        category: 'view',
        keywords: ['history', 'query', 'recent'],
        action: () => {
          const button = document.querySelector<HTMLButtonElement>(
            'button[data-action="toggle-history"]'
          );
          button?.click();
        },
      },

      // Action commands
      {
        id: 'action.refresh-schema',
        label: 'Refresh Schema',
        shortcut: getShortcutDisplay('action.refresh-schema'),
        icon: RefreshCw,
        category: 'actions',
        keywords: ['refresh', 'schema', 'reload', 'update'],
        action: async () => {
          const {
            connection,
            activeConnectionId,
            setIsLoadingSchema,
            setSchema,
          } = connectionStoreRef.current;
          if (!connection || !activeConnectionId) return;
          setIsLoadingSchema(true);
          const result = await sqlPro.db.getSchema({
            connectionId: connection.id,
          });
          if (result.success) {
            setSchema(activeConnectionId, {
              schemas: result.schemas || [],
              tables: result.tables || [],
              views: result.views || [],
            });
          }
          setIsLoadingSchema(false);
        },
        disabled: () => !connectionStoreRef.current.connection,
      },
      {
        id: 'action.refresh-table',
        label: 'Refresh Table',
        shortcut: getShortcutDisplay('action.refresh-table'),
        icon: RefreshCw,
        category: 'actions',
        keywords: ['refresh', 'table', 'reload', 'data'],
        action: () => {
          const { activeConnectionId } = connectionStoreRef.current;
          if (activeConnectionId) {
            queryClient.invalidateQueries({
              queryKey: ['tableData', activeConnectionId],
            });
          }
        },
        disabled: () => !connectionStoreRef.current.activeConnectionId,
      },
      {
        id: 'action.execute-query',
        label: 'Execute Query',
        shortcut: getShortcutDisplay('action.execute-query'),
        icon: Code,
        category: 'actions',
        keywords: ['execute', 'run', 'query', 'sql'],
        action: () => {
          const button = document.querySelector<HTMLButtonElement>(
            'button[data-action="execute-query"]'
          );
          button?.click();
        },
        disabled: () => !connectionStoreRef.current.connection,
      },
      {
        id: 'action.view-changes',
        label: 'View Unsaved Changes',
        shortcut: getShortcutDisplay('action.view-changes'),
        icon: FileText,
        category: 'actions',
        keywords: ['changes', 'unsaved', 'diff', 'pending'],
        action: () => {
          document
            .querySelector<HTMLButtonElement>(
              '.text-amber-600, .text-amber-400'
            )
            ?.click();
        },
      },
      {
        id: 'action.disconnect',
        label: 'Close Database',
        icon: X,
        category: 'actions',
        keywords: ['disconnect', 'close', 'database'],
        action: async () => {
          const {
            connection,
            activeConnectionId,
            removeConnection,
            setSelectedTable,
          } = connectionStoreRef.current;
          if (connection && activeConnectionId) {
            await sqlPro.db.close({ connectionId: connection.id });
            removeConnection(activeConnectionId);
            setSelectedTable(null);
            changesStoreRef.current.clearChangesForConnection(
              activeConnectionId
            );
            tableDataStoreRef.current.resetConnection(activeConnectionId);
            navigate({ to: '/' });
          }
        },
        disabled: () => !connectionStoreRef.current.connection,
      },
      {
        id: 'action.compare-schemas',
        label: 'Compare Schemas',
        icon: GitCompare,
        category: 'actions',
        keywords: ['compare', 'schema', 'diff', 'comparison'],
        action: () => {
          document
            .querySelector<HTMLButtonElement>('[data-tab="compare"]')
            ?.click();
          const timeoutId = setTimeout(() => {
            const compareButton = document.querySelector<HTMLButtonElement>(
              'button:has(svg.lucide-git-compare)'
            );
            compareButton?.click();
          }, 100);
          return () => clearTimeout(timeoutId);
        },
        disabled: () => !connectionStoreRef.current.connection,
      },
      {
        id: 'action.export-schema-report',
        label: 'Export Schema Comparison Report',
        icon: FileDown,
        category: 'actions',
        keywords: ['export', 'schema', 'report', 'comparison', 'download'],
        action: () => {
          const exportButton = document.querySelector<HTMLButtonElement>(
            'button:has(svg.lucide-file-down)'
          );
          if (exportButton) {
            exportButton.click();
            return undefined;
          } else {
            document
              .querySelector<HTMLButtonElement>('[data-tab="compare"]')
              ?.click();
            const timeoutId = setTimeout(() => {
              const btn = document.querySelector<HTMLButtonElement>(
                'button:has(svg.lucide-file-down)'
              );
              btn?.click();
            }, 100);
            return () => clearTimeout(timeoutId);
          }
        },
        disabled: () => !connectionStoreRef.current.connection,
      },
      {
        id: 'action.new-window',
        label: 'New Window',
        shortcut: getShortcutDisplay('action.new-window'),
        icon: PanelLeft,
        category: 'actions',
        keywords: ['new', 'window', 'open'],
        action: async () => {
          if (window.sqlPro?.window) {
            await sqlPro.window.create();
          }
        },
      },
      {
        id: 'action.open-database',
        label: 'Open Database...',
        shortcut: getShortcutDisplay('action.open-database'),
        icon: Database,
        category: 'actions',
        keywords: ['open', 'database', 'file', 'connect'],
        action: () => {
          const openButton = document.querySelector<HTMLButtonElement>(
            'button[data-action="open-database"]'
          );
          if (openButton) {
            openButton.click();
          } else {
            navigate({ to: '/' });
            const timer = setTimeout(() => {
              const btn = document.querySelector<HTMLButtonElement>(
                'button[data-action="open-database"]'
              );
              btn?.click();
              clearTimeout(timer);
            }, 100);
          }
        },
        disabled: () => !!connectionStoreRef.current.connection,
      },

      // Settings commands
      {
        id: 'settings.open',
        label: 'Open Settings',
        shortcut: getShortcutDisplay('settings.open'),
        icon: Settings,
        category: 'settings',
        keywords: ['settings', 'preferences', 'options', 'config'],
        action: () => {
          const button = document.querySelector<HTMLButtonElement>(
            'button[data-action="open-settings"]'
          );
          button?.click();
        },
      },
      {
        id: 'settings.toggle-editor-vim',
        label: 'Toggle Editor Vim Mode',
        icon: Keyboard,
        category: 'settings',
        keywords: ['vim', 'editor', 'mode', 'keybindings'],
        action: () => {
          const { editorVimMode, setEditorVimMode } = settingsStoreRef.current;
          setEditorVimMode(!editorVimMode);
        },
      },
      {
        id: 'settings.toggle-app-vim',
        label: 'Toggle App Vim Navigation',
        icon: Keyboard,
        category: 'settings',
        keywords: ['vim', 'navigation', 'app', 'keybindings'],
        action: () => {
          const { appVimMode, setAppVimMode } = settingsStoreRef.current;
          setAppVimMode(!appVimMode);
        },
      },

      // Help commands
      {
        id: 'help.shortcuts',
        label: 'Show Keyboard Shortcuts',
        shortcut: getShortcutDisplay('help.shortcuts'),
        icon: HelpCircle,
        category: 'help',
        keywords: ['help', 'shortcuts', 'keyboard', 'keys'],
        action: () => {
          toggle();
        },
      },
    ];

    registerCommands(commands);
    // Only run once on mount - registerCommands is stable from zustand
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

import type { Command } from '@/stores';
import { useNavigate } from '@tanstack/react-router';
import {
  Code,
  Database,
  FileText,
  HelpCircle,
  History,
  Keyboard,
  Monitor,
  Moon,
  RefreshCw,
  Search,
  Settings,
  Sun,
  Table,
  X,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import { sqlPro } from '@/lib/api';
import {
  formatShortcut,
  useChangesStore,
  useCommandPaletteStore,
  useConnectionStore,
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

    return () => {
      unsubTheme();
      unsubConnection();
      unsubChanges();
      unsubTableData();
      unsubSettings();
    };
  }, []);

  // Global keyboard shortcut for command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K to toggle command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggle();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggle]);

  // Register commands only once on mount
  useEffect(() => {
    const commands: Command[] = [
      // Navigation commands
      {
        id: 'nav.data-browser',
        label: 'Open Data Browser',
        shortcut: formatShortcut('1', { cmd: true }),
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
        shortcut: formatShortcut('2', { cmd: true }),
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
        shortcut: formatShortcut('P', { cmd: true, shift: true }),
        icon: Search,
        category: 'navigation',
        keywords: ['search', 'tables', 'find', 'filter'],
        action: () => {
          document
            .querySelector<HTMLInputElement>('input[placeholder*="Search"]')
            ?.focus();
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
        shortcut: formatShortcut('H', { cmd: true }),
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
        shortcut: formatShortcut('R', { cmd: true, shift: true }),
        icon: RefreshCw,
        category: 'actions',
        keywords: ['refresh', 'schema', 'reload', 'update'],
        action: async () => {
          const { connection, setIsLoadingSchema, setSchema } =
            connectionStoreRef.current;
          if (!connection) return;
          setIsLoadingSchema(true);
          const result = await sqlPro.db.getSchema({
            connectionId: connection.id,
          });
          if (result.success) {
            setSchema({
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
        id: 'action.execute-query',
        label: 'Execute Query',
        shortcut: formatShortcut('Enter', { cmd: true }),
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
        shortcut: formatShortcut('S', { cmd: true, shift: true }),
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
          const { connection, setConnection, setSchema, setSelectedTable } =
            connectionStoreRef.current;
          if (connection) {
            await sqlPro.db.close({ connectionId: connection.id });
            setConnection(null);
            setSchema(null);
            setSelectedTable(null);
            changesStoreRef.current.clearChanges();
            tableDataStoreRef.current.reset();
            navigate({ to: '/' });
          }
        },
        disabled: () => !connectionStoreRef.current.connection,
      },
      {
        id: 'action.open-database',
        label: 'Open Database...',
        shortcut: formatShortcut('O', { cmd: true }),
        icon: Database,
        category: 'actions',
        keywords: ['open', 'database', 'file', 'connect'],
        action: () => {
          // Try to find and click the button immediately
          const openButton = document.querySelector<HTMLButtonElement>(
            'button[data-action="open-database"]'
          );
          if (openButton) {
            openButton.click();
          } else {
            // Button not found, navigate to home and retry
            navigate({ to: '/' });
            setTimeout(() => {
              const btn = document.querySelector<HTMLButtonElement>(
                'button[data-action="open-database"]'
              );
              btn?.click();
            }, 100);
          }
        },
        disabled: () => !!connectionStoreRef.current.connection,
      },

      // Settings commands
      {
        id: 'settings.open',
        label: 'Open Settings',
        shortcut: formatShortcut(',', { cmd: true }),
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
        shortcut: formatShortcut('/', { cmd: true }),
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

import type { Command } from '@/stores';
import { useNavigate } from '@tanstack/react-router';
import {
  Bookmark,
  Code,
  Database,
  FileDown,
  FileText,
  GitCompare,
  GitFork,
  HelpCircle,
  History,
  Keyboard,
  Link,
  Monitor,
  Moon,
  PanelLeft,
  PanelLeftClose,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  SkipBack,
  SkipForward,
  Sun,
  Table,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import { sqlPro } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import {
  formatShortcut,
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
  const openWithFilter = useCommandPaletteStore((s) => s.openWithFilter);
  const registerCommands = useCommandPaletteStore((s) => s.registerCommands);
  const unregisterCommand = useCommandPaletteStore((s) => s.unregisterCommand);

  // Subscribe to connections for dynamic command registration
  const connections = useConnectionStore((s) => s.connections);
  const activeConnectionId = useConnectionStore((s) => s.activeConnectionId);
  const setActiveConnection = useConnectionStore((s) => s.setActiveConnection);

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
      const { activeConnectionId } = connectionStoreRef.current;

      // Skip shortcuts when typing in inputs (except for specific shortcuts)
      const target = e.target as HTMLElement;
      const isInputField =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      // Command palette shortcut - works everywhere
      const commandPaletteBinding = getShortcut('action.command-palette');
      if (matchesBinding(e, commandPaletteBinding)) {
        e.preventDefault();
        toggle();
        return;
      }

      // Focus search shortcut - works everywhere
      const focusSearchBinding = getShortcut('action.focus-search');
      if (matchesBinding(e, focusSearchBinding)) {
        e.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>(
          'input[placeholder*="Search"]'
        );
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
        return;
      }

      // Recent connections shortcut (Ctrl+R) - works everywhere
      const recentConnectionsBinding = getShortcut('conn.recent-connections');
      if (matchesBinding(e, recentConnectionsBinding)) {
        e.preventDefault();
        // Open command palette with switch connection filter
        openWithFilter('switch');
        return;
      }

      // Skip other shortcuts if typing in input
      if (isInputField) return;

      // Refresh table shortcut (prevent browser refresh)
      const refreshTableBinding = getShortcut('action.refresh-table');
      if (matchesBinding(e, refreshTableBinding)) {
        e.preventDefault();
        if (activeConnectionId) {
          queryClient.invalidateQueries({
            queryKey: ['tableData', activeConnectionId],
          });
        }
        return;
      }

      // Toggle sidebar shortcut
      const toggleSidebarBinding = getShortcut('nav.toggle-sidebar');
      if (matchesBinding(e, toggleSidebarBinding)) {
        e.preventDefault();
        const sidebarToggle = document.querySelector<HTMLButtonElement>(
          'button[data-action="toggle-sidebar"]'
        );
        sidebarToggle?.click();
        return;
      }

      // Toggle schema details panel shortcut
      const toggleSchemaDetailsBinding = getShortcut(
        'view.toggle-schema-details'
      );
      if (matchesBinding(e, toggleSchemaDetailsBinding)) {
        e.preventDefault();
        const schemaToggle = document.querySelector<HTMLButtonElement>(
          'button[data-action="toggle-schema-details"]'
        );
        schemaToggle?.click();
        return;
      }

      // Save changes shortcut
      const saveChangesBinding = getShortcut('action.save-changes');
      if (matchesBinding(e, saveChangesBinding)) {
        e.preventDefault();
        const saveButton = document.querySelector<HTMLButtonElement>(
          'button[data-action="save-changes"]'
        );
        saveButton?.click();
        return;
      }

      // Discard changes shortcut
      const discardChangesBinding = getShortcut('action.discard-changes');
      if (matchesBinding(e, discardChangesBinding)) {
        e.preventDefault();
        const discardButton = document.querySelector<HTMLButtonElement>(
          'button[data-action="discard-changes"]'
        );
        discardButton?.click();
        return;
      }

      // Add row shortcut
      const addRowBinding = getShortcut('action.add-row');
      if (matchesBinding(e, addRowBinding)) {
        e.preventDefault();
        const addRowButton = document.querySelector<HTMLButtonElement>(
          'button[data-action="add-row"]'
        );
        addRowButton?.click();
        return;
      }

      // Delete row shortcut
      const deleteRowBinding = getShortcut('action.delete-row');
      if (matchesBinding(e, deleteRowBinding)) {
        e.preventDefault();
        const deleteRowButton = document.querySelector<HTMLButtonElement>(
          'button[data-action="delete-row"]'
        );
        deleteRowButton?.click();
        return;
      }

      // Export data shortcut
      const exportDataBinding = getShortcut('action.export-data');
      if (matchesBinding(e, exportDataBinding)) {
        e.preventDefault();
        const exportButton = document.querySelector<HTMLButtonElement>(
          'button[data-action="export-data"]'
        );
        exportButton?.click();
        return;
      }

      // ER Diagram shortcut
      const erDiagramBinding = getShortcut('nav.er-diagram');
      if (matchesBinding(e, erDiagramBinding)) {
        e.preventDefault();
        document
          .querySelector<HTMLButtonElement>('[data-tab="diagram"]')
          ?.click();
        return;
      }

      // Next connection shortcut (Cmd+Tab)
      const nextConnectionBinding = getShortcut('conn.next-connection');
      if (matchesBinding(e, nextConnectionBinding)) {
        e.preventDefault();
        const { connectionTabOrder, activeConnectionId, setActiveConnection } =
          connectionStoreRef.current;
        if (connectionTabOrder.length > 1 && activeConnectionId) {
          const currentIndex = connectionTabOrder.indexOf(activeConnectionId);
          const nextIndex = (currentIndex + 1) % connectionTabOrder.length;
          setActiveConnection(connectionTabOrder[nextIndex]);
        }
        return;
      }

      // Previous connection shortcut (Cmd+Shift+Tab)
      const prevConnectionBinding = getShortcut('conn.prev-connection');
      if (matchesBinding(e, prevConnectionBinding)) {
        e.preventDefault();
        const { connectionTabOrder, activeConnectionId, setActiveConnection } =
          connectionStoreRef.current;
        if (connectionTabOrder.length > 1 && activeConnectionId) {
          const currentIndex = connectionTabOrder.indexOf(activeConnectionId);
          const prevIndex =
            (currentIndex - 1 + connectionTabOrder.length) %
            connectionTabOrder.length;
          setActiveConnection(connectionTabOrder[prevIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggle, openWithFilter]);

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
      {
        id: 'nav.er-diagram',
        label: 'Open ER Diagram',
        shortcut: getShortcutDisplay('nav.er-diagram'),
        icon: GitFork,
        category: 'navigation',
        keywords: ['er', 'diagram', 'entity', 'relationship', 'schema'],
        action: () => {
          document
            .querySelector<HTMLButtonElement>('[data-tab="diagram"]')
            ?.click();
        },
      },
      {
        id: 'nav.toggle-sidebar',
        label: 'Toggle Sidebar',
        shortcut: getShortcutDisplay('nav.toggle-sidebar'),
        icon: PanelLeftClose,
        category: 'navigation',
        keywords: ['sidebar', 'toggle', 'hide', 'show', 'panel'],
        action: () => {
          const sidebarToggle = document.querySelector<HTMLButtonElement>(
            'button[data-action="toggle-sidebar"]'
          );
          sidebarToggle?.click();
        },
      },

      // Connection commands
      {
        id: 'conn.recent-connections',
        label: 'Recent Connections',
        shortcut: getShortcutDisplay('conn.recent-connections'),
        icon: Link,
        category: 'navigation',
        keywords: ['recent', 'connection', 'database', 'switch'],
        action: () => {
          // Open command palette filtered to connection switching commands
          openWithFilter('switch');
        },
      },
      {
        id: 'conn.next-connection',
        label: 'Next Connection',
        shortcut: getShortcutDisplay('conn.next-connection'),
        icon: SkipForward,
        category: 'navigation',
        keywords: ['next', 'connection', 'switch', 'tab'],
        action: () => {
          const {
            connectionTabOrder,
            activeConnectionId,
            setActiveConnection,
          } = connectionStoreRef.current;
          if (connectionTabOrder.length > 1 && activeConnectionId) {
            const currentIndex = connectionTabOrder.indexOf(activeConnectionId);
            const nextIndex = (currentIndex + 1) % connectionTabOrder.length;
            setActiveConnection(connectionTabOrder[nextIndex]);
          }
        },
        disabled: () =>
          connectionStoreRef.current.connectionTabOrder.length <= 1,
      },
      {
        id: 'conn.prev-connection',
        label: 'Previous Connection',
        shortcut: getShortcutDisplay('conn.prev-connection'),
        icon: SkipBack,
        category: 'navigation',
        keywords: ['previous', 'connection', 'switch', 'tab'],
        action: () => {
          const {
            connectionTabOrder,
            activeConnectionId,
            setActiveConnection,
          } = connectionStoreRef.current;
          if (connectionTabOrder.length > 1 && activeConnectionId) {
            const currentIndex = connectionTabOrder.indexOf(activeConnectionId);
            const prevIndex =
              (currentIndex - 1 + connectionTabOrder.length) %
              connectionTabOrder.length;
            setActiveConnection(connectionTabOrder[prevIndex]);
          }
        },
        disabled: () =>
          connectionStoreRef.current.connectionTabOrder.length <= 1,
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
      {
        id: 'view.toggle-schema-details',
        label: 'Toggle Schema Details',
        shortcut: getShortcutDisplay('view.toggle-schema-details'),
        icon: Table,
        category: 'view',
        keywords: ['schema', 'details', 'info', 'columns', 'indexes'],
        action: () => {
          const button = document.querySelector<HTMLButtonElement>(
            'button[data-action="toggle-schema-details"]'
          );
          button?.click();
        },
      },
      {
        id: 'view.toggle-saved-queries',
        label: 'Toggle Saved Queries',
        shortcut: formatShortcut('F', { cmd: true, shift: true }),
        icon: Search,
        category: 'view',
        keywords: ['saved', 'queries', 'favorites', 'collections'],
        action: () => {
          const button = document.querySelector<HTMLButtonElement>(
            'button[data-action="toggle-saved-queries"]'
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
        id: 'action.save-query',
        label: 'Save Query',
        shortcut: formatShortcut('S', { cmd: true }),
        icon: Bookmark,
        category: 'actions',
        keywords: ['save', 'query', 'bookmark', 'collection'],
        action: () => {
          const button = document.querySelector<HTMLButtonElement>(
            'button[data-action="save-query"]'
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
        shortcut: getShortcutDisplay('action.close-database'),
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
        id: 'action.save-changes',
        label: 'Save Changes',
        shortcut: getShortcutDisplay('action.save-changes'),
        icon: Save,
        category: 'actions',
        keywords: ['save', 'apply', 'commit', 'changes'],
        action: () => {
          const button = document.querySelector<HTMLButtonElement>(
            'button[data-action="save-changes"]'
          );
          button?.click();
        },
        disabled: () => !changesStoreRef.current.hasChanges(),
      },
      {
        id: 'action.discard-changes',
        label: 'Discard Changes',
        shortcut: getShortcutDisplay('action.discard-changes'),
        icon: Undo2,
        category: 'actions',
        keywords: ['discard', 'revert', 'undo', 'cancel', 'changes'],
        action: () => {
          const button = document.querySelector<HTMLButtonElement>(
            'button[data-action="discard-changes"]'
          );
          button?.click();
        },
        disabled: () => !changesStoreRef.current.hasChanges(),
      },
      {
        id: 'action.add-row',
        label: 'Add Row',
        shortcut: getShortcutDisplay('action.add-row'),
        icon: Plus,
        category: 'actions',
        keywords: ['add', 'new', 'insert', 'row', 'record'],
        action: () => {
          const button = document.querySelector<HTMLButtonElement>(
            'button[data-action="add-row"]'
          );
          button?.click();
        },
        disabled: () => !connectionStoreRef.current.selectedTable,
      },
      {
        id: 'action.delete-row',
        label: 'Delete Row',
        shortcut: getShortcutDisplay('action.delete-row'),
        icon: Trash2,
        category: 'actions',
        keywords: ['delete', 'remove', 'row', 'record'],
        action: () => {
          const button = document.querySelector<HTMLButtonElement>(
            'button[data-action="delete-row"]'
          );
          button?.click();
        },
        disabled: () => !connectionStoreRef.current.selectedTable,
      },
      {
        id: 'action.export-data',
        label: 'Export Data',
        shortcut: getShortcutDisplay('action.export-data'),
        icon: FileDown,
        category: 'actions',
        keywords: ['export', 'download', 'csv', 'json', 'excel'],
        action: () => {
          const button = document.querySelector<HTMLButtonElement>(
            'button[data-action="export-data"]'
          );
          button?.click();
        },
        disabled: () => !connectionStoreRef.current.selectedTable,
      },
      {
        id: 'action.focus-search',
        label: 'Focus Search',
        shortcut: getShortcutDisplay('action.focus-search'),
        icon: Search,
        category: 'actions',
        keywords: ['search', 'find', 'filter', 'focus'],
        action: () => {
          const searchInput = document.querySelector<HTMLInputElement>(
            'input[placeholder*="Search"]'
          );
          if (searchInput) {
            searchInput.focus();
            searchInput.select();
          }
        },
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

  // Register dynamic connection switch commands
  useEffect(() => {
    // Create commands for each open connection
    const connectionCommands: Command[] = Array.from(connections.values()).map(
      (conn) => ({
        id: `conn.switch-to-${conn.id}`,
        label: `Switch to: ${conn.filename}`,
        icon: Database,
        category: 'navigation',
        keywords: ['switch', 'connection', 'database', conn.filename || ''],
        action: () => {
          setActiveConnection(conn.id);
        },
        disabled: () => activeConnectionId === conn.id,
      })
    );

    // Register the connection commands
    if (connectionCommands.length > 0) {
      registerCommands(connectionCommands);
    }

    // Cleanup: unregister old connection commands when connections change
    return () => {
      Array.from(connections.values()).forEach((conn) => {
        unregisterCommand(`conn.switch-to-${conn.id}`);
      });
    };
  }, [
    connections,
    activeConnectionId,
    setActiveConnection,
    registerCommands,
    unregisterCommand,
  ]);
}

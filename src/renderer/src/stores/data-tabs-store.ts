import type { TableSchema } from '@/types/database';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface DataTab {
  id: string;
  /** The table associated with this tab */
  table: TableSchema;
  /** Display title for the tab */
  title: string;
  /** Timestamp when the tab was created */
  createdAt: number;
  /** Connection ID this tab belongs to */
  connectionId: string;
}

interface ConnectionDataTabState {
  tabs: DataTab[];
  activeTabId: string | null;
}

interface DataTabsState {
  // Tabs stored per connection
  tabsByConnection: Record<string, ConnectionDataTabState>;

  // Currently active connection ID
  activeConnectionId: string | null;

  // Actions
  setActiveConnectionId: (connectionId: string | null) => void;

  /**
   * Open a table in a new tab or focus existing tab if already open
   * @returns The tab ID (new or existing)
   */
  openTable: (connectionId: string, table: TableSchema) => string;

  /**
   * Close a specific tab
   */
  closeTab: (connectionId: string, tabId: string) => void;

  /**
   * Close all tabs except the specified one
   */
  closeOtherTabs: (connectionId: string, tabId: string) => void;

  /**
   * Close all tabs for a connection
   */
  closeAllTabs: (connectionId: string) => void;

  /**
   * Set the active tab
   */
  setActiveTab: (connectionId: string, tabId: string) => void;

  /**
   * Get the active tab for a connection
   */
  getActiveTab: (connectionId?: string) => DataTab | undefined;

  /**
   * Get all tabs for a connection
   */
  getTabsForConnection: (connectionId: string) => DataTab[];

  /**
   * Remove all tabs for a connection (when disconnecting)
   */
  removeConnectionTabs: (connectionId: string) => void;

  /**
   * Reorder tabs via drag and drop
   */
  reorderTabs: (
    connectionId: string,
    fromIndex: number,
    toIndex: number
  ) => void;

  /**
   * Update tab title
   */
  updateTabTitle: (connectionId: string, tabId: string, title: string) => void;

  /**
   * Check if a table is already open in a tab
   */
  findTabByTable: (
    connectionId: string,
    tableName: string,
    schema?: string
  ) => DataTab | undefined;

  /**
   * Reset the entire store
   */
  reset: () => void;

  // Legacy compatibility getters
  tabs: DataTab[];
  activeTabId: string | null;
}

const generateId = (): string => {
  return `data-tab-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

const createDataTab = (connectionId: string, table: TableSchema): DataTab => ({
  id: generateId(),
  connectionId,
  table,
  title: table.name,
  createdAt: Date.now(),
});

const createDefaultConnectionState = (): ConnectionDataTabState => ({
  tabs: [],
  activeTabId: null,
});

const getOrCreateConnectionState = (
  tabsByConnection: Record<string, ConnectionDataTabState>,
  connectionId: string
): ConnectionDataTabState => {
  if (tabsByConnection[connectionId]) {
    return tabsByConnection[connectionId];
  }
  return createDefaultConnectionState();
};

export const useDataTabsStore = create<DataTabsState>()(
  persist(
    (set, get) => ({
      tabsByConnection: {},
      activeConnectionId: null,

      // Legacy compatibility getters
      get tabs() {
        const state = get();
        if (!state.activeConnectionId) return [];
        const connState = state.tabsByConnection[state.activeConnectionId];
        return connState?.tabs || [];
      },

      get activeTabId() {
        const state = get();
        if (!state.activeConnectionId) return null;
        const connState = state.tabsByConnection[state.activeConnectionId];
        return connState?.activeTabId || null;
      },

      setActiveConnectionId: (connectionId) => {
        set({ activeConnectionId: connectionId });

        // Ensure connection state exists
        if (connectionId) {
          const state = get();
          if (!state.tabsByConnection[connectionId]) {
            set({
              tabsByConnection: {
                ...state.tabsByConnection,
                [connectionId]: createDefaultConnectionState(),
              },
            });
          }
        }
      },

      openTable: (connectionId, table) => {
        const state = get();
        const connState = getOrCreateConnectionState(
          state.tabsByConnection,
          connectionId
        );

        // Check if the table is already open
        const existingTab = connState.tabs.find(
          (tab) =>
            tab.table.name === table.name && tab.table.schema === table.schema
        );

        if (existingTab) {
          // Just activate the existing tab
          set({
            tabsByConnection: {
              ...state.tabsByConnection,
              [connectionId]: {
                ...connState,
                activeTabId: existingTab.id,
              },
            },
          });
          return existingTab.id;
        }

        // Create a new tab
        const newTab = createDataTab(connectionId, table);

        set({
          tabsByConnection: {
            ...state.tabsByConnection,
            [connectionId]: {
              tabs: [...connState.tabs, newTab],
              activeTabId: newTab.id,
            },
          },
        });

        return newTab.id;
      },

      closeTab: (connectionId, tabId) => {
        const state = get();
        const connState = state.tabsByConnection[connectionId];
        if (!connState) return;

        const tabIndex = connState.tabs.findIndex((t) => t.id === tabId);
        if (tabIndex === -1) return;

        const newTabs = connState.tabs.filter((t) => t.id !== tabId);

        // Determine new active tab
        let newActiveId: string | null = null;
        if (newTabs.length > 0) {
          if (connState.activeTabId === tabId) {
            // If closing active tab, switch to adjacent tab
            const newIndex = Math.min(tabIndex, newTabs.length - 1);
            newActiveId = newTabs[newIndex].id;
          } else {
            // Keep current active tab
            newActiveId = connState.activeTabId;
          }
        }

        set({
          tabsByConnection: {
            ...state.tabsByConnection,
            [connectionId]: {
              tabs: newTabs,
              activeTabId: newActiveId,
            },
          },
        });
      },

      closeOtherTabs: (connectionId, tabId) => {
        const state = get();
        const connState = state.tabsByConnection[connectionId];
        if (!connState) return;

        const tabToKeep = connState.tabs.find((t) => t.id === tabId);
        if (!tabToKeep) return;

        set({
          tabsByConnection: {
            ...state.tabsByConnection,
            [connectionId]: {
              tabs: [tabToKeep],
              activeTabId: tabId,
            },
          },
        });
      },

      closeAllTabs: (connectionId) => {
        const state = get();

        set({
          tabsByConnection: {
            ...state.tabsByConnection,
            [connectionId]: createDefaultConnectionState(),
          },
        });
      },

      setActiveTab: (connectionId, tabId) => {
        const state = get();
        const connState = state.tabsByConnection[connectionId];
        if (!connState) return;

        const tabExists = connState.tabs.some((t) => t.id === tabId);
        if (!tabExists) return;

        set({
          tabsByConnection: {
            ...state.tabsByConnection,
            [connectionId]: {
              ...connState,
              activeTabId: tabId,
            },
          },
        });
      },

      getActiveTab: (connectionId) => {
        const state = get();
        const connId = connectionId || state.activeConnectionId;
        if (!connId) return undefined;

        const connState = state.tabsByConnection[connId];
        if (!connState || !connState.activeTabId) return undefined;

        return connState.tabs.find((t) => t.id === connState.activeTabId);
      },

      getTabsForConnection: (connectionId) => {
        const state = get();
        const connState = state.tabsByConnection[connectionId];
        return connState?.tabs || [];
      },

      removeConnectionTabs: (connectionId) => {
        const state = get();
        const { [connectionId]: _, ...rest } = state.tabsByConnection;

        set({
          tabsByConnection: rest,
          activeConnectionId:
            state.activeConnectionId === connectionId
              ? null
              : state.activeConnectionId,
        });
      },

      reorderTabs: (connectionId, fromIndex, toIndex) => {
        const state = get();
        const connState = state.tabsByConnection[connectionId];
        if (!connState) return;

        const newTabs = [...connState.tabs];
        const [movedTab] = newTabs.splice(fromIndex, 1);
        newTabs.splice(toIndex, 0, movedTab);

        set({
          tabsByConnection: {
            ...state.tabsByConnection,
            [connectionId]: {
              ...connState,
              tabs: newTabs,
            },
          },
        });
      },

      updateTabTitle: (connectionId, tabId, title) => {
        const state = get();
        const connState = state.tabsByConnection[connectionId];
        if (!connState) return;

        set({
          tabsByConnection: {
            ...state.tabsByConnection,
            [connectionId]: {
              ...connState,
              tabs: connState.tabs.map((tab) =>
                tab.id === tabId ? { ...tab, title } : tab
              ),
            },
          },
        });
      },

      findTabByTable: (connectionId, tableName, schema) => {
        const state = get();
        const connState = state.tabsByConnection[connectionId];
        if (!connState) return undefined;

        return connState.tabs.find(
          (tab) =>
            tab.table.name === tableName &&
            (schema === undefined || tab.table.schema === schema)
        );
      },

      reset: () => {
        set({
          tabsByConnection: {},
          activeConnectionId: null,
        });
      },
    }),
    {
      name: 'sql-pro-data-tabs',
      partialize: (state) => ({
        // Don't persist tabs, just the structure
        // Tables should be re-opened from the sidebar
        tabsByConnection: Object.fromEntries(
          Object.entries(state.tabsByConnection).map(([connId, _connState]) => [
            connId,
            {
              tabs: [], // Don't persist tabs
              activeTabId: null,
            },
          ])
        ),
        activeConnectionId: state.activeConnectionId,
      }),
    }
  )
);

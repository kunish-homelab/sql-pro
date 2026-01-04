import type { QueryResult } from '@/types/database';
import { create } from 'zustand';

export interface QueryTab {
  id: string;
  title: string;
  query: string;
  results: QueryResult | null;
  error: string | null;
  isExecuting: boolean;
  executionTime: number | null;
  isDirty: boolean;
  createdAt: number;
  lastExecutedAt: number | null;
  /** Connection ID this tab belongs to */
  connectionId: string;
  /** Cursor position in the query editor */
  cursorPosition?: { line: number; column: number };
  /** Scroll position in the query editor */
  scrollTop?: number;
}

export type SplitDirection = 'horizontal' | 'vertical';

export interface SplitPane {
  id: string;
  activeTabId: string | null;
}

export interface SplitLayout {
  direction: SplitDirection | null;
  panes: SplitPane[];
}

interface ConnectionTabState {
  tabs: QueryTab[];
  activeTabId: string | null;
  splitLayout: SplitLayout;
  activePaneId: string;
}

interface QueryTabsState {
  // Tabs stored per connection
  tabsByConnection: Record<string, ConnectionTabState>;

  // Currently active connection ID
  activeConnectionId: string | null;

  // Actions
  setActiveConnectionId: (connectionId: string | null) => void;
  createTab: (connectionId: string, title?: string, query?: string) => string;
  closeTab: (connectionId: string, tabId: string) => void;
  closeOtherTabs: (connectionId: string, tabId: string) => void;
  closeAllTabs: (connectionId: string) => void;
  setActiveTab: (connectionId: string, tabId: string) => void;
  updateTabQuery: (connectionId: string, tabId: string, query: string) => void;
  updateTabTitle: (connectionId: string, tabId: string, title: string) => void;
  updateTabResults: (
    connectionId: string,
    tabId: string,
    results: QueryResult | null,
    executionTime: number | null
  ) => void;
  updateTabError: (
    connectionId: string,
    tabId: string,
    error: string | null
  ) => void;
  setTabExecuting: (
    connectionId: string,
    tabId: string,
    isExecuting: boolean
  ) => void;
  updateTabCursorPosition: (
    connectionId: string,
    tabId: string,
    cursorPosition: { line: number; column: number }
  ) => void;
  updateTabScrollTop: (
    connectionId: string,
    tabId: string,
    scrollTop: number
  ) => void;
  duplicateTab: (connectionId: string, tabId: string) => string;
  reorderTabs: (
    connectionId: string,
    fromIndex: number,
    toIndex: number
  ) => void;
  getActiveTab: (connectionId?: string) => QueryTab | undefined;
  getTabsForConnection: (connectionId: string) => QueryTab[];
  removeConnectionTabs: (connectionId: string) => void;
  reset: () => void;

  // Split view actions
  splitPane: (connectionId: string, direction: SplitDirection) => void;
  closeSplit: (connectionId: string) => void;
  setActivePaneId: (connectionId: string, paneId: string) => void;
  setPaneActiveTab: (
    connectionId: string,
    paneId: string,
    tabId: string
  ) => void;
  getPane: (connectionId: string, paneId: string) => SplitPane | undefined;
  isSplit: (connectionId: string) => boolean;

  // Legacy compatibility - for components that don't pass connectionId
  tabs: QueryTab[];
  activeTabId: string | null;
  dbPath: string | null;
  splitLayout: SplitLayout;
  activePaneId: string;
  setDbPath: (dbPath: string | null) => void;
}

const generateId = (): string => {
  return `tab-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

const generatePaneId = (): string => {
  return `pane-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

const DEFAULT_PANE_ID = 'pane-main';

const createDefaultTab = (
  connectionId: string,
  title?: string,
  query?: string
): QueryTab => ({
  id: generateId(),
  connectionId,
  title: title || 'Query 1',
  query: query || '',
  results: null,
  error: null,
  isExecuting: false,
  executionTime: null,
  isDirty: false,
  createdAt: Date.now(),
  lastExecutedAt: null,
});

const createDefaultSplitLayout = (): SplitLayout => ({
  direction: null,
  panes: [{ id: DEFAULT_PANE_ID, activeTabId: null }],
});

const createDefaultConnectionState = (
  connectionId: string
): ConnectionTabState => {
  const defaultTab = createDefaultTab(connectionId);
  return {
    tabs: [defaultTab],
    activeTabId: defaultTab.id,
    splitLayout: {
      direction: null,
      panes: [{ id: DEFAULT_PANE_ID, activeTabId: defaultTab.id }],
    },
    activePaneId: DEFAULT_PANE_ID,
  };
};

const getNextTabNumber = (tabs: QueryTab[]): number => {
  const numbers = tabs
    .map((tab) => {
      const match = tab.title.match(/^Query (\d+)$/);
      return match ? Number.parseInt(match[1], 10) : 0;
    })
    .filter((n) => n > 0);
  return numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
};

const getOrCreateConnectionState = (
  tabsByConnection: Record<string, ConnectionTabState>,
  connectionId: string
): ConnectionTabState => {
  if (tabsByConnection[connectionId]) {
    return tabsByConnection[connectionId];
  }
  return createDefaultConnectionState(connectionId);
};

export const useQueryTabsStore = create<QueryTabsState>()((set, get) => ({
  tabsByConnection: {},
  activeConnectionId: null,

  // Legacy compatibility getters
  get tabs() {
    const state = get();
    if (!state.activeConnectionId) return [];
    return state.tabsByConnection[state.activeConnectionId]?.tabs || [];
  },
  get activeTabId() {
    const state = get();
    if (!state.activeConnectionId) return null;
    return (
      state.tabsByConnection[state.activeConnectionId]?.activeTabId || null
    );
  },
  get dbPath() {
    // Legacy - return null since we now use connectionId
    return null;
  },
  get splitLayout() {
    const state = get();
    if (!state.activeConnectionId) return createDefaultSplitLayout();
    return (
      state.tabsByConnection[state.activeConnectionId]?.splitLayout ||
      createDefaultSplitLayout()
    );
  },
  get activePaneId() {
    const state = get();
    if (!state.activeConnectionId) return DEFAULT_PANE_ID;
    return (
      state.tabsByConnection[state.activeConnectionId]?.activePaneId ||
      DEFAULT_PANE_ID
    );
  },

  // Legacy setDbPath - now maps to setActiveConnectionId
  setDbPath: (_dbPath) => {
    // No-op - use setActiveConnectionId instead
  },

  setActiveConnectionId: (connectionId) => {
    if (connectionId === null) {
      set({ activeConnectionId: null });
      return;
    }

    set((state) => {
      const tabsByConnection = { ...state.tabsByConnection };
      // Ensure connection has tab state
      if (!tabsByConnection[connectionId]) {
        tabsByConnection[connectionId] =
          createDefaultConnectionState(connectionId);
      }
      return {
        tabsByConnection,
        activeConnectionId: connectionId,
      };
    });
  },

  createTab: (connectionId, title, query) => {
    const state = get();
    const connState = getOrCreateConnectionState(
      state.tabsByConnection,
      connectionId
    );
    const tabNumber = getNextTabNumber(connState.tabs);
    const newTab = createDefaultTab(
      connectionId,
      title || `Query ${tabNumber}`,
      query
    );

    set((state) => ({
      tabsByConnection: {
        ...state.tabsByConnection,
        [connectionId]: {
          ...connState,
          tabs: [...connState.tabs, newTab],
          activeTabId: newTab.id,
        },
      },
    }));

    return newTab.id;
  },

  closeTab: (connectionId, tabId) => {
    const state = get();
    const connState = state.tabsByConnection[connectionId];
    if (!connState) return;

    const tabIndex = connState.tabs.findIndex((t) => t.id === tabId);
    if (tabIndex === -1) return;

    const newTabs = connState.tabs.filter((t) => t.id !== tabId);

    let newActiveId = connState.activeTabId;
    if (connState.activeTabId === tabId) {
      if (newTabs.length === 0) {
        // Create a new default tab if all tabs are closed
        const defaultTab = createDefaultTab(connectionId);
        set((state) => ({
          tabsByConnection: {
            ...state.tabsByConnection,
            [connectionId]: {
              ...connState,
              tabs: [defaultTab],
              activeTabId: defaultTab.id,
            },
          },
        }));
        return;
      }
      const newIndex = Math.min(tabIndex, newTabs.length - 1);
      newActiveId = newTabs[newIndex].id;
    }

    set((state) => ({
      tabsByConnection: {
        ...state.tabsByConnection,
        [connectionId]: {
          ...connState,
          tabs: newTabs,
          activeTabId: newActiveId,
        },
      },
    }));
  },

  closeOtherTabs: (connectionId, tabId) => {
    const state = get();
    const connState = state.tabsByConnection[connectionId];
    if (!connState) return;

    const tabToKeep = connState.tabs.find((t) => t.id === tabId);
    if (tabToKeep) {
      set((state) => ({
        tabsByConnection: {
          ...state.tabsByConnection,
          [connectionId]: {
            ...connState,
            tabs: [tabToKeep],
            activeTabId: tabId,
          },
        },
      }));
    }
  },

  closeAllTabs: (connectionId) => {
    const defaultTab = createDefaultTab(connectionId);
    set((state) => ({
      tabsByConnection: {
        ...state.tabsByConnection,
        [connectionId]: {
          tabs: [defaultTab],
          activeTabId: defaultTab.id,
          splitLayout: {
            direction: null,
            panes: [{ id: DEFAULT_PANE_ID, activeTabId: defaultTab.id }],
          },
          activePaneId: DEFAULT_PANE_ID,
        },
      },
    }));
  },

  setActiveTab: (connectionId, tabId) => {
    const state = get();
    const connState = state.tabsByConnection[connectionId];
    if (!connState) return;

    if (connState.tabs.some((t) => t.id === tabId)) {
      set((state) => ({
        tabsByConnection: {
          ...state.tabsByConnection,
          [connectionId]: {
            ...connState,
            activeTabId: tabId,
          },
        },
      }));
    }
  },

  updateTabQuery: (connectionId, tabId, query) => {
    set((state) => {
      const connState = state.tabsByConnection[connectionId];
      if (!connState) return state;

      return {
        tabsByConnection: {
          ...state.tabsByConnection,
          [connectionId]: {
            ...connState,
            tabs: connState.tabs.map((tab) =>
              tab.id === tabId ? { ...tab, query, isDirty: true } : tab
            ),
          },
        },
      };
    });
  },

  updateTabTitle: (connectionId, tabId, title) => {
    set((state) => {
      const connState = state.tabsByConnection[connectionId];
      if (!connState) return state;

      return {
        tabsByConnection: {
          ...state.tabsByConnection,
          [connectionId]: {
            ...connState,
            tabs: connState.tabs.map((tab) =>
              tab.id === tabId ? { ...tab, title } : tab
            ),
          },
        },
      };
    });
  },

  updateTabResults: (connectionId, tabId, results, executionTime) => {
    set((state) => {
      const connState = state.tabsByConnection[connectionId];
      if (!connState) return state;

      return {
        tabsByConnection: {
          ...state.tabsByConnection,
          [connectionId]: {
            ...connState,
            tabs: connState.tabs.map((tab) =>
              tab.id === tabId
                ? {
                    ...tab,
                    results,
                    error: null,
                    executionTime,
                    lastExecutedAt: Date.now(),
                    isDirty: false,
                  }
                : tab
            ),
          },
        },
      };
    });
  },

  updateTabError: (connectionId, tabId, error) => {
    set((state) => {
      const connState = state.tabsByConnection[connectionId];
      if (!connState) return state;

      return {
        tabsByConnection: {
          ...state.tabsByConnection,
          [connectionId]: {
            ...connState,
            tabs: connState.tabs.map((tab) =>
              tab.id === tabId
                ? {
                    ...tab,
                    error,
                    results: null,
                    lastExecutedAt: Date.now(),
                  }
                : tab
            ),
          },
        },
      };
    });
  },

  setTabExecuting: (connectionId, tabId, isExecuting) => {
    set((state) => {
      const connState = state.tabsByConnection[connectionId];
      if (!connState) return state;

      return {
        tabsByConnection: {
          ...state.tabsByConnection,
          [connectionId]: {
            ...connState,
            tabs: connState.tabs.map((tab) =>
              tab.id === tabId ? { ...tab, isExecuting } : tab
            ),
          },
        },
      };
    });
  },

  updateTabCursorPosition: (connectionId, tabId, cursorPosition) => {
    set((state) => {
      const connState = state.tabsByConnection[connectionId];
      if (!connState) return state;

      return {
        tabsByConnection: {
          ...state.tabsByConnection,
          [connectionId]: {
            ...connState,
            tabs: connState.tabs.map((tab) =>
              tab.id === tabId ? { ...tab, cursorPosition } : tab
            ),
          },
        },
      };
    });
  },

  updateTabScrollTop: (connectionId, tabId, scrollTop) => {
    set((state) => {
      const connState = state.tabsByConnection[connectionId];
      if (!connState) return state;

      return {
        tabsByConnection: {
          ...state.tabsByConnection,
          [connectionId]: {
            ...connState,
            tabs: connState.tabs.map((tab) =>
              tab.id === tabId ? { ...tab, scrollTop } : tab
            ),
          },
        },
      };
    });
  },

  duplicateTab: (connectionId, tabId) => {
    const state = get();
    const connState = state.tabsByConnection[connectionId];
    if (!connState) return '';

    const tabToDuplicate = connState.tabs.find((t) => t.id === tabId);
    if (!tabToDuplicate) return '';

    const tabNumber = getNextTabNumber(connState.tabs);
    const newTab: QueryTab = {
      ...tabToDuplicate,
      id: generateId(),
      connectionId,
      title: `Query ${tabNumber}`,
      results: null,
      error: null,
      isExecuting: false,
      executionTime: null,
      isDirty: tabToDuplicate.query.length > 0,
      createdAt: Date.now(),
      lastExecutedAt: null,
    };

    const tabIndex = connState.tabs.findIndex((t) => t.id === tabId);
    const newTabs = [...connState.tabs];
    newTabs.splice(tabIndex + 1, 0, newTab);

    set((state) => ({
      tabsByConnection: {
        ...state.tabsByConnection,
        [connectionId]: {
          ...connState,
          tabs: newTabs,
          activeTabId: newTab.id,
        },
      },
    }));

    return newTab.id;
  },

  reorderTabs: (connectionId, fromIndex, toIndex) => {
    set((state) => {
      const connState = state.tabsByConnection[connectionId];
      if (!connState) return state;

      const newTabs = [...connState.tabs];
      const [movedTab] = newTabs.splice(fromIndex, 1);
      newTabs.splice(toIndex, 0, movedTab);

      return {
        tabsByConnection: {
          ...state.tabsByConnection,
          [connectionId]: {
            ...connState,
            tabs: newTabs,
          },
        },
      };
    });
  },

  getActiveTab: (connectionId) => {
    const state = get();
    const connId = connectionId || state.activeConnectionId;
    if (!connId) return undefined;

    const connState = state.tabsByConnection[connId];
    if (!connState) return undefined;

    return connState.tabs.find((t) => t.id === connState.activeTabId);
  },

  getTabsForConnection: (connectionId) => {
    const state = get();
    return state.tabsByConnection[connectionId]?.tabs || [];
  },

  removeConnectionTabs: (connectionId) => {
    set((state) => {
      const { [connectionId]: _, ...rest } = state.tabsByConnection;
      return {
        tabsByConnection: rest,
        activeConnectionId:
          state.activeConnectionId === connectionId
            ? null
            : state.activeConnectionId,
      };
    });
  },

  reset: () => {
    set({
      tabsByConnection: {},
      activeConnectionId: null,
    });
  },

  // Split view actions
  splitPane: (connectionId, direction) => {
    const state = get();
    const connState = state.tabsByConnection[connectionId];
    if (!connState) return;

    // Don't split if already split
    if (connState.splitLayout.direction !== null) return;

    // Create a new tab for the second pane
    const tabNumber = getNextTabNumber(connState.tabs);
    const newTab = createDefaultTab(connectionId, `Query ${tabNumber}`);
    const newPaneId = generatePaneId();

    set((state) => ({
      tabsByConnection: {
        ...state.tabsByConnection,
        [connectionId]: {
          ...connState,
          tabs: [...connState.tabs, newTab],
          splitLayout: {
            direction,
            panes: [
              {
                id: connState.splitLayout.panes[0].id,
                activeTabId: connState.activeTabId,
              },
              { id: newPaneId, activeTabId: newTab.id },
            ],
          },
          activePaneId: newPaneId,
          activeTabId: newTab.id,
        },
      },
    }));
  },

  closeSplit: (connectionId) => {
    const state = get();
    const connState = state.tabsByConnection[connectionId];
    if (!connState) return;
    if (connState.splitLayout.direction === null) return;

    // Keep only the active pane
    const activePane = connState.splitLayout.panes.find(
      (p) => p.id === connState.activePaneId
    );
    const activeTabId =
      activePane?.activeTabId || connState.tabs[0]?.id || null;

    set((state) => ({
      tabsByConnection: {
        ...state.tabsByConnection,
        [connectionId]: {
          ...connState,
          splitLayout: {
            direction: null,
            panes: [{ id: DEFAULT_PANE_ID, activeTabId }],
          },
          activePaneId: DEFAULT_PANE_ID,
          activeTabId,
        },
      },
    }));
  },

  setActivePaneId: (connectionId, paneId) => {
    const state = get();
    const connState = state.tabsByConnection[connectionId];
    if (!connState) return;

    const pane = connState.splitLayout.panes.find((p) => p.id === paneId);
    if (pane) {
      set((state) => ({
        tabsByConnection: {
          ...state.tabsByConnection,
          [connectionId]: {
            ...connState,
            activePaneId: paneId,
            activeTabId: pane.activeTabId,
          },
        },
      }));
    }
  },

  setPaneActiveTab: (connectionId, paneId, tabId) => {
    const state = get();
    const connState = state.tabsByConnection[connectionId];
    if (!connState) return;

    set((state) => ({
      tabsByConnection: {
        ...state.tabsByConnection,
        [connectionId]: {
          ...connState,
          splitLayout: {
            ...connState.splitLayout,
            panes: connState.splitLayout.panes.map((pane) =>
              pane.id === paneId ? { ...pane, activeTabId: tabId } : pane
            ),
          },
          // If this is the active pane, also update the global activeTabId
          ...(connState.activePaneId === paneId ? { activeTabId: tabId } : {}),
        },
      },
    }));
  },

  getPane: (connectionId, paneId) => {
    const state = get();
    const connState = state.tabsByConnection[connectionId];
    if (!connState) return undefined;
    return connState.splitLayout.panes.find((p) => p.id === paneId);
  },

  isSplit: (connectionId) => {
    const state = get();
    const connState = state.tabsByConnection[connectionId];
    if (!connState) return false;
    return connState.splitLayout.direction !== null;
  },
}));

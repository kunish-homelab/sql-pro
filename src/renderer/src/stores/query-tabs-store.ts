import type { QueryResult } from '@/types/database';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
}

interface QueryTabsState {
  tabs: QueryTab[];
  activeTabId: string | null;
  dbPath: string | null;

  // Actions
  setDbPath: (dbPath: string | null) => void;
  createTab: (title?: string, query?: string) => string;
  closeTab: (tabId: string) => void;
  closeOtherTabs: (tabId: string) => void;
  closeAllTabs: () => void;
  setActiveTab: (tabId: string) => void;
  updateTabQuery: (tabId: string, query: string) => void;
  updateTabTitle: (tabId: string, title: string) => void;
  updateTabResults: (
    tabId: string,
    results: QueryResult | null,
    executionTime: number | null
  ) => void;
  updateTabError: (tabId: string, error: string | null) => void;
  setTabExecuting: (tabId: string, isExecuting: boolean) => void;
  duplicateTab: (tabId: string) => string;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  getActiveTab: () => QueryTab | undefined;
  reset: () => void;
}

const generateId = (): string => {
  return `tab-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

const createDefaultTab = (title?: string, query?: string): QueryTab => ({
  id: generateId(),
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

const getNextTabNumber = (tabs: QueryTab[]): number => {
  const numbers = tabs
    .map((tab) => {
      const match = tab.title.match(/^Query (\d+)$/);
      return match ? Number.parseInt(match[1], 10) : 0;
    })
    .filter((n) => n > 0);
  return numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
};

export const useQueryTabsStore = create<QueryTabsState>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,
      dbPath: null,

      setDbPath: (dbPath) => {
        const state = get();
        // Only reset tabs if switching to a different database
        if (state.dbPath !== dbPath) {
          const defaultTab = createDefaultTab();
          set({
            dbPath,
            tabs: [defaultTab],
            activeTabId: defaultTab.id,
          });
        }
      },

      createTab: (title, query) => {
        const state = get();
        const tabNumber = getNextTabNumber(state.tabs);
        const newTab = createDefaultTab(title || `Query ${tabNumber}`, query);
        set({
          tabs: [...state.tabs, newTab],
          activeTabId: newTab.id,
        });
        return newTab.id;
      },

      closeTab: (tabId) => {
        const state = get();
        const tabIndex = state.tabs.findIndex((t) => t.id === tabId);
        if (tabIndex === -1) return;

        const newTabs = state.tabs.filter((t) => t.id !== tabId);

        // If closing the active tab, select another one
        let newActiveId = state.activeTabId;
        if (state.activeTabId === tabId) {
          if (newTabs.length === 0) {
            // Create a new default tab if all tabs are closed
            const defaultTab = createDefaultTab();
            set({
              tabs: [defaultTab],
              activeTabId: defaultTab.id,
            });
            return;
          }
          // Select the next tab or the previous one if it was the last
          const newIndex = Math.min(tabIndex, newTabs.length - 1);
          newActiveId = newTabs[newIndex].id;
        }

        set({
          tabs: newTabs,
          activeTabId: newActiveId,
        });
      },

      closeOtherTabs: (tabId) => {
        const state = get();
        const tabToKeep = state.tabs.find((t) => t.id === tabId);
        if (tabToKeep) {
          set({
            tabs: [tabToKeep],
            activeTabId: tabId,
          });
        }
      },

      closeAllTabs: () => {
        const defaultTab = createDefaultTab();
        set({
          tabs: [defaultTab],
          activeTabId: defaultTab.id,
        });
      },

      setActiveTab: (tabId) => {
        const state = get();
        if (state.tabs.some((t) => t.id === tabId)) {
          set({ activeTabId: tabId });
        }
      },

      updateTabQuery: (tabId, query) => {
        set((state) => ({
          tabs: state.tabs.map((tab) =>
            tab.id === tabId ? { ...tab, query, isDirty: true } : tab
          ),
        }));
      },

      updateTabTitle: (tabId, title) => {
        set((state) => ({
          tabs: state.tabs.map((tab) =>
            tab.id === tabId ? { ...tab, title } : tab
          ),
        }));
      },

      updateTabResults: (tabId, results, executionTime) => {
        set((state) => ({
          tabs: state.tabs.map((tab) =>
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
        }));
      },

      updateTabError: (tabId, error) => {
        set((state) => ({
          tabs: state.tabs.map((tab) =>
            tab.id === tabId
              ? { ...tab, error, results: null, lastExecutedAt: Date.now() }
              : tab
          ),
        }));
      },

      setTabExecuting: (tabId, isExecuting) => {
        set((state) => ({
          tabs: state.tabs.map((tab) =>
            tab.id === tabId ? { ...tab, isExecuting } : tab
          ),
        }));
      },

      duplicateTab: (tabId) => {
        const state = get();
        const tabToDuplicate = state.tabs.find((t) => t.id === tabId);
        if (!tabToDuplicate) return '';

        const tabNumber = getNextTabNumber(state.tabs);
        const newTab: QueryTab = {
          ...tabToDuplicate,
          id: generateId(),
          title: `Query ${tabNumber}`,
          results: null,
          error: null,
          isExecuting: false,
          executionTime: null,
          isDirty: tabToDuplicate.query.length > 0,
          createdAt: Date.now(),
          lastExecutedAt: null,
        };

        const tabIndex = state.tabs.findIndex((t) => t.id === tabId);
        const newTabs = [...state.tabs];
        newTabs.splice(tabIndex + 1, 0, newTab);

        set({
          tabs: newTabs,
          activeTabId: newTab.id,
        });

        return newTab.id;
      },

      reorderTabs: (fromIndex, toIndex) => {
        set((state) => {
          const newTabs = [...state.tabs];
          const [movedTab] = newTabs.splice(fromIndex, 1);
          newTabs.splice(toIndex, 0, movedTab);
          return { tabs: newTabs };
        });
      },

      getActiveTab: () => {
        const state = get();
        return state.tabs.find((t) => t.id === state.activeTabId);
      },

      reset: () => {
        const defaultTab = createDefaultTab();
        set({
          tabs: [defaultTab],
          activeTabId: defaultTab.id,
          dbPath: null,
        });
      },
    }),
    {
      name: 'sql-pro-query-tabs',
      partialize: (state) => ({
        tabs: state.tabs.map((tab) => ({
          ...tab,
          // Don't persist execution state
          results: null,
          error: null,
          isExecuting: false,
          executionTime: null,
        })),
        activeTabId: state.activeTabId,
        dbPath: state.dbPath,
      }),
    }
  )
);

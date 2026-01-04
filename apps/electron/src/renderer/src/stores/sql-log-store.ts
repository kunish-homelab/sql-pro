import type { SqlLogEntry, SqlLogLevel } from '@/types/sql-log';
import { create } from 'zustand';
import { sqlPro } from '@/lib/api';

const MAX_LOGS = 500;

interface SqlLogState {
  // Log entries
  logs: SqlLogEntry[];
  isLoading: boolean;

  // Filter state
  filter: {
    connectionId?: string;
    level?: SqlLogLevel;
    searchText?: string;
  };

  // UI state
  isVisible: boolean;
  isPaused: boolean;

  // Actions
  loadLogs: (limit?: number) => Promise<void>;
  addLog: (entry: SqlLogEntry) => void;
  clearLogs: (connectionId?: string) => Promise<void>;
  setFilter: (filter: Partial<SqlLogState['filter']>) => void;
  setVisible: (visible: boolean) => void;
  toggleVisible: () => void;
  setPaused: (paused: boolean) => void;
  togglePaused: () => void;
  getFilteredLogs: () => SqlLogEntry[];
}

export const useSqlLogStore = create<SqlLogState>((set, get) => ({
  logs: [],
  isLoading: false,
  filter: {},
  isVisible: false,
  isPaused: false,

  loadLogs: async (limit = 500) => {
    set({ isLoading: true });
    try {
      const response = await sqlPro.sqlLog.get({ limit });
      if (response.success && response.logs) {
        set({ logs: response.logs, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  addLog: (entry: SqlLogEntry) => {
    const { isPaused, logs } = get();
    if (isPaused) return;

    // Add new log at the beginning and trim if needed
    const newLogs = [entry, ...logs].slice(0, MAX_LOGS);
    set({ logs: newLogs });
  },

  clearLogs: async (connectionId?: string) => {
    try {
      await sqlPro.sqlLog.clear({ connectionId });
      if (connectionId) {
        set((state) => ({
          logs: state.logs.filter((log) => log.connectionId !== connectionId),
        }));
      } else {
        set({ logs: [] });
      }
    } catch {
      // Ignore errors
    }
  },

  setFilter: (filter) => {
    set((state) => ({
      filter: { ...state.filter, ...filter },
    }));
  },

  setVisible: (isVisible) => set({ isVisible }),

  toggleVisible: () => set((state) => ({ isVisible: !state.isVisible })),

  setPaused: (isPaused) => set({ isPaused }),

  togglePaused: () => set((state) => ({ isPaused: !state.isPaused })),

  getFilteredLogs: () => {
    const { logs, filter } = get();
    let result = logs;

    if (filter.connectionId) {
      result = result.filter((log) => log.connectionId === filter.connectionId);
    }

    if (filter.level) {
      result = result.filter((log) => log.level === filter.level);
    }

    if (filter.searchText) {
      const searchLower = filter.searchText.toLowerCase();
      result = result.filter(
        (log) =>
          log.sql?.toLowerCase().includes(searchLower) ||
          log.error?.toLowerCase().includes(searchLower) ||
          log.operation.toLowerCase().includes(searchLower)
      );
    }

    return result;
  },
}));

// Initialize log listener when module loads
let unsubscribe: (() => void) | null = null;

export function initSqlLogListener(): void {
  if (unsubscribe) return;

  unsubscribe = sqlPro.sqlLog.onEntry((entry: SqlLogEntry) => {
    useSqlLogStore.getState().addLog(entry);
  });
}

export function cleanupSqlLogListener(): void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}

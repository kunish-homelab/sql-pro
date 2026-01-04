import type { QueryHistoryEntry } from '@shared/types';
import type { QueryResult } from '@/types/database';
import { create } from 'zustand';
import { sqlPro } from '@/lib/api';

interface QueryState {
  // Current query session
  currentQuery: string;
  results: QueryResult | null;
  error: string | null;
  isExecuting: boolean;
  executionTime: number | null;

  // Query history (persisted per database)
  history: QueryHistoryEntry[];
  isLoadingHistory: boolean;
  currentDbPath: string | null;

  // Actions
  setCurrentQuery: (query: string) => void;
  setResults: (results: QueryResult | null) => void;
  setError: (error: string | null) => void;
  setIsExecuting: (isExecuting: boolean) => void;
  setExecutionTime: (time: number | null) => void;
  loadHistory: (dbPath: string) => Promise<void>;
  addToHistory: (
    dbPath: string,
    query: string,
    success: boolean,
    durationMs: number,
    errorMessage?: string
  ) => Promise<void>;
  deleteHistoryItem: (dbPath: string, entryId: string) => Promise<void>;
  clearHistory: (dbPath: string) => Promise<void>;
  reset: () => void;
}

const MAX_HISTORY_LENGTH = 100;

const initialState = {
  currentQuery: '',
  results: null,
  error: null,
  isExecuting: false,
  executionTime: null,
  history: [] as QueryHistoryEntry[],
  isLoadingHistory: false,
  currentDbPath: null,
};

// Generate a unique ID for history entries
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

export const useQueryStore = create<QueryState>((set) => ({
  ...initialState,

  setCurrentQuery: (currentQuery) => set({ currentQuery }),

  setResults: (results) => set({ results, error: null }),

  setError: (error) => set({ error, results: null }),

  setIsExecuting: (isExecuting) => set({ isExecuting }),

  setExecutionTime: (executionTime) => set({ executionTime }),

  loadHistory: async (dbPath: string) => {
    set({ isLoadingHistory: true, currentDbPath: dbPath });
    try {
      const response = await sqlPro.history.get({ dbPath });
      if (response.success && response.history) {
        set({ history: response.history, isLoadingHistory: false });
      } else {
        set({ history: [], isLoadingHistory: false });
      }
    } catch {
      set({ history: [], isLoadingHistory: false });
    }
  },

  addToHistory: async (dbPath, query, success, durationMs, errorMessage) => {
    const entry: QueryHistoryEntry = {
      id: generateId(),
      dbPath,
      queryText: query,
      executedAt: new Date().toISOString(),
      durationMs,
      success,
      error: errorMessage,
    };

    // Optimistically update the UI
    set((state) => ({
      history: [entry, ...state.history.slice(0, MAX_HISTORY_LENGTH - 1)],
    }));

    // Persist to storage in background (fire-and-forget)
    sqlPro.history.save({ entry }).catch(() => {
      // Silent failure - history is already in memory
    });
  },

  deleteHistoryItem: async (dbPath: string, entryId: string) => {
    // Optimistically update the UI
    set((state) => ({
      history: state.history.filter((entry) => entry.id !== entryId),
    }));

    // Persist deletion to storage
    try {
      await sqlPro.history.delete({ dbPath, entryId });
    } catch {
      // If deletion fails, reload history to restore state
      const response = await sqlPro.history.get({ dbPath });
      if (response.success && response.history) {
        set({ history: response.history });
      }
    }
  },

  clearHistory: async (dbPath: string) => {
    // Optimistically clear the UI
    set({ history: [] });

    // Persist to storage
    try {
      await sqlPro.history.clear({ dbPath });
    } catch {
      // If clearing fails, reload history to restore state
      const response = await sqlPro.history.get({ dbPath });
      if (response.success && response.history) {
        set({ history: response.history });
      }
    }
  },

  reset: () => set(initialState),
}));

import type { QueryResult } from '@/types/database';
import { create } from 'zustand';

interface QueryState {
  // Current query session
  currentQuery: string;
  results: QueryResult | null;
  error: string | null;
  isExecuting: boolean;
  executionTime: number | null;

  // Query history
  history: Array<{
    query: string;
    executedAt: Date;
    success: boolean;
    rowsAffected?: number;
  }>;

  // Actions
  setCurrentQuery: (query: string) => void;
  setResults: (results: QueryResult | null) => void;
  setError: (error: string | null) => void;
  setIsExecuting: (isExecuting: boolean) => void;
  setExecutionTime: (time: number | null) => void;
  addToHistory: (
    query: string,
    success: boolean,
    rowsAffected?: number
  ) => void;
  clearHistory: () => void;
  reset: () => void;
}

const MAX_HISTORY_LENGTH = 100;

const initialState = {
  currentQuery: '',
  results: null,
  error: null,
  isExecuting: false,
  executionTime: null,
  history: [],
};

export const useQueryStore = create<QueryState>((set) => ({
  ...initialState,

  setCurrentQuery: (currentQuery) => set({ currentQuery }),

  setResults: (results) => set({ results, error: null }),

  setError: (error) => set({ error, results: null }),

  setIsExecuting: (isExecuting) => set({ isExecuting }),

  setExecutionTime: (executionTime) => set({ executionTime }),

  addToHistory: (query, success, rowsAffected) =>
    set((state) => ({
      history: [
        {
          query,
          executedAt: new Date(),
          success,
          rowsAffected,
        },
        ...state.history.slice(0, MAX_HISTORY_LENGTH - 1),
      ],
    })),

  clearHistory: () => set({ history: [] }),

  reset: () => set(initialState),
}));

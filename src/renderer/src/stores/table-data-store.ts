import type {
  ColumnSchema,
  FilterState,
  PaginationState,
  SortState,
} from '@/types/database';
import { create } from 'zustand';

interface TableDataForConnection {
  tableName: string | null;
  columns: ColumnSchema[];
  rows: Record<string, unknown>[];
  pagination: PaginationState;
  sort: SortState | null;
  filters: FilterState[];
  isLoading: boolean;
  error: string | null;
  reloadVersion: number;
}

interface TableDataState {
  // Data stored per connection
  dataByConnection: Record<string, TableDataForConnection>;

  // Currently active connection ID
  activeConnectionId: string | null;

  // Actions
  setActiveConnectionId: (connectionId: string | null) => void;
  setTableData: (
    connectionId: string,
    tableName: string,
    columns: ColumnSchema[],
    rows: Record<string, unknown>[],
    totalRows: number
  ) => void;
  setPagination: (
    connectionId: string,
    pagination: Partial<PaginationState>
  ) => void;
  setSort: (connectionId: string, sort: SortState | null) => void;
  setFilters: (connectionId: string, filters: FilterState[]) => void;
  addFilter: (connectionId: string, filter: FilterState) => void;
  removeFilter: (connectionId: string, index: number) => void;
  setIsLoading: (connectionId: string, isLoading: boolean) => void;
  setError: (connectionId: string, error: string | null) => void;
  resetConnection: (connectionId: string) => void;
  removeConnectionData: (connectionId: string) => void;
  triggerReload: (connectionId: string) => void;
  reset: () => void;

  // Computed getters
  getDataForConnection: (connectionId: string) => TableDataForConnection | null;
  getCurrentData: () => TableDataForConnection | null;

  // Legacy compatibility - for components that don't pass connectionId
  tableName: string | null;
  columns: ColumnSchema[];
  rows: Record<string, unknown>[];
  pagination: PaginationState;
  sort: SortState | null;
  filters: FilterState[];
  isLoading: boolean;
  error: string | null;
  reloadVersion: number;
}

const initialPagination: PaginationState = {
  page: 1,
  pageSize: 100,
  totalRows: 0,
  totalPages: 0,
};

const createDefaultDataState = (): TableDataForConnection => ({
  tableName: null,
  columns: [],
  rows: [],
  pagination: initialPagination,
  sort: null,
  filters: [],
  isLoading: false,
  error: null,
  reloadVersion: 0,
});

const getOrCreateConnectionData = (
  dataByConnection: Record<string, TableDataForConnection>,
  connectionId: string
): TableDataForConnection => {
  if (dataByConnection[connectionId]) {
    return dataByConnection[connectionId];
  }
  return createDefaultDataState();
};

export const useTableDataStore = create<TableDataState>((set, get) => ({
  dataByConnection: {},
  activeConnectionId: null,

  // Legacy compatibility getters
  get tableName() {
    const state = get();
    if (!state.activeConnectionId) return null;
    return state.dataByConnection[state.activeConnectionId]?.tableName || null;
  },
  get columns() {
    const state = get();
    if (!state.activeConnectionId) return [];
    return state.dataByConnection[state.activeConnectionId]?.columns || [];
  },
  get rows() {
    const state = get();
    if (!state.activeConnectionId) return [];
    return state.dataByConnection[state.activeConnectionId]?.rows || [];
  },
  get pagination() {
    const state = get();
    if (!state.activeConnectionId) return initialPagination;
    return (
      state.dataByConnection[state.activeConnectionId]?.pagination ||
      initialPagination
    );
  },
  get sort() {
    const state = get();
    if (!state.activeConnectionId) return null;
    return state.dataByConnection[state.activeConnectionId]?.sort || null;
  },
  get filters() {
    const state = get();
    if (!state.activeConnectionId) return [];
    return state.dataByConnection[state.activeConnectionId]?.filters || [];
  },
  get isLoading() {
    const state = get();
    if (!state.activeConnectionId) return false;
    return state.dataByConnection[state.activeConnectionId]?.isLoading || false;
  },
  get error() {
    const state = get();
    if (!state.activeConnectionId) return null;
    return state.dataByConnection[state.activeConnectionId]?.error || null;
  },
  get reloadVersion() {
    const state = get();
    if (!state.activeConnectionId) return 0;
    return state.dataByConnection[state.activeConnectionId]?.reloadVersion || 0;
  },

  setActiveConnectionId: (connectionId) => {
    set({ activeConnectionId: connectionId });
  },

  setTableData: (connectionId, tableName, columns, rows, totalRows) =>
    set((state) => {
      const connData = getOrCreateConnectionData(
        state.dataByConnection,
        connectionId
      );
      return {
        dataByConnection: {
          ...state.dataByConnection,
          [connectionId]: {
            ...connData,
            tableName,
            columns,
            rows,
            pagination: {
              ...connData.pagination,
              totalRows,
              totalPages: Math.ceil(totalRows / connData.pagination.pageSize),
            },
            error: null,
          },
        },
      };
    }),

  setPagination: (connectionId, pagination) =>
    set((state) => {
      const connData = getOrCreateConnectionData(
        state.dataByConnection,
        connectionId
      );
      return {
        dataByConnection: {
          ...state.dataByConnection,
          [connectionId]: {
            ...connData,
            pagination: { ...connData.pagination, ...pagination },
          },
        },
      };
    }),

  setSort: (connectionId, sort) =>
    set((state) => {
      const connData = getOrCreateConnectionData(
        state.dataByConnection,
        connectionId
      );
      return {
        dataByConnection: {
          ...state.dataByConnection,
          [connectionId]: {
            ...connData,
            sort,
          },
        },
      };
    }),

  setFilters: (connectionId, filters) =>
    set((state) => {
      const connData = getOrCreateConnectionData(
        state.dataByConnection,
        connectionId
      );
      return {
        dataByConnection: {
          ...state.dataByConnection,
          [connectionId]: {
            ...connData,
            filters,
          },
        },
      };
    }),

  addFilter: (connectionId, filter) =>
    set((state) => {
      const connData = getOrCreateConnectionData(
        state.dataByConnection,
        connectionId
      );
      return {
        dataByConnection: {
          ...state.dataByConnection,
          [connectionId]: {
            ...connData,
            filters: [...connData.filters, filter],
          },
        },
      };
    }),

  removeFilter: (connectionId, index) =>
    set((state) => {
      const connData = getOrCreateConnectionData(
        state.dataByConnection,
        connectionId
      );
      return {
        dataByConnection: {
          ...state.dataByConnection,
          [connectionId]: {
            ...connData,
            filters: connData.filters.filter((_, i) => i !== index),
          },
        },
      };
    }),

  setIsLoading: (connectionId, isLoading) =>
    set((state) => {
      const connData = getOrCreateConnectionData(
        state.dataByConnection,
        connectionId
      );
      return {
        dataByConnection: {
          ...state.dataByConnection,
          [connectionId]: {
            ...connData,
            isLoading,
          },
        },
      };
    }),

  setError: (connectionId, error) =>
    set((state) => {
      const connData = getOrCreateConnectionData(
        state.dataByConnection,
        connectionId
      );
      return {
        dataByConnection: {
          ...state.dataByConnection,
          [connectionId]: {
            ...connData,
            error,
          },
        },
      };
    }),

  resetConnection: (connectionId) =>
    set((state) => ({
      dataByConnection: {
        ...state.dataByConnection,
        [connectionId]: createDefaultDataState(),
      },
    })),

  removeConnectionData: (connectionId) =>
    set((state) => {
      const { [connectionId]: _, ...rest } = state.dataByConnection;
      return {
        dataByConnection: rest,
        activeConnectionId:
          state.activeConnectionId === connectionId
            ? null
            : state.activeConnectionId,
      };
    }),

  triggerReload: (connectionId) =>
    set((state) => {
      const connData = getOrCreateConnectionData(
        state.dataByConnection,
        connectionId
      );
      return {
        dataByConnection: {
          ...state.dataByConnection,
          [connectionId]: {
            ...connData,
            reloadVersion: connData.reloadVersion + 1,
          },
        },
      };
    }),

  reset: () =>
    set({
      dataByConnection: {},
      activeConnectionId: null,
    }),

  getDataForConnection: (connectionId) => {
    const state = get();
    return state.dataByConnection[connectionId] || null;
  },

  getCurrentData: () => {
    const state = get();
    if (!state.activeConnectionId) return null;
    return state.dataByConnection[state.activeConnectionId] || null;
  },
}));

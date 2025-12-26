import { create } from 'zustand';
import type {
  ColumnSchema,
  PaginationState,
  SortState,
  FilterState,
} from '@/types/database';

interface TableDataState {
  // Current table data
  tableName: string | null;
  columns: ColumnSchema[];
  rows: Record<string, unknown>[];

  // Pagination
  pagination: PaginationState;

  // Sort & Filter
  sort: SortState | null;
  filters: FilterState[];

  // Loading state
  isLoading: boolean;
  error: string | null;

  // Reload trigger - incremented to force data reload
  reloadVersion: number;

  // Actions
  setTableData: (
    tableName: string,
    columns: ColumnSchema[],
    rows: Record<string, unknown>[],
    totalRows: number
  ) => void;
  setPagination: (pagination: Partial<PaginationState>) => void;
  setSort: (sort: SortState | null) => void;
  setFilters: (filters: FilterState[]) => void;
  addFilter: (filter: FilterState) => void;
  removeFilter: (index: number) => void;
  setIsLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
  triggerReload: () => void;
}

const initialPagination: PaginationState = {
  page: 1,
  pageSize: 100,
  totalRows: 0,
  totalPages: 0,
};

const initialState = {
  tableName: null,
  columns: [],
  rows: [],
  pagination: initialPagination,
  sort: null,
  filters: [],
  isLoading: false,
  error: null,
  reloadVersion: 0,
};

export const useTableDataStore = create<TableDataState>((set) => ({
  ...initialState,

  setTableData: (tableName, columns, rows, totalRows) =>
    set((state) => ({
      tableName,
      columns,
      rows,
      pagination: {
        ...state.pagination,
        totalRows,
        totalPages: Math.ceil(totalRows / state.pagination.pageSize),
      },
      error: null,
    })),

  setPagination: (pagination) =>
    set((state) => ({
      pagination: { ...state.pagination, ...pagination },
    })),

  setSort: (sort) => set({ sort }),

  setFilters: (filters) => set({ filters }),

  addFilter: (filter) =>
    set((state) => ({
      filters: [...state.filters, filter],
    })),

  removeFilter: (index) =>
    set((state) => ({
      filters: state.filters.filter((_, i) => i !== index),
    })),

  setIsLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  reset: () => set(initialState),
  triggerReload: () =>
    set((state) => ({ reloadVersion: state.reloadVersion + 1 })),
}));

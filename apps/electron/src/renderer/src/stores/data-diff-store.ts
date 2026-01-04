import type { DataComparisonResult, RowDiff } from '@shared/types';
import { create } from 'zustand';

/**
 * Source or target table selection for data comparison
 */
export interface TableSelection {
  /** Connection ID */
  connectionId: string;
  /** Table name */
  tableName: string;
  /** Schema name (defaults to 'main') */
  schemaName?: string;
  /** Display name */
  displayName?: string;
}

/**
 * Filter options for viewing row differences
 */
export interface DataDiffFilters {
  /** Show only differences (hide unchanged rows) */
  showOnlyDifferences: boolean;
  /** Filter by diff type */
  diffTypes: {
    added: boolean;
    removed: boolean;
    modified: boolean;
    unchanged: boolean;
  };
  /** Text search filter (search by column values) */
  searchText: string;
}

/**
 * UI state for expanded/collapsed rows
 */
export interface ExpandedRows {
  /** Map of row primary keys (stringified) to expanded state */
  rows: Map<string, boolean>;
  /** Whether the summary panel is expanded */
  summary: boolean;
}

/**
 * Pagination state for data diff results
 */
export interface PaginationState {
  /** Current page number (0-indexed) */
  currentPage: number;
  /** Number of rows per page */
  pageSize: number;
  /** Total number of rows */
  totalRows: number;
}

interface DataDiffState {
  // Comparison results
  comparisonResult: DataComparisonResult | null;
  isComparing: boolean;
  comparisonError: string | null;

  // Source and target selection
  source: TableSelection | null;
  target: TableSelection | null;

  // Primary key columns for row matching
  primaryKeys: string[];
  autoDetectedPrimaryKeys: string[];
  isDetectingPrimaryKeys: boolean;

  // Filter state
  filters: DataDiffFilters;

  // UI state for expanded/collapsed rows
  expandedRows: ExpandedRows;

  // Pagination state
  pagination: PaginationState;

  // Selected rows for SQL generation
  selectedRowKeys: Set<string>;

  // Actions - Comparison
  setComparisonResult: (result: DataComparisonResult | null) => void;
  setIsComparing: (isComparing: boolean) => void;
  setComparisonError: (error: string | null) => void;
  clearComparison: () => void;

  // Actions - Source/Target Selection
  setSource: (source: TableSelection | null) => void;
  setTarget: (target: TableSelection | null) => void;

  // Actions - Primary Keys
  setPrimaryKeys: (keys: string[]) => void;
  setAutoDetectedPrimaryKeys: (keys: string[]) => void;
  setIsDetectingPrimaryKeys: (isDetecting: boolean) => void;

  // Actions - Filters
  setShowOnlyDifferences: (show: boolean) => void;
  setDiffTypeFilter: (
    type: keyof DataDiffFilters['diffTypes'],
    enabled: boolean
  ) => void;
  setSearchText: (text: string) => void;
  resetFilters: () => void;

  // Actions - Expanded Rows
  toggleRowExpanded: (rowKey: string) => void;
  expandAllRows: () => void;
  collapseAllRows: () => void;
  toggleSummaryExpanded: () => void;

  // Actions - Pagination
  setCurrentPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setTotalRows: (totalRows: number) => void;

  // Actions - Row Selection
  toggleRowSelection: (rowKey: string) => void;
  selectAllRows: () => void;
  deselectAllRows: () => void;
  selectRowsByDiffType: (
    diffType: 'added' | 'removed' | 'modified' | 'unchanged'
  ) => void;

  // Reset all state
  reset: () => void;
}

const defaultFilters: DataDiffFilters = {
  showOnlyDifferences: false,
  diffTypes: {
    added: true,
    removed: true,
    modified: true,
    unchanged: true,
  },
  searchText: '',
};

const defaultExpandedRows: ExpandedRows = {
  rows: new Map<string, boolean>(),
  summary: true,
};

const defaultPagination: PaginationState = {
  currentPage: 0,
  pageSize: 100,
  totalRows: 0,
};

const initialState = {
  comparisonResult: null,
  isComparing: false,
  comparisonError: null,
  source: null,
  target: null,
  primaryKeys: [],
  autoDetectedPrimaryKeys: [],
  isDetectingPrimaryKeys: false,
  filters: { ...defaultFilters },
  expandedRows: { ...defaultExpandedRows, rows: new Map() },
  pagination: { ...defaultPagination },
  selectedRowKeys: new Set<string>(),
};

/**
 * Helper function to create a unique key from row primary key values
 */
function createRowKey(primaryKey: Record<string, unknown>): string {
  return JSON.stringify(primaryKey);
}

export const useDataDiffStore = create<DataDiffState>((set) => ({
  ...initialState,

  // Comparison Actions
  setComparisonResult: (comparisonResult) =>
    set({ comparisonResult, comparisonError: null }),

  setIsComparing: (isComparing) => set({ isComparing }),

  setComparisonError: (comparisonError) =>
    set({ comparisonError, comparisonResult: null }),

  clearComparison: () =>
    set({
      comparisonResult: null,
      comparisonError: null,
      isComparing: false,
      selectedRowKeys: new Set(),
    }),

  // Source/Target Selection Actions
  setSource: (source) => set({ source }),

  setTarget: (target) => set({ target }),

  // Primary Key Actions
  setPrimaryKeys: (primaryKeys) => set({ primaryKeys }),

  setAutoDetectedPrimaryKeys: (autoDetectedPrimaryKeys) =>
    set({ autoDetectedPrimaryKeys }),

  setIsDetectingPrimaryKeys: (isDetectingPrimaryKeys) =>
    set({ isDetectingPrimaryKeys }),

  // Filter Actions
  setShowOnlyDifferences: (show) =>
    set((state) => ({
      filters: { ...state.filters, showOnlyDifferences: show },
    })),

  setDiffTypeFilter: (type, enabled) =>
    set((state) => ({
      filters: {
        ...state.filters,
        diffTypes: { ...state.filters.diffTypes, [type]: enabled },
      },
    })),

  setSearchText: (searchText) =>
    set((state) => ({
      filters: { ...state.filters, searchText },
    })),

  resetFilters: () =>
    set({
      filters: { ...defaultFilters },
    }),

  // Expanded Rows Actions
  toggleRowExpanded: (rowKey) =>
    set((state) => {
      const newRowsMap = new Map(state.expandedRows.rows);
      const currentValue = newRowsMap.get(rowKey) ?? false;
      newRowsMap.set(rowKey, !currentValue);
      return {
        expandedRows: {
          ...state.expandedRows,
          rows: newRowsMap,
        },
      };
    }),

  expandAllRows: () =>
    set((state) => {
      if (!state.comparisonResult) return state;
      const newRowsMap = new Map<string, boolean>();
      state.comparisonResult.rowDiffs.forEach((diff: RowDiff) => {
        newRowsMap.set(createRowKey(diff.primaryKey), true);
      });
      return {
        expandedRows: {
          ...state.expandedRows,
          rows: newRowsMap,
        },
      };
    }),

  collapseAllRows: () =>
    set((state) => ({
      expandedRows: {
        ...state.expandedRows,
        rows: new Map(),
      },
    })),

  toggleSummaryExpanded: () =>
    set((state) => ({
      expandedRows: {
        ...state.expandedRows,
        summary: !state.expandedRows.summary,
      },
    })),

  // Pagination Actions
  setCurrentPage: (currentPage) =>
    set((state) => ({
      pagination: { ...state.pagination, currentPage },
    })),

  setPageSize: (pageSize) =>
    set((state) => ({
      pagination: { ...state.pagination, pageSize, currentPage: 0 },
    })),

  setTotalRows: (totalRows) =>
    set((state) => ({
      pagination: { ...state.pagination, totalRows },
    })),

  // Row Selection Actions
  toggleRowSelection: (rowKey) =>
    set((state) => {
      const newSelectedRowKeys = new Set(state.selectedRowKeys);
      if (newSelectedRowKeys.has(rowKey)) {
        newSelectedRowKeys.delete(rowKey);
      } else {
        newSelectedRowKeys.add(rowKey);
      }
      return { selectedRowKeys: newSelectedRowKeys };
    }),

  selectAllRows: () =>
    set((state) => {
      if (!state.comparisonResult) return state;
      const newSelectedRowKeys = new Set<string>();
      state.comparisonResult.rowDiffs.forEach((diff: RowDiff) => {
        newSelectedRowKeys.add(createRowKey(diff.primaryKey));
      });
      return { selectedRowKeys: newSelectedRowKeys };
    }),

  deselectAllRows: () =>
    set({
      selectedRowKeys: new Set(),
    }),

  selectRowsByDiffType: (diffType) =>
    set((state) => {
      if (!state.comparisonResult) return state;
      const newSelectedRowKeys = new Set<string>();
      state.comparisonResult.rowDiffs
        .filter((diff: RowDiff) => diff.diffType === diffType)
        .forEach((diff: RowDiff) => {
          newSelectedRowKeys.add(createRowKey(diff.primaryKey));
        });
      return { selectedRowKeys: newSelectedRowKeys };
    }),

  // Reset all state
  reset: () =>
    set({
      ...initialState,
      filters: { ...defaultFilters },
      expandedRows: { ...defaultExpandedRows, rows: new Map() },
      pagination: { ...defaultPagination },
      selectedRowKeys: new Set(),
    }),
}));

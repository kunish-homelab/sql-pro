import type {
  SchemaComparisonResult,
  SchemaSnapshot,
  TableDiff,
} from '@shared/types';
import { create } from 'zustand';

/**
 * Source or target selection for schema comparison
 */
export interface ComparisonSource {
  /** Type of source: database connection or saved snapshot */
  type: 'connection' | 'snapshot';
  /** Connection ID (if type is 'connection') */
  connectionId?: string;
  /** Snapshot ID (if type is 'snapshot') */
  snapshotId?: string;
  /** Display name */
  name?: string;
}

/**
 * Filter options for viewing schema differences
 */
export interface DiffFilters {
  /** Show only differences (hide unchanged items) */
  showOnlyDifferences: boolean;
  /** Filter by change type */
  changeTypes: {
    added: boolean;
    removed: boolean;
    modified: boolean;
  };
  /** Filter by object type */
  objectTypes: {
    tables: boolean;
    columns: boolean;
    indexes: boolean;
    triggers: boolean;
    foreignKeys: boolean;
  };
  /** Text search filter (filter by name) */
  searchText: string;
}

/**
 * UI state for expanded/collapsed sections
 */
export interface ExpandedSections {
  /** Map of table names to expanded state */
  tables: Map<string, boolean>;
  /** Whether the summary panel is expanded */
  summary: boolean;
}

interface SchemaComparisonState {
  // Comparison results
  comparisonResult: SchemaComparisonResult | null;
  isComparing: boolean;
  comparisonError: string | null;

  // Source and target selection
  source: ComparisonSource | null;
  target: ComparisonSource | null;

  // Available snapshots (cached for selector dropdowns)
  availableSnapshots: SchemaSnapshot[];
  isLoadingSnapshots: boolean;

  // Filter state
  filters: DiffFilters;

  // UI state for expanded/collapsed sections
  expandedSections: ExpandedSections;

  // Actions - Comparison
  setComparisonResult: (result: SchemaComparisonResult | null) => void;
  setIsComparing: (isComparing: boolean) => void;
  setComparisonError: (error: string | null) => void;
  clearComparison: () => void;

  // Actions - Source/Target Selection
  setSource: (source: ComparisonSource | null) => void;
  setTarget: (target: ComparisonSource | null) => void;

  // Actions - Snapshots
  setAvailableSnapshots: (snapshots: SchemaSnapshot[]) => void;
  setIsLoadingSnapshots: (isLoading: boolean) => void;
  addSnapshot: (snapshot: SchemaSnapshot) => void;
  removeSnapshot: (snapshotId: string) => void;

  // Actions - Filters
  setShowOnlyDifferences: (show: boolean) => void;
  setChangeTypeFilter: (
    type: keyof DiffFilters['changeTypes'],
    enabled: boolean
  ) => void;
  setObjectTypeFilter: (
    type: keyof DiffFilters['objectTypes'],
    enabled: boolean
  ) => void;
  setSearchText: (text: string) => void;
  resetFilters: () => void;

  // Actions - Expanded Sections
  toggleTableExpanded: (tableName: string) => void;
  expandAllTables: () => void;
  collapseAllTables: () => void;
  toggleSummaryExpanded: () => void;

  // Reset all state
  reset: () => void;
}

const defaultFilters: DiffFilters = {
  showOnlyDifferences: false,
  changeTypes: {
    added: true,
    removed: true,
    modified: true,
  },
  objectTypes: {
    tables: true,
    columns: true,
    indexes: true,
    triggers: true,
    foreignKeys: true,
  },
  searchText: '',
};

const defaultExpandedSections: ExpandedSections = {
  tables: new Map<string, boolean>(),
  summary: true,
};

const initialState = {
  comparisonResult: null,
  isComparing: false,
  comparisonError: null,
  source: null,
  target: null,
  availableSnapshots: [],
  isLoadingSnapshots: false,
  filters: { ...defaultFilters },
  expandedSections: { ...defaultExpandedSections, tables: new Map() },
};

export const useSchemaComparisonStore = create<SchemaComparisonState>(
  (set) => ({
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
      }),

    // Source/Target Selection Actions
    setSource: (source) => set({ source }),

    setTarget: (target) => set({ target }),

    // Snapshot Actions
    setAvailableSnapshots: (availableSnapshots) => set({ availableSnapshots }),

    setIsLoadingSnapshots: (isLoadingSnapshots) => set({ isLoadingSnapshots }),

    addSnapshot: (snapshot) =>
      set((state) => ({
        availableSnapshots: [snapshot, ...state.availableSnapshots],
      })),

    removeSnapshot: (snapshotId) =>
      set((state) => ({
        availableSnapshots: state.availableSnapshots.filter(
          (s) => s.id !== snapshotId
        ),
        // Clear source/target if the deleted snapshot was selected
        source:
          state.source?.type === 'snapshot' &&
          state.source.snapshotId === snapshotId
            ? null
            : state.source,
        target:
          state.target?.type === 'snapshot' &&
          state.target.snapshotId === snapshotId
            ? null
            : state.target,
      })),

    // Filter Actions
    setShowOnlyDifferences: (show) =>
      set((state) => ({
        filters: { ...state.filters, showOnlyDifferences: show },
      })),

    setChangeTypeFilter: (type, enabled) =>
      set((state) => ({
        filters: {
          ...state.filters,
          changeTypes: { ...state.filters.changeTypes, [type]: enabled },
        },
      })),

    setObjectTypeFilter: (type, enabled) =>
      set((state) => ({
        filters: {
          ...state.filters,
          objectTypes: { ...state.filters.objectTypes, [type]: enabled },
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

    // Expanded Sections Actions
    toggleTableExpanded: (tableName) =>
      set((state) => {
        const newTablesMap = new Map(state.expandedSections.tables);
        const currentValue = newTablesMap.get(tableName) ?? false;
        newTablesMap.set(tableName, !currentValue);
        return {
          expandedSections: {
            ...state.expandedSections,
            tables: newTablesMap,
          },
        };
      }),

    expandAllTables: () =>
      set((state) => {
        if (!state.comparisonResult) return state;
        const newTablesMap = new Map<string, boolean>();
        state.comparisonResult.tableDiffs.forEach((diff: TableDiff) => {
          newTablesMap.set(diff.name, true);
        });
        return {
          expandedSections: {
            ...state.expandedSections,
            tables: newTablesMap,
          },
        };
      }),

    collapseAllTables: () =>
      set((state) => ({
        expandedSections: {
          ...state.expandedSections,
          tables: new Map(),
        },
      })),

    toggleSummaryExpanded: () =>
      set((state) => ({
        expandedSections: {
          ...state.expandedSections,
          summary: !state.expandedSections.summary,
        },
      })),

    // Reset all state
    reset: () =>
      set({
        ...initialState,
        filters: { ...defaultFilters },
        expandedSections: { ...defaultExpandedSections, tables: new Map() },
      }),
  })
);

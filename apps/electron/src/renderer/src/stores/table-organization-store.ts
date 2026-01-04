import { create } from 'zustand';

/**
 * Sort options for tables in the sidebar
 */
export type TableSortOption =
  | 'name-asc'
  | 'name-desc'
  | 'row-count-asc'
  | 'row-count-desc'
  | 'custom';

/**
 * Table metadata for organization purposes
 */
export interface TableMetadata {
  /** Custom tags assigned to the table */
  tags: string[];
  /** Custom sort order (used when sortOption is 'custom') */
  sortOrder?: number;
  /** Whether the table is pinned to the top */
  pinned?: boolean;
  /** Custom color for the table (hex) */
  color?: string;
}

/**
 * Key format: "connectionPath:schemaName:tableName"
 */
type TableKey = string;

interface TableOrganizationState {
  /** Sort option for tables */
  sortOption: TableSortOption;

  /** All available tags (user-defined) */
  availableTags: string[];

  /** Metadata for each table, keyed by "connectionPath:schemaName:tableName" */
  tableMetadata: Record<TableKey, TableMetadata>;

  /** Filter tables by tag (null means show all) */
  activeTagFilter: string | null;

  // Actions
  setSortOption: (option: TableSortOption) => void;

  // Tag management
  addTag: (tag: string) => void;
  removeTag: (tag: string) => void;
  renameTag: (oldTag: string, newTag: string) => void;

  // Table metadata actions
  setTableTags: (tableKey: TableKey, tags: string[]) => void;
  addTableTag: (tableKey: TableKey, tag: string) => void;
  removeTableTag: (tableKey: TableKey, tag: string) => void;
  setTablePinned: (tableKey: TableKey, pinned: boolean) => void;
  setTableColor: (tableKey: TableKey, color: string | undefined) => void;
  setTableSortOrder: (tableKey: TableKey, order: number) => void;

  // Filter
  setActiveTagFilter: (tag: string | null) => void;

  // Helpers
  getTableMetadata: (tableKey: TableKey) => TableMetadata;
  getTableKey: (
    connectionPath: string,
    schemaName: string,
    tableName: string
  ) => TableKey;
}

const DEFAULT_METADATA: TableMetadata = {
  tags: [],
  pinned: false,
};

export const useTableOrganizationStore = create<TableOrganizationState>()(
  (set, get) => ({
    sortOption: 'name-asc',
    availableTags: [],
    tableMetadata: {},
    activeTagFilter: null,

    setSortOption: (option) => set({ sortOption: option }),

    // Tag management
    addTag: (tag) => {
      const trimmedTag = tag.trim();
      if (!trimmedTag) return;
      set((state) => ({
        availableTags: state.availableTags.includes(trimmedTag)
          ? state.availableTags
          : [...state.availableTags, trimmedTag],
      }));
    },

    removeTag: (tag) => {
      set((state) => {
        // Remove tag from available tags
        const newAvailableTags = state.availableTags.filter((t) => t !== tag);

        // Remove tag from all tables that have it
        const newTableMetadata = { ...state.tableMetadata };
        for (const key of Object.keys(newTableMetadata)) {
          if (newTableMetadata[key].tags.includes(tag)) {
            newTableMetadata[key] = {
              ...newTableMetadata[key],
              tags: newTableMetadata[key].tags.filter((t) => t !== tag),
            };
          }
        }

        return {
          availableTags: newAvailableTags,
          tableMetadata: newTableMetadata,
          activeTagFilter:
            state.activeTagFilter === tag ? null : state.activeTagFilter,
        };
      });
    },

    renameTag: (oldTag, newTag) => {
      const trimmedNewTag = newTag.trim();
      if (!trimmedNewTag || oldTag === trimmedNewTag) return;

      set((state) => {
        // Rename in available tags
        const newAvailableTags = state.availableTags.map((t) =>
          t === oldTag ? trimmedNewTag : t
        );

        // Rename in all tables that have it
        const newTableMetadata = { ...state.tableMetadata };
        for (const key of Object.keys(newTableMetadata)) {
          if (newTableMetadata[key].tags.includes(oldTag)) {
            newTableMetadata[key] = {
              ...newTableMetadata[key],
              tags: newTableMetadata[key].tags.map((t) =>
                t === oldTag ? trimmedNewTag : t
              ),
            };
          }
        }

        return {
          availableTags: newAvailableTags,
          tableMetadata: newTableMetadata,
          activeTagFilter:
            state.activeTagFilter === oldTag
              ? trimmedNewTag
              : state.activeTagFilter,
        };
      });
    },

    // Table metadata actions
    setTableTags: (tableKey, tags) => {
      set((state) => {
        const existing = state.tableMetadata[tableKey] || DEFAULT_METADATA;
        return {
          tableMetadata: {
            ...state.tableMetadata,
            [tableKey]: { ...existing, tags },
          },
        };
      });
    },

    addTableTag: (tableKey, tag) => {
      const trimmedTag = tag.trim();
      if (!trimmedTag) return;

      set((state) => {
        const existing = state.tableMetadata[tableKey] || DEFAULT_METADATA;
        if (existing.tags.includes(trimmedTag)) return state;

        // Also add to available tags if not present
        const newAvailableTags = state.availableTags.includes(trimmedTag)
          ? state.availableTags
          : [...state.availableTags, trimmedTag];

        return {
          availableTags: newAvailableTags,
          tableMetadata: {
            ...state.tableMetadata,
            [tableKey]: { ...existing, tags: [...existing.tags, trimmedTag] },
          },
        };
      });
    },

    removeTableTag: (tableKey, tag) => {
      set((state) => {
        const existing = state.tableMetadata[tableKey];
        if (!existing) return state;

        return {
          tableMetadata: {
            ...state.tableMetadata,
            [tableKey]: {
              ...existing,
              tags: existing.tags.filter((t) => t !== tag),
            },
          },
        };
      });
    },

    setTablePinned: (tableKey, pinned) => {
      set((state) => {
        const existing = state.tableMetadata[tableKey] || DEFAULT_METADATA;
        return {
          tableMetadata: {
            ...state.tableMetadata,
            [tableKey]: { ...existing, pinned },
          },
        };
      });
    },

    setTableColor: (tableKey, color) => {
      set((state) => {
        const existing = state.tableMetadata[tableKey] || DEFAULT_METADATA;
        return {
          tableMetadata: {
            ...state.tableMetadata,
            [tableKey]: { ...existing, color },
          },
        };
      });
    },

    setTableSortOrder: (tableKey, order) => {
      set((state) => {
        const existing = state.tableMetadata[tableKey] || DEFAULT_METADATA;
        return {
          tableMetadata: {
            ...state.tableMetadata,
            [tableKey]: { ...existing, sortOrder: order },
          },
        };
      });
    },

    setActiveTagFilter: (tag) => set({ activeTagFilter: tag }),

    getTableMetadata: (tableKey) => {
      return get().tableMetadata[tableKey] || DEFAULT_METADATA;
    },

    getTableKey: (connectionPath, schemaName, tableName) => {
      return `${connectionPath}:${schemaName}:${tableName}`;
    },
  })
);

// Selector hooks
export const useSortOption = () =>
  useTableOrganizationStore((s) => s.sortOption);
export const useAvailableTags = () =>
  useTableOrganizationStore((s) => s.availableTags);
export const useActiveTagFilter = () =>
  useTableOrganizationStore((s) => s.activeTagFilter);

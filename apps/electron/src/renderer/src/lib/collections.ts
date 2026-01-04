import type { ColumnInfo, PendingChangeInfo } from '@shared/types';
import type { FilterState } from '@/types/database';
import { createCollection, localOnlyCollectionOptions } from '@tanstack/db';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import { sqlPro } from './api';
import { queryClient } from './query-client';

// ============ Types ============

export interface TableRow {
  /** Unique row identifier (primary key value or rowid) */
  __rowId: string | number;
  /** Flag for newly inserted rows */
  __isNew?: boolean;
  /** Flag for modified rows */
  __isModified?: boolean;
  /** Flag for deleted rows */
  __isDeleted?: boolean;
  /** Actual row data */
  [key: string]: unknown;
}

export interface TableDataQueryParams {
  connectionId: string;
  table: string;
  page: number;
  pageSize: number;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  /** Server-side filters using FilterState type from database.ts */
  filters?: FilterState[];
}

export interface TableDataMeta {
  columns: ColumnInfo[];
  totalRows: number;
  params: TableDataQueryParams;
}

// ============ Table Rows Collection Factory ============

/**
 * Creates a collection for table rows with optimistic mutation support.
 * Each table/query combination gets its own collection instance.
 */
export function createTableRowsCollection(params: TableDataQueryParams) {
  const {
    connectionId,
    table,
    page,
    pageSize,
    sortColumn,
    sortDirection,
    filters,
  } = params;

  return createCollection<TableRow, string | number>(
    queryCollectionOptions({
      queryKey: [
        'tableData',
        connectionId,
        table,
        page,
        pageSize,
        sortColumn,
        sortDirection,
        filters,
      ],
      queryFn: async (): Promise<TableRow[]> => {
        const response = await sqlPro.db.getTableData({
          connectionId,
          table,
          page,
          pageSize,
          sortColumn,
          sortDirection,
          filters,
        });

        if (!response.success || !response.rows) {
          throw new Error(response.error || 'Failed to fetch table data');
        }

        // Transform rows to include __rowId for identification
        const columns = response.columns || [];
        const pkColumn = columns.find((c: ColumnInfo) => c.isPrimaryKey)?.name;

        return response.rows.map(
          (row: Record<string, unknown>, index: number) => {
            // Use primary key if available, otherwise use rowid or index
            const rowId = pkColumn
              ? row[pkColumn]
              : (row.rowid ?? `__index_${index}`);

            return {
              ...row,
              __rowId: rowId as string | number,
            };
          }
        );
      },
      queryClient,
      getKey: (row) => row.__rowId,

      // Optimistic update handlers
      onUpdate: async ({ transaction }) => {
        const mutations = transaction.mutations;
        const changes: PendingChangeInfo[] = mutations.map((m) => ({
          id: String(m.key),
          table,
          rowId: m.key,
          type: 'update',
          oldValues: m.original as Record<string, unknown>,
          newValues: m.modified as Record<string, unknown>,
          primaryKeyColumn: undefined, // Will be set by caller if needed
        }));

        const response = await sqlPro.db.applyChanges({
          connectionId,
          changes,
        });

        if (!response.success) {
          throw new Error(response.error || 'Failed to apply changes');
        }
      },

      onInsert: async ({ transaction }) => {
        const mutations = transaction.mutations;
        const changes: PendingChangeInfo[] = mutations.map((m) => ({
          id: String(m.key),
          table,
          rowId: m.key,
          type: 'insert',
          oldValues: null,
          newValues: m.modified as Record<string, unknown>,
        }));

        const response = await sqlPro.db.applyChanges({
          connectionId,
          changes,
        });

        if (!response.success) {
          throw new Error(response.error || 'Failed to insert rows');
        }
      },

      onDelete: async ({ transaction }) => {
        const mutations = transaction.mutations;
        const changes: PendingChangeInfo[] = mutations.map((m) => ({
          id: String(m.key),
          table,
          rowId: m.key,
          type: 'delete',
          oldValues: m.original as Record<string, unknown>,
          newValues: null,
        }));

        const response = await sqlPro.db.applyChanges({
          connectionId,
          changes,
        });

        if (!response.success) {
          throw new Error(response.error || 'Failed to delete rows');
        }
      },
    })
  );
}

// ============ Pending Changes Collection (Local-Only) ============

export interface PendingChange {
  id: string;
  table: string;
  schema?: string; // Database schema (defaults to 'main' for SQLite)
  rowId: string | number;
  type: 'insert' | 'update' | 'delete';
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  timestamp: Date;
  isValid: boolean;
  validationError?: string;
  primaryKeyColumn?: string;
}

/**
 * Local-only collection for tracking pending changes before they are applied.
 * This replaces the Zustand changes store with TanStack DB reactive updates.
 */
export const pendingChangesCollection = createCollection<PendingChange, string>(
  localOnlyCollectionOptions({
    id: 'pending-changes',
    getKey: (change) => change.id,

    onInsert: async ({ transaction }) => {
      // Local-only - just accept the mutation
      pendingChangesCollection.utils.acceptMutations(transaction);
    },

    onUpdate: async ({ transaction }) => {
      pendingChangesCollection.utils.acceptMutations(transaction);
    },

    onDelete: async ({ transaction }) => {
      pendingChangesCollection.utils.acceptMutations(transaction);
    },
  })
);

// ============ Helper Functions ============

let changeIdCounter = 0;

export function generateChangeId(): string {
  changeIdCounter += 1;
  return `change_${changeIdCounter}_${Date.now()}`;
}

/**
 * Get all pending changes as an array.
 */
export function getAllPendingChanges(): PendingChange[] {
  return pendingChangesCollection.toArray;
}

/**
 * Add a pending change with intelligent merging.
 * If a change for the same row already exists, it will be merged.
 */
export function addPendingChange(
  change: Omit<PendingChange, 'id' | 'timestamp' | 'isValid'> & {
    primaryKeyColumn?: string;
  }
): void {
  // Find existing change for this row (must match both table and schema)
  const allChanges = getAllPendingChanges();
  const existing = allChanges.find(
    (c: PendingChange) =>
      c.table === change.table &&
      c.schema === change.schema &&
      c.rowId === change.rowId
  );

  if (existing) {
    // Merge with existing change
    if (change.type === 'delete') {
      if (existing.type === 'insert') {
        // Deleting an inserted row - just remove the insert
        pendingChangesCollection.delete(existing.id);
        return;
      }
      // Convert to delete
      pendingChangesCollection.update(existing.id, (draft) => {
        draft.type = 'delete';
        draft.newValues = null;
        draft.timestamp = new Date();
      });
    } else if (change.type === 'update') {
      // Merge updates
      pendingChangesCollection.update(existing.id, (draft) => {
        draft.newValues = { ...draft.newValues, ...change.newValues };
        draft.timestamp = new Date();
      });
    } else if (change.type === 'insert' && existing.type === 'insert') {
      // Update existing insert
      pendingChangesCollection.update(existing.id, (draft) => {
        draft.newValues = { ...draft.newValues, ...change.newValues };
        draft.timestamp = new Date();
      });
    }
  } else {
    // Add new change
    pendingChangesCollection.insert({
      ...change,
      id: generateChangeId(),
      timestamp: new Date(),
      isValid: true,
    });
  }
}

/**
 * Clear all pending changes for a specific table/schema or all tables.
 */
export function clearPendingChanges(table?: string, schema?: string): void {
  const changes = getAllPendingChanges();
  const toDelete = table
    ? changes.filter(
        (c: PendingChange) => c.table === table && c.schema === schema
      )
    : changes;

  toDelete.forEach((c: PendingChange) => pendingChangesCollection.delete(c.id));
}

/**
 * Get pending changes for a specific table and schema.
 */
export function getPendingChangesForTable(
  table: string,
  schema?: string
): PendingChange[] {
  return getAllPendingChanges().filter(
    (c: PendingChange) => c.table === table && c.schema === schema
  );
}

/**
 * Get pending change for a specific row.
 */
export function getPendingChangeForRow(
  table: string,
  rowId: string | number,
  schema?: string
): PendingChange | undefined {
  return getAllPendingChanges().find(
    (c: PendingChange) =>
      c.table === table && c.schema === schema && c.rowId === rowId
  );
}

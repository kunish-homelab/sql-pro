import type { ColumnInfo } from '../../../shared/types';
import type {
  PendingChange,
  TableDataQueryParams,
  TableRow,
} from '@/lib/collections';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { sqlPro } from '@/lib/api';
import {
  addPendingChange,
  clearPendingChanges,
  getAllPendingChanges,
  pendingChangesCollection,
} from '@/lib/collections';

export interface UseTableDataOptions {
  connectionId: string | null;
  schema?: string; // Database schema (defaults to 'main' for SQLite)
  table: string | null;
  page?: number;
  pageSize?: number;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  filters?: TableDataQueryParams['filters'];
  enabled?: boolean;
  primaryKeyColumn?: string;
}

export interface UseTableDataResult {
  // Data
  rows: TableRow[];
  columns: ColumnInfo[];
  totalRows: number;
  totalPages: number;

  // Loading states
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;

  // Mutations (optimistic)
  updateRow: (rowId: string | number, updates: Record<string, unknown>) => void;
  insertRow: (values: Record<string, unknown>) => string | number;
  deleteRow: (rowId: string | number) => void;

  // Change management
  hasChanges: boolean;
  pendingChanges: PendingChange[];
  clearChanges: () => void;

  // Refetch
  refetch: () => void;
}

/**
 * Hook for fetching and managing table data with TanStack Query.
 * Provides optimistic updates via local pending changes collection.
 */
export function useTableData(options: UseTableDataOptions): UseTableDataResult {
  const {
    connectionId,
    schema = 'main', // Default to 'main' for SQLite
    table,
    page = 1,
    pageSize = 100,
    sortColumn,
    sortDirection,
    filters,
    enabled = true,
    primaryKeyColumn,
  } = options;

  // Track pending changes with local state for reactivity
  const [pendingChangesVersion, setPendingChangesVersion] = useState(0);

  // Subscribe to pending changes collection updates
  useEffect(() => {
    const subscription = pendingChangesCollection.subscribeChanges(() => {
      setPendingChangesVersion((v) => v + 1);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Fetch table data using TanStack Query
  const dataQuery = useQuery({
    queryKey: [
      'tableData',
      connectionId,
      schema,
      table,
      page,
      pageSize,
      sortColumn,
      sortDirection,
      filters,
    ],
    queryFn: async () => {
      if (!connectionId || !table) {
        throw new Error('Connection ID and table are required');
      }

      const response = await sqlPro.db.getTableData({
        connectionId,
        schema,
        table,
        page,
        pageSize,
        sortColumn,
        sortDirection,
        filters,
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch table data');
      }

      // Transform rows to include __rowId for identification
      const columns = response.columns || [];
      const pkColumn = columns.find((c) => c.isPrimaryKey)?.name;
      const rows = (response.rows || []).map((row, index) => {
        const rowId = pkColumn
          ? row[pkColumn]
          : (row.rowid ?? `__index_${index}`);

        return {
          ...row,
          __rowId: rowId as string | number,
        } as TableRow;
      });

      return {
        columns,
        rows,
        totalRows: response.totalRows || 0,
      };
    },
    enabled: Boolean(connectionId && table && enabled),
  });

  // Get pending changes for this table (reactive via pendingChangesVersion)
  const pendingChanges = useMemo(() => {
    // Use void to mark intentional dependency read for reactivity
    void pendingChangesVersion;
    if (!table) return [];
    return getAllPendingChanges().filter(
      (c) => c.table === table && c.schema === schema
    );
  }, [table, schema, pendingChangesVersion]);

  // Merge fetched data with pending changes for display
  const displayRows = useMemo(() => {
    const baseRows = dataQuery.data?.rows || [];
    if (!table || pendingChanges.length === 0) {
      return baseRows;
    }

    // Apply pending changes to display
    const rowMap = new Map(baseRows.map((r) => [r.__rowId, { ...r }]));

    for (const change of pendingChanges) {
      if (change.type === 'insert' && change.newValues) {
        // Add inserted rows
        const newRow: TableRow = {
          ...change.newValues,
          __rowId: change.rowId,
          __isNew: true,
        };
        rowMap.set(change.rowId, newRow);
      } else if (change.type === 'update' && change.newValues) {
        const existing = rowMap.get(change.rowId);
        if (existing) {
          rowMap.set(change.rowId, {
            ...existing,
            ...change.newValues,
            __isModified: true,
          });
        }
      } else if (change.type === 'delete') {
        const existing = rowMap.get(change.rowId);
        if (existing) {
          rowMap.set(change.rowId, {
            ...existing,
            __isDeleted: true,
          });
        }
      }
    }

    // Sort: new rows first, then existing rows
    const result = Array.from(rowMap.values());
    result.sort((a, b) => {
      if (a.__isNew && !b.__isNew) return -1;
      if (!a.__isNew && b.__isNew) return 1;
      return 0;
    });

    return result;
  }, [dataQuery.data?.rows, pendingChanges, table]);

  // Mutation handlers
  const updateRow = useCallback(
    (rowId: string | number, updates: Record<string, unknown>) => {
      if (!table) return;

      const baseRows = dataQuery.data?.rows || [];
      const existingRow = baseRows.find((r) => r.__rowId === rowId);
      addPendingChange({
        table,
        schema,
        rowId,
        type: 'update',
        oldValues: existingRow ? { ...existingRow } : null,
        newValues: updates,
        primaryKeyColumn,
      });
    },
    [table, schema, dataQuery.data?.rows, primaryKeyColumn]
  );

  const insertRow = useCallback(
    (values: Record<string, unknown>): string | number => {
      if (!table) return -1;

      // Generate a temporary ID for new rows
      const tempId = -Date.now();
      addPendingChange({
        table,
        schema,
        rowId: tempId,
        type: 'insert',
        oldValues: null,
        newValues: values,
      });
      return tempId;
    },
    [table, schema]
  );

  const deleteRow = useCallback(
    (rowId: string | number) => {
      if (!table) return;

      const baseRows = dataQuery.data?.rows || [];
      const existingRow = baseRows.find((r) => r.__rowId === rowId);
      addPendingChange({
        table,
        schema,
        rowId,
        type: 'delete',
        oldValues: existingRow ? { ...existingRow } : null,
        newValues: null,
        primaryKeyColumn,
      });
    },
    [table, schema, dataQuery.data?.rows, primaryKeyColumn]
  );

  const clearChanges = useCallback(() => {
    if (table) {
      clearPendingChanges(table, schema);
    }
  }, [table, schema]);

  const refetch = useCallback(() => {
    dataQuery.refetch();
  }, [dataQuery]);

  return {
    rows: displayRows,
    columns: dataQuery.data?.columns || [],
    totalRows: dataQuery.data?.totalRows || 0,
    totalPages: Math.ceil((dataQuery.data?.totalRows || 0) / pageSize),
    isLoading: dataQuery.isLoading,
    isFetching: dataQuery.isFetching,
    error: dataQuery.error,
    updateRow,
    insertRow,
    deleteRow,
    hasChanges: pendingChanges.length > 0,
    pendingChanges,
    clearChanges,
    refetch,
  };
}

import { useCallback, useEffect, useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  Eye,
  FileText,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataTable, TableRowData } from './data-table';
import { DiffPreview } from './DiffPreview';
import {
  useConnectionStore,
  useTableDataStore,
  useChangesStore,
} from '@/stores';
import type { PendingChange, SortState } from '@/types/database';

export function TableView() {
  const { connection, selectedTable } = useConnectionStore();
  const {
    tableName,
    columns,
    rows,
    pagination,
    sort,
    filters,
    isLoading,
    error,
    setTableData,
    setPagination,
    setSort,
    setIsLoading,
    setError,
  } = useTableDataStore();
  const { changes, hasChanges, getChangesForTable, getChangeForRow, addChange } = useChangesStore();

  const [showDiffPreview, setShowDiffPreview] = useState(false);
  const [grouping, setGrouping] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    if (!connection || !selectedTable) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await window.sqlPro.db.getTableData({
        connectionId: connection.id,
        table: selectedTable.name,
        page: pagination.page,
        pageSize: pagination.pageSize,
        sortColumn: sort?.column,
        sortDirection: sort?.direction,
        filters: filters.map((f) => ({
          column: f.column,
          operator: f.operator,
          value: f.value,
        })),
      });

      if (result.success) {
        setTableData(
          selectedTable.name,
          result.columns || [],
          result.rows || [],
          result.totalRows || 0
        );
      } else {
        setError(result.error || 'Failed to load data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [
    connection,
    selectedTable,
    pagination.page,
    pagination.pageSize,
    sort,
    filters,
    setTableData,
    setIsLoading,
    setError,
  ]);

  // Reload data when sort changes
  useEffect(() => {
    if (tableName === selectedTable?.name && sort) {
      loadData();
    }
  }, [loadData, selectedTable?.name, sort, tableName]);

  const handlePageChange = (page: number) => {
    setPagination({ page });
    loadData();
  };

  // Handle sort change from DataTable
  const handleSortChange = useCallback((newSort: SortState | null) => {
    setSort(newSort);
  }, [setSort]);

  // Find primary key column
  const primaryKeyColumn = selectedTable?.primaryKey[0];

  // Get the row ID for a given row
  const getRowId = useCallback(
    (row: Record<string, unknown>, index: number): string | number => {
      if (primaryKeyColumn && row[primaryKeyColumn] !== undefined) {
        return row[primaryKeyColumn] as string | number;
      }
      if (row.rowid !== undefined) {
        return row.rowid as number;
      }
      return index;
    },
    [primaryKeyColumn]
  );

  // Merge original rows with pending changes, including new inserts
  const displayRows = useMemo((): TableRowData[] => {
    if (!selectedTable) return [];

    // Get pending inserts for this table (prepend to existing rows)
    const insertedRows = changes
      .filter((c) => c.table === selectedTable.name && c.type === 'insert')
      .map((c) => ({
        ...c.newValues,
        __rowId: c.rowId,
        __isNew: true,
        __change: c,
      })) as TableRowData[];

    // Map existing rows with updates/deletes
    const existingRows = rows.map((row, index) => {
      const rowId = getRowId(row, index);
      const change = getChangeForRow(selectedTable.name, rowId);

      if (change?.type === 'delete') {
        return { ...row, __deleted: true, __rowId: rowId } as TableRowData;
      }

      if (change?.type === 'update' && change.newValues) {
        return {
          ...row,
          ...change.newValues,
          __rowId: rowId,
          __change: change,
        } as TableRowData;
      }

      return { ...row, __rowId: rowId } as TableRowData;
    });

    // Inserts appear at the top
    return [...insertedRows, ...existingRows];
  }, [rows, changes, selectedTable, getRowId, getChangeForRow]);

  // Build changes map for DataTable
  const changesMap = useMemo(() => {
    if (!selectedTable) return new Map<string | number, PendingChange>();

    const map = new Map<string | number, PendingChange>();
    changes
      .filter((c) => c.table === selectedTable.name)
      .forEach((c) => map.set(c.rowId, c));
    return map;
  }, [changes, selectedTable]);

  // Handle cell change from DataTable
  const handleCellChange = useCallback(
    (rowId: string | number, columnId: string, newValue: unknown, oldValue: unknown) => {
      if (!selectedTable) return;

      // Check if this is a new row (inserted row)
      const isNewRow = typeof rowId === 'number' && rowId < 0;

      if (isNewRow) {
        // For new rows, update the existing insert change
        const existingChange = getChangeForRow(selectedTable.name, rowId);
        if (existingChange) {
          addChange({
            table: selectedTable.name,
            rowId,
            type: 'insert',
            oldValues: null,
            newValues: { ...existingChange.newValues, [columnId]: newValue },
          });
        }
      } else {
        // Find the original row in the rows array
        let originalRow: Record<string, unknown> | undefined;
        for (let i = 0; i < rows.length; i++) {
          const rid = getRowId(rows[i], i);
          if (rid === rowId) {
            originalRow = rows[i];
            break;
          }
        }

        if (originalRow && newValue !== oldValue) {
          addChange({
            table: selectedTable.name,
            rowId,
            type: 'update',
            oldValues: originalRow,
            newValues: { [columnId]: newValue },
          });
        }
      }
    },
    [selectedTable, getChangeForRow, addChange, changes, rows, getRowId]
  );

  // Handle row delete from DataTable
  const handleRowDelete = useCallback(
    (rowId: string | number) => {
      if (!selectedTable) return;

      const isNewRow = typeof rowId === 'number' && rowId < 0;

      if (isNewRow) {
        // For new rows, removing the insert
        addChange({
          table: selectedTable.name,
          rowId,
          type: 'delete',
          oldValues: null,
          newValues: null,
        });
      } else {
        // Find the original row
        let originalRow: Record<string, unknown> | undefined;
        for (let i = 0; i < rows.length; i++) {
          const rid = getRowId(rows[i], i);
          if (rid === rowId) {
            originalRow = rows[i];
            break;
          }
        }

        addChange({
          table: selectedTable.name,
          rowId,
          type: 'delete',
          oldValues: originalRow ?? null,
          newValues: null,
        });
      }
    },
    [selectedTable, addChange, rows, getRowId]
  );

  // Count changes for current table
  const tableChanges = selectedTable
    ? getChangesForTable(selectedTable.name)
    : [];

  // Handle adding a new row
  const handleAddRow = () => {
    if (!selectedTable || selectedTable.type === 'view') return;

    // Generate temporary negative ID for new row
    const tempId = -Date.now();

    // Initialize row with NULL values for each column
    const newRow: Record<string, unknown> = {};
    columns.forEach((col) => {
      newRow[col.name] = col.defaultValue ?? null;
    });

    addChange({
      table: selectedTable.name,
      rowId: tempId,
      type: 'insert',
      oldValues: null,
      newValues: newRow,
    });
  };

  if (!selectedTable) return null;

  return (
    <div className="flex h-full min-h-0 min-w-0">
      {/* Main Content */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Table Header */}
        <div className="flex items-center justify-between border-b px-4 py-2">
          <div className="flex items-center gap-2">
            <h2 className="font-medium">{selectedTable.name}</h2>
            <span className="text-sm text-muted-foreground">
              ({pagination.totalRows.toLocaleString()} rows)
            </span>
            {selectedTable.type === 'view' && (
              <span className="flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">
                <Eye className="h-3 w-3" />
                View
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Add Row button */}
            {selectedTable.type !== 'view' && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddRow}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Row
              </Button>
            )}

            {/* Changes indicator & preview button */}
            {tableChanges.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDiffPreview(true)}
                className="gap-2"
              >
                <FileText className="h-4 w-4" />
                {tableChanges.length} pending{' '}
                {tableChanges.length === 1 ? 'change' : 'changes'}
              </Button>
            )}
          </div>
        </div>

        {/* Data Grid */}
        <div className="min-h-0 min-w-0 flex-1">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex h-full items-center justify-center text-destructive">
              <p>{error}</p>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={displayRows}
              sort={sort}
              onSortChange={handleSortChange}
              grouping={grouping}
              onGroupingChange={setGrouping}
              editable={selectedTable.type !== 'view'}
              onCellChange={handleCellChange}
              onRowDelete={handleRowDelete}
              changes={changesMap}
              primaryKeyColumn={primaryKeyColumn}
              className="h-full"
            />
          )}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t px-4 py-2">
          <div className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages || 1}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => handlePageChange(1)}
              disabled={pagination.page <= 1 || isLoading}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1 || isLoading}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || isLoading}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => handlePageChange(pagination.totalPages)}
              disabled={pagination.page >= pagination.totalPages || isLoading}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Diff Preview Panel */}
      {showDiffPreview && hasChanges() && (
        <div className="w-96">
          <DiffPreview onClose={() => setShowDiffPreview(false)} />
        </div>
      )}
    </div>
  );
}

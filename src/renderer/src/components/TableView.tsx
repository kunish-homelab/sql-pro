import { useCallback, useEffect, useState } from 'react';
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
import { EditableDataGrid } from './EditableDataGrid';
import { DiffPreview } from './DiffPreview';
import {
  useConnectionStore,
  useTableDataStore,
  useChangesStore,
} from '@/stores';

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
  const { hasChanges, getChangesForTable, addChange } = useChangesStore();

  const [showDiffPreview, setShowDiffPreview] = useState(false);

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

  const handleSort = (column: string) => {
    if (sort?.column === column) {
      setSort({
        column,
        direction: sort.direction === 'asc' ? 'desc' : 'asc',
      });
    } else {
      setSort({ column, direction: 'asc' });
    }
  };

  // Find primary key column
  const primaryKeyColumn = selectedTable?.primaryKey[0];

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
            <EditableDataGrid
              tableName={selectedTable.name}
              columns={columns}
              rows={rows}
              sort={sort}
              onSort={handleSort}
              primaryKeyColumn={primaryKeyColumn}
              readOnly={selectedTable.type === 'view'}
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

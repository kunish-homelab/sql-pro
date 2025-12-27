import type { DataTableRef, TableRowData } from './data-table';
import type { PendingChange, SortState } from '@/types/database';
import type { UIFilterState } from '@/lib/filter-utils';
import { convertUIFiltersToAPIFilters } from '@/lib/filter-utils';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  FileText,
  Loader2,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useClientSearch } from '@/hooks/useClientSearch';
import { usePendingChanges } from '@/hooks/usePendingChanges';
import { useTableData } from '@/hooks/useTableData';
import { useConnectionStore } from '@/stores';
import { ActiveFilters } from './data-table/ActiveFilters';
import { DataTable } from './data-table';
import { DiffPreview } from './DiffPreview';

export function TableView() {
  const { connection, selectedTable } = useConnectionStore();
  const dataTableRef = useRef<DataTableRef>(null);

  // Pagination state (local since TanStack Query handles the data)
  const [page, setPage] = useState(1);
  const [pageSize] = useState(100);
  const [sort, setSort] = useState<SortState | null>(null);
  const [grouping, setGrouping] = useState<string[]>([]);
  const [showDiffPreview, setShowDiffPreview] = useState(false);
  const [filters, setFilters] = useState<UIFilterState[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Track the newly inserted row ID for auto-focus
  const [newRowId, setNewRowId] = useState<string | number | null>(null);

  // Find primary key column
  const primaryKeyColumn = selectedTable?.primaryKey[0];

  // Convert UI filters to API filters
  const apiFilters = useMemo(() => {
    return convertUIFiltersToAPIFilters(filters);
  }, [filters]);

  // Use TanStack DB hooks for data and changes
  const {
    rows,
    columns,
    totalRows,
    totalPages,
    isLoading,
    error,
    updateRow,
    insertRow,
    deleteRow,
    refetch,
  } = useTableData({
    connectionId: connection?.id || null,
    schema: selectedTable?.schema,
    table: selectedTable?.name || null,
    page,
    pageSize,
    sortColumn: sort?.column,
    sortDirection: sort?.direction,
    filters: apiFilters,
    enabled: Boolean(connection && selectedTable),
    primaryKeyColumn,
  });

  const {
    changes: pendingChanges,
    hasChanges,
    changeCount,
  } = usePendingChanges({
    connectionId: connection?.id || null,
    schema: selectedTable?.schema,
    table: selectedTable?.name,
  });

  // Transform rows for DataTable display
  const displayRows = useMemo((): TableRowData[] => {
    return rows.map((row) => {
      const rowId = row.__rowId;
      const isNew = '__isNew' in row && row.__isNew;
      const isDeleted = '__isDeleted' in row && row.__isDeleted;

      // Find the corresponding pending change
      const change = pendingChanges.find((c) => c.rowId === rowId);

      return {
        ...row,
        __rowId: rowId,
        __isNew: isNew,
        __deleted: isDeleted,
        __change: change as PendingChange | undefined,
      } as TableRowData;
    });
  }, [rows, pendingChanges]);

  // Client-side search on displayed rows
  const { filteredRows: searchFilteredRows, stats: searchStats } = useClientSearch({
    rows: displayRows,
    columns,
    searchTerm,
  });

  // Build changes map for DataTable
  const changesMap = useMemo(() => {
    const map = new Map<string | number, PendingChange>();
    pendingChanges.forEach((c) => map.set(c.rowId, c as PendingChange));
    return map;
  }, [pendingChanges]);

  // Handle page change
  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  // Handle sort change from DataTable
  const handleSortChange = useCallback((newSort: SortState | null) => {
    setSort(newSort);
    setPage(1); // Reset to first page on sort change
  }, []);

  // Handle filter add/update from ColumnFilterPopover
  const handleFilterAdd = useCallback((filter: UIFilterState) => {
    setFilters((prevFilters) => {
      // Check if a filter already exists for this column
      const existingIndex = prevFilters.findIndex((f) => f.column === filter.column);
      if (existingIndex >= 0) {
        // Update existing filter
        const newFilters = [...prevFilters];
        newFilters[existingIndex] = filter;
        return newFilters;
      }
      // Add new filter
      return [...prevFilters, filter];
    });
    setPage(1); // Reset to first page on filter change
  }, []);

  // Handle filter removal by column id
  const handleFilterRemove = useCallback((columnId: string) => {
    setFilters((prevFilters) => prevFilters.filter((f) => f.column !== columnId));
    setPage(1); // Reset to first page on filter change
  }, []);

  // Handle clearing all filters
  const handleFiltersClear = useCallback(() => {
    setFilters([]);
    setPage(1); // Reset to first page on filter change
  }, []);

  // Handle cell change from DataTable
  const handleCellChange = useCallback(
    (
      rowId: string | number,
      columnId: string,
      newValue: unknown,
      _oldValue: unknown
    ) => {
      updateRow(rowId, { [columnId]: newValue });
    },
    [updateRow]
  );

  // Handle row delete from DataTable
  const handleRowDelete = useCallback(
    (rowId: string | number) => {
      deleteRow(rowId);
    },
    [deleteRow]
  );

  // Handle adding a new row
  const handleAddRow = useCallback(() => {
    if (!selectedTable || selectedTable.type === 'view') return;

    // Initialize row with smart default values
    const newRow: Record<string, unknown> = {};
    columns.forEach((col) => {
      // Skip auto-increment columns (they'll be generated by the database)
      const type = col.type.toLowerCase();
      const isAutoIncrement =
        col.isPrimaryKey &&
        (type.includes('int') ||
          type === 'integer' ||
          col.defaultValue
            ?.toString()
            .toLowerCase()
            .includes('autoincrement') ||
          col.defaultValue?.toString().toLowerCase().includes('nextval'));

      if (isAutoIncrement) {
        // Leave auto-increment columns as null - database will handle it
        newRow[col.name] = null;
      } else if (col.defaultValue !== undefined && col.defaultValue !== null) {
        newRow[col.name] = col.defaultValue;
      } else {
        newRow[col.name] = null;
      }
    });

    const rowId = insertRow(newRow);
    setNewRowId(rowId);
  }, [selectedTable, columns, insertRow]);

  // Callback when DataTable has focused the new row
  const handleNewRowFocused = useCallback(() => {
    setNewRowId(null);
  }, []);

  // Handle successful change application
  const handleChangesApplied = useCallback(() => {
    setShowDiffPreview(false);
    refetch();
  }, [refetch]);

  if (!selectedTable) return null;

  return (
    <div className="flex h-full min-h-0 min-w-0">
      {/* Main Content */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Table Header */}
        <div className="flex items-center justify-between border-b px-4 py-2">
          <div className="flex items-center gap-2">
            <h2 className="font-medium">{selectedTable.name}</h2>
            <span className="text-muted-foreground text-sm">
              {searchStats.isSearching ? (
                <>
                  ({searchStats.matchedRows.toLocaleString()} of{' '}
                  {searchStats.totalRows.toLocaleString()} rows)
                </>
              ) : (
                <>({totalRows.toLocaleString()} rows)</>
              )}
            </span>
            {searchStats.isSearching && (
              <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-xs font-medium">
                Filtered
              </span>
            )}
            {selectedTable.type === 'view' && (
              <span className="bg-secondary text-muted-foreground flex items-center gap-1 rounded px-1.5 py-0.5 text-xs">
                <Eye className="h-3 w-3" />
                View
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="text-muted-foreground absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2" />
              <Input
                type="text"
                placeholder="Search in results..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 w-56 pl-8 pr-8 text-sm"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="text-muted-foreground hover:text-foreground absolute right-2 top-1/2 -translate-y-1/2"
                  title="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

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
            {changeCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDiffPreview(true)}
                className="gap-2"
              >
                <FileText className="h-4 w-4" />
                {changeCount} pending {changeCount === 1 ? 'change' : 'changes'}
              </Button>
            )}
          </div>
        </div>

        {/* Active Filters Display */}
        <ActiveFilters
          filters={filters}
          onFilterRemove={handleFilterRemove}
          onFiltersClear={handleFiltersClear}
        />

        {/* Data Grid */}
        <div className="min-h-0 min-w-0 flex-1">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
            </div>
          ) : error ? (
            <div className="text-destructive flex h-full items-center justify-center">
              <p>{error.message}</p>
            </div>
          ) : (
            <DataTable
              ref={dataTableRef}
              columns={columns}
              data={searchFilteredRows}
              sort={sort}
              onSortChange={handleSortChange}
              grouping={grouping}
              onGroupingChange={setGrouping}
              editable={selectedTable.type !== 'view'}
              onCellChange={handleCellChange}
              onRowDelete={handleRowDelete}
              onRowInsert={handleAddRow}
              changes={changesMap}
              primaryKeyColumn={primaryKeyColumn}
              className="h-full"
              newRowId={newRowId}
              onNewRowFocused={handleNewRowFocused}
              filters={filters}
              onFilterAdd={handleFilterAdd}
              onFilterRemove={handleFilterRemove}
            />
          )}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t px-4 py-2">
          <div className="text-muted-foreground text-sm">
            Page {page} of {totalPages || 1}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => handlePageChange(1)}
              disabled={page <= 1 || isLoading}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1 || isLoading}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages || isLoading}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => handlePageChange(totalPages)}
              disabled={page >= totalPages || isLoading}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Diff Preview Panel */}
      {showDiffPreview && hasChanges && (
        <div className="w-96">
          <DiffPreview
            onClose={() => setShowDiffPreview(false)}
            onApplied={handleChangesApplied}
          />
        </div>
      )}
    </div>
  );
}

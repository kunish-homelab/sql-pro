import type { DataTableRef, TableRowData } from './data-table';
import type { ExportOptions } from './ExportDialog';
import type { UIFilterState } from '@/lib/filter-utils';
import type { PageSizeOption } from '@/stores';
import type { PendingChange, SortState, TableSchema } from '@/types/database';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useClientSearch } from '@/hooks/useClientSearch';
import { useExport } from '@/hooks/useExport';
import { usePendingChanges } from '@/hooks/usePendingChanges';
import { useTableData } from '@/hooks/useTableData';
import { convertUIFiltersToAPIFilters } from '@/lib/filter-utils';
import {
  PAGE_SIZE_OPTIONS,
  useConnectionStore,
  usePageSize,
  useSettingsStore,
} from '@/stores';
import { DataTable } from './data-table';
import { ActiveFilters } from './data-table/ActiveFilters';
import { DiffPreview } from './DiffPreview';
import { ExportDialog } from './ExportDialog';

interface TableViewProps {
  /** Optional table override - when provided, uses this table instead of selectedTable from store */
  tableOverride?: TableSchema;
}

export function TableView({ tableOverride }: TableViewProps) {
  const { connection, selectedTable: storeSelectedTable } =
    useConnectionStore();

  // Use tableOverride if provided, otherwise fall back to store's selectedTable
  const selectedTable = tableOverride || storeSelectedTable;
  const dataTableRef = useRef<DataTableRef>(null);

  // Global page size setting
  const pageSizeOption = usePageSize();
  const setPageSize = useSettingsStore((s) => s.setPageSize);

  // Calculate actual page size - use a very large number for 'all'
  const pageSize = pageSizeOption === 'all' ? 1000000 : pageSizeOption;

  // Pagination state (local since TanStack Query handles the data)
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState | null>(null);
  const [grouping, setGrouping] = useState<string[]>([]);
  const [showDiffPreview, setShowDiffPreview] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
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

  // Export functionality
  const { exportData } = useExport();

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
  const { filteredRows: searchFilteredRows, stats: searchStats } =
    useClientSearch({
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

  // Handle page size change (global setting)
  const handlePageSizeChange = useCallback(
    (value: string) => {
      const newSize = value === 'all' ? 'all' : Number.parseInt(value, 10);
      setPageSize(newSize as PageSizeOption);
      setPage(1); // Reset to first page when changing page size
    },
    [setPageSize]
  );

  // Handle sort change from DataTable
  const handleSortChange = useCallback((newSort: SortState | null) => {
    setSort(newSort);
    setPage(1); // Reset to first page on sort change
  }, []);

  // Handle filter add/update from ColumnFilterPopover
  const handleFilterAdd = useCallback((filter: UIFilterState) => {
    setFilters((prevFilters) => {
      // Check if a filter already exists for this column
      const existingIndex = prevFilters.findIndex(
        (f) => f.column === filter.column
      );
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
    setFilters((prevFilters) =>
      prevFilters.filter((f) => f.column !== columnId)
    );
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

  // Handle export
  const handleExport = useCallback(
    async (options: ExportOptions) => {
      await exportData({
        format: options.format,
        tableName: options.tableName,
        connectionId: options.connectionId,
        rows: options.rows,
        columns: options.columns,
        delimiter: options.delimiter,
        includeHeaders: options.includeHeaders,
        prettyPrint: options.prettyPrint,
        sheetName: options.sheetName,
      });
    },
    [exportData]
  );

  if (!selectedTable) return null;

  return (
    <div className="flex h-full min-h-0 min-w-0 overflow-hidden">
      {/* Main Content */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
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
              <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
              <Input
                type="text"
                placeholder="Search in results..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 w-56 pr-8 pl-8 text-sm"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
                  title="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Export button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowExportDialog(true)}
              className="gap-2"
              disabled={rows.length === 0}
            >
              <Download className="h-4 w-4" />
              Export
            </Button>

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
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
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
              // Empty state context
              totalRowsBeforeClientSearch={displayRows.length}
              hasActiveFilters={filters.length > 0}
              hasActiveSearch={searchTerm.length > 0}
              onClearFilters={handleFiltersClear}
              onClearSearch={() => setSearchTerm('')}
            />
          )}
        </div>

        {/* Pagination */}
        <div className="bg-background flex shrink-0 items-center justify-between border-t px-4 py-2">
          <div className="flex items-center gap-4">
            <div className="text-muted-foreground text-sm">
              {pageSizeOption === 'all' ? (
                <>Showing all {totalRows.toLocaleString()} rows</>
              ) : (
                <>
                  Page {page} of {totalPages || 1}
                  <span className="text-muted-foreground/70 ml-1">
                    ({totalRows.toLocaleString()} total)
                  </span>
                </>
              )}
            </div>

            {/* Page Size Selector */}
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">Rows:</span>
              <Select
                value={String(pageSizeOption)}
                onValueChange={handlePageSizeChange}
              >
                <SelectTrigger size="sm" className="h-7 w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="center">
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size === 'all' ? 'All' : size.toLocaleString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {pageSizeOption === 'all' && totalRows > 10000 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <AlertTriangle className="text-warning h-4 w-4 text-amber-500" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Loading all rows may be slow for large tables</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>

          {/* Pagination Controls - hidden when showing all */}
          {pageSizeOption !== 'all' && (
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
          )}
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

      {/* Export Dialog */}
      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        tableName={selectedTable.name}
        columns={columns}
        rows={searchFilteredRows.map((row) => {
          // Strip internal properties before export
          const { __rowId, __isNew, __deleted, __change, ...data } = row;
          return data;
        })}
        connectionId={connection?.id || ''}
        onExport={handleExport}
      />
    </div>
  );
}

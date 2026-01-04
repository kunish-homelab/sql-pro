import type { BulkEditField } from './BulkEditDialog';
import type { DataTableRef, TableRowData } from './data-table';
import type { ExportOptions } from './ExportDialog';
import type { UIFilterState } from '@/lib/filter-utils';
import type { PageSizeOption } from '@/stores';
import type { PendingChange, SortState, TableSchema } from '@/types/database';
import { Button } from '@sqlpro/ui/button';
import { Input } from '@sqlpro/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sqlpro/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@sqlpro/ui/tooltip';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Edit3,
  Eye,
  FileText,
  Info,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ShortcutKbd } from '@/components/ui/kbd';
import { useClientSearch } from '@/hooks/useClientSearch';
import { useExport } from '@/hooks/useExport';
import { usePendingChanges } from '@/hooks/usePendingChanges';
import { useTableData } from '@/hooks/useTableData';
import { convertUIFiltersToAPIFilters } from '@/lib/filter-utils';
import {
  PAGE_SIZE_OPTIONS,
  useConnectionStore,
  useDataTabsStore,
  usePageSize,
  useSettingsStore,
} from '@/stores';
import { BulkEditDialog } from './BulkEditDialog';
import {
  AnimatedLoader,
  ColumnStats,
  DataQualityIndicator,
  DataTable,
  KeyboardShortcutsOverlay,
  QuickFilterTags,
  SkeletonTable,
} from './data-table';
import { ActiveFilters } from './data-table/ActiveFilters';
import { DiffPreview } from './DiffPreview';
import { ExportDialog } from './ExportDialog';

interface TableViewProps {
  /** Optional table override - when provided, uses this table instead of selectedTable from store */
  tableOverride?: TableSchema;
  /** Whether the schema details panel is open */
  showDetailsPanel?: boolean;
  /** Callback to toggle the schema details panel */
  onDetailsToggle?: (open: boolean) => void;
}

export function TableView({
  tableOverride,
  showDetailsPanel = false,
  onDetailsToggle,
}: TableViewProps) {
  const {
    connection,
    selectedTable: storeSelectedTable,
    activeConnectionId,
  } = useConnectionStore();
  const {
    getActiveTab,
    updateTabSearchTerm,
    updateTabPage,
    updateTabSort,
    updateTabGrouping,
    updateTabFilters,
  } = useDataTabsStore();

  // Use tableOverride if provided, otherwise fall back to store's selectedTable
  const selectedTable = tableOverride || storeSelectedTable;
  const dataTableRef = useRef<DataTableRef>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Get active tab for state (persisted per tab)
  const activeTab = activeConnectionId
    ? getActiveTab(activeConnectionId)
    : undefined;

  // Global page size setting
  const pageSizeOption = usePageSize();
  const setPageSize = useSettingsStore((s) => s.setPageSize);

  // Calculate actual page size - use a very large number for 'all'
  const pageSize = pageSizeOption === 'all' ? 1000000 : pageSizeOption;

  // Use state from store (persisted per tab)
  const page = activeTab?.page ?? 1;
  const sort = activeTab?.sort ?? null;
  const grouping = activeTab?.grouping ?? [];
  // Memoize filters to avoid creating new array reference on every render
  const filters = useMemo(() => activeTab?.filters ?? [], [activeTab?.filters]);

  // Local UI state (not persisted)
  const [showDiffPreview, setShowDiffPreview] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showBulkEditDialog, setShowBulkEditDialog] = useState(false);
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);

  // Setters that update the store
  const setPage = useCallback(
    (newPage: number) => {
      if (activeConnectionId && activeTab?.id) {
        updateTabPage(activeConnectionId, activeTab.id, newPage);
      }
    },
    [activeConnectionId, activeTab?.id, updateTabPage]
  );

  const setSort = useCallback(
    (newSort: SortState | null) => {
      if (activeConnectionId && activeTab?.id) {
        updateTabSort(activeConnectionId, activeTab.id, newSort);
      }
    },
    [activeConnectionId, activeTab?.id, updateTabSort]
  );

  const setGrouping = useCallback(
    (newGrouping: string[]) => {
      if (activeConnectionId && activeTab?.id) {
        updateTabGrouping(activeConnectionId, activeTab.id, newGrouping);
      }
    },
    [activeConnectionId, activeTab?.id, updateTabGrouping]
  );

  const setFilters = useCallback(
    (
      newFilters: UIFilterState[] | ((prev: UIFilterState[]) => UIFilterState[])
    ) => {
      if (activeConnectionId && activeTab?.id) {
        const resolvedFilters =
          typeof newFilters === 'function' ? newFilters(filters) : newFilters;
        updateTabFilters(activeConnectionId, activeTab.id, resolvedFilters);
      }
    },
    [activeConnectionId, activeTab?.id, filters, updateTabFilters]
  );

  // Use search term from store (persisted per tab)
  const searchTerm = activeTab?.searchTerm ?? '';
  const setSearchTerm = useCallback(
    (term: string) => {
      if (activeConnectionId && activeTab?.id) {
        updateTabSearchTerm(activeConnectionId, activeTab.id, term);
      }
    },
    [activeConnectionId, activeTab?.id, updateTabSearchTerm]
  );

  // Track the newly inserted row ID for auto-focus
  const [newRowId, setNewRowId] = useState<string | number | null>(null);

  // Keyboard shortcut to focus search (Cmd+F / Ctrl+F)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
  const handlePageChange = useCallback(
    (newPage: number) => {
      setPage(newPage);
    },
    [setPage]
  );

  // Handle page size change (global setting)
  const handlePageSizeChange = useCallback(
    (value: string | null) => {
      if (!value) return;
      const newSize = value === 'all' ? 'all' : Number.parseInt(value, 10);
      setPageSize(newSize as PageSizeOption);
      setPage(1); // Reset to first page when changing page size
    },
    [setPageSize, setPage]
  );

  // Handle sort change from DataTable
  const handleSortChange = useCallback(
    (newSort: SortState | null) => {
      setSort(newSort);
      setPage(1); // Reset to first page on sort change
    },
    [setSort, setPage]
  );

  // Handle filter add/update from ColumnFilterPopover
  const handleFilterAdd = useCallback(
    (filter: UIFilterState) => {
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
    },
    [setFilters, setPage]
  );

  // Handle filter removal by column id
  const handleFilterRemove = useCallback(
    (columnId: string) => {
      setFilters((prevFilters) =>
        prevFilters.filter((f) => f.column !== columnId)
      );
      setPage(1); // Reset to first page on filter change
    },
    [setFilters, setPage]
  );

  // Handle clearing all filters
  const handleFiltersClear = useCallback(() => {
    setFilters([]);
    setPage(1); // Reset to first page on filter change
  }, [setFilters, setPage]);

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

  // Handle bulk delete of selected rows
  const handleBulkDelete = useCallback(() => {
    if (selectedRowIds.length === 0) return;
    selectedRowIds.forEach((rowId) => {
      deleteRow(rowId);
    });
    setSelectedRowIds([]);
  }, [selectedRowIds, deleteRow]);

  // Handle bulk edit of selected rows
  const handleBulkEdit = useCallback(
    (fields: BulkEditField[]) => {
      if (selectedRowIds.length === 0 || fields.length === 0) return;

      // Apply the edits to each selected row
      selectedRowIds.forEach((rowId) => {
        const updates: Record<string, unknown> = {};
        fields.forEach((field) => {
          // Convert empty string to null for nullable columns
          const col = columns.find((c) => c.name === field.column);
          let value = field.value;
          if (col?.nullable && value === '') {
            value = null;
          }
          updates[field.column] = value;
        });
        updateRow(rowId, updates);
      });

      // Clear selection and close dialog
      setSelectedRowIds([]);
    },
    [selectedRowIds, columns, updateRow]
  );

  // Handle selection change
  const handleSelectionChange = useCallback((ids: string[]) => {
    setSelectedRowIds(ids);
  }, []);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedRowIds([]);
  }, []);

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
        {/* Selection Toolbar */}
        {selectedRowIds.length > 0 && (
          <div className="bg-primary/5 border-primary/20 flex items-center justify-between gap-4 border-b px-4 py-2">
            <div className="flex items-center gap-3">
              <span className="text-primary text-sm font-medium">
                {selectedRowIds.length} row
                {selectedRowIds.length > 1 ? 's' : ''} selected
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSelection}
                className="h-7 text-xs"
              >
                <X className="mr-1 h-3 w-3" />
                Clear selection
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBulkEditDialog(true)}
                className="h-7 gap-1"
              >
                <Edit3 className="h-3.5 w-3.5" />
                Edit{' '}
                {selectedRowIds.length > 1 ? `(${selectedRowIds.length})` : ''}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                className="h-7 gap-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete{' '}
                {selectedRowIds.length > 1 ? `(${selectedRowIds.length})` : ''}
              </Button>
            </div>
          </div>
        )}

        {/* Table Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate font-medium">{selectedTable.name}</h2>
            <span className="text-muted-foreground shrink-0 text-sm">
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
              <span className="bg-primary/10 text-primary shrink-0 rounded px-1.5 py-0.5 text-xs font-medium">
                Filtered
              </span>
            )}
            {selectedTable.type === 'view' && (
              <span className="bg-secondary text-muted-foreground flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs">
                <Eye className="h-3 w-3" />
                View
              </span>
            )}
            {/* Data Quality Indicator */}
            {rows.length > 0 && (
              <DataQualityIndicator columns={columns} data={rows} />
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
              <Input
                ref={searchInputRef}
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

            {/* Refresh button */}
            <Tooltip>
              <TooltipTrigger>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Refresh table data (
                <ShortcutKbd action="action.refresh-table" />)
              </TooltipContent>
            </Tooltip>

            {/* Export button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowExportDialog(true)}
              className="gap-2"
              disabled={rows.length === 0}
              data-action="export-data"
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
                data-action="add-row"
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

            {/* Schema Details Toggle */}
            <Tooltip>
              <TooltipTrigger>
                <Button
                  variant={showDetailsPanel ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => onDetailsToggle?.(!showDetailsPanel)}
                  className="gap-1.5"
                  data-action="toggle-schema-details"
                >
                  <Info className="h-4 w-4" />
                  <span className="hidden sm:inline">Schema</span>
                  <ShortcutKbd
                    action="view.toggle-schema-details"
                    className="hidden sm:inline-flex"
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {showDetailsPanel
                  ? 'Hide schema details'
                  : 'View schema details'}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Active Filters Display */}
        <ActiveFilters
          filters={filters}
          onFilterRemove={handleFilterRemove}
          onFiltersClear={handleFiltersClear}
        />

        {/* Quick Filter Tags - AI-powered suggestions */}
        {rows.length > 0 && (
          <QuickFilterTags
            columns={columns}
            data={rows}
            activeFilters={filters}
            onFilterAdd={handleFilterAdd}
            onFilterRemove={handleFilterRemove}
          />
        )}

        {/* Data Grid */}
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex h-full flex-col">
              <SkeletonTable columns={columns.length || 5} rows={10} />
              <div className="flex flex-1 items-center justify-center">
                <AnimatedLoader text="Loading table data..." size="md" />
              </div>
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
              enableSelection={selectedTable.type !== 'view'}
              selectedRowIds={selectedRowIds}
              onSelectionChange={handleSelectionChange}
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

        {/* Column Statistics Panel - Collapsible */}
        {!isLoading && rows.length > 0 && (
          <ColumnStats columns={columns} data={rows} />
        )}

        {/* Pagination */}
        <div className="bg-background flex shrink-0 flex-wrap items-center justify-between gap-2 border-t px-4 py-2">
          <div className="flex flex-wrap items-center gap-4">
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
                    <TooltipTrigger>
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
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => handlePageChange(1)}
                disabled={page <= 1 || isLoading}
                title="First page"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1 || isLoading}
                title="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              {/* Page Jump Input */}
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min={1}
                  max={totalPages || 1}
                  value={page}
                  onChange={(e) => {
                    const value = Number.parseInt(e.target.value, 10);
                    if (
                      !Number.isNaN(value) &&
                      value >= 1 &&
                      value <= totalPages
                    ) {
                      handlePageChange(value);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const value = Number.parseInt(
                        (e.target as HTMLInputElement).value,
                        10
                      );
                      if (!Number.isNaN(value)) {
                        const clampedValue = Math.max(
                          1,
                          Math.min(value, totalPages)
                        );
                        handlePageChange(clampedValue);
                      }
                    }
                  }}
                  className="h-8 w-16 text-center text-sm"
                  disabled={isLoading}
                />
                <span className="text-muted-foreground text-sm">
                  / {totalPages || 1}
                </span>
              </div>

              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages || isLoading}
                title="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => handlePageChange(totalPages)}
                disabled={page >= totalPages || isLoading}
                title="Last page"
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

      {/* Bulk Edit Dialog */}
      <BulkEditDialog
        open={showBulkEditDialog}
        onOpenChange={setShowBulkEditDialog}
        columns={columns}
        selectedRowCount={selectedRowIds.length}
        onApply={handleBulkEdit}
      />

      {/* Keyboard Shortcuts Overlay - Floating button */}
      <KeyboardShortcutsOverlay />
    </div>
  );
}

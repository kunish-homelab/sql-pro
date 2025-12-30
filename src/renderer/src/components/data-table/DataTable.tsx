import type { TableRowData } from './hooks/useTableCore';
import type { UIFilterState } from '@/lib/filter-utils';
import type {
  AggregationType,
  ColumnSchema,
  PendingChange,
  SortState,
} from '@/types/database';
import { Filter, SearchX } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useTableFont } from '@/stores';
import { useTableCore } from './hooks/useTableCore';
import { useTableEditing } from './hooks/useTableEditing';
import { TableBody } from './TableBody';
import { TableHeader } from './TableHeader';

export interface DataTableProps {
  // Data
  columns: ColumnSchema[];
  data: TableRowData[];

  // Sorting
  sort?: SortState | null;
  onSortChange?: (sort: SortState | null) => void;

  // Grouping
  grouping?: string[];
  onGroupingChange?: (grouping: string[]) => void;
  aggregations?: Record<string, AggregationType>;

  // Editing
  editable?: boolean;
  onCellChange?: (
    rowId: string | number,
    columnId: string,
    newValue: unknown,
    oldValue: unknown
  ) => void;
  onRowDelete?: (rowId: string | number) => void;
  onRowInsert?: () => void;

  // Change tracking
  changes?: Map<string | number, PendingChange>;

  // Layout
  className?: string;
  primaryKeyColumn?: string;

  // Auto-focus new row
  newRowId?: string | number | null;
  onNewRowFocused?: () => void;

  // Filtering
  filters?: UIFilterState[];
  onFilterAdd?: (filter: UIFilterState) => void;
  onFilterRemove?: (columnId: string) => void;

  // Empty state context
  totalRowsBeforeClientSearch?: number;
  hasActiveFilters?: boolean;
  hasActiveSearch?: boolean;
  onClearFilters?: () => void;
  onClearSearch?: () => void;
}

export interface DataTableRef {
  scrollToRow: (rowIndex: number) => void;
  focus: () => void;
  resetAllColumnSizes: () => void;
}

export const DataTable = function DataTable({
  ref,
  columns,
  data,
  sort,
  onSortChange,
  grouping: externalGrouping,
  onGroupingChange,
  aggregations,
  editable = false,
  onCellChange,
  onRowDelete,
  onRowInsert,
  changes,
  className,
  primaryKeyColumn,
  newRowId,
  onNewRowFocused,
  filters,
  onFilterAdd,
  onFilterRemove,
  totalRowsBeforeClientSearch,
  hasActiveFilters,
  hasActiveSearch,
  onClearFilters,
  onClearSearch,
}: DataTableProps & { ref?: React.RefObject<DataTableRef | null> }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tableFont = useTableFont();

  // Initialize TanStack Table
  const {
    table,
    toggleGrouping,
    grouping,
    resetColumnSize,
    resetAllColumnSizes,
    pinnedColumns,
    toggleColumnPin,
  } = useTableCore({
    columns,
    data,
    sort,
    onSortChange,
    grouping: externalGrouping,
    onGroupingChange,
    aggregations,
    primaryKeyColumn,
  });

  // Calculate column size CSS variables for performance
  // This recalculates when columnSizing or columnSizingInfo changes
  const columnSizing = table.getState().columnSizing;
  const columnSizingInfo = table.getState().columnSizingInfo;
  const columnSizeVars = useMemo(() => {
    const headers = table.getFlatHeaders();
    const colSizes: Record<string, number> = {};
    for (const header of headers) {
      colSizes[`--col-${header.id}-size`] = header.getSize();
    }
    return colSizes;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnSizing, columnSizingInfo, table]);

  // Get rows from table
  const { rows } = table.getRowModel();

  // Initialize editing
  const {
    focusedCell,
    handleCellClick,
    handleCellDoubleClick,
    handleKeyDown,
    handleCellSave,
    stopEditing,
    startEditing,
    setFocusedCell,
    isCellFocused,
    isCellEditing,
  } = useTableEditing({
    table,
    containerRef,
    editable,
    onCellChange,
    onRowDelete,
    onRowInsert,
  });

  // Auto-focus and start editing the first editable cell of new row
  useEffect(() => {
    if (newRowId === null || newRowId === undefined) return;

    // Find the new row
    const newRow = rows.find((r) => {
      const rowData = r.original as TableRowData;
      return rowData.__rowId === newRowId;
    });

    if (!newRow) return;

    // Find the first non-primary-key column (more likely to be editable)
    const visibleColumns = table.getVisibleLeafColumns();
    const firstEditableColumn = visibleColumns.find((col) => {
      // Skip primary key columns for auto-increment tables
      if (primaryKeyColumn && col.id === primaryKeyColumn) {
        const colSchema = columns.find((c) => c.name === col.id);
        if (colSchema?.isPrimaryKey) {
          const type = colSchema.type.toLowerCase();
          if (type.includes('int') || type === 'integer') {
            return false;
          }
        }
      }
      return true;
    });

    if (firstEditableColumn) {
      // Focus the container first
      containerRef.current?.focus();

      // Set focused cell and start editing
      const timer = setTimeout(() => {
        setFocusedCell({ rowId: newRow.id, columnId: firstEditableColumn.id });
        startEditing(newRow.id, firstEditableColumn.id);
        onNewRowFocused?.();
      }, 0);

      return () => clearTimeout(timer);
    }
  }, [
    newRowId,
    rows,
    table,
    columns,
    primaryKeyColumn,
    setFocusedCell,
    startEditing,
    onNewRowFocused,
  ]);

  // Expose imperative methods
  useImperativeHandle(ref, () => ({
    scrollToRow: (rowIndex: number) => {
      const row = containerRef.current?.querySelector(
        `[data-row-index="${rowIndex}"]`
      );
      row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
    focus: () => {
      containerRef.current?.focus();
    },
    resetAllColumnSizes,
  }));

  // Handle container focus
  const handleContainerFocus = useCallback(() => {
    // If no cell is focused, focus the first cell
    if (!focusedCell && rows.length > 0) {
      const firstRow = rows.find((r) => !r.getIsGrouped?.());
      const firstColumn = table.getVisibleLeafColumns()[0];
      if (firstRow && firstColumn) {
        handleCellClick(firstRow.id, firstColumn.id);
      }
    }
  }, [focusedCell, rows, table, handleCellClick]);

  return (
    <ScrollArea
      viewportRef={containerRef}
      className={cn(
        'bg-background rounded-md outline-none',
        'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2',
        className
      )}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onFocus={handleContainerFocus}
    >
      <table
        className="w-max min-w-full border-separate border-spacing-0"
        style={{
          ...columnSizeVars,
          minWidth: table.getTotalSize(),
          fontFamily: tableFont.family || undefined,
          fontSize: tableFont.size ? `${tableFont.size}px` : undefined,
        }}
      >
        {/* Column group for width control - use CSS variables for dynamic sizing */}
        <colgroup>
          {table.getVisibleLeafColumns().map((column) => (
            <col
              key={column.id}
              style={{
                width: `calc(var(--col-${column.id}-size) * 1px)`,
                minWidth: `calc(var(--col-${column.id}-size) * 1px)`,
              }}
            />
          ))}
        </colgroup>
        {/* Fixed header */}
        <TableHeader
          table={table}
          onToggleGrouping={toggleGrouping}
          onResetColumnSize={resetColumnSize}
          onTogglePin={toggleColumnPin}
          grouping={grouping}
          sorting={sort}
          columnSizingInfo={{
            isResizingColumn: columnSizingInfo.isResizingColumn,
          }}
          filters={filters}
          onFilterAdd={onFilterAdd}
          onFilterRemove={onFilterRemove}
          pinnedColumns={pinnedColumns}
        />

        {/* Table body */}
        <TableBody
          rows={rows}
          editable={editable}
          onCellClick={handleCellClick}
          onCellDoubleClick={handleCellDoubleClick}
          onCellSave={handleCellSave}
          stopEditing={stopEditing}
          isCellFocused={isCellFocused}
          isCellEditing={isCellEditing}
          changes={changes}
          pinnedColumns={pinnedColumns}
          getColumnSize={(columnId) =>
            table.getColumn(columnId)?.getSize() ?? 150
          }
        />
      </table>

      {/* Empty state */}
      {rows.length === 0 && (
        <EmptyState
          hasActiveFilters={hasActiveFilters}
          hasActiveSearch={hasActiveSearch}
          totalRowsBeforeClientSearch={totalRowsBeforeClientSearch}
          onClearFilters={onClearFilters}
          onClearSearch={onClearSearch}
        />
      )}
    </ScrollArea>
  );
};

/**
 * Empty state component that distinguishes between:
 * 1. No data in table - simple "No data" message
 * 2. No results from server-side filters - "No matching results" with clear filters
 * 3. No results from client-side search - "No matching results" with clear search
 */
function EmptyState({
  hasActiveFilters,
  hasActiveSearch,
  totalRowsBeforeClientSearch,
  onClearFilters,
  onClearSearch,
}: {
  hasActiveFilters?: boolean;
  hasActiveSearch?: boolean;
  totalRowsBeforeClientSearch?: number;
  onClearFilters?: () => void;
  onClearSearch?: () => void;
}) {
  // Case 3: Client-side search produced no results (but there were rows before search)
  if (
    hasActiveSearch &&
    totalRowsBeforeClientSearch &&
    totalRowsBeforeClientSearch > 0
  ) {
    return (
      <div className="text-muted-foreground flex h-32 flex-col items-center justify-center gap-3">
        <div className="flex items-center gap-2">
          <SearchX className="h-5 w-5" />
          <span>No matching results for your search</span>
        </div>
        {onClearSearch && (
          <Button variant="outline" size="sm" onClick={onClearSearch}>
            Clear search
          </Button>
        )}
      </div>
    );
  }

  // Case 2: Server-side filters produced no results
  if (hasActiveFilters) {
    return (
      <div className="text-muted-foreground flex h-32 flex-col items-center justify-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          <span>No matching results for the current filters</span>
        </div>
        {onClearFilters && (
          <Button variant="outline" size="sm" onClick={onClearFilters}>
            Clear all filters
          </Button>
        )}
      </div>
    );
  }

  // Case 1: Table is truly empty (no data)
  return (
    <div className="text-muted-foreground flex h-32 items-center justify-center">
      No data
    </div>
  );
}

// Re-export types
export type { TableRowData };

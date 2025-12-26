import type { TableRowData } from './hooks/useTableCore';
import type {
  AggregationType,
  ColumnSchema,
  PendingChange,
  SortState,
} from '@/types/database';
import { useCallback, useImperativeHandle, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useTableCore } from './hooks/useTableCore';
import { useTableEditing } from './hooks/useTableEditing';
import { useVirtualRows } from './hooks/useVirtualRows';
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
  onRowInsert?: (values: Record<string, unknown>) => void;

  // Change tracking
  changes?: Map<string | number, PendingChange>;

  // Layout
  className?: string;
  primaryKeyColumn?: string;

  // Row heights
  dataRowHeight?: number;
  groupRowHeight?: number;
}

export interface DataTableRef {
  scrollToRow: (rowIndex: number) => void;
  focus: () => void;
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
  dataRowHeight = 36,
  groupRowHeight = 44,
}: DataTableProps & { ref?: React.RefObject<DataTableRef | null> }) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize TanStack Table
  const { table, columnSizeVars, resetColumnSize, toggleGrouping, grouping } =
    useTableCore({
      columns,
      data,
      sort,
      onSortChange,
      grouping: externalGrouping,
      onGroupingChange,
      aggregations,
      primaryKeyColumn,
    });

  // Initialize virtualization
  const { virtualRows, totalHeight, rows } = useVirtualRows({
    table,
    containerRef,
    dataRowHeight,
    groupRowHeight,
  });

  // Initialize editing
  const {
    focusedCell,
    handleCellClick,
    handleCellDoubleClick,
    handleKeyDown,
    handleCellSave,
    stopEditing,
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

  // Expose imperative methods
  useImperativeHandle(ref, () => ({
    scrollToRow: (rowIndex: number) => {
      containerRef.current?.scrollTo({
        top: rowIndex * dataRowHeight,
        behavior: 'smooth',
      });
    },
    focus: () => {
      containerRef.current?.focus();
    },
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
    <div
      ref={containerRef}
      className={cn(
        'bg-background relative flex flex-col overflow-auto outline-none',
        'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2',
        className
      )}
      style={columnSizeVars as React.CSSProperties}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onFocus={handleContainerFocus}
    >
      {/* Fixed header */}
      <TableHeader
        table={table}
        onResetColumnSize={resetColumnSize}
        onToggleGrouping={toggleGrouping}
        grouping={grouping}
      />

      {/* Virtualized body */}
      <TableBody
        virtualRows={virtualRows}
        rows={rows}
        totalHeight={totalHeight}
        editable={editable}
        onCellClick={handleCellClick}
        onCellDoubleClick={handleCellDoubleClick}
        onCellSave={handleCellSave}
        stopEditing={stopEditing}
        isCellFocused={isCellFocused}
        isCellEditing={isCellEditing}
        changes={changes}
      />

      {/* Empty state */}
      {rows.length === 0 && (
        <div className="text-muted-foreground flex h-32 items-center justify-center">
          No data
        </div>
      )}
    </div>
  );
};

// Re-export types
export type { TableRowData };

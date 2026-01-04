import type {
  ColumnDef,
  ColumnSizingInfoState,
  ColumnSizingState,
  ExpandedState,
  GroupingState,
  Row,
  RowSelectionState,
  SortingState,
} from '@tanstack/react-table';
import type {
  AggregationType,
  ColumnSchema,
  SortState,
} from '@/types/database';
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getGroupedRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useCallback, useMemo, useState } from 'react';

// Row data type with internal metadata
export interface TableRowData extends Record<string, unknown> {
  __rowId?: string | number;
  __isNew?: boolean;
  __deleted?: boolean;
  __change?: unknown;
}

interface UseTableCoreOptions {
  columns: ColumnSchema[];
  data: TableRowData[];
  // Sorting
  sort?: SortState | null;
  onSortChange?: (sort: SortState | null) => void;
  // Grouping
  grouping?: string[];
  onGroupingChange?: (grouping: string[]) => void;
  // Aggregation config
  aggregations?: Record<string, AggregationType>;
  // Primary key for row identification
  primaryKeyColumn?: string;
  // Column sizing
  minColumnSize?: number;
  maxColumnSize?: number;
}

// Aggregation functions
const aggregationFunctions = {
  count: <T>(_columnId: string, leafRows: Row<T>[]) => leafRows.length,
  sum: <T>(columnId: string, leafRows: Row<T>[]) =>
    leafRows.reduce((sum, row) => {
      const value = row.getValue(columnId);
      return sum + (typeof value === 'number' ? value : 0);
    }, 0),
  avg: <T>(columnId: string, leafRows: Row<T>[]) => {
    if (leafRows.length === 0) return 0;
    const sum = leafRows.reduce((acc, row) => {
      const value = row.getValue(columnId);
      return acc + (typeof value === 'number' ? value : 0);
    }, 0);
    return sum / leafRows.length;
  },
  min: <T>(columnId: string, leafRows: Row<T>[]) => {
    const values = leafRows
      .map((row) => row.getValue(columnId))
      .filter((v): v is number => typeof v === 'number');
    return values.length > 0 ? Math.min(...values) : null;
  },
  max: <T>(columnId: string, leafRows: Row<T>[]) => {
    const values = leafRows
      .map((row) => row.getValue(columnId))
      .filter((v): v is number => typeof v === 'number');
    return values.length > 0 ? Math.max(...values) : null;
  },
};

export function useTableCore({
  columns: columnSchemas,
  data,
  sort,
  onSortChange,
  grouping: externalGrouping,
  onGroupingChange,
  aggregations = {},
  primaryKeyColumn,
  minColumnSize = 50,
  maxColumnSize = 800,
}: UseTableCoreOptions) {
  // Internal grouping state if not controlled externally
  const [internalGrouping, setInternalGrouping] = useState<GroupingState>([]);
  const grouping = externalGrouping ?? internalGrouping;
  const setGrouping = onGroupingChange ?? setInternalGrouping;

  // Expanded state for groups
  const [expanded, setExpanded] = useState<ExpandedState>({});

  // Column sizing state - start empty to use auto layout
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});

  // Column sizing info state for tracking resize in progress
  const [columnSizingInfo, setColumnSizingInfo] =
    useState<ColumnSizingInfoState>({
      startOffset: null,
      startSize: null,
      deltaOffset: null,
      deltaPercentage: null,
      isResizingColumn: false,
      columnSizingStart: [],
    });

  // Pinned columns (left only)
  const [pinnedColumns, setPinnedColumns] = useState<string[]>([]);

  // Row selection state
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  // Convert external sort to TanStack sorting state
  const sorting = useMemo<SortingState>(() => {
    if (!sort) return [];
    return [{ id: sort.column, desc: sort.direction === 'desc' }];
  }, [sort]);

  // Handle sorting change
  const handleSortingChange = useCallback(
    (updater: SortingState | ((old: SortingState) => SortingState)) => {
      const newSorting =
        typeof updater === 'function' ? updater(sorting) : updater;
      if (newSorting.length === 0) {
        onSortChange?.(null);
      } else {
        onSortChange?.({
          column: newSorting[0].id,
          direction: newSorting[0].desc ? 'desc' : 'asc',
        });
      }
    },
    [sorting, onSortChange]
  );

  // Generate column definitions from schema
  const columns = useMemo<ColumnDef<TableRowData>[]>(() => {
    return columnSchemas.map((col) => {
      const aggregationType = aggregations[col.name] || 'count';
      const aggregationFn =
        aggregationType !== 'none'
          ? aggregationFunctions[aggregationType]
          : undefined;

      return {
        id: col.name,
        accessorKey: col.name,
        header: col.name,
        minSize: minColumnSize,
        maxSize: maxColumnSize,
        enableGrouping: true,
        enableResizing: true,
        aggregationFn,
        meta: {
          schema: col,
          isPrimaryKey: col.isPrimaryKey,
          type: col.type,
          nullable: col.nullable,
        },
      } as ColumnDef<TableRowData>;
    });
  }, [columnSchemas, aggregations, minColumnSize, maxColumnSize]);

  // Create table instance
  const table = useReactTable({
    data,
    columns,
    defaultColumn: {
      size: 150,
      minSize: minColumnSize,
      maxSize: maxColumnSize,
    },
    state: {
      grouping,
      expanded,
      sorting,
      columnSizing,
      columnSizingInfo,
      columnPinning: { left: pinnedColumns, right: [] },
      rowSelection,
    },
    onGroupingChange: (updater) => {
      const newGrouping =
        typeof updater === 'function' ? updater(grouping) : updater;
      setGrouping(newGrouping);
    },
    onExpandedChange: setExpanded,
    onSortingChange: handleSortingChange,
    onColumnSizingChange: setColumnSizing,
    onColumnSizingInfoChange: setColumnSizingInfo,
    onColumnPinningChange: (updater) => {
      const newPinning =
        typeof updater === 'function'
          ? updater({ left: pinnedColumns, right: [] })
          : updater;
      setPinnedColumns(newPinning.left ?? []);
    },
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSortedRowModel: getSortedRowModel(),
    columnResizeMode: 'onChange',
    enableGrouping: true,
    enableExpanding: true,
    enableSorting: true,
    enableColumnResizing: true,
    enableColumnPinning: true,
    enableRowSelection: true,
    enableMultiRowSelection: true,
    getRowId: (row, index) => {
      if (row.__rowId !== undefined) return String(row.__rowId);
      if (primaryKeyColumn && row[primaryKeyColumn] !== undefined) {
        return String(row[primaryKeyColumn]);
      }
      return String(index);
    },
  });

  // Toggle grouping for a column
  const toggleGrouping = useCallback(
    (columnId: string) => {
      const newGrouping = grouping.includes(columnId)
        ? grouping.filter((id) => id !== columnId)
        : [...grouping, columnId];
      setGrouping(newGrouping);
    },
    [grouping, setGrouping]
  );

  // Reset column size to auto (remove from sizing state, let table use auto layout)
  const resetColumnSize = useCallback((columnId: string) => {
    setColumnSizing((prev) => {
      const next = { ...prev };
      delete next[columnId];
      return next;
    });
  }, []);

  // Reset all column sizes to auto layout
  const resetAllColumnSizes = useCallback(() => {
    setColumnSizing({});
  }, []);

  // Toggle column pinning (left only)
  const toggleColumnPin = useCallback((columnId: string) => {
    setPinnedColumns((prev) => {
      if (prev.includes(columnId)) {
        return prev.filter((id) => id !== columnId);
      }
      return [...prev, columnId];
    });
  }, []);

  // Clear row selection
  const clearRowSelection = useCallback(() => {
    setRowSelection({});
  }, []);

  // Get selected row IDs
  const selectedRowIds = useMemo(() => {
    return Object.keys(rowSelection).filter((id) => rowSelection[id]);
  }, [rowSelection]);

  return {
    table,
    toggleGrouping,
    grouping,
    expanded,
    flexRender,
    columnSizing,
    resetColumnSize,
    resetAllColumnSizes,
    pinnedColumns,
    toggleColumnPin,
    rowSelection,
    selectedRowIds,
    clearRowSelection,
  };
}

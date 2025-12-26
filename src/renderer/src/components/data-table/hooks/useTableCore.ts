import { useMemo, useState, useCallback } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getGroupedRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  ColumnDef,
  ColumnSizingState,
  GroupingState,
  ExpandedState,
  SortingState,
  Row,
  flexRender,
} from '@tanstack/react-table';
import type { ColumnSchema, SortState, AggregationType } from '@/types/database';

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
  // Column sizing
  defaultColumnSize?: number;
  minColumnSize?: number;
  maxColumnSize?: number;
  // Aggregation config
  aggregations?: Record<string, AggregationType>;
  // Primary key for row identification
  primaryKeyColumn?: string;
}

// Aggregation functions
const aggregationFunctions = {
  count: <T,>(_columnId: string, leafRows: Row<T>[]) => leafRows.length,
  sum: <T,>(columnId: string, leafRows: Row<T>[]) =>
    leafRows.reduce((sum, row) => {
      const value = row.getValue(columnId);
      return sum + (typeof value === 'number' ? value : 0);
    }, 0),
  avg: <T,>(columnId: string, leafRows: Row<T>[]) => {
    if (leafRows.length === 0) return 0;
    const sum = leafRows.reduce((acc, row) => {
      const value = row.getValue(columnId);
      return acc + (typeof value === 'number' ? value : 0);
    }, 0);
    return sum / leafRows.length;
  },
  min: <T,>(columnId: string, leafRows: Row<T>[]) => {
    const values = leafRows
      .map((row) => row.getValue(columnId))
      .filter((v): v is number => typeof v === 'number');
    return values.length > 0 ? Math.min(...values) : null;
  },
  max: <T,>(columnId: string, leafRows: Row<T>[]) => {
    const values = leafRows
      .map((row) => row.getValue(columnId))
      .filter((v): v is number => typeof v === 'number');
    return values.length > 0 ? Math.max(...values) : null;
  },
};

// Calculate initial column width based on content
function calculateColumnWidth(
  col: ColumnSchema,
  data: TableRowData[],
  minWidth: number,
  maxWidth: number
): number {
  const headerWidth = col.name.length * 9 + 60;
  const contentWidth = data.slice(0, 100).reduce((max, row) => {
    const value = row[col.name];
    if (value === null) return Math.max(max, 50);
    const strValue = String(value);
    const charWidth = typeof value === 'number' ? 8 : 8;
    return Math.max(max, strValue.length * charWidth + 32);
  }, 0);
  return Math.min(Math.max(headerWidth, contentWidth, minWidth), maxWidth);
}

export function useTableCore({
  columns: columnSchemas,
  data,
  sort,
  onSortChange,
  grouping: externalGrouping,
  onGroupingChange,
  defaultColumnSize = 150,
  minColumnSize = 50,
  maxColumnSize = 800,
  aggregations = {},
  primaryKeyColumn,
}: UseTableCoreOptions) {
  // Internal grouping state if not controlled externally
  const [internalGrouping, setInternalGrouping] = useState<GroupingState>([]);
  const grouping = externalGrouping ?? internalGrouping;
  const setGrouping = onGroupingChange ?? setInternalGrouping;

  // Expanded state for groups
  const [expanded, setExpanded] = useState<ExpandedState>({});

  // Column sizing state
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() => {
    const sizing: ColumnSizingState = {};
    columnSchemas.forEach((col) => {
      sizing[col.name] = calculateColumnWidth(
        col,
        data,
        minColumnSize,
        maxColumnSize
      );
    });
    return sizing;
  });

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
        size: columnSizing[col.name] || defaultColumnSize,
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
  }, [
    columnSchemas,
    aggregations,
    columnSizing,
    defaultColumnSize,
    minColumnSize,
    maxColumnSize,
  ]);

  // Create table instance
  const table = useReactTable({
    data,
    columns,
    state: {
      grouping,
      expanded,
      sorting,
      columnSizing,
    },
    onGroupingChange: (updater) => {
      const newGrouping =
        typeof updater === 'function' ? updater(grouping) : updater;
      setGrouping(newGrouping);
    },
    onExpandedChange: setExpanded,
    onSortingChange: handleSortingChange,
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSortedRowModel: getSortedRowModel(),
    columnResizeMode: 'onChange',
    enableGrouping: true,
    enableExpanding: true,
    enableSorting: true,
    enableColumnResizing: true,
    getRowId: (row, index) => {
      if (row.__rowId !== undefined) return String(row.__rowId);
      if (primaryKeyColumn && row[primaryKeyColumn] !== undefined) {
        return String(row[primaryKeyColumn]);
      }
      return String(index);
    },
  });

  // Generate CSS variables for column sizing (performance optimization)
  const columnSizeVars = useMemo(() => {
    const headers = table.getFlatHeaders();
    const vars: Record<string, string> = {};
    headers.forEach((header) => {
      vars[`--col-${header.id}-size`] = `${header.getSize()}px`;
    });
    return vars;
  }, [table.getState().columnSizing]);

  // Reset column size to auto-calculated value
  const resetColumnSize = useCallback(
    (columnId: string) => {
      const col = columnSchemas.find((c) => c.name === columnId);
      if (col) {
        const optimalWidth = calculateColumnWidth(
          col,
          data,
          minColumnSize,
          maxColumnSize
        );
        setColumnSizing((prev) => ({
          ...prev,
          [columnId]: optimalWidth,
        }));
      }
    },
    [columnSchemas, data, minColumnSize, maxColumnSize]
  );

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

  return {
    table,
    columnSizeVars,
    resetColumnSize,
    toggleGrouping,
    grouping,
    expanded,
    flexRender,
  };
}

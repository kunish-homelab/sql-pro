import type { Row, Table } from '@tanstack/react-table';
import type { VirtualItem } from '@tanstack/react-virtual';
import type { RefObject } from 'react';
import type { TableRowData } from './useTableCore';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useCallback, useEffect } from 'react';

interface UseVirtualRowsOptions {
  table: Table<TableRowData>;
  containerRef: RefObject<HTMLDivElement | null>;
  dataRowHeight?: number;
  groupRowHeight?: number;
  overscan?: number;
}

interface UseVirtualRowsReturn {
  virtualizer: ReturnType<typeof useVirtualizer<HTMLDivElement, Element>>;
  virtualRows: VirtualItem[];
  totalHeight: number;
  rows: Row<TableRowData>[];
}

export function useVirtualRows({
  table,
  containerRef,
  dataRowHeight = 36,
  groupRowHeight = 44,
  overscan = 10,
}: UseVirtualRowsOptions): UseVirtualRowsReturn {
  const { rows } = table.getRowModel();

  // Estimate size based on whether row is a group header
  const estimateSize = useCallback(
    (index: number) => {
      const row = rows[index];
      // Group rows are taller to accommodate expand button and aggregate info
      return row?.getIsGrouped?.() ? groupRowHeight : dataRowHeight;
    },
    [rows, dataRowHeight, groupRowHeight]
  );

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => containerRef.current,
    estimateSize,
    overscan,
    // Enable smooth scrolling
    scrollMargin: 0,
    // Use row id as key for stable identity when rows are added/removed
    getItemKey: useCallback(
      (index: number) => rows[index]?.id ?? index,
      [rows]
    ),
  });

  // Reset measurements when row count changes to ensure proper recalculation
  useEffect(() => {
    virtualizer.measure();
  }, [rows.length, virtualizer]);

  const virtualRows = virtualizer.getVirtualItems();
  const totalHeight = virtualizer.getTotalSize();

  return {
    virtualizer,
    virtualRows,
    totalHeight,
    rows,
  };
}

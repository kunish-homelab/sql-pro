import { useCallback, RefObject } from 'react';
import { useVirtualizer, VirtualItem } from '@tanstack/react-virtual';
import { Row, Table } from '@tanstack/react-table';
import type { TableRowData } from './useTableCore';

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
  });

  const virtualRows = virtualizer.getVirtualItems();
  const totalHeight = virtualizer.getTotalSize();

  return {
    virtualizer,
    virtualRows,
    totalHeight,
    rows,
  };
}

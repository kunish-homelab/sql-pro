import { useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowUp, ArrowDown, Key } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ColumnSchema, SortState } from '@/types/database';

interface DataGridProps {
  columns: ColumnSchema[];
  rows: Record<string, unknown>[];
  sort: SortState | null;
  onSort: (column: string) => void;
}

export function DataGrid({ columns, rows, sort, onSort }: DataGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 10,
  });

  // Calculate column widths based on content
  const columnWidths = useMemo(() => {
    return columns.map((col) => {
      const headerWidth = col.name.length * 8 + 40; // account for sort icon
      const maxContentWidth = rows.slice(0, 100).reduce((max, row) => {
        const value = row[col.name];
        const strValue = value === null ? 'NULL' : String(value);
        return Math.max(max, strValue.length * 7);
      }, 0);
      return Math.min(Math.max(headerWidth, maxContentWidth, 80), 400);
    });
  }, [columns, rows]);

  const totalWidth = columnWidths.reduce((sum, w) => sum + w, 0);

  if (columns.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        No data to display
      </div>
    );
  }

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div style={{ minWidth: totalWidth }}>
        {/* Header */}
        <div className="sticky top-0 z-10 flex border-b bg-muted/50 backdrop-blur-sm">
          {columns.map((col, idx) => (
            <div
              key={col.name}
              className="flex items-center gap-1 border-r px-3 py-2 last:border-r-0"
              style={{ width: columnWidths[idx], minWidth: columnWidths[idx] }}
            >
              <button
                onClick={() => onSort(col.name)}
                className="flex flex-1 items-center gap-1 text-left text-sm font-medium hover:text-foreground"
              >
                {col.isPrimaryKey && <Key className="h-3 w-3 text-amber-500" />}
                <span className="truncate">{col.name}</span>
                {sort?.column === col.name &&
                  (sort.direction === 'asc' ? (
                    <ArrowUp className="h-3 w-3 flex-shrink-0" />
                  ) : (
                    <ArrowDown className="h-3 w-3 flex-shrink-0" />
                  ))}
              </button>
            </div>
          ))}
        </div>

        {/* Body */}
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index];
            return (
              <div
                key={virtualRow.index}
                className={cn(
                  'absolute left-0 flex w-full border-b',
                  virtualRow.index % 2 === 0 ? 'bg-background' : 'bg-muted/20'
                )}
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {columns.map((col, idx) => {
                  const value = row[col.name];
                  return (
                    <div
                      key={col.name}
                      className="flex items-center border-r px-3 last:border-r-0"
                      style={{
                        width: columnWidths[idx],
                        minWidth: columnWidths[idx],
                      }}
                    >
                      <CellValue value={value} type={col.type} />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface CellValueProps {
  value: unknown;
  type: string;
}

function CellValue({ value, type }: CellValueProps) {
  if (value === null) {
    return <span className="text-sm italic text-muted-foreground">NULL</span>;
  }

  if (typeof value === 'boolean') {
    return <span className="text-sm">{value ? 'true' : 'false'}</span>;
  }

  if (typeof value === 'number') {
    return <span className="font-mono text-sm tabular-nums">{value}</span>;
  }

  // Blob/binary data
  if (value instanceof Uint8Array || type.toLowerCase().includes('blob')) {
    return (
      <span className="text-sm italic text-muted-foreground">
        [BLOB{' '}
        {typeof value === 'object' ? (value as ArrayBuffer).byteLength : '?'}{' '}
        bytes]
      </span>
    );
  }

  const strValue = String(value);

  // Truncate long strings
  if (strValue.length > 100) {
    return (
      <span className="truncate text-sm" title={strValue}>
        {strValue.substring(0, 100)}...
      </span>
    );
  }

  return <span className="truncate text-sm">{strValue}</span>;
}

import type { ColumnSchema, SortState } from '@/types/database';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowDown, ArrowUp, Key } from 'lucide-react';
import { useRef } from 'react';
import { useResizableColumns } from '@/hooks/useResizableColumns';
import { cn } from '@/lib/utils';
import { ColumnResizeHandle } from './ColumnResizeHandle';

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

  // Resizable columns
  const {
    columnWidths,
    totalWidth,
    handleResizeStart,
    handleResizeDoubleClick,
    isResizing,
    resizingColumn,
  } = useResizableColumns({
    columns,
    rows,
    minWidth: 50,
  });

  if (columns.length === 0) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center">
        No data to display
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className={cn('h-full overflow-auto', isResizing && 'select-none')}
    >
      <div style={{ minWidth: totalWidth }}>
        {/* Header */}
        <div className="bg-muted/50 sticky top-0 z-10 flex border-b backdrop-blur-sm">
          {columns.map((col, idx) => (
            <div
              key={col.name}
              className="relative flex items-center gap-1 border-r px-3 py-2 last:border-r-0"
              style={{ width: columnWidths[idx], minWidth: columnWidths[idx] }}
            >
              <button
                onClick={() => onSort(col.name)}
                className="hover:text-foreground flex flex-1 items-center gap-1 text-left text-sm font-medium"
              >
                {col.isPrimaryKey && <Key className="h-3 w-3 text-amber-500" />}
                <span className="truncate">{col.name}</span>
                {sort?.column === col.name &&
                  (sort.direction === 'asc' ? (
                    <ArrowUp className="h-3 w-3 shrink-0" />
                  ) : (
                    <ArrowDown className="h-3 w-3 shrink-0" />
                  ))}
              </button>
              <ColumnResizeHandle
                onMouseDown={(e) => handleResizeStart(idx, e)}
                onDoubleClick={() => handleResizeDoubleClick(idx)}
                isResizing={resizingColumn === idx}
              />
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
    return <span className="text-muted-foreground text-sm italic">NULL</span>;
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
      <span className="text-muted-foreground text-sm italic">
        [BLOB{' '}
        {typeof value === 'object' ? (value as ArrayBuffer).byteLength : '?'}{' '}
        bytes]
      </span>
    );
  }

  const strValue = String(value);
  return (
    <span className="text-sm whitespace-nowrap" title={strValue}>
      {strValue}
    </span>
  );
}

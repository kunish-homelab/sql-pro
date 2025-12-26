import { useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { QueryResult } from '@/types/database';

interface QueryResultsProps {
  results: QueryResult;
}

export function QueryResults({ results }: QueryResultsProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual is safe here
  const rowVirtualizer = useVirtualizer({
    count: results.rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32,
    overscan: 10,
  });

  // Calculate column widths
  const columnWidths = useMemo(() => {
    return results.columns.map((col) => {
      const headerWidth = col.length * 8 + 24;
      const maxContentWidth = results.rows.slice(0, 100).reduce((max, row) => {
        const value = row[col];
        const strValue = value === null ? 'NULL' : String(value);
        return Math.max(max, strValue.length * 7);
      }, 0);
      return Math.min(Math.max(headerWidth, maxContentWidth, 60), 400);
    });
  }, [results.columns, results.rows]);

  const totalWidth = columnWidths.reduce((sum, w) => sum + w, 0);

  if (results.columns.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p>Query executed successfully (no results to display)</p>
      </div>
    );
  }

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div style={{ minWidth: totalWidth }}>
        {/* Header */}
        <div className="sticky top-0 z-10 flex border-b bg-muted/50 backdrop-blur-sm">
          {results.columns.map((col, idx) => (
            <div
              key={col}
              className="flex items-center border-r px-3 py-2 text-sm font-medium last:border-r-0"
              style={{ width: columnWidths[idx], minWidth: columnWidths[idx] }}
            >
              <span className="truncate">{col}</span>
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
            const row = results.rows[virtualRow.index];
            return (
              <div
                key={virtualRow.index}
                className="absolute left-0 flex w-full border-b"
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                  backgroundColor:
                    virtualRow.index % 2 === 0
                      ? 'var(--background)'
                      : 'hsl(var(--muted) / 0.2)',
                }}
              >
                {results.columns.map((col, idx) => {
                  const value = row[col];
                  return (
                    <div
                      key={col}
                      className="flex items-center border-r px-3 last:border-r-0"
                      style={{
                        width: columnWidths[idx],
                        minWidth: columnWidths[idx],
                      }}
                    >
                      <CellValue value={value} />
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

function CellValue({ value }: { value: unknown }) {
  if (value === null) {
    return <span className="text-xs italic text-muted-foreground">NULL</span>;
  }

  if (typeof value === 'number') {
    return <span className="font-mono text-xs tabular-nums">{value}</span>;
  }

  const strValue = String(value);
  if (strValue.length > 100) {
    return (
      <span className="truncate text-xs" title={strValue}>
        {strValue.substring(0, 100)}...
      </span>
    );
  }

  return <span className="truncate text-xs">{strValue}</span>;
}

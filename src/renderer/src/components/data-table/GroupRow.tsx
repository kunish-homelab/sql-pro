import type { Row } from '@tanstack/react-table';
import type { TableRowData } from './hooks/useTableCore';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { memo } from 'react';
import { cn } from '@/lib/utils';

interface GroupRowProps {
  row: Row<TableRowData>;
  style?: React.CSSProperties;
}

export const GroupRow = memo(({ row, style }: GroupRowProps) => {
  const isExpanded = row.getIsExpanded();
  const groupingValue = row.groupingValue;
  const leafCount = row.subRows.length;

  return (
    <div
      className={cn(
        'border-border bg-muted/50 hover:bg-muted/70 flex items-center border-b',
        'select-none'
      )}
      style={style}
    >
      {/* Expand/collapse button and group info */}
      <div
        className="flex flex-1 cursor-pointer items-center gap-2 px-3 py-2"
        onClick={() => row.toggleExpanded()}
      >
        {/* Indent based on grouping depth */}
        {row.depth > 0 && <div style={{ width: row.depth * 20 }} />}

        {/* Chevron */}
        <button
          className="hover:bg-accent flex h-5 w-5 items-center justify-center rounded"
          onClick={(e) => {
            e.stopPropagation();
            row.toggleExpanded();
          }}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        {/* Group value */}
        <span className="font-medium">
          {row.groupingColumnId && (
            <span className="text-muted-foreground mr-1">
              {row.groupingColumnId}:
            </span>
          )}
          <span>
            {groupingValue === null ? (
              <span className="text-muted-foreground italic">NULL</span>
            ) : (
              String(groupingValue)
            )}
          </span>
        </span>

        {/* Row count */}
        <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs">
          {leafCount} {leafCount === 1 ? 'row' : 'rows'}
        </span>
      </div>

      {/* Aggregated values for each visible column */}
      <div className="flex items-center">
        {row.getVisibleCells().map((cell) => {
          // Skip the grouping column itself
          if (cell.column.id === row.groupingColumnId) {
            return null;
          }

          // Only show aggregated cells
          if (!cell.getIsAggregated()) {
            return (
              <div
                key={cell.id}
                className="text-muted-foreground px-2 text-sm"
                style={{ width: `var(--col-${cell.column.id}-size)` }}
              />
            );
          }

          const aggregatedValue = cell.getValue();

          return (
            <div
              key={cell.id}
              className="px-2 text-sm"
              style={{ width: `var(--col-${cell.column.id}-size)` }}
            >
              {aggregatedValue !== null && aggregatedValue !== undefined ? (
                <span className="text-muted-foreground font-mono tabular-nums">
                  {typeof aggregatedValue === 'number'
                    ? formatAggregatedValue(aggregatedValue)
                    : String(aggregatedValue)}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
});

function formatAggregatedValue(value: number): string {
  // Format large numbers with commas
  if (Number.isInteger(value)) {
    return value.toLocaleString();
  }
  // Format decimals to 2 places
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

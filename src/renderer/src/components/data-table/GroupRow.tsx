import { memo } from 'react';
import { Row } from '@tanstack/react-table';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TableRowData } from './hooks/useTableCore';

interface GroupRowProps {
  row: Row<TableRowData>;
  style?: React.CSSProperties;
}

export const GroupRow = memo(function GroupRow({ row, style }: GroupRowProps) {
  const isExpanded = row.getIsExpanded();
  const groupingValue = row.groupingValue;
  const leafCount = row.subRows.length;

  return (
    <div
      className={cn(
        'flex items-center border-b border-border bg-muted/50 hover:bg-muted/70',
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
          className="flex h-5 w-5 items-center justify-center rounded hover:bg-accent"
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
            <span className="mr-1 text-muted-foreground">
              {row.groupingColumnId}:
            </span>
          )}
          <span>
            {groupingValue === null ? (
              <span className="italic text-muted-foreground">NULL</span>
            ) : (
              String(groupingValue)
            )}
          </span>
        </span>

        {/* Row count */}
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
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
                className="px-2 text-sm text-muted-foreground"
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
                <span className="font-mono tabular-nums text-muted-foreground">
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

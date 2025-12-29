import type { Row } from '@tanstack/react-table';
import type { TableRowData } from './hooks/useTableCore';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { memo } from 'react';
import { cn } from '@/lib/utils';

interface GroupRowProps {
  row: Row<TableRowData>;
}

export const GroupRow = memo(({ row }: GroupRowProps) => {
  const isExpanded = row.getIsExpanded();
  const groupingValue = row.groupingValue;
  const leafCount = row.subRows.length;
  const visibleCells = row.getVisibleCells();

  return (
    <tr
      className={cn(
        'border-border bg-muted/50 hover:bg-muted/70 border-b',
        'select-none'
      )}
    >
      {/* First cell contains the group header with expand/collapse */}
      <td
        colSpan={visibleCells.length}
        className="cursor-pointer px-3 py-2"
        onClick={() => row.toggleExpanded()}
      >
        <div className="flex items-center gap-2">
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

          {/* Aggregated values inline */}
          <div className="text-muted-foreground ml-4 flex items-center gap-4 text-sm">
            {visibleCells.map((cell) => {
              // Skip the grouping column itself
              if (cell.column.id === row.groupingColumnId) {
                return null;
              }

              // Only show aggregated cells with values
              if (!cell.getIsAggregated()) {
                return null;
              }

              const aggregatedValue = cell.getValue();
              if (aggregatedValue === null || aggregatedValue === undefined) {
                return null;
              }

              return (
                <span key={cell.id} className="font-mono tabular-nums">
                  {cell.column.id}:{' '}
                  {typeof aggregatedValue === 'number'
                    ? formatAggregatedValue(aggregatedValue)
                    : String(aggregatedValue)}
                </span>
              );
            })}
          </div>
        </div>
      </td>
    </tr>
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

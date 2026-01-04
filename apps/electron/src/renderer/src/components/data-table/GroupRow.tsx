import type { Row } from '@tanstack/react-table';
import type { TableRowData } from './hooks/useTableCore';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { memo } from 'react';
import { cn } from '@/lib/utils';

interface GroupRowProps {
  row: Row<TableRowData>;
  // Pass isExpanded as prop to trigger re-render when state changes
  isExpanded: boolean;
}

export const GroupRow = memo(({ row, isExpanded }: GroupRowProps) => {
  const groupingValue = row.groupingValue;
  // Use getLeafRows() to get the actual count of leaf rows (data rows, not groups)
  const leafCount = row.getLeafRows().length;
  const colSpan = row.getVisibleCells().length;

  return (
    <tr
      className={cn(
        'border-border bg-muted/50 hover:bg-muted/70 border-b',
        'select-none'
      )}
    >
      <td
        colSpan={colSpan}
        className="cursor-pointer px-3 py-2"
        onClick={() => row.toggleExpanded()}
      >
        <div className="flex items-center gap-2">
          {row.depth > 0 && <div style={{ width: row.depth * 20 }} />}

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

          <span className="font-medium">
            {groupingValue === null ? (
              <span className="text-muted-foreground italic">NULL</span>
            ) : (
              String(groupingValue)
            )}
          </span>

          <span className="text-muted-foreground text-xs">({leafCount})</span>
        </div>
      </td>
    </tr>
  );
});

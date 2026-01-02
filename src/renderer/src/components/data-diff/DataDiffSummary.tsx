import type { DataComparisonResult, DiffType } from '@shared/types';
import {
  ChevronDown,
  ChevronUp,
  Edit,
  Minus,
  Plus,
  TableIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useDataDiffStore } from '@/stores';

interface DataDiffSummaryProps {
  comparisonResult: DataComparisonResult;
  className?: string;
}

interface RowDiffCounts {
  added: number;
  removed: number;
  modified: number;
  unchanged: number;
}

/**
 * Summary panel showing row difference counts.
 * Provides an overview of data changes and allows filtering by clicking sections.
 */
export function DataDiffSummary({
  comparisonResult,
  className,
}: DataDiffSummaryProps) {
  const { expandedRows, toggleSummaryExpanded, setDiffTypeFilter } =
    useDataDiffStore();

  const counts: RowDiffCounts = {
    added: comparisonResult.summary.rowsAdded,
    removed: comparisonResult.summary.rowsRemoved,
    modified: comparisonResult.summary.rowsModified,
    unchanged: comparisonResult.summary.rowsUnchanged,
  };

  const totalRows =
    counts.added + counts.removed + counts.modified + counts.unchanged;

  const handleCountClick = (diffType: DiffType) => {
    // Toggle the specific diff type filter
    setDiffTypeFilter(
      diffType as 'added' | 'removed' | 'modified' | 'unchanged',
      true
    );

    // Disable other filters
    const allDiffTypes: Array<'added' | 'removed' | 'modified' | 'unchanged'> =
      ['added', 'removed', 'modified', 'unchanged'];

    allDiffTypes.forEach((type) => {
      if (type !== diffType) {
        setDiffTypeFilter(type, false);
      }
    });
  };

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader
        className="cursor-pointer pb-3"
        onClick={toggleSummaryExpanded}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Row Comparison Summary</CardTitle>
          {expandedRows.summary ? (
            <ChevronUp className="text-muted-foreground h-4 w-4" />
          ) : (
            <ChevronDown className="text-muted-foreground h-4 w-4" />
          )}
        </div>
      </CardHeader>

      {expandedRows.summary && (
        <CardContent className="space-y-4 pt-0">
          {/* Total Rows Info */}
          <div className="bg-muted/50 flex items-center gap-2 rounded-md p-3">
            <TableIcon className="text-muted-foreground h-4 w-4" />
            <span className="text-sm font-medium">Total Rows:</span>
            <span className="text-sm">{totalRows.toLocaleString()}</span>
            <span className="text-muted-foreground ml-auto text-xs">
              {comparisonResult.summary.sourceRows.toLocaleString()} source →{' '}
              {comparisonResult.summary.targetRows.toLocaleString()} target
            </span>
          </div>

          {/* Diff Counts Grid */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {/* Added */}
            {counts.added > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCountClick('added')}
                className="h-auto flex-col items-start gap-1 p-3 hover:bg-green-100 dark:hover:bg-green-950"
                title="Filter to show added rows only"
              >
                <div className="flex items-center gap-1.5 text-green-700 dark:text-green-300">
                  <Plus className="h-3.5 w-3.5" />
                  <span className="text-xs">Added</span>
                </div>
                <span className="text-foreground text-lg font-semibold">
                  {counts.added.toLocaleString()}
                </span>
              </Button>
            )}

            {/* Removed */}
            {counts.removed > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCountClick('removed')}
                className="h-auto flex-col items-start gap-1 p-3 hover:bg-red-100 dark:hover:bg-red-950"
                title="Filter to show removed rows only"
              >
                <div className="flex items-center gap-1.5 text-red-700 dark:text-red-300">
                  <Minus className="h-3.5 w-3.5" />
                  <span className="text-xs">Removed</span>
                </div>
                <span className="text-foreground text-lg font-semibold">
                  {counts.removed.toLocaleString()}
                </span>
              </Button>
            )}

            {/* Modified */}
            {counts.modified > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCountClick('modified')}
                className="h-auto flex-col items-start gap-1 p-3 hover:bg-amber-100 dark:hover:bg-amber-950"
                title="Filter to show modified rows only"
              >
                <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
                  <Edit className="h-3.5 w-3.5" />
                  <span className="text-xs">Modified</span>
                </div>
                <span className="text-foreground text-lg font-semibold">
                  {counts.modified.toLocaleString()}
                </span>
              </Button>
            )}

            {/* Unchanged */}
            {counts.unchanged > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCountClick('unchanged')}
                className="h-auto flex-col items-start gap-1 p-3 hover:bg-blue-100 dark:hover:bg-blue-950"
                title="Filter to show unchanged rows only"
              >
                <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300">
                  <span className="text-xs">Unchanged</span>
                </div>
                <span className="text-foreground text-lg font-semibold">
                  {counts.unchanged.toLocaleString()}
                </span>
              </Button>
            )}
          </div>

          {/* Change Summary Text */}
          <div className="text-muted-foreground text-xs">
            {counts.added + counts.removed + counts.modified === 0 ? (
              <p>No differences found. All rows are identical.</p>
            ) : (
              <p>
                {counts.added + counts.removed + counts.modified}{' '}
                {counts.added + counts.removed + counts.modified === 1
                  ? 'row has'
                  : 'rows have'}{' '}
                differences (
                {(
                  ((counts.added + counts.removed + counts.modified) /
                    totalRows) *
                  100
                ).toFixed(1)}
                % of total rows)
              </p>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

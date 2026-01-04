import type { ColumnChange, RowDiff } from '@shared/types';
import { Badge } from '@sqlpro/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@sqlpro/ui/card';
import { ChevronDown, ChevronRight, Minus, Plus, Table } from 'lucide-react';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface RowDiffCardProps {
  rowDiff: RowDiff;
  isExpanded: boolean;
  onToggle: () => void;
  showOnlyDifferences?: boolean;
  className?: string;
}

/**
 * Card component showing differences for a single row.
 * Displays row status (added/removed/modified/unchanged) and can be
 * expanded to show column-level value changes.
 */
export function RowDiffCard({
  rowDiff,
  isExpanded,
  onToggle,
  showOnlyDifferences = false,
  className,
}: RowDiffCardProps) {
  const { diffType, primaryKey, columnChanges } = rowDiff;

  // Get styling based on diff type
  const getDiffStyle = () => {
    switch (diffType) {
      case 'added':
        return {
          bg: 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950',
          icon: <Plus className="h-4 w-4 text-green-600 dark:text-green-400" />,
          badge:
            'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
          label: 'Added',
        };
      case 'removed':
        return {
          bg: 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950',
          icon: <Minus className="h-4 w-4 text-red-600 dark:text-red-400" />,
          badge: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
          label: 'Removed',
        };
      case 'modified':
        return {
          bg: 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950',
          icon: (
            <Table className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          ),
          badge:
            'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
          label: 'Modified',
        };
      case 'unchanged':
      default:
        return {
          bg: 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950',
          icon: <Table className="h-4 w-4 text-gray-600 dark:text-gray-400" />,
          badge:
            'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
          label: 'Unchanged',
        };
    }
  };

  const style = getDiffStyle();

  // Format primary key for display
  const primaryKeyDisplay = useMemo(() => {
    const entries = Object.entries(primaryKey);
    if (entries.length === 1) {
      return String(entries[0][1]);
    }
    return entries.map(([key, value]) => `${key}=${value}`).join(', ');
  }, [primaryKey]);

  // Count column changes for modified rows
  const changeCount = useMemo(() => {
    if (diffType !== 'modified') return 0;
    return columnChanges?.length ?? 0;
  }, [diffType, columnChanges]);

  return (
    <Card className={cn('overflow-hidden', style.bg, className)}>
      {/* Header */}
      <CardHeader
        className="cursor-pointer p-4 hover:bg-black/5 dark:hover:bg-white/5"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0" />
          )}
          {style.icon}
          <CardTitle className="flex-1 text-base font-semibold">
            {primaryKeyDisplay}
          </CardTitle>
          <Badge variant="secondary" className={cn('text-xs', style.badge)}>
            {style.label}
          </Badge>
          {changeCount > 0 && (
            <span className="text-muted-foreground text-xs">
              {changeCount} {changeCount === 1 ? 'change' : 'changes'}
            </span>
          )}
        </div>
      </CardHeader>

      {/* Details */}
      {isExpanded && (
        <CardContent className="space-y-2 border-t p-4">
          {/* Modified rows show column changes */}
          {diffType === 'modified' &&
            columnChanges &&
            columnChanges.length > 0 && (
              <div className="space-y-2">
                {columnChanges.map((change) => {
                  // Filter unchanged columns if showOnlyDifferences is true
                  if (
                    showOnlyDifferences &&
                    change.sourceValue === change.targetValue
                  ) {
                    return null;
                  }

                  return (
                    <ColumnChangeRow
                      key={change.columnName}
                      columnChange={change}
                    />
                  );
                })}
              </div>
            )}

          {/* Added rows show all target values */}
          {diffType === 'added' && rowDiff.targetRow && (
            <div className="space-y-2">
              <div className="text-muted-foreground mb-2 text-sm font-medium">
                New Values
              </div>
              {Object.entries(rowDiff.targetRow).map(([column, value]) => (
                <div
                  key={column}
                  className="flex items-start gap-2 rounded-md bg-green-50 p-2 dark:bg-green-950/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{column}</div>
                    <div className="font-mono text-sm text-green-700 dark:text-green-300">
                      {formatValue(value)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Removed rows show all source values */}
          {diffType === 'removed' && rowDiff.sourceRow && (
            <div className="space-y-2">
              <div className="text-muted-foreground mb-2 text-sm font-medium">
                Deleted Values
              </div>
              {Object.entries(rowDiff.sourceRow).map(([column, value]) => (
                <div
                  key={column}
                  className="flex items-start gap-2 rounded-md bg-red-50 p-2 dark:bg-red-950/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{column}</div>
                    <div className="font-mono text-sm text-red-700 dark:text-red-300">
                      {formatValue(value)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Unchanged rows show current values */}
          {diffType === 'unchanged' && rowDiff.sourceRow && (
            <div className="space-y-2">
              <div className="text-muted-foreground mb-2 text-sm font-medium">
                Current Values
              </div>
              {Object.entries(rowDiff.sourceRow).map(([column, value]) => (
                <div
                  key={column}
                  className="flex items-start gap-2 rounded-md bg-gray-50 p-2 dark:bg-gray-950/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{column}</div>
                    <div className="text-muted-foreground font-mono text-sm">
                      {formatValue(value)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

/**
 * Component to display a single column change
 */
function ColumnChangeRow({ columnChange }: { columnChange: ColumnChange }) {
  const { columnName, sourceValue, targetValue } = columnChange;

  const hasChanged = sourceValue !== targetValue;

  return (
    <div
      className={cn(
        'rounded-md p-2',
        hasChanged
          ? 'bg-amber-50 dark:bg-amber-950/50'
          : 'bg-gray-50 dark:bg-gray-950/50'
      )}
    >
      <div className="mb-1 text-sm font-medium">{columnName}</div>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-xs text-red-600 dark:text-red-400">
            - {formatValue(sourceValue)}
          </div>
          <div className="text-xs text-green-600 dark:text-green-400">
            + {formatValue(targetValue)}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Format a value for display
 */
function formatValue(value: unknown): string {
  if (value === null) return 'NULL';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'boolean') return value.toString();
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

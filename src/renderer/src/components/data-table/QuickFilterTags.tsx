import type { UIFilterState } from '@/lib/filter-utils';
import type { ColumnSchema } from '@/types/database';
import { Hash, Sparkles, Tag, X } from 'lucide-react';
import { memo, useMemo } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface QuickFilterTagsProps {
  columns: ColumnSchema[];
  data: Record<string, unknown>[];
  /** Currently active filters */
  activeFilters: UIFilterState[];
  /** Callback when a quick filter is applied */
  onFilterAdd: (filter: UIFilterState) => void;
  /** Callback when a filter is removed */
  onFilterRemove: (columnId: string) => void;
  className?: string;
}

interface QuickFilterSuggestion {
  column: string;
  columnType: string;
  value: unknown;
  count: number;
  percentage: number;
  type: 'common' | 'null' | 'distinct';
}

/**
 * Generates smart filter suggestions based on data patterns
 */
function generateQuickFilters(
  columns: ColumnSchema[],
  data: Record<string, unknown>[],
  maxSuggestions = 8
): QuickFilterSuggestion[] {
  if (data.length === 0) return [];

  const suggestions: QuickFilterSuggestion[] = [];

  // Analyze each column
  for (const col of columns) {
    const values = data.map((row) => row[col.name]);
    const totalCount = values.length;

    // Count value frequencies
    const valueCounts = new Map<string, { value: unknown; count: number }>();
    let nullCount = 0;

    for (const value of values) {
      if (value === null || value === undefined) {
        nullCount++;
        continue;
      }
      const key = JSON.stringify(value);
      const existing = valueCounts.get(key);
      if (existing) {
        existing.count++;
      } else {
        valueCounts.set(key, { value, count: 1 });
      }
    }

    // Find high-frequency values (> 10% of data)
    for (const [, { value, count }] of valueCounts) {
      const percentage = (count / totalCount) * 100;
      if (percentage >= 10 && percentage < 100) {
        suggestions.push({
          column: col.name,
          columnType: col.type,
          value,
          count,
          percentage,
          type: 'common',
        });
      }
    }

    // Add null filter suggestion if significant nulls exist
    const nullPercentage = (nullCount / totalCount) * 100;
    if (nullPercentage >= 5 && nullPercentage < 100) {
      suggestions.push({
        column: col.name,
        columnType: col.type,
        value: null,
        count: nullCount,
        percentage: nullPercentage,
        type: 'null',
      });
    }

    // Add low-cardinality column suggestions
    const distinctCount = valueCounts.size;
    if (distinctCount <= 5 && distinctCount > 0 && totalCount > 10) {
      // This column has few distinct values - good for filtering
      const topValue = Array.from(valueCounts.values()).sort(
        (a, b) => b.count - a.count
      )[0];
      if (topValue && (topValue.count / totalCount) * 100 >= 5) {
        // Only add if not already added as common value
        const alreadyAdded = suggestions.some(
          (s) =>
            s.column === col.name &&
            JSON.stringify(s.value) === JSON.stringify(topValue.value)
        );
        if (!alreadyAdded) {
          suggestions.push({
            column: col.name,
            columnType: col.type,
            value: topValue.value,
            count: topValue.count,
            percentage: (topValue.count / totalCount) * 100,
            type: 'distinct',
          });
        }
      }
    }
  }

  // Sort by relevance (percentage) and take top suggestions
  return suggestions
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, maxSuggestions);
}

/**
 * Quick filter tags component that shows smart filter suggestions
 * based on data patterns.
 */
export const QuickFilterTags = memo(
  ({
    columns,
    data,
    activeFilters,
    onFilterAdd,
    onFilterRemove,
    className,
  }: QuickFilterTagsProps) => {
    // Generate quick filter suggestions
    const suggestions = useMemo(
      () => generateQuickFilters(columns, data),
      [columns, data]
    );

    // Check if a suggestion is currently active
    const isFilterActive = (suggestion: QuickFilterSuggestion): boolean => {
      return activeFilters.some(
        (f) =>
          f.column === suggestion.column &&
          (suggestion.value === null
            ? f.uiOperator === 'is_null'
            : f.value === String(suggestion.value))
      );
    };

    // Handle filter toggle
    const handleToggle = (suggestion: QuickFilterSuggestion) => {
      if (isFilterActive(suggestion)) {
        onFilterRemove(suggestion.column);
      } else {
        const filter: UIFilterState =
          suggestion.value === null
            ? {
                id: `quick-${suggestion.column}-null`,
                column: suggestion.column,
                columnType: 'text',
                uiOperator: 'is_null',
                value: '',
              }
            : {
                id: `quick-${suggestion.column}-${String(suggestion.value)}`,
                column: suggestion.column,
                columnType: 'text',
                uiOperator: 'equals',
                value: String(suggestion.value),
              };
        onFilterAdd(filter);
      }
    };

    // Get icon based on suggestion type
    const getIcon = (suggestion: QuickFilterSuggestion) => {
      switch (suggestion.type) {
        case 'null':
          return <X className="h-2.5 w-2.5" />;
        case 'distinct':
          return <Hash className="h-2.5 w-2.5" />;
        case 'common':
        default:
          return <Tag className="h-2.5 w-2.5" />;
      }
    };

    // Format value for display
    const formatValue = (value: unknown): string => {
      if (value === null || value === undefined) {
        return 'NULL';
      }
      const str = String(value);
      return str.length > 20 ? `${str.slice(0, 20)}...` : str;
    };

    if (suggestions.length === 0) return null;

    return (
      <div
        className={cn(
          'bg-muted/30 flex items-center gap-2 border-b px-4 py-1.5',
          'scrollbar-thin overflow-x-auto',
          className
        )}
      >
        <div className="flex shrink-0 items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-amber-500" />
          <span className="text-muted-foreground text-[10px] font-medium uppercase">
            Quick Filters
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {suggestions.map((suggestion) => {
            const isActive = isFilterActive(suggestion);

            return (
              <Tooltip key={`${suggestion.column}-${String(suggestion.value)}`}>
                <TooltipTrigger>
                  <button
                    onClick={() => handleToggle(suggestion)}
                    className={cn(
                      'inline-flex h-6 items-center gap-1 rounded-md border px-2 text-xs font-medium transition-all duration-150',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-background hover:bg-muted',
                      suggestion.type === 'null' && !isActive && 'border-dashed'
                    )}
                  >
                    {getIcon(suggestion)}
                    <span className="max-w-[100px] truncate">
                      {suggestion.column}
                    </span>
                    <span
                      className={cn(
                        'text-[10px]',
                        isActive ? 'opacity-75' : 'text-muted-foreground'
                      )}
                    >
                      {suggestion.value === null
                        ? 'is null'
                        : `= ${formatValue(suggestion.value)}`}
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  <div className="space-y-1">
                    <div>
                      <span className="font-medium">{suggestion.column}</span>
                      {suggestion.value === null
                        ? ' is null'
                        : ` = "${formatValue(suggestion.value)}"`}
                    </div>
                    <div className="text-muted-foreground">
                      {suggestion.count.toLocaleString()} rows (
                      {suggestion.percentage.toFixed(1)}%)
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
    );
  }
);

QuickFilterTags.displayName = 'QuickFilterTags';

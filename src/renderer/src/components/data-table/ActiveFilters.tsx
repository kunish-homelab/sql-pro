import type { UIFilterState } from '@/lib/filter-utils';
import { Badge } from '@sqlpro/ui/badge';
import { Button } from '@sqlpro/ui/button';
import { X } from 'lucide-react';
import { generateCompactFilterLabel } from '@/lib/filter-utils';

export interface ActiveFiltersProps {
  /** Array of active UI filters to display */
  filters: UIFilterState[];
  /** Callback to remove a specific filter by column id */
  onFilterRemove: (columnId: string) => void;
  /** Callback to clear all filters */
  onFiltersClear: () => void;
}

/**
 * Displays active filters as removable Badge chips.
 * Shows individual filter chips with X button to remove,
 * plus a "Clear All" button when multiple filters are active.
 */
export function ActiveFilters({
  filters,
  onFilterRemove,
  onFiltersClear,
}: ActiveFiltersProps) {
  // Don't render anything if there are no filters
  if (filters.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
      <span className="text-muted-foreground text-xs font-medium">
        Filters:
      </span>
      {filters.map((filter) => {
        const label = generateCompactFilterLabel(
          filter.column,
          filter.uiOperator,
          filter.value,
          filter.secondValue
        );

        return (
          <Badge key={filter.id} variant="secondary" className="gap-1 pr-1">
            <span className="max-w-50 truncate">{label}</span>
            <button
              type="button"
              className="hover:bg-muted ml-1 rounded-full p-0.5 transition-colors"
              onClick={() => onFilterRemove(filter.column)}
              title={`Remove filter on ${filter.column}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        );
      })}
      {filters.length > 1 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={onFiltersClear}
        >
          Clear All
        </Button>
      )}
    </div>
  );
}

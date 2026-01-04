import { Button } from '@sqlpro/ui/button';
import { Input } from '@sqlpro/ui/input';
import { Separator } from '@sqlpro/ui/separator';
import { Toggle } from '@sqlpro/ui/toggle';
import { Edit, Filter, Minus, Plus, RotateCcw, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDataDiffStore } from '@/stores';

interface DataDiffFilterBarProps {
  className?: string;
}

/**
 * Toolbar with filters to show/hide different types of row changes.
 * Provides filtering by diff type and text search.
 */
export function DataDiffFilterBar({ className }: DataDiffFilterBarProps) {
  const {
    filters,
    setShowOnlyDifferences,
    setDiffTypeFilter,
    setSearchText,
    resetFilters,
  } = useDataDiffStore();

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
  };

  const handleClearSearch = () => {
    setSearchText('');
  };

  const handleResetFilters = () => {
    resetFilters();
  };

  // Check if any filters are active (non-default state)
  const hasActiveFilters =
    filters.showOnlyDifferences ||
    !filters.diffTypes.added ||
    !filters.diffTypes.removed ||
    !filters.diffTypes.modified ||
    !filters.diffTypes.unchanged ||
    filters.searchText.trim() !== '';

  return (
    <div
      className={cn(
        'border-border bg-muted/30 flex flex-wrap items-center gap-3 rounded-md border p-3',
        className
      )}
    >
      {/* Show Only Differences Toggle */}
      <div className="flex items-center gap-2">
        <Filter className="text-muted-foreground h-4 w-4" />
        <Toggle
          pressed={filters.showOnlyDifferences}
          onPressedChange={setShowOnlyDifferences}
          variant="outline"
          size="sm"
          aria-label="Show only differences"
          title="Toggle show only differences (⌘D)"
        >
          Only Differences
        </Toggle>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Diff Type Filters */}
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-xs font-medium">
          Row Type:
        </span>
        <div className="flex gap-1">
          <Toggle
            pressed={filters.diffTypes.added}
            onPressedChange={(pressed) => setDiffTypeFilter('added', pressed)}
            variant="outline"
            size="sm"
            aria-label="Show added rows"
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
            <span>Added</span>
          </Toggle>
          <Toggle
            pressed={filters.diffTypes.removed}
            onPressedChange={(pressed) => setDiffTypeFilter('removed', pressed)}
            variant="outline"
            size="sm"
            aria-label="Show removed rows"
            className="gap-1.5"
          >
            <Minus className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
            <span>Removed</span>
          </Toggle>
          <Toggle
            pressed={filters.diffTypes.modified}
            onPressedChange={(pressed) =>
              setDiffTypeFilter('modified', pressed)
            }
            variant="outline"
            size="sm"
            aria-label="Show modified rows"
            className="gap-1.5"
          >
            <Edit className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            <span>Modified</span>
          </Toggle>
          <Toggle
            pressed={filters.diffTypes.unchanged}
            onPressedChange={(pressed) =>
              setDiffTypeFilter('unchanged', pressed)
            }
            variant="outline"
            size="sm"
            aria-label="Show unchanged rows"
            className="gap-1.5"
          >
            <span className="text-muted-foreground">Unchanged</span>
          </Toggle>
        </div>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Search Input */}
      <div className="flex flex-1 items-center gap-2">
        <Search className="text-muted-foreground h-4 w-4" />
        <div className="relative flex-1">
          <Input
            type="text"
            placeholder="Search by column values..."
            value={filters.searchText}
            onChange={handleSearchChange}
            className="h-8 pr-8"
            aria-label="Search by column values"
          />
          {filters.searchText && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-0 right-0 h-8 w-8"
              onClick={handleClearSearch}
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Reset Filters Button */}
      {hasActiveFilters && (
        <>
          <Separator orientation="vertical" className="h-6" />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetFilters}
            className="gap-1.5"
            aria-label="Reset all filters"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset</span>
          </Button>
        </>
      )}
    </div>
  );
}

import {
  Filter,
  RotateCcw,
  Search,
  X,
  Plus,
  Minus,
  Edit,
  Database,
  Columns,
  Hash,
  Zap,
  Link,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Toggle } from '@/components/ui/toggle';
import { cn } from '@/lib/utils';
import { useSchemaComparisonStore } from '@/stores';

interface DiffFilterBarProps {
  className?: string;
}

/**
 * Toolbar with filters to show/hide different types of changes.
 * Provides filtering by change type, object type, and text search.
 */
export function DiffFilterBar({ className }: DiffFilterBarProps) {
  const {
    filters,
    setShowOnlyDifferences,
    setChangeTypeFilter,
    setObjectTypeFilter,
    setSearchText,
    resetFilters,
  } = useSchemaComparisonStore();

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
    !filters.changeTypes.added ||
    !filters.changeTypes.removed ||
    !filters.changeTypes.modified ||
    !filters.objectTypes.tables ||
    !filters.objectTypes.columns ||
    !filters.objectTypes.indexes ||
    !filters.objectTypes.triggers ||
    !filters.objectTypes.foreignKeys ||
    filters.searchText.trim() !== '';

  return (
    <div
      className={cn(
        'border-border flex flex-wrap items-center gap-3 rounded-md border bg-muted/30 p-3',
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
        >
          Only Differences
        </Toggle>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Change Type Filters */}
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-xs font-medium">
          Change Type:
        </span>
        <div className="flex gap-1">
          <Toggle
            pressed={filters.changeTypes.added}
            onPressedChange={(pressed) => setChangeTypeFilter('added', pressed)}
            variant="outline"
            size="sm"
            aria-label="Show added items"
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
            <span>Added</span>
          </Toggle>
          <Toggle
            pressed={filters.changeTypes.removed}
            onPressedChange={(pressed) =>
              setChangeTypeFilter('removed', pressed)
            }
            variant="outline"
            size="sm"
            aria-label="Show removed items"
            className="gap-1.5"
          >
            <Minus className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
            <span>Removed</span>
          </Toggle>
          <Toggle
            pressed={filters.changeTypes.modified}
            onPressedChange={(pressed) =>
              setChangeTypeFilter('modified', pressed)
            }
            variant="outline"
            size="sm"
            aria-label="Show modified items"
            className="gap-1.5"
          >
            <Edit className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            <span>Modified</span>
          </Toggle>
        </div>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Object Type Filters */}
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-xs font-medium">
          Show:
        </span>
        <div className="flex gap-1">
          <Toggle
            pressed={filters.objectTypes.tables}
            onPressedChange={(pressed) => setObjectTypeFilter('tables', pressed)}
            variant="outline"
            size="sm"
            aria-label="Show tables"
            className="gap-1.5"
          >
            <Database className="h-3.5 w-3.5" />
            <span>Tables</span>
          </Toggle>
          <Toggle
            pressed={filters.objectTypes.columns}
            onPressedChange={(pressed) =>
              setObjectTypeFilter('columns', pressed)
            }
            variant="outline"
            size="sm"
            aria-label="Show columns"
            className="gap-1.5"
          >
            <Columns className="h-3.5 w-3.5" />
            <span>Columns</span>
          </Toggle>
          <Toggle
            pressed={filters.objectTypes.indexes}
            onPressedChange={(pressed) =>
              setObjectTypeFilter('indexes', pressed)
            }
            variant="outline"
            size="sm"
            aria-label="Show indexes"
            className="gap-1.5"
          >
            <Hash className="h-3.5 w-3.5" />
            <span>Indexes</span>
          </Toggle>
          <Toggle
            pressed={filters.objectTypes.foreignKeys}
            onPressedChange={(pressed) =>
              setObjectTypeFilter('foreignKeys', pressed)
            }
            variant="outline"
            size="sm"
            aria-label="Show foreign keys"
            className="gap-1.5"
          >
            <Link className="h-3.5 w-3.5" />
            <span>FKs</span>
          </Toggle>
          <Toggle
            pressed={filters.objectTypes.triggers}
            onPressedChange={(pressed) =>
              setObjectTypeFilter('triggers', pressed)
            }
            variant="outline"
            size="sm"
            aria-label="Show triggers"
            className="gap-1.5"
          >
            <Zap className="h-3.5 w-3.5" />
            <span>Triggers</span>
          </Toggle>
        </div>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Search Input */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
        <Input
          type="text"
          placeholder="Search by name..."
          value={filters.searchText}
          onChange={handleSearchChange}
          className="h-8 w-full pr-8 pl-8 text-sm"
        />
        {filters.searchText && (
          <button
            type="button"
            onClick={handleClearSearch}
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
            title="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Reset Filters Button */}
      {hasActiveFilters && (
        <>
          <Separator orientation="vertical" className="h-6" />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetFilters}
            className="gap-2"
            title="Reset all filters"
          >
            <RotateCcw className="h-4 w-4" />
            <span className="hidden sm:inline">Reset</span>
          </Button>
        </>
      )}
    </div>
  );
}

import type { SchemaComparisonResult } from '@shared/types';
import { FileQuestion } from 'lucide-react';
import { useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useSchemaComparisonStore } from '@/stores';
import { TableDiffCard } from './TableDiffCard';

interface SchemaDiffViewProps {
  comparisonResult: SchemaComparisonResult;
  className?: string;
}

/**
 * Side-by-side view showing schema differences with visual indicators.
 * Displays tables, columns, indexes, foreign keys, and triggers with
 * color-coded diff indicators (green=added, red=removed, yellow=modified).
 */
export function SchemaDiffView({
  comparisonResult,
  className,
}: SchemaDiffViewProps) {
  const { filters, expandedSections, toggleTableExpanded } =
    useSchemaComparisonStore();

  // Filter tables based on current filters
  const filteredTables = useMemo(() => {
    let tables = comparisonResult.tableDiffs;

    // Filter by show only differences
    if (filters.showOnlyDifferences) {
      tables = tables.filter((t) => t.diffType !== 'unchanged');
    }

    // Filter by change type
    const hasChangeTypeFilter =
      !filters.changeTypes.added ||
      !filters.changeTypes.removed ||
      !filters.changeTypes.modified;

    if (hasChangeTypeFilter) {
      tables = tables.filter((t) => {
        if (t.diffType === 'added') return filters.changeTypes.added;
        if (t.diffType === 'removed') return filters.changeTypes.removed;
        if (t.diffType === 'modified') return filters.changeTypes.modified;
        return true; // unchanged
      });
    }

    // Filter by search text
    if (filters.searchText.trim()) {
      const searchLower = filters.searchText.toLowerCase();
      tables = tables.filter((t) => t.name.toLowerCase().includes(searchLower));
    }

    return tables;
  }, [comparisonResult.tableDiffs, filters]);

  if (filteredTables.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-12', className)}>
        <FileQuestion className="text-muted-foreground mb-4 h-12 w-12 opacity-30" />
        <p className="text-muted-foreground font-medium">No differences found</p>
        <p className="text-muted-foreground text-sm">
          {filters.showOnlyDifferences || filters.searchText
            ? 'Try adjusting your filters'
            : 'The schemas are identical'}
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className={cn('h-full', className)}>
      <div className="space-y-3 p-4">
        {filteredTables.map((tableDiff) => (
          <TableDiffCard
            key={`${tableDiff.schema}.${tableDiff.name}`}
            tableDiff={tableDiff}
            isExpanded={expandedSections.tables.get(tableDiff.name) ?? true}
            onToggle={() => toggleTableExpanded(tableDiff.name)}
            showOnlyDifferences={filters.showOnlyDifferences}
            showColumns={filters.objectTypes.columns}
            showIndexes={filters.objectTypes.indexes}
            showForeignKeys={filters.objectTypes.foreignKeys}
            showTriggers={filters.objectTypes.triggers}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

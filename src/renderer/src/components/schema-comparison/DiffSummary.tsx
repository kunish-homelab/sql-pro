import type {
  DiffType,
  SchemaComparisonResult,
} from '../../../../shared/types';
import {
  ChevronDown,
  ChevronUp,
  Columns,
  Database,
  Edit,
  Hash,
  Link,
  Minus,
  Plus,
  Zap,
} from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useSchemaComparisonStore } from '@/stores';

interface DiffSummaryProps {
  comparisonResult: SchemaComparisonResult;
  className?: string;
}

interface DiffCounts {
  added: number;
  removed: number;
  modified: number;
}

/**
 * Summary panel showing counts of each type of difference.
 * Provides an overview of schema changes and allows filtering by clicking sections.
 */
export function DiffSummary({ comparisonResult, className }: DiffSummaryProps) {
  const {
    expandedSections,
    toggleSummaryExpanded,
    setObjectTypeFilter,
    setChangeTypeFilter,
    resetFilters,
  } = useSchemaComparisonStore();

  // Calculate detailed counts from tableDiffs
  const counts = useMemo(() => {
    const result = {
      tables: {
        added: comparisonResult.summary.tablesAdded,
        removed: comparisonResult.summary.tablesRemoved,
        modified: comparisonResult.summary.tablesModified,
      },
      columns: { added: 0, removed: 0, modified: 0 },
      indexes: { added: 0, removed: 0, modified: 0 },
      foreignKeys: { added: 0, removed: 0, modified: 0 },
      triggers: { added: 0, removed: 0, modified: 0 },
    };

    // Iterate through table diffs to count column, index, FK, and trigger changes
    comparisonResult.tableDiffs.forEach((tableDiff) => {
      // Count column changes
      tableDiff.columnDiffs?.forEach((colDiff) => {
        if (colDiff.diffType === 'added') result.columns.added++;
        else if (colDiff.diffType === 'removed') result.columns.removed++;
        else if (colDiff.diffType === 'modified') result.columns.modified++;
      });

      // Count index changes
      tableDiff.indexDiffs?.forEach((indexDiff) => {
        if (indexDiff.diffType === 'added') result.indexes.added++;
        else if (indexDiff.diffType === 'removed') result.indexes.removed++;
        else if (indexDiff.diffType === 'modified') result.indexes.modified++;
      });

      // Count foreign key changes
      tableDiff.foreignKeyDiffs?.forEach((fkDiff) => {
        if (fkDiff.diffType === 'added') result.foreignKeys.added++;
        else if (fkDiff.diffType === 'removed') result.foreignKeys.removed++;
        else if (fkDiff.diffType === 'modified') result.foreignKeys.modified++;
      });

      // Count trigger changes
      tableDiff.triggerDiffs?.forEach((triggerDiff) => {
        if (triggerDiff.diffType === 'added') result.triggers.added++;
        else if (triggerDiff.diffType === 'removed') result.triggers.removed++;
        else if (triggerDiff.diffType === 'modified')
          result.triggers.modified++;
      });
    });

    return result;
  }, [comparisonResult]);

  const handleSectionClick = (
    objectType: 'tables' | 'columns' | 'indexes' | 'foreignKeys' | 'triggers',
    changeType: DiffType
  ) => {
    // Reset filters first
    resetFilters();

    // Apply the specific filter
    setObjectTypeFilter(objectType, true);
    setChangeTypeFilter(changeType as 'added' | 'removed' | 'modified', true);

    // Disable other filters
    const allObjectTypes: Array<
      'tables' | 'columns' | 'indexes' | 'foreignKeys' | 'triggers'
    > = ['tables', 'columns', 'indexes', 'foreignKeys', 'triggers'];
    const allChangeTypes: Array<'added' | 'removed' | 'modified'> = [
      'added',
      'removed',
      'modified',
    ];

    allObjectTypes.forEach((type) => {
      if (type !== objectType) setObjectTypeFilter(type, false);
    });

    allChangeTypes.forEach((type) => {
      if (type !== changeType) setChangeTypeFilter(type, false);
    });
  };

  const isExpanded = expandedSections.summary;

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader
        className="cursor-pointer pb-3"
        onClick={toggleSummaryExpanded}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Summary</CardTitle>
          {isExpanded ? (
            <ChevronUp className="text-muted-foreground h-4 w-4" />
          ) : (
            <ChevronDown className="text-muted-foreground h-4 w-4" />
          )}
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4 pt-0">
          {/* Tables */}
          <SummarySection
            icon={Database}
            title="Tables"
            counts={counts.tables}
            onClickCount={(changeType) =>
              handleSectionClick('tables', changeType)
            }
          />

          {/* Columns */}
          <SummarySection
            icon={Columns}
            title="Columns"
            counts={counts.columns}
            onClickCount={(changeType) =>
              handleSectionClick('columns', changeType)
            }
          />

          {/* Indexes */}
          <SummarySection
            icon={Hash}
            title="Indexes"
            counts={counts.indexes}
            onClickCount={(changeType) =>
              handleSectionClick('indexes', changeType)
            }
          />

          {/* Foreign Keys */}
          <SummarySection
            icon={Link}
            title="Foreign Keys"
            counts={counts.foreignKeys}
            onClickCount={(changeType) =>
              handleSectionClick('foreignKeys', changeType)
            }
          />

          {/* Triggers */}
          <SummarySection
            icon={Zap}
            title="Triggers"
            counts={counts.triggers}
            onClickCount={(changeType) =>
              handleSectionClick('triggers', changeType)
            }
          />
        </CardContent>
      )}
    </Card>
  );
}

interface SummarySectionProps {
  icon: React.ElementType;
  title: string;
  counts: DiffCounts;
  onClickCount: (changeType: DiffType) => void;
}

function SummarySection({
  icon: Icon,
  title,
  counts,
  onClickCount,
}: SummarySectionProps) {
  const total = counts.added + counts.removed + counts.modified;

  // Don't render if no changes
  if (total === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="text-muted-foreground h-4 w-4" />
        <span className="text-sm font-medium">{title}</span>
        <span className="text-muted-foreground text-xs">({total} changes)</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {/* Added */}
        {counts.added > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onClickCount('added')}
            className="h-auto flex-col items-start gap-1 p-2 hover:bg-green-100 dark:hover:bg-green-950"
            title={`Filter to show ${counts.added} added ${title.toLowerCase()}`}
          >
            <div className="flex items-center gap-1.5 text-green-700 dark:text-green-300">
              <Plus className="h-3.5 w-3.5" />
              <span className="text-xs">Added</span>
            </div>
            <span className="text-foreground text-lg font-semibold">
              {counts.added}
            </span>
          </Button>
        )}

        {/* Removed */}
        {counts.removed > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onClickCount('removed')}
            className="h-auto flex-col items-start gap-1 p-2 hover:bg-red-100 dark:hover:bg-red-950"
            title={`Filter to show ${counts.removed} removed ${title.toLowerCase()}`}
          >
            <div className="flex items-center gap-1.5 text-red-700 dark:text-red-300">
              <Minus className="h-3.5 w-3.5" />
              <span className="text-xs">Removed</span>
            </div>
            <span className="text-foreground text-lg font-semibold">
              {counts.removed}
            </span>
          </Button>
        )}

        {/* Modified */}
        {counts.modified > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onClickCount('modified')}
            className="h-auto flex-col items-start gap-1 p-2 hover:bg-amber-100 dark:hover:bg-amber-950"
            title={`Filter to show ${counts.modified} modified ${title.toLowerCase()}`}
          >
            <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
              <Edit className="h-3.5 w-3.5" />
              <span className="text-xs">Modified</span>
            </div>
            <span className="text-foreground text-lg font-semibold">
              {counts.modified}
            </span>
          </Button>
        )}
      </div>
    </div>
  );
}

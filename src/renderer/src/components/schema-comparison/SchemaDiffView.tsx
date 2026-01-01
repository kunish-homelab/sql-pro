import type {
  ColumnDiff,
  ForeignKeyDiff,
  IndexDiff,
  SchemaComparisonResult,
  TableDiff,
  TriggerDiff,
} from '@shared/types';
import {
  ChevronDown,
  ChevronRight,
  Columns3,
  FileQuestion,
  Key,
  Link2,
  Minus,
  Plus,
  Table,
  Zap,
} from 'lucide-react';
import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useSchemaComparisonStore, type DiffFilters } from '@/stores';

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
          <TableDiffItem
            key={`${tableDiff.schema}.${tableDiff.name}`}
            tableDiff={tableDiff}
            isExpanded={expandedSections.tables.get(tableDiff.name) ?? true}
            onToggle={() => toggleTableExpanded(tableDiff.name)}
            filters={filters}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

interface TableDiffItemProps {
  tableDiff: TableDiff;
  isExpanded: boolean;
  onToggle: () => void;
  filters: DiffFilters;
}

function TableDiffItem({
  tableDiff,
  isExpanded,
  onToggle,
  filters,
}: TableDiffItemProps) {
  const { diffType, name, schema } = tableDiff;

  // Get styling based on diff type
  const getDiffStyle = () => {
    switch (diffType) {
      case 'added':
        return {
          bg: 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950',
          icon: <Plus className="h-4 w-4 text-green-600 dark:text-green-400" />,
          badge: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
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
          icon: <Table className="h-4 w-4 text-amber-600 dark:text-amber-400" />,
          badge:
            'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
          label: 'Modified',
        };
      case 'unchanged':
        return {
          bg: 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950',
          icon: <Table className="h-4 w-4 text-gray-600 dark:text-gray-400" />,
          badge: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
          label: 'Unchanged',
        };
    }
  };

  const style = getDiffStyle();

  // Count different types of changes for modified tables
  const changeCounts = useMemo(() => {
    if (diffType !== 'modified') return null;

    return {
      columns:
        (tableDiff.columnDiffs?.filter((d) => d.diffType !== 'unchanged')
          .length ?? 0),
      indexes:
        (tableDiff.indexDiffs?.filter((d) => d.diffType !== 'unchanged')
          .length ?? 0),
      foreignKeys:
        (tableDiff.foreignKeyDiffs?.filter((d) => d.diffType !== 'unchanged')
          .length ?? 0),
      triggers:
        (tableDiff.triggerDiffs?.filter((d) => d.diffType !== 'unchanged')
          .length ?? 0),
    };
  }, [tableDiff, diffType]);

  return (
    <Card className={cn('overflow-hidden', style.bg)}>
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
            {name}
            <span className="text-muted-foreground ml-2 text-sm font-normal">
              {schema}
            </span>
          </CardTitle>
          <Badge variant="secondary" className={cn('text-xs', style.badge)}>
            {style.label}
          </Badge>
          {changeCounts && (
            <div className="flex items-center gap-2 text-xs">
              {changeCounts.columns > 0 && (
                <span className="text-muted-foreground">
                  {changeCounts.columns} col
                </span>
              )}
              {changeCounts.indexes > 0 && (
                <span className="text-muted-foreground">
                  {changeCounts.indexes} idx
                </span>
              )}
              {changeCounts.foreignKeys > 0 && (
                <span className="text-muted-foreground">
                  {changeCounts.foreignKeys} fk
                </span>
              )}
              {changeCounts.triggers > 0 && (
                <span className="text-muted-foreground">
                  {changeCounts.triggers} trg
                </span>
              )}
            </div>
          )}
        </div>
      </CardHeader>

      {/* Details */}
      {isExpanded && (
        <CardContent className="space-y-4 border-t p-4">
          {/* Side-by-side panels for source and target */}
          {diffType === 'modified' && (
            <>
              {/* Column Differences */}
              {tableDiff.columnDiffs && tableDiff.columnDiffs.length > 0 && (
                <DiffSection
                  title="Columns"
                  icon={<Columns3 className="h-4 w-4" />}
                  count={tableDiff.columnDiffs.length}
                  showSection={filters.objectTypes.columns}
                >
                  <ColumnDiffList
                    columnDiffs={tableDiff.columnDiffs}
                    showOnlyDifferences={filters.showOnlyDifferences}
                  />
                </DiffSection>
              )}

              {/* Index Differences */}
              {tableDiff.indexDiffs && tableDiff.indexDiffs.length > 0 && (
                <DiffSection
                  title="Indexes"
                  icon={<Key className="h-4 w-4" />}
                  count={tableDiff.indexDiffs.length}
                  showSection={filters.objectTypes.indexes}
                >
                  <IndexDiffList
                    indexDiffs={tableDiff.indexDiffs}
                    showOnlyDifferences={filters.showOnlyDifferences}
                  />
                </DiffSection>
              )}

              {/* Foreign Key Differences */}
              {tableDiff.foreignKeyDiffs &&
                tableDiff.foreignKeyDiffs.length > 0 && (
                  <DiffSection
                    title="Foreign Keys"
                    icon={<Link2 className="h-4 w-4" />}
                    count={tableDiff.foreignKeyDiffs.length}
                    showSection={filters.objectTypes.foreignKeys}
                  >
                    <ForeignKeyDiffList
                      foreignKeyDiffs={tableDiff.foreignKeyDiffs}
                      showOnlyDifferences={filters.showOnlyDifferences}
                    />
                  </DiffSection>
                )}

              {/* Trigger Differences */}
              {tableDiff.triggerDiffs && tableDiff.triggerDiffs.length > 0 && (
                <DiffSection
                  title="Triggers"
                  icon={<Zap className="h-4 w-4" />}
                  count={tableDiff.triggerDiffs.length}
                  showSection={filters.objectTypes.triggers}
                >
                  <TriggerDiffList
                    triggerDiffs={tableDiff.triggerDiffs}
                    showOnlyDifferences={filters.showOnlyDifferences}
                  />
                </DiffSection>
              )}
            </>
          )}

          {/* For added/removed tables, show the full structure */}
          {diffType === 'added' && tableDiff.target && (
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                Table added in target with {tableDiff.target.columns.length}{' '}
                column(s)
              </p>
              {tableDiff.target.columns.length > 0 && (
                <div className="bg-background/50 rounded border p-2">
                  <div className="space-y-1">
                    {tableDiff.target.columns.map((col) => (
                      <div
                        key={col.name}
                        className="flex items-center gap-2 text-xs"
                      >
                        <Columns3 className="text-muted-foreground h-3 w-3" />
                        <span className="font-medium">{col.name}</span>
                        <span className="text-muted-foreground">{col.type}</span>
                        {col.isPrimaryKey && (
                          <Badge variant="outline" className="text-[10px]">
                            PK
                          </Badge>
                        )}
                        {!col.nullable && (
                          <Badge variant="outline" className="text-[10px]">
                            NOT NULL
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {diffType === 'removed' && tableDiff.source && (
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                Table removed from source with {tableDiff.source.columns.length}{' '}
                column(s)
              </p>
              {tableDiff.source.columns.length > 0 && (
                <div className="bg-background/50 rounded border p-2">
                  <div className="space-y-1">
                    {tableDiff.source.columns.map((col) => (
                      <div
                        key={col.name}
                        className="flex items-center gap-2 text-xs opacity-60 line-through"
                      >
                        <Columns3 className="text-muted-foreground h-3 w-3" />
                        <span className="font-medium">{col.name}</span>
                        <span className="text-muted-foreground">{col.type}</span>
                        {col.isPrimaryKey && (
                          <Badge variant="outline" className="text-[10px]">
                            PK
                          </Badge>
                        )}
                        {!col.nullable && (
                          <Badge variant="outline" className="text-[10px]">
                            NOT NULL
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {diffType === 'unchanged' && (
            <p className="text-muted-foreground text-sm">
              No differences detected
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}

interface DiffSectionProps {
  title: string;
  icon: React.ReactNode;
  count: number;
  children: React.ReactNode;
  showSection: boolean;
}

function DiffSection({
  title,
  icon,
  count,
  children,
  showSection,
}: DiffSectionProps) {
  if (!showSection) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        {icon}
        <span>
          {title} <span className="text-muted-foreground">({count})</span>
        </span>
      </div>
      {children}
    </div>
  );
}

interface ColumnDiffListProps {
  columnDiffs: ColumnDiff[];
  showOnlyDifferences: boolean;
}

function ColumnDiffList({
  columnDiffs,
  showOnlyDifferences,
}: ColumnDiffListProps) {
  const filteredDiffs = showOnlyDifferences
    ? columnDiffs.filter((d) => d.diffType !== 'unchanged')
    : columnDiffs;

  if (filteredDiffs.length === 0) {
    return (
      <p className="text-muted-foreground text-xs italic">No differences</p>
    );
  }

  return (
    <div className="bg-background/50 space-y-1 rounded border p-2">
      {filteredDiffs.map((diff) => (
        <ColumnDiffRow key={diff.name} diff={diff} />
      ))}
    </div>
  );
}

function ColumnDiffRow({ diff }: { diff: ColumnDiff }) {
  const getIcon = () => {
    switch (diff.diffType) {
      case 'added':
        return <Plus className="h-3 w-3 text-green-600 dark:text-green-400" />;
      case 'removed':
        return <Minus className="h-3 w-3 text-red-600 dark:text-red-400" />;
      case 'modified':
        return (
          <Columns3 className="h-3 w-3 text-amber-600 dark:text-amber-400" />
        );
      case 'unchanged':
        return <Columns3 className="text-muted-foreground h-3 w-3" />;
    }
  };

  const getTextColor = () => {
    switch (diff.diffType) {
      case 'added':
        return 'text-green-700 dark:text-green-300';
      case 'removed':
        return 'text-red-700 dark:text-red-300 line-through opacity-60';
      case 'modified':
        return 'text-amber-700 dark:text-amber-300';
      case 'unchanged':
        return 'text-muted-foreground';
    }
  };

  return (
    <div className="flex flex-col gap-1 text-xs">
      <div className={cn('flex items-center gap-2', getTextColor())}>
        {getIcon()}
        <span className="font-medium">{diff.name}</span>
        <span className="text-muted-foreground">
          {diff.target?.type || diff.source?.type}
        </span>
        {diff.target?.isPrimaryKey && (
          <Badge variant="outline" className="text-[10px]">
            PK
          </Badge>
        )}
        {diff.target && !diff.target.nullable && (
          <Badge variant="outline" className="text-[10px]">
            NOT NULL
          </Badge>
        )}
      </div>

      {/* Show specific changes for modified columns */}
      {diff.diffType === 'modified' && diff.changes && (
        <div className="text-muted-foreground ml-5 space-y-0.5 text-[10px]">
          {diff.changes.type && (
            <div>
              Type: <span className="line-through">{diff.changes.type.from}</span>{' '}
              → {diff.changes.type.to}
            </div>
          )}
          {diff.changes.nullable && (
            <div>
              Nullable:{' '}
              <span className="line-through">
                {diff.changes.nullable.from ? 'Yes' : 'No'}
              </span>{' '}
              → {diff.changes.nullable.to ? 'Yes' : 'No'}
            </div>
          )}
          {diff.changes.defaultValue && (
            <div>
              Default:{' '}
              <span className="line-through">
                {diff.changes.defaultValue.from || 'None'}
              </span>{' '}
              → {diff.changes.defaultValue.to || 'None'}
            </div>
          )}
          {diff.changes.isPrimaryKey && (
            <div>
              Primary Key:{' '}
              <span className="line-through">
                {diff.changes.isPrimaryKey.from ? 'Yes' : 'No'}
              </span>{' '}
              → {diff.changes.isPrimaryKey.to ? 'Yes' : 'No'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface IndexDiffListProps {
  indexDiffs: IndexDiff[];
  showOnlyDifferences: boolean;
}

function IndexDiffList({
  indexDiffs,
  showOnlyDifferences,
}: IndexDiffListProps) {
  const filteredDiffs = showOnlyDifferences
    ? indexDiffs.filter((d) => d.diffType !== 'unchanged')
    : indexDiffs;

  if (filteredDiffs.length === 0) {
    return (
      <p className="text-muted-foreground text-xs italic">No differences</p>
    );
  }

  return (
    <div className="bg-background/50 space-y-1 rounded border p-2">
      {filteredDiffs.map((diff) => (
        <IndexDiffRow key={diff.name} diff={diff} />
      ))}
    </div>
  );
}

function IndexDiffRow({ diff }: { diff: IndexDiff }) {
  const getIcon = () => {
    switch (diff.diffType) {
      case 'added':
        return <Plus className="h-3 w-3 text-green-600 dark:text-green-400" />;
      case 'removed':
        return <Minus className="h-3 w-3 text-red-600 dark:text-red-400" />;
      case 'modified':
        return <Key className="h-3 w-3 text-amber-600 dark:text-amber-400" />;
      case 'unchanged':
        return <Key className="text-muted-foreground h-3 w-3" />;
    }
  };

  const getTextColor = () => {
    switch (diff.diffType) {
      case 'added':
        return 'text-green-700 dark:text-green-300';
      case 'removed':
        return 'text-red-700 dark:text-red-300 line-through opacity-60';
      case 'modified':
        return 'text-amber-700 dark:text-amber-300';
      case 'unchanged':
        return 'text-muted-foreground';
    }
  };

  const index = diff.target || diff.source;

  return (
    <div className="flex flex-col gap-1 text-xs">
      <div className={cn('flex items-center gap-2', getTextColor())}>
        {getIcon()}
        <span className="font-medium">{diff.name}</span>
        <span className="text-muted-foreground">
          ({index?.columns.join(', ')})
        </span>
        {index?.unique && (
          <Badge variant="outline" className="text-[10px]">
            UNIQUE
          </Badge>
        )}
      </div>

      {/* Show specific changes for modified indexes */}
      {diff.diffType === 'modified' && diff.changes && (
        <div className="text-muted-foreground ml-5 space-y-0.5 text-[10px]">
          {diff.changes.columns && (
            <div>
              Columns:{' '}
              <span className="line-through">
                {diff.changes.columns.from.join(', ')}
              </span>{' '}
              → {diff.changes.columns.to.join(', ')}
            </div>
          )}
          {diff.changes.unique && (
            <div>
              Unique:{' '}
              <span className="line-through">
                {diff.changes.unique.from ? 'Yes' : 'No'}
              </span>{' '}
              → {diff.changes.unique.to ? 'Yes' : 'No'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ForeignKeyDiffListProps {
  foreignKeyDiffs: ForeignKeyDiff[];
  showOnlyDifferences: boolean;
}

function ForeignKeyDiffList({
  foreignKeyDiffs,
  showOnlyDifferences,
}: ForeignKeyDiffListProps) {
  const filteredDiffs = showOnlyDifferences
    ? foreignKeyDiffs.filter((d) => d.diffType !== 'unchanged')
    : foreignKeyDiffs;

  if (filteredDiffs.length === 0) {
    return (
      <p className="text-muted-foreground text-xs italic">No differences</p>
    );
  }

  return (
    <div className="bg-background/50 space-y-1 rounded border p-2">
      {filteredDiffs.map((diff, idx) => (
        <ForeignKeyDiffRow key={`${diff.table}-${idx}`} diff={diff} />
      ))}
    </div>
  );
}

function ForeignKeyDiffRow({ diff }: { diff: ForeignKeyDiff }) {
  const getIcon = () => {
    switch (diff.diffType) {
      case 'added':
        return <Plus className="h-3 w-3 text-green-600 dark:text-green-400" />;
      case 'removed':
        return <Minus className="h-3 w-3 text-red-600 dark:text-red-400" />;
      case 'modified':
        return <Link2 className="h-3 w-3 text-amber-600 dark:text-amber-400" />;
      case 'unchanged':
        return <Link2 className="text-muted-foreground h-3 w-3" />;
    }
  };

  const getTextColor = () => {
    switch (diff.diffType) {
      case 'added':
        return 'text-green-700 dark:text-green-300';
      case 'removed':
        return 'text-red-700 dark:text-red-300 line-through opacity-60';
      case 'modified':
        return 'text-amber-700 dark:text-amber-300';
      case 'unchanged':
        return 'text-muted-foreground';
    }
  };

  const fk = diff.target || diff.source;

  return (
    <div className="flex flex-col gap-1 text-xs">
      <div className={cn('flex items-center gap-2', getTextColor())}>
        {getIcon()}
        <span className="font-medium">{fk?.column}</span>
        <span className="text-muted-foreground">
          → {fk?.referencedTable}.{fk?.referencedColumn}
        </span>
      </div>

      {/* Show specific changes for modified foreign keys */}
      {diff.diffType === 'modified' && diff.changes && (
        <div className="text-muted-foreground ml-5 space-y-0.5 text-[10px]">
          {diff.changes.referencedTable && (
            <div>
              Referenced Table:{' '}
              <span className="line-through">
                {diff.changes.referencedTable.from}
              </span>{' '}
              → {diff.changes.referencedTable.to}
            </div>
          )}
          {diff.changes.referencedColumn && (
            <div>
              Referenced Column:{' '}
              <span className="line-through">
                {diff.changes.referencedColumn.from}
              </span>{' '}
              → {diff.changes.referencedColumn.to}
            </div>
          )}
          {diff.changes.onDelete && (
            <div>
              On Delete:{' '}
              <span className="line-through">{diff.changes.onDelete.from}</span>{' '}
              → {diff.changes.onDelete.to}
            </div>
          )}
          {diff.changes.onUpdate && (
            <div>
              On Update:{' '}
              <span className="line-through">{diff.changes.onUpdate.from}</span>{' '}
              → {diff.changes.onUpdate.to}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface TriggerDiffListProps {
  triggerDiffs: TriggerDiff[];
  showOnlyDifferences: boolean;
}

function TriggerDiffList({
  triggerDiffs,
  showOnlyDifferences,
}: TriggerDiffListProps) {
  const filteredDiffs = showOnlyDifferences
    ? triggerDiffs.filter((d) => d.diffType !== 'unchanged')
    : triggerDiffs;

  if (filteredDiffs.length === 0) {
    return (
      <p className="text-muted-foreground text-xs italic">No differences</p>
    );
  }

  return (
    <div className="bg-background/50 space-y-1 rounded border p-2">
      {filteredDiffs.map((diff) => (
        <TriggerDiffRow key={diff.name} diff={diff} />
      ))}
    </div>
  );
}

function TriggerDiffRow({ diff }: { diff: TriggerDiff }) {
  const getIcon = () => {
    switch (diff.diffType) {
      case 'added':
        return <Plus className="h-3 w-3 text-green-600 dark:text-green-400" />;
      case 'removed':
        return <Minus className="h-3 w-3 text-red-600 dark:text-red-400" />;
      case 'modified':
        return <Zap className="h-3 w-3 text-amber-600 dark:text-amber-400" />;
      case 'unchanged':
        return <Zap className="text-muted-foreground h-3 w-3" />;
    }
  };

  const getTextColor = () => {
    switch (diff.diffType) {
      case 'added':
        return 'text-green-700 dark:text-green-300';
      case 'removed':
        return 'text-red-700 dark:text-red-300 line-through opacity-60';
      case 'modified':
        return 'text-amber-700 dark:text-amber-300';
      case 'unchanged':
        return 'text-muted-foreground';
    }
  };

  const trigger = diff.target || diff.source;

  return (
    <div className="flex flex-col gap-1 text-xs">
      <div className={cn('flex items-center gap-2', getTextColor())}>
        {getIcon()}
        <span className="font-medium">{diff.name}</span>
        <span className="text-muted-foreground">
          {trigger?.timing} {trigger?.event}
        </span>
      </div>

      {/* Show specific changes for modified triggers */}
      {diff.diffType === 'modified' && diff.changes && (
        <div className="text-muted-foreground ml-5 space-y-0.5 text-[10px]">
          {diff.changes.timing && (
            <div>
              Timing:{' '}
              <span className="line-through">{diff.changes.timing.from}</span> →{' '}
              {diff.changes.timing.to}
            </div>
          )}
          {diff.changes.event && (
            <div>
              Event:{' '}
              <span className="line-through">{diff.changes.event.from}</span> →{' '}
              {diff.changes.event.to}
            </div>
          )}
          {diff.changes.sql && (
            <div>SQL definition changed</div>
          )}
        </div>
      )}
    </div>
  );
}

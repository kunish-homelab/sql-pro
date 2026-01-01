import type {
  ColumnDiff,
  ForeignKeyDiff,
  IndexDiff,
  TableDiff,
  TriggerDiff,
} from '@shared/types';
import {
  ChevronDown,
  ChevronRight,
  Columns3,
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
import { cn } from '@/lib/utils';

interface TableDiffCardProps {
  tableDiff: TableDiff;
  isExpanded: boolean;
  onToggle: () => void;
  showOnlyDifferences?: boolean;
  showColumns?: boolean;
  showIndexes?: boolean;
  showForeignKeys?: boolean;
  showTriggers?: boolean;
  className?: string;
}

/**
 * Card component showing differences for a single table.
 * Displays table status (added/removed/modified/unchanged) and can be
 * expanded to show column-level diffs, index differences, trigger differences,
 * and foreign key differences.
 */
export function TableDiffCard({
  tableDiff,
  isExpanded,
  onToggle,
  showOnlyDifferences = false,
  showColumns = true,
  showIndexes = true,
  showForeignKeys = true,
  showTriggers = true,
  className,
}: TableDiffCardProps) {
  const { diffType, name, schema } = tableDiff;

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

  // Count different types of changes for modified tables
  const changeCounts = useMemo(() => {
    if (diffType !== 'modified') return null;

    return {
      columns:
        tableDiff.columnDiffs?.filter((d) => d.diffType !== 'unchanged')
          .length ?? 0,
      indexes:
        tableDiff.indexDiffs?.filter((d) => d.diffType !== 'unchanged')
          .length ?? 0,
      foreignKeys:
        tableDiff.foreignKeyDiffs?.filter((d) => d.diffType !== 'unchanged')
          .length ?? 0,
      triggers:
        tableDiff.triggerDiffs?.filter((d) => d.diffType !== 'unchanged')
          .length ?? 0,
    };
  }, [tableDiff, diffType]);

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
          {/* Modified tables show detailed diffs */}
          {diffType === 'modified' && (
            <>
              {/* Column Differences */}
              {showColumns &&
                tableDiff.columnDiffs &&
                tableDiff.columnDiffs.length > 0 && (
                  <DiffSection
                    title="Columns"
                    icon={<Columns3 className="h-4 w-4" />}
                    count={tableDiff.columnDiffs.length}
                  >
                    <ColumnDiffList
                      columnDiffs={tableDiff.columnDiffs}
                      showOnlyDifferences={showOnlyDifferences}
                    />
                  </DiffSection>
                )}

              {/* Index Differences */}
              {showIndexes &&
                tableDiff.indexDiffs &&
                tableDiff.indexDiffs.length > 0 && (
                  <DiffSection
                    title="Indexes"
                    icon={<Key className="h-4 w-4" />}
                    count={tableDiff.indexDiffs.length}
                  >
                    <IndexDiffList
                      indexDiffs={tableDiff.indexDiffs}
                      showOnlyDifferences={showOnlyDifferences}
                    />
                  </DiffSection>
                )}

              {/* Foreign Key Differences */}
              {showForeignKeys &&
                tableDiff.foreignKeyDiffs &&
                tableDiff.foreignKeyDiffs.length > 0 && (
                  <DiffSection
                    title="Foreign Keys"
                    icon={<Link2 className="h-4 w-4" />}
                    count={tableDiff.foreignKeyDiffs.length}
                  >
                    <ForeignKeyDiffList
                      foreignKeyDiffs={tableDiff.foreignKeyDiffs}
                      showOnlyDifferences={showOnlyDifferences}
                    />
                  </DiffSection>
                )}

              {/* Trigger Differences */}
              {showTriggers &&
                tableDiff.triggerDiffs &&
                tableDiff.triggerDiffs.length > 0 && (
                  <DiffSection
                    title="Triggers"
                    icon={<Zap className="h-4 w-4" />}
                    count={tableDiff.triggerDiffs.length}
                  >
                    <TriggerDiffList
                      triggerDiffs={tableDiff.triggerDiffs}
                      showOnlyDifferences={showOnlyDifferences}
                    />
                  </DiffSection>
                )}
            </>
          )}

          {/* For added tables, show the full structure */}
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
                        <span className="text-muted-foreground">
                          {col.type}
                        </span>
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

          {/* For removed tables, show the full structure */}
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
                        className="flex items-center gap-2 text-xs line-through opacity-60"
                      >
                        <Columns3 className="text-muted-foreground h-3 w-3" />
                        <span className="font-medium">{col.name}</span>
                        <span className="text-muted-foreground">
                          {col.type}
                        </span>
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

          {/* Unchanged tables */}
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
}

function DiffSection({ title, icon, count, children }: DiffSectionProps) {
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
              Type:{' '}
              <span className="line-through">{diff.changes.type.from}</span> →{' '}
              {diff.changes.type.to}
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
          {diff.changes.isUnique && (
            <div>
              Unique:{' '}
              <span className="line-through">
                {diff.changes.isUnique.from ? 'Yes' : 'No'}
              </span>{' '}
              → {diff.changes.isUnique.to ? 'Yes' : 'No'}
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
        <ForeignKeyDiffRow key={`${diff.column}-${idx}`} diff={diff} />
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
          {diff.changes.sql && <div>SQL definition changed</div>}
        </div>
      )}
    </div>
  );
}

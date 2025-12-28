import type {
  ColumnSchema,
  ForeignKeySchema,
  IndexSchema,
  TableSchema,
  TriggerSchema,
} from '@/types/database';
import {
  ChevronDown,
  ChevronRight,
  Code,
  Columns3,
  Eye,
  Key,
  Link2,
  Table,
  X,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface SchemaDetailsPanelProps {
  table: TableSchema | null;
  onClose: () => void;
}

type SectionKey = 'columns' | 'indexes' | 'foreignKeys' | 'triggers' | 'sql';

export function SchemaDetailsPanel({
  table,
  onClose,
}: SchemaDetailsPanelProps) {
  const [expandedSections, setExpandedSections] = useState<
    Record<SectionKey, boolean>
  >({
    columns: true,
    indexes: true,
    foreignKeys: true,
    triggers: true,
    sql: true,
  });

  const toggleSection = (key: SectionKey) => {
    setExpandedSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  if (!table) {
    return (
      <div className="bg-background flex h-full w-full flex-col overflow-hidden border-l">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-semibold">Schema Details</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
          Select a table or view to see details
        </div>
      </div>
    );
  }

  const isView = table.type === 'view';

  return (
    <div className="bg-background flex h-full w-full flex-col overflow-hidden border-l">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          {isView ? (
            <Eye className="text-muted-foreground h-4 w-4" />
          ) : (
            <Table className="text-muted-foreground h-4 w-4" />
          )}
          <div>
            <h2 className="font-semibold">{table.name}</h2>
            <p className="text-muted-foreground text-sm">
              {isView ? 'View' : 'Table'} in {table.schema}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="space-y-4 p-4">
          {/* Columns Section */}
          <Section
            title="Columns"
            icon={<Columns3 className="h-4 w-4" />}
            count={table.columns.length}
            isExpanded={expandedSections.columns}
            onToggle={() => toggleSection('columns')}
          >
            <ColumnsTable
              columns={table.columns}
              primaryKey={table.primaryKey}
            />
          </Section>

          {/* Indexes Section */}
          {table.indexes.length > 0 && (
            <Section
              title="Indexes"
              icon={<Key className="h-4 w-4" />}
              count={table.indexes.length}
              isExpanded={expandedSections.indexes}
              onToggle={() => toggleSection('indexes')}
            >
              <IndexesList indexes={table.indexes} />
            </Section>
          )}

          {/* Foreign Keys Section */}
          {table.foreignKeys.length > 0 && (
            <Section
              title="Foreign Keys"
              icon={<Link2 className="h-4 w-4" />}
              count={table.foreignKeys.length}
              isExpanded={expandedSections.foreignKeys}
              onToggle={() => toggleSection('foreignKeys')}
            >
              <ForeignKeysList foreignKeys={table.foreignKeys} />
            </Section>
          )}

          {/* Triggers Section (only for tables, not views) */}
          {!isView && table.triggers.length > 0 && (
            <Section
              title="Triggers"
              icon={<Zap className="h-4 w-4" />}
              count={table.triggers.length}
              isExpanded={expandedSections.triggers}
              onToggle={() => toggleSection('triggers')}
            >
              <TriggersList triggers={table.triggers} />
            </Section>
          )}

          {/* CREATE Statement Section */}
          {table.sql && (
            <Section
              title="CREATE Statement"
              icon={<Code className="h-4 w-4" />}
              isExpanded={expandedSections.sql}
              onToggle={() => toggleSection('sql')}
            >
              <SqlBlock sql={table.sql} />
            </Section>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  count?: number;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function Section({
  title,
  icon,
  count,
  isExpanded,
  onToggle,
  children,
}: SectionProps) {
  return (
    <div className="bg-muted/30 rounded-lg border">
      <button
        onClick={onToggle}
        className="hover:bg-accent/50 flex w-full items-center gap-2 rounded-t-lg px-3 py-2 text-sm font-medium transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        {icon}
        <span>{title}</span>
        {count !== undefined && (
          <span className="text-muted-foreground ml-auto text-xs">
            ({count})
          </span>
        )}
      </button>
      {isExpanded && <div className="border-t px-3 py-2">{children}</div>}
    </div>
  );
}

interface ColumnsTableProps {
  columns: ColumnSchema[];
  primaryKey: string[];
}

function ColumnsTable({ columns, primaryKey }: ColumnsTableProps) {
  if (columns.length === 0) {
    return (
      <div className="text-muted-foreground py-2 text-sm">
        No columns defined
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted-foreground border-b text-left">
            <th className="pr-4 pb-2 font-medium">Name</th>
            <th className="pr-4 pb-2 font-medium">Type</th>
            <th className="pr-4 pb-2 font-medium">Nullable</th>
            <th className="pr-4 pb-2 font-medium">Default</th>
            <th className="pb-2 font-medium">Key</th>
          </tr>
        </thead>
        <tbody>
          {columns.map((column) => {
            const isPK =
              primaryKey.includes(column.name) || column.isPrimaryKey;
            return (
              <tr key={column.name} className="border-b last:border-0">
                <td className="py-2 pr-4 font-mono text-xs">{column.name}</td>
                <td className="py-2 pr-4">
                  <span className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
                    {column.type}
                  </span>
                </td>
                <td className="py-2 pr-4">
                  <span
                    className={cn(
                      'text-xs',
                      column.nullable
                        ? 'text-muted-foreground'
                        : 'text-amber-600'
                    )}
                  >
                    {column.nullable ? 'Yes' : 'No'}
                  </span>
                </td>
                <td className="py-2 pr-4">
                  {column.defaultValue !== null ? (
                    <span className="font-mono text-xs">
                      {column.defaultValue}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-xs">-</span>
                  )}
                </td>
                <td className="py-2">
                  {isPK && (
                    <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-xs font-medium">
                      PK
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface IndexesListProps {
  indexes: IndexSchema[];
}

function IndexesList({ indexes }: IndexesListProps) {
  return (
    <div className="space-y-2">
      {indexes.map((index) => (
        <div key={index.name} className="bg-background rounded border p-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-medium">{index.name}</span>
            {index.isUnique && (
              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                UNIQUE
              </span>
            )}
          </div>
          <div className="text-muted-foreground mt-1 text-xs">
            Columns: {index.columns.join(', ')}
          </div>
          {index.sql && (
            <div className="mt-2">
              <code className="bg-muted block overflow-x-auto rounded p-2 font-mono text-xs whitespace-pre-wrap">
                {index.sql}
              </code>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

interface ForeignKeysListProps {
  foreignKeys: ForeignKeySchema[];
}

function ForeignKeysList({ foreignKeys }: ForeignKeysListProps) {
  return (
    <div className="space-y-2">
      {foreignKeys.map((fk) => (
        <div
          key={`${fk.column}-${fk.referencedTable}-${fk.referencedColumn}`}
          className="bg-background rounded border p-2"
        >
          <div className="flex items-center gap-2 text-sm">
            <span className="font-mono text-xs">{fk.column}</span>
            <span className="text-muted-foreground">&rarr;</span>
            <span className="font-mono text-xs">
              {fk.referencedTable}.{fk.referencedColumn}
            </span>
          </div>
          <div className="text-muted-foreground mt-1 flex gap-3 text-xs">
            {fk.onDelete && (
              <span>
                ON DELETE: <span className="font-medium">{fk.onDelete}</span>
              </span>
            )}
            {fk.onUpdate && (
              <span>
                ON UPDATE: <span className="font-medium">{fk.onUpdate}</span>
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

interface TriggersListProps {
  triggers: TriggerSchema[];
}

function TriggersList({ triggers }: TriggersListProps) {
  return (
    <div className="space-y-2">
      {triggers.map((trigger) => (
        <div key={trigger.name} className="bg-background rounded border p-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-medium">
              {trigger.name}
            </span>
            <span className="rounded bg-purple-100 px-1.5 py-0.5 text-xs text-purple-700 dark:bg-purple-950 dark:text-purple-300">
              {trigger.timing}
            </span>
            <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700 dark:bg-green-950 dark:text-green-300">
              {trigger.event}
            </span>
          </div>
          {trigger.sql && (
            <div className="mt-2">
              <code className="bg-muted block overflow-x-auto rounded p-2 font-mono text-xs whitespace-pre-wrap">
                {trigger.sql}
              </code>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

interface SqlBlockProps {
  sql: string;
}

function SqlBlock({ sql }: SqlBlockProps) {
  return (
    <code className="bg-muted block overflow-x-auto rounded p-3 font-mono text-xs whitespace-pre-wrap">
      {sql}
    </code>
  );
}

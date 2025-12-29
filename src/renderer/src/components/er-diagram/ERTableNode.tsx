import type { ERTableNodeData } from '@/types/er-diagram';
import { Handle, Position } from '@xyflow/react';
import { Eye, Key, Link2, Table } from 'lucide-react';
import { memo } from 'react';
import { cn } from '@/lib/utils';

interface ERTableNodeProps {
  data: ERTableNodeData;
  selected?: boolean;
}

function ERTableNodeComponent({ data, selected }: ERTableNodeProps) {
  const { tableName, columns, primaryKey, foreignKeys, isView } = data;

  // Get set of FK column names for quick lookup
  const fkColumns = new Set(foreignKeys.map((fk) => fk.column));

  // Get set of referenced columns (targets of FKs from other tables)
  const referencedColumns = new Set(
    foreignKeys.map((fk) => fk.referencedColumn)
  );

  return (
    <div
      className={cn(
        'bg-card text-card-foreground min-w-[200px] rounded-lg border shadow-sm',
        'dark:border-zinc-700 dark:bg-zinc-900',
        selected && 'ring-primary ring-2'
      )}
    >
      {/* Header */}
      <div
        className={cn(
          'flex items-center gap-2 rounded-t-lg border-b px-3 py-2',
          'bg-muted/50 dark:bg-zinc-800/50',
          isView ? 'text-blue-600 dark:text-blue-400' : 'text-foreground'
        )}
      >
        {isView ? (
          <Eye className="h-4 w-4 shrink-0" />
        ) : (
          <Table className="h-4 w-4 shrink-0" />
        )}
        <span className="truncate font-medium">{tableName}</span>
      </div>

      {/* Columns */}
      <div className="py-1">
        {columns.map((column) => {
          const isPK = primaryKey.includes(column.name);
          const isFK = fkColumns.has(column.name);
          const isReferenced = referencedColumns.has(column.name);

          return (
            <div
              key={column.name}
              className={cn(
                'relative flex items-center gap-2 px-3 py-1 text-sm',
                'hover:bg-accent/50'
              )}
            >
              {/* PK/FK indicators */}
              <div className="flex w-8 shrink-0 items-center gap-0.5">
                {isPK && (
                  <span title="Primary Key">
                    <Key className="h-3 w-3 text-amber-500" />
                  </span>
                )}
                {isFK && (
                  <span title="Foreign Key">
                    <Link2 className="h-3 w-3 text-blue-500" />
                  </span>
                )}
              </div>

              {/* Column name */}
              <span
                className={cn(
                  'flex-1 truncate',
                  isPK && 'font-medium',
                  !column.nullable && 'underline decoration-dotted'
                )}
                title={`${column.name}${!column.nullable ? ' (NOT NULL)' : ''}`}
              >
                {column.name}
              </span>

              {/* Column type */}
              <span className="text-muted-foreground shrink-0 font-mono text-xs">
                {column.type}
              </span>

              {/* Source handle for FK columns (right side) */}
              {isFK && (
                <Handle
                  type="source"
                  position={Position.Right}
                  id={column.name}
                  className="!h-2 !w-2 !border-blue-600 !bg-blue-500"
                />
              )}

              {/* Target handle for referenced columns (left side) */}
              {(isPK || isReferenced) && (
                <Handle
                  type="target"
                  position={Position.Left}
                  id={column.name}
                  className="!h-2 !w-2 !border-amber-600 !bg-amber-500"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const ERTableNode = memo(ERTableNodeComponent);

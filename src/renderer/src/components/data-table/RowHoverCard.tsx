import type { TableRowData } from './hooks/useTableCore';
import type { ColumnSchema } from '@/types/database';
import { Copy, Maximize2 } from 'lucide-react';
import { memo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { cn } from '@/lib/utils';

interface RowHoverCardProps {
  row: TableRowData;
  columns: ColumnSchema[];
  children: React.ReactNode;
  /** Primary key column name for identification */
  primaryKeyColumn?: string;
  /** Callback when expand is clicked */
  onExpand?: () => void;
}

/**
 * A hover card that shows detailed row information on hover.
 * Displays all column values with type-aware formatting.
 */
export const RowHoverCard = memo(
  ({
    row,
    columns,
    children,
    primaryKeyColumn,
    onExpand,
  }: RowHoverCardProps) => {
    const [copied, setCopied] = useState(false);

    // Get the row identifier
    const rowId =
      primaryKeyColumn && row[primaryKeyColumn] !== undefined
        ? row[primaryKeyColumn]
        : row.__rowId;

    // Format a value for display
    const formatValue = (value: unknown, type: string): string => {
      if (value === null || value === undefined) {
        return 'NULL';
      }

      const typeLower = type.toLowerCase();

      // Format based on type
      if (typeLower.includes('date') || typeLower.includes('time')) {
        try {
          const date = new Date(value as string | number);
          if (!Number.isNaN(date.getTime())) {
            return date.toLocaleString();
          }
        } catch {
          // Fall through to default
        }
      }

      if (typeLower === 'boolean' || typeLower === 'bool') {
        return value ? '✓ True' : '✗ False';
      }

      if (typeof value === 'object') {
        return JSON.stringify(value, null, 2);
      }

      const str = String(value);
      // Truncate long values
      if (str.length > 100) {
        return `${str.slice(0, 100)}...`;
      }

      return str;
    };

    // Copy row as JSON
    const handleCopyJson = async () => {
      const rowData: Record<string, unknown> = {};
      columns.forEach((col) => {
        rowData[col.name] = row[col.name];
      });

      await navigator.clipboard.writeText(JSON.stringify(rowData, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    // Get value styling based on type/value
    const getValueStyle = (value: unknown, type: string): string => {
      if (value === null || value === undefined) {
        return 'text-muted-foreground/50 italic';
      }

      const typeLower = type.toLowerCase();

      if (typeLower.includes('int') || typeLower.includes('num')) {
        return 'text-blue-600 dark:text-blue-400 font-mono';
      }

      if (typeLower.includes('date') || typeLower.includes('time')) {
        return 'text-purple-600 dark:text-purple-400';
      }

      if (typeLower === 'boolean' || typeLower === 'bool') {
        return value
          ? 'text-green-600 dark:text-green-400'
          : 'text-red-600 dark:text-red-400';
      }

      return '';
    };

    return (
      <HoverCard>
        <HoverCardTrigger>{children}</HoverCardTrigger>
        <HoverCardContent
          className="w-80 p-0"
          side="right"
          align="start"
          sideOffset={5}
        >
          {/* Header */}
          <div className="border-b px-3 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">Row ID:</span>
                <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 font-mono text-xs">
                  {String(rowId)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={handleCopyJson}
                  title={copied ? 'Copied!' : 'Copy as JSON'}
                >
                  <Copy
                    className={cn(
                      'h-3 w-3 transition-colors',
                      copied && 'text-green-500'
                    )}
                  />
                </Button>
                {onExpand && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={onExpand}
                    title="Expand row"
                  >
                    <Maximize2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="max-h-64 overflow-y-auto">
            <div className="divide-border/50 divide-y">
              {columns.slice(0, 10).map((col) => {
                const value = row[col.name];
                const formattedValue = formatValue(value, col.type);

                return (
                  <div
                    key={col.name}
                    className="hover:bg-muted/50 flex items-start gap-2 px-3 py-1.5 transition-colors"
                  >
                    <span className="text-muted-foreground min-w-20 truncate text-xs font-medium">
                      {col.name}
                    </span>
                    <span
                      className={cn(
                        'flex-1 text-xs wrap-break-word',
                        getValueStyle(value, col.type)
                      )}
                    >
                      {formattedValue}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer (if more columns exist) */}
          {columns.length > 10 && (
            <div className="border-t px-3 py-1.5">
              <span className="text-muted-foreground text-[10px]">
                +{columns.length - 10} more columns
              </span>
            </div>
          )}
        </HoverCardContent>
      </HoverCard>
    );
  }
);

RowHoverCard.displayName = 'RowHoverCard';

import type { PendingChange } from '@/lib/collections';
import { Badge } from '@sqlpro/ui/badge';
import { Button } from '@sqlpro/ui/button';
import { ScrollArea } from '@sqlpro/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@sqlpro/ui/tooltip';
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Code,
  Copy,
  Database,
  Edit3,
  Plus,
  Table2,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SqlHighlight } from '@/components/ui/sql-highlight';
import { usePendingChanges } from '@/hooks/usePendingChanges';
import { generateSQLScript } from '@/lib/sql-generator';
import { cn } from '@/lib/utils';
import { useConnectionStore } from '@/stores';

interface DiffPreviewProps {
  onClose: () => void;
  onApplied?: () => void;
}

// Group changes by table
interface TableGroup {
  table: string;
  schema?: string;
  changes: PendingChange[];
  insertCount: number;
  updateCount: number;
  deleteCount: number;
}

export function DiffPreview({ onClose, onApplied }: DiffPreviewProps) {
  const { connection } = useConnectionStore();

  const {
    changes,
    hasChanges,
    isValidating,
    isApplying,
    validationErrors,
    applyChanges,
    removeChange,
    clearAllChanges,
    undoLastChange,
  } = usePendingChanges({
    connectionId: connection?.id || null,
  });

  // Expanded state: track expanded tables and changes
  const [expandedTables, setExpandedTables] = useState<Set<string>>(
    () => new Set()
  );
  const [expandedChanges, setExpandedChanges] = useState<Set<string>>(
    () => new Set()
  );
  // Toggle between diff view and SQL preview
  const [showSqlPreview, setShowSqlPreview] = useState(false);
  // Copy feedback state
  const [copied, setCopied] = useState(false);

  // Generate full SQL script for all changes
  const sqlScript = useMemo(() => generateSQLScript(changes), [changes]);

  // Copy SQL to clipboard
  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(sqlScript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy SQL:', err);
    }
  }, [sqlScript]);

  // Group changes by table
  const tableGroups = useMemo((): TableGroup[] => {
    const groups = new Map<string, TableGroup>();

    for (const change of changes) {
      const key = `${change.schema || 'main'}.${change.table}`;
      if (!groups.has(key)) {
        groups.set(key, {
          table: change.table,
          schema: change.schema,
          changes: [],
          insertCount: 0,
          updateCount: 0,
          deleteCount: 0,
        });
      }
      const group = groups.get(key)!;
      group.changes.push(change);
      if (change.type === 'insert') group.insertCount++;
      else if (change.type === 'update') group.updateCount++;
      else if (change.type === 'delete') group.deleteCount++;
    }

    return Array.from(groups.values()).sort((a, b) =>
      a.table.localeCompare(b.table)
    );
  }, [changes]);

  // Derive expanded tables - auto-expand new tables
  const expandedTablesWithNew = useMemo(() => {
    const tableKeys = tableGroups.map(
      (g) => `${g.schema || 'main'}.${g.table}`
    );
    const newSet = new Set(expandedTables);
    let hasNew = false;
    tableKeys.forEach((key) => {
      if (!expandedTables.has(key)) {
        newSet.add(key);
        hasNew = true;
      }
    });
    return hasNew ? newSet : expandedTables;
  }, [tableGroups, expandedTables]);

  // Sync expanded tables state when new tables are added
  if (expandedTablesWithNew !== expandedTables) {
    setExpandedTables(expandedTablesWithNew);
  }

  // Global Ctrl+Z handler for undo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undoLastChange();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoLastChange]);

  const toggleTableExpanded = (tableKey: string) => {
    setExpandedTables((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(tableKey)) {
        newSet.delete(tableKey);
      } else {
        newSet.add(tableKey);
      }
      return newSet;
    });
  };

  const toggleChangeExpanded = (changeId: string) => {
    setExpandedChanges((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(changeId)) {
        newSet.delete(changeId);
      } else {
        newSet.add(changeId);
      }
      return newSet;
    });
  };

  const handleApply = async () => {
    const success = await applyChanges();
    if (success) {
      onApplied?.();
      onClose();
    }
  };

  const handleDiscard = () => {
    clearAllChanges();
    onClose();
  };

  const removeTableChanges = (group: TableGroup) => {
    group.changes.forEach((c) => removeChange(c.id));
  };

  const invalidCount = validationErrors.size;
  const totalInserts = changes.filter((c) => c.type === 'insert').length;
  const totalUpdates = changes.filter((c) => c.type === 'update').length;
  const totalDeletes = changes.filter((c) => c.type === 'delete').length;

  if (!hasChanges) {
    return null;
  }

  return (
    <div className="bg-background flex h-full w-full flex-col overflow-hidden border-l">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Database className="text-muted-foreground h-5 w-5" />
          <div>
            <h2 className="font-semibold">Pending Changes</h2>
            <p className="text-muted-foreground text-xs">
              {tableGroups.length}{' '}
              {tableGroups.length === 1 ? 'table' : 'tables'} • {changes.length}{' '}
              {changes.length === 1 ? 'change' : 'changes'}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Summary Badges and View Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2">
        <div className="flex flex-wrap gap-2">
          {totalInserts > 0 && (
            <Badge
              variant="outline"
              className="border-green-500/50 bg-green-500/10 text-green-600 dark:text-green-400"
            >
              <Plus className="mr-1 h-3 w-3" />
              {totalInserts} INSERT
            </Badge>
          )}
          {totalUpdates > 0 && (
            <Badge
              variant="outline"
              className="border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400"
            >
              <Edit3 className="mr-1 h-3 w-3" />
              {totalUpdates} UPDATE
            </Badge>
          )}
          {totalDeletes > 0 && (
            <Badge
              variant="outline"
              className="border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-400"
            >
              <Trash2 className="mr-1 h-3 w-3" />
              {totalDeletes} DELETE
            </Badge>
          )}
        </div>
        <Tooltip>
          <TooltipTrigger>
            <Button
              variant={showSqlPreview ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 gap-1 px-2"
              onClick={() => setShowSqlPreview(!showSqlPreview)}
            >
              <Code className="h-3.5 w-3.5" />
              <span className="text-xs">SQL</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            {showSqlPreview ? 'Show diff view' : 'Preview SQL statements'}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* SQL Preview View */}
      {showSqlPreview ? (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b px-4 py-2">
            <span className="text-muted-foreground text-xs font-medium">
              SQL Preview
            </span>
            <Tooltip>
              <TooltipTrigger>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2"
                  onClick={copyToClipboard}
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span className="text-xs">{copied ? 'Copied!' : 'Copy'}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Copy SQL to clipboard</TooltipContent>
            </Tooltip>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-4">
              <SqlHighlight code={sqlScript} className="text-xs" />
            </div>
          </ScrollArea>
        </div>
      ) : (
        <>
          {/* Changes List - Grouped by Table */}
          <ScrollArea className="flex-1">
            <div className="p-2">
              {tableGroups.map((group) => {
                const tableKey = `${group.schema || 'main'}.${group.table}`;
                const isExpanded = expandedTables.has(tableKey);
                const hasErrors = group.changes.some(
                  (c) => validationErrors.has(c.id) || !c.isValid
                );

                return (
                  <div key={tableKey} className="mb-2">
                    {/* Table Header */}
                    <div
                      className={cn(
                        'bg-muted/50 hover:bg-muted flex cursor-pointer items-center gap-2 rounded-t-md border px-3 py-2 transition-colors',
                        !isExpanded && 'rounded-b-md'
                      )}
                      onClick={() => toggleTableExpanded(tableKey)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0" />
                      )}
                      <Table2 className="text-muted-foreground h-4 w-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {group.table}
                      </span>

                      {/* Mini badges */}
                      <div className="flex shrink-0 items-center gap-1">
                        {group.insertCount > 0 && (
                          <span className="flex h-5 w-5 items-center justify-center rounded bg-green-500/20 text-xs text-green-600">
                            +{group.insertCount}
                          </span>
                        )}
                        {group.updateCount > 0 && (
                          <span className="flex h-5 w-5 items-center justify-center rounded bg-amber-500/20 text-xs text-amber-600">
                            ~{group.updateCount}
                          </span>
                        )}
                        {group.deleteCount > 0 && (
                          <span className="flex h-5 w-5 items-center justify-center rounded bg-red-500/20 text-xs text-red-600">
                            -{group.deleteCount}
                          </span>
                        )}
                        {hasErrors && (
                          <AlertCircle className="text-destructive h-4 w-4" />
                        )}
                      </div>

                      {/* Remove all table changes */}
                      <Tooltip>
                        <TooltipTrigger>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeTableChanges(group);
                            }}
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded p-1 transition-colors"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="left">
                          Discard all changes to {group.table}
                        </TooltipContent>
                      </Tooltip>
                    </div>

                    {/* Table Changes */}
                    {isExpanded && (
                      <div className="space-y-px rounded-b-md border-x border-b">
                        {group.changes.map((change) => (
                          <ChangeItem
                            key={change.id}
                            change={change}
                            isExpanded={expandedChanges.has(change.id)}
                            onToggle={() => toggleChangeExpanded(change.id)}
                            onRemove={() => removeChange(change.id)}
                            validationError={validationErrors.get(change.id)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </>
      )}

      {/* Validation Error */}
      {invalidCount > 0 && (
        <div className="bg-destructive/10 text-destructive flex items-center gap-2 border-t px-4 py-2 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            {invalidCount} {invalidCount === 1 ? 'change has' : 'changes have'}{' '}
            validation errors
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 border-t p-3">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={handleDiscard}
          disabled={isApplying}
          data-action="discard-changes"
        >
          <Undo2 className="mr-1.5 h-3.5 w-3.5" />
          Discard
        </Button>
        <Button
          size="sm"
          className="flex-1"
          onClick={handleApply}
          disabled={isApplying || isValidating}
          data-action="save-changes"
        >
          <Check className="mr-1.5 h-3.5 w-3.5" />
          {isApplying
            ? 'Applying...'
            : isValidating
              ? 'Validating...'
              : 'Apply'}
        </Button>
      </div>
    </div>
  );
}

interface ChangeItemProps {
  change: PendingChange;
  isExpanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
  validationError?: string;
}

function ChangeItem({
  change,
  isExpanded,
  onToggle,
  onRemove,
  validationError,
}: ChangeItemProps) {
  const getTypeConfig = () => {
    switch (change.type) {
      case 'insert':
        return {
          icon: <Plus className="h-3.5 w-3.5" />,
          label: 'INSERT',
          color: 'text-green-600 dark:text-green-400',
          bg: 'bg-green-500/5',
          border: 'border-l-green-500',
        };
      case 'update':
        return {
          icon: <Edit3 className="h-3.5 w-3.5" />,
          label: 'UPDATE',
          color: 'text-amber-600 dark:text-amber-400',
          bg: 'bg-amber-500/5',
          border: 'border-l-amber-500',
        };
      case 'delete':
        return {
          icon: <Trash2 className="h-3.5 w-3.5" />,
          label: 'DELETE',
          color: 'text-red-600 dark:text-red-400',
          bg: 'bg-red-500/5',
          border: 'border-l-red-500',
        };
    }
  };

  const config = getTypeConfig();
  const hasError = validationError || !change.isValid;

  // Format row ID for display
  const formatRowId = (rowId: string | number) => {
    if (typeof rowId === 'number' && rowId < 0) {
      return 'NEW';
    }
    return String(rowId);
  };

  return (
    <div
      className={cn(
        'border-l-2',
        config.border,
        config.bg,
        'hover:bg-muted/30'
      )}
    >
      {/* Change Header */}
      <div
        className="flex cursor-pointer items-center gap-2 px-3 py-2"
        onClick={onToggle}
      >
        {isExpanded ? (
          <ChevronDown className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
        ) : (
          <ChevronRight className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
        )}

        <span
          className={cn(
            'flex items-center gap-1 text-xs font-medium',
            config.color
          )}
        >
          {config.icon}
          {config.label}
        </span>

        <span className="text-muted-foreground font-mono text-xs">
          #{formatRowId(change.rowId)}
        </span>

        <div className="flex-1" />

        {hasError && (
          <Tooltip>
            <TooltipTrigger>
              <AlertCircle className="text-destructive h-3.5 w-3.5" />
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-xs">
              {validationError || change.validationError || 'Validation error'}
            </TooltipContent>
          </Tooltip>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded p-1 transition-colors"
          title="Remove change"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Change Details */}
      {isExpanded && (
        <div className="bg-background/50 border-t px-3 py-2">
          {(validationError || change.validationError) && (
            <div className="bg-destructive/10 text-destructive mb-2 rounded px-2 py-1.5 text-xs">
              {validationError || change.validationError}
            </div>
          )}
          <DiffTable change={change} />
        </div>
      )}
    </div>
  );
}

// Table-based diff view for clearer visualization
function DiffTable({ change }: { change: PendingChange }) {
  const changedFields = useMemo(() => {
    if (change.type === 'delete') {
      return Object.entries(change.oldValues || {})
        .filter(([key]) => !key.startsWith('__'))
        .map(([key, value]) => ({
          field: key,
          oldValue: value,
          newValue: null,
          isChanged: true,
        }));
    }

    if (change.type === 'insert') {
      return Object.entries(change.newValues || {})
        .filter(([key]) => !key.startsWith('__'))
        .map(([key, value]) => ({
          field: key,
          oldValue: null,
          newValue: value,
          isChanged: true,
        }));
    }

    // Update - show only changed fields
    const allKeys = new Set([
      ...Object.keys(change.oldValues || {}).filter((k) => !k.startsWith('__')),
      ...Object.keys(change.newValues || {}).filter((k) => !k.startsWith('__')),
    ]);

    return Array.from(allKeys)
      .map((key) => {
        const oldValue = change.oldValues?.[key];
        const newValue = change.newValues?.[key];
        const isChanged = newValue !== undefined && oldValue !== newValue;
        return { field: key, oldValue, newValue, isChanged };
      })
      .filter((f) => f.isChanged);
  }, [change]);

  if (changedFields.length === 0) {
    return (
      <p className="text-muted-foreground text-xs italic">
        No changes detected
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded border text-xs">
      <table className="w-full">
        <thead>
          <tr className="bg-muted/50 text-muted-foreground">
            <th className="px-2 py-1.5 text-left font-medium">Field</th>
            {change.type !== 'insert' && (
              <th className="px-2 py-1.5 text-left font-medium">Old</th>
            )}
            {change.type !== 'delete' && (
              <th className="px-2 py-1.5 text-left font-medium">New</th>
            )}
          </tr>
        </thead>
        <tbody>
          {changedFields.map(({ field, oldValue, newValue }) => (
            <tr key={field} className="border-t">
              <td className="text-muted-foreground px-2 py-1.5 font-medium">
                {field}
              </td>
              {change.type !== 'insert' && (
                <td className="px-2 py-1.5">
                  <span
                    className={cn(
                      'font-mono',
                      change.type === 'delete'
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-muted-foreground line-through'
                    )}
                  >
                    {formatValue(oldValue)}
                  </span>
                </td>
              )}
              {change.type !== 'delete' && (
                <td className="px-2 py-1.5">
                  <span className="font-mono text-green-600 dark:text-green-400">
                    {formatValue(newValue)}
                  </span>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null) return 'NULL';
  if (value === undefined) return '';
  if (typeof value === 'string') {
    // Truncate long strings
    if (value.length > 50) {
      return `"${value.substring(0, 47)}..."`;
    }
    return `"${value}"`;
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

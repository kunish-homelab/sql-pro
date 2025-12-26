import { useState, useEffect } from 'react';
import {
  X,
  Check,
  AlertCircle,
  Trash2,
  Edit3,
  Plus,
  ChevronDown,
  ChevronRight,
  Undo2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  useChangesStore,
  useConnectionStore,
  useTableDataStore,
} from '@/stores';
import type { PendingChange } from '@/types/database';

interface DiffPreviewProps {
  onClose: () => void;
}

export function DiffPreview({ onClose }: DiffPreviewProps) {
  const { connection } = useConnectionStore();
  const {
    changes,
    isValidating,
    isApplying,
    removeChange,
    clearChanges,
    setValidationResult,
    setIsValidating,
    setIsApplying,
  } = useChangesStore();
  const { reset: resetTableData } = useTableDataStore();

  const [expandedChanges, setExpandedChanges] = useState<Set<string>>(
    new Set(changes.map((c) => c.id))
  );

  // Global Ctrl+Z handler for undo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        // Find and remove the most recent change by timestamp
        if (changes.length > 0) {
          const sortedChanges = [...changes].sort(
            (a, b) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
          removeChange(sortedChanges[0].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [changes, removeChange]);

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedChanges);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedChanges(newExpanded);
  };

  const handleValidate = async () => {
    if (!connection) return;

    setIsValidating(true);
    try {
      const result = await window.sqlPro.db.validateChanges({
        connectionId: connection.id,
        changes: changes.map((c) => ({
          id: c.id,
          table: c.table,
          rowId: c.rowId,
          type: c.type,
          oldValues: c.oldValues,
          newValues: c.newValues,
        })),
      });

      if (result.success && result.results) {
        setValidationResult(result.results);
      }
    } finally {
      setIsValidating(false);
    }
  };

  const handleApply = async () => {
    if (!connection) return;

    // First validate
    await handleValidate();

    // Check if all changes are valid
    const invalidChanges = changes.filter((c) => !c.isValid);
    if (invalidChanges.length > 0) {
      return;
    }

    setIsApplying(true);
    try {
      const result = await window.sqlPro.db.applyChanges({
        connectionId: connection.id,
        changes: changes.map((c) => ({
          id: c.id,
          table: c.table,
          rowId: c.rowId,
          type: c.type,
          oldValues: c.oldValues,
          newValues: c.newValues,
        })),
      });

      if (result.success) {
        clearChanges();
        resetTableData(); // Trigger data reload
        onClose();
      }
    } finally {
      setIsApplying(false);
    }
  };

  const invalidCount = changes.filter((c) => !c.isValid).length;
  const insertCount = changes.filter((c) => c.type === 'insert').length;
  const updateCount = changes.filter((c) => c.type === 'update').length;
  const deleteCount = changes.filter((c) => c.type === 'delete').length;

  return (
    <div className="flex h-full flex-col border-l bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 className="font-semibold">Review Changes</h2>
          <p className="text-sm text-muted-foreground">
            {changes.length} pending{' '}
            {changes.length === 1 ? 'change' : 'changes'}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Summary */}
      <div className="flex gap-4 border-b px-4 py-2 text-sm">
        {insertCount > 0 && (
          <div className="flex items-center gap-1 text-green-600">
            <Plus className="h-4 w-4" />
            <span>{insertCount} insert</span>
          </div>
        )}
        {updateCount > 0 && (
          <div className="flex items-center gap-1 text-amber-600">
            <Edit3 className="h-4 w-4" />
            <span>{updateCount} update</span>
          </div>
        )}
        {deleteCount > 0 && (
          <div className="flex items-center gap-1 text-red-600">
            <Trash2 className="h-4 w-4" />
            <span>{deleteCount} delete</span>
          </div>
        )}
      </div>

      {/* Changes List */}
      <ScrollArea className="flex-1">
        <div className="space-y-2 p-4">
          {changes.map((change) => (
            <ChangeItem
              key={change.id}
              change={change}
              isExpanded={expandedChanges.has(change.id)}
              onToggle={() => toggleExpanded(change.id)}
              onRemove={() => removeChange(change.id)}
            />
          ))}
        </div>
      </ScrollArea>

      {/* Validation Error */}
      {invalidCount > 0 && (
        <div className="flex items-center gap-2 border-t bg-destructive/10 px-4 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span>
            {invalidCount} {invalidCount === 1 ? 'change has' : 'changes have'}{' '}
            validation errors
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 border-t p-4">
        <Button
          variant="outline"
          className="flex-1"
          onClick={clearChanges}
          disabled={isApplying}
        >
          <Undo2 className="mr-2 h-4 w-4" />
          Discard All
        </Button>
        <Button
          className="flex-1"
          onClick={handleApply}
          disabled={isApplying || isValidating}
        >
          <Check className="mr-2 h-4 w-4" />
          {isApplying
            ? 'Applying...'
            : isValidating
              ? 'Validating...'
              : 'Apply Changes'}
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
}

function ChangeItem({
  change,
  isExpanded,
  onToggle,
  onRemove,
}: ChangeItemProps) {
  const getTypeIcon = () => {
    switch (change.type) {
      case 'insert':
        return <Plus className="h-4 w-4 text-green-600" />;
      case 'update':
        return <Edit3 className="h-4 w-4 text-amber-600" />;
      case 'delete':
        return <Trash2 className="h-4 w-4 text-red-600" />;
    }
  };

  const getTypeBg = () => {
    switch (change.type) {
      case 'insert':
        return 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950';
      case 'update':
        return 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950';
      case 'delete':
        return 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950';
    }
  };

  return (
    <div className={cn('rounded-lg border', getTypeBg())}>
      {/* Header */}
      <div className="flex items-center gap-2 p-3">
        <button onClick={onToggle} className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          {getTypeIcon()}
          <span className="font-medium">{change.table}</span>
          <span className="text-sm text-muted-foreground">
            Row {change.rowId}
          </span>
        </button>
        <div className="flex-1" />
        {!change.isValid && (
          <AlertCircle className="h-4 w-4 text-destructive" />
        )}
        <button
          onClick={onRemove}
          className="rounded p-1 hover:bg-background/50"
          title="Undo this change"
        >
          <Undo2 className="h-4 w-4" />
        </button>
        <button
          onClick={onRemove}
          className="rounded p-1 hover:bg-background/50"
          title="Remove change"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Details */}
      {isExpanded && (
        <div className="border-t px-3 py-2">
          {change.validationError && (
            <div className="mb-2 rounded bg-destructive/10 px-2 py-1 text-sm text-destructive">
              {change.validationError}
            </div>
          )}
          <DiffDetails change={change} />
        </div>
      )}
    </div>
  );
}

function DiffDetails({ change }: { change: PendingChange }) {
  if (change.type === 'delete') {
    return (
      <div className="space-y-1 text-sm">
        {change.oldValues &&
          Object.entries(change.oldValues).map(([key, value]) => (
            <div key={key} className="flex gap-2">
              <span className="font-medium text-muted-foreground">{key}:</span>
              <span className="text-red-600 line-through">
                {formatValue(value)}
              </span>
            </div>
          ))}
      </div>
    );
  }

  if (change.type === 'insert') {
    return (
      <div className="space-y-1 text-sm">
        {change.newValues &&
          Object.entries(change.newValues).map(([key, value]) => (
            <div key={key} className="flex gap-2">
              <span className="font-medium text-muted-foreground">{key}:</span>
              <span className="text-green-600">{formatValue(value)}</span>
            </div>
          ))}
      </div>
    );
  }

  // Update - show diff
  const allKeys = new Set([
    ...Object.keys(change.oldValues || {}),
    ...Object.keys(change.newValues || {}),
  ]);

  return (
    <div className="space-y-1 text-sm">
      {Array.from(allKeys).map((key) => {
        const oldValue = change.oldValues?.[key];
        const newValue = change.newValues?.[key];
        const hasChanged = oldValue !== newValue && newValue !== undefined;

        if (!hasChanged) return null;

        return (
          <div key={key} className="flex gap-2">
            <span className="font-medium text-muted-foreground">{key}:</span>
            <span className="text-red-600 line-through">
              {formatValue(oldValue)}
            </span>
            <span className="text-muted-foreground">&rarr;</span>
            <span className="text-green-600">{formatValue(newValue)}</span>
          </div>
        );
      })}
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null) return 'NULL';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return `"${value}"`;
  return String(value);
}

import type { PendingChange } from '@/types/database';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@sqlpro/ui/alert-dialog';
import { Button } from '@sqlpro/ui/button';
import { AlertTriangle, Edit3, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

interface ConnectionChanges {
  connectionId: string;
  dbPath: string;
  changes: PendingChange[];
  inserts: number;
  updates: number;
  deletes: number;
}

interface AppQuitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionsWithChanges: ConnectionChanges[];
  onSave: () => Promise<void>;
  onDiscard: () => void;
  onCancel: () => void;
}

export function AppQuitDialog({
  open,
  onOpenChange,
  connectionsWithChanges,
  onSave,
  onDiscard,
  onCancel,
}: AppQuitDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edge case: If all changes are cleared between check and display, skip dialog
  useEffect(() => {
    if (open && connectionsWithChanges.length === 0) {
      // No connections with changes exist, proceed with quit by calling onDiscard
      // This is safe because discarding empty changes is a no-op and just proceeds
      onDiscard();
      onOpenChange(false);
    }
  }, [open, connectionsWithChanges.length, onDiscard, onOpenChange]);

  // Calculate total changes across all connections
  const totalChanges = useMemo(() => {
    return connectionsWithChanges.reduce(
      (sum, conn) => sum + conn.changes.length,
      0
    );
  }, [connectionsWithChanges]);

  const handleSave = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await onSave();
      // Only close if save succeeded (no error thrown)
      onOpenChange(false);
    } catch (err) {
      // Keep dialog open and show error
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDiscard = () => {
    setError(null);
    onDiscard();
    onOpenChange(false);
  };

  const handleCancel = () => {
    setError(null);
    onCancel();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <AlertTriangle className="text-amber-600" />
          </AlertDialogMedia>
          <AlertDialogTitle>Quit with Unsaved Changes?</AlertDialogTitle>
          <AlertDialogDescription>
            You have {totalChanges} unsaved{' '}
            {totalChanges === 1 ? 'change' : 'changes'} across{' '}
            {connectionsWithChanges.length}{' '}
            {connectionsWithChanges.length === 1 ? 'connection' : 'connections'}
            . What would you like to do?
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Change Summary by Connection */}
        <div className="max-h-75 space-y-3 overflow-y-auto">
          {connectionsWithChanges.map((connection) => (
            <div
              key={connection.connectionId}
              className="bg-muted/50 rounded-md px-3 py-2"
            >
              <div className="truncate text-sm font-medium">
                {connection.dbPath}
              </div>
              <div className="mt-1 flex flex-wrap gap-3 text-xs">
                {connection.inserts > 0 && (
                  <div className="flex items-center gap-1 text-green-600">
                    <Plus className="h-3 w-3" />
                    <span>
                      {connection.inserts} insert
                      {connection.inserts !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
                {connection.updates > 0 && (
                  <div className="flex items-center gap-1 text-amber-600">
                    <Edit3 className="h-3 w-3" />
                    <span>
                      {connection.updates} update
                      {connection.updates !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
                {connection.deletes > 0 && (
                  <div className="flex items-center gap-1 text-red-600">
                    <Trash2 className="h-3 w-3" />
                    <span>
                      {connection.deletes} delete
                      {connection.deletes !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
            {error}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel} disabled={isLoading}>
            Cancel
          </AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleDiscard}
            disabled={isLoading}
          >
            Discard All Changes
          </Button>
          <AlertDialogAction onClick={handleSave} disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save All Changes'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

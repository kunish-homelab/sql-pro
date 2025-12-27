import type { PendingChangeInfo } from '../../../shared/types';
import type { PendingChange } from '@/lib/collections';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { sqlPro } from '@/lib/api';
import {
  clearPendingChanges,
  getAllPendingChanges,
  pendingChangesCollection,
} from '@/lib/collections';

export interface UsePendingChangesOptions {
  connectionId: string | null;
  schema?: string; // Database schema (defaults to 'main' for SQLite)
  table?: string;
}

export interface UsePendingChangesResult {
  // Data
  changes: PendingChange[];
  hasChanges: boolean;
  changeCount: number;

  // Validation
  isValidating: boolean;
  validationErrors: Map<string, string>;
  validateChanges: () => Promise<boolean>;

  // Apply
  isApplying: boolean;
  applyChanges: () => Promise<boolean>;

  // Actions
  removeChange: (id: string) => void;
  clearAllChanges: () => void;
  undoLastChange: () => void;
}

/**
 * Hook for managing pending changes with validation and apply functionality.
 * Uses TanStack DB's collection subscription for automatic UI updates.
 */
export function usePendingChanges(
  options: UsePendingChangesOptions
): UsePendingChangesResult {
  const { connectionId, schema = 'main', table } = options;

  const [isValidating, setIsValidating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Map<string, string>>(
    () => new Map()
  );

  // Track pending changes with local state for reactivity
  const [changesVersion, setChangesVersion] = useState(0);

  // Subscribe to pending changes collection updates
  useEffect(() => {
    const subscription = pendingChangesCollection.subscribeChanges(() => {
      setChangesVersion((v) => v + 1);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Get all changes (reactive via changesVersion)
  const allChanges = useMemo(() => {
    // Use void to mark intentional dependency read for reactivity
    void changesVersion;
    return getAllPendingChanges();
  }, [changesVersion]);

  // Filter changes by table and schema if specified
  const changes = useMemo(() => {
    if (!table) return allChanges;
    return allChanges.filter((c) => c.table === table && c.schema === schema);
  }, [allChanges, table, schema]);

  const validateChanges = useCallback(async (): Promise<boolean> => {
    if (!connectionId || changes.length === 0) {
      return true;
    }

    setIsValidating(true);
    setValidationErrors(new Map());

    try {
      const changeInfos: PendingChangeInfo[] = changes.map((c) => ({
        id: c.id,
        table: c.table,
        schema: c.schema,
        rowId: c.rowId,
        type: c.type,
        oldValues: c.oldValues,
        newValues: c.newValues,
        primaryKeyColumn: c.primaryKeyColumn,
      }));

      const response = await sqlPro.db.validateChanges({
        connectionId,
        changes: changeInfos,
      });

      if (!response.success) {
        throw new Error(response.error || 'Validation failed');
      }

      const errors = new Map<string, string>();
      let allValid = true;

      for (const result of response.results || []) {
        if (!result.isValid) {
          allValid = false;
          errors.set(result.changeId, result.error || 'Validation failed');
        }

        // Update the change in the collection
        pendingChangesCollection.update(result.changeId, (draft) => {
          draft.isValid = result.isValid;
          draft.validationError = result.error;
        });
      }

      setValidationErrors(errors);
      return allValid;
    } catch (error) {
      console.error('[validateChanges] Error:', error);
      return false;
    } finally {
      setIsValidating(false);
    }
  }, [connectionId, changes]);

  const applyChanges = useCallback(async (): Promise<boolean> => {
    // Get current changes directly to avoid stale closure
    const currentChanges = getAllPendingChanges().filter(
      (c) => !table || (c.table === table && c.schema === schema)
    );

    if (!connectionId || currentChanges.length === 0) {
      return true;
    }

    // Validate first
    const isValid = await validateChanges();
    if (!isValid) {
      return false;
    }

    setIsApplying(true);

    try {
      // Re-fetch changes after validation to get the latest state
      const changesToApply = getAllPendingChanges().filter(
        (c) => !table || (c.table === table && c.schema === schema)
      );

      const changeInfos: PendingChangeInfo[] = changesToApply.map((c) => ({
        id: c.id,
        table: c.table,
        schema: c.schema,
        rowId: c.rowId,
        type: c.type,
        oldValues: c.oldValues,
        newValues: c.newValues,
        primaryKeyColumn: c.primaryKeyColumn,
      }));

      const response = await sqlPro.db.applyChanges({
        connectionId,
        changes: changeInfos,
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to apply changes');
      }

      // Clear all applied changes
      clearPendingChanges(table, schema);

      return true;
    } catch (error) {
      console.error('[applyChanges] Error:', error);
      return false;
    } finally {
      setIsApplying(false);
    }
  }, [connectionId, schema, table, validateChanges]);

  const removeChange = useCallback((id: string) => {
    pendingChangesCollection.delete(id);
    setValidationErrors((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const clearAllChanges = useCallback(() => {
    clearPendingChanges(table, schema);
    setValidationErrors(new Map());
  }, [table, schema]);

  const undoLastChange = useCallback(() => {
    if (changes.length === 0) return;

    // Find the most recent change
    const sortedChanges = [...changes].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
    const lastChange = sortedChanges[0];

    if (lastChange) {
      removeChange(lastChange.id);
    }
  }, [changes, removeChange]);

  return {
    changes,
    hasChanges: changes.length > 0,
    changeCount: changes.length,
    isValidating,
    validationErrors,
    validateChanges,
    isApplying,
    applyChanges,
    removeChange,
    clearAllChanges,
    undoLastChange,
  };
}

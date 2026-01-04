import type { ChangeType, PendingChange } from '@/types/database';
import { create } from 'zustand';

interface ChangesState {
  // Pending changes (now includes connectionId)
  changes: PendingChange[];

  // Validation state
  isValidating: boolean;
  isApplying: boolean;

  // Actions
  addChange: (
    change: Omit<PendingChange, 'id' | 'timestamp' | 'isValid'>
  ) => void;
  updateChange: (id: string, updates: Partial<PendingChange>) => void;
  removeChange: (id: string) => void;
  clearChanges: () => void;
  clearChangesForConnection: (connectionId: string) => void;
  setValidationResult: (
    results: Array<{ changeId: string; isValid: boolean; error?: string }>
  ) => void;
  setIsValidating: (isValidating: boolean) => void;
  setIsApplying: (isApplying: boolean) => void;

  // Computed
  hasChanges: () => boolean;
  hasChangesForConnection: (connectionId: string) => boolean;
  getChangesForTable: (table: string, connectionId?: string) => PendingChange[];
  getChangesForConnection: (connectionId: string) => PendingChange[];
  getChangeForRow: (
    table: string,
    rowId: string | number,
    connectionId?: string
  ) => PendingChange | undefined;
}

let changeIdCounter = 0;
function generateChangeId(): string {
  changeIdCounter += 1;
  return `change_${changeIdCounter}_${Math.random().toString(36).substring(2, 7)}`;
}

export const useChangesStore = create<ChangesState>((set, get) => ({
  changes: [],
  isValidating: false,
  isApplying: false,

  addChange: (change) => {
    const existingChange = get().getChangeForRow(
      change.table,
      change.rowId,
      change.connectionId
    );

    if (existingChange) {
      // Merge with existing change
      if (change.type === 'delete') {
        // If we're deleting a newly inserted row, just remove the insert
        if (existingChange.type === 'insert') {
          set((state) => ({
            changes: state.changes.filter((c) => c.id !== existingChange.id),
          }));
          return;
        }
        // Otherwise, update to delete
        set((state) => ({
          changes: state.changes.map((c) =>
            c.id === existingChange.id
              ? {
                  ...c,
                  type: 'delete' as ChangeType,
                  newValues: null,
                  timestamp: new Date(),
                }
              : c
          ),
        }));
      } else if (change.type === 'update') {
        // Merge updates
        set((state) => ({
          changes: state.changes.map((c) =>
            c.id === existingChange.id
              ? {
                  ...c,
                  newValues: { ...c.newValues, ...change.newValues },
                  timestamp: new Date(),
                }
              : c
          ),
        }));
      } else if (change.type === 'insert' && existingChange.type === 'insert') {
        // Update existing insert with new values
        set((state) => ({
          changes: state.changes.map((c) =>
            c.id === existingChange.id
              ? {
                  ...c,
                  newValues: { ...c.newValues, ...change.newValues },
                  timestamp: new Date(),
                }
              : c
          ),
        }));
      }
    } else {
      // Add new change
      const newChange: PendingChange = {
        ...change,
        id: generateChangeId(),
        timestamp: new Date(),
        isValid: true,
      };
      set((state) => ({
        changes: [...state.changes, newChange],
      }));
    }
  },

  updateChange: (id, updates) =>
    set((state) => ({
      changes: state.changes.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    })),

  removeChange: (id) =>
    set((state) => ({
      changes: state.changes.filter((c) => c.id !== id),
    })),

  clearChanges: () => set({ changes: [] }),

  clearChangesForConnection: (connectionId) =>
    set((state) => ({
      changes: state.changes.filter((c) => c.connectionId !== connectionId),
    })),

  setValidationResult: (results) =>
    set((state) => ({
      changes: state.changes.map((c) => {
        const result = results.find((r) => r.changeId === c.id);
        if (result) {
          return {
            ...c,
            isValid: result.isValid,
            validationError: result.error,
          };
        }
        return c;
      }),
    })),

  setIsValidating: (isValidating) => set({ isValidating }),
  setIsApplying: (isApplying) => set({ isApplying }),

  hasChanges: () => get().changes.length > 0,

  hasChangesForConnection: (connectionId) =>
    get().changes.some((c) => c.connectionId === connectionId),

  getChangesForTable: (table, connectionId) => {
    const changes = get().changes.filter((c) => c.table === table);
    if (connectionId) {
      return changes.filter((c) => c.connectionId === connectionId);
    }
    return changes;
  },

  getChangesForConnection: (connectionId) =>
    get().changes.filter((c) => c.connectionId === connectionId),

  getChangeForRow: (table, rowId, connectionId) => {
    const changes = get().changes;
    if (connectionId) {
      return changes.find(
        (c) =>
          c.table === table &&
          c.rowId === rowId &&
          c.connectionId === connectionId
      );
    }
    return changes.find((c) => c.table === table && c.rowId === rowId);
  },
}));

import type { PendingChange } from '@/types/database';
import { create } from 'zustand';

interface UndoRedoEntry {
  id: string;
  timestamp: number;
  type: 'change' | 'batch';
  description: string;
  changes: PendingChange[];
}

interface UndoRedoState {
  // History stacks
  undoStack: UndoRedoEntry[];
  redoStack: UndoRedoEntry[];
  maxHistorySize: number;

  // Current batch for grouping multiple changes
  currentBatch: PendingChange[] | null;
  batchDescription: string | null;

  // Actions
  pushChange: (change: PendingChange, description?: string) => void;
  pushBatch: (changes: PendingChange[], description: string) => void;
  startBatch: (description: string) => void;
  addToBatch: (change: PendingChange) => void;
  commitBatch: () => void;
  cancelBatch: () => void;
  undo: () => UndoRedoEntry | null;
  redo: () => UndoRedoEntry | null;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clearHistory: () => void;
  getUndoDescription: () => string | null;
  getRedoDescription: () => string | null;
}

const generateId = (): string => {
  return `entry-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

const formatChangeDescription = (change: PendingChange): string => {
  switch (change.type) {
    case 'insert':
      return `Insert row in ${change.table}`;
    case 'update':
      return `Update row in ${change.table}`;
    case 'delete':
      return `Delete row from ${change.table}`;
    default:
      return `Change in ${change.table}`;
  }
};

export const useUndoRedoStore = create<UndoRedoState>((set, get) => ({
  undoStack: [],
  redoStack: [],
  maxHistorySize: 50,
  currentBatch: null,
  batchDescription: null,

  pushChange: (change, description) => {
    const state = get();

    // If we're in a batch, add to batch instead
    if (state.currentBatch !== null) {
      set({ currentBatch: [...state.currentBatch, change] });
      return;
    }

    const entry: UndoRedoEntry = {
      id: generateId(),
      timestamp: Date.now(),
      type: 'change',
      description: description || formatChangeDescription(change),
      changes: [change],
    };

    set((state) => ({
      undoStack: [entry, ...state.undoStack].slice(0, state.maxHistorySize),
      redoStack: [], // Clear redo stack when new change is made
    }));
  },

  pushBatch: (changes, description) => {
    if (changes.length === 0) return;

    const entry: UndoRedoEntry = {
      id: generateId(),
      timestamp: Date.now(),
      type: 'batch',
      description,
      changes,
    };

    set((state) => ({
      undoStack: [entry, ...state.undoStack].slice(0, state.maxHistorySize),
      redoStack: [], // Clear redo stack when new change is made
    }));
  },

  startBatch: (description) => {
    set({
      currentBatch: [],
      batchDescription: description,
    });
  },

  addToBatch: (change) => {
    const state = get();
    if (state.currentBatch === null) {
      // If not in a batch, just push as single change
      get().pushChange(change);
      return;
    }
    set({ currentBatch: [...state.currentBatch, change] });
  },

  commitBatch: () => {
    const state = get();
    if (state.currentBatch === null || state.currentBatch.length === 0) {
      set({ currentBatch: null, batchDescription: null });
      return;
    }

    const entry: UndoRedoEntry = {
      id: generateId(),
      timestamp: Date.now(),
      type: 'batch',
      description: state.batchDescription || 'Batch changes',
      changes: state.currentBatch,
    };

    set((currentState) => ({
      undoStack: [entry, ...currentState.undoStack].slice(
        0,
        currentState.maxHistorySize
      ),
      redoStack: [],
      currentBatch: null,
      batchDescription: null,
    }));
  },

  cancelBatch: () => {
    set({ currentBatch: null, batchDescription: null });
  },

  undo: () => {
    const state = get();
    if (state.undoStack.length === 0) return null;

    const [entry, ...restUndo] = state.undoStack;

    set({
      undoStack: restUndo,
      redoStack: [entry, ...state.redoStack].slice(0, state.maxHistorySize),
    });

    return entry;
  },

  redo: () => {
    const state = get();
    if (state.redoStack.length === 0) return null;

    const [entry, ...restRedo] = state.redoStack;

    set({
      redoStack: restRedo,
      undoStack: [entry, ...state.undoStack].slice(0, state.maxHistorySize),
    });

    return entry;
  },

  canUndo: () => {
    return get().undoStack.length > 0;
  },

  canRedo: () => {
    return get().redoStack.length > 0;
  },

  clearHistory: () => {
    set({
      undoStack: [],
      redoStack: [],
      currentBatch: null,
      batchDescription: null,
    });
  },

  getUndoDescription: () => {
    const state = get();
    if (state.undoStack.length === 0) return null;
    return state.undoStack[0].description;
  },

  getRedoDescription: () => {
    const state = get();
    if (state.redoStack.length === 0) return null;
    return state.redoStack[0].description;
  },
}));

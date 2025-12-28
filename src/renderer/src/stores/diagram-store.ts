import type { DiagramViewport, NodePosition } from '@/types/er-diagram';
import { create } from 'zustand';

interface DiagramState {
  // Per-database node positions (keyed by database path)
  nodePositionsMap: Record<string, Record<string, NodePosition>>;

  // Per-database viewport state
  viewportMap: Record<string, DiagramViewport>;

  // Display options
  showColumns: boolean;
  showTypes: boolean;

  // Actions
  setNodePosition: (
    dbPath: string,
    nodeId: string,
    position: NodePosition
  ) => void;
  setNodePositions: (
    dbPath: string,
    positions: Record<string, NodePosition>
  ) => void;
  getNodePositions: (dbPath: string) => Record<string, NodePosition>;
  setViewport: (dbPath: string, viewport: DiagramViewport) => void;
  getViewport: (dbPath: string) => DiagramViewport | undefined;
  resetLayout: (dbPath: string) => void;
  setShowColumns: (show: boolean) => void;
  setShowTypes: (show: boolean) => void;
}

// Load initial state from localStorage
function loadPersistedState(): {
  nodePositionsMap: Record<string, Record<string, NodePosition>>;
  viewportMap: Record<string, DiagramViewport>;
} {
  try {
    const stored = localStorage.getItem('er-diagram-state');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return { nodePositionsMap: {}, viewportMap: {} };
}

// Persist state to localStorage (debounced externally if needed)
function persistState(
  nodePositionsMap: Record<string, Record<string, NodePosition>>,
  viewportMap: Record<string, DiagramViewport>
) {
  try {
    localStorage.setItem(
      'er-diagram-state',
      JSON.stringify({ nodePositionsMap, viewportMap })
    );
  } catch {
    // Ignore storage errors
  }
}

const initialPersistedState = loadPersistedState();

export const useDiagramStore = create<DiagramState>((set, get) => ({
  nodePositionsMap: initialPersistedState.nodePositionsMap,
  viewportMap: initialPersistedState.viewportMap,
  showColumns: true,
  showTypes: true,

  setNodePosition: (dbPath, nodeId, position) => {
    set((state) => {
      const dbPositions = state.nodePositionsMap[dbPath] || {};
      const newNodePositionsMap = {
        ...state.nodePositionsMap,
        [dbPath]: {
          ...dbPositions,
          [nodeId]: position,
        },
      };
      persistState(newNodePositionsMap, state.viewportMap);
      return { nodePositionsMap: newNodePositionsMap };
    });
  },

  setNodePositions: (dbPath, positions) => {
    set((state) => {
      const newNodePositionsMap = {
        ...state.nodePositionsMap,
        [dbPath]: positions,
      };
      persistState(newNodePositionsMap, state.viewportMap);
      return { nodePositionsMap: newNodePositionsMap };
    });
  },

  getNodePositions: (dbPath) => {
    return get().nodePositionsMap[dbPath] || {};
  },

  setViewport: (dbPath, viewport) => {
    set((state) => {
      const newViewportMap = {
        ...state.viewportMap,
        [dbPath]: viewport,
      };
      persistState(state.nodePositionsMap, newViewportMap);
      return { viewportMap: newViewportMap };
    });
  },

  getViewport: (dbPath) => {
    return get().viewportMap[dbPath];
  },

  resetLayout: (dbPath) => {
    set((state) => {
      const { [dbPath]: _removed, ...restPositions } = state.nodePositionsMap;
      const { [dbPath]: _removedViewport, ...restViewports } =
        state.viewportMap;
      persistState(restPositions, restViewports);
      return {
        nodePositionsMap: restPositions,
        viewportMap: restViewports,
      };
    });
  },

  setShowColumns: (show) => set({ showColumns: show }),
  setShowTypes: (show) => set({ showTypes: show }),
}));

import type { DiagramViewport, NodePosition } from '@/types/er-diagram';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createHybridStorage } from '@/lib/electron-storage';

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

export const useDiagramStore = create<DiagramState>()(
  persist(
    (set, get) => ({
      nodePositionsMap: {},
      viewportMap: {},
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
          return { nodePositionsMap: newNodePositionsMap };
        });
      },

      setNodePositions: (dbPath, positions) => {
        set((state) => {
          const newNodePositionsMap = {
            ...state.nodePositionsMap,
            [dbPath]: positions,
          };
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
          return { viewportMap: newViewportMap };
        });
      },

      getViewport: (dbPath) => {
        return get().viewportMap[dbPath];
      },

      resetLayout: (dbPath) => {
        set((state) => {
          const { [dbPath]: _removed, ...restPositions } =
            state.nodePositionsMap;
          const { [dbPath]: _removedViewport, ...restViewports } =
            state.viewportMap;
          return {
            nodePositionsMap: restPositions,
            viewportMap: restViewports,
          };
        });
      },

      setShowColumns: (show) => set({ showColumns: show }),
      setShowTypes: (show) => set({ showTypes: show }),
    }),
    {
      name: 'diagram', // Store key in electron-store
      storage: createHybridStorage('diagram'),
      version: 1,
      partialize: (state) => ({
        nodePositionsMap: state.nodePositionsMap,
        viewportMap: state.viewportMap,
        showColumns: state.showColumns,
        showTypes: state.showTypes,
      }),
    }
  )
);

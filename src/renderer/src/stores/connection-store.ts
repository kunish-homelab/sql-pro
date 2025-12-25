import { create } from 'zustand';
import type {
  DatabaseConnection,
  DatabaseSchema,
  TableSchema,
} from '@/types/database';

interface ConnectionState {
  // Current connection
  connection: DatabaseConnection | null;
  schema: DatabaseSchema | null;
  selectedTable: TableSchema | null;

  // Recent connections
  recentConnections: Array<{
    path: string;
    filename: string;
    isEncrypted: boolean;
    lastOpened: string;
  }>;

  // Loading states
  isConnecting: boolean;
  isLoadingSchema: boolean;

  // Error state
  error: string | null;

  // Actions
  setConnection: (connection: DatabaseConnection | null) => void;
  setSchema: (schema: DatabaseSchema | null) => void;
  setSelectedTable: (table: TableSchema | null) => void;
  setRecentConnections: (
    connections: Array<{
      path: string;
      filename: string;
      isEncrypted: boolean;
      lastOpened: string;
    }>
  ) => void;
  setIsConnecting: (isConnecting: boolean) => void;
  setIsLoadingSchema: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  connection: null,
  schema: null,
  selectedTable: null,
  recentConnections: [],
  isConnecting: false,
  isLoadingSchema: false,
  error: null,
};

export const useConnectionStore = create<ConnectionState>((set) => ({
  ...initialState,

  setConnection: (connection) => set({ connection, error: null }),
  setSchema: (schema) => set({ schema }),
  setSelectedTable: (selectedTable) => set({ selectedTable }),
  setRecentConnections: (recentConnections) => set({ recentConnections }),
  setIsConnecting: (isConnecting) => set({ isConnecting }),
  setIsLoadingSchema: (isLoadingSchema) => set({ isLoadingSchema }),
  setError: (error) => set({ error }),
  reset: () => set(initialState),
}));

import type { RecentConnection } from '../../../shared/types';
import type {
  DatabaseConnection,
  DatabaseSchema,
  TableSchema,
} from '@/types/database';
import { create } from 'zustand';

interface ConnectionState {
  // Current connection
  connection: DatabaseConnection | null;
  schema: DatabaseSchema | null;
  selectedTable: TableSchema | null;
  selectedSchemaObject: TableSchema | null;

  // Recent connections (using shared type with new fields)
  recentConnections: RecentConnection[];

  // Loading states
  isConnecting: boolean;
  isLoadingSchema: boolean;

  // Error state
  error: string | null;

  // Actions
  setConnection: (connection: DatabaseConnection | null) => void;
  setSchema: (schema: DatabaseSchema | null) => void;
  setSelectedTable: (table: TableSchema | null) => void;
  setSelectedSchemaObject: (schemaObject: TableSchema | null) => void;
  setRecentConnections: (connections: RecentConnection[]) => void;
  setIsConnecting: (isConnecting: boolean) => void;
  setIsLoadingSchema: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  connection: null,
  schema: null,
  selectedTable: null,
  selectedSchemaObject: null,
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
  setSelectedSchemaObject: (selectedSchemaObject) => set({ selectedSchemaObject }),
  setRecentConnections: (recentConnections) => set({ recentConnections }),
  setIsConnecting: (isConnecting) => set({ isConnecting }),
  setIsLoadingSchema: (isLoadingSchema) => set({ isLoadingSchema }),
  setError: (error) => set({ error }),
  reset: () => set(initialState),
}));

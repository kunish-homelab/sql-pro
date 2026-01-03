import type {
  ConnectionProfile,
  ProfileFolder,
  RecentConnection,
} from '@shared/types';
import type {
  DatabaseConnection,
  DatabaseSchema,
  TableSchema,
} from '@/types/database';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createConnectionStorage } from '@/lib/electron-storage';
import { useChangesStore } from './changes-store';

interface ConnectionState {
  // Multiple connections support
  connections: Map<string, DatabaseConnection>;
  activeConnectionId: string | null;

  // Tab order for connection tabs UI
  connectionTabOrder: string[];

  // Connection colors for visual distinction (connectionId -> hex color)
  connectionColors: Record<string, string>;

  // Schema per connection
  schemas: Map<string, DatabaseSchema>;

  // Selected table (for the active connection)
  selectedTable: TableSchema | null;
  selectedSchemaObject: TableSchema | null;

  // Recent connections (using shared type with new fields)
  recentConnections: RecentConnection[];

  // Profile management
  profiles: Map<string, ConnectionProfile>;
  folders: Map<string, ProfileFolder>;
  selectedProfileId: string | null;
  expandedFolderIds: Set<string>;

  // Loading states
  isConnecting: boolean;
  isLoadingSchema: boolean;

  // Error state
  error: string | null;

  // Connection Actions
  addConnection: (connection: DatabaseConnection) => void;
  removeConnection: (id: string) => void;
  setActiveConnection: (id: string | null) => void;
  updateConnection: (id: string, updates: Partial<DatabaseConnection>) => void;
  reorderConnections: (fromIndex: number, toIndex: number) => void;
  setConnectionColor: (id: string, color: string) => void;

  // Schema Actions
  setSchema: (connectionId: string, schema: DatabaseSchema | null) => void;

  // Selection Actions
  setSelectedTable: (table: TableSchema | null) => void;
  setSelectedSchemaObject: (schemaObject: TableSchema | null) => void;

  // Recent Connections Actions
  setRecentConnections: (connections: RecentConnection[]) => void;

  // Profile Actions
  addProfile: (profile: ConnectionProfile) => void;
  updateProfile: (id: string, updates: Partial<ConnectionProfile>) => void;
  deleteProfile: (id: string) => void;
  selectProfile: (id: string | null) => void;
  setProfiles: (profiles: ConnectionProfile[]) => void;

  // Folder Actions
  addFolder: (folder: ProfileFolder) => void;
  updateFolder: (id: string, updates: Partial<ProfileFolder>) => void;
  deleteFolder: (id: string) => void;
  toggleFolderExpanded: (id: string) => void;
  setFolders: (folders: ProfileFolder[]) => void;

  // Loading State Actions
  setIsConnecting: (isConnecting: boolean) => void;
  setIsLoadingSchema: (isLoading: boolean) => void;

  // Error Actions
  setError: (error: string | null) => void;

  // Reset
  reset: () => void;

  // Computed getters
  getConnection: () => DatabaseConnection | null;
  getSchema: () => DatabaseSchema | null;
  getConnectionById: (id: string) => DatabaseConnection | undefined;
  getSchemaByConnectionId: (id: string) => DatabaseSchema | undefined;
  getAllConnections: () => DatabaseConnection[];
  getConnectionColor: (id: string) => string | undefined;
  hasUnsavedChanges: (connectionId: string) => boolean;

  // Profile getters
  getProfileById: (id: string) => ConnectionProfile | undefined;
  getAllProfiles: () => ConnectionProfile[];
  getProfilesByFolder: (folderId?: string) => ConnectionProfile[];

  // Folder getters
  getFolderById: (id: string) => ProfileFolder | undefined;
  getAllFolders: () => ProfileFolder[];
  getSubfolders: (parentId?: string) => ProfileFolder[];

  // Legacy compatibility
  connection: DatabaseConnection | null;
  schema: DatabaseSchema | null;
  setConnection: (connection: DatabaseConnection | null) => void;
}

const initialState = {
  connections: new Map<string, DatabaseConnection>(),
  activeConnectionId: null,
  connectionTabOrder: [],
  connectionColors: {},
  schemas: new Map<string, DatabaseSchema>(),
  selectedTable: null,
  selectedSchemaObject: null,
  recentConnections: [],
  profiles: new Map<string, ConnectionProfile>(),
  folders: new Map<string, ProfileFolder>(),
  selectedProfileId: null,
  expandedFolderIds: new Set<string>(),
  isConnecting: false,
  isLoadingSchema: false,
  error: null,
  // Legacy compatibility - computed from active connection
  connection: null,
  schema: null,
};

export const useConnectionStore = create<ConnectionState>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Connection Actions
      addConnection: (connection) =>
        set((state) => {
          const newConnections = new Map(state.connections);
          newConnections.set(connection.id, connection);

          // Add to tab order if not already present
          const newTabOrder = state.connectionTabOrder.includes(connection.id)
            ? state.connectionTabOrder
            : [...state.connectionTabOrder, connection.id];

          return {
            connections: newConnections,
            activeConnectionId: connection.id,
            connectionTabOrder: newTabOrder,
            // Clear selected table when switching to new connection
            selectedTable: null,
            selectedSchemaObject: null,
            // Legacy compatibility
            connection,
            schema: null,
            error: null,
          };
        }),

      removeConnection: (id) =>
        set((state) => {
          const newConnections = new Map(state.connections);
          newConnections.delete(id);

          const newSchemas = new Map(state.schemas);
          newSchemas.delete(id);

          // Remove from tab order
          const newTabOrder = state.connectionTabOrder.filter(
            (connId) => connId !== id
          );

          // Remove from connection colors
          const { [id]: _, ...newConnectionColors } = state.connectionColors;

          // If removing the active connection, switch to another one or null
          let newActiveId = state.activeConnectionId;
          let newConnection: DatabaseConnection | null = null;
          let newSchema: DatabaseSchema | null = null;

          if (state.activeConnectionId === id) {
            const remainingIds = Array.from(newConnections.keys());
            newActiveId = remainingIds.length > 0 ? remainingIds[0] : null;
            newConnection = newActiveId
              ? newConnections.get(newActiveId) || null
              : null;
            newSchema = newActiveId
              ? newSchemas.get(newActiveId) || null
              : null;
          } else {
            newConnection = state.activeConnectionId
              ? newConnections.get(state.activeConnectionId) || null
              : null;
            newSchema = state.activeConnectionId
              ? newSchemas.get(state.activeConnectionId) || null
              : null;
          }

          return {
            connections: newConnections,
            schemas: newSchemas,
            activeConnectionId: newActiveId,
            connectionTabOrder: newTabOrder,
            connectionColors: newConnectionColors,
            selectedTable:
              state.activeConnectionId === id ? null : state.selectedTable,
            selectedSchemaObject:
              state.activeConnectionId === id
                ? null
                : state.selectedSchemaObject,
            // Legacy compatibility
            connection: newConnection,
            schema: newSchema,
          };
        }),

      setActiveConnection: (id) =>
        set((state) => {
          if (id === null) {
            return {
              activeConnectionId: null,
              selectedTable: null,
              selectedSchemaObject: null,
              // Legacy compatibility
              connection: null,
              schema: null,
            };
          }

          const connection = state.connections.get(id);
          if (!connection) return state;

          return {
            activeConnectionId: id,
            selectedTable: null,
            selectedSchemaObject: null,
            // Legacy compatibility
            connection,
            schema: state.schemas.get(id) || null,
          };
        }),

      updateConnection: (id, updates) =>
        set((state) => {
          const existingConnection = state.connections.get(id);
          if (!existingConnection) return state;

          const updatedConnection = { ...existingConnection, ...updates };
          const newConnections = new Map(state.connections);
          newConnections.set(id, updatedConnection);

          return {
            connections: newConnections,
            // Legacy compatibility
            connection:
              state.activeConnectionId === id
                ? updatedConnection
                : state.connection,
          };
        }),

      reorderConnections: (fromIndex, toIndex) =>
        set((state) => {
          const newTabOrder = [...state.connectionTabOrder];
          const [movedId] = newTabOrder.splice(fromIndex, 1);
          newTabOrder.splice(toIndex, 0, movedId);

          return {
            connectionTabOrder: newTabOrder,
          };
        }),

      setConnectionColor: (id, color) =>
        set((state) => {
          // Validate hex color format: #RGB or #RRGGBB
          const hexColorRegex = /^#(?:[A-F0-9]{6}|[A-F0-9]{3})$/i;
          if (!hexColorRegex.test(color)) {
            // Invalid color, don't update state
            return state;
          }

          return {
            connectionColors: {
              ...state.connectionColors,
              [id]: color,
            },
          };
        }),

      // Schema Actions
      setSchema: (connectionId, schema) =>
        set((state) => {
          const newSchemas = new Map(state.schemas);
          if (schema) {
            newSchemas.set(connectionId, schema);
          } else {
            newSchemas.delete(connectionId);
          }

          return {
            schemas: newSchemas,
            // Legacy compatibility
            schema:
              state.activeConnectionId === connectionId ? schema : state.schema,
          };
        }),

      // Selection Actions
      setSelectedTable: (selectedTable) => set({ selectedTable }),
      setSelectedSchemaObject: (selectedSchemaObject) =>
        set({ selectedSchemaObject }),

      // Recent Connections Actions
      setRecentConnections: (recentConnections) => set({ recentConnections }),

      // Profile Actions
      addProfile: (profile) =>
        set((state) => {
          const newProfiles = new Map(state.profiles);
          newProfiles.set(profile.id, profile);
          return { profiles: newProfiles };
        }),

      updateProfile: (id, updates) =>
        set((state) => {
          const existingProfile = state.profiles.get(id);
          if (!existingProfile) return state;

          const updatedProfile = { ...existingProfile, ...updates };
          const newProfiles = new Map(state.profiles);
          newProfiles.set(id, updatedProfile);

          return { profiles: newProfiles };
        }),

      deleteProfile: (id) =>
        set((state) => {
          const newProfiles = new Map(state.profiles);
          newProfiles.delete(id);

          return {
            profiles: newProfiles,
            selectedProfileId:
              state.selectedProfileId === id ? null : state.selectedProfileId,
          };
        }),

      selectProfile: (id) => set({ selectedProfileId: id }),

      setProfiles: (profiles) =>
        set(() => {
          const profileMap = new Map<string, ConnectionProfile>();
          profiles.forEach((profile) => {
            profileMap.set(profile.id, profile);
          });
          return { profiles: profileMap };
        }),

      // Folder Actions
      addFolder: (folder) =>
        set((state) => {
          const newFolders = new Map(state.folders);
          newFolders.set(folder.id, folder);
          return { folders: newFolders };
        }),

      updateFolder: (id, updates) =>
        set((state) => {
          const existingFolder = state.folders.get(id);
          if (!existingFolder) return state;

          const updatedFolder = { ...existingFolder, ...updates };
          const newFolders = new Map(state.folders);
          newFolders.set(id, updatedFolder);

          return { folders: newFolders };
        }),

      deleteFolder: (id) =>
        set((state) => {
          const newFolders = new Map(state.folders);
          newFolders.delete(id);

          const newExpandedFolderIds = new Set(state.expandedFolderIds);
          newExpandedFolderIds.delete(id);

          return {
            folders: newFolders,
            expandedFolderIds: newExpandedFolderIds,
          };
        }),

      toggleFolderExpanded: (id) =>
        set((state) => {
          const newExpandedFolderIds = new Set(state.expandedFolderIds);
          if (newExpandedFolderIds.has(id)) {
            newExpandedFolderIds.delete(id);
          } else {
            newExpandedFolderIds.add(id);
          }
          return { expandedFolderIds: newExpandedFolderIds };
        }),

      setFolders: (folders) =>
        set(() => {
          const folderMap = new Map<string, ProfileFolder>();
          folders.forEach((folder) => {
            folderMap.set(folder.id, folder);
          });
          return { folders: folderMap };
        }),

      // Loading State Actions
      setIsConnecting: (isConnecting) => set({ isConnecting }),
      setIsLoadingSchema: (isLoadingSchema) => set({ isLoadingSchema }),

      // Error Actions
      setError: (error) => set({ error }),

      // Reset - clears all state
      reset: () =>
        set({
          connections: new Map(),
          activeConnectionId: null,
          connectionTabOrder: [],
          connectionColors: {},
          schemas: new Map(),
          selectedTable: null,
          selectedSchemaObject: null,
          recentConnections: [],
          profiles: get().profiles, // Keep profiles
          folders: get().folders, // Keep folders
          selectedProfileId: null,
          expandedFolderIds: get().expandedFolderIds, // Keep folder expansion state
          isConnecting: false,
          isLoadingSchema: false,
          error: null,
          // Legacy compatibility
          connection: null,
          schema: null,
        }),

      // Computed getters
      getConnection: () => {
        const state = get();
        if (!state.activeConnectionId) return null;
        return state.connections.get(state.activeConnectionId) || null;
      },

      getSchema: () => {
        const state = get();
        if (!state.activeConnectionId) return null;
        return state.schemas.get(state.activeConnectionId) || null;
      },

      getConnectionById: (id) => {
        return get().connections.get(id);
      },

      getSchemaByConnectionId: (id) => {
        return get().schemas.get(id);
      },

      getAllConnections: () => {
        return Array.from(get().connections.values());
      },

      getConnectionColor: (id) => {
        return get().connectionColors[id];
      },

      hasUnsavedChanges: (connectionId) => {
        const changesStore = useChangesStore.getState();
        return changesStore.hasChangesForConnection(connectionId);
      },

      // Profile getters
      getProfileById: (id) => {
        return get().profiles.get(id);
      },

      getAllProfiles: () => {
        return Array.from(get().profiles.values());
      },

      getProfilesByFolder: (folderId) => {
        return Array.from(get().profiles.values()).filter(
          (profile) => profile.folderId === folderId
        );
      },

      // Folder getters
      getFolderById: (id) => {
        return get().folders.get(id);
      },

      getAllFolders: () => {
        return Array.from(get().folders.values());
      },

      getSubfolders: (parentId) => {
        return Array.from(get().folders.values()).filter(
          (folder) => folder.parentId === parentId
        );
      },

      // Legacy compatibility
      setConnection: (connection) =>
        set({
          connection,
        }),
    }),
    {
      name: 'connection-store',
      version: 2, // Bump version for electron-store migration
      storage: createConnectionStorage(),
    }
  )
);

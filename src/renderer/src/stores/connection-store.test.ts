import type { RecentConnection } from '@shared/types';
import type {
  DatabaseConnection,
  DatabaseSchema,
  TableSchema,
} from '@/types/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useChangesStore } from './changes-store';
import { useConnectionStore } from './connection-store';

// Helper function to create a mock DatabaseConnection
function createMockConnection(
  overrides: Partial<DatabaseConnection> = {}
): DatabaseConnection {
  return {
    id: 'test-connection-id',
    path: '/path/to/database.sqlite',
    filename: 'database.sqlite',
    isEncrypted: false,
    isReadOnly: false,
    status: 'connected',
    connectedAt: new Date(),
    ...overrides,
  };
}

// Helper function to create a mock TableSchema
function createMockTableSchema(
  overrides: Partial<TableSchema> = {}
): TableSchema {
  return {
    name: 'users',
    schema: 'main',
    type: 'table',
    columns: [
      {
        name: 'id',
        type: 'INTEGER',
        nullable: false,
        defaultValue: null,
        isPrimaryKey: true,
      },
      {
        name: 'name',
        type: 'TEXT',
        nullable: true,
        defaultValue: null,
        isPrimaryKey: false,
      },
    ],
    primaryKey: ['id'],
    foreignKeys: [],
    indexes: [],
    triggers: [],
    rowCount: 100,
    sql: 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)',
    ...overrides,
  };
}

// Helper function to create a mock DatabaseSchema
function createMockDatabaseSchema(
  overrides: Partial<DatabaseSchema> = {}
): DatabaseSchema {
  const usersTable = createMockTableSchema({ name: 'users' });
  const ordersTable = createMockTableSchema({ name: 'orders' });
  const usersView = createMockTableSchema({ name: 'users_view', type: 'view' });

  return {
    schemas: [
      {
        name: 'main',
        tables: [usersTable, ordersTable],
        views: [usersView],
      },
    ],
    tables: [usersTable, ordersTable],
    views: [usersView],
    ...overrides,
  };
}

// Helper function to create a mock RecentConnection
function createMockRecentConnection(
  overrides: Partial<RecentConnection> = {}
): RecentConnection {
  return {
    path: '/path/to/database.sqlite',
    filename: 'database.sqlite',
    isEncrypted: false,
    lastOpened: new Date().toISOString(),
    displayName: 'My Database',
    readOnly: false,
    ...overrides,
  };
}

describe('connection-store', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useConnectionStore.setState({
      connections: new Map(),
      activeConnectionId: null,
      connectionTabOrder: [],
      connectionColors: {},
      schemas: new Map(),
      selectedTable: null,
      selectedSchemaObject: null,
      recentConnections: [],
      profiles: new Map(),
      folders: new Map(),
      selectedProfileId: null,
      expandedFolderIds: new Set(),
      isConnecting: false,
      isLoadingSchema: false,
      error: null,
      // Legacy compatibility
      connection: null,
      schema: null,
    });
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have null connection', () => {
      const { connection } = useConnectionStore.getState();
      expect(connection).toBeNull();
    });

    it('should have null schema', () => {
      const { schema } = useConnectionStore.getState();
      expect(schema).toBeNull();
    });

    it('should have null selectedTable', () => {
      const { selectedTable } = useConnectionStore.getState();
      expect(selectedTable).toBeNull();
    });

    it('should have null selectedSchemaObject', () => {
      const { selectedSchemaObject } = useConnectionStore.getState();
      expect(selectedSchemaObject).toBeNull();
    });

    it('should have empty recentConnections array', () => {
      const { recentConnections } = useConnectionStore.getState();
      expect(recentConnections).toEqual([]);
    });

    it('should have isConnecting as false', () => {
      const { isConnecting } = useConnectionStore.getState();
      expect(isConnecting).toBe(false);
    });

    it('should have isLoadingSchema as false', () => {
      const { isLoadingSchema } = useConnectionStore.getState();
      expect(isLoadingSchema).toBe(false);
    });

    it('should have null error', () => {
      const { error } = useConnectionStore.getState();
      expect(error).toBeNull();
    });
  });

  describe('setConnection', () => {
    it('should set connection', () => {
      const mockConnection = createMockConnection();
      const { setConnection } = useConnectionStore.getState();

      setConnection(mockConnection);

      const { connection } = useConnectionStore.getState();
      expect(connection).toEqual(mockConnection);
    });

    it('should clear connection when set to null', () => {
      const mockConnection = createMockConnection();
      const { setConnection } = useConnectionStore.getState();

      setConnection(mockConnection);
      setConnection(null);

      const { connection } = useConnectionStore.getState();
      expect(connection).toBeNull();
    });

    it('should clear error when connection is set', () => {
      const { setError, setConnection } = useConnectionStore.getState();

      // Set an error first
      setError('Some error');
      expect(useConnectionStore.getState().error).toBe('Some error');

      // Setting connection should clear the error
      setConnection(createMockConnection());
      expect(useConnectionStore.getState().error).toBeNull();
    });

    it('should not clear error when connection is set to null', () => {
      const { setError, setConnection } = useConnectionStore.getState();

      setError('Some error');
      setConnection(null);

      // Error is not cleared when connection is removed
      expect(useConnectionStore.getState().error).toBe('Some error');
    });
  });

  describe('setSchema', () => {
    it('should set schema', () => {
      const mockSchema = createMockDatabaseSchema();
      const mockConnection = createMockConnection();
      const { setSchema, addConnection } = useConnectionStore.getState();

      addConnection(mockConnection);
      setSchema(mockConnection.id, mockSchema);

      const { schema } = useConnectionStore.getState();
      expect(schema).toEqual(mockSchema);
    });

    it('should clear schema when set to null', () => {
      const mockSchema = createMockDatabaseSchema();
      const mockConnection = createMockConnection();
      const { setSchema, addConnection } = useConnectionStore.getState();

      addConnection(mockConnection);
      setSchema(mockConnection.id, mockSchema);
      setSchema(mockConnection.id, null);

      const { schema } = useConnectionStore.getState();
      expect(schema).toBeNull();
    });

    it('should update schema with new value', () => {
      const mockConnection = createMockConnection();
      const { setSchema, addConnection } = useConnectionStore.getState();

      addConnection(mockConnection);

      const schema1 = createMockDatabaseSchema();
      const schema2 = createMockDatabaseSchema({
        tables: [createMockTableSchema({ name: 'new_table' })],
      });

      setSchema(mockConnection.id, schema1);
      expect(useConnectionStore.getState().schema?.tables[0].name).toBe(
        'users'
      );

      setSchema(mockConnection.id, schema2);
      expect(useConnectionStore.getState().schema?.tables[0].name).toBe(
        'new_table'
      );
    });
  });

  describe('setSelectedTable', () => {
    it('should set selectedTable', () => {
      const mockTable = createMockTableSchema();
      const { setSelectedTable } = useConnectionStore.getState();

      setSelectedTable(mockTable);

      const { selectedTable } = useConnectionStore.getState();
      expect(selectedTable).toEqual(mockTable);
    });

    it('should clear selectedTable when set to null', () => {
      const mockTable = createMockTableSchema();
      const { setSelectedTable } = useConnectionStore.getState();

      setSelectedTable(mockTable);
      setSelectedTable(null);

      const { selectedTable } = useConnectionStore.getState();
      expect(selectedTable).toBeNull();
    });

    it('should allow changing selectedTable to a different table', () => {
      const { setSelectedTable } = useConnectionStore.getState();

      const table1 = createMockTableSchema({ name: 'users' });
      const table2 = createMockTableSchema({ name: 'orders' });

      setSelectedTable(table1);
      expect(useConnectionStore.getState().selectedTable?.name).toBe('users');

      setSelectedTable(table2);
      expect(useConnectionStore.getState().selectedTable?.name).toBe('orders');
    });
  });

  describe('setSelectedSchemaObject', () => {
    it('should set selectedSchemaObject', () => {
      const mockTable = createMockTableSchema();
      const { setSelectedSchemaObject } = useConnectionStore.getState();

      setSelectedSchemaObject(mockTable);

      const { selectedSchemaObject } = useConnectionStore.getState();
      expect(selectedSchemaObject).toEqual(mockTable);
    });

    it('should clear selectedSchemaObject when set to null', () => {
      const mockTable = createMockTableSchema();
      const { setSelectedSchemaObject } = useConnectionStore.getState();

      setSelectedSchemaObject(mockTable);
      setSelectedSchemaObject(null);

      const { selectedSchemaObject } = useConnectionStore.getState();
      expect(selectedSchemaObject).toBeNull();
    });

    it('should allow setting a view as selectedSchemaObject', () => {
      const { setSelectedSchemaObject } = useConnectionStore.getState();

      const view = createMockTableSchema({ name: 'my_view', type: 'view' });
      setSelectedSchemaObject(view);

      const { selectedSchemaObject } = useConnectionStore.getState();
      expect(selectedSchemaObject?.type).toBe('view');
      expect(selectedSchemaObject?.name).toBe('my_view');
    });
  });

  describe('setRecentConnections', () => {
    it('should set recentConnections', () => {
      const mockConnections = [
        createMockRecentConnection({ filename: 'db1.sqlite' }),
        createMockRecentConnection({ filename: 'db2.sqlite' }),
      ];
      const { setRecentConnections } = useConnectionStore.getState();

      setRecentConnections(mockConnections);

      const { recentConnections } = useConnectionStore.getState();
      expect(recentConnections).toEqual(mockConnections);
      expect(recentConnections).toHaveLength(2);
    });

    it('should clear recentConnections when set to empty array', () => {
      const mockConnections = [createMockRecentConnection()];
      const { setRecentConnections } = useConnectionStore.getState();

      setRecentConnections(mockConnections);
      expect(useConnectionStore.getState().recentConnections).toHaveLength(1);

      setRecentConnections([]);
      expect(useConnectionStore.getState().recentConnections).toHaveLength(0);
    });

    it('should replace existing recentConnections', () => {
      const { setRecentConnections } = useConnectionStore.getState();

      const oldConnections = [
        createMockRecentConnection({ filename: 'old.sqlite' }),
      ];
      const newConnections = [
        createMockRecentConnection({ filename: 'new.sqlite' }),
      ];

      setRecentConnections(oldConnections);
      setRecentConnections(newConnections);

      const { recentConnections } = useConnectionStore.getState();
      expect(recentConnections).toHaveLength(1);
      expect(recentConnections[0].filename).toBe('new.sqlite');
    });
  });

  describe('setIsConnecting', () => {
    it('should set isConnecting to true', () => {
      const { setIsConnecting } = useConnectionStore.getState();

      setIsConnecting(true);

      const { isConnecting } = useConnectionStore.getState();
      expect(isConnecting).toBe(true);
    });

    it('should set isConnecting to false', () => {
      const { setIsConnecting } = useConnectionStore.getState();

      setIsConnecting(true);
      setIsConnecting(false);

      const { isConnecting } = useConnectionStore.getState();
      expect(isConnecting).toBe(false);
    });
  });

  describe('setIsLoadingSchema', () => {
    it('should set isLoadingSchema to true', () => {
      const { setIsLoadingSchema } = useConnectionStore.getState();

      setIsLoadingSchema(true);

      const { isLoadingSchema } = useConnectionStore.getState();
      expect(isLoadingSchema).toBe(true);
    });

    it('should set isLoadingSchema to false', () => {
      const { setIsLoadingSchema } = useConnectionStore.getState();

      setIsLoadingSchema(true);
      setIsLoadingSchema(false);

      const { isLoadingSchema } = useConnectionStore.getState();
      expect(isLoadingSchema).toBe(false);
    });
  });

  describe('setError', () => {
    it('should set error message', () => {
      const { setError } = useConnectionStore.getState();

      setError('Connection failed');

      const { error } = useConnectionStore.getState();
      expect(error).toBe('Connection failed');
    });

    it('should clear error when set to null', () => {
      const { setError } = useConnectionStore.getState();

      setError('Some error');
      setError(null);

      const { error } = useConnectionStore.getState();
      expect(error).toBeNull();
    });

    it('should update error message', () => {
      const { setError } = useConnectionStore.getState();

      setError('First error');
      expect(useConnectionStore.getState().error).toBe('First error');

      setError('Second error');
      expect(useConnectionStore.getState().error).toBe('Second error');
    });
  });

  describe('reset', () => {
    it('should reset all state to initial values', () => {
      const {
        addConnection,
        setSchema,
        setSelectedTable,
        setSelectedSchemaObject,
        setRecentConnections,
        setIsConnecting,
        setIsLoadingSchema,
        setError,
        reset,
      } = useConnectionStore.getState();

      // Set all state values
      const mockConnection = createMockConnection();
      addConnection(mockConnection);
      setSchema(mockConnection.id, createMockDatabaseSchema());
      setSelectedTable(createMockTableSchema());
      setSelectedSchemaObject(createMockTableSchema({ name: 'orders' }));
      setRecentConnections([createMockRecentConnection()]);
      setIsConnecting(true);
      setIsLoadingSchema(true);
      setError('Some error');

      // Verify state is set
      let state = useConnectionStore.getState();
      expect(state.connection).not.toBeNull();
      expect(state.schema).not.toBeNull();
      expect(state.selectedTable).not.toBeNull();
      expect(state.selectedSchemaObject).not.toBeNull();
      expect(state.recentConnections).toHaveLength(1);
      expect(state.isConnecting).toBe(true);
      expect(state.isLoadingSchema).toBe(true);
      expect(state.error).toBe('Some error');

      // Reset
      reset();

      // Verify all state is reset
      state = useConnectionStore.getState();
      expect(state.connection).toBeNull();
      expect(state.schema).toBeNull();
      expect(state.selectedTable).toBeNull();
      expect(state.selectedSchemaObject).toBeNull();
      expect(state.recentConnections).toHaveLength(1); // Recent connections are preserved
      expect(state.isConnecting).toBe(false);
      expect(state.isLoadingSchema).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should be callable multiple times without error', () => {
      const { reset } = useConnectionStore.getState();

      expect(() => {
        reset();
        reset();
        reset();
      }).not.toThrow();
    });
  });

  describe('store API', () => {
    it('should expose getState method', () => {
      expect(typeof useConnectionStore.getState).toBe('function');
    });

    it('should expose setState method', () => {
      expect(typeof useConnectionStore.setState).toBe('function');
    });

    it('should expose subscribe method', () => {
      expect(typeof useConnectionStore.subscribe).toBe('function');
    });

    it('should allow subscribing to state changes', () => {
      const listener = vi.fn();
      const unsubscribe = useConnectionStore.subscribe(listener);

      const { setConnection } = useConnectionStore.getState();
      setConnection(createMockConnection());

      expect(listener).toHaveBeenCalled();

      unsubscribe();
    });

    it('should stop receiving updates after unsubscribe', () => {
      const listener = vi.fn();
      const unsubscribe = useConnectionStore.subscribe(listener);

      unsubscribe();
      listener.mockClear();

      const { setConnection } = useConnectionStore.getState();
      setConnection(createMockConnection());

      expect(listener).not.toHaveBeenCalled();
    });

    it('should allow direct setState updates', () => {
      useConnectionStore.setState({ isConnecting: true });

      expect(useConnectionStore.getState().isConnecting).toBe(true);
    });

    it('should allow partial setState updates', () => {
      useConnectionStore.setState({ isConnecting: true, error: 'Test error' });

      const state = useConnectionStore.getState();
      expect(state.isConnecting).toBe(true);
      expect(state.error).toBe('Test error');
      // Other state should remain unchanged
      expect(state.connection).toBeNull();
    });
  });

  describe('concurrent updates', () => {
    it('should handle rapid state changes correctly', () => {
      const { setIsConnecting, setError } = useConnectionStore.getState();

      setIsConnecting(true);
      setError('Error 1');
      setIsConnecting(false);
      setError('Error 2');
      setIsConnecting(true);
      setError(null);

      const state = useConnectionStore.getState();
      expect(state.isConnecting).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should maintain state consistency during multiple updates', () => {
      const { addConnection, setSchema, setSelectedTable } =
        useConnectionStore.getState();

      const connection = createMockConnection();
      const schema = createMockDatabaseSchema();
      const table = createMockTableSchema();

      addConnection(connection);
      setSchema(connection.id, schema);
      setSelectedTable(table);

      const state = useConnectionStore.getState();
      expect(state.connection).toEqual(connection);
      expect(state.schema).toEqual(schema);
      expect(state.selectedTable).toEqual(table);
    });
  });

  describe('profile loading and syncing', () => {
    it('should load profiles from array', () => {
      const { setProfiles, getAllProfiles } = useConnectionStore.getState();

      const profiles = [
        {
          id: 'profile-1',
          path: '/path/to/db1.sqlite',
          filename: 'db1.sqlite',
          isEncrypted: false,
          lastOpened: new Date().toISOString(),
          displayName: 'Profile 1',
          readOnly: false,
          createdAt: new Date().toISOString(),
          isSaved: true,
        },
        {
          id: 'profile-2',
          path: '/path/to/db2.sqlite',
          filename: 'db2.sqlite',
          isEncrypted: false,
          lastOpened: new Date().toISOString(),
          displayName: 'Profile 2',
          readOnly: false,
          createdAt: new Date().toISOString(),
          folderId: 'folder-1',
          isSaved: true,
        },
      ];

      setProfiles(profiles);

      const loadedProfiles = getAllProfiles();
      expect(loadedProfiles).toHaveLength(2);
      expect(loadedProfiles.find((p) => p.id === 'profile-1')).toBeDefined();
      expect(loadedProfiles.find((p) => p.id === 'profile-2')).toBeDefined();
    });

    it('should load folders from array', () => {
      const { setFolders, getAllFolders } = useConnectionStore.getState();

      const folders = [
        {
          id: 'folder-1',
          name: 'Production',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'folder-2',
          name: 'Development',
          createdAt: new Date().toISOString(),
          parentId: 'folder-1',
        },
      ];

      setFolders(folders);

      const loadedFolders = getAllFolders();
      expect(loadedFolders).toHaveLength(2);
      expect(loadedFolders.find((f) => f.id === 'folder-1')).toBeDefined();
      expect(loadedFolders.find((f) => f.id === 'folder-2')).toBeDefined();
    });

    it('should sync profile updates correctly', () => {
      const { setProfiles, updateProfile, getProfileById } =
        useConnectionStore.getState();

      const initialProfiles = [
        {
          id: 'profile-1',
          path: '/path/to/db1.sqlite',
          filename: 'db1.sqlite',
          isEncrypted: false,
          lastOpened: new Date().toISOString(),
          displayName: 'Initial Name',
          readOnly: false,
          createdAt: new Date().toISOString(),
          isSaved: true,
        },
      ];

      setProfiles(initialProfiles);

      // Update the profile
      updateProfile('profile-1', {
        displayName: 'Updated Name',
        notes: 'New notes',
      });

      const updated = getProfileById('profile-1');
      expect(updated?.displayName).toBe('Updated Name');
      expect(updated?.notes).toBe('New notes');
      expect(updated?.path).toBe('/path/to/db1.sqlite'); // Unchanged fields remain
    });

    it('should sync folder updates correctly', () => {
      const { setFolders, updateFolder, getFolderById } =
        useConnectionStore.getState();

      const initialFolders = [
        {
          id: 'folder-1',
          name: 'Old Name',
          createdAt: new Date().toISOString(),
        },
      ];

      setFolders(initialFolders);

      // Update the folder
      updateFolder('folder-1', { name: 'New Name' });

      const updated = getFolderById('folder-1');
      expect(updated?.name).toBe('New Name');
      expect(updated?.id).toBe('folder-1'); // ID should not change
    });

    it('should handle adding new profiles after initial load', () => {
      const { setProfiles, addProfile, getAllProfiles } =
        useConnectionStore.getState();

      // Initial load
      setProfiles([
        {
          id: 'profile-1',
          path: '/path/to/db1.sqlite',
          filename: 'db1.sqlite',
          isEncrypted: false,
          lastOpened: new Date().toISOString(),
          displayName: 'Profile 1',
          readOnly: false,
          isSaved: true,
          createdAt: new Date().toISOString(),
        },
      ]);

      expect(getAllProfiles()).toHaveLength(1);

      // Add new profile
      addProfile({
        id: 'profile-2',
        path: '/path/to/db2.sqlite',
        filename: 'db2.sqlite',
        isEncrypted: false,
        lastOpened: new Date().toISOString(),
        displayName: 'Profile 2',
        readOnly: false,
        isSaved: true,
        createdAt: new Date().toISOString(),
      });

      const profiles = getAllProfiles();
      expect(profiles).toHaveLength(2);
      expect(profiles.find((p) => p.id === 'profile-2')).toBeDefined();
    });

    it('should handle deleting profiles and maintain sync', () => {
      const { setProfiles, deleteProfile, getAllProfiles, getProfileById } =
        useConnectionStore.getState();

      setProfiles([
        {
          id: 'profile-1',
          path: '/path/to/db1.sqlite',
          filename: 'db1.sqlite',
          isEncrypted: false,
          lastOpened: new Date().toISOString(),
          displayName: 'Profile 1',
          readOnly: false,
          isSaved: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'profile-2',
          path: '/path/to/db2.sqlite',
          filename: 'db2.sqlite',
          isEncrypted: false,
          lastOpened: new Date().toISOString(),
          displayName: 'Profile 2',
          readOnly: false,
          isSaved: true,
          createdAt: new Date().toISOString(),
        },
      ]);

      expect(getAllProfiles()).toHaveLength(2);

      deleteProfile('profile-1');

      expect(getAllProfiles()).toHaveLength(1);
      expect(getProfileById('profile-1')).toBeUndefined();
      expect(getProfileById('profile-2')).toBeDefined();
    });

    it('should reload profiles completely when setProfiles called', () => {
      const { setProfiles, getAllProfiles } = useConnectionStore.getState();

      // Initial load
      setProfiles([
        {
          id: 'profile-1',
          path: '/path/to/db1.sqlite',
          filename: 'db1.sqlite',
          isEncrypted: false,
          lastOpened: new Date().toISOString(),
          displayName: 'Profile 1',
          readOnly: false,
          isSaved: true,
          createdAt: new Date().toISOString(),
        },
      ]);

      expect(getAllProfiles()).toHaveLength(1);

      // Reload with different data
      setProfiles([
        {
          id: 'profile-2',
          path: '/path/to/db2.sqlite',
          filename: 'db2.sqlite',
          isEncrypted: false,
          lastOpened: new Date().toISOString(),
          displayName: 'Profile 2',
          readOnly: false,
          isSaved: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'profile-3',
          path: '/path/to/db3.sqlite',
          filename: 'db3.sqlite',
          isEncrypted: false,
          lastOpened: new Date().toISOString(),
          displayName: 'Profile 3',
          readOnly: false,
          isSaved: true,
          createdAt: new Date().toISOString(),
        },
      ]);

      const profiles = getAllProfiles();
      expect(profiles).toHaveLength(2);
      expect(profiles.find((p) => p.id === 'profile-1')).toBeUndefined();
      expect(profiles.find((p) => p.id === 'profile-2')).toBeDefined();
      expect(profiles.find((p) => p.id === 'profile-3')).toBeDefined();
    });

    it('should filter profiles by folder correctly', () => {
      const { setProfiles, getProfilesByFolder } =
        useConnectionStore.getState();

      setProfiles([
        {
          id: 'profile-1',
          path: '/path/to/db1.sqlite',
          filename: 'db1.sqlite',
          isEncrypted: false,
          lastOpened: new Date().toISOString(),
          displayName: 'Profile 1',
          readOnly: false,
          isSaved: true,
          createdAt: new Date().toISOString(),
          folderId: 'folder-1',
        },
        {
          id: 'profile-2',
          path: '/path/to/db2.sqlite',
          filename: 'db2.sqlite',
          isEncrypted: false,
          lastOpened: new Date().toISOString(),
          displayName: 'Profile 2',
          readOnly: false,
          isSaved: true,
          createdAt: new Date().toISOString(),
          folderId: 'folder-1',
        },
        {
          id: 'profile-3',
          path: '/path/to/db3.sqlite',
          filename: 'db3.sqlite',
          isEncrypted: false,
          lastOpened: new Date().toISOString(),
          displayName: 'Profile 3',
          readOnly: false,
          isSaved: true,
          createdAt: new Date().toISOString(),
          folderId: 'folder-2',
        },
        {
          id: 'profile-4',
          path: '/path/to/db4.sqlite',
          filename: 'db4.sqlite',
          isEncrypted: false,
          lastOpened: new Date().toISOString(),
          displayName: 'Profile 4',
          readOnly: false,
          isSaved: true,
          createdAt: new Date().toISOString(),
        },
      ]);

      const folder1Profiles = getProfilesByFolder('folder-1');
      expect(folder1Profiles).toHaveLength(2);
      expect(folder1Profiles.every((p) => p.folderId === 'folder-1')).toBe(
        true
      );

      const folder2Profiles = getProfilesByFolder('folder-2');
      expect(folder2Profiles).toHaveLength(1);

      const rootProfiles = getProfilesByFolder(undefined);
      expect(rootProfiles).toHaveLength(1);
      expect(rootProfiles[0].id).toBe('profile-4');
    });

    it('should maintain selected profile during sync', () => {
      const {
        setProfiles,
        selectProfile,
        selectedProfileId: _selectedProfileId,
      } = useConnectionStore.getState();

      setProfiles([
        {
          id: 'profile-1',
          path: '/path/to/db1.sqlite',
          filename: 'db1.sqlite',
          isEncrypted: false,
          lastOpened: new Date().toISOString(),
          displayName: 'Profile 1',
          readOnly: false,
          isSaved: true,
          createdAt: new Date().toISOString(),
        },
      ]);

      selectProfile('profile-1');
      expect(useConnectionStore.getState().selectedProfileId).toBe('profile-1');

      // Reload profiles (simulating sync from storage)
      setProfiles([
        {
          id: 'profile-1',
          path: '/path/to/db1.sqlite',
          filename: 'db1.sqlite',
          isEncrypted: false,
          lastOpened: new Date().toISOString(),
          displayName: 'Profile 1 Updated',
          readOnly: false,
          isSaved: true,
          createdAt: new Date().toISOString(),
        },
      ]);

      // Selection should be maintained
      expect(useConnectionStore.getState().selectedProfileId).toBe('profile-1');
    });

    it('should clear selected profile when deleted', () => {
      const { setProfiles, selectProfile, deleteProfile } =
        useConnectionStore.getState();

      setProfiles([
        {
          id: 'profile-1',
          path: '/path/to/db1.sqlite',
          filename: 'db1.sqlite',
          isEncrypted: false,
          lastOpened: new Date().toISOString(),
          displayName: 'Profile 1',
          readOnly: false,
          isSaved: true,
          createdAt: new Date().toISOString(),
        },
      ]);

      selectProfile('profile-1');
      expect(useConnectionStore.getState().selectedProfileId).toBe('profile-1');

      deleteProfile('profile-1');
      expect(useConnectionStore.getState().selectedProfileId).toBeNull();
    });

    it('should handle empty profile list sync', () => {
      const { setProfiles, getAllProfiles } = useConnectionStore.getState();

      // Load some profiles first
      setProfiles([
        {
          id: 'profile-1',
          path: '/path/to/db1.sqlite',
          filename: 'db1.sqlite',
          isEncrypted: false,
          lastOpened: new Date().toISOString(),
          displayName: 'Profile 1',
          readOnly: false,
          createdAt: new Date().toISOString(),
          isSaved: true,
        },
      ]);

      expect(getAllProfiles()).toHaveLength(1);

      // Clear all profiles
      setProfiles([]);

      expect(getAllProfiles()).toHaveLength(0);
    });

    it('should get subfolders correctly', () => {
      const { setFolders, getSubfolders } = useConnectionStore.getState();

      setFolders([
        {
          id: 'folder-1',
          name: 'Root 1',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'folder-2',
          name: 'Child of 1',
          createdAt: new Date().toISOString(),
          parentId: 'folder-1',
        },
        {
          id: 'folder-3',
          name: 'Root 2',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'folder-4',
          name: 'Child of 1 also',
          createdAt: new Date().toISOString(),
          parentId: 'folder-1',
        },
      ]);

      const rootFolders = getSubfolders(undefined);
      expect(rootFolders).toHaveLength(2);
      expect(rootFolders.find((f) => f.id === 'folder-1')).toBeDefined();
      expect(rootFolders.find((f) => f.id === 'folder-3')).toBeDefined();

      const folder1Children = getSubfolders('folder-1');
      expect(folder1Children).toHaveLength(2);
      expect(folder1Children.every((f) => f.parentId === 'folder-1')).toBe(
        true
      );
    });
  });

  describe('edge cases', () => {
    it('should handle connection with error status', () => {
      const { setConnection } = useConnectionStore.getState();

      const errorConnection = createMockConnection({
        status: 'error',
        error: 'Database locked',
      });
      setConnection(errorConnection);

      const { connection } = useConnectionStore.getState();
      expect(connection?.status).toBe('error');
      expect(connection?.error).toBe('Database locked');
    });

    it('should handle encrypted connection', () => {
      const { setConnection } = useConnectionStore.getState();

      const encryptedConnection = createMockConnection({
        isEncrypted: true,
      });
      setConnection(encryptedConnection);

      const { connection } = useConnectionStore.getState();
      expect(connection?.isEncrypted).toBe(true);
    });

    it('should handle read-only connection', () => {
      const { setConnection } = useConnectionStore.getState();

      const readOnlyConnection = createMockConnection({
        isReadOnly: true,
      });
      setConnection(readOnlyConnection);

      const { connection } = useConnectionStore.getState();
      expect(connection?.isReadOnly).toBe(true);
    });

    it('should handle empty schema', () => {
      const mockConnection = createMockConnection();
      const { setSchema, addConnection } = useConnectionStore.getState();

      addConnection(mockConnection);

      const emptySchema = {
        schemas: [],
        tables: [],
        views: [],
      };

      setSchema(mockConnection.id, emptySchema);

      const { schema } = useConnectionStore.getState();
      expect(schema?.tables).toHaveLength(0);
      expect(schema?.views).toHaveLength(0);
    });

    it('should handle table with no columns', () => {
      const { setSelectedTable } = useConnectionStore.getState();

      const emptyTable = createMockTableSchema({
        columns: [],
        primaryKey: [],
      });
      setSelectedTable(emptyTable);

      const { selectedTable } = useConnectionStore.getState();
      expect(selectedTable?.columns).toHaveLength(0);
    });

    it('should handle recent connections with encrypted databases', () => {
      const { setRecentConnections } = useConnectionStore.getState();

      const encryptedRecent = createMockRecentConnection({
        isEncrypted: true,
        displayName: 'Encrypted DB',
      });
      setRecentConnections([encryptedRecent]);

      const { recentConnections } = useConnectionStore.getState();
      expect(recentConnections[0].isEncrypted).toBe(true);
    });

    it('should handle very long error messages', () => {
      const { setError } = useConnectionStore.getState();

      const longError = 'A'.repeat(10000);
      setError(longError);

      const { error } = useConnectionStore.getState();
      expect(error).toBe(longError);
      expect(error?.length).toBe(10000);
    });
  });

  describe('reorderConnections', () => {
    it('should reorder connections in tab order', () => {
      const { addConnection, reorderConnections } =
        useConnectionStore.getState();

      // Add three connections
      const conn1 = createMockConnection({
        id: 'conn-1',
        filename: 'db1.sqlite',
      });
      const conn2 = createMockConnection({
        id: 'conn-2',
        filename: 'db2.sqlite',
      });
      const conn3 = createMockConnection({
        id: 'conn-3',
        filename: 'db3.sqlite',
      });

      addConnection(conn1);
      addConnection(conn2);
      addConnection(conn3);

      // Verify initial order
      let state = useConnectionStore.getState();
      expect(state.connectionTabOrder).toEqual(['conn-1', 'conn-2', 'conn-3']);

      // Move first tab to last position (0 -> 2)
      reorderConnections(0, 2);

      state = useConnectionStore.getState();
      expect(state.connectionTabOrder).toEqual(['conn-2', 'conn-3', 'conn-1']);
    });

    it('should move tab from end to beginning', () => {
      const { addConnection, reorderConnections } =
        useConnectionStore.getState();

      const conn1 = createMockConnection({ id: 'conn-1' });
      const conn2 = createMockConnection({ id: 'conn-2' });
      const conn3 = createMockConnection({ id: 'conn-3' });

      addConnection(conn1);
      addConnection(conn2);
      addConnection(conn3);

      // Move last tab to first position (2 -> 0)
      reorderConnections(2, 0);

      const state = useConnectionStore.getState();
      expect(state.connectionTabOrder).toEqual(['conn-3', 'conn-1', 'conn-2']);
    });

    it('should move tab to middle position', () => {
      const { addConnection, reorderConnections } =
        useConnectionStore.getState();

      const conn1 = createMockConnection({ id: 'conn-1' });
      const conn2 = createMockConnection({ id: 'conn-2' });
      const conn3 = createMockConnection({ id: 'conn-3' });
      const conn4 = createMockConnection({ id: 'conn-4' });

      addConnection(conn1);
      addConnection(conn2);
      addConnection(conn3);
      addConnection(conn4);

      // Move first tab to middle (0 -> 2)
      reorderConnections(0, 2);

      const state = useConnectionStore.getState();
      expect(state.connectionTabOrder).toEqual([
        'conn-2',
        'conn-3',
        'conn-1',
        'conn-4',
      ]);
    });

    it('should handle adjacent tab swap', () => {
      const { addConnection, reorderConnections } =
        useConnectionStore.getState();

      const conn1 = createMockConnection({ id: 'conn-1' });
      const conn2 = createMockConnection({ id: 'conn-2' });
      const conn3 = createMockConnection({ id: 'conn-3' });

      addConnection(conn1);
      addConnection(conn2);
      addConnection(conn3);

      // Swap positions 0 and 1
      reorderConnections(0, 1);

      const state = useConnectionStore.getState();
      expect(state.connectionTabOrder).toEqual(['conn-2', 'conn-1', 'conn-3']);
    });

    it('should handle moving tab to same position (no-op)', () => {
      const { addConnection, reorderConnections } =
        useConnectionStore.getState();

      const conn1 = createMockConnection({ id: 'conn-1' });
      const conn2 = createMockConnection({ id: 'conn-2' });

      addConnection(conn1);
      addConnection(conn2);

      const initialOrder = useConnectionStore.getState().connectionTabOrder;

      // Move tab to same position
      reorderConnections(1, 1);

      const state = useConnectionStore.getState();
      expect(state.connectionTabOrder).toEqual(initialOrder);
      expect(state.connectionTabOrder).toEqual(['conn-1', 'conn-2']);
    });

    it('should preserve connections and activeConnectionId when reordering', () => {
      const { addConnection, reorderConnections } =
        useConnectionStore.getState();

      const conn1 = createMockConnection({ id: 'conn-1' });
      const conn2 = createMockConnection({ id: 'conn-2' });

      addConnection(conn1);
      addConnection(conn2);

      const beforeState = useConnectionStore.getState();
      const activeIdBefore = beforeState.activeConnectionId;
      const connectionsBefore = beforeState.connections;

      reorderConnections(0, 1);

      const afterState = useConnectionStore.getState();
      expect(afterState.activeConnectionId).toBe(activeIdBefore);
      expect(afterState.connections).toBe(connectionsBefore);
    });

    it('should handle reordering with many connections', () => {
      const { addConnection, reorderConnections } =
        useConnectionStore.getState();

      // Add 10 connections
      for (let i = 1; i <= 10; i++) {
        addConnection(createMockConnection({ id: `conn-${i}` }));
      }

      // Move connection from position 8 to position 2
      reorderConnections(8, 2);

      const state = useConnectionStore.getState();
      expect(state.connectionTabOrder[2]).toBe('conn-9');
      expect(state.connectionTabOrder).toHaveLength(10);
    });
  });

  describe('setConnectionColor', () => {
    it('should set connection color with valid hex color', () => {
      const { addConnection, setConnectionColor, getConnectionColor } =
        useConnectionStore.getState();

      const conn = createMockConnection({ id: 'conn-1' });
      addConnection(conn);

      setConnectionColor('conn-1', '#3b82f6');

      const color = getConnectionColor('conn-1');
      expect(color).toBe('#3b82f6');
    });

    it('should set connection color with short hex format', () => {
      const { addConnection, setConnectionColor, getConnectionColor } =
        useConnectionStore.getState();

      const conn = createMockConnection({ id: 'conn-1' });
      addConnection(conn);

      setConnectionColor('conn-1', '#f00');

      const color = getConnectionColor('conn-1');
      expect(color).toBe('#f00');
    });

    it('should update existing connection color', () => {
      const { addConnection, setConnectionColor, getConnectionColor } =
        useConnectionStore.getState();

      const conn = createMockConnection({ id: 'conn-1' });
      addConnection(conn);

      setConnectionColor('conn-1', '#3b82f6');
      expect(getConnectionColor('conn-1')).toBe('#3b82f6');

      setConnectionColor('conn-1', '#ef4444');
      expect(getConnectionColor('conn-1')).toBe('#ef4444');
    });

    it('should reject invalid hex color format', () => {
      const { addConnection, setConnectionColor, getConnectionColor } =
        useConnectionStore.getState();

      const conn = createMockConnection({ id: 'conn-1' });
      addConnection(conn);

      setConnectionColor('conn-1', 'invalid-color');

      const color = getConnectionColor('conn-1');
      expect(color).toBeUndefined();
    });

    it('should reject hex color without hash prefix', () => {
      const { addConnection, setConnectionColor, getConnectionColor } =
        useConnectionStore.getState();

      const conn = createMockConnection({ id: 'conn-1' });
      addConnection(conn);

      setConnectionColor('conn-1', '3b82f6');

      const color = getConnectionColor('conn-1');
      expect(color).toBeUndefined();
    });

    it('should reject color names instead of hex codes', () => {
      const { addConnection, setConnectionColor, getConnectionColor } =
        useConnectionStore.getState();

      const conn = createMockConnection({ id: 'conn-1' });
      addConnection(conn);

      setConnectionColor('conn-1', 'blue');

      const color = getConnectionColor('conn-1');
      expect(color).toBeUndefined();
    });

    it('should reject invalid hex lengths', () => {
      const { addConnection, setConnectionColor, getConnectionColor } =
        useConnectionStore.getState();

      const conn = createMockConnection({ id: 'conn-1' });
      addConnection(conn);

      // Too short
      setConnectionColor('conn-1', '#ff');
      expect(getConnectionColor('conn-1')).toBeUndefined();

      // Too long
      setConnectionColor('conn-1', '#ff00ff00');
      expect(getConnectionColor('conn-1')).toBeUndefined();
    });

    it('should handle multiple connections with different colors', () => {
      const { addConnection, setConnectionColor, getConnectionColor } =
        useConnectionStore.getState();

      const conn1 = createMockConnection({ id: 'conn-1' });
      const conn2 = createMockConnection({ id: 'conn-2' });
      const conn3 = createMockConnection({ id: 'conn-3' });

      addConnection(conn1);
      addConnection(conn2);
      addConnection(conn3);

      setConnectionColor('conn-1', '#3b82f6');
      setConnectionColor('conn-2', '#ef4444');
      setConnectionColor('conn-3', '#10b981');

      expect(getConnectionColor('conn-1')).toBe('#3b82f6');
      expect(getConnectionColor('conn-2')).toBe('#ef4444');
      expect(getConnectionColor('conn-3')).toBe('#10b981');
    });

    it('should return undefined for connection without color', () => {
      const { addConnection, getConnectionColor } =
        useConnectionStore.getState();

      const conn = createMockConnection({ id: 'conn-1' });
      addConnection(conn);

      const color = getConnectionColor('conn-1');
      expect(color).toBeUndefined();
    });

    it('should accept uppercase hex colors', () => {
      const { addConnection, setConnectionColor, getConnectionColor } =
        useConnectionStore.getState();

      const conn = createMockConnection({ id: 'conn-1' });
      addConnection(conn);

      setConnectionColor('conn-1', '#3B82F6');

      const color = getConnectionColor('conn-1');
      expect(color).toBe('#3B82F6');
    });

    it('should accept mixed case hex colors', () => {
      const { addConnection, setConnectionColor, getConnectionColor } =
        useConnectionStore.getState();

      const conn = createMockConnection({ id: 'conn-1' });
      addConnection(conn);

      setConnectionColor('conn-1', '#3b82F6');

      const color = getConnectionColor('conn-1');
      expect(color).toBe('#3b82F6');
    });
  });

  describe('removeConnection cleanup', () => {
    it('should remove connection from tab order', () => {
      const { addConnection, removeConnection } = useConnectionStore.getState();

      const conn1 = createMockConnection({ id: 'conn-1' });
      const conn2 = createMockConnection({ id: 'conn-2' });
      const conn3 = createMockConnection({ id: 'conn-3' });

      addConnection(conn1);
      addConnection(conn2);
      addConnection(conn3);

      // Verify initial tab order
      expect(useConnectionStore.getState().connectionTabOrder).toEqual([
        'conn-1',
        'conn-2',
        'conn-3',
      ]);

      // Remove middle connection
      removeConnection('conn-2');

      const state = useConnectionStore.getState();
      expect(state.connectionTabOrder).toEqual(['conn-1', 'conn-3']);
      expect(state.connectionTabOrder).not.toContain('conn-2');
    });

    it('should remove connection color when connection is removed', () => {
      const {
        addConnection,
        setConnectionColor,
        removeConnection,
        getConnectionColor,
      } = useConnectionStore.getState();

      const conn = createMockConnection({ id: 'conn-1' });
      addConnection(conn);
      setConnectionColor('conn-1', '#3b82f6');

      // Verify color is set
      expect(getConnectionColor('conn-1')).toBe('#3b82f6');

      // Remove connection
      removeConnection('conn-1');

      // Verify color is cleaned up
      expect(getConnectionColor('conn-1')).toBeUndefined();
    });

    it('should clean up both tab order and colors when removing connection', () => {
      const {
        addConnection,
        setConnectionColor,
        removeConnection,
        getConnectionColor,
      } = useConnectionStore.getState();

      const conn1 = createMockConnection({ id: 'conn-1' });
      const conn2 = createMockConnection({ id: 'conn-2' });

      addConnection(conn1);
      addConnection(conn2);
      setConnectionColor('conn-1', '#3b82f6');
      setConnectionColor('conn-2', '#ef4444');

      // Remove first connection
      removeConnection('conn-1');

      const state = useConnectionStore.getState();

      // Tab order should not contain conn-1
      expect(state.connectionTabOrder).not.toContain('conn-1');
      expect(state.connectionTabOrder).toContain('conn-2');

      // Color should be removed for conn-1 but remain for conn-2
      expect(getConnectionColor('conn-1')).toBeUndefined();
      expect(getConnectionColor('conn-2')).toBe('#ef4444');
    });

    it('should handle removing last connection in tab order', () => {
      const { addConnection, removeConnection } = useConnectionStore.getState();

      const conn = createMockConnection({ id: 'conn-1' });
      addConnection(conn);

      // Remove the only connection
      removeConnection('conn-1');

      const state = useConnectionStore.getState();
      expect(state.connectionTabOrder).toEqual([]);
      expect(state.activeConnectionId).toBeNull();
    });

    it('should preserve colors of other connections when removing one', () => {
      const {
        addConnection,
        setConnectionColor,
        removeConnection,
        getConnectionColor,
      } = useConnectionStore.getState();

      const conn1 = createMockConnection({ id: 'conn-1' });
      const conn2 = createMockConnection({ id: 'conn-2' });
      const conn3 = createMockConnection({ id: 'conn-3' });

      addConnection(conn1);
      addConnection(conn2);
      addConnection(conn3);

      setConnectionColor('conn-1', '#3b82f6');
      setConnectionColor('conn-2', '#ef4444');
      setConnectionColor('conn-3', '#10b981');

      // Remove middle connection
      removeConnection('conn-2');

      // Other colors should be preserved
      expect(getConnectionColor('conn-1')).toBe('#3b82f6');
      expect(getConnectionColor('conn-2')).toBeUndefined();
      expect(getConnectionColor('conn-3')).toBe('#10b981');
    });

    it('should switch to another connection when active connection is removed', () => {
      const { addConnection, removeConnection } = useConnectionStore.getState();

      const conn1 = createMockConnection({ id: 'conn-1' });
      const conn2 = createMockConnection({ id: 'conn-2' });

      addConnection(conn1);
      addConnection(conn2);

      // conn-2 is active (last added)
      expect(useConnectionStore.getState().activeConnectionId).toBe('conn-2');

      // Remove active connection
      removeConnection('conn-2');

      // Should switch to conn-1
      const state = useConnectionStore.getState();
      expect(state.activeConnectionId).toBe('conn-1');
    });

    it('should clean up selected table when active connection is removed', () => {
      const { addConnection, removeConnection, setSelectedTable } =
        useConnectionStore.getState();

      const conn = createMockConnection({ id: 'conn-1' });
      addConnection(conn);

      const table = createMockTableSchema();
      setSelectedTable(table);

      expect(useConnectionStore.getState().selectedTable).toEqual(table);

      // Remove active connection
      removeConnection('conn-1');

      // Selected table should be cleared
      expect(useConnectionStore.getState().selectedTable).toBeNull();
    });

    it('should clean up selected schema object when active connection is removed', () => {
      const { addConnection, removeConnection, setSelectedSchemaObject } =
        useConnectionStore.getState();

      const conn = createMockConnection({ id: 'conn-1' });
      addConnection(conn);

      const schemaObj = createMockTableSchema({ type: 'view' });
      setSelectedSchemaObject(schemaObj);

      expect(useConnectionStore.getState().selectedSchemaObject).toEqual(
        schemaObj
      );

      // Remove active connection
      removeConnection('conn-1');

      // Selected schema object should be cleared
      expect(useConnectionStore.getState().selectedSchemaObject).toBeNull();
    });

    it('should preserve selected table when removing non-active connection', () => {
      const {
        addConnection,
        setSelectedTable,
        removeConnection,
        setActiveConnection,
      } = useConnectionStore.getState();

      const conn1 = createMockConnection({ id: 'conn-1' });
      const conn2 = createMockConnection({ id: 'conn-2' });

      addConnection(conn1);
      addConnection(conn2);

      // Set conn-1 as active
      setActiveConnection('conn-1');

      const table = createMockTableSchema();
      setSelectedTable(table);

      // Remove non-active connection
      removeConnection('conn-2');

      // Selected table should be preserved
      expect(useConnectionStore.getState().selectedTable).toEqual(table);
    });

    it('should handle removing multiple connections in sequence', () => {
      const {
        addConnection,
        setConnectionColor,
        removeConnection,
        getConnectionColor,
      } = useConnectionStore.getState();

      const conn1 = createMockConnection({ id: 'conn-1' });
      const conn2 = createMockConnection({ id: 'conn-2' });
      const conn3 = createMockConnection({ id: 'conn-3' });

      addConnection(conn1);
      addConnection(conn2);
      addConnection(conn3);

      setConnectionColor('conn-1', '#3b82f6');
      setConnectionColor('conn-2', '#ef4444');
      setConnectionColor('conn-3', '#10b981');

      // Remove connections one by one
      removeConnection('conn-1');

      let state = useConnectionStore.getState();
      expect(state.connectionTabOrder).toEqual(['conn-2', 'conn-3']);
      expect(getConnectionColor('conn-1')).toBeUndefined();

      removeConnection('conn-2');

      state = useConnectionStore.getState();
      expect(state.connectionTabOrder).toEqual(['conn-3']);
      expect(getConnectionColor('conn-2')).toBeUndefined();

      removeConnection('conn-3');

      state = useConnectionStore.getState();
      expect(state.connectionTabOrder).toEqual([]);
      expect(getConnectionColor('conn-3')).toBeUndefined();
      expect(state.activeConnectionId).toBeNull();
    });
  });

  describe('tab order persistence', () => {
    it('should initialize connectionTabOrder as empty array', () => {
      const state = useConnectionStore.getState();
      expect(state.connectionTabOrder).toEqual([]);
    });

    it('should add new connections to tab order', () => {
      const { addConnection } = useConnectionStore.getState();

      const conn1 = createMockConnection({ id: 'conn-1' });
      const conn2 = createMockConnection({ id: 'conn-2' });

      addConnection(conn1);
      addConnection(conn2);

      const state = useConnectionStore.getState();
      expect(state.connectionTabOrder).toEqual(['conn-1', 'conn-2']);
    });

    it('should not duplicate connection IDs in tab order', () => {
      const { addConnection } = useConnectionStore.getState();

      const conn = createMockConnection({ id: 'conn-1' });

      addConnection(conn);
      addConnection(conn); // Add same connection again

      const state = useConnectionStore.getState();
      expect(state.connectionTabOrder).toEqual(['conn-1']);
      expect(
        state.connectionTabOrder.filter((id) => id === 'conn-1')
      ).toHaveLength(1);
    });

    it('should maintain tab order through multiple operations', () => {
      const { addConnection, reorderConnections, setConnectionColor } =
        useConnectionStore.getState();

      const conn1 = createMockConnection({ id: 'conn-1' });
      const conn2 = createMockConnection({ id: 'conn-2' });
      const conn3 = createMockConnection({ id: 'conn-3' });

      addConnection(conn1);
      addConnection(conn2);
      addConnection(conn3);

      // Reorder tabs
      reorderConnections(0, 2);

      // Set colors (shouldn't affect tab order)
      setConnectionColor('conn-1', '#3b82f6');
      setConnectionColor('conn-2', '#ef4444');

      const state = useConnectionStore.getState();
      expect(state.connectionTabOrder).toEqual(['conn-2', 'conn-3', 'conn-1']);
    });

    it('should clear tab order on reset', () => {
      const { addConnection, reset } = useConnectionStore.getState();

      const conn1 = createMockConnection({ id: 'conn-1' });
      const conn2 = createMockConnection({ id: 'conn-2' });

      addConnection(conn1);
      addConnection(conn2);

      expect(useConnectionStore.getState().connectionTabOrder).toHaveLength(2);

      reset();

      expect(useConnectionStore.getState().connectionTabOrder).toEqual([]);
    });

    it('should clear connection colors on reset', () => {
      const { addConnection, setConnectionColor, reset, getConnectionColor } =
        useConnectionStore.getState();

      const conn = createMockConnection({ id: 'conn-1' });
      addConnection(conn);
      setConnectionColor('conn-1', '#3b82f6');

      expect(getConnectionColor('conn-1')).toBe('#3b82f6');

      reset();

      expect(getConnectionColor('conn-1')).toBeUndefined();
      expect(useConnectionStore.getState().connectionColors).toEqual({});
    });

    it('should preserve tab order with empty connections map', () => {
      // Simulate scenario where tab order exists but connections are not loaded yet
      useConnectionStore.setState({
        connectionTabOrder: ['conn-1', 'conn-2', 'conn-3'],
        connections: new Map(),
      });

      const state = useConnectionStore.getState();
      expect(state.connectionTabOrder).toEqual(['conn-1', 'conn-2', 'conn-3']);
    });
  });

  describe('hasUnsavedChanges', () => {
    beforeEach(() => {
      // Clear changes store before each test
      useChangesStore.setState({ changes: [] });
    });

    it('should return true when changes exist for connection', () => {
      const { addConnection, hasUnsavedChanges } =
        useConnectionStore.getState();
      const { addChange } = useChangesStore.getState();

      const conn = createMockConnection({ id: 'conn-1' });
      addConnection(conn);

      // Add a change for this connection
      addChange({
        connectionId: 'conn-1',
        table: 'users',
        rowId: 1,
        type: 'update',
        newValues: { name: 'John Doe' },
        oldValues: { name: 'Jane Doe' },
      });

      expect(hasUnsavedChanges('conn-1')).toBe(true);
    });

    it('should return false when no changes exist for connection', () => {
      const { addConnection, hasUnsavedChanges } =
        useConnectionStore.getState();

      const conn = createMockConnection({ id: 'conn-1' });
      addConnection(conn);

      expect(hasUnsavedChanges('conn-1')).toBe(false);
    });

    it('should return false for connection with no changes when other connections have changes', () => {
      const { addConnection, hasUnsavedChanges } =
        useConnectionStore.getState();
      const { addChange } = useChangesStore.getState();

      const conn1 = createMockConnection({ id: 'conn-1' });
      const conn2 = createMockConnection({ id: 'conn-2' });

      addConnection(conn1);
      addConnection(conn2);

      // Add change only for conn-2
      addChange({
        connectionId: 'conn-2',
        table: 'users',
        rowId: 1,
        type: 'update',
        newValues: { name: 'John Doe' },
        oldValues: { name: 'Jane Doe' },
      });

      expect(hasUnsavedChanges('conn-1')).toBe(false);
      expect(hasUnsavedChanges('conn-2')).toBe(true);
    });

    it('should return true with multiple changes for connection', () => {
      const { addConnection, hasUnsavedChanges } =
        useConnectionStore.getState();
      const { addChange } = useChangesStore.getState();

      const conn = createMockConnection({ id: 'conn-1' });
      addConnection(conn);

      // Add multiple changes
      addChange({
        connectionId: 'conn-1',
        table: 'users',
        rowId: 1,
        type: 'update',
        newValues: { name: 'John Doe' },
        oldValues: { name: 'Jane Doe' },
      });

      addChange({
        connectionId: 'conn-1',
        table: 'users',
        rowId: 2,
        type: 'delete',
        newValues: null,
        oldValues: { id: 2, name: 'Bob' },
      });

      addChange({
        connectionId: 'conn-1',
        table: 'orders',
        rowId: 'new-1',
        type: 'insert',
        newValues: { product: 'Widget', quantity: 5 },
        oldValues: null,
      });

      expect(hasUnsavedChanges('conn-1')).toBe(true);
    });

    it('should return false after changes are cleared for connection', () => {
      const { addConnection, hasUnsavedChanges } =
        useConnectionStore.getState();
      const { addChange, clearChangesForConnection } =
        useChangesStore.getState();

      const conn = createMockConnection({ id: 'conn-1' });
      addConnection(conn);

      // Add a change
      addChange({
        connectionId: 'conn-1',
        table: 'users',
        rowId: 1,
        type: 'update',
        newValues: { name: 'John Doe' },
        oldValues: { name: 'Jane Doe' },
      });

      expect(hasUnsavedChanges('conn-1')).toBe(true);

      // Clear changes for this connection
      clearChangesForConnection('conn-1');

      expect(hasUnsavedChanges('conn-1')).toBe(false);
    });

    it('should handle different change types (insert, update, delete)', () => {
      const { addConnection, hasUnsavedChanges } =
        useConnectionStore.getState();
      const { addChange } = useChangesStore.getState();

      const conn = createMockConnection({ id: 'conn-1' });
      addConnection(conn);

      // Test insert
      addChange({
        connectionId: 'conn-1',
        table: 'users',
        rowId: 'new-1',
        type: 'insert',
        newValues: { name: 'New User' },
        oldValues: null,
      });
      expect(hasUnsavedChanges('conn-1')).toBe(true);

      useChangesStore.setState({ changes: [] });

      // Test update
      addChange({
        connectionId: 'conn-1',
        table: 'users',
        rowId: 1,
        type: 'update',
        newValues: { name: 'Updated User' },
        oldValues: { name: 'Old User' },
      });
      expect(hasUnsavedChanges('conn-1')).toBe(true);

      useChangesStore.setState({ changes: [] });

      // Test delete
      addChange({
        connectionId: 'conn-1',
        table: 'users',
        rowId: 1,
        type: 'delete',
        newValues: null,
        oldValues: { id: 1, name: 'Deleted User' },
      });
      expect(hasUnsavedChanges('conn-1')).toBe(true);
    });
  });
});

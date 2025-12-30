import type { RecentConnection } from '../../../shared/types';
import type {
  DatabaseConnection,
  DatabaseSchema,
  TableSchema,
} from '@/types/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
      connection: null,
      schema: null,
      selectedTable: null,
      selectedSchemaObject: null,
      recentConnections: [],
      isConnecting: false,
      isLoadingSchema: false,
      error: null,
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

    it('should clear error when connection is set to null', () => {
      const { setError, setConnection } = useConnectionStore.getState();

      setError('Some error');
      setConnection(null);

      expect(useConnectionStore.getState().error).toBeNull();
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
      expect(state.recentConnections).toEqual([]);
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
});

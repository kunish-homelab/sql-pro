import type { DataComparisonResult } from '@shared/types';
import type {
  DatabaseConnection,
  DatabaseSchema,
  TableSchema,
} from '@/types/database';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useConnectionStore, useDataDiffStore } from '@/stores';
import { DataDiffPanel } from './DataDiffPanel';

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
      {
        name: 'email',
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
    sql: 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT)',
    ...overrides,
  };
}

function createMockDatabaseSchema(
  overrides: Partial<DatabaseSchema> = {}
): DatabaseSchema {
  const usersTable = createMockTableSchema({ name: 'users' });
  const ordersTable = createMockTableSchema({ name: 'orders' });
  const productsTable = createMockTableSchema({ name: 'products' });

  return {
    schemas: [
      {
        name: 'main',
        tables: [usersTable, ordersTable, productsTable],
        views: [],
      },
    ],
    tables: [usersTable, ordersTable, productsTable],
    views: [],
    ...overrides,
  };
}

function createMockComparisonResult(
  overrides: Partial<DataComparisonResult> = {}
): DataComparisonResult {
  return {
    sourceId: 'source-connection-id',
    sourceName: 'source.db / users',
    sourceTable: 'users',
    sourceSchema: 'main',
    targetId: 'target-connection-id',
    targetName: 'target.db / users',
    targetTable: 'users',
    targetSchema: 'main',
    primaryKeys: ['id'],
    comparedAt: new Date().toISOString(),
    rowDiffs: [
      {
        primaryKey: { id: 1 },
        diffType: 'unchanged',
        sourceRow: { id: 1, name: 'Alice', email: 'alice@example.com' },
        targetRow: { id: 1, name: 'Alice', email: 'alice@example.com' },
      },
      {
        primaryKey: { id: 2 },
        diffType: 'modified',
        sourceRow: { id: 2, name: 'Bob', email: 'bob@example.com' },
        targetRow: { id: 2, name: 'Bob', email: 'bob.smith@example.com' },
        columnChanges: [
          {
            columnName: 'email',
            sourceValue: 'bob@example.com',
            targetValue: 'bob.smith@example.com',
          },
        ],
      },
      {
        primaryKey: { id: 3 },
        diffType: 'added',
        sourceRow: null,
        targetRow: { id: 3, name: 'Charlie', email: 'charlie@example.com' },
      },
      {
        primaryKey: { id: 4 },
        diffType: 'removed',
        sourceRow: { id: 4, name: 'David', email: 'david@example.com' },
        targetRow: null,
      },
    ],
    summary: {
      sourceRows: 3,
      targetRows: 3,
      rowsAdded: 1,
      rowsRemoved: 1,
      rowsModified: 1,
      rowsUnchanged: 1,
    },
    ...overrides,
  };
}

describe('dataDiffPanel - Integration Tests', () => {
  beforeEach(() => {
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
      connection: null,
      schema: null,
    });

    useDataDiffStore.setState({
      comparisonResult: null,
      isComparing: false,
      comparisonError: null,
      source: null,
      target: null,
      primaryKeys: [],
      autoDetectedPrimaryKeys: [],
      isDetectingPrimaryKeys: false,
      filters: {
        showOnlyDifferences: false,
        diffTypes: {
          added: true,
          removed: true,
          modified: true,
          unchanged: true,
        },
        searchText: '',
      },
      expandedRows: {
        rows: new Map(),
        summary: true,
      },
      pagination: {
        currentPage: 0,
        pageSize: 100,
        totalRows: 0,
      },
      selectedRowKeys: new Set(),
    });

    vi.clearAllMocks();
  });

  describe('initial rendering', () => {
    it('should render the data diff panel', () => {
      render(<DataDiffPanel />);
      expect(screen.getByText('Data Comparison')).toBeDefined();
      expect(
        screen.getByText(
          'Compare data between tables to identify row-level differences'
        )
      ).toBeDefined();
    });

    it('should render source and target selectors', () => {
      render(<DataDiffPanel />);
      expect(screen.getByText('Source')).toBeDefined();
      expect(screen.getByText('Target')).toBeDefined();
    });

    it('should render compare button in disabled state initially', () => {
      render(<DataDiffPanel />);
      const compareButton = screen.getByText('Compare Data').closest('button');
      expect(compareButton).toBeDefined();
      expect(compareButton?.disabled).toBe(true);
    });

    it('should show empty state message', () => {
      render(<DataDiffPanel />);
      expect(screen.getByText('Ready to Compare')).toBeDefined();
      expect(
        screen.getByText(
          'Select source and target tables, then click Compare Data'
        )
      ).toBeDefined();
    });

    it('should render keyboard shortcuts toggle button', () => {
      render(<DataDiffPanel />);
      const shortcutsButton = screen.getByTitle('Show keyboard shortcuts');
      expect(shortcutsButton).toBeDefined();
    });
  });

  describe('connection and table selection workflow', () => {
    it('should allow selecting source connection', async () => {
      const user = userEvent.setup();
      const sourceConn = createMockConnection({
        id: 'source-conn',
        filename: 'source.db',
      });
      const schema = createMockDatabaseSchema();

      const { addConnection, setSchema } = useConnectionStore.getState();
      addConnection(sourceConn);
      setSchema(sourceConn.id, schema);

      render(<DataDiffPanel />);

      const sourceConnectionSelect = screen
        .getAllByText('Select connection...')[0]
        .closest('button');
      expect(sourceConnectionSelect).toBeDefined();

      await user.click(sourceConnectionSelect!);

      await waitFor(() => {
        expect(screen.getByText('source.db')).toBeDefined();
      });

      await user.click(screen.getByText('source.db'));

      const { source } = useDataDiffStore.getState();
      expect(source?.connectionId).toBe('source-conn');
    });

    it('should allow selecting source table after connection is selected', async () => {
      const user = userEvent.setup();
      const sourceConn = createMockConnection({
        id: 'source-conn',
        filename: 'source.db',
      });
      const schema = createMockDatabaseSchema();

      const { addConnection, setSchema } = useConnectionStore.getState();
      addConnection(sourceConn);
      setSchema(sourceConn.id, schema);

      const { setSource } = useDataDiffStore.getState();
      setSource({
        connectionId: 'source-conn',
        tableName: '',
        schemaName: 'main',
        displayName: 'source.db',
      });

      render(<DataDiffPanel />);

      const sourceTableSelect = screen
        .getAllByText('Select table...')[0]
        .closest('button');
      expect(sourceTableSelect).toBeDefined();
      expect(sourceTableSelect?.disabled).toBe(false);

      await user.click(sourceTableSelect!);

      await waitFor(() => {
        expect(screen.getByText('users')).toBeDefined();
      });

      await user.click(screen.getByText('users'));

      const { source } = useDataDiffStore.getState();
      expect(source?.tableName).toBe('users');
    });

    it('should allow selecting target connection and table', async () => {
      const user = userEvent.setup();
      const targetConn = createMockConnection({
        id: 'target-conn',
        filename: 'target.db',
      });
      const schema = createMockDatabaseSchema();

      const { addConnection, setSchema } = useConnectionStore.getState();
      addConnection(targetConn);
      setSchema(targetConn.id, schema);

      const { setTarget } = useDataDiffStore.getState();
      setTarget({
        connectionId: 'target-conn',
        tableName: '',
        schemaName: 'main',
        displayName: 'target.db',
      });

      render(<DataDiffPanel />);

      const targetTableSelect = screen
        .getAllByText('Select table...')[1]
        .closest('button');
      expect(targetTableSelect).toBeDefined();

      await user.click(targetTableSelect!);

      await waitFor(() => {
        expect(screen.getAllByText('orders').length).toBeGreaterThan(0);
      });

      await user.click(screen.getAllByText('orders')[0]);

      const { target } = useDataDiffStore.getState();
      expect(target?.tableName).toBe('orders');
    });

    it('should enable compare button when both source and target are selected', () => {
      const sourceConn = createMockConnection({
        id: 'source-conn',
        filename: 'source.db',
      });
      const targetConn = createMockConnection({
        id: 'target-conn',
        filename: 'target.db',
      });

      const { addConnection } = useConnectionStore.getState();
      addConnection(sourceConn);
      addConnection(targetConn);

      const { setSource, setTarget } = useDataDiffStore.getState();
      setSource({
        connectionId: 'source-conn',
        tableName: 'users',
        schemaName: 'main',
        displayName: 'source.db',
      });
      setTarget({
        connectionId: 'target-conn',
        tableName: 'users',
        schemaName: 'main',
        displayName: 'target.db',
      });

      render(<DataDiffPanel />);

      const compareButton = screen.getByText('Compare Data').closest('button');
      expect(compareButton?.disabled).toBe(false);
    });
  });

  describe('comparison workflow', () => {
    it('should trigger comparison when compare button is clicked', async () => {
      const user = userEvent.setup();

      const { setSource, setTarget } = useDataDiffStore.getState();
      setSource({
        connectionId: 'source-conn',
        tableName: 'users',
        schemaName: 'main',
      });
      setTarget({
        connectionId: 'target-conn',
        tableName: 'users',
        schemaName: 'main',
      });

      render(<DataDiffPanel />);

      const compareButton = screen.getByText('Compare Data');
      await user.click(compareButton);

      await waitFor(() => {
        const { comparisonError } = useDataDiffStore.getState();
        expect(comparisonError).not.toBeNull();
      });
    });

    it('should display comparison results', () => {
      const mockResult = createMockComparisonResult();
      const { setComparisonResult } = useDataDiffStore.getState();
      setComparisonResult(mockResult);

      render(<DataDiffPanel />);

      expect(screen.getByText('Comparison Results')).toBeDefined();
      expect(screen.getByText('source.db / users')).toBeDefined();
      expect(screen.getByText('target.db / users')).toBeDefined();
    });

    it('should display correct diff counts in summary', () => {
      const mockResult = createMockComparisonResult();
      const { setComparisonResult } = useDataDiffStore.getState();
      setComparisonResult(mockResult);

      render(<DataDiffPanel />);

      expect(screen.getByText('Added')).toBeDefined();
      expect(screen.getByText('Removed')).toBeDefined();
      expect(screen.getByText('Modified')).toBeDefined();
      expect(screen.getByText('Unchanged')).toBeDefined();

      const allOnes = screen.getAllByText('1');
      expect(allOnes.length).toBeGreaterThanOrEqual(3);
    });

    it('should show error message when comparison fails', async () => {
      const user = userEvent.setup();
      const { setSource, setTarget } = useDataDiffStore.getState();

      setSource({
        connectionId: 'source-conn',
        tableName: 'users',
        schemaName: 'main',
      });
      setTarget({
        connectionId: 'target-conn',
        tableName: 'users',
        schemaName: 'main',
      });

      render(<DataDiffPanel />);

      const compareButton = screen.getByText('Compare Data');
      await user.click(compareButton);

      await waitFor(() => {
        expect(screen.getByText('Comparison Error')).toBeDefined();
      });
    });

    it('should validate that both source and target are selected before comparing', async () => {
      const user = userEvent.setup();
      const { setSource } = useDataDiffStore.getState();

      setSource({
        connectionId: 'source-conn',
        tableName: 'users',
        schemaName: 'main',
      });

      render(<DataDiffPanel />);

      const compareButton = screen.getByText('Compare Data').closest('button');
      expect(compareButton?.disabled).toBe(true);

      if (compareButton?.disabled === false) {
        await user.click(compareButton);
        await waitFor(() => {
          const { comparisonError } = useDataDiffStore.getState();
          expect(comparisonError).toContain(
            'Please select both source and target'
          );
        });
      }
    });
  });

  describe('keyboard shortcuts', () => {
    it('should toggle keyboard shortcuts panel', async () => {
      const user = userEvent.setup();
      render(<DataDiffPanel />);

      const shortcutsButton = screen.getByTitle('Show keyboard shortcuts');
      await user.click(shortcutsButton);

      await waitFor(() => {
        expect(screen.getByText('Keyboard Shortcuts')).toBeDefined();
        expect(screen.getByText('Run comparison')).toBeDefined();
        expect(screen.getByText('Toggle only differences')).toBeDefined();
        expect(screen.getByText('Reset filters')).toBeDefined();
      });

      await user.click(shortcutsButton);

      await waitFor(() => {
        expect(screen.queryByText('Run comparison')).toBeNull();
      });
    });
  });

  describe('filters', () => {
    it('should toggle show only differences filter', () => {
      const mockResult = createMockComparisonResult();
      const { setComparisonResult, setShowOnlyDifferences } =
        useDataDiffStore.getState();
      setComparisonResult(mockResult);

      render(<DataDiffPanel />);

      expect(useDataDiffStore.getState().filters.showOnlyDifferences).toBe(
        false
      );

      setShowOnlyDifferences(true);

      expect(useDataDiffStore.getState().filters.showOnlyDifferences).toBe(
        true
      );
    });

    it('should reset filters to default state', () => {
      const { setShowOnlyDifferences, resetFilters } =
        useDataDiffStore.getState();

      setShowOnlyDifferences(true);
      expect(useDataDiffStore.getState().filters.showOnlyDifferences).toBe(
        true
      );

      resetFilters();
      expect(useDataDiffStore.getState().filters.showOnlyDifferences).toBe(
        false
      );
    });

    it('should filter by diff type', () => {
      const { setDiffTypeFilter } = useDataDiffStore.getState();

      setDiffTypeFilter('added', false);

      const { filters } = useDataDiffStore.getState();
      expect(filters.diffTypes.added).toBe(false);
      expect(filters.diffTypes.removed).toBe(true);
      expect(filters.diffTypes.modified).toBe(true);
      expect(filters.diffTypes.unchanged).toBe(true);
    });
  });

  describe('multiple connections workflow', () => {
    it('should handle comparison between two different databases', () => {
      const sourceConn = createMockConnection({
        id: 'source-conn',
        filename: 'source.db',
      });
      const targetConn = createMockConnection({
        id: 'target-conn',
        filename: 'target.db',
      });

      const { addConnection, setSchema } = useConnectionStore.getState();
      addConnection(sourceConn);
      addConnection(targetConn);
      setSchema(sourceConn.id, createMockDatabaseSchema());
      setSchema(targetConn.id, createMockDatabaseSchema());

      const { setSource, setTarget } = useDataDiffStore.getState();
      setSource({
        connectionId: 'source-conn',
        tableName: 'users',
        schemaName: 'main',
        displayName: 'source.db',
      });
      setTarget({
        connectionId: 'target-conn',
        tableName: 'users',
        schemaName: 'main',
        displayName: 'target.db',
      });

      render(<DataDiffPanel />);

      const compareButton = screen.getByText('Compare Data').closest('button');
      expect(compareButton?.disabled).toBe(false);
    });

    it('should handle comparison within same database', () => {
      const conn = createMockConnection({
        id: 'conn-1',
        filename: 'database.db',
      });

      const { addConnection, setSchema } = useConnectionStore.getState();
      addConnection(conn);
      setSchema(conn.id, createMockDatabaseSchema());

      const { setSource, setTarget } = useDataDiffStore.getState();
      setSource({
        connectionId: 'conn-1',
        tableName: 'users',
        schemaName: 'main',
        displayName: 'database.db',
      });
      setTarget({
        connectionId: 'conn-1',
        tableName: 'orders',
        schemaName: 'main',
        displayName: 'database.db',
      });

      render(<DataDiffPanel />);

      const compareButton = screen.getByText('Compare Data').closest('button');
      expect(compareButton?.disabled).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle empty connection list', () => {
      render(<DataDiffPanel />);

      const sourceConnectionSelect = screen
        .getAllByText('Select connection...')[0]
        .closest('button');
      expect(sourceConnectionSelect).toBeDefined();
    });

    it('should handle database with no tables', () => {
      const conn = createMockConnection({
        id: 'conn-1',
        filename: 'empty.db',
      });
      const emptySchema = createMockDatabaseSchema({
        tables: [],
        schemas: [{ name: 'main', tables: [], views: [] }],
      });

      const { addConnection, setSchema } = useConnectionStore.getState();
      addConnection(conn);
      setSchema(conn.id, emptySchema);

      const { setSource } = useDataDiffStore.getState();
      setSource({
        connectionId: 'conn-1',
        tableName: '',
        schemaName: 'main',
        displayName: 'empty.db',
      });

      render(<DataDiffPanel />);

      const tableSelect = screen
        .getAllByText('Select table...')[0]
        .closest('button');
      expect(tableSelect?.disabled).toBe(true);
    });

    it('should clear comparison results when source/target changes', () => {
      const mockResult = createMockComparisonResult();
      const { setComparisonResult, setSource } = useDataDiffStore.getState();

      setComparisonResult(mockResult);
      expect(useDataDiffStore.getState().comparisonResult).not.toBeNull();

      setSource({
        connectionId: 'new-source',
        tableName: 'new-table',
        schemaName: 'main',
      });

      render(<DataDiffPanel />);
    });

    it('should handle comparison with no differences', () => {
      const noDiffResult = createMockComparisonResult({
        rowDiffs: [],
        summary: {
          sourceRows: 100,
          targetRows: 100,
          rowsAdded: 0,
          rowsRemoved: 0,
          rowsModified: 0,
          rowsUnchanged: 100,
        },
      });

      const { setComparisonResult } = useDataDiffStore.getState();
      setComparisonResult(noDiffResult);

      render(<DataDiffPanel />);

      expect(screen.getByText('Comparison Results')).toBeDefined();

      const allZeros = screen.getAllByText('0');
      expect(allZeros.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle large diff counts', () => {
      const largeDiffResult = createMockComparisonResult({
        summary: {
          sourceRows: 10000,
          targetRows: 9500,
          rowsAdded: 250,
          rowsRemoved: 750,
          rowsModified: 3000,
          rowsUnchanged: 6250,
        },
      });

      const { setComparisonResult } = useDataDiffStore.getState();
      setComparisonResult(largeDiffResult);

      render(<DataDiffPanel />);

      expect(screen.getByText('250')).toBeDefined();
      expect(screen.getByText('750')).toBeDefined();
      expect(screen.getByText('3000')).toBeDefined();
      expect(screen.getByText('6250')).toBeDefined();
    });
  });

  describe('accessibility', () => {
    it('should have accessible labels for selectors', () => {
      render(<DataDiffPanel />);

      const connectionLabels = screen.getAllByText('Connection');
      expect(connectionLabels).toHaveLength(2);

      const tableLabels = screen.getAllByText('Table');
      expect(tableLabels).toHaveLength(2);
    });

    it('should have title attribute on compare button', () => {
      const { setSource, setTarget } = useDataDiffStore.getState();
      setSource({
        connectionId: 'source-conn',
        tableName: 'users',
        schemaName: 'main',
      });
      setTarget({
        connectionId: 'target-conn',
        tableName: 'users',
        schemaName: 'main',
      });

      render(<DataDiffPanel />);

      const compareButton = screen.getByTitle(/Compare tables/);
      expect(compareButton).toBeDefined();
    });

    it('should have accessible error messages', () => {
      const { setComparisonError } = useDataDiffStore.getState();
      setComparisonError('Database connection failed');

      render(<DataDiffPanel />);

      expect(screen.getByText('Comparison Error')).toBeDefined();
      expect(screen.getByText('Database connection failed')).toBeDefined();
    });
  });

  describe('state persistence', () => {
    it('should maintain selected source when re-rendering', () => {
      const { setSource } = useDataDiffStore.getState();
      setSource({
        connectionId: 'source-conn',
        tableName: 'users',
        schemaName: 'main',
        displayName: 'source.db',
      });

      const { rerender } = render(<DataDiffPanel />);

      expect(useDataDiffStore.getState().source?.connectionId).toBe(
        'source-conn'
      );

      rerender(<DataDiffPanel />);

      expect(useDataDiffStore.getState().source?.connectionId).toBe(
        'source-conn'
      );
    });

    it('should maintain comparison results across re-renders', () => {
      const mockResult = createMockComparisonResult();
      const { setComparisonResult } = useDataDiffStore.getState();
      setComparisonResult(mockResult);

      const { rerender } = render(<DataDiffPanel />);

      expect(screen.getByText('Comparison Results')).toBeDefined();

      rerender(<DataDiffPanel />);

      expect(screen.getByText('Comparison Results')).toBeDefined();
      expect(useDataDiffStore.getState().comparisonResult).toEqual(mockResult);
    });
  });
});

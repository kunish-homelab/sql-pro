// Mock API for development and testing
import type {
  AnalyzeQueryPlanRequest,
  ApplyChangesRequest,
  ClearQueryHistoryRequest,
  CloseDatabaseRequest,
  CompareConnectionsRequest,
  CompareConnectionToSnapshotRequest,
  CompareSnapshotsRequest,
  DeleteQueryHistoryRequest,
  DeleteSchemaSnapshotRequest,
  ExecuteQueryRequest,
  ExportComparisonReportRequest,
  ExportRequest,
  GenerateMigrationSQLRequest,
  GetPasswordRequest,
  GetQueryHistoryRequest,
  GetSchemaRequest,
  GetSchemaSnapshotRequest,
  GetTableDataRequest,
  HasPasswordRequest,
  OpenDatabaseRequest,
  OpenFileDialogRequest,
  ProActivateRequest,
  RemoveConnectionRequest,
  RemovePasswordRequest,
  SaveAISettingsRequest,
  SaveFileDialogRequest,
  SavePasswordRequest,
  SaveQueryHistoryRequest,
  SaveSchemaSnapshotRequest,
  SetPreferencesRequest,
  TableInfo,
  UpdateConnectionRequest,
  ValidateChangesRequest,
} from '../../../shared/types';

// Mock tables schema
const mockTables: TableInfo[] = [
  {
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
        nullable: false,
        defaultValue: null,
        isPrimaryKey: false,
      },
      {
        name: 'email',
        type: 'TEXT',
        nullable: false,
        defaultValue: null,
        isPrimaryKey: false,
      },
      {
        name: 'age',
        type: 'INTEGER',
        nullable: true,
        defaultValue: null,
        isPrimaryKey: false,
      },
      {
        name: 'created_at',
        type: 'DATETIME',
        nullable: false,
        defaultValue: 'CURRENT_TIMESTAMP',
        isPrimaryKey: false,
      },
      {
        name: 'is_active',
        type: 'BOOLEAN',
        nullable: false,
        defaultValue: '1',
        isPrimaryKey: false,
      },
    ],
    primaryKey: ['id'],
    foreignKeys: [],
    indexes: [
      {
        name: 'idx_users_email',
        columns: ['email'],
        isUnique: true,
        sql: 'CREATE UNIQUE INDEX idx_users_email ON users(email)',
      },
    ],
    triggers: [],
    rowCount: 150,
    sql: 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, age INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, is_active BOOLEAN DEFAULT 1)',
  },
  {
    name: 'products',
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
        nullable: false,
        defaultValue: null,
        isPrimaryKey: false,
      },
      {
        name: 'description',
        type: 'TEXT',
        nullable: true,
        defaultValue: null,
        isPrimaryKey: false,
      },
      {
        name: 'price',
        type: 'REAL',
        nullable: false,
        defaultValue: null,
        isPrimaryKey: false,
      },
      {
        name: 'stock',
        type: 'INTEGER',
        nullable: false,
        defaultValue: '0',
        isPrimaryKey: false,
      },
      {
        name: 'category_id',
        type: 'INTEGER',
        nullable: true,
        defaultValue: null,
        isPrimaryKey: false,
      },
    ],
    primaryKey: ['id'],
    foreignKeys: [
      {
        column: 'category_id',
        referencedTable: 'categories',
        referencedColumn: 'id',
        onDelete: 'SET NULL',
      },
    ],
    indexes: [],
    triggers: [],
    rowCount: 85,
    sql: 'CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT NOT NULL, description TEXT, price REAL NOT NULL, stock INTEGER DEFAULT 0, category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL)',
  },
  {
    name: 'orders',
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
        name: 'user_id',
        type: 'INTEGER',
        nullable: false,
        defaultValue: null,
        isPrimaryKey: false,
      },
      {
        name: 'total',
        type: 'REAL',
        nullable: false,
        defaultValue: null,
        isPrimaryKey: false,
      },
      {
        name: 'status',
        type: 'TEXT',
        nullable: false,
        defaultValue: "'pending'",
        isPrimaryKey: false,
      },
      {
        name: 'created_at',
        type: 'DATETIME',
        nullable: false,
        defaultValue: 'CURRENT_TIMESTAMP',
        isPrimaryKey: false,
      },
    ],
    primaryKey: ['id'],
    foreignKeys: [
      {
        column: 'user_id',
        referencedTable: 'users',
        referencedColumn: 'id',
        onDelete: 'CASCADE',
      },
    ],
    indexes: [
      {
        name: 'idx_orders_user',
        columns: ['user_id'],
        isUnique: false,
        sql: 'CREATE INDEX idx_orders_user ON orders(user_id)',
      },
      {
        name: 'idx_orders_status',
        columns: ['status'],
        isUnique: false,
        sql: 'CREATE INDEX idx_orders_status ON orders(status)',
      },
    ],
    triggers: [],
    rowCount: 320,
    sql: "CREATE TABLE orders (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, total REAL NOT NULL, status TEXT DEFAULT 'pending', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
  },
  {
    name: 'categories',
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
        nullable: false,
        defaultValue: null,
        isPrimaryKey: false,
      },
      {
        name: 'parent_id',
        type: 'INTEGER',
        nullable: true,
        defaultValue: null,
        isPrimaryKey: false,
      },
    ],
    primaryKey: ['id'],
    foreignKeys: [
      {
        column: 'parent_id',
        referencedTable: 'categories',
        referencedColumn: 'id',
      },
    ],
    indexes: [],
    triggers: [],
    rowCount: 12,
    sql: 'CREATE TABLE categories (id INTEGER PRIMARY KEY, name TEXT NOT NULL, parent_id INTEGER REFERENCES categories(id))',
  },
];

// Mock views schema
const mockViews: TableInfo[] = [
  {
    name: 'active_users',
    schema: 'main',
    type: 'view',
    columns: [
      {
        name: 'id',
        type: 'INTEGER',
        nullable: false,
        defaultValue: null,
        isPrimaryKey: false,
      },
      {
        name: 'name',
        type: 'TEXT',
        nullable: false,
        defaultValue: null,
        isPrimaryKey: false,
      },
      {
        name: 'email',
        type: 'TEXT',
        nullable: false,
        defaultValue: null,
        isPrimaryKey: false,
      },
    ],
    primaryKey: [],
    foreignKeys: [],
    indexes: [],
    triggers: [],
    sql: 'CREATE VIEW active_users AS SELECT id, name, email FROM users WHERE is_active = 1',
  },
  {
    name: 'order_summary',
    schema: 'main',
    type: 'view',
    columns: [
      {
        name: 'user_id',
        type: 'INTEGER',
        nullable: false,
        defaultValue: null,
        isPrimaryKey: false,
      },
      {
        name: 'user_name',
        type: 'TEXT',
        nullable: false,
        defaultValue: null,
        isPrimaryKey: false,
      },
      {
        name: 'total_orders',
        type: 'INTEGER',
        nullable: false,
        defaultValue: null,
        isPrimaryKey: false,
      },
      {
        name: 'total_spent',
        type: 'REAL',
        nullable: false,
        defaultValue: null,
        isPrimaryKey: false,
      },
    ],
    primaryKey: [],
    foreignKeys: [],
    indexes: [],
    triggers: [],
    sql: 'CREATE VIEW order_summary AS SELECT u.id as user_id, u.name as user_name, COUNT(o.id) as total_orders, SUM(o.total) as total_spent FROM users u LEFT JOIN orders o ON u.id = o.user_id GROUP BY u.id',
  },
];

// Mock table data
const mockTableData: Record<string, Record<string, unknown>[]> = {
  users: [
    {
      id: 1,
      name: 'Alice Johnson',
      email: 'alice@example.com',
      age: 28,
      created_at: '2024-01-15 10:30:00',
      is_active: 1,
    },
    {
      id: 2,
      name: 'Bob Smith',
      email: 'bob@example.com',
      age: 35,
      created_at: '2024-02-20 14:45:00',
      is_active: 1,
    },
    {
      id: 3,
      name: 'Charlie Brown',
      email: 'charlie@example.com',
      age: 42,
      created_at: '2024-03-10 09:15:00',
      is_active: 0,
    },
    {
      id: 4,
      name: 'Diana Ross',
      email: 'diana@example.com',
      age: 31,
      created_at: '2024-03-25 16:20:00',
      is_active: 1,
    },
    {
      id: 5,
      name: 'Edward Chen',
      email: 'edward@example.com',
      age: 29,
      created_at: '2024-04-05 11:00:00',
      is_active: 1,
    },
    {
      id: 6,
      name: 'Fiona Garcia',
      email: 'fiona@example.com',
      age: 38,
      created_at: '2024-04-18 13:30:00',
      is_active: 1,
    },
    {
      id: 7,
      name: 'George Wilson',
      email: 'george@example.com',
      age: 45,
      created_at: '2024-05-02 08:45:00',
      is_active: 0,
    },
    {
      id: 8,
      name: 'Hannah Lee',
      email: 'hannah@example.com',
      age: 26,
      created_at: '2024-05-20 15:10:00',
      is_active: 1,
    },
    {
      id: 9,
      name: 'Ivan Petrov',
      email: 'ivan@example.com',
      age: 33,
      created_at: '2024-06-08 10:25:00',
      is_active: 1,
    },
    {
      id: 10,
      name: 'Julia Martinez',
      email: 'julia@example.com',
      age: 27,
      created_at: '2024-06-22 12:40:00',
      is_active: 1,
    },
  ],
  products: [
    {
      id: 1,
      name: 'MacBook Pro 16"',
      description: 'Apple M3 Pro chip, 18GB RAM, 512GB SSD',
      price: 2499.0,
      stock: 25,
      category_id: 1,
    },
    {
      id: 2,
      name: 'iPhone 15 Pro',
      description: 'A17 Pro chip, 256GB, Titanium',
      price: 1199.0,
      stock: 150,
      category_id: 2,
    },
    {
      id: 3,
      name: 'AirPods Pro 2',
      description: 'Active Noise Cancellation, USB-C',
      price: 249.0,
      stock: 200,
      category_id: 3,
    },
    {
      id: 4,
      name: 'iPad Air',
      description: 'M2 chip, 11-inch, 128GB',
      price: 599.0,
      stock: 80,
      category_id: 4,
    },
    {
      id: 5,
      name: 'Apple Watch Ultra 2',
      description: 'GPS + Cellular, Titanium Case',
      price: 799.0,
      stock: 45,
      category_id: 5,
    },
    {
      id: 6,
      name: 'Magic Keyboard',
      description: 'Wireless, Touch ID, Numeric Keypad',
      price: 199.0,
      stock: 120,
      category_id: 3,
    },
    {
      id: 7,
      name: 'Studio Display',
      description: '27-inch 5K Retina, Nano-texture glass',
      price: 1999.0,
      stock: 15,
      category_id: 1,
    },
    {
      id: 8,
      name: 'HomePod mini',
      description: 'Smart speaker with Siri',
      price: 99.0,
      stock: 300,
      category_id: 3,
    },
  ],
  orders: [
    {
      id: 1,
      user_id: 1,
      total: 2748.0,
      status: 'completed',
      created_at: '2024-06-01 10:00:00',
    },
    {
      id: 2,
      user_id: 2,
      total: 1199.0,
      status: 'completed',
      created_at: '2024-06-05 14:30:00',
    },
    {
      id: 3,
      user_id: 1,
      total: 249.0,
      status: 'shipped',
      created_at: '2024-06-10 09:15:00',
    },
    {
      id: 4,
      user_id: 4,
      total: 599.0,
      status: 'pending',
      created_at: '2024-06-15 16:45:00',
    },
    {
      id: 5,
      user_id: 5,
      total: 2499.0,
      status: 'processing',
      created_at: '2024-06-18 11:20:00',
    },
    {
      id: 6,
      user_id: 3,
      total: 99.0,
      status: 'cancelled',
      created_at: '2024-06-20 13:00:00',
    },
    {
      id: 7,
      user_id: 6,
      total: 1998.0,
      status: 'completed',
      created_at: '2024-06-22 08:30:00',
    },
    {
      id: 8,
      user_id: 8,
      total: 448.0,
      status: 'shipped',
      created_at: '2024-06-25 15:45:00',
    },
  ],
  categories: [
    { id: 1, name: 'Computers', parent_id: null },
    { id: 2, name: 'Phones', parent_id: null },
    { id: 3, name: 'Accessories', parent_id: null },
    { id: 4, name: 'Tablets', parent_id: null },
    { id: 5, name: 'Wearables', parent_id: null },
  ],
  active_users: [
    { id: 1, name: 'Alice Johnson', email: 'alice@example.com' },
    { id: 2, name: 'Bob Smith', email: 'bob@example.com' },
    { id: 4, name: 'Diana Ross', email: 'diana@example.com' },
    { id: 5, name: 'Edward Chen', email: 'edward@example.com' },
    { id: 6, name: 'Fiona Garcia', email: 'fiona@example.com' },
    { id: 8, name: 'Hannah Lee', email: 'hannah@example.com' },
    { id: 9, name: 'Ivan Petrov', email: 'ivan@example.com' },
    { id: 10, name: 'Julia Martinez', email: 'julia@example.com' },
  ],
  order_summary: [
    {
      user_id: 1,
      user_name: 'Alice Johnson',
      total_orders: 2,
      total_spent: 2997.0,
    },
    {
      user_id: 2,
      user_name: 'Bob Smith',
      total_orders: 1,
      total_spent: 1199.0,
    },
    {
      user_id: 3,
      user_name: 'Charlie Brown',
      total_orders: 1,
      total_spent: 99.0,
    },
    {
      user_id: 4,
      user_name: 'Diana Ross',
      total_orders: 1,
      total_spent: 599.0,
    },
    {
      user_id: 5,
      user_name: 'Edward Chen',
      total_orders: 1,
      total_spent: 2499.0,
    },
    {
      user_id: 6,
      user_name: 'Fiona Garcia',
      total_orders: 1,
      total_spent: 1998.0,
    },
    {
      user_id: 8,
      user_name: 'Hannah Lee',
      total_orders: 1,
      total_spent: 448.0,
    },
  ],
};

// Simulated delay for realistic feel
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Mock mode state
let _isMockMode = false;

// Mock connection data for initialization
const mockConnectionData = {
  connection: {
    id: 'mock-connection-1',
    path: '/Users/demo/databases/shop.db',
    filename: 'shop.db',
    isEncrypted: false,
    isReadOnly: false,
    status: 'connected' as const,
    connectedAt: new Date(),
  },
  schema: {
    schemas: [],
    tables: mockTables,
    views: mockViews,
  },
};

export async function initMockMode(): Promise<
  typeof mockConnectionData | null
> {
  _isMockMode = true;
  return mockConnectionData;
}

export function isMockMode(): boolean {
  return _isMockMode;
}

// Mock SQL Pro API

export const mockSqlProAPI: any = {
  db: {
    open: async (_request: OpenDatabaseRequest): Promise<any> => {
      await delay(300);
      return {
        success: true,
        connection: {
          id: 'mock-connection-1',
          path: '/Users/demo/databases/shop.db',
          filename: 'shop.db',
          isEncrypted: false,
          isReadOnly: false,
        },
      };
    },
    close: async (_request: CloseDatabaseRequest): Promise<any> => {
      await delay(200);
      return { success: true };
    },
    getSchema: async (_request: GetSchemaRequest): Promise<any> => {
      await delay(400);
      return {
        tables: mockTables,
        views: mockViews,
      };
    },
    getTableData: async (_request: GetTableDataRequest): Promise<any> => {
      await delay(300);
      const tableName = _request.table;
      const data = mockTableData[tableName] || [];
      const pageSize = _request.pageSize || 100;
      const page = _request.page || 1;
      const offset = (page - 1) * pageSize;
      return {
        rows: data.slice(offset, offset + pageSize),
        totalCount: data.length,
      };
    },
  },
  query: {
    execute: async (_request: ExecuteQueryRequest): Promise<any> => {
      await delay(400);
      return {
        rows: [],
        columns: [],
        affectedRows: 0,
        executionTime: 45,
      };
    },
    validateChanges: async (_request: ValidateChangesRequest): Promise<any> => {
      await delay(300);
      return {
        isValid: true,
        errors: [],
      };
    },
    applyChanges: async (_request: ApplyChangesRequest): Promise<any> => {
      await delay(500);
      return {
        success: true,
        affectedRows: 1,
      };
    },
    analyzeQueryPlan: async (
      _request: AnalyzeQueryPlanRequest
    ): Promise<any> => {
      await delay(300);
      return {
        plan: [
          {
            id: 0,
            parent: -1,
            notused: 0,
            detail: 'SCAN TABLE users',
          },
        ],
        executionTime: 0.5,
      };
    },
  },
  history: {
    getQueryHistory: async (_request: GetQueryHistoryRequest): Promise<any> => {
      await delay(200);
      return {
        entries: [],
        total: 0,
      };
    },
    saveQueryHistory: async (
      _request: SaveQueryHistoryRequest
    ): Promise<any> => {
      await delay(200);
      return {
        success: true,
        id: 'mock-history-1',
      };
    },
    deleteQueryHistory: async (
      _request: DeleteQueryHistoryRequest
    ): Promise<any> => {
      await delay(200);
      return {
        success: true,
      };
    },
    clearQueryHistory: async (
      _request: ClearQueryHistoryRequest
    ): Promise<any> => {
      await delay(200);
      return {
        success: true,
      };
    },
  },
  export: {
    export: async (_request: ExportRequest): Promise<any> => {
      await delay(500);
      return {
        success: true,
        data: 'mock-export-data',
      };
    },
  },
  file: {
    openFileDialog: async (_request: OpenFileDialogRequest): Promise<any> => {
      await delay(200);
      return {
        filePath: '/Users/demo/databases/shop.db',
      };
    },
    saveFileDialog: async (_request: SaveFileDialogRequest): Promise<any> => {
      await delay(200);
      return {
        filePath: '/Users/demo/databases/export.csv',
      };
    },
  },
  connection: {
    getRecentConnections: async (): Promise<any> => {
      await delay(200);
      return {
        connections: [],
      };
    },
    updateConnection: async (
      _request: UpdateConnectionRequest
    ): Promise<any> => {
      await delay(200);
      return {
        success: true,
      };
    },
    removeConnection: async (
      _request: RemoveConnectionRequest
    ): Promise<any> => {
      await delay(200);
      return {
        success: true,
      };
    },
  },
  preferences: {
    getPreferences: async (): Promise<any> => {
      await delay(200);
      return {
        theme: 'dark',
        fontSize: 14,
      };
    },
    setPreferences: async (_request: SetPreferencesRequest): Promise<any> => {
      await delay(200);
      return {
        success: true,
      };
    },
  },
  password: {
    getPassword: async (_request: GetPasswordRequest): Promise<any> => {
      await delay(200);
      return {
        password: 'mock-password',
      };
    },
    hasPassword: async (_request: HasPasswordRequest): Promise<any> => {
      await delay(200);
      return {
        hasPassword: false,
      };
    },
    savePassword: async (_request: SavePasswordRequest): Promise<any> => {
      await delay(200);
      return {
        success: true,
      };
    },
    removePassword: async (_request: RemovePasswordRequest): Promise<any> => {
      await delay(200);
      return {
        success: true,
      };
    },
    isPasswordStorageAvailable: async (): Promise<any> => {
      await delay(200);
      return {
        available: true,
      };
    },
  },
  ai: {
    getAISettings: async (): Promise<any> => {
      await delay(200);
      return {
        settings: {
          apiKey: 'mock-api-key',
          model: 'gpt-4',
          enabled: true,
        },
      };
    },
    saveAISettings: async (_request: SaveAISettingsRequest): Promise<any> => {
      await delay(200);
      return {
        success: true,
      };
    },
  },
  pro: {
    getStatus: async (): Promise<any> => {
      await delay(200);
      return {
        isActive: false,
        expiresAt: null,
        licenseKey: null,
      };
    },
    activate: async (_request: ProActivateRequest): Promise<any> => {
      await delay(300);
      return {
        success: true,
        expiresAt: new Date(
          Date.now() + 365 * 24 * 60 * 60 * 1000
        ).toISOString(),
      };
    },
    deactivate: async (): Promise<any> => {
      await delay(200);
      return {
        success: true,
      };
    },
  },
  schemaSnapshot: {
    save: async (_request: SaveSchemaSnapshotRequest): Promise<any> => {
      await delay(300);
      return {
        success: true,
        snapshot: {
          id: `snapshot-${Date.now()}`,
          name: _request.name,
          connectionId: _request.connectionId,
          createdAt: new Date().toISOString(),
          schema: {
            tables: mockTables,
          },
        },
      };
    },
    getAll: async (): Promise<any> => {
      await delay(200);
      return {
        snapshots: [
          {
            id: 'snapshot-1',
            name: 'Production Schema - 2024-01-15',
            connectionId: 'conn-1',
            createdAt: new Date(Date.now() - 86400000).toISOString(),
            schema: { tables: mockTables },
          },
        ],
      };
    },
    get: async (_request: GetSchemaSnapshotRequest): Promise<any> => {
      await delay(200);
      return {
        snapshot: {
          id: _request.snapshotId,
          name: 'Production Schema - 2024-01-15',
          connectionId: 'conn-1',
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          schema: { tables: mockTables },
        },
      };
    },
    delete: async (_request: DeleteSchemaSnapshotRequest): Promise<any> => {
      await delay(200);
      return {
        success: true,
      };
    },
  },
  schemaComparison: {
    compareConnections: async (
      _request: CompareConnectionsRequest
    ): Promise<any> => {
      await delay(500);
      return {
        success: true,
        result: {
          source: {
            type: 'connection' as const,
            id: _request.sourceConnectionId,
            name: 'Source Database',
          },
          target: {
            type: 'connection' as const,
            id: _request.targetConnectionId,
            name: 'Target Database',
          },
          tableDiffs: [],
          summary: {
            tablesAdded: 0,
            tablesRemoved: 0,
            tablesModified: 0,
            columnsAdded: 0,
            columnsRemoved: 0,
            columnsModified: 0,
            indexesAdded: 0,
            indexesRemoved: 0,
            indexesModified: 0,
            triggersAdded: 0,
            triggersRemoved: 0,
            triggersModified: 0,
            foreignKeysAdded: 0,
            foreignKeysRemoved: 0,
            foreignKeysModified: 0,
          },
        },
      };
    },
    compareConnectionToSnapshot: async (
      _request: CompareConnectionToSnapshotRequest
    ): Promise<any> => {
      await delay(500);
      return {
        success: true,
        result: {
          source: {
            type: 'connection' as const,
            id: _request.connectionId,
            name: 'Current Database',
          },
          target: {
            type: 'snapshot' as const,
            id: _request.snapshotId,
            name: 'Saved Snapshot',
          },
          tableDiffs: [],
          summary: {
            tablesAdded: 0,
            tablesRemoved: 0,
            tablesModified: 0,
            columnsAdded: 0,
            columnsRemoved: 0,
            columnsModified: 0,
            indexesAdded: 0,
            indexesRemoved: 0,
            indexesModified: 0,
            triggersAdded: 0,
            triggersRemoved: 0,
            triggersModified: 0,
            foreignKeysAdded: 0,
            foreignKeysRemoved: 0,
            foreignKeysModified: 0,
          },
        },
      };
    },
    compareSnapshots: async (
      _request: CompareSnapshotsRequest
    ): Promise<any> => {
      await delay(500);
      return {
        success: true,
        result: {
          source: {
            type: 'snapshot' as const,
            id: _request.sourceSnapshotId,
            name: 'Source Snapshot',
          },
          target: {
            type: 'snapshot' as const,
            id: _request.targetSnapshotId,
            name: 'Target Snapshot',
          },
          tableDiffs: [],
          summary: {
            tablesAdded: 0,
            tablesRemoved: 0,
            tablesModified: 0,
            columnsAdded: 0,
            columnsRemoved: 0,
            columnsModified: 0,
            indexesAdded: 0,
            indexesRemoved: 0,
            indexesModified: 0,
            triggersAdded: 0,
            triggersRemoved: 0,
            triggersModified: 0,
            foreignKeysAdded: 0,
            foreignKeysRemoved: 0,
            foreignKeysModified: 0,
          },
        },
      };
    },
    generateMigrationSQL: async (
      _request: GenerateMigrationSQLRequest
    ): Promise<any> => {
      await delay(300);
      return {
        success: true,
        sql: '-- Mock migration SQL\n-- No changes detected in mock mode',
        statements: [],
        warnings: [],
      };
    },
    exportReport: async (
      _request: ExportComparisonReportRequest
    ): Promise<any> => {
      await delay(400);
      return {
        success: true,
        filePath: _request.filePath,
      };
    },
  },
};

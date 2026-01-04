/**
 * Database Manager
 * Coordinates between different database adapters and routes operations
 * to the appropriate adapter based on connection type
 */

import type {
  DatabaseConnectionConfig,
  DatabaseType,
  GetTableDataResponse,
  PendingChangeInfo,
  QueryPlanNode,
  QueryPlanStats,
  SchemaInfo,
  TableInfo,
  ValidationResult,
} from '@shared/types';
import type {
  AdapterConnectionInfo,
  DatabaseAdapter,
  OpenResult,
} from './types';
import { MySQLAdapter } from './mysql-adapter';
import { PostgreSQLAdapter } from './postgresql-adapter';
import { SQLiteAdapter } from './sqlite-adapter';

/**
 * Connection metadata stored by the manager
 */
interface ManagedConnection {
  id: string;
  type: DatabaseType;
  adapter: DatabaseAdapter;
}

/**
 * Database Manager - coordinates between different database adapters
 */
class DatabaseManager {
  private adapters: Map<DatabaseType, DatabaseAdapter> = new Map();
  private connections: Map<string, ManagedConnection> = new Map();

  constructor() {
    // Initialize adapters
    this.adapters.set('sqlite', new SQLiteAdapter());
    this.adapters.set('mysql', new MySQLAdapter());
    this.adapters.set('postgresql', new PostgreSQLAdapter('postgresql'));
    this.adapters.set('supabase', new PostgreSQLAdapter('supabase'));
  }

  /**
   * Get the appropriate adapter for a database type
   */
  private getAdapter(type: DatabaseType): DatabaseAdapter {
    const adapter = this.adapters.get(type);
    if (!adapter) {
      throw new Error(`Unsupported database type: ${type}`);
    }
    return adapter;
  }

  /**
   * Get the adapter for an existing connection
   */
  private getConnectionAdapter(connectionId: string): DatabaseAdapter | null {
    const managed = this.connections.get(connectionId);
    return managed?.adapter || null;
  }

  /**
   * Open a database connection
   */
  async open(
    pathOrConfig: string | DatabaseConnectionConfig,
    password?: string,
    readOnly = false
  ): Promise<OpenResult> {
    // Handle legacy call with path string (SQLite)
    let config: DatabaseConnectionConfig;
    if (typeof pathOrConfig === 'string') {
      config = {
        type: 'sqlite',
        path: pathOrConfig,
        password,
        readOnly,
      };
    } else {
      config = pathOrConfig;
    }

    const type = config.type || 'sqlite';
    const adapter = this.getAdapter(type);

    const result = await adapter.open(config);

    if (result.success && result.connection) {
      // Track this connection
      this.connections.set(result.connection.id, {
        id: result.connection.id,
        type,
        adapter,
      });
    }

    return result;
  }

  /**
   * Close a database connection
   */
  close(
    connectionId: string
  ): { success: true } | { success: false; error: string } {
    const adapter = this.getConnectionAdapter(connectionId);
    if (!adapter) {
      return { success: false, error: 'Connection not found' };
    }

    const result = adapter.close(connectionId);
    if (result.success) {
      this.connections.delete(connectionId);
    }
    return result;
  }

  /**
   * Get connection info
   */
  getConnection(connectionId: string): AdapterConnectionInfo | null {
    const adapter = this.getConnectionAdapter(connectionId);
    if (!adapter) {
      return null;
    }
    return adapter.getConnection(connectionId);
  }

  /**
   * Get database schema
   * For async databases (MySQL, PostgreSQL), this returns an error directing to async method
   */
  getSchema(connectionId: string):
    | {
        success: true;
        schemas: SchemaInfo[];
        tables: TableInfo[];
        views: TableInfo[];
      }
    | { success: false; error: string } {
    const adapter = this.getConnectionAdapter(connectionId);
    if (!adapter) {
      return { success: false, error: 'Connection not found' };
    }
    return adapter.getSchema(connectionId);
  }

  /**
   * Get database schema (async version for MySQL/PostgreSQL)
   */
  async getSchemaAsync(connectionId: string): Promise<
    | {
        success: true;
        schemas: SchemaInfo[];
        tables: TableInfo[];
        views: TableInfo[];
      }
    | { success: false; error: string }
  > {
    const managed = this.connections.get(connectionId);
    if (!managed) {
      return { success: false, error: 'Connection not found' };
    }

    const adapter = managed.adapter;

    // Check if adapter has async method
    if (
      'getSchemaAsync' in adapter &&
      typeof (adapter as any).getSchemaAsync === 'function'
    ) {
      return (adapter as any).getSchemaAsync(connectionId);
    }

    // Fall back to sync method
    return adapter.getSchema(connectionId);
  }

  /**
   * Execute a non-SELECT query
   */
  execute(connectionId: string, sql: string, params?: unknown[]) {
    const adapter = this.getConnectionAdapter(connectionId);
    if (!adapter) {
      return { success: false as const, error: 'Connection not found' };
    }
    return adapter.execute(connectionId, sql, params);
  }

  /**
   * Execute async (for MySQL/PostgreSQL)
   */
  async executeAsync(connectionId: string, sql: string, params?: unknown[]) {
    const managed = this.connections.get(connectionId);
    if (!managed) {
      return { success: false as const, error: 'Connection not found' };
    }

    const adapter = managed.adapter;

    if (
      'executeAsync' in adapter &&
      typeof (adapter as any).executeAsync === 'function'
    ) {
      return (adapter as any).executeAsync(connectionId, sql, params);
    }

    return adapter.execute(connectionId, sql, params);
  }

  /**
   * Execute a SELECT query
   */
  query(connectionId: string, sql: string, params?: unknown[]) {
    const adapter = this.getConnectionAdapter(connectionId);
    if (!adapter) {
      return { success: false as const, error: 'Connection not found' };
    }
    return adapter.query(connectionId, sql, params);
  }

  /**
   * Query async (for MySQL/PostgreSQL)
   */
  async queryAsync(connectionId: string, sql: string, params?: unknown[]) {
    const managed = this.connections.get(connectionId);
    if (!managed) {
      return { success: false as const, error: 'Connection not found' };
    }

    const adapter = managed.adapter;

    if (
      'queryAsync' in adapter &&
      typeof (adapter as any).queryAsync === 'function'
    ) {
      return (adapter as any).queryAsync(connectionId, sql, params);
    }

    return adapter.query(connectionId, sql, params);
  }

  /**
   * Get table data with pagination
   */
  getTableData(
    connectionId: string,
    table: string,
    page: number,
    pageSize: number,
    sortColumn?: string,
    sortDirection?: 'asc' | 'desc',
    filters?: Array<{
      column: string;
      operator: string;
      value: string;
    }>,
    schema?: string
  ): GetTableDataResponse {
    const adapter = this.getConnectionAdapter(connectionId);
    if (!adapter) {
      return { success: false, error: 'Connection not found' };
    }
    return adapter.getTableData(
      connectionId,
      table,
      page,
      pageSize,
      sortColumn,
      sortDirection,
      filters,
      schema
    );
  }

  /**
   * Get table data async (for MySQL/PostgreSQL)
   */
  async getTableDataAsync(
    connectionId: string,
    table: string,
    page: number,
    pageSize: number,
    sortColumn?: string,
    sortDirection?: 'asc' | 'desc',
    filters?: Array<{
      column: string;
      operator: string;
      value: string;
    }>,
    schema?: string
  ): Promise<GetTableDataResponse> {
    const managed = this.connections.get(connectionId);
    if (!managed) {
      return { success: false, error: 'Connection not found' };
    }

    const adapter = managed.adapter;

    if (
      'getTableDataAsync' in adapter &&
      typeof (adapter as any).getTableDataAsync === 'function'
    ) {
      return (adapter as any).getTableDataAsync(
        connectionId,
        table,
        page,
        pageSize,
        sortColumn,
        sortDirection,
        filters,
        schema
      );
    }

    return adapter.getTableData(
      connectionId,
      table,
      page,
      pageSize,
      sortColumn,
      sortDirection,
      filters,
      schema
    );
  }

  /**
   * Execute one or more SQL statements
   */
  executeQuery(connectionId: string, query: string) {
    const adapter = this.getConnectionAdapter(connectionId);
    if (!adapter) {
      return { success: false as const, error: 'Connection not found' };
    }
    return adapter.executeQuery(connectionId, query);
  }

  /**
   * Execute query async (for MySQL/PostgreSQL)
   */
  async executeQueryAsync(connectionId: string, query: string) {
    const managed = this.connections.get(connectionId);
    if (!managed) {
      return { success: false as const, error: 'Connection not found' };
    }

    const adapter = managed.adapter;

    if (
      'executeQueryAsync' in adapter &&
      typeof (adapter as any).executeQueryAsync === 'function'
    ) {
      return (adapter as any).executeQueryAsync(connectionId, query);
    }

    return adapter.executeQuery(connectionId, query);
  }

  /**
   * Validate a SQL query
   */
  validateQuery(connectionId: string, sql: string): ValidationResult {
    const adapter = this.getConnectionAdapter(connectionId);
    if (!adapter) {
      return { isValid: false, error: 'Connection not found' };
    }
    return adapter.validateQuery(connectionId, sql);
  }

  /**
   * Get query execution plan
   */
  explainQuery(
    connectionId: string,
    sql: string
  ):
    | { success: true; plan: QueryPlanNode; stats: QueryPlanStats }
    | { success: false; error: string } {
    const adapter = this.getConnectionAdapter(connectionId);
    if (!adapter) {
      return { success: false, error: 'Connection not found' };
    }
    return adapter.explainQuery(connectionId, sql);
  }

  /**
   * Explain query async (for MySQL/PostgreSQL)
   */
  async explainQueryAsync(
    connectionId: string,
    sql: string
  ): Promise<
    | { success: true; plan: QueryPlanNode; stats: QueryPlanStats }
    | { success: false; error: string }
  > {
    const managed = this.connections.get(connectionId);
    if (!managed) {
      return { success: false, error: 'Connection not found' };
    }

    const adapter = managed.adapter;

    if (
      'explainQueryAsync' in adapter &&
      typeof (adapter as any).explainQueryAsync === 'function'
    ) {
      return (adapter as any).explainQueryAsync(connectionId, sql);
    }

    return adapter.explainQuery(connectionId, sql);
  }

  /**
   * Validate pending changes
   */
  validateChanges(connectionId: string, changes: PendingChangeInfo[]) {
    const adapter = this.getConnectionAdapter(connectionId);
    if (!adapter) {
      return { success: false as const, error: 'Connection not found' };
    }
    return adapter.validateChanges(connectionId, changes);
  }

  /**
   * Apply pending changes
   */
  applyChanges(connectionId: string, changes: PendingChangeInfo[]) {
    const adapter = this.getConnectionAdapter(connectionId);
    if (!adapter) {
      return { success: false as const, error: 'Connection not found' };
    }
    return adapter.applyChanges(connectionId, changes);
  }

  /**
   * Apply changes async (for MySQL/PostgreSQL)
   */
  async applyChangesAsync(connectionId: string, changes: PendingChangeInfo[]) {
    const managed = this.connections.get(connectionId);
    if (!managed) {
      return { success: false as const, error: 'Connection not found' };
    }

    const adapter = managed.adapter;

    if (
      'applyChangesAsync' in adapter &&
      typeof (adapter as any).applyChangesAsync === 'function'
    ) {
      return (adapter as any).applyChangesAsync(connectionId, changes);
    }

    return adapter.applyChanges(connectionId, changes);
  }

  /**
   * Get table structure
   */
  getTableStructure(
    connectionId: string,
    tableName: string,
    schema?: string
  ):
    | { success: true; structure: TableInfo }
    | { success: false; error: string } {
    const adapter = this.getConnectionAdapter(connectionId);
    if (!adapter) {
      return { success: false, error: 'Connection not found' };
    }
    return adapter.getTableStructure(connectionId, tableName, schema);
  }

  /**
   * Get table structure async (for MySQL/PostgreSQL)
   */
  async getTableStructureAsync(
    connectionId: string,
    tableName: string,
    schema?: string
  ): Promise<
    { success: true; structure: TableInfo } | { success: false; error: string }
  > {
    const managed = this.connections.get(connectionId);
    if (!managed) {
      return { success: false, error: 'Connection not found' };
    }

    const adapter = managed.adapter;

    if (
      'getTableStructureAsync' in adapter &&
      typeof (adapter as any).getTableStructureAsync === 'function'
    ) {
      return (adapter as any).getTableStructureAsync(
        connectionId,
        tableName,
        schema
      );
    }

    return adapter.getTableStructure(connectionId, tableName, schema);
  }

  /**
   * Get pending changes
   */
  getPendingChanges(connectionId: string) {
    const adapter = this.getConnectionAdapter(connectionId);
    if (!adapter) {
      return { success: false as const, error: 'Connection not found' };
    }
    return adapter.getPendingChanges(connectionId);
  }

  /**
   * Check if connection is async (MySQL/PostgreSQL)
   */
  isAsyncConnection(connectionId: string): boolean {
    const managed = this.connections.get(connectionId);
    if (!managed) {
      return false;
    }
    return managed.type !== 'sqlite';
  }

  /**
   * Get connection type
   */
  getConnectionType(connectionId: string): DatabaseType | null {
    const managed = this.connections.get(connectionId);
    return managed?.type || null;
  }

  /**
   * Close all connections
   */
  closeAll(): void {
    for (const adapter of this.adapters.values()) {
      adapter.closeAll();
    }
    this.connections.clear();
  }
}

// Export singleton instance
export const databaseManager = new DatabaseManager();
export default databaseManager;

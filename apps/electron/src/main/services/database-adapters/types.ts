/**
 * Database adapter types for multi-database support
 */

import type {
  DatabaseConnectionConfig,
  DatabaseType,
  ErrorCode,
  ErrorPosition,
  GetTableDataResponse,
  PendingChangeInfo,
  QueryPlanNode,
  QueryPlanStats,
  SchemaInfo,
  TableInfo,
  ValidationResult,
} from '@shared/types';

/**
 * Connection information returned by adapters
 */
export interface AdapterConnectionInfo {
  id: string;
  path: string;
  filename: string;
  isEncrypted: boolean;
  isReadOnly: boolean;
  databaseType: DatabaseType;
}

/**
 * Result type for adapter operations
 */
export type AdapterResult<T> =
  | { success: true; data: T }
  | {
      success: false;
      error: string;
      errorCode?: ErrorCode;
      errorPosition?: ErrorPosition;
      troubleshootingSteps?: string[];
      documentationUrl?: string;
    };

/**
 * Open connection result
 */
export type OpenResult =
  | { success: true; connection: AdapterConnectionInfo }
  | {
      success: false;
      error: string;
      needsPassword?: boolean;
      errorCode?: ErrorCode;
      troubleshootingSteps?: string[];
      documentationUrl?: string;
    };

/**
 * Query execution result
 */
export interface QueryResult {
  columns: string[];
  rows: unknown[][];
}

/**
 * Execute (non-SELECT) result
 */
export interface ExecuteResult {
  changes: number;
  lastInsertRowid: number;
}

/**
 * Abstract database adapter interface
 * All database-specific adapters must implement this interface
 */
export interface DatabaseAdapter {
  /**
   * Get the database type this adapter handles
   */
  readonly type: DatabaseType;

  /**
   * Open a database connection
   */
  open: (config: DatabaseConnectionConfig) => Promise<OpenResult>;

  /**
   * Close a database connection
   */
  close: (
    connectionId: string
  ) => { success: true } | { success: false; error: string };

  /**
   * Get connection information
   */
  getConnection: (connectionId: string) => AdapterConnectionInfo | null;

  /**
   * Get database schema
   */
  getSchema: (connectionId: string) => | {
        success: true;
        schemas: SchemaInfo[];
        tables: TableInfo[];
        views: TableInfo[];
      }
    | { success: false; error: string };

  /**
   * Execute a non-SELECT query (INSERT, UPDATE, DELETE, etc.)
   */
  execute: (
    connectionId: string,
    sql: string,
    params?: unknown[]
  ) => | { success: true; changes: number; lastInsertRowid: number }
    | {
        success: false;
        error: string;
        errorCode?: ErrorCode;
        errorPosition?: ErrorPosition;
        troubleshootingSteps?: string[];
        documentationUrl?: string;
      };

  /**
   * Execute a SELECT query
   */
  query: (
    connectionId: string,
    sql: string,
    params?: unknown[]
  ) => | { success: true; columns: string[]; rows: unknown[][] }
    | {
        success: false;
        error: string;
        errorCode?: ErrorCode;
        errorPosition?: ErrorPosition;
        troubleshootingSteps?: string[];
        documentationUrl?: string;
      };

  /**
   * Get table data with pagination, sorting, and filtering
   */
  getTableData: (
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
  ) => GetTableDataResponse;

  /**
   * Execute one or more SQL statements
   */
  executeQuery: (
    connectionId: string,
    query: string
  ) => | {
        success: true;
        columns?: string[];
        rows?: Record<string, unknown>[];
        resultSets?: Array<{
          columns: string[];
          rows: Record<string, unknown>[];
        }>;
        changes?: number;
        lastInsertRowid?: number;
        executedStatements?: number;
        totalChanges?: number;
      }
    | {
        success: false;
        error: string;
        errorCode?: ErrorCode;
        errorPosition?: ErrorPosition;
        troubleshootingSteps?: string[];
        documentationUrl?: string;
      };

  /**
   * Validate a SQL query without executing it
   */
  validateQuery: (connectionId: string, sql: string) => ValidationResult;

  /**
   * Get query execution plan
   */
  explainQuery: (
    connectionId: string,
    sql: string
  ) => | { success: true; plan: QueryPlanNode; stats: QueryPlanStats }
    | { success: false; error: string };

  /**
   * Validate pending changes
   */
  validateChanges: (
    connectionId: string,
    changes: PendingChangeInfo[]
  ) => | { success: true; results: ValidationResult[] }
    | { success: false; error: string };

  /**
   * Apply pending changes
   */
  applyChanges: (
    connectionId: string,
    changes: PendingChangeInfo[]
  ) => | { success: true; appliedCount: number }
    | { success: false; error: string };

  /**
   * Close all connections managed by this adapter
   */
  closeAll: () => void;

  /**
   * Get table structure
   */
  getTableStructure: (
    connectionId: string,
    tableName: string,
    schema?: string
  ) => | { success: true; structure: TableInfo }
    | { success: false; error: string };

  /**
   * Get pending changes for a connection
   */
  getPendingChanges: (
    connectionId: string
  ) => | { success: true; changes: PendingChangeInfo[] }
    | { success: false; error: string };
}

/**
 * Default port numbers for each database type
 */
export const DEFAULT_PORTS: Record<DatabaseType, number> = {
  sqlite: 0, // Not applicable
  mysql: 3306,
  postgresql: 5432,
  supabase: 5432, // Supabase uses PostgreSQL
};

/**
 * Display names for database types
 */
export const DATABASE_TYPE_NAMES: Record<DatabaseType, string> = {
  sqlite: 'SQLite',
  mysql: 'MySQL',
  postgresql: 'PostgreSQL',
  supabase: 'Supabase',
};

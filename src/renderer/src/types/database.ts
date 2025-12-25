// Database connection state
export interface DatabaseConnection {
  id: string;
  path: string;
  filename: string;
  isEncrypted: boolean;
  isReadOnly: boolean;
  status: 'connected' | 'disconnected' | 'error';
  error?: string;
  connectedAt?: Date;
}

// Column information
export interface ColumnSchema {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string | null;
  isPrimaryKey: boolean;
}

// Index information
export interface IndexSchema {
  name: string;
  columns: string[];
  isUnique: boolean;
  sql: string;
}

// Foreign key information
export interface ForeignKeySchema {
  column: string;
  referencedTable: string;
  referencedColumn: string;
  onDelete?: string;
  onUpdate?: string;
}

// Table schema
export interface TableSchema {
  name: string;
  type: 'table' | 'view';
  columns: ColumnSchema[];
  primaryKey: string[];
  foreignKeys: ForeignKeySchema[];
  indexes: IndexSchema[];
  rowCount?: number;
  sql: string;
}

// Database schema (all tables)
export interface DatabaseSchema {
  tables: TableSchema[];
  views: TableSchema[];
}

// Pending change for diff preview
export type ChangeType = 'insert' | 'update' | 'delete';

export interface PendingChange {
  id: string;
  table: string;
  rowId: string | number;
  type: ChangeType;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  timestamp: Date;
  isValid: boolean;
  validationError?: string;
}

// Query session
export interface QuerySession {
  id: string;
  query: string;
  results: QueryResult | null;
  error: string | null;
  isExecuting: boolean;
  executionTime?: number;
  executedAt?: Date;
}

// Query result
export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowsAffected: number;
  lastInsertRowId?: number;
}

// Pagination
export interface PaginationState {
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
}

// Sort
export interface SortState {
  column: string;
  direction: 'asc' | 'desc';
}

// Filter
export interface FilterState {
  column: string;
  operator:
    | 'eq'
    | 'neq'
    | 'gt'
    | 'lt'
    | 'gte'
    | 'lte'
    | 'like'
    | 'isnull'
    | 'notnull';
  value: string;
}

// Table data request
export interface TableDataRequest {
  table: string;
  pagination: PaginationState;
  sort?: SortState;
  filters?: FilterState[];
}

// Table data response
export interface TableDataResponse {
  columns: ColumnSchema[];
  rows: Record<string, unknown>[];
  pagination: PaginationState;
}

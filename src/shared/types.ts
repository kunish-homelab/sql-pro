// Shared types for IPC communication between main and renderer
// These types define the contract for all database operations

// ============ Connection Types ============

export interface OpenDatabaseRequest {
  path: string;
  password?: string;
  readOnly?: boolean;
}

export interface OpenDatabaseResponse {
  success: boolean;
  connection?: {
    id: string;
    path: string;
    filename: string;
    isEncrypted: boolean;
    isReadOnly: boolean;
  };
  error?: string;
  /** When true, indicates the database requires a password to open */
  needsPassword?: boolean;
}

export interface CloseDatabaseRequest {
  connectionId: string;
}

export interface CloseDatabaseResponse {
  success: boolean;
  error?: string;
}

// ============ Schema Types ============

export interface GetSchemaRequest {
  connectionId: string;
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string | null;
  isPrimaryKey: boolean;
}

export interface IndexInfo {
  name: string;
  columns: string[];
  isUnique: boolean;
  sql: string;
}

export interface ForeignKeyInfo {
  column: string;
  referencedTable: string;
  referencedColumn: string;
  onDelete?: string;
  onUpdate?: string;
}

export interface TableInfo {
  name: string;
  type: 'table' | 'view';
  columns: ColumnInfo[];
  primaryKey: string[];
  foreignKeys: ForeignKeyInfo[];
  indexes: IndexInfo[];
  rowCount?: number;
  sql: string;
}

export interface GetSchemaResponse {
  success: boolean;
  tables?: TableInfo[];
  views?: TableInfo[];
  error?: string;
}

// ============ Table Data Types ============

export interface GetTableDataRequest {
  connectionId: string;
  table: string;
  page: number;
  pageSize: number;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  filters?: Array<{
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
  }>;
}

export interface GetTableDataResponse {
  success: boolean;
  columns?: ColumnInfo[];
  rows?: Record<string, unknown>[];
  totalRows?: number;
  error?: string;
}

// ============ Query Types ============

export interface ExecuteQueryRequest {
  connectionId: string;
  query: string;
}

export interface ExecuteQueryResponse {
  success: boolean;
  columns?: string[];
  rows?: Record<string, unknown>[];
  rowsAffected?: number;
  lastInsertRowId?: number;
  executionTime?: number;
  error?: string;
}

// ============ Change Types ============

export type ChangeType = 'insert' | 'update' | 'delete';

export interface PendingChangeInfo {
  id: string;
  table: string;
  rowId: string | number;
  type: ChangeType;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  /** Primary key column name for UPDATE/DELETE operations */
  primaryKeyColumn?: string;
}

export interface ValidateChangesRequest {
  connectionId: string;
  changes: PendingChangeInfo[];
}

export interface ValidationResult {
  changeId: string;
  isValid: boolean;
  error?: string;
}

export interface ValidateChangesResponse {
  success: boolean;
  results?: ValidationResult[];
  error?: string;
}

export interface ApplyChangesRequest {
  connectionId: string;
  changes: PendingChangeInfo[];
}

export interface ApplyChangesResponse {
  success: boolean;
  appliedCount?: number;
  error?: string;
}

// ============ Dialog Types ============

export interface OpenFileDialogRequest {
  title?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
  defaultPath?: string;
}

export interface OpenFileDialogResponse {
  success: boolean;
  filePath?: string;
  canceled?: boolean;
}

export interface SaveFileDialogRequest {
  title?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
  defaultPath?: string;
}

export interface SaveFileDialogResponse {
  success: boolean;
  filePath?: string;
  canceled?: boolean;
}

// ============ Export Types ============

export interface ExportRequest {
  connectionId: string;
  table: string;
  format: 'csv' | 'json' | 'sql';
  filePath: string;
  includeHeaders?: boolean;
}

export interface ExportResponse {
  success: boolean;
  rowsExported?: number;
  error?: string;
}

// ============ Preferences Types ============

export interface RecentConnection {
  path: string;
  filename: string;
  isEncrypted: boolean;
  lastOpened: string;
  /** User-defined display name (defaults to filename if not set) */
  displayName?: string;
  /** Open database in read-only mode */
  readOnly?: boolean;
  /** Timestamp when connection was first saved */
  createdAt?: string;
}

export interface GetRecentConnectionsResponse {
  success: boolean;
  connections?: RecentConnection[];
}

export interface Preferences {
  theme: 'light' | 'dark' | 'system';
  defaultPageSize: number;
  confirmBeforeApply: boolean;
  recentConnectionsLimit: number;
}

export interface GetPreferencesResponse {
  success: boolean;
  preferences?: Preferences;
}

export interface SetPreferencesRequest {
  preferences: Partial<Preferences>;
}

export interface SetPreferencesResponse {
  success: boolean;
  error?: string;
}

// ============ Password Storage Types ============

export interface SavePasswordRequest {
  dbPath: string;
  password: string;
}

export interface SavePasswordResponse {
  success: boolean;
  error?: string;
}

export interface GetPasswordRequest {
  dbPath: string;
}

export interface GetPasswordResponse {
  success: boolean;
  password?: string;
  error?: string;
}

export interface HasPasswordRequest {
  dbPath: string;
}

export interface HasPasswordResponse {
  success: boolean;
  hasPassword: boolean;
}

export interface RemovePasswordRequest {
  dbPath: string;
}

export interface RemovePasswordResponse {
  success: boolean;
  error?: string;
}

export interface IsPasswordStorageAvailableResponse {
  success: boolean;
  available: boolean;
}

// ============ Connection Profile Types ============

export interface UpdateConnectionRequest {
  /** Absolute path to database file (profile identifier) */
  path: string;
  /** New display name (optional, keeps existing if not provided) */
  displayName?: string;
  /** New read-only setting (optional, keeps existing if not provided) */
  readOnly?: boolean;
}

export interface UpdateConnectionResponse {
  success: boolean;
  error?: string;
}

export interface RemoveConnectionRequest {
  /** Absolute path to database file (profile identifier) */
  path: string;
  /** If true, also removes saved password from keychain */
  removePassword?: boolean;
}

export interface RemoveConnectionResponse {
  success: boolean;
  error?: string;
}

// ============ IPC Channel Names ============

export const IPC_CHANNELS = {
  // Database operations
  DB_OPEN: 'db:open',
  DB_CLOSE: 'db:close',
  DB_GET_SCHEMA: 'db:getSchema',
  DB_GET_TABLE_DATA: 'db:getTableData',
  DB_EXECUTE_QUERY: 'db:executeQuery',
  DB_VALIDATE_CHANGES: 'db:validateChanges',
  DB_APPLY_CHANGES: 'db:applyChanges',

  // Dialogs
  DIALOG_OPEN_FILE: 'dialog:openFile',
  DIALOG_SAVE_FILE: 'dialog:saveFile',

  // Export
  EXPORT_DATA: 'export:data',

  // Preferences
  APP_GET_RECENT_CONNECTIONS: 'app:getRecentConnections',
  APP_GET_PREFERENCES: 'app:getPreferences',
  APP_SET_PREFERENCES: 'app:setPreferences',

  // Password storage
  PASSWORD_SAVE: 'password:save',
  PASSWORD_GET: 'password:get',
  PASSWORD_HAS: 'password:has',
  PASSWORD_REMOVE: 'password:remove',
  PASSWORD_IS_AVAILABLE: 'password:isAvailable',

  // Connection profile operations
  CONNECTION_UPDATE: 'connection:update',
  CONNECTION_REMOVE: 'connection:remove',

  // Menu actions (main -> renderer)
  MENU_ACTION: 'menu:action',
} as const;

// Menu action types
export type MenuAction =
  | 'open-database'
  | 'close-database'
  | 'refresh-schema'
  | 'open-settings'
  | 'toggle-command-palette'
  | 'switch-to-data'
  | 'switch-to-query'
  | 'execute-query'
  | 'toggle-history';

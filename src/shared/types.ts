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

export interface TriggerInfo {
  name: string;
  tableName: string;
  timing: 'BEFORE' | 'AFTER' | 'INSTEAD OF';
  event: 'INSERT' | 'UPDATE' | 'DELETE';
  sql: string;
}

export interface TableInfo {
  name: string;
  schema: string; // Database schema (e.g., 'main', 'temp' for SQLite)
  type: 'table' | 'view';
  columns: ColumnInfo[];
  primaryKey: string[];
  foreignKeys: ForeignKeyInfo[];
  indexes: IndexInfo[];
  triggers: TriggerInfo[];
  rowCount?: number;
  sql: string;
}

export interface SchemaInfo {
  name: string;
  tables: TableInfo[];
  views: TableInfo[];
}

export interface GetSchemaResponse {
  success: boolean;
  schemas?: SchemaInfo[];
  tables?: TableInfo[];
  views?: TableInfo[];
  error?: string;
}

// ============ Table Data Types ============

export interface GetTableDataRequest {
  connectionId: string;
  schema?: string; // Database schema (defaults to 'main' for SQLite)
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
  schema?: string; // Database schema (defaults to 'main' for SQLite)
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

// ============ Query History Types ============

export interface QueryHistoryEntry {
  /** Unique identifier for the history entry */
  id: string;
  /** Database file path (used to scope history per database) */
  dbPath: string;
  /** Full SQL query text */
  queryText: string;
  /** When the query was executed (ISO string) */
  executedAt: string;
  /** Query execution duration in milliseconds */
  durationMs: number;
  /** Whether the query execution was successful */
  success: boolean;
  /** Error message if execution failed */
  error?: string;
}

export interface GetQueryHistoryRequest {
  /** Database file path to get history for */
  dbPath: string;
}

export interface GetQueryHistoryResponse {
  success: boolean;
  history?: QueryHistoryEntry[];
  error?: string;
}

export interface SaveQueryHistoryRequest {
  /** The history entry to save */
  entry: QueryHistoryEntry;
}

export interface SaveQueryHistoryResponse {
  success: boolean;
  error?: string;
}

export interface DeleteQueryHistoryRequest {
  /** Database file path */
  dbPath: string;
  /** ID of the history entry to delete */
  entryId: string;
}

export interface DeleteQueryHistoryResponse {
  success: boolean;
  error?: string;
}

export interface ClearQueryHistoryRequest {
  /** Database file path to clear history for */
  dbPath: string;
}

export interface ClearQueryHistoryResponse {
  success: boolean;
  error?: string;
}

// ============ Query Plan Analysis Types ============

export interface QueryPlanNode {
  /** Node identifier from EXPLAIN QUERY PLAN */
  id: number;
  /** Parent node ID (0 for root nodes) */
  parent: number;
  /** Reserved field from SQLite */
  notUsed: number;
  /** Operation description (e.g., "SCAN TABLE users", "SEARCH TABLE users USING INDEX") */
  detail: string;
}

export interface QueryPlanStats {
  /** Query execution time in milliseconds */
  executionTime: number;
  /** Estimated or actual rows examined */
  rowsExamined: number;
  /** Number of rows returned */
  rowsReturned: number;
  /** List of indexes used in the query */
  indexesUsed: string[];
  /** List of tables accessed */
  tablesAccessed: string[];
}

export interface AnalyzeQueryPlanRequest {
  connectionId: string;
  query: string;
}

export interface AnalyzeQueryPlanResponse {
  success: boolean;
  plan?: QueryPlanNode[];
  stats?: QueryPlanStats;
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
  DB_ANALYZE_PLAN: 'db:analyzeQueryPlan',

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

  // Query history operations
  HISTORY_GET: 'history:get',
  HISTORY_SAVE: 'history:save',
  HISTORY_DELETE: 'history:delete',
  HISTORY_CLEAR: 'history:clear',

  // Menu actions (main -> renderer)
  MENU_ACTION: 'menu:action',

  // AI operations
  AI_GET_SETTINGS: 'ai:getSettings',
  AI_SAVE_SETTINGS: 'ai:saveSettings',
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

// ============ AI Types ============

export type AIProvider = 'openai' | 'anthropic';

export interface AISettings {
  provider: AIProvider;
  apiKey: string;
  model: string;
}

export interface SaveAISettingsRequest {
  settings: AISettings;
}

export interface SaveAISettingsResponse {
  success: boolean;
  error?: string;
}

export interface GetAISettingsResponse {
  success: boolean;
  settings?: AISettings;
  error?: string;
}

export interface NLToSQLRequest {
  prompt: string;
  schema: SchemaInfo[];
  context?: {
    currentTable?: string;
    recentQueries?: string[];
  };
}

export interface NLToSQLResponse {
  success: boolean;
  sql?: string;
  explanation?: string;
  error?: string;
}

export interface OptimizeQueryRequest {
  query: string;
  schema: SchemaInfo[];
  queryPlan?: QueryPlanNode[];
}

export interface OptimizeQueryResponse {
  success: boolean;
  optimizedQuery?: string;
  suggestions?: string[];
  explanation?: string;
  error?: string;
}

export interface AnalyzeDataRequest {
  columns: ColumnInfo[];
  rows: Record<string, unknown>[];
  analysisType: 'anomaly' | 'suggestions' | 'patterns';
}

export interface DataInsight {
  type: 'anomaly' | 'suggestion' | 'pattern';
  column?: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  details?: Record<string, unknown>;
}

export interface AnalyzeDataResponse {
  success: boolean;
  insights?: DataInsight[];
  summary?: string;
  error?: string;
}

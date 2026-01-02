// Shared types for IPC communication between main and renderer
// These types define the contract for all database operations

// ============ Auto-Update Types ============

export interface UpdateProgress {
  percent: number;
  bytesPerSecond: number;
  total: number;
  transferred: number;
}

export interface UpdateStatus {
  status:
    | 'checking'
    | 'available'
    | 'not-available'
    | 'downloading'
    | 'downloaded'
    | 'error';
  info?: {
    version: string;
    releaseDate?: string;
    releaseNotes?: string;
  };
  error?: Error;
  progress?: UpdateProgress;
}

// ============ Enhanced Error Types ============

/**
 * Error codes for categorizing different types of errors.
 * These codes help the UI determine how to display errors and what suggestions to show.
 */
export type ErrorCode =
  | 'SQL_SYNTAX_ERROR' // Invalid SQL syntax
  | 'SQL_CONSTRAINT_ERROR' // Constraint violation (foreign key, unique, check, not null)
  | 'TABLE_NOT_FOUND' // Table does not exist
  | 'COLUMN_NOT_FOUND' // Column does not exist
  | 'CONSTRAINT_VIOLATION' // General constraint violation
  | 'TYPE_MISMATCH' // Data type mismatch
  | 'CONNECTION_ERROR' // Database connection failure
  | 'PERMISSION_ERROR' // File system permission denied
  | 'FILE_NOT_FOUND' // Database file doesn't exist
  | 'ENCRYPTION_ERROR' // Encrypted database password issues
  | 'QUERY_EXECUTION_ERROR' // General query execution failure
  | 'UNKNOWN_ERROR'; // Fallback for unrecognized errors

/**
 * Position information for errors that occur at a specific location in SQL.
 */
export interface ErrorPosition {
  /** Line number (1-based) */
  line: number;
  /** Column number (1-based) */
  column: number;
}

/**
 * Enhanced error information with actionable suggestions and documentation links.
 * This interface extends basic error responses with richer error details.
 */
export interface EnhancedErrorInfo {
  /** Human-readable error message */
  error: string;
  /** Categorized error code for programmatic handling */
  errorCode?: ErrorCode;
  /** Position in SQL where the error occurred (for syntax errors) */
  errorPosition?: ErrorPosition;
  /** Actionable suggestions to fix the error (2-3 items) */
  suggestions?: string[];
  /** URL to relevant SQLite documentation */
  documentationUrl?: string;
  /** Step-by-step troubleshooting instructions (for connection errors) */
  troubleshootingSteps?: string[];
}

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
  /** Categorized error code for programmatic handling */
  errorCode?: ErrorCode;
  /** Step-by-step troubleshooting instructions (for connection errors) */
  troubleshootingSteps?: string[];
  /** URL to relevant SQLite documentation */
  documentationUrl?: string;
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
  /** Categorized error code for programmatic handling */
  errorCode?: ErrorCode;
  /** Actionable suggestions to fix the error */
  suggestions?: string[];
}

// ============ Query Types ============

export interface ExecuteQueryRequest {
  connectionId: string;
  query: string;
}

/** Single result set from a SELECT query */
export interface QueryResultSet {
  columns: string[];
  rows: Record<string, unknown>[];
}

export interface ExecuteQueryResponse {
  success: boolean;
  /** Columns for single result (backward compatibility) */
  columns?: string[];
  /** Rows for single result (backward compatibility) */
  rows?: Record<string, unknown>[];
  /** Multiple result sets (for multi-SELECT queries) */
  resultSets?: QueryResultSet[];
  rowsAffected?: number;
  lastInsertRowId?: number;
  executionTime?: number;
  /** Number of statements executed (for multi-statement queries) */
  executedStatements?: number;
  /** Total changes across all statements (for multi-statement queries) */
  totalChanges?: number;
  error?: string;
  /** Categorized error code for programmatic handling */
  errorCode?: ErrorCode;
  /** Position in SQL where the error occurred (for syntax errors) */
  errorPosition?: ErrorPosition;
  /** Actionable suggestions to fix the error (2-3 items) */
  suggestions?: string[];
  /** URL to relevant SQLite documentation */
  documentationUrl?: string;
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
  changeId?: string;
  isValid?: boolean;
  valid?: boolean;
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
  /** Categorized error code for programmatic handling */
  errorCode?: ErrorCode;
  /** Actionable suggestions to fix the error */
  suggestions?: string[];
  /** URL to relevant SQLite documentation */
  documentationUrl?: string;
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

/** Supported export formats */
export type ExportFormat = 'csv' | 'json' | 'sql' | 'xlsx';

export interface ExportRequest {
  connectionId: string;
  table: string;
  format: ExportFormat;
  filePath: string;
  /** Columns to include in export (defaults to all columns if not specified) */
  columns?: string[];
  /** Include column headers in export (CSV format, defaults to true) */
  includeHeaders?: boolean;
  /** CSV delimiter character (defaults to ',') */
  delimiter?: string;
  /** Pretty-print JSON output with indentation (defaults to false) */
  prettyPrint?: boolean;
  /** Excel worksheet name (defaults to table name) */
  sheetName?: string;
  /**
   * Pre-filtered rows to export. When provided, these rows are used directly
   * instead of fetching all data from the table. This supports exporting
   * filtered/selected rows from the UI.
   */
  rows?: Record<string, unknown>[];
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

/**
 * Connection profile for saved database connections
 */
export interface ConnectionProfile {
  id: string;
  path: string;
  filename: string;
  isEncrypted: boolean;
  lastOpened: string;
  displayName: string;
  readOnly: boolean;
  createdAt: string;
  folderId?: string;
  tags?: string[];
  notes?: string;
  isSaved: boolean;
}

/**
 * Folder for organizing connection profiles
 */
export interface ProfileFolder {
  id: string;
  name: string;
  parentId?: string;
  createdAt: string;
  expanded?: boolean;
}

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

// Profile CRUD types
export interface SaveProfileRequest {
  profile: Omit<ConnectionProfile, 'id' | 'createdAt'> & {
    id?: string;
    createdAt?: string;
  };
}

export interface SaveProfileResponse {
  success: boolean;
  profile?: ConnectionProfile;
  error?: string;
}

export interface UpdateProfileRequest {
  id: string;
  updates: Partial<Omit<ConnectionProfile, 'id' | 'createdAt'>>;
}

export interface UpdateProfileResponse {
  success: boolean;
  profile?: ConnectionProfile;
  error?: string;
}

export interface DeleteProfileRequest {
  id: string;
  removePassword?: boolean;
}

export interface DeleteProfileResponse {
  success: boolean;
  error?: string;
}

export interface GetProfilesRequest {
  folderId?: string;
}

export interface GetProfilesResponse {
  success: boolean;
  profiles?: ConnectionProfile[];
  error?: string;
}

export interface ExportProfilesRequest {
  profileIds?: string[];
  includePasswords?: boolean;
}

export interface ExportProfilesResponse {
  success: boolean;
  data?: string;
  error?: string;
}

export interface ImportProfilesRequest {
  data: string;
  overwrite?: boolean;
}

export interface ImportProfilesResponse {
  success: boolean;
  imported?: number;
  skipped?: number;
  error?: string;
}

// Folder CRUD types
export interface CreateFolderRequest {
  folder: Omit<ProfileFolder, 'id' | 'createdAt'> & {
    id?: string;
    createdAt?: string;
  };
}

export interface CreateFolderResponse {
  success: boolean;
  folder?: ProfileFolder;
  error?: string;
}

export interface UpdateFolderRequest {
  id: string;
  updates: Partial<Omit<ProfileFolder, 'id' | 'createdAt'>>;
}

export interface UpdateFolderResponse {
  success: boolean;
  folder?: ProfileFolder;
  error?: string;
}

export interface DeleteFolderRequest {
  id: string;
  deleteContents?: boolean;
}

export interface DeleteFolderResponse {
  success: boolean;
  error?: string;
}

export interface GetFoldersRequest {
  parentId?: string;
}

export interface GetFoldersResponse {
  success: boolean;
  folders?: ProfileFolder[];
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

// ============ SQL Log Types ============

/**
 * Log level for SQL operations
 */
export type SqlLogLevel = 'info' | 'warn' | 'error' | 'debug';

/**
 * SQL log entry for tracking database operations
 */
export interface SqlLogEntry {
  /** Unique identifier for the log entry */
  id: string;
  /** Timestamp when the operation occurred (ISO string) */
  timestamp: string;
  /** Connection ID that executed the query */
  connectionId: string;
  /** Database file path */
  dbPath?: string;
  /** Operation type */
  operation: 'query' | 'execute' | 'open' | 'close' | 'schema' | 'other';
  /** SQL statement (if applicable) */
  sql?: string;
  /** Execution duration in milliseconds */
  durationMs?: number;
  /** Whether the operation was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Number of rows affected/returned */
  rowCount?: number;
  /** Log level */
  level: SqlLogLevel;
  /** Additional context */
  context?: Record<string, unknown>;
}

export interface GetSqlLogsRequest {
  /** Maximum number of logs to return */
  limit?: number;
  /** Filter by connection ID */
  connectionId?: string;
  /** Filter by log level */
  level?: SqlLogLevel;
}

export interface GetSqlLogsResponse {
  success: boolean;
  logs?: SqlLogEntry[];
  error?: string;
}

export interface ClearSqlLogsRequest {
  /** Clear logs for specific connection, or all if not provided */
  connectionId?: string;
}

export interface ClearSqlLogsResponse {
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
  /** Child nodes in the query plan tree */
  children?: QueryPlanNode[];
  /** Estimated cost of the operation */
  estimatedCost?: number;
  /** Estimated number of rows processed */
  estimatedRows?: number;
}

export interface QueryPlanStats {
  /** Query execution time in milliseconds */
  executionTime?: number;
  /** Estimated or actual rows examined */
  rowsExamined?: number;
  /** Number of rows returned */
  rowsReturned?: number;
  /** List of indexes used in the query */
  indexesUsed?: string[];
  /** List of tables accessed */
  tablesAccessed?: string[];
  /** Total number of nodes in the plan */
  totalNodes?: number;
  /** Depth of the plan tree */
  depth?: number;
  /** Whether the plan includes a table scan */
  hasScan?: boolean;
  /** Whether the plan includes a sort operation */
  hasSort?: boolean;
  /** Whether the plan uses an index */
  hasIndex?: boolean;
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

// ============ Window Types ============

export interface CreateWindowResponse {
  success: boolean;
  windowId?: string;
  error?: string;
}

export interface CloseWindowRequest {
  windowId?: string; // If not provided, closes the current window
}

export interface CloseWindowResponse {
  success: boolean;
  error?: string;
}

export interface FocusWindowRequest {
  windowId: number;
}

export interface FocusWindowResponse {
  success: boolean;
  error?: string;
}

export interface GetAllWindowsResponse {
  success: boolean;
  windowIds?: string[];
  error?: string;
}

export interface GetCurrentWindowResponse {
  success: boolean;
  windowId?: string;
  error?: string;
}

// ============ AI Types ============

export type AIModelProvider = 'openai' | 'anthropic' | 'local';

export interface AIModelConfig {
  provider: AIModelProvider;
  modelId: string;
  apiKey?: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface GetAIModelConfigResponse {
  success: boolean;
  config?: AIModelConfig;
  error?: string;
}

export interface SetAIModelConfigRequest {
  config: AIModelConfig;
}

export interface SetAIModelConfigResponse {
  success: boolean;
  error?: string;
}

export interface GenerateAISuggestionsRequest {
  connectionId: string;
  context: string;
  query?: string;
  type: 'query' | 'schema' | 'optimization' | 'documentation';
}

export interface GenerateAISuggestionsResponse {
  success: boolean;
  suggestions?: string[];
  explanation?: string;
  error?: string;
}

export interface ExplainQueryRequest {
  connectionId: string;
  query: string;
}

export interface ExplainQueryResponse {
  success: boolean;
  explanation?: string;
  suggestedOptimizations?: string[];
  error?: string;
}

// ============ AI Settings Types ============

export type AIProvider = 'openai' | 'anthropic' | 'custom';

// Default base URLs for AI providers
export const DEFAULT_AI_BASE_URLS: Record<AIProvider, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com',
  custom: '',
};

export interface AISettings {
  provider: AIProvider;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  customClaudePath?: string;
  claudeCodePath?: string;
}

// ============ Data Analysis Types ============

export interface DataInsight {
  type: 'trend' | 'anomaly' | 'pattern' | 'summary' | 'suggestion';
  title: string;
  description: string;
  confidence: number;
  data?: unknown;
  severity?: 'info' | 'warning' | 'error' | 'low' | 'medium' | 'high';
  column?: string;
  message?: string;
  details?: string;
}

export interface SaveAISettingsRequest {
  settings: AISettings;
}

// ============ AI Request Types ============

export interface AIFetchAnthropicRequest {
  apiKey: string;
  baseUrl?: string;
  model: string;
  system?: string;
  messages: Array<{ role: string; content: string }>;
  maxTokens?: number;
  temperature?: number;
}

export interface AIStreamAnthropicRequest extends AIFetchAnthropicRequest {
  stream?: boolean;
  requestId?: string;
}

export interface AIFetchOpenAIRequest {
  apiKey: string;
  baseUrl?: string;
  model: string;
  messages: Array<{ role: string; content: string }>;
  maxTokens?: number;
  temperature?: number;
  responseFormat?: unknown;
}

export interface AIStreamOpenAIRequest extends AIFetchOpenAIRequest {
  stream?: boolean;
  requestId?: string;
}

export interface AIAgentQueryRequest {
  apiKey?: string;
  model?: string;
  system?: string;
  messages?: Array<{ role: string; content: string }>;
  maxTokens?: number;
  temperature?: number;
  tools?: unknown[];
  customClaudePath?: string;
  prompt: string;
  requestId: string;
  maxTurns?: number;
}

export interface AICancelStreamRequest {
  streamId?: string;
  requestId?: string;
}

// ============ Menu Types ============

export type MenuAction =
  | 'open-database'
  | 'close-database'
  | 'refresh-schema'
  | 'refresh-table'
  | 'open-settings'
  | 'open-plugins'
  | 'toggle-command-palette'
  | 'switch-to-data'
  | 'switch-to-query'
  | 'toggle-history'
  | 'execute-query'
  | 'new-window'
  | 'export-query'
  | 'import-query'
  | 'export-schema'
  | 'import-schema';

// ============ Pro Features Types ============

export type ProFeatureType =
  | 'ai_assistant'
  | 'advanced_analytics'
  | 'export_formats'
  | 'batch_operations'
  | 'performance_monitoring';

/** String identifier for Pro features used in UI components */
export type ProFeature =
  | 'ai-nl-to-sql'
  | 'ai-data-analysis'
  | 'advanced-export'
  | 'plugin-system'
  | 'query-optimizer';

export interface ProFeatureInfo {
  id: ProFeatureType;
  name: string;
  description: string;
  enabled: boolean;
}

export interface ProStatus {
  isPro: boolean;
  licenseKey?: string;
  activatedAt?: string;
  expiresAt?: string;
  features: ProFeatureType[];
}

export interface GetProFeaturesResponse {
  success: boolean;
  features?: ProFeatureInfo[];
  isPro?: boolean;
  licenseKey?: string;
  licenseExpiresAt?: string;
  error?: string;
}

export interface ActivateProFeatureRequest {
  licenseKey: string;
}

export interface ActivateProFeatureResponse {
  success: boolean;
  features?: ProFeatureInfo[];
  expiresAt?: string;
  error?: string;
}

export interface CheckProStatusResponse {
  success: boolean;
  isPro: boolean;
  features?: ProFeatureInfo[];
  expiresAt?: string;
  error?: string;
}

export interface ProActivateRequest {
  licenseKey: string;
  features?: ProFeatureType[];
}

export interface ProActivateResponse {
  success: boolean;
  error?: string;
}

export interface ProDeactivateResponse {
  success: boolean;
  error?: string;
}

export interface ProGetStatusResponse {
  success: boolean;
  status?: ProStatus | null;
  error?: string;
}

// ============ AI Response Types ============

export interface AIFetchAnthropicResponse {
  success: boolean;
  message?: { role: string; content: string };
  content?: string;
  error?: string;
}

export interface AIFetchOpenAIResponse {
  success: boolean;
  message?: { role: string; content: string };
  content?: string;
  error?: string;
}

export interface AIStreamChunk {
  type: 'content' | 'done' | 'error' | 'delta';
  content?: string;
  error?: string;
  requestId?: string;
  fullContent?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

export interface AIAgentMessage {
  type: string;
  content?: unknown;
  requestId?: string;
  error?: string;
  result?: string;
}

export interface GetAISettingsResponse {
  success: boolean;
  settings?: AISettings | null;
  error?: string;
}

export interface SaveAISettingsResponse {
  success: boolean;
  error?: string;
}

export interface GetClaudeCodePathsResponse {
  success: boolean;
  paths?: string[];
  error?: string;
}

// ============ Schema Comparison Types ============

/**
 * Snapshot of a database schema at a specific point in time.
 * Used for comparing schemas between different points or databases.
 */
export interface SchemaSnapshot {
  /** Unique identifier for the snapshot */
  id: string;
  /** User-provided name for the snapshot */
  name: string;
  /** Database file path (optional, may not be present for imported snapshots) */
  dbPath?: string;
  /** Database filename (for display) */
  filename?: string;
  /** When the snapshot was created (ISO string) */
  createdAt: string;
  /** Schema information captured at snapshot time */
  schemas: SchemaInfo[];
  /** Total table count (for quick stats) */
  tableCount: number;
  /** Total view count (for quick stats) */
  viewCount: number;
}

/**
 * Type of change detected in schema comparison
 */
export type DiffType = 'added' | 'removed' | 'modified' | 'unchanged';

/**
 * Difference in a single column between schemas
 */
export interface ColumnDiff {
  /** Column name */
  name: string;
  /** Type of difference */
  diffType: DiffType;
  /** Column info in source schema (null if added in target) */
  source: ColumnInfo | null;
  /** Column info in target schema (null if removed from source) */
  target: ColumnInfo | null;
  /** Specific changes detected (type, nullable, default, pk) */
  changes?: {
    type?: { from: string; to: string };
    nullable?: { from: boolean; to: boolean };
    defaultValue?: { from: string | null; to: string | null };
    isPrimaryKey?: { from: boolean; to: boolean };
  };
}

/**
 * Difference in a single index between schemas
 */
export interface IndexDiff {
  /** Index name */
  name: string;
  /** Type of difference */
  diffType: DiffType;
  /** Index info in source schema (null if added in target) */
  source: IndexInfo | null;
  /** Index info in target schema (null if removed from source) */
  target: IndexInfo | null;
  /** Specific changes detected */
  changes?: {
    columns?: { from: string[]; to: string[] };
    isUnique?: { from: boolean; to: boolean };
  };
}

/**
 * Difference in a single foreign key between schemas
 */
export interface ForeignKeyDiff {
  /** Column name that has the foreign key */
  column: string;
  /** Type of difference */
  diffType: DiffType;
  /** Foreign key info in source schema (null if added in target) */
  source: ForeignKeyInfo | null;
  /** Foreign key info in target schema (null if removed from source) */
  target: ForeignKeyInfo | null;
  /** Specific changes detected */
  changes?: {
    referencedTable?: { from: string; to: string };
    referencedColumn?: { from: string; to: string };
    onDelete?: { from: string | undefined; to: string | undefined };
    onUpdate?: { from: string | undefined; to: string | undefined };
  };
}

/**
 * Difference in a single trigger between schemas
 */
export interface TriggerDiff {
  /** Trigger name */
  name: string;
  /** Type of difference */
  diffType: DiffType;
  /** Trigger info in source schema (null if added in target) */
  source: TriggerInfo | null;
  /** Trigger info in target schema (null if removed from source) */
  target: TriggerInfo | null;
  /** Specific changes detected */
  changes?: {
    timing?: {
      from: 'BEFORE' | 'AFTER' | 'INSTEAD OF';
      to: 'BEFORE' | 'AFTER' | 'INSTEAD OF';
    };
    event?: {
      from: 'INSERT' | 'UPDATE' | 'DELETE';
      to: 'INSERT' | 'UPDATE' | 'DELETE';
    };
    sql?: { from: string; to: string };
  };
}

/**
 * Comprehensive difference for a single table between schemas
 */
export interface TableDiff {
  /** Table name */
  name: string;
  /** Database schema name (e.g., 'main', 'temp') */
  schema: string;
  /** Type of difference */
  diffType: DiffType;
  /** Table info in source schema (null if added in target) */
  source: TableInfo | null;
  /** Table info in target schema (null if removed from source) */
  target: TableInfo | null;
  /** Column-level differences (only for modified tables) */
  columnDiffs?: ColumnDiff[];
  /** Index-level differences (only for modified tables) */
  indexDiffs?: IndexDiff[];
  /** Foreign key differences (only for modified tables) */
  foreignKeyDiffs?: ForeignKeyDiff[];
  /** Trigger differences (only for modified tables) */
  triggerDiffs?: TriggerDiff[];
  /** Primary key changes */
  primaryKeyChanges?: {
    from: string[];
    to: string[];
  };
}

/**
 * Complete schema comparison result
 */
export interface SchemaComparisonResult {
  /** Source identifier (connection ID or snapshot ID) */
  sourceId: string;
  /** Source name (for display) */
  sourceName: string;
  /** Source type */
  sourceType: 'connection' | 'snapshot';
  /** Target identifier (connection ID or snapshot ID) */
  targetId: string;
  /** Target name (for display) */
  targetName: string;
  /** Target type */
  targetType: 'connection' | 'snapshot';
  /** When the comparison was performed (ISO string) */
  comparedAt: string;
  /** All table differences */
  tableDiffs: TableDiff[];
  /** Quick summary statistics */
  summary: {
    /** Total tables in source */
    sourceTables: number;
    /** Total tables in target */
    targetTables: number;
    /** Tables added in target */
    tablesAdded: number;
    /** Tables removed from source */
    tablesRemoved: number;
    /** Tables modified */
    tablesModified: number;
    /** Tables unchanged */
    tablesUnchanged: number;
    /** Total column changes across all tables */
    totalColumnChanges: number;
    /** Total index changes across all tables */
    totalIndexChanges: number;
    /** Total foreign key changes across all tables */
    totalForeignKeyChanges: number;
    /** Total trigger changes across all tables */
    totalTriggerChanges: number;
  };
}

// ============ Schema Snapshot IPC Types ============

export interface SaveSchemaSnapshotRequest {
  connectionId: string;
  name: string;
}

export interface SaveSchemaSnapshotResponse {
  success: boolean;
  snapshot?: SchemaSnapshot;
  error?: string;
}

export interface GetSchemaSnapshotsResponse {
  success: boolean;
  snapshots?: SchemaSnapshot[];
  error?: string;
}

export interface GetSchemaSnapshotRequest {
  snapshotId: string;
}

export interface GetSchemaSnapshotResponse {
  success: boolean;
  snapshot?: SchemaSnapshot;
  error?: string;
}

export interface DeleteSchemaSnapshotRequest {
  snapshotId: string;
}

export interface DeleteSchemaSnapshotResponse {
  success: boolean;
  error?: string;
}

// ============ Schema Comparison IPC Types ============

export interface CompareConnectionsRequest {
  sourceConnectionId: string;
  targetConnectionId: string;
}

export interface CompareConnectionsResponse {
  success: boolean;
  result?: SchemaComparisonResult;
  error?: string;
}

export interface CompareConnectionToSnapshotRequest {
  connectionId: string;
  snapshotId: string;
  /** If true, connection is target, snapshot is source */
  reverseComparison?: boolean;
}

export interface CompareConnectionToSnapshotResponse {
  success: boolean;
  result?: SchemaComparisonResult;
  error?: string;
}

export interface CompareSnapshotsRequest {
  sourceSnapshotId: string;
  targetSnapshotId: string;
}

export interface CompareSnapshotsResponse {
  success: boolean;
  result?: SchemaComparisonResult;
  error?: string;
}

export interface GenerateMigrationSQLRequest {
  comparisonResult: SchemaComparisonResult;
  /** If true, generate SQL to go from target back to source */
  reverse?: boolean;
  /** Include DROP statements for removed tables/columns (default: false for safety) */
  includeDropStatements?: boolean;
}

export interface GenerateMigrationSQLResponse {
  success: boolean;
  /** Generated SQL statements */
  sql?: string;
  /** Individual statements as array (for step-by-step execution) */
  statements?: string[];
  /** Warnings about SQLite limitations or potential data loss */
  warnings?: string[];
  error?: string;
}

export interface ExportComparisonReportRequest {
  comparisonResult: SchemaComparisonResult;
  /** Report format (html, json, markdown) */
  format: 'html' | 'json' | 'markdown';
  /** File path to save the report */
  filePath: string;
  /** Include migration SQL in the report (optional) */
  includeMigrationSQL?: boolean;
}

export interface ExportComparisonReportResponse {
  success: boolean;
  /** Path where the report was saved */
  filePath?: string;
  error?: string;
}

// ============ Query & Schema Sharing Types ============

/**
 * Metadata information for shareable items.
 * Includes version for compatibility validation.
 */
export interface ShareableMetadata {
  /** Schema version for format compatibility (semver) */
  version: string;
  /** Timestamp when export was created (ISO string) */
  exportedAt: string;
  /** Application version that created the export */
  appVersion?: string;
  /** Optional user or team identifier */
  author?: string;
  /** Whether the export is compressed */
  compressed?: boolean;
}

/**
 * Single query export with metadata and documentation.
 * Used for sharing individual queries between users.
 */
export interface ShareableQuery {
  /** Unique identifier for the query */
  id: string;
  /** User-provided query name */
  name: string;
  /** Query description */
  description?: string;
  /** SQL query text */
  sql: string;
  /** Database context (e.g., database name or type) */
  databaseContext?: string;
  /** Database type (sqlite, postgres, mysql, etc.) */
  databaseType?: string;
  /** Tags for categorization */
  tags?: string[];
  /** Optional documentation or usage notes */
  documentation?: string;
  /** When the query was created (ISO string) */
  createdAt: string;
  /** When the query was last modified (ISO string) */
  modifiedAt?: string;
  /** Original author or creator */
  author?: string;
  /** Metadata for versioning and compatibility */
  metadata: ShareableMetadata;
}

/**
 * Schema export format types.
 */
export type SchemaExportFormat = 'json' | 'sql';

/**
 * Options for schema export.
 */
export interface SchemaExportOptions {
  /** Export format (json or sql) */
  format: SchemaExportFormat;
  /** Include indexes in export */
  includeIndexes?: boolean;
  /** Include triggers in export */
  includeTriggers?: boolean;
  /** Include foreign keys in export */
  includeForeignKeys?: boolean;
  /** Specific tables to export (exports all if not specified) */
  tables?: string[];
  /** Include CREATE TABLE statements */
  includeCreateStatements?: boolean;
  /** Include table comments/documentation */
  includeComments?: boolean;
}

/**
 * Schema definition export for sharing database structures.
 * Can be exported in JSON or SQL format.
 */
export interface ShareableSchema {
  /** Unique identifier for the schema export */
  id: string;
  /** User-provided schema name */
  name: string;
  /** Schema description */
  description?: string;
  /** Database name or identifier */
  databaseName?: string;
  /** Database type (sqlite, postgres, mysql, etc.) */
  databaseType?: string;
  /** Export format used */
  format: SchemaExportFormat;
  /** Schema information (when format is 'json') */
  schemas?: SchemaInfo[];
  /** SQL statements (when format is 'sql') */
  sqlStatements?: string[];
  /** Export options used */
  options: SchemaExportOptions;
  /** Optional documentation */
  documentation?: string;
  /** When the schema was exported (ISO string) */
  createdAt: string;
  /** Original author or creator */
  author?: string;
  /** Metadata for versioning and compatibility */
  metadata: ShareableMetadata;
}

/**
 * Bundle of multiple queries for batch sharing.
 * Useful for sharing query collections or templates.
 */
export interface ShareableBundle {
  /** Unique identifier for the bundle */
  id: string;
  /** Bundle name */
  name: string;
  /** Bundle description */
  description?: string;
  /** Collection of queries in the bundle */
  queries: Array<{
    /** Query ID within bundle */
    id: string;
    /** Query name */
    name: string;
    /** Query description */
    description?: string;
    /** SQL query text */
    sql: string;
    /** Optional query-specific notes */
    notes?: string;
    /** Tags for this query */
    tags?: string[];
    /** Order index in bundle */
    order?: number;
  }>;
  /** Database context for all queries */
  databaseContext?: string;
  /** Database type */
  databaseType?: string;
  /** Bundle-level tags */
  tags?: string[];
  /** Optional documentation */
  documentation?: string;
  /** When the bundle was created (ISO string) */
  createdAt: string;
  /** Original author or creator */
  author?: string;
  /** Metadata for versioning and compatibility */
  metadata: ShareableMetadata;
}

/**
 * Compression information for large exports.
 */
export interface CompressionInfo {
  /** Whether the data is compressed */
  compressed: boolean;
  /** Compression algorithm used (e.g., 'gzip') */
  algorithm?: string;
  /** Original size in bytes before compression */
  originalSize?: number;
  /** Compressed size in bytes */
  compressedSize?: number;
}

/**
 * Validation result for imported shareable items.
 */
export interface ShareableValidationResult {
  /** Whether the item is valid */
  valid: boolean;
  /** Validation errors (if any) */
  errors?: string[];
  /** Validation warnings (non-critical issues) */
  warnings?: string[];
  /** Whether the version is compatible */
  versionCompatible?: boolean;
  /** Detected compression info */
  compressionInfo?: CompressionInfo;
}

// ============ Query & Schema Sharing IPC Types ============

export interface ExportQueryRequest {
  /** Query data to export */
  query: Omit<ShareableQuery, 'id' | 'metadata' | 'createdAt'>;
  /** File path to save the export (optional, will prompt if not provided) */
  filePath?: string;
  /** Whether to compress the export (auto-compress if size > 100KB by default) */
  compress?: boolean;
}

export interface ExportQueryResponse {
  success: boolean;
  /** Path where the query was exported */
  filePath?: string;
  /** Compression info if compressed */
  compressionInfo?: CompressionInfo;
  error?: string;
}

export interface ImportQueryRequest {
  /** File path to import from (optional, will prompt if not provided) */
  filePath?: string;
  /** Raw JSON data to import (alternative to filePath) */
  data?: string;
}

export interface ImportQueryResponse {
  success: boolean;
  /** Imported query data */
  query?: ShareableQuery;
  /** Validation result */
  validation?: ShareableValidationResult;
  error?: string;
}

export interface ExportSchemaRequest {
  /** Connection ID to export schema from */
  connectionId: string;
  /** Schema data to export */
  schema: Omit<ShareableSchema, 'id' | 'metadata' | 'createdAt'>;
  /** File path to save the export (optional, will prompt if not provided) */
  filePath?: string;
  /** Whether to compress the export */
  compress?: boolean;
}

export interface ExportSchemaResponse {
  success: boolean;
  /** Path where the schema was exported */
  filePath?: string;
  /** Compression info if compressed */
  compressionInfo?: CompressionInfo;
  error?: string;
}

export interface ImportSchemaRequest {
  /** File path to import from (optional, will prompt if not provided) */
  filePath?: string;
  /** Raw JSON data to import (alternative to filePath) */
  data?: string;
}

export interface ImportSchemaResponse {
  success: boolean;
  /** Imported schema data */
  schema?: ShareableSchema;
  /** Validation result */
  validation?: ShareableValidationResult;
  error?: string;
}

export interface ExportBundleRequest {
  /** Bundle data to export */
  bundle: Omit<ShareableBundle, 'id' | 'metadata' | 'createdAt'>;
  /** File path to save the export (optional, will prompt if not provided) */
  filePath?: string;
  /** Whether to compress the export */
  compress?: boolean;
}

export interface ExportBundleResponse {
  success: boolean;
  /** Path where the bundle was exported */
  filePath?: string;
  /** Compression info if compressed */
  compressionInfo?: CompressionInfo;
  error?: string;
}

export interface ImportBundleRequest {
  /** File path to import from (optional, will prompt if not provided) */
  filePath?: string;
  /** Raw JSON data to import (alternative to filePath) */
  data?: string;
}

export interface ImportBundleResponse {
  success: boolean;
  /** Imported bundle data */
  bundle?: ShareableBundle;
  /** Validation result */
  validation?: ShareableValidationResult;
  error?: string;
}

// ============ IPC Channel Definitions ============

export interface IPCChannels {
  // Auto-Update
  'auto-update:check-for-updates': void;
  'auto-update:install-update': void;
  'auto-update:status': UpdateStatus;

  // Database Connection
  'database:open': [OpenDatabaseRequest, OpenDatabaseResponse];
  'database:close': [CloseDatabaseRequest, CloseDatabaseResponse];
  'database:get-schema': [GetSchemaRequest, GetSchemaResponse];

  // Table Data
  'table:get-data': [GetTableDataRequest, GetTableDataResponse];

  // Query Execution
  'query:execute': [ExecuteQueryRequest, ExecuteQueryResponse];
  'query:analyze-plan': [AnalyzeQueryPlanRequest, AnalyzeQueryPlanResponse];

  // Changes
  'changes:validate': [ValidateChangesRequest, ValidateChangesResponse];
  'changes:apply': [ApplyChangesRequest, ApplyChangesResponse];

  // File Dialog
  'dialog:open-file': [OpenFileDialogRequest, OpenFileDialogResponse];
  'dialog:save-file': [SaveFileDialogRequest, SaveFileDialogResponse];

  // Export
  'export:data': [ExportRequest, ExportResponse];

  // Preferences
  'preferences:get': void;
  'preferences:get-recent-connections': void;
  'preferences:set': [SetPreferencesRequest, SetPreferencesResponse];

  // Password Storage
  'password:save': [SavePasswordRequest, SavePasswordResponse];
  'password:get': [GetPasswordRequest, GetPasswordResponse];
  'password:has': [HasPasswordRequest, HasPasswordResponse];
  'password:remove': [RemovePasswordRequest, RemovePasswordResponse];
  'password:is-storage-available': void;

  // Connection Profiles
  'connection:update': [UpdateConnectionRequest, UpdateConnectionResponse];
  'connection:remove': [RemoveConnectionRequest, RemoveConnectionResponse];

  // Query History
  'query-history:get': [GetQueryHistoryRequest, GetQueryHistoryResponse];
  'query-history:save': [SaveQueryHistoryRequest, SaveQueryHistoryResponse];
  'query-history:delete': [
    DeleteQueryHistoryRequest,
    DeleteQueryHistoryResponse,
  ];
  'query-history:clear': [ClearQueryHistoryRequest, ClearQueryHistoryResponse];

  // SQL Logs
  'sql-log:get': [GetSqlLogsRequest, GetSqlLogsResponse];
  'sql-log:clear': [ClearSqlLogsRequest, ClearSqlLogsResponse];
  'sql-log:entry': SqlLogEntry; // Event pushed from main to renderer

  // Window Management
  'window:create': void;
  'window:close': [CloseWindowRequest, CloseWindowResponse];
  'window:focus': [FocusWindowRequest, FocusWindowResponse];
  'window:get-all': void;
  'window:get-current': void;

  // AI Features
  'ai:get-model-config': void;
  'ai:set-model-config': [SetAIModelConfigRequest, SetAIModelConfigResponse];
  'ai:generate-suggestions': [
    GenerateAISuggestionsRequest,
    GenerateAISuggestionsResponse,
  ];
  'ai:explain-query': [ExplainQueryRequest, ExplainQueryResponse];

  // Pro Features
  'pro:get-features': void;
  'pro:activate': [ActivateProFeatureRequest, ActivateProFeatureResponse];
  'pro:check-status': void;

  // Schema Snapshots
  'schema-snapshot:save': [
    SaveSchemaSnapshotRequest,
    SaveSchemaSnapshotResponse,
  ];
  'schema-snapshot:get-all': void;
  'schema-snapshot:get': [GetSchemaSnapshotRequest, GetSchemaSnapshotResponse];
  'schema-snapshot:delete': [
    DeleteSchemaSnapshotRequest,
    DeleteSchemaSnapshotResponse,
  ];

  // Schema Comparison
  'schema-comparison:compare-connections': [
    CompareConnectionsRequest,
    CompareConnectionsResponse,
  ];
  'schema-comparison:compare-connection-to-snapshot': [
    CompareConnectionToSnapshotRequest,
    CompareConnectionToSnapshotResponse,
  ];
  'schema-comparison:compare-snapshots': [
    CompareSnapshotsRequest,
    CompareSnapshotsResponse,
  ];
  'schema-comparison:generate-migration-sql': [
    GenerateMigrationSQLRequest,
    GenerateMigrationSQLResponse,
  ];
  'schema-comparison:export-report': [
    ExportComparisonReportRequest,
    ExportComparisonReportResponse,
  ];

  // Query & Schema Sharing
  'query:export': [ExportQueryRequest, ExportQueryResponse];
  'query:import': [ImportQueryRequest, ImportQueryResponse];
  'schema:export': [ExportSchemaRequest, ExportSchemaResponse];
  'schema:import': [ImportSchemaRequest, ImportSchemaResponse];
  'bundle:export': [ExportBundleRequest, ExportBundleResponse];
  'bundle:import': [ImportBundleRequest, ImportBundleResponse];
}

// ============ IPC Channel Constants ============

export const IPC_CHANNELS = {
  // Database
  DB_OPEN: 'db:open',
  DB_CLOSE: 'db:close',
  DB_GET_SCHEMA: 'db:get-schema',
  DB_GET_TABLE_DATA: 'db:get-table-data',
  DB_EXECUTE_QUERY: 'db:execute-query',
  DB_VALIDATE_CHANGES: 'db:validate-changes',
  DB_APPLY_CHANGES: 'db:apply-changes',
  DB_ANALYZE_PLAN: 'db:analyze-plan',

  // Dialog
  DIALOG_OPEN_FILE: 'dialog:open-file',
  DIALOG_SAVE_FILE: 'dialog:save-file',

  // Export
  EXPORT_DATA: 'export:data',

  // App
  APP_GET_RECENT_CONNECTIONS: 'app:get-recent-connections',
  APP_GET_PREFERENCES: 'app:get-preferences',
  APP_SET_PREFERENCES: 'app:set-preferences',

  // Password
  PASSWORD_IS_AVAILABLE: 'password:is-available',
  PASSWORD_SAVE: 'password:save',
  PASSWORD_GET: 'password:get',
  PASSWORD_HAS: 'password:has',
  PASSWORD_REMOVE: 'password:remove',

  // Connection
  CONNECTION_UPDATE: 'connection:update',
  CONNECTION_REMOVE: 'connection:remove',

  // History
  HISTORY_GET: 'history:get',
  HISTORY_SAVE: 'history:save',
  HISTORY_DELETE: 'history:delete',
  HISTORY_CLEAR: 'history:clear',

  // SQL Logs
  SQL_LOG_GET: 'sql-log:get',
  SQL_LOG_CLEAR: 'sql-log:clear',
  SQL_LOG_ENTRY: 'sql-log:entry',

  // AI
  AI_GET_SETTINGS: 'ai:get-settings',
  AI_SAVE_SETTINGS: 'ai:save-settings',
  AI_FETCH_ANTHROPIC: 'ai:fetch-anthropic',
  AI_STREAM_ANTHROPIC: 'ai:stream-anthropic',
  AI_FETCH_OPENAI: 'ai:fetch-openai',
  AI_STREAM_OPENAI: 'ai:stream-openai',
  AI_AGENT_QUERY: 'ai:agent-query',
  AI_CANCEL_STREAM: 'ai:cancel-stream',

  // Pro
  PRO_GET_STATUS: 'pro:get-status',
  PRO_ACTIVATE: 'pro:activate',
  PRO_DEACTIVATE: 'pro:deactivate',

  // Window
  WINDOW_CLOSE: 'window:close',
  WINDOW_FOCUS: 'window:focus',

  // Updates
  UPDATES_CHECK: 'updates:check',
  UPDATES_GET_STATUS: 'updates:get-status',
  UPDATES_DOWNLOAD: 'updates:download',
  UPDATES_QUIT_AND_INSTALL: 'updates:quit-and-install',

  // Menu
  MENU_ACTION: 'menu:action',

  // Plugin
  PLUGIN_EVENT: 'plugin:event',
  PLUGIN_LIST: 'plugin:list',
  PLUGIN_GET: 'plugin:get',
  PLUGIN_INSTALL: 'plugin:install',
  PLUGIN_UNINSTALL: 'plugin:uninstall',
  PLUGIN_ENABLE: 'plugin:enable',
  PLUGIN_DISABLE: 'plugin:disable',
  PLUGIN_UPDATE: 'plugin:update',
  PLUGIN_CHECK_UPDATES: 'plugin:check-updates',
  PLUGIN_MARKETPLACE_FETCH: 'plugin:marketplace-fetch',

  // AI additional channels
  AI_GET_CLAUDE_CODE_PATHS: 'ai:get-claude-code-paths',
  AI_STREAM_CHUNK: 'ai:stream-chunk',
  AI_AGENT_CANCEL: 'ai:agent-cancel',
  AI_AGENT_MESSAGE: 'ai:agent-message',

  // System
  SYSTEM_GET_FONTS: 'system:get-fonts',

  // Window additional channels
  WINDOW_CREATE: 'window:create',
  WINDOW_GET_ALL: 'window:get-all',
  WINDOW_GET_CURRENT: 'window:get-current',

  // Update aliases (for compatibility)
  UPDATE_CHECK: 'updates:check',
  UPDATE_DOWNLOAD: 'updates:download',
  UPDATE_INSTALL: 'updates:quit-and-install',
  UPDATE_STATUS: 'updates:get-status',

  // Profile
  PROFILE_SAVE: 'profile:save',
  PROFILE_UPDATE: 'profile:update',
  PROFILE_DELETE: 'profile:delete',
  PROFILE_GET_ALL: 'profile:get-all',
  PROFILE_EXPORT: 'profile:export',
  PROFILE_IMPORT: 'profile:import',

  // Folder
  FOLDER_CREATE: 'folder:create',
  FOLDER_UPDATE: 'folder:update',
  FOLDER_DELETE: 'folder:delete',
  FOLDER_GET_ALL: 'folder:get-all',

  // Schema Snapshots
  SCHEMA_SNAPSHOT_SAVE: 'schema-snapshot:save',
  SCHEMA_SNAPSHOT_GET_ALL: 'schema-snapshot:get-all',
  SCHEMA_SNAPSHOT_GET: 'schema-snapshot:get',
  SCHEMA_SNAPSHOT_DELETE: 'schema-snapshot:delete',

  // Schema Comparison
  SCHEMA_COMPARISON_COMPARE_CONNECTIONS:
    'schema-comparison:compare-connections',
  SCHEMA_COMPARISON_COMPARE_CONNECTION_TO_SNAPSHOT:
    'schema-comparison:compare-connection-to-snapshot',
  SCHEMA_COMPARISON_COMPARE_SNAPSHOTS: 'schema-comparison:compare-snapshots',
  SCHEMA_COMPARISON_GENERATE_MIGRATION_SQL:
    'schema-comparison:generate-migration-sql',
  SCHEMA_COMPARISON_EXPORT_REPORT: 'schema-comparison:export-report',

  // Query & Schema Sharing
  QUERY_EXPORT: 'query:export',
  QUERY_IMPORT: 'query:import',
  SCHEMA_EXPORT: 'schema:export',
  SCHEMA_IMPORT: 'schema:import',
  BUNDLE_EXPORT: 'bundle:export',
  BUNDLE_IMPORT: 'bundle:import',
} as const;

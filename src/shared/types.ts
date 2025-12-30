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

export interface ExecuteQueryResponse {
  success: boolean;
  columns?: string[];
  rows?: Record<string, unknown>[];
  rowsAffected?: number;
  lastInsertRowId?: number;
  executionTime?: number;
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
  windowId: string;
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

export type AIProvider = 'openai' | 'anthropic';

/** Default API endpoints for AI providers */
export const DEFAULT_AI_BASE_URLS: Record<AIProvider, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com',
};

export interface AISettings {
  provider: AIProvider;
  apiKey: string;
  model: string;
  /** Custom base URL for API calls (optional, uses default if empty) */
  baseUrl?: string;
  /** Path to Claude Code executable (for Anthropic provider with claude-agent-sdk) */
  claudeCodePath?: string;
}

export interface GetClaudeCodePathsResponse {
  success: boolean;
  paths?: string[];
  error?: string;
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

// AI Fetch Request/Response types (for IPC-based API calls)
export interface AIFetchAnthropicRequest {
  baseUrl?: string;
  apiKey: string;
  model: string;
  system: string;
  messages: Array<{ role: string; content: string }>;
  maxTokens?: number;
}

export interface AIFetchAnthropicResponse {
  success: boolean;
  content?: string;
  error?: string;
}

// Streaming AI request/response types
export interface AIStreamAnthropicRequest {
  baseUrl?: string;
  apiKey: string;
  model: string;
  system: string;
  messages: Array<{ role: string; content: string }>;
  maxTokens?: number;
  requestId: string; // Unique ID to identify the stream
}

export interface AIStreamChunk {
  type: 'delta' | 'done' | 'error';
  requestId: string;
  content?: string; // Text delta for 'delta' type
  fullContent?: string; // Full accumulated content for 'done' type
  error?: string; // Error message for 'error' type
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface AIStreamOpenAIRequest {
  baseUrl?: string;
  apiKey: string;
  model: string;
  messages: Array<{ role: string; content: string }>;
  maxTokens?: number;
  requestId: string;
}

export interface AICancelStreamRequest {
  requestId: string;
}

// Claude Agent SDK types for advanced AI operations
export interface AIAgentQueryRequest {
  prompt: string;
  systemPrompt?: string;
  requestId: string;
  maxTurns?: number;
}

export interface AIAgentMessage {
  type: 'system' | 'assistant' | 'result' | 'stream_event';
  requestId: string;
  content?: string;
  result?: string;
  error?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  costUsd?: number;
}

export interface AIFetchOpenAIRequest {
  baseUrl?: string;
  apiKey: string;
  model: string;
  messages: Array<{ role: string; content: string }>;
  maxTokens?: number;
  responseFormat?: { type: string };
}

export interface AIFetchOpenAIResponse {
  success: boolean;
  content?: string;
  error?: string;
}

// ============ Plugin Types ============

export interface PluginManifest {
  /** Unique identifier for the plugin (e.g., 'com.example.my-plugin') */
  id: string;
  /** Human-readable plugin name */
  name: string;
  /** Plugin version (semver) */
  version: string;
  /** Plugin description */
  description: string;
  /** Author name */
  author: string;
  /** Minimum app version required (semver) */
  minAppVersion?: string;
  /** Plugin entry point (path to main file) */
  main: string;
  /** Plugin repository URL */
  repository?: string;
  /** Plugin home page URL */
  homepage?: string;
  /** License type (e.g., 'MIT', 'Apache-2.0') */
  license?: string;
  /** Plugin permissions required */
  permissions?: string[];
  /** Plugin configuration schema (JSON schema) */
  configSchema?: Record<string, unknown>;
  /** Whether the plugin can be disabled */
  canDisable?: boolean;
}

export interface PluginInfo {
  manifest: PluginManifest;
  /** Absolute path to plugin directory */
  pluginPath: string;
  /** Whether the plugin is enabled */
  enabled: boolean;
  /** Whether the plugin has updates available */
  hasUpdates?: boolean;
  /** Available version if hasUpdates is true */
  availableVersion?: string;
}

export interface ListPluginsRequest {
  /** Filter plugins by enabled status */
  enabled?: boolean;
}

export interface ListPluginsResponse {
  success: boolean;
  plugins?: PluginInfo[];
  error?: string;
}

export interface GetPluginRequest {
  /** Plugin ID */
  id: string;
}

export interface GetPluginResponse {
  success: boolean;
  plugin?: PluginInfo;
  error?: string;
}

export interface InstallPluginRequest {
  /** Plugin ID from marketplace or local path */
  pluginId: string;
  /** Version to install (defaults to latest) */
  version?: string;
}

export interface InstallPluginResponse {
  success: boolean;
  plugin?: PluginInfo;
  error?: string;
}

export interface UninstallPluginRequest {
  /** Plugin ID */
  id: string;
}

export interface UninstallPluginResponse {
  success: boolean;
  error?: string;
}

export interface EnablePluginRequest {
  /** Plugin ID */
  id: string;
}

export interface EnablePluginResponse {
  success: boolean;
  error?: string;
}

export interface DisablePluginRequest {
  /** Plugin ID */
  id: string;
}

export interface DisablePluginResponse {
  success: boolean;
  error?: string;
}

export interface UpdatePluginRequest {
  /** Plugin ID */
  id: string;
  /** Version to update to (defaults to latest) */
  version?: string;
}

export interface UpdatePluginResponse {
  success: boolean;
  plugin?: PluginInfo;
  error?: string;
}

export interface CheckPluginUpdatesRequest {
  /** Plugin IDs to check (defaults to all) */
  pluginIds?: string[];
}

export interface CheckPluginUpdatesResponse {
  success: boolean;
  updates?: Array<{
    pluginId: string;
    currentVersion: string;
    availableVersion: string;
  }>;
  error?: string;
}

export interface PluginMarketplaceFetchRequest {
  /** Search query */
  query?: string;
  /** Filter by category */
  category?: string;
  /** Pagination offset */
  offset?: number;
  /** Pagination limit */
  limit?: number;
}

export interface MarketplacePluginInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  downloads: number;
  rating: number;
  /** URL to plugin icon/image */
  icon?: string;
  /** URL to repository */
  repository?: string;
  /** URL to documentation */
  documentation?: string;
}

export interface PluginMarketplaceFetchResponse {
  success: boolean;
  plugins?: MarketplacePluginInfo[];
  total?: number;
  error?: string;
}

/** System fonts available on the platform */
export interface GetSystemFontsResponse {
  success: boolean;
  fonts?: string[];
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

  // Window operations
  WINDOW_CREATE: 'window:create',
  WINDOW_CLOSE: 'window:close',
  WINDOW_FOCUS: 'window:focus',
  WINDOW_GET_ALL: 'window:getAll',
  WINDOW_GET_CURRENT: 'window:getCurrent',

  // Menu actions (main -> renderer)
  MENU_ACTION: 'menu:action',

  // AI operations
  AI_GET_SETTINGS: 'ai:getSettings',
  AI_SAVE_SETTINGS: 'ai:saveSettings',
  AI_GET_CLAUDE_CODE_PATHS: 'ai:getClaudeCodePaths',
  AI_FETCH_ANTHROPIC: 'ai:fetchAnthropic',
  AI_FETCH_OPENAI: 'ai:fetchOpenAI',
  AI_STREAM_ANTHROPIC: 'ai:streamAnthropic',
  AI_STREAM_OPENAI: 'ai:streamOpenAI',
  AI_STREAM_CHUNK: 'ai:streamChunk',
  AI_CANCEL_STREAM: 'ai:cancelStream',
  AI_AGENT_QUERY: 'ai:agentQuery',
  AI_AGENT_MESSAGE: 'ai:agentMessage',
  AI_AGENT_CANCEL: 'ai:agentCancel',

  // System operations
  SYSTEM_GET_FONTS: 'system:getFonts',

  // Auto-update operations
  UPDATE_CHECK: 'update:check',
  UPDATE_DOWNLOAD: 'update:download',
  UPDATE_INSTALL: 'update:install',
  UPDATE_STATUS: 'update:status',

  // Plugin operations
  PLUGIN_LIST: 'plugin:list',
  PLUGIN_GET: 'plugin:get',
  PLUGIN_INSTALL: 'plugin:install',
  PLUGIN_UNINSTALL: 'plugin:uninstall',
  PLUGIN_ENABLE: 'plugin:enable',
  PLUGIN_DISABLE: 'plugin:disable',
  PLUGIN_UPDATE: 'plugin:update',
  PLUGIN_CHECK_UPDATES: 'plugin:checkUpdates',

  // Plugin marketplace operations
  PLUGIN_MARKETPLACE_FETCH: 'plugin:marketplace:fetch',

  // Plugin events (main -> renderer)
  PLUGIN_EVENT: 'plugin:event',
} as const;

// Menu action types
export type MenuAction =
  | 'open-database'
  | 'close-database'
  | 'refresh-schema'
  | 'open-settings'
  | 'open-plugins'
  | 'toggle-command-palette'
  | 'switch-to-data'
  | 'switch-to-query'
  | 'execute-query'
  | 'toggle-history'
  | 'new-window';

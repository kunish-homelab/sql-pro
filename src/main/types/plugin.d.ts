// Plugin System Type Definitions
// These types define the contract for plugin development and runtime

// ============ Plugin Manifest Types ============

/**
 * Plugin permission types for future granular permission system.
 * Currently not enforced, included for forward compatibility.
 */
export type PluginPermission =
  | 'query:read'
  | 'query:write'
  | 'ui:menu'
  | 'ui:panel'
  | 'ui:command'
  | 'storage:read'
  | 'storage:write'
  | 'connection:info';

/**
 * Plugin manifest schema (plugin.json).
 * Defines the metadata and configuration for a plugin.
 */
export interface PluginManifest {
  /** Unique plugin identifier (e.g., 'com.example.myplugin') */
  id: string;
  /** Human-readable plugin name */
  name: string;
  /** Semantic version string (e.g., '1.0.0') */
  version: string;
  /** Plugin description */
  description: string;
  /** Author name or organization */
  author: string;
  /** Relative path to plugin entry point (e.g., 'index.js') */
  main: string;
  /** Required permissions (not enforced in initial version) */
  permissions?: PluginPermission[];
  /** Compatibility requirements */
  engines?: {
    /** Required SQL Pro version range (e.g., '^1.6.0') */
    sqlpro?: string;
  };
  /** Optional homepage URL */
  homepage?: string;
  /** Optional repository URL */
  repository?: string;
  /** Optional license identifier */
  license?: string;
  /** Optional keywords for marketplace search */
  keywords?: string[];
  /** Optional icon path relative to plugin directory */
  icon?: string;
  /** Optional screenshots for marketplace display */
  screenshots?: string[];
  /** Optional minimum required API version */
  apiVersion?: string;
}

// ============ Plugin State Types ============

/**
 * Possible states for a plugin during its lifecycle.
 */
export type PluginState =
  | 'installed'
  | 'enabled'
  | 'disabled'
  | 'error'
  | 'loading'
  | 'unloading';

/**
 * Stored plugin metadata including state and settings.
 */
export interface PluginInfo {
  /** Plugin manifest data */
  manifest: PluginManifest;
  /** Absolute path to plugin directory */
  path: string;
  /** Current plugin state */
  state: PluginState;
  /** Whether the plugin is currently enabled */
  enabled: boolean;
  /** Timestamp when plugin was installed */
  installedAt: string;
  /** Timestamp when plugin was last updated */
  updatedAt?: string;
  /** Error message if plugin is in error state */
  error?: string;
}

/**
 * Plugin registry entry for tracking loaded plugins.
 */
export interface PluginRegistryEntry {
  /** Plugin information */
  info: PluginInfo;
  /** Whether plugin is currently loaded in runtime */
  isLoaded: boolean;
  /** Plugin instance ID for runtime reference */
  instanceId?: string;
}

// ============ Plugin API Types ============

/**
 * Command registration options for UI Extension API.
 */
export interface CommandOptions {
  /** Unique command identifier */
  id: string;
  /** Human-readable command title */
  title: string;
  /** Optional keyboard shortcut (e.g., 'Ctrl+Shift+P') */
  shortcut?: string;
  /** Optional category for command palette grouping */
  category?: string;
  /** Command handler function */
  handler: () => void | Promise<void>;
}

/**
 * Menu item registration options for UI Extension API.
 */
export interface MenuItemOptions {
  /** Unique menu item identifier */
  id: string;
  /** Menu item label */
  label: string;
  /** Menu path (e.g., 'Plugins/My Plugin') */
  menuPath: string;
  /** Optional keyboard shortcut */
  shortcut?: string;
  /** Optional icon identifier */
  icon?: string;
  /** Click handler function */
  handler: () => void | Promise<void>;
  /** Optional function to determine if item is enabled */
  isEnabled?: () => boolean;
  /** Optional function to determine if item is visible */
  isVisible?: () => boolean;
}

/**
 * Panel registration options for UI Extension API.
 */
export interface PanelOptions {
  /** Unique panel identifier */
  id: string;
  /** Panel title */
  title: string;
  /** Panel location in the UI */
  location: 'sidebar' | 'bottom' | 'right';
  /** Optional icon identifier */
  icon?: string;
  /** Panel render function returning HTML string */
  render: () => string | Promise<string>;
  /** Optional cleanup function when panel is destroyed */
  dispose?: () => void;
}

/**
 * Notification options for UI Extension API.
 */
export interface NotificationOptions {
  /** Notification message */
  message: string;
  /** Notification type */
  type: 'info' | 'success' | 'warning' | 'error';
  /** Duration in milliseconds (0 for persistent) */
  duration?: number;
  /** Optional action buttons */
  actions?: Array<{
    label: string;
    handler: () => void;
  }>;
}

/**
 * UI Extension API exposed to plugins.
 */
export interface UIExtensionAPI {
  /** Register a command in the command palette */
  registerCommand: (options: CommandOptions) => () => void;
  /** Register a menu item in the application menu */
  registerMenuItem: (options: MenuItemOptions) => () => void;
  /** Register a panel in the UI */
  registerPanel: (options: PanelOptions) => () => void;
  /** Show a notification to the user */
  showNotification: (options: NotificationOptions) => void;
}

// ============ Query Lifecycle API Types ============

/**
 * Query context passed to lifecycle hooks.
 */
export interface QueryContext {
  /** The SQL query string */
  query: string;
  /** Connection ID for the database */
  connectionId: string;
  /** Database file path */
  dbPath: string;
  /** Timestamp when query was initiated */
  timestamp: number;
}

/**
 * Result of a query hook that can modify or cancel the query.
 */
export interface QueryHookResult {
  /** Modified query string (if changed) */
  query?: string;
  /** If true, cancels the query execution */
  cancel?: boolean;
  /** Reason for cancellation (shown to user) */
  cancelReason?: string;
  /** Additional metadata to attach to the query */
  metadata?: Record<string, unknown>;
}

/**
 * Query results passed to after-query hooks.
 */
export interface QueryResults {
  /** Column names */
  columns: string[];
  /** Result rows */
  rows: Record<string, unknown>[];
  /** Number of rows affected (for write operations) */
  rowsAffected?: number;
  /** Last insert row ID (for INSERT operations) */
  lastInsertRowId?: number;
  /** Query execution time in milliseconds */
  executionTime: number;
  /** Additional metadata from before-query hooks */
  metadata?: Record<string, unknown>;
}

/**
 * Error information passed to error hooks.
 */
export interface QueryError {
  /** Error message */
  message: string;
  /** Error code (if available) */
  code?: string;
  /** Original query that caused the error */
  query: string;
  /** Connection ID */
  connectionId: string;
}

/**
 * Before-query hook function type.
 */
export type BeforeQueryHook = (
  context: QueryContext
) => QueryHookResult | Promise<QueryHookResult> | void | Promise<void>;

/**
 * After-query hook function type.
 */
export type AfterQueryHook = (
  results: QueryResults,
  context: QueryContext
) => QueryResults | Promise<QueryResults> | void | Promise<void>;

/**
 * Query error hook function type.
 */
export type QueryErrorHook = (error: QueryError) => void | Promise<void>;

/**
 * Query Lifecycle API exposed to plugins.
 */
export interface QueryLifecycleAPI {
  /** Register a hook that runs before query execution */
  onBeforeQuery: (hook: BeforeQueryHook) => () => void;
  /** Register a hook that runs after successful query execution */
  onAfterQuery: (hook: AfterQueryHook) => () => void;
  /** Register a hook that runs when a query encounters an error */
  onQueryError: (hook: QueryErrorHook) => () => void;
}

// ============ Storage API Types ============

/**
 * Storage API for per-plugin persistent data.
 */
export interface StorageAPI {
  /** Get a value from plugin storage */
  get: <T = unknown>(key: string) => Promise<T | undefined>;
  /** Set a value in plugin storage */
  set: <T = unknown>(key: string, value: T) => Promise<void>;
  /** Remove a value from plugin storage */
  remove: (key: string) => Promise<void>;
  /** Get all keys in plugin storage */
  keys: () => Promise<string[]>;
  /** Clear all plugin storage */
  clear: () => Promise<void>;
}

// ============ Metadata API Types ============

/**
 * Current connection information.
 */
export interface ConnectionInfo {
  /** Connection ID */
  id: string;
  /** Database file path */
  path: string;
  /** Database filename */
  filename: string;
  /** Whether the database is encrypted */
  isEncrypted: boolean;
  /** Whether the connection is read-only */
  isReadOnly: boolean;
}

/**
 * Application information.
 */
export interface AppInfo {
  /** Application version */
  version: string;
  /** Platform (e.g., 'darwin', 'win32', 'linux') */
  platform: string;
  /** Architecture (e.g., 'x64', 'arm64') */
  arch: string;
  /** Whether running in development mode */
  isDev: boolean;
}

/**
 * Metadata API exposed to plugins.
 */
export interface MetadataAPI {
  /** Get plugin's own manifest information */
  getPluginInfo: () => PluginManifest;
  /** Get current database connection (if any) */
  getCurrentConnection: () => ConnectionInfo | null;
  /** Get application information */
  getAppInfo: () => AppInfo;
}

// ============ Plugin Context Types ============

/**
 * Complete Plugin API surface available to plugins.
 */
export interface PluginAPI {
  /** UI Extension API for adding commands, menus, and panels */
  ui: UIExtensionAPI;
  /** Query Lifecycle API for intercepting queries */
  query: QueryLifecycleAPI;
  /** Storage API for persistent plugin data */
  storage: StorageAPI;
  /** Metadata API for accessing app and connection info */
  metadata: MetadataAPI;
}

/**
 * Plugin context passed to plugin entry point.
 */
export interface PluginContext {
  /** The complete Plugin API */
  api: PluginAPI;
  /** Plugin's own manifest */
  manifest: PluginManifest;
  /** Path to plugin's directory */
  pluginPath: string;
}

/**
 * Plugin entry point function signature.
 * Plugins must export an activate function with this signature.
 */
export type PluginActivate = (context: PluginContext) => void | Promise<void>;

/**
 * Optional plugin deactivate function.
 * Called when plugin is disabled or uninstalled.
 */
export type PluginDeactivate = () => void | Promise<void>;

/**
 * Plugin module exports interface.
 */
export interface PluginModule {
  /** Called when plugin is activated */
  activate: PluginActivate;
  /** Called when plugin is deactivated (optional) */
  deactivate?: PluginDeactivate;
}

// ============ Plugin Runtime Types ============

/**
 * Plugin isolate configuration for sandboxed execution.
 */
export interface PluginIsolateConfig {
  /** Memory limit in MB (default: 128) */
  memoryLimitMb: number;
  /** Execution timeout in milliseconds */
  timeoutMs: number;
  /** Whether to enable inspector for debugging */
  enableInspector?: boolean;
}

/**
 * Plugin runtime instance representing a loaded plugin.
 */
export interface PluginInstance {
  /** Plugin ID from manifest */
  pluginId: string;
  /** Unique instance ID */
  instanceId: string;
  /** Plugin manifest */
  manifest: PluginManifest;
  /** Current state */
  state: PluginState;
  /** Registered command IDs */
  registeredCommands: string[];
  /** Registered menu item IDs */
  registeredMenuItems: string[];
  /** Registered panel IDs */
  registeredPanels: string[];
  /** Registered query hooks */
  registeredHooks: {
    beforeQuery: string[];
    afterQuery: string[];
    queryError: string[];
  };
}

// ============ Plugin Marketplace Types ============

/**
 * Plugin listing in the marketplace.
 */
export interface PluginListing {
  /** Plugin ID */
  id: string;
  /** Plugin name */
  name: string;
  /** Plugin version */
  version: string;
  /** Plugin description */
  description: string;
  /** Author name */
  author: string;
  /** Download URL for plugin archive */
  downloadUrl: string;
  /** Optional icon URL */
  iconUrl?: string;
  /** Optional screenshot URLs */
  screenshots?: string[];
  /** Optional homepage URL */
  homepage?: string;
  /** Optional repository URL */
  repository?: string;
  /** Plugin categories/tags */
  categories?: string[];
  /** Download count */
  downloads?: number;
  /** Average rating (1-5) */
  rating?: number;
  /** Last updated timestamp */
  updatedAt: string;
  /** Required SQL Pro version */
  engineVersion?: string;
  /** Required permissions */
  permissions?: PluginPermission[];
}

/**
 * Marketplace registry response.
 */
export interface MarketplaceRegistry {
  /** API version */
  version: string;
  /** Last updated timestamp */
  updatedAt: string;
  /** Available plugins */
  plugins: PluginListing[];
}

// ============ Plugin IPC Types ============

/**
 * Request to list installed plugins.
 */
export interface ListPluginsRequest {
  /** Filter by state (optional) */
  state?: PluginState;
  /** Include only enabled plugins */
  enabledOnly?: boolean;
}

/**
 * Response containing list of plugins.
 */
export interface ListPluginsResponse {
  success: boolean;
  plugins?: PluginInfo[];
  error?: string;
}

/**
 * Request to install a plugin.
 */
export interface InstallPluginRequest {
  /** Path to .sqlpro-plugin archive or directory */
  source: string;
  /** Source type */
  sourceType: 'archive' | 'directory' | 'url';
}

/**
 * Response from plugin installation.
 */
export interface InstallPluginResponse {
  success: boolean;
  plugin?: PluginInfo;
  error?: string;
}

/**
 * Request to uninstall a plugin.
 */
export interface UninstallPluginRequest {
  /** Plugin ID to uninstall */
  pluginId: string;
  /** Whether to remove plugin data */
  removeData?: boolean;
}

/**
 * Response from plugin uninstallation.
 */
export interface UninstallPluginResponse {
  success: boolean;
  error?: string;
}

/**
 * Request to enable a plugin.
 */
export interface EnablePluginRequest {
  /** Plugin ID to enable */
  pluginId: string;
}

/**
 * Response from plugin enable.
 */
export interface EnablePluginResponse {
  success: boolean;
  error?: string;
}

/**
 * Request to disable a plugin.
 */
export interface DisablePluginRequest {
  /** Plugin ID to disable */
  pluginId: string;
}

/**
 * Response from plugin disable.
 */
export interface DisablePluginResponse {
  success: boolean;
  error?: string;
}

/**
 * Request to get plugin details.
 */
export interface GetPluginRequest {
  /** Plugin ID */
  pluginId: string;
}

/**
 * Response containing plugin details.
 */
export interface GetPluginResponse {
  success: boolean;
  plugin?: PluginInfo;
  error?: string;
}

/**
 * Request to fetch marketplace registry.
 */
export interface FetchMarketplaceRequest {
  /** Optional search query */
  query?: string;
  /** Optional category filter */
  category?: string;
  /** Force refresh cache */
  forceRefresh?: boolean;
}

/**
 * Response containing marketplace data.
 */
export interface FetchMarketplaceResponse {
  success: boolean;
  registry?: MarketplaceRegistry;
  /** Indicates if data is from cache */
  cached?: boolean;
  error?: string;
}

/**
 * Request to check for plugin updates.
 */
export interface CheckUpdatesRequest {
  /** Specific plugin IDs to check (optional, checks all if empty) */
  pluginIds?: string[];
}

/**
 * Plugin update information.
 */
export interface PluginUpdate {
  /** Plugin ID */
  pluginId: string;
  /** Current installed version */
  currentVersion: string;
  /** Available new version */
  newVersion: string;
  /** Changelog or release notes */
  changelog?: string;
  /** Download URL for update */
  downloadUrl: string;
}

/**
 * Response containing available updates.
 */
export interface CheckUpdatesResponse {
  success: boolean;
  updates?: PluginUpdate[];
  error?: string;
}

/**
 * Request to update a plugin.
 */
export interface UpdatePluginRequest {
  /** Plugin ID to update */
  pluginId: string;
}

/**
 * Response from plugin update.
 */
export interface UpdatePluginResponse {
  success: boolean;
  plugin?: PluginInfo;
  error?: string;
}

// ============ Plugin Event Types ============

/**
 * Plugin lifecycle event types.
 */
export type PluginEventType =
  | 'plugin:installed'
  | 'plugin:uninstalled'
  | 'plugin:enabled'
  | 'plugin:disabled'
  | 'plugin:error'
  | 'plugin:updated';

/**
 * Plugin event payload.
 */
export interface PluginEvent {
  /** Event type */
  type: PluginEventType;
  /** Plugin ID */
  pluginId: string;
  /** Plugin info (if available) */
  plugin?: PluginInfo;
  /** Error message (for error events) */
  error?: string;
  /** Event timestamp */
  timestamp: string;
}

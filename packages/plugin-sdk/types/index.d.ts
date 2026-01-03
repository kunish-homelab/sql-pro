/**
 * SQL Pro Plugin SDK Type Definitions
 *
 * This module provides TypeScript type definitions for developing SQL Pro plugins.
 * Import these types in your plugin to get full type safety and IDE autocomplete.
 *
 * @packageDocumentation
 * @module @sqlpro/plugin-sdk
 *
 * @example
 * ```typescript
 * import type { PluginContext, PluginModule } from '@sqlpro/plugin-sdk';
 *
 * export const activate: PluginModule['activate'] = (context: PluginContext) => {
 *   context.api.ui.showNotification({
 *     message: 'Plugin activated!',
 *     type: 'success'
 *   });
 * };
 * ```
 */

// ============================================================================
// Plugin Manifest Types
// ============================================================================

/**
 * Plugin permission types for granular access control.
 *
 * @remarks
 * Permissions are declared in plugin.json and inform users about plugin capabilities.
 * Currently not enforced at runtime, included for forward compatibility.
 *
 * Available permissions:
 * - `query:read` - Read query text and results
 * - `query:write` - Modify queries before execution
 * - `ui:menu` - Add items to application menus
 * - `ui:panel` - Create custom UI panels
 * - `ui:command` - Register commands in command palette
 * - `storage:read` - Read from plugin storage
 * - `storage:write` - Write to plugin storage
 * - `connection:info` - Access database connection information
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
 *
 * Defines the metadata and configuration for a plugin. This file must be present
 * at the root of your plugin directory and named `plugin.json`.
 *
 * @example
 * ```json
 * {
 *   "id": "com.example.myplugin",
 *   "name": "My Plugin",
 *   "version": "1.0.0",
 *   "description": "A helpful SQL Pro plugin",
 *   "author": "Your Name",
 *   "main": "index.js",
 *   "permissions": ["query:read", "ui:menu"],
 *   "engines": {
 *     "sqlpro": "^1.6.0"
 *   }
 * }
 * ```
 */
export interface PluginManifest {
  /**
   * Unique plugin identifier using reverse domain notation.
   *
   * @example "com.example.myplugin", "io.github.username.plugin-name"
   */
  id: string;

  /**
   * Human-readable plugin name displayed in the UI.
   *
   * @example "Query Logger", "Dark Theme"
   */
  name: string;

  /**
   * Semantic version string following semver conventions.
   *
   * @example "1.0.0", "2.3.1-beta"
   */
  version: string;

  /**
   * Brief description of what the plugin does.
   * Displayed in the marketplace and plugin manager.
   */
  description: string;

  /**
   * Author name or organization.
   */
  author: string;

  /**
   * Relative path to plugin entry point from plugin directory.
   * Must export an `activate` function.
   *
   * @example "index.js", "dist/main.js"
   */
  main: string;

  /**
   * Required permissions for the plugin.
   * Displayed to users during installation.
   */
  permissions?: PluginPermission[];

  /**
   * Compatibility requirements for the plugin.
   */
  engines?: {
    /**
     * Required SQL Pro version range using semver syntax.
     *
     * @example "^1.6.0", ">=2.0.0", "~1.5.0"
     */
    sqlpro?: string;
  };

  /**
   * Plugin homepage URL for more information.
   */
  homepage?: string;

  /**
   * Repository URL where the plugin source code is hosted.
   */
  repository?: string;

  /**
   * SPDX license identifier.
   *
   * @example "MIT", "Apache-2.0", "GPL-3.0"
   */
  license?: string;

  /**
   * Keywords for marketplace search and categorization.
   */
  keywords?: string[];

  /**
   * Path to plugin icon relative to plugin directory.
   * Recommended size: 128x128 pixels.
   *
   * @example "icon.png", "assets/icon.svg"
   */
  icon?: string;

  /**
   * Paths to screenshot images for marketplace display.
   */
  screenshots?: string[];

  /**
   * Minimum required Plugin API version.
   * Used for compatibility checking with future API versions.
   */
  apiVersion?: string;
}

// ============================================================================
// UI Extension API Types
// ============================================================================

/**
 * Options for registering a command in the command palette.
 *
 * Commands are actions that can be triggered via the command palette (Cmd/Ctrl+Shift+P)
 * or via keyboard shortcuts.
 *
 * @example
 * ```typescript
 * api.ui.registerCommand({
 *   id: 'myPlugin.formatQuery',
 *   title: 'Format SQL Query',
 *   shortcut: 'Ctrl+Shift+F',
 *   category: 'Formatting',
 *   handler: async () => {
 *     // Format the current query
 *   }
 * });
 * ```
 */
export interface CommandOptions {
  /**
   * Unique command identifier. Should be prefixed with your plugin ID.
   *
   * @example "myPlugin.formatQuery", "com.example.plugin.doSomething"
   */
  id: string;

  /**
   * Human-readable command title shown in the command palette.
   */
  title: string;

  /**
   * Optional keyboard shortcut in Electron accelerator format.
   *
   * @example "Ctrl+Shift+F", "CmdOrCtrl+K", "Alt+Enter"
   * @see https://www.electronjs.org/docs/latest/api/accelerator
   */
  shortcut?: string;

  /**
   * Optional category for grouping commands in the palette.
   *
   * @example "Formatting", "Navigation", "Query"
   */
  category?: string;

  /**
   * Handler function called when the command is executed.
   * Can be synchronous or asynchronous.
   */
  handler: () => void | Promise<void>;
}

/**
 * Options for registering a menu item in the application menu.
 *
 * Menu items appear in the application's menu bar under the Plugins menu
 * or a custom menu path.
 *
 * @example
 * ```typescript
 * api.ui.registerMenuItem({
 *   id: 'myPlugin.export',
 *   label: 'Export Results',
 *   menuPath: 'Plugins/My Plugin',
 *   shortcut: 'CmdOrCtrl+E',
 *   icon: 'export',
 *   handler: async () => {
 *     // Export current query results
 *   }
 * });
 * ```
 */
export interface MenuItemOptions {
  /**
   * Unique menu item identifier.
   */
  id: string;

  /**
   * Menu item label shown in the menu.
   * Use `&` before a letter for keyboard accelerator (e.g., "&Export").
   */
  label: string;

  /**
   * Menu path where the item should appear.
   * Use `/` to create submenus.
   *
   * @example "Plugins/My Plugin", "Plugins/My Plugin/Advanced"
   */
  menuPath: string;

  /**
   * Optional keyboard shortcut for the menu item.
   */
  shortcut?: string;

  /**
   * Optional icon identifier for the menu item.
   */
  icon?: string;

  /**
   * Handler function called when the menu item is clicked.
   */
  handler: () => void | Promise<void>;

  /**
   * Optional function that returns whether the menu item is enabled.
   * Called before showing the menu.
   */
  isEnabled?: () => boolean;

  /**
   * Optional function that returns whether the menu item is visible.
   * Called before showing the menu.
   */
  isVisible?: () => boolean;
}

/**
 * Options for registering a panel in the UI.
 *
 * Panels are custom UI containers that can be placed in different
 * locations within the application.
 *
 * @example
 * ```typescript
 * api.ui.registerPanel({
 *   id: 'myPlugin.queryLog',
 *   title: 'Query Log',
 *   location: 'bottom',
 *   icon: 'log',
 *   render: () => {
 *     return '<div class="query-log">Log entries will appear here</div>';
 *   },
 *   dispose: () => {
 *     // Cleanup when panel is closed
 *   }
 * });
 * ```
 */
export interface PanelOptions {
  /**
   * Unique panel identifier.
   */
  id: string;

  /**
   * Panel title shown in the tab or header.
   */
  title: string;

  /**
   * Location where the panel should appear.
   *
   * - `sidebar` - Left sidebar area
   * - `bottom` - Bottom panel area
   * - `right` - Right sidebar area
   */
  location: 'sidebar' | 'bottom' | 'right';

  /**
   * Optional icon identifier for the panel tab.
   */
  icon?: string;

  /**
   * Render function that returns HTML content for the panel.
   * Called when the panel needs to update its content.
   */
  render: () => string | Promise<string>;

  /**
   * Optional cleanup function called when the panel is closed or removed.
   * Use this to remove event listeners, cancel timers, etc.
   */
  dispose?: () => void;
}

/**
 * Options for showing a notification to the user.
 *
 * @example
 * ```typescript
 * api.ui.showNotification({
 *   message: 'Query executed successfully!',
 *   type: 'success',
 *   duration: 3000,
 *   actions: [
 *     { label: 'Copy Results', handler: () => copyToClipboard() }
 *   ]
 * });
 * ```
 */
export interface NotificationOptions {
  /**
   * Notification message to display.
   */
  message: string;

  /**
   * Notification type affecting styling and icon.
   */
  type: 'info' | 'success' | 'warning' | 'error';

  /**
   * Duration in milliseconds before auto-dismiss.
   * Set to 0 for persistent notifications that require manual dismissal.
   *
   * @default 5000
   */
  duration?: number;

  /**
   * Optional action buttons to display in the notification.
   */
  actions?: Array<{
    /** Button label */
    label: string;
    /** Handler called when button is clicked */
    handler: () => void;
  }>;
}

/**
 * UI Extension API for adding commands, menus, panels, and notifications.
 *
 * Accessible via `context.api.ui` in your plugin's activate function.
 *
 * @example
 * ```typescript
 * export function activate(context: PluginContext) {
 *   const { ui } = context.api;
 *
 *   // Register a command
 *   const unregisterCommand = ui.registerCommand({
 *     id: 'myPlugin.hello',
 *     title: 'Say Hello',
 *     handler: () => {
 *       ui.showNotification({ message: 'Hello!', type: 'info' });
 *     }
 *   });
 *
 *   // Store unregister function for cleanup in deactivate
 * }
 * ```
 */
export interface UIExtensionAPI {
  /**
   * Register a command in the command palette.
   *
   * @param options - Command configuration options
   * @returns Unregister function to remove the command
   */
  registerCommand: (options: CommandOptions) => () => void;

  /**
   * Register a menu item in the application menu.
   *
   * @param options - Menu item configuration options
   * @returns Unregister function to remove the menu item
   */
  registerMenuItem: (options: MenuItemOptions) => () => void;

  /**
   * Register a custom panel in the UI.
   *
   * @param options - Panel configuration options
   * @returns Unregister function to remove the panel
   */
  registerPanel: (options: PanelOptions) => () => void;

  /**
   * Show a notification to the user.
   *
   * @param options - Notification configuration options
   */
  showNotification: (options: NotificationOptions) => void;
}

// ============================================================================
// Query Lifecycle API Types
// ============================================================================

/**
 * Context information passed to query lifecycle hooks.
 *
 * Contains details about the query being executed and its database connection.
 */
export interface QueryContext {
  /**
   * The SQL query string being executed.
   */
  query: string;

  /**
   * Unique identifier for the database connection.
   */
  connectionId: string;

  /**
   * File path to the SQLite database.
   */
  dbPath: string;

  /**
   * Unix timestamp (milliseconds) when the query was initiated.
   */
  timestamp: number;
}

/**
 * Result returned from a before-query hook.
 *
 * Hooks can modify the query, cancel execution, or attach metadata.
 *
 * @example
 * ```typescript
 * api.query.onBeforeQuery((context) => {
 *   // Add a comment to all queries
 *   return {
 *     query: `-- Logged by plugin\n${context.query}`,
 *     metadata: { loggedAt: Date.now() }
 *   };
 * });
 * ```
 */
export interface QueryHookResult {
  /**
   * Modified query string to execute instead of the original.
   * If not provided, the original query is used.
   */
  query?: string;

  /**
   * If true, cancels the query execution entirely.
   * The query will not be executed and an error will be shown.
   */
  cancel?: boolean;

  /**
   * Reason for cancellation, shown to the user.
   * Only used when `cancel` is true.
   */
  cancelReason?: string;

  /**
   * Additional metadata to attach to the query.
   * Passed to after-query hooks for context.
   */
  metadata?: Record<string, unknown>;
}

/**
 * Query results passed to after-query hooks.
 *
 * Contains the results of a successful query execution.
 */
export interface QueryResults {
  /**
   * Column names from the result set.
   */
  columns: string[];

  /**
   * Array of result rows as key-value objects.
   */
  rows: Record<string, unknown>[];

  /**
   * Number of rows affected (for INSERT, UPDATE, DELETE operations).
   */
  rowsAffected?: number;

  /**
   * Last inserted row ID (for INSERT operations).
   */
  lastInsertRowId?: number;

  /**
   * Query execution time in milliseconds.
   */
  executionTime: number;

  /**
   * Metadata passed from before-query hooks.
   */
  metadata?: Record<string, unknown>;
}

/**
 * Error information passed to query error hooks.
 */
export interface QueryError {
  /**
   * Error message describing what went wrong.
   */
  message: string;

  /**
   * SQLite error code (if available).
   *
   * @example "SQLITE_CONSTRAINT", "SQLITE_BUSY"
   */
  code?: string;

  /**
   * The query that caused the error.
   */
  query: string;

  /**
   * Connection ID where the error occurred.
   */
  connectionId: string;
}

/**
 * Before-query hook function signature.
 *
 * Called before a query is executed. Can modify the query, cancel it,
 * or attach metadata for after-query hooks.
 *
 * @param context - Query context with query string and connection info
 * @returns Hook result with modifications, or void to allow query as-is
 */
export type BeforeQueryHook = (
  context: QueryContext
) => QueryHookResult | Promise<QueryHookResult> | void | Promise<void>;

/**
 * After-query hook function signature.
 *
 * Called after a query executes successfully. Can transform results
 * or perform logging/analytics.
 *
 * @param results - Query results including rows and metadata
 * @param context - Original query context
 * @returns Modified results, or void to use original results
 */
export type AfterQueryHook = (
  results: QueryResults,
  context: QueryContext
) => QueryResults | Promise<QueryResults> | void | Promise<void>;

/**
 * Query error hook function signature.
 *
 * Called when a query encounters an error. Can log errors,
 * show custom notifications, or attempt recovery.
 *
 * @param error - Error information including message and query
 */
export type QueryErrorHook = (error: QueryError) => void | Promise<void>;

/**
 * Query Lifecycle API for intercepting query execution.
 *
 * Accessible via `context.api.query` in your plugin's activate function.
 *
 * @example
 * ```typescript
 * export function activate(context: PluginContext) {
 *   const { query } = context.api;
 *
 *   // Log all queries
 *   const unregister = query.onBeforeQuery((ctx) => {
 *     console.log(`Executing: ${ctx.query}`);
 *   });
 *
 *   // Track execution times
 *   query.onAfterQuery((results) => {
 *     console.log(`Completed in ${results.executionTime}ms`);
 *   });
 * }
 * ```
 */
export interface QueryLifecycleAPI {
  /**
   * Register a hook that runs before query execution.
   *
   * Hooks can modify queries, cancel execution, or attach metadata.
   * Multiple hooks are called in registration order.
   *
   * @param hook - Hook function to call before queries
   * @returns Unregister function to remove the hook
   */
  onBeforeQuery: (hook: BeforeQueryHook) => () => void;

  /**
   * Register a hook that runs after successful query execution.
   *
   * Hooks can transform results or perform post-query actions.
   * Multiple hooks are called in registration order.
   *
   * @param hook - Hook function to call after queries
   * @returns Unregister function to remove the hook
   */
  onAfterQuery: (hook: AfterQueryHook) => () => void;

  /**
   * Register a hook that runs when a query encounters an error.
   *
   * Error hooks cannot prevent the error but can log, notify,
   * or attempt recovery actions.
   *
   * @param hook - Hook function to call on query errors
   * @returns Unregister function to remove the hook
   */
  onQueryError: (hook: QueryErrorHook) => () => void;
}

// ============================================================================
// Storage API Types
// ============================================================================

/**
 * Storage API for persistent plugin data.
 *
 * Each plugin has isolated storage that persists across application restarts.
 * Data is stored locally on the user's machine.
 *
 * Accessible via `context.api.storage` in your plugin's activate function.
 *
 * @example
 * ```typescript
 * export async function activate(context: PluginContext) {
 *   const { storage } = context.api;
 *
 *   // Get saved preferences
 *   const prefs = await storage.get<Preferences>('preferences');
 *
 *   // Save data
 *   await storage.set('lastRunTime', Date.now());
 *
 *   // List all keys
 *   const keys = await storage.keys();
 * }
 * ```
 */
export interface StorageAPI {
  /**
   * Get a value from plugin storage.
   *
   * @typeParam T - Expected type of the stored value
   * @param key - Storage key to retrieve
   * @returns The stored value, or undefined if not found
   */
  get: <T = unknown>(key: string) => Promise<T | undefined>;

  /**
   * Set a value in plugin storage.
   *
   * Values must be JSON-serializable.
   *
   * @typeParam T - Type of the value being stored
   * @param key - Storage key
   * @param value - Value to store (must be JSON-serializable)
   */
  set: <T = unknown>(key: string, value: T) => Promise<void>;

  /**
   * Remove a value from plugin storage.
   *
   * @param key - Storage key to remove
   */
  remove: (key: string) => Promise<void>;

  /**
   * Get all keys in plugin storage.
   *
   * @returns Array of all storage keys for this plugin
   */
  keys: () => Promise<string[]>;

  /**
   * Clear all data in plugin storage.
   *
   * Warning: This permanently deletes all stored data for this plugin.
   */
  clear: () => Promise<void>;
}

// ============================================================================
// Metadata API Types
// ============================================================================

/**
 * Information about the current database connection.
 */
export interface ConnectionInfo {
  /**
   * Unique connection identifier.
   */
  id: string;

  /**
   * Full path to the database file.
   */
  path: string;

  /**
   * Database filename without path.
   */
  filename: string;

  /**
   * Whether the database is encrypted (SQLCipher).
   */
  isEncrypted: boolean;

  /**
   * Whether the connection is read-only.
   */
  isReadOnly: boolean;
}

/**
 * Information about the SQL Pro application.
 */
export interface AppInfo {
  /**
   * Application version string.
   *
   * @example "1.6.0", "2.0.0-beta.1"
   */
  version: string;

  /**
   * Operating system platform.
   *
   * @example "darwin", "win32", "linux"
   */
  platform: string;

  /**
   * CPU architecture.
   *
   * @example "x64", "arm64"
   */
  arch: string;

  /**
   * Whether the app is running in development mode.
   */
  isDev: boolean;
}

/**
 * Metadata API for accessing plugin, connection, and app information.
 *
 * Accessible via `context.api.metadata` in your plugin's activate function.
 *
 * @example
 * ```typescript
 * export function activate(context: PluginContext) {
 *   const { metadata } = context.api;
 *
 *   // Get plugin info
 *   const manifest = metadata.getPluginInfo();
 *   console.log(`${manifest.name} v${manifest.version}`);
 *
 *   // Get current connection
 *   const conn = metadata.getCurrentConnection();
 *   if (conn) {
 *     console.log(`Connected to: ${conn.filename}`);
 *   }
 *
 *   // Get app info
 *   const app = metadata.getAppInfo();
 *   console.log(`Running on SQL Pro ${app.version}`);
 * }
 * ```
 */
export interface MetadataAPI {
  /**
   * Get this plugin's manifest information.
   *
   * @returns Copy of the plugin's manifest data
   */
  getPluginInfo: () => PluginManifest;

  /**
   * Get the current database connection.
   *
   * @returns Connection info, or null if no database is open
   */
  getCurrentConnection: () => ConnectionInfo | null;

  /**
   * Get SQL Pro application information.
   *
   * @returns Application info including version, platform, and architecture
   */
  getAppInfo: () => AppInfo;
}

// ============================================================================
// Plugin Context Types
// ============================================================================

/**
 * Complete Plugin API surface available to plugins.
 *
 * Contains all API modules for extending SQL Pro functionality.
 */
export interface PluginAPI {
  /**
   * UI Extension API for adding commands, menus, panels, and notifications.
   */
  ui: UIExtensionAPI;

  /**
   * Query Lifecycle API for intercepting query execution.
   */
  query: QueryLifecycleAPI;

  /**
   * Storage API for persistent plugin data.
   */
  storage: StorageAPI;

  /**
   * Metadata API for accessing plugin, connection, and app info.
   */
  metadata: MetadataAPI;
}

/**
 * Context passed to a plugin's activate function.
 *
 * Contains the Plugin API and metadata about the plugin.
 *
 * @example
 * ```typescript
 * import type { PluginContext } from '@sqlpro/plugin-sdk';
 *
 * export function activate(context: PluginContext) {
 *   const { api, manifest, pluginPath } = context;
 *
 *   console.log(`Activating ${manifest.name} from ${pluginPath}`);
 *
 *   // Use the API
 *   api.ui.showNotification({
 *     message: `${manifest.name} is ready!`,
 *     type: 'success'
 *   });
 * }
 * ```
 */
export interface PluginContext {
  /**
   * The complete Plugin API for extending SQL Pro.
   */
  api: PluginAPI;

  /**
   * This plugin's manifest data from plugin.json.
   */
  manifest: PluginManifest;

  /**
   * Absolute path to the plugin's installation directory.
   * Use this to load plugin resources like images or data files.
   */
  pluginPath: string;
}

// ============================================================================
// Plugin Module Types
// ============================================================================

/**
 * Plugin activate function signature.
 *
 * The activate function is the entry point for your plugin.
 * It's called when the plugin is enabled or when the app starts
 * with the plugin already enabled.
 *
 * @param context - Plugin context with API and metadata
 */
export type PluginActivate = (context: PluginContext) => void | Promise<void>;

/**
 * Plugin deactivate function signature (optional).
 *
 * The deactivate function is called when the plugin is disabled
 * or when the application is shutting down. Use this to clean up
 * any resources, remove event listeners, or save state.
 */
export type PluginDeactivate = () => void | Promise<void>;

/**
 * Plugin module exports interface.
 *
 * Your plugin's main entry file must export an `activate` function.
 * The `deactivate` function is optional but recommended for cleanup.
 *
 * @example
 * ```typescript
 * import type { PluginModule, PluginContext } from '@sqlpro/plugin-sdk';
 *
 * // Store cleanup functions
 * const disposables: Array<() => void> = [];
 *
 * export const activate: PluginModule['activate'] = (context) => {
 *   // Register a command and save the unregister function
 *   const unregister = context.api.ui.registerCommand({
 *     id: 'myPlugin.hello',
 *     title: 'Say Hello',
 *     handler: () => {
 *       context.api.ui.showNotification({
 *         message: 'Hello, World!',
 *         type: 'info'
 *       });
 *     }
 *   });
 *
 *   disposables.push(unregister);
 * };
 *
 * export const deactivate: PluginModule['deactivate'] = () => {
 *   // Clean up all registered items
 *   disposables.forEach(dispose => dispose());
 *   disposables.length = 0;
 * };
 * ```
 */
export interface PluginModule {
  /**
   * Called when the plugin is activated.
   *
   * This is the main entry point for your plugin. Use this to:
   * - Register commands, menu items, and panels
   * - Set up query lifecycle hooks
   * - Load saved settings from storage
   * - Initialize any plugin state
   */
  activate: PluginActivate;

  /**
   * Called when the plugin is deactivated (optional).
   *
   * Use this to clean up resources. Note that registered commands,
   * menu items, and hooks are automatically cleaned up, so you only
   * need to handle custom cleanup tasks like:
   * - Canceling timers or intervals
   * - Closing file handles
   * - Saving unsaved state
   */
  deactivate?: PluginDeactivate;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Helper type to make certain properties required.
 *
 * @typeParam T - Base type
 * @typeParam K - Keys to make required
 */
export type RequiredKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Helper type to make all properties optional except specified keys.
 *
 * @typeParam T - Base type
 * @typeParam K - Keys to keep required
 */
export type OnlyRequired<T, K extends keyof T> = Partial<T> & Pick<T, K>;

/**
 * Deep partial type that makes all nested properties optional.
 *
 * @typeParam T - Base type to make deeply partial
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

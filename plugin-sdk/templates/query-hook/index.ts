/**
 * Query Hook Logger Plugin for SQL Pro
 *
 * This example plugin demonstrates the Query Lifecycle API:
 *
 * 1. **Before-Query Hooks** - Intercept queries before execution
 *    - Log query text and timestamp
 *    - Modify queries (add comments, rewrite)
 *    - Cancel queries with reason
 *
 * 2. **After-Query Hooks** - Process successful query results
 *    - Log execution time and row counts
 *    - Transform results
 *    - Collect statistics
 *
 * 3. **Error Hooks** - Handle query failures
 *    - Log error messages and codes
 *    - Custom error notifications
 *    - Error analytics
 *
 * Use this template when you need to:
 * - Build query auditing/logging tools
 * - Create query optimization analyzers
 * - Implement custom error handling
 * - Track query performance metrics
 *
 * @packageDocumentation
 */

import type {
  PluginContext,
  PluginModule,
  QueryContext,
  QueryError,
  QueryHookResult,
  QueryResults,
} from '@sqlpro/plugin-sdk';

// ============================================================================
// Types
// ============================================================================

/**
 * Represents a logged query entry with all relevant information.
 */
interface QueryLogEntry {
  /** Unique log entry identifier */
  id: string;
  /** Timestamp when the query was executed */
  timestamp: number;
  /** The SQL query string */
  query: string;
  /** Database connection ID */
  connectionId: string;
  /** Database file path */
  dbPath: string;
  /** Query status: 'success', 'error', or 'cancelled' */
  status: 'success' | 'error' | 'cancelled';
  /** Execution time in milliseconds (for successful queries) */
  executionTime?: number;
  /** Number of rows returned (for SELECT queries) */
  rowCount?: number;
  /** Number of rows affected (for INSERT/UPDATE/DELETE) */
  rowsAffected?: number;
  /** Error message (for failed queries) */
  errorMessage?: string;
  /** SQLite error code (for failed queries) */
  errorCode?: string;
}

/**
 * Plugin settings that persist across sessions.
 */
interface PluginSettings {
  /** Whether query logging is enabled */
  isLoggingEnabled: boolean;
  /** Whether to add comments to queries with metadata */
  addQueryComments: boolean;
  /** Maximum number of log entries to keep */
  maxLogEntries: number;
  /** Whether to log SELECT queries */
  logSelectQueries: boolean;
  /** Whether to log write queries (INSERT, UPDATE, DELETE) */
  logWriteQueries: boolean;
  /** Whether to show notifications on errors */
  showErrorNotifications: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default plugin settings.
 */
const DEFAULT_SETTINGS: PluginSettings = {
  isLoggingEnabled: true,
  addQueryComments: false,
  maxLogEntries: 1000,
  logSelectQueries: true,
  logWriteQueries: true,
  showErrorNotifications: true,
};

// ============================================================================
// Plugin State
// ============================================================================

/**
 * Store cleanup functions returned by API registration methods.
 */
const disposables: Array<() => void> = [];

/**
 * Current plugin settings.
 */
let settings: PluginSettings = { ...DEFAULT_SETTINGS };

/**
 * In-memory query log (also persisted to storage).
 */
let queryLog: QueryLogEntry[] = [];

/**
 * Counter for generating unique log entry IDs.
 */
let logIdCounter = 0;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique log entry ID.
 */
function generateLogId(): string {
  logIdCounter += 1;
  return `log-${Date.now()}-${logIdCounter}`;
}

/**
 * Format a timestamp for display.
 */
function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Truncate a string to a maximum length.
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength - 3)}...`;
}

/**
 * Check if a query is a SELECT query.
 */
function isSelectQuery(query: string): boolean {
  const trimmed = query.trim().toUpperCase();
  return trimmed.startsWith('SELECT') || trimmed.startsWith('WITH');
}

/**
 * Check if a query is a write query (INSERT, UPDATE, DELETE).
 */
function isWriteQuery(query: string): boolean {
  const trimmed = query.trim().toUpperCase();
  return (
    trimmed.startsWith('INSERT') ||
    trimmed.startsWith('UPDATE') ||
    trimmed.startsWith('DELETE') ||
    trimmed.startsWith('CREATE') ||
    trimmed.startsWith('DROP') ||
    trimmed.startsWith('ALTER')
  );
}

/**
 * Check if a query should be logged based on settings.
 */
function shouldLogQuery(query: string): boolean {
  if (!settings.isLoggingEnabled) return false;
  if (isSelectQuery(query) && !settings.logSelectQueries) return false;
  if (isWriteQuery(query) && !settings.logWriteQueries) return false;
  return true;
}

/**
 * Add a log entry and enforce max entries limit.
 */
async function addLogEntry(
  entry: QueryLogEntry,
  storage: PluginContext['api']['storage']
): Promise<void> {
  queryLog.push(entry);

  // Trim to max entries
  if (queryLog.length > settings.maxLogEntries) {
    queryLog = queryLog.slice(-settings.maxLogEntries);
  }

  // Persist to storage
  await storage.set('queryLog', queryLog);
}

/**
 * Calculate query statistics from the log.
 */
function getQueryStats(): {
  total: number;
  success: number;
  errors: number;
  cancelled: number;
  avgExecutionTime: number;
} {
  const stats = {
    total: queryLog.length,
    success: 0,
    errors: 0,
    cancelled: 0,
    avgExecutionTime: 0,
  };

  let totalTime = 0;
  let timeCount = 0;

  for (const entry of queryLog) {
    if (entry.status === 'success') {
      stats.success++;
      if (entry.executionTime !== undefined) {
        totalTime += entry.executionTime;
        timeCount++;
      }
    } else if (entry.status === 'error') {
      stats.errors++;
    } else if (entry.status === 'cancelled') {
      stats.cancelled++;
    }
  }

  if (timeCount > 0) {
    stats.avgExecutionTime = Math.round(totalTime / timeCount);
  }

  return stats;
}

// ============================================================================
// Plugin Lifecycle
// ============================================================================

/**
 * Plugin activation function.
 *
 * Sets up query lifecycle hooks and menu items for controlling the logger.
 *
 * @param context - The plugin context containing the API and metadata
 */
export const activate: PluginModule['activate'] = async (
  context: PluginContext
) => {
  const { api, manifest } = context;

  // -------------------------------------------------------------------------
  // Load saved settings and log from storage
  // -------------------------------------------------------------------------

  const savedSettings = await api.storage.get<PluginSettings>('settings');
  if (savedSettings) {
    settings = { ...DEFAULT_SETTINGS, ...savedSettings };
  }

  const savedLog = await api.storage.get<QueryLogEntry[]>('queryLog');
  if (savedLog) {
    queryLog = savedLog;
    logIdCounter = queryLog.length;
  }

  // -------------------------------------------------------------------------
  // Register Before-Query Hook
  // -------------------------------------------------------------------------

  /**
   * Before-query hook that logs incoming queries and optionally adds comments.
   *
   * This demonstrates:
   * - Logging query information before execution
   * - Modifying queries by adding metadata comments
   * - Returning hook results with modified query
   */
  const unregisterBeforeQuery = api.query.onBeforeQuery(
    (queryContext: QueryContext): QueryHookResult | void => {
      // Skip logging if disabled for this query type
      if (!shouldLogQuery(queryContext.query)) {
        return;
      }

      // If comment mode is enabled, add a metadata comment to the query
      if (settings.addQueryComments) {
        const timestamp = formatTimestamp(queryContext.timestamp);
        const comment = `-- [Query Hook Logger] Executed at ${timestamp}`;

        return {
          // Return modified query with comment prepended
          query: `${comment}\n${queryContext.query}`,
          // Attach metadata that will be passed to after-query hook
          metadata: {
            loggedAt: queryContext.timestamp,
            originalQuery: queryContext.query,
          },
        };
      }

      // No modification, just let the query proceed
    }
  );

  disposables.push(unregisterBeforeQuery);

  // -------------------------------------------------------------------------
  // Register After-Query Hook
  // -------------------------------------------------------------------------

  /**
   * After-query hook that logs successful query results.
   *
   * This demonstrates:
   * - Logging execution time and result counts
   * - Accessing metadata from before-query hooks
   * - Storing log entries persistently
   */
  const unregisterAfterQuery = api.query.onAfterQuery(
    async (
      results: QueryResults,
      queryContext: QueryContext
    ): Promise<void> => {
      // Skip logging if disabled for this query type
      if (!shouldLogQuery(queryContext.query)) {
        return;
      }

      // Create log entry
      const entry: QueryLogEntry = {
        id: generateLogId(),
        timestamp: queryContext.timestamp,
        query: queryContext.query,
        connectionId: queryContext.connectionId,
        dbPath: queryContext.dbPath,
        status: 'success',
        executionTime: results.executionTime,
        rowCount: results.rows.length,
        rowsAffected: results.rowsAffected,
      };

      // Add to log
      await addLogEntry(entry, api.storage);
    }
  );

  disposables.push(unregisterAfterQuery);

  // -------------------------------------------------------------------------
  // Register Query Error Hook
  // -------------------------------------------------------------------------

  /**
   * Query error hook that logs failed queries.
   *
   * This demonstrates:
   * - Capturing error information (message, code)
   * - Showing user notifications for errors
   * - Error analytics and tracking
   */
  const unregisterQueryError = api.query.onQueryError(
    async (error: QueryError): Promise<void> => {
      // Skip logging if disabled for this query type
      if (!shouldLogQuery(error.query)) {
        return;
      }

      // Create error log entry
      const entry: QueryLogEntry = {
        id: generateLogId(),
        timestamp: Date.now(),
        query: error.query,
        connectionId: error.connectionId,
        dbPath: '', // Not available in error context
        status: 'error',
        errorMessage: error.message,
        errorCode: error.code,
      };

      // Add to log
      await addLogEntry(entry, api.storage);

      // Show notification if enabled
      if (settings.showErrorNotifications) {
        api.ui.showNotification({
          message: `Query Error: ${truncate(error.message, 100)}`,
          type: 'error',
          duration: 5000,
        });
      }
    }
  );

  disposables.push(unregisterQueryError);

  // -------------------------------------------------------------------------
  // Register Commands
  // -------------------------------------------------------------------------

  // Command: Toggle logging
  const unregisterToggleCommand = api.ui.registerCommand({
    id: `${manifest.id}.toggleLogging`,
    title: `Query Hook: Toggle Logging (${settings.isLoggingEnabled ? 'On' : 'Off'})`,
    shortcut: 'CmdOrCtrl+Alt+L',
    category: 'Query Logging',
    handler: async () => {
      settings.isLoggingEnabled = !settings.isLoggingEnabled;
      await api.storage.set('settings', settings);

      api.ui.showNotification({
        message: `Query logging ${settings.isLoggingEnabled ? 'enabled' : 'disabled'}`,
        type: settings.isLoggingEnabled ? 'success' : 'info',
        duration: 2000,
      });
    },
  });
  disposables.push(unregisterToggleCommand);

  // Command: View statistics
  const unregisterStatsCommand = api.ui.registerCommand({
    id: `${manifest.id}.viewStats`,
    title: 'Query Hook: View Statistics',
    shortcut: 'CmdOrCtrl+Alt+S',
    category: 'Query Logging',
    handler: () => {
      const stats = getQueryStats();

      api.ui.showNotification({
        message:
          `Query Statistics:\n` +
          `Total Queries: ${stats.total}\n` +
          `Successful: ${stats.success}\n` +
          `Errors: ${stats.errors}\n` +
          `Cancelled: ${stats.cancelled}\n` +
          `Avg Execution Time: ${stats.avgExecutionTime}ms`,
        type: 'info',
        duration: 8000,
      });
    },
  });
  disposables.push(unregisterStatsCommand);

  // Command: Clear log
  const unregisterClearCommand = api.ui.registerCommand({
    id: `${manifest.id}.clearLog`,
    title: 'Query Hook: Clear Log',
    category: 'Query Logging',
    handler: async () => {
      queryLog = [];
      logIdCounter = 0;
      await api.storage.set('queryLog', queryLog);

      api.ui.showNotification({
        message: 'Query log cleared',
        type: 'success',
        duration: 2000,
      });
    },
  });
  disposables.push(unregisterClearCommand);

  // Command: View recent queries
  const unregisterViewRecentCommand = api.ui.registerCommand({
    id: `${manifest.id}.viewRecent`,
    title: 'Query Hook: View Recent Queries',
    shortcut: 'CmdOrCtrl+Alt+R',
    category: 'Query Logging',
    handler: () => {
      const recentQueries = queryLog.slice(-5).reverse();

      if (recentQueries.length === 0) {
        api.ui.showNotification({
          message:
            'No queries logged yet.\nEnable logging and execute some queries.',
          type: 'info',
          duration: 4000,
        });
        return;
      }

      const summary = recentQueries
        .map((entry) => {
          const status = entry.status === 'success' ? 'OK' : 'ERR';
          const time = entry.executionTime ? `${entry.executionTime}ms` : 'N/A';
          const query = truncate(entry.query.replace(/\s+/g, ' '), 40);
          return `[${status}] ${time} - ${query}`;
        })
        .join('\n');

      api.ui.showNotification({
        message: `Recent Queries (last 5):\n${summary}`,
        type: 'info',
        duration: 10000,
      });
    },
  });
  disposables.push(unregisterViewRecentCommand);

  // -------------------------------------------------------------------------
  // Register Menu Items
  // -------------------------------------------------------------------------

  // Menu: Toggle logging
  const unregisterToggleMenu = api.ui.registerMenuItem({
    id: `${manifest.id}.menu.toggleLogging`,
    label: `&Logging (${settings.isLoggingEnabled ? 'On' : 'Off'})`,
    menuPath: 'Plugins/Query Hook Logger',
    shortcut: 'CmdOrCtrl+Alt+L',
    handler: async () => {
      settings.isLoggingEnabled = !settings.isLoggingEnabled;
      await api.storage.set('settings', settings);

      api.ui.showNotification({
        message: `Query logging ${settings.isLoggingEnabled ? 'enabled' : 'disabled'}`,
        type: settings.isLoggingEnabled ? 'success' : 'info',
        duration: 2000,
      });
    },
  });
  disposables.push(unregisterToggleMenu);

  // Menu: Toggle query comments
  const unregisterCommentsMenu = api.ui.registerMenuItem({
    id: `${manifest.id}.menu.toggleComments`,
    label: `&Add Query Comments (${settings.addQueryComments ? 'On' : 'Off'})`,
    menuPath: 'Plugins/Query Hook Logger/Settings',
    handler: async () => {
      settings.addQueryComments = !settings.addQueryComments;
      await api.storage.set('settings', settings);

      api.ui.showNotification({
        message: `Query comments ${settings.addQueryComments ? 'enabled' : 'disabled'}.\n${
          settings.addQueryComments
            ? 'A timestamp comment will be added to each query.'
            : 'Queries will be executed without modification.'
        }`,
        type: 'info',
        duration: 4000,
      });
    },
  });
  disposables.push(unregisterCommentsMenu);

  // Menu: Toggle SELECT logging
  const unregisterSelectMenu = api.ui.registerMenuItem({
    id: `${manifest.id}.menu.toggleSelectLogging`,
    label: `Log &SELECT Queries (${settings.logSelectQueries ? 'On' : 'Off'})`,
    menuPath: 'Plugins/Query Hook Logger/Settings',
    handler: async () => {
      settings.logSelectQueries = !settings.logSelectQueries;
      await api.storage.set('settings', settings);

      api.ui.showNotification({
        message: `SELECT query logging ${settings.logSelectQueries ? 'enabled' : 'disabled'}`,
        type: 'info',
        duration: 2000,
      });
    },
  });
  disposables.push(unregisterSelectMenu);

  // Menu: Toggle write query logging
  const unregisterWriteMenu = api.ui.registerMenuItem({
    id: `${manifest.id}.menu.toggleWriteLogging`,
    label: `Log &Write Queries (${settings.logWriteQueries ? 'On' : 'Off'})`,
    menuPath: 'Plugins/Query Hook Logger/Settings',
    handler: async () => {
      settings.logWriteQueries = !settings.logWriteQueries;
      await api.storage.set('settings', settings);

      api.ui.showNotification({
        message: `Write query logging ${settings.logWriteQueries ? 'enabled' : 'disabled'}`,
        type: 'info',
        duration: 2000,
      });
    },
  });
  disposables.push(unregisterWriteMenu);

  // Menu: Toggle error notifications
  const unregisterErrorNotifMenu = api.ui.registerMenuItem({
    id: `${manifest.id}.menu.toggleErrorNotifications`,
    label: `Show &Error Notifications (${settings.showErrorNotifications ? 'On' : 'Off'})`,
    menuPath: 'Plugins/Query Hook Logger/Settings',
    handler: async () => {
      settings.showErrorNotifications = !settings.showErrorNotifications;
      await api.storage.set('settings', settings);

      api.ui.showNotification({
        message: `Error notifications ${settings.showErrorNotifications ? 'enabled' : 'disabled'}`,
        type: 'info',
        duration: 2000,
      });
    },
  });
  disposables.push(unregisterErrorNotifMenu);

  // Menu: View statistics
  const unregisterStatsMenu = api.ui.registerMenuItem({
    id: `${manifest.id}.menu.viewStats`,
    label: 'View &Statistics',
    menuPath: 'Plugins/Query Hook Logger',
    shortcut: 'CmdOrCtrl+Alt+S',
    handler: () => {
      const stats = getQueryStats();

      api.ui.showNotification({
        message:
          `Query Statistics:\n` +
          `Total Queries: ${stats.total}\n` +
          `Successful: ${stats.success}\n` +
          `Errors: ${stats.errors}\n` +
          `Cancelled: ${stats.cancelled}\n` +
          `Avg Execution Time: ${stats.avgExecutionTime}ms`,
        type: 'info',
        duration: 8000,
      });
    },
  });
  disposables.push(unregisterStatsMenu);

  // Menu: View recent queries
  const unregisterRecentMenu = api.ui.registerMenuItem({
    id: `${manifest.id}.menu.viewRecent`,
    label: 'View &Recent Queries',
    menuPath: 'Plugins/Query Hook Logger',
    shortcut: 'CmdOrCtrl+Alt+R',
    handler: () => {
      const recentQueries = queryLog.slice(-5).reverse();

      if (recentQueries.length === 0) {
        api.ui.showNotification({
          message:
            'No queries logged yet.\nEnable logging and execute some queries.',
          type: 'info',
          duration: 4000,
        });
        return;
      }

      const summary = recentQueries
        .map((entry) => {
          const status = entry.status === 'success' ? 'OK' : 'ERR';
          const time = entry.executionTime ? `${entry.executionTime}ms` : 'N/A';
          const query = truncate(entry.query.replace(/\s+/g, ' '), 40);
          return `[${status}] ${time} - ${query}`;
        })
        .join('\n');

      api.ui.showNotification({
        message: `Recent Queries (last 5):\n${summary}`,
        type: 'info',
        duration: 10000,
      });
    },
  });
  disposables.push(unregisterRecentMenu);

  // Menu: Clear log
  const unregisterClearMenu = api.ui.registerMenuItem({
    id: `${manifest.id}.menu.clearLog`,
    label: '&Clear Log',
    menuPath: 'Plugins/Query Hook Logger',
    handler: async () => {
      queryLog = [];
      logIdCounter = 0;
      await api.storage.set('queryLog', queryLog);

      api.ui.showNotification({
        message: 'Query log cleared',
        type: 'success',
        duration: 2000,
      });
    },
  });
  disposables.push(unregisterClearMenu);

  // Menu: About
  const unregisterAboutMenu = api.ui.registerMenuItem({
    id: `${manifest.id}.menu.about`,
    label: '&About',
    menuPath: 'Plugins/Query Hook Logger',
    handler: () => {
      const pluginInfo = api.metadata.getPluginInfo();

      api.ui.showNotification({
        message:
          `${pluginInfo.name} v${pluginInfo.version}\n\n` +
          `${pluginInfo.description}\n\n` +
          `This plugin demonstrates the Query Lifecycle API with:\n` +
          `- Before-query hooks (logging, modification)\n` +
          `- After-query hooks (results, timing)\n` +
          `- Error hooks (error tracking, notifications)`,
        type: 'info',
        duration: 10000,
      });
    },
  });
  disposables.push(unregisterAboutMenu);

  // -------------------------------------------------------------------------
  // Show activation notification
  // -------------------------------------------------------------------------

  const stats = getQueryStats();
  api.ui.showNotification({
    message:
      `${manifest.name} activated!\n` +
      `Logging: ${settings.isLoggingEnabled ? 'On' : 'Off'}\n` +
      `${stats.total} queries in log`,
    type: 'success',
    duration: 3000,
  });
};

/**
 * Plugin deactivation function.
 *
 * Called when the plugin is disabled or the application is shutting down.
 * Cleans up all registered hooks, commands, and menu items.
 */
export const deactivate: PluginModule['deactivate'] = () => {
  // Call all stored cleanup functions
  for (const dispose of disposables) {
    dispose();
  }

  // Clear the disposables array
  disposables.length = 0;

  // Reset state
  settings = { ...DEFAULT_SETTINGS };
  queryLog = [];
  logIdCounter = 0;
};

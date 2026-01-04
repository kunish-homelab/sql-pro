# Plugin API Reference

Complete reference documentation for the SQL Pro Plugin API. This page covers all available methods with TypeScript signatures and examples.

[[toc]]

## Overview

The Plugin API is organized into four modules, accessible via the `context.api` object in your plugin's `activate` function:

| Module                                      | Property               | Purpose                                  |
| ------------------------------------------- | ---------------------- | ---------------------------------------- |
| [UI Extension API](#ui-extension-api)       | `context.api.ui`       | Commands, menus, panels, notifications   |
| [Query Lifecycle API](#query-lifecycle-api) | `context.api.query`    | Before/after query hooks, error handling |
| [Storage API](#storage-api)                 | `context.api.storage`  | Persistent plugin data                   |
| [Metadata API](#metadata-api)               | `context.api.metadata` | Plugin, connection, and app info         |

```typescript
import type { PluginContext, PluginModule } from '@sqlpro/plugin-sdk';

export const activate: PluginModule['activate'] = (context: PluginContext) => {
  const { api } = context;

  // UI Extension API
  api.ui.registerCommand({
    /* ... */
  });
  api.ui.registerMenuItem({
    /* ... */
  });
  api.ui.registerPanel({
    /* ... */
  });
  api.ui.showNotification({
    /* ... */
  });

  // Query Lifecycle API
  api.query.onBeforeQuery((ctx) => {
    /* ... */
  });
  api.query.onAfterQuery((results, ctx) => {
    /* ... */
  });
  api.query.onQueryError((error) => {
    /* ... */
  });

  // Storage API
  await api.storage.set('key', value);
  const data = await api.storage.get('key');

  // Metadata API
  const pluginInfo = api.metadata.getPluginInfo();
  const connection = api.metadata.getCurrentConnection();
  const appInfo = api.metadata.getAppInfo();
};
```

---

## UI Extension API

The UI Extension API (`context.api.ui`) provides methods for extending the SQL Pro user interface with commands, menu items, panels, and notifications.

### Interface Definition

```typescript
interface UIExtensionAPI {
  registerCommand(options: CommandOptions): () => void;
  registerMenuItem(options: MenuItemOptions): () => void;
  registerPanel(options: PanelOptions): () => void;
  showNotification(options: NotificationOptions): void;
}
```

---

### registerCommand()

Register a command in the command palette. Commands can be triggered via the command palette (`Cmd/Ctrl+Shift+P`) or via keyboard shortcuts.

#### Signature

```typescript
registerCommand(options: CommandOptions): () => void
```

#### Parameters

| Parameter | Type                                | Required | Description           |
| --------- | ----------------------------------- | -------- | --------------------- |
| `options` | [`CommandOptions`](#commandoptions) | Yes      | Command configuration |

#### Returns

A cleanup function that unregisters the command when called.

#### CommandOptions

```typescript
interface CommandOptions {
  /** Unique command identifier. Prefix with your plugin ID. */
  id: string;

  /** Human-readable title shown in the command palette. */
  title: string;

  /** Handler function called when the command is executed. */
  handler: () => void | Promise<void>;

  /**
   * Optional keyboard shortcut in Electron accelerator format.
   * @example "Ctrl+Shift+F", "CmdOrCtrl+K", "Alt+Enter"
   * @see https://www.electronjs.org/docs/latest/api/accelerator
   */
  shortcut?: string;

  /**
   * Optional category for grouping commands in the palette.
   * @example "Formatting", "Navigation", "Query"
   */
  category?: string;
}
```

#### Example

```typescript
import type { PluginContext } from '@sqlpro/plugin-sdk';

export function activate(context: PluginContext) {
  const { api, manifest } = context;

  // Register a command with keyboard shortcut
  const unregister = api.ui.registerCommand({
    id: `${manifest.id}.formatQuery`,
    title: 'My Plugin: Format SQL Query',
    category: 'Formatting',
    shortcut: 'CmdOrCtrl+Shift+F',
    handler: async () => {
      // Your command logic here
      api.ui.showNotification({
        message: 'Query formatted!',
        type: 'success',
      });
    },
  });

  // Store for cleanup during deactivation
  return () => unregister();
}
```

#### Keyboard Shortcuts

Use [Electron accelerator format](https://www.electronjs.org/docs/latest/api/accelerator) for cross-platform shortcuts:

| Modifier    | macOS       | Windows/Linux |
| ----------- | ----------- | ------------- |
| `CmdOrCtrl` | Command (⌘) | Ctrl          |
| `Alt`       | Option (⌥)  | Alt           |
| `Shift`     | Shift (⇧)   | Shift         |
| `Super`     | Command (⌘) | Windows key   |

Common patterns:

- `CmdOrCtrl+S` - Save (Cmd+S on macOS, Ctrl+S on Windows)
- `CmdOrCtrl+Shift+P` - Command palette style
- `Alt+Enter` - Execute action
- `CmdOrCtrl+K CmdOrCtrl+C` - Chord (two-key sequence)

---

### registerMenuItem()

Register a menu item in the application menu. Menu items appear under the Plugins menu or a custom menu path.

#### Signature

```typescript
registerMenuItem(options: MenuItemOptions): () => void
```

#### Parameters

| Parameter | Type                                  | Required | Description             |
| --------- | ------------------------------------- | -------- | ----------------------- |
| `options` | [`MenuItemOptions`](#menuitemoptions) | Yes      | Menu item configuration |

#### Returns

A cleanup function that unregisters the menu item when called.

#### MenuItemOptions

```typescript
interface MenuItemOptions {
  /** Unique menu item identifier. */
  id: string;

  /**
   * Menu item label shown in the menu.
   * Use `&` before a letter for keyboard accelerator (e.g., "&Export" for Alt+E).
   */
  label: string;

  /**
   * Menu path where the item should appear.
   * Use `/` to create submenus.
   * @example "Plugins/My Plugin", "Plugins/My Plugin/Advanced"
   */
  menuPath: string;

  /** Handler function called when the menu item is clicked. */
  handler: () => void | Promise<void>;

  /** Optional keyboard shortcut for the menu item. */
  shortcut?: string;

  /** Optional icon identifier for the menu item. */
  icon?: string;

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
```

#### Example

```typescript
import type { PluginContext } from '@sqlpro/plugin-sdk';

export function activate(context: PluginContext) {
  const { api, manifest } = context;
  let isLoggingEnabled = true;

  // Simple menu item
  const unregister1 = api.ui.registerMenuItem({
    id: `${manifest.id}.exportCSV`,
    label: '&Export to CSV',
    menuPath: 'Plugins/Data Export',
    shortcut: 'CmdOrCtrl+E',
    handler: () => {
      exportToCSV();
    },
  });

  // Toggle menu item with dynamic state
  const unregister2 = api.ui.registerMenuItem({
    id: `${manifest.id}.toggleLogging`,
    label: isLoggingEnabled ? '✓ Logging Enabled' : 'Logging Disabled',
    menuPath: 'Plugins/Query Logger',
    handler: () => {
      isLoggingEnabled = !isLoggingEnabled;
      // Menu will update on next render
    },
  });

  // Conditional menu item (only shown when connected)
  const unregister3 = api.ui.registerMenuItem({
    id: `${manifest.id}.analyzeTable`,
    label: 'Analyze Table',
    menuPath: 'Plugins/Database Tools',
    isEnabled: () => api.metadata.getCurrentConnection() !== null,
    isVisible: () => true,
    handler: () => {
      analyzeCurrentTable();
    },
  });
}
```

#### Menu Path Structure

Menu items are organized hierarchically using `/` separators:

```
Plugins/                          # Root plugins menu
├── My Plugin/                    # Submenu for your plugin
│   ├── Action 1                  # menuPath: "Plugins/My Plugin"
│   ├── Action 2
│   └── Advanced/                 # Nested submenu
│       ├── Debug Mode            # menuPath: "Plugins/My Plugin/Advanced"
│       └── Settings
└── Another Plugin/
```

---

### registerPanel()

Register a custom panel in the UI. Panels are containers for custom content that appear in the sidebar, bottom, or right areas.

#### Signature

```typescript
registerPanel(options: PanelOptions): () => void
```

#### Parameters

| Parameter | Type                            | Required | Description         |
| --------- | ------------------------------- | -------- | ------------------- |
| `options` | [`PanelOptions`](#paneloptions) | Yes      | Panel configuration |

#### Returns

A cleanup function that unregisters the panel when called.

#### PanelOptions

```typescript
interface PanelOptions {
  /** Unique panel identifier. */
  id: string;

  /** Panel title shown in the tab or header. */
  title: string;

  /**
   * Location where the panel should appear.
   * - `sidebar` - Left sidebar area
   * - `bottom` - Bottom panel area
   * - `right` - Right sidebar area
   */
  location: 'sidebar' | 'bottom' | 'right';

  /** Optional icon identifier for the panel tab. */
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
```

#### Example

```typescript
import type { PluginContext } from '@sqlpro/plugin-sdk';

export function activate(context: PluginContext) {
  const { api, manifest } = context;
  let queryLog: string[] = [];

  // Register a sidebar panel
  const unregister = api.ui.registerPanel({
    id: `${manifest.id}.queryLog`,
    title: 'Query Log',
    location: 'bottom',
    icon: 'log',
    render: () => {
      if (queryLog.length === 0) {
        return '<div class="empty-state">No queries logged yet.</div>';
      }

      return `
        <div class="query-log">
          <ul>
            ${queryLog.map((q) => `<li><code>${escapeHtml(q)}</code></li>`).join('')}
          </ul>
        </div>
      `;
    },
    dispose: () => {
      // Cleanup when panel is removed
      queryLog = [];
    },
  });

  // Update log and trigger re-render
  function logQuery(query: string) {
    queryLog.push(query);
    // Panel will re-render on next update cycle
  }
}
```

---

### showNotification()

Display a notification to the user. Notifications appear as toast messages with optional action buttons.

#### Signature

```typescript
showNotification(options: NotificationOptions): void
```

#### Parameters

| Parameter | Type                                          | Required | Description                |
| --------- | --------------------------------------------- | -------- | -------------------------- |
| `options` | [`NotificationOptions`](#notificationoptions) | Yes      | Notification configuration |

#### Returns

`void` - This method has no return value.

#### NotificationOptions

```typescript
interface NotificationOptions {
  /** Notification message to display. */
  message: string;

  /**
   * Notification type affecting styling and icon.
   * - `info` - Informational message (blue)
   * - `success` - Success message (green)
   * - `warning` - Warning message (yellow)
   * - `error` - Error message (red)
   */
  type: 'info' | 'success' | 'warning' | 'error';

  /**
   * Duration in milliseconds before auto-dismiss.
   * Set to 0 for persistent notifications that require manual dismissal.
   * @default 5000
   */
  duration?: number;

  /** Optional action buttons to display in the notification. */
  actions?: Array<{
    /** Button label */
    label: string;
    /** Handler called when button is clicked */
    handler: () => void;
  }>;
}
```

#### Example

```typescript
import type { PluginContext } from '@sqlpro/plugin-sdk';

export function activate(context: PluginContext) {
  const { api } = context;

  // Simple success notification
  api.ui.showNotification({
    message: 'Plugin activated successfully!',
    type: 'success',
    duration: 3000,
  });

  // Error notification with action
  api.ui.showNotification({
    message: 'Failed to export data: File not writable',
    type: 'error',
    duration: 0, // Persistent - user must dismiss
    actions: [
      {
        label: 'Try Again',
        handler: () => retryExport(),
      },
      {
        label: 'Open Settings',
        handler: () => openExportSettings(),
      },
    ],
  });

  // Warning with auto-dismiss
  api.ui.showNotification({
    message: 'Query execution took longer than 5 seconds',
    type: 'warning',
    duration: 5000,
  });

  // Informational message
  api.ui.showNotification({
    message: 'Tip: Press Ctrl+Shift+L to toggle logging',
    type: 'info',
  });
}
```

---

## Query Lifecycle API

The Query Lifecycle API (`context.api.query`) provides hooks for intercepting query execution at various stages. Use this to log queries, modify SQL, transform results, or handle errors.

### Interface Definition

```typescript
interface QueryLifecycleAPI {
  onBeforeQuery(hook: BeforeQueryHook): () => void;
  onAfterQuery(hook: AfterQueryHook): () => void;
  onQueryError(hook: QueryErrorHook): () => void;
}
```

### Hook Execution Order

1. **onBeforeQuery** hooks run first (can modify or cancel the query)
2. Query executes against the database
3. On success: **onAfterQuery** hooks run (can transform results)
4. On failure: **onQueryError** hooks run (for logging and recovery)

Multiple hooks of the same type are executed in registration order. Each hook can be assigned a priority (lower numbers run first, default: 100).

---

### onBeforeQuery()

Register a hook that runs before query execution. Before-query hooks can modify the query string, cancel execution, or attach metadata.

#### Signature

```typescript
onBeforeQuery(hook: BeforeQueryHook): () => void
```

#### Parameters

| Parameter | Type                                  | Required | Description   |
| --------- | ------------------------------------- | -------- | ------------- |
| `hook`    | [`BeforeQueryHook`](#beforequeryhook) | Yes      | Hook function |

#### Returns

A cleanup function that unregisters the hook when called.

#### BeforeQueryHook

```typescript
type BeforeQueryHook = (
  context: QueryContext
) => QueryHookResult | Promise<QueryHookResult> | void | Promise<void>;
```

#### QueryContext

```typescript
interface QueryContext {
  /** The SQL query string being executed. */
  query: string;

  /** Unique identifier for the database connection. */
  connectionId: string;

  /** File path to the SQLite database. */
  dbPath: string;

  /** Unix timestamp (milliseconds) when the query was initiated. */
  timestamp: number;
}
```

#### QueryHookResult

```typescript
interface QueryHookResult {
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
```

#### Example

```typescript
import type { PluginContext } from '@sqlpro/plugin-sdk';

export function activate(context: PluginContext) {
  const { api, manifest } = context;

  // Log all queries
  const unregister1 = api.query.onBeforeQuery((ctx) => {
    console.log(`[${manifest.name}] Executing: ${ctx.query}`);
  });

  // Add a timestamp comment to all queries
  const unregister2 = api.query.onBeforeQuery((ctx) => {
    const timestamp = new Date().toISOString();
    return {
      query: `-- Executed at ${timestamp}\n${ctx.query}`,
      metadata: { startTime: performance.now() },
    };
  });

  // Block dangerous queries
  const unregister3 = api.query.onBeforeQuery((ctx) => {
    const dangerous = ['DROP TABLE', 'DROP DATABASE', 'TRUNCATE'];
    const upperQuery = ctx.query.toUpperCase();

    for (const keyword of dangerous) {
      if (upperQuery.includes(keyword)) {
        return {
          cancel: true,
          cancelReason: `${keyword} statements are blocked by security policy`,
        };
      }
    }
  });

  // Optimize SELECT * queries
  const unregister4 = api.query.onBeforeQuery((ctx) => {
    if (ctx.query.trim().toUpperCase().startsWith('SELECT *')) {
      // Could analyze schema and replace with specific columns
      console.log('Warning: SELECT * detected, consider specifying columns');
    }
  });
}
```

---

### onAfterQuery()

Register a hook that runs after successful query execution. After-query hooks can transform results or perform logging.

#### Signature

```typescript
onAfterQuery(hook: AfterQueryHook): () => void
```

#### Parameters

| Parameter | Type                                | Required | Description   |
| --------- | ----------------------------------- | -------- | ------------- |
| `hook`    | [`AfterQueryHook`](#afterqueryhook) | Yes      | Hook function |

#### Returns

A cleanup function that unregisters the hook when called.

#### AfterQueryHook

```typescript
type AfterQueryHook = (
  results: QueryResults,
  context: QueryContext
) => QueryResults | Promise<QueryResults> | void | Promise<void>;
```

#### QueryResults

```typescript
interface QueryResults {
  /** Column names from the result set. */
  columns: string[];

  /** Array of result rows as key-value objects. */
  rows: Record<string, unknown>[];

  /** Number of rows affected (for INSERT, UPDATE, DELETE). */
  rowsAffected?: number;

  /** Last inserted row ID (for INSERT operations). */
  lastInsertRowId?: number;

  /** Query execution time in milliseconds. */
  executionTime: number;

  /** Metadata passed from before-query hooks. */
  metadata?: Record<string, unknown>;
}
```

#### Example

```typescript
import type { PluginContext } from '@sqlpro/plugin-sdk';

export function activate(context: PluginContext) {
  const { api, manifest } = context;

  // Log query completion
  const unregister1 = api.query.onAfterQuery((results, ctx) => {
    console.log(`Query completed in ${results.executionTime}ms`);
    console.log(`Returned ${results.rows.length} rows`);
  });

  // Calculate total execution time (using metadata from before-hook)
  const unregister2 = api.query.onAfterQuery((results) => {
    const startTime = results.metadata?.startTime as number | undefined;
    if (startTime) {
      const totalTime = performance.now() - startTime;
      console.log(`Total processing time: ${totalTime.toFixed(2)}ms`);
    }
    return results;
  });

  // Transform date columns to formatted strings
  const unregister3 = api.query.onAfterQuery((results) => {
    const dateColumns = ['created_at', 'updated_at', 'timestamp'];

    const transformedRows = results.rows.map((row) => {
      const newRow = { ...row };
      for (const col of dateColumns) {
        if (col in newRow && typeof newRow[col] === 'number') {
          newRow[col] = new Date(newRow[col] as number).toLocaleString();
        }
      }
      return newRow;
    });

    return { ...results, rows: transformedRows };
  });

  // Track query statistics
  const queryStats = { total: 0, totalTime: 0 };

  const unregister4 = api.query.onAfterQuery((results) => {
    queryStats.total++;
    queryStats.totalTime += results.executionTime;
    console.log(
      `Average query time: ${(queryStats.totalTime / queryStats.total).toFixed(2)}ms`
    );
  });
}
```

---

### onQueryError()

Register a hook that runs when a query encounters an error. Error hooks can log errors, show custom notifications, or attempt recovery actions.

#### Signature

```typescript
onQueryError(hook: QueryErrorHook): () => void
```

#### Parameters

| Parameter | Type                                | Required | Description   |
| --------- | ----------------------------------- | -------- | ------------- |
| `hook`    | [`QueryErrorHook`](#queryerrorhook) | Yes      | Hook function |

#### Returns

A cleanup function that unregisters the hook when called.

#### QueryErrorHook

```typescript
type QueryErrorHook = (error: QueryError) => void | Promise<void>;
```

#### QueryError

```typescript
interface QueryError {
  /** Error message describing what went wrong. */
  message: string;

  /**
   * SQLite error code (if available).
   * @example "SQLITE_CONSTRAINT", "SQLITE_BUSY", "SQLITE_SYNTAX"
   */
  code?: string;

  /** The query that caused the error. */
  query: string;

  /** Connection ID where the error occurred. */
  connectionId: string;
}
```

#### Example

```typescript
import type { PluginContext } from '@sqlpro/plugin-sdk';

export function activate(context: PluginContext) {
  const { api, manifest } = context;

  // Log all query errors
  const unregister1 = api.query.onQueryError((error) => {
    console.error(`[${manifest.name}] Query failed:`);
    console.error(`  Message: ${error.message}`);
    console.error(`  Code: ${error.code || 'N/A'}`);
    console.error(`  Query: ${error.query}`);
  });

  // Show user-friendly error notifications
  const unregister2 = api.query.onQueryError((error) => {
    let message = 'Query failed: ';

    switch (error.code) {
      case 'SQLITE_CONSTRAINT':
        message += 'Constraint violation (duplicate key or foreign key error)';
        break;
      case 'SQLITE_BUSY':
        message += 'Database is locked. Try again in a moment.';
        break;
      case 'SQLITE_SYNTAX':
        message += 'SQL syntax error. Check your query.';
        break;
      default:
        message += error.message;
    }

    api.ui.showNotification({
      message,
      type: 'error',
      duration: 0, // Persistent
    });
  });

  // Track error statistics
  const errorLog: Array<{ timestamp: Date; error: string; query: string }> = [];

  const unregister3 = api.query.onQueryError((error) => {
    errorLog.push({
      timestamp: new Date(),
      error: error.message,
      query: error.query,
    });

    // Keep only last 100 errors
    if (errorLog.length > 100) {
      errorLog.shift();
    }
  });
}
```

---

## Storage API

The Storage API (`context.api.storage`) provides persistent storage for plugin data. Each plugin has isolated storage that persists across application restarts.

### Interface Definition

```typescript
interface StorageAPI {
  get<T = unknown>(key: string): Promise<T | undefined>;
  set<T = unknown>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  keys(): Promise<string[]>;
  clear(): Promise<void>;
}
```

### Storage Limits

| Limit                   | Value            |
| ----------------------- | ---------------- |
| Maximum keys per plugin | 1,000            |
| Maximum value size      | 5 MB             |
| Key length              | 1-256 characters |

::: warning Data Serialization
All values must be JSON-serializable. Functions, circular references, and non-serializable types (like `Map`, `Set`, `Date`) cannot be stored directly.
:::

---

### get()

Retrieve a value from plugin storage.

#### Signature

```typescript
get<T = unknown>(key: string): Promise<T | undefined>
```

#### Type Parameters

| Parameter | Description                       |
| --------- | --------------------------------- |
| `T`       | Expected type of the stored value |

#### Parameters

| Parameter | Type     | Required | Description             |
| --------- | -------- | -------- | ----------------------- |
| `key`     | `string` | Yes      | Storage key to retrieve |

#### Returns

`Promise<T | undefined>` - The stored value, or `undefined` if not found.

#### Example

```typescript
import type { PluginContext } from '@sqlpro/plugin-sdk';

interface UserPreferences {
  theme: 'light' | 'dark';
  fontSize: number;
  autoSave: boolean;
}

export async function activate(context: PluginContext) {
  const { api } = context;

  // Get a simple value
  const lastRunTime = await api.storage.get<number>('lastRunTime');
  if (lastRunTime) {
    console.log(`Last run: ${new Date(lastRunTime).toLocaleString()}`);
  }

  // Get a complex object with type safety
  const prefs = await api.storage.get<UserPreferences>('preferences');
  if (prefs) {
    console.log(`Theme: ${prefs.theme}, Font size: ${prefs.fontSize}`);
  }

  // Get with default value
  const counter = (await api.storage.get<number>('counter')) ?? 0;
  console.log(`Counter: ${counter}`);
}
```

---

### set()

Store a value in plugin storage. Values must be JSON-serializable.

#### Signature

```typescript
set<T = unknown>(key: string, value: T): Promise<void>
```

#### Type Parameters

| Parameter | Description                    |
| --------- | ------------------------------ |
| `T`       | Type of the value being stored |

#### Parameters

| Parameter | Type     | Required | Description                                |
| --------- | -------- | -------- | ------------------------------------------ |
| `key`     | `string` | Yes      | Storage key                                |
| `value`   | `T`      | Yes      | Value to store (must be JSON-serializable) |

#### Returns

`Promise<void>`

#### Example

```typescript
import type { PluginContext } from '@sqlpro/plugin-sdk';

export async function activate(context: PluginContext) {
  const { api } = context;

  // Store a simple value
  await api.storage.set('lastRunTime', Date.now());

  // Store an object
  await api.storage.set('preferences', {
    theme: 'dark',
    fontSize: 14,
    autoSave: true,
  });

  // Store an array
  await api.storage.set('recentQueries', [
    'SELECT * FROM users',
    'SELECT COUNT(*) FROM orders',
  ]);

  // Store with type parameter
  interface QueryLog {
    timestamp: number;
    query: string;
    duration: number;
  }

  const logEntry: QueryLog = {
    timestamp: Date.now(),
    query: 'SELECT * FROM users',
    duration: 42,
  };

  await api.storage.set<QueryLog[]>('queryLog', [logEntry]);
}
```

---

### remove()

Remove a value from plugin storage.

#### Signature

```typescript
remove(key: string): Promise<void>
```

#### Parameters

| Parameter | Type     | Required | Description           |
| --------- | -------- | -------- | --------------------- |
| `key`     | `string` | Yes      | Storage key to remove |

#### Returns

`Promise<void>`

#### Example

```typescript
import type { PluginContext } from '@sqlpro/plugin-sdk';

export async function activate(context: PluginContext) {
  const { api } = context;

  // Remove a specific key
  await api.storage.remove('temporaryData');

  // Clear cache on activation
  await api.storage.remove('cachedResults');
}
```

---

### keys()

Get all storage keys for the plugin.

#### Signature

```typescript
keys(): Promise<string[]>
```

#### Returns

`Promise<string[]>` - Array of all storage keys.

#### Example

```typescript
import type { PluginContext } from '@sqlpro/plugin-sdk';

export async function activate(context: PluginContext) {
  const { api } = context;

  // List all stored keys
  const allKeys = await api.storage.keys();
  console.log('Stored keys:', allKeys);

  // Check storage usage
  console.log(`Using ${allKeys.length} / 1000 keys`);

  // Find keys by pattern
  const settingsKeys = allKeys.filter((key) => key.startsWith('settings.'));
  console.log('Settings keys:', settingsKeys);
}
```

---

### clear()

Remove all data from plugin storage.

#### Signature

```typescript
clear(): Promise<void>
```

#### Returns

`Promise<void>`

::: danger Destructive Operation
This permanently deletes all stored data for your plugin. Use with caution.
:::

#### Example

```typescript
import type { PluginContext } from '@sqlpro/plugin-sdk';

export async function activate(context: PluginContext) {
  const { api } = context;

  // Add a "Reset Plugin" command
  api.ui.registerCommand({
    id: 'myPlugin.resetAll',
    title: 'My Plugin: Reset All Data',
    handler: async () => {
      // Clear all plugin storage
      await api.storage.clear();

      api.ui.showNotification({
        message: 'Plugin data has been reset.',
        type: 'success',
      });
    },
  });
}
```

---

## Metadata API

The Metadata API (`context.api.metadata`) provides read-only access to information about the plugin, current database connection, and application.

### Interface Definition

```typescript
interface MetadataAPI {
  getPluginInfo(): PluginManifest;
  getCurrentConnection(): ConnectionInfo | null;
  getAppInfo(): AppInfo;
}
```

---

### getPluginInfo()

Get the plugin's manifest information.

#### Signature

```typescript
getPluginInfo(): PluginManifest
```

#### Returns

[`PluginManifest`](#pluginmanifest) - Copy of the plugin's manifest data.

#### PluginManifest

```typescript
interface PluginManifest {
  /** Unique plugin identifier (reverse domain notation). */
  id: string;

  /** Human-readable plugin name. */
  name: string;

  /** Semantic version string. */
  version: string;

  /** Brief description of the plugin. */
  description: string;

  /** Author name or organization. */
  author: string;

  /** Relative path to plugin entry point. */
  main: string;

  /** Required permissions (optional). */
  permissions?: PluginPermission[];

  /** Version requirements (optional). */
  engines?: { sqlpro?: string };

  /** Plugin homepage URL (optional). */
  homepage?: string;

  /** Source repository URL (optional). */
  repository?: string;

  /** SPDX license identifier (optional). */
  license?: string;

  /** Keywords for search/categorization (optional). */
  keywords?: string[];

  /** Path to plugin icon (optional). */
  icon?: string;

  /** Paths to screenshots (optional). */
  screenshots?: string[];

  /** Minimum Plugin API version (optional). */
  apiVersion?: string;
}
```

#### Example

```typescript
import type { PluginContext } from '@sqlpro/plugin-sdk';

export function activate(context: PluginContext) {
  const { api } = context;

  // Get plugin info
  const info = api.metadata.getPluginInfo();

  console.log(`Plugin: ${info.name} v${info.version}`);
  console.log(`Author: ${info.author}`);
  console.log(`Description: ${info.description}`);

  // Show activation notification
  api.ui.showNotification({
    message: `${info.name} v${info.version} is now active!`,
    type: 'success',
  });

  // Use in command titles
  api.ui.registerCommand({
    id: `${info.id}.help`,
    title: `${info.name}: Show Help`,
    handler: () => {
      if (info.homepage) {
        // Open documentation
      }
    },
  });
}
```

---

### getCurrentConnection()

Get information about the current database connection.

#### Signature

```typescript
getCurrentConnection(): ConnectionInfo | null
```

#### Returns

[`ConnectionInfo`](#connectioninfo) | `null` - Connection info if a database is open, otherwise `null`.

#### ConnectionInfo

```typescript
interface ConnectionInfo {
  /** Unique connection identifier. */
  id: string;

  /** Full path to the database file. */
  path: string;

  /** Database filename without path. */
  filename: string;

  /** Whether the database is encrypted (SQLCipher). */
  isEncrypted: boolean;

  /** Whether the connection is read-only. */
  isReadOnly: boolean;
}
```

#### Example

```typescript
import type { PluginContext } from '@sqlpro/plugin-sdk';

export function activate(context: PluginContext) {
  const { api, manifest } = context;

  // Check connection before operations
  api.ui.registerCommand({
    id: `${manifest.id}.analyzeSchema`,
    title: 'Analyze Database Schema',
    handler: () => {
      const connection = api.metadata.getCurrentConnection();

      if (!connection) {
        api.ui.showNotification({
          message: 'Please open a database first.',
          type: 'warning',
        });
        return;
      }

      console.log(`Analyzing: ${connection.filename}`);
      console.log(`Path: ${connection.path}`);
      console.log(`Encrypted: ${connection.isEncrypted}`);
      console.log(`Read-only: ${connection.isReadOnly}`);

      // Check for read-only restrictions
      if (connection.isReadOnly) {
        api.ui.showNotification({
          message: 'Database is read-only. Some features may be limited.',
          type: 'info',
        });
      }

      performSchemaAnalysis(connection.id);
    },
  });
}
```

---

### getAppInfo()

Get information about the SQL Pro application.

#### Signature

```typescript
getAppInfo(): AppInfo
```

#### Returns

[`AppInfo`](#appinfo) - Application information.

#### AppInfo

```typescript
interface AppInfo {
  /**
   * Application version string.
   * @example "1.6.0", "2.0.0-beta.1"
   */
  version: string;

  /**
   * Operating system platform.
   * @example "darwin" (macOS), "win32" (Windows), "linux"
   */
  platform: string;

  /**
   * CPU architecture.
   * @example "x64", "arm64"
   */
  arch: string;

  /** Whether the app is running in development mode. */
  isDev: boolean;
}
```

#### Example

```typescript
import type { PluginContext } from '@sqlpro/plugin-sdk';

export function activate(context: PluginContext) {
  const { api } = context;

  // Get app info
  const app = api.metadata.getAppInfo();

  console.log(`SQL Pro v${app.version}`);
  console.log(`Platform: ${app.platform} (${app.arch})`);
  console.log(`Development mode: ${app.isDev}`);

  // Platform-specific behavior
  if (app.platform === 'darwin') {
    console.log('Running on macOS');
  } else if (app.platform === 'win32') {
    console.log('Running on Windows');
  } else {
    console.log('Running on Linux');
  }

  // Development-only features
  if (app.isDev) {
    console.log('Development mode - enabling debug features');
    enableDebugMode();
  }

  // Check version compatibility
  const [major, minor] = app.version.split('.').map(Number);
  if (major < 2) {
    api.ui.showNotification({
      message: 'This plugin works best with SQL Pro 2.0 or later.',
      type: 'info',
    });
  }
}
```

---

## Type Definitions

### PluginContext

The context object passed to your plugin's `activate` function.

```typescript
interface PluginContext {
  /** The complete Plugin API for extending SQL Pro. */
  api: PluginAPI;

  /** This plugin's manifest data from plugin.json. */
  manifest: PluginManifest;

  /** Absolute path to the plugin's installation directory. */
  pluginPath: string;
}
```

### PluginAPI

The complete Plugin API surface.

```typescript
interface PluginAPI {
  /** UI Extension API for commands, menus, panels, notifications. */
  ui: UIExtensionAPI;

  /** Query Lifecycle API for intercepting query execution. */
  query: QueryLifecycleAPI;

  /** Storage API for persistent plugin data. */
  storage: StorageAPI;

  /** Metadata API for plugin, connection, and app info. */
  metadata: MetadataAPI;
}
```

### PluginModule

The exports required from your plugin's entry file.

```typescript
interface PluginModule {
  /**
   * Called when the plugin is activated.
   * This is the main entry point for your plugin.
   */
  activate: (context: PluginContext) => void | Promise<void>;

  /**
   * Called when the plugin is deactivated (optional).
   * Use this to clean up resources.
   */
  deactivate?: () => void | Promise<void>;
}
```

### PluginPermission

Available permission types for the plugin manifest.

```typescript
type PluginPermission =
  | 'query:read' // Read query text and results
  | 'query:write' // Modify queries before execution
  | 'ui:menu' // Add items to application menus
  | 'ui:panel' // Create custom UI panels
  | 'ui:command' // Register commands in command palette
  | 'storage:read' // Read from plugin storage
  | 'storage:write' // Write to plugin storage
  | 'connection:info'; // Access database connection information
```

---

## Complete Example

Here's a complete example plugin demonstrating all four API modules:

```typescript
import type {
  PluginContext,
  PluginModule,
  QueryContext,
  QueryResults,
} from '@sqlpro/plugin-sdk';

// Store cleanup functions
const disposables: Array<() => void> = [];

// Plugin state
interface PluginState {
  isLoggingEnabled: boolean;
  queryCount: number;
  totalExecutionTime: number;
}

let state: PluginState = {
  isLoggingEnabled: true,
  queryCount: 0,
  totalExecutionTime: 0,
};

// Plugin activation
export const activate: PluginModule['activate'] = async (
  context: PluginContext
) => {
  const { api, manifest, pluginPath } = context;

  console.log(`[${manifest.name}] Activating from ${pluginPath}`);

  // Load saved state
  const savedState = await api.storage.get<PluginState>('state');
  if (savedState) {
    state = { ...state, ...savedState };
  }

  // Register a command
  disposables.push(
    api.ui.registerCommand({
      id: `${manifest.id}.showStats`,
      title: `${manifest.name}: Show Query Statistics`,
      shortcut: 'CmdOrCtrl+Shift+S',
      category: 'Statistics',
      handler: () => {
        const avg =
          state.queryCount > 0
            ? (state.totalExecutionTime / state.queryCount).toFixed(2)
            : 0;

        api.ui.showNotification({
          message: `Queries: ${state.queryCount}, Avg time: ${avg}ms`,
          type: 'info',
        });
      },
    })
  );

  // Register a menu item
  disposables.push(
    api.ui.registerMenuItem({
      id: `${manifest.id}.toggleLogging`,
      label: state.isLoggingEnabled ? '✓ Logging Enabled' : 'Logging Disabled',
      menuPath: `Plugins/${manifest.name}`,
      shortcut: 'CmdOrCtrl+Shift+L',
      handler: async () => {
        state.isLoggingEnabled = !state.isLoggingEnabled;
        await api.storage.set('state', state);

        api.ui.showNotification({
          message: `Logging ${state.isLoggingEnabled ? 'enabled' : 'disabled'}`,
          type: 'info',
        });
      },
    })
  );

  // Register before-query hook
  disposables.push(
    api.query.onBeforeQuery((ctx: QueryContext) => {
      if (!state.isLoggingEnabled) return;

      console.log(
        `[${manifest.name}] Query: ${ctx.query.substring(0, 100)}...`
      );

      return {
        metadata: { startTime: performance.now() },
      };
    })
  );

  // Register after-query hook
  disposables.push(
    api.query.onAfterQuery(async (results: QueryResults) => {
      state.queryCount++;
      state.totalExecutionTime += results.executionTime;

      // Save state periodically
      if (state.queryCount % 10 === 0) {
        await api.storage.set('state', state);
      }

      return results;
    })
  );

  // Register error hook
  disposables.push(
    api.query.onQueryError((error) => {
      console.error(`[${manifest.name}] Query error: ${error.message}`);
    })
  );

  // Show activation notification
  const appInfo = api.metadata.getAppInfo();
  api.ui.showNotification({
    message: `${manifest.name} v${manifest.version} activated on SQL Pro ${appInfo.version}`,
    type: 'success',
    duration: 3000,
  });
};

// Plugin deactivation
export const deactivate: PluginModule['deactivate'] = async () => {
  // Clean up all registrations
  disposables.forEach((dispose) => dispose());
  disposables.length = 0;

  console.log('[QueryLogger] Deactivated');
};
```

---

## See Also

- [Plugin Development Guide](/plugin-development) - Complete guide to building plugins
- [Example Plugins](https://github.com/sqlpro/plugin-registry) - Browse and install community plugins
- [TypeScript SDK Types](https://github.com/kunish-homelab/sql-pro/tree/main/packages/plugin-sdk/types) - Full type definitions

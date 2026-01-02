# Plugin Development Guide

This comprehensive guide covers everything you need to know to build plugins for SQL Pro. Whether you're creating a simple utility or a complex extension, this guide will help you get started and follow best practices.

::: info Developer Resources
- 📖 [Plugin API Reference](/plugin-api) - Complete API documentation
- 🎯 [Example Plugins](#example-plugins) - Ready-to-use templates
- 💬 [Discussions](https://github.com/kunish-homelab/sql-pro/discussions) - Get help from the community
:::

[[toc]]

## Overview

SQL Pro's plugin system allows you to extend the application with custom functionality, including:

- **Commands** - Add actions to the command palette with keyboard shortcuts
- **Menu Items** - Extend the application menu with custom options
- **Panels** - Create custom UI panels in the sidebar, bottom, or right areas
- **Query Hooks** - Intercept, modify, or log SQL queries
- **Notifications** - Display messages to users
- **Persistent Storage** - Save plugin settings and data

::: tip Example Plugins
Check out the [example plugins](#example-plugins) section for ready-to-use templates you can copy and modify.
:::

## Quick Start

### 1. Create Plugin Structure

Create a new directory for your plugin with the following structure:

```
my-plugin/
├── plugin.json    # Plugin manifest (required)
├── index.ts       # Entry point (or .js)
├── README.md      # Documentation (optional)
└── icon.png       # Plugin icon (optional, 128x128)
```

### 2. Define the Manifest

Create `plugin.json` with your plugin's metadata:

```json
{
  "id": "com.example.myplugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "A helpful SQL Pro plugin",
  "author": "Your Name",
  "main": "index.js",
  "permissions": ["ui:command", "ui:menu"],
  "engines": {
    "sqlpro": "^1.6.0"
  },
  "license": "MIT",
  "keywords": ["utility", "productivity"]
}
```

### 3. Implement the Plugin

Create `index.ts` (or `index.js`) with your plugin code:

```typescript
import type { PluginContext, PluginModule } from '@sqlpro/plugin-sdk';

// Store cleanup functions
const disposables: Array<() => void> = [];

// Plugin activation - main entry point
export const activate: PluginModule['activate'] = (context: PluginContext) => {
  const { api, manifest } = context;

  // Register a command
  const unregister = api.ui.registerCommand({
    id: `${manifest.id}.hello`,
    title: 'My Plugin: Say Hello',
    shortcut: 'CmdOrCtrl+Shift+H',
    handler: () => {
      api.ui.showNotification({
        message: 'Hello from my plugin!',
        type: 'success',
        duration: 3000,
      });
    },
  });

  disposables.push(unregister);
};

// Plugin deactivation - cleanup
export const deactivate: PluginModule['deactivate'] = () => {
  disposables.forEach((dispose) => dispose());
  disposables.length = 0;
};
```

### 4. Build and Test

Compile your TypeScript to JavaScript (if using TypeScript), then install and test your plugin in SQL Pro.

---

## Plugin Manifest Schema

The `plugin.json` file is required and defines your plugin's metadata. Here's the complete schema reference:

### Required Fields

| Field         | Type     | Description                                                                       |
| ------------- | -------- | --------------------------------------------------------------------------------- |
| `id`          | `string` | Unique identifier using reverse domain notation (e.g., `com.company.plugin-name`) |
| `name`        | `string` | Human-readable name displayed in the Plugin Manager                               |
| `version`     | `string` | Semantic version following [semver](https://semver.org/) (e.g., `1.0.0`)          |
| `description` | `string` | Brief description of what the plugin does                                         |
| `author`      | `string` | Author name or organization                                                       |
| `main`        | `string` | Relative path to the entry point file (e.g., `index.js`)                          |

### Optional Fields

| Field         | Type       | Description                                                       |
| ------------- | ---------- | ----------------------------------------------------------------- |
| `permissions` | `string[]` | Permissions the plugin requires (see [Permissions](#permissions)) |
| `engines`     | `object`   | Version requirements (e.g., `{ "sqlpro": "^1.6.0" }`)             |
| `license`     | `string`   | SPDX license identifier (e.g., `MIT`, `Apache-2.0`)               |
| `keywords`    | `string[]` | Keywords for marketplace search and categorization                |
| `icon`        | `string`   | Relative path to plugin icon (128x128 PNG recommended)            |
| `screenshots` | `string[]` | Paths to screenshot images for marketplace display                |
| `homepage`    | `string`   | URL to plugin's homepage or documentation                         |
| `repository`  | `string`   | URL to plugin's source code repository                            |
| `apiVersion`  | `string`   | Minimum Plugin API version required                               |

### Example Manifest

```json
{
  "id": "com.example.query-logger",
  "name": "Query Logger",
  "version": "1.2.0",
  "description": "Logs all SQL queries with execution times and results",
  "author": "Example Inc.",
  "main": "dist/index.js",
  "license": "MIT",
  "keywords": ["logging", "debugging", "analytics", "performance"],
  "permissions": [
    "query:read",
    "query:write",
    "ui:menu",
    "ui:command",
    "storage:read",
    "storage:write"
  ],
  "engines": {
    "sqlpro": "^1.6.0"
  },
  "icon": "assets/icon.png",
  "screenshots": ["assets/screenshot-1.png", "assets/screenshot-2.png"],
  "homepage": "https://example.com/query-logger",
  "repository": "https://github.com/example/query-logger",
  "apiVersion": "1.0.0"
}
```

### Permissions

Permissions inform users about what capabilities your plugin requires. The following permissions are available:

| Permission        | Description                              |
| ----------------- | ---------------------------------------- |
| `query:read`      | Read query text and results              |
| `query:write`     | Modify queries before execution          |
| `ui:menu`         | Add items to application menus           |
| `ui:panel`        | Create custom UI panels                  |
| `ui:command`      | Register commands in the command palette |
| `storage:read`    | Read from plugin storage                 |
| `storage:write`   | Write to plugin storage                  |
| `connection:info` | Access database connection information   |

::: info Permission Enforcement
Permissions are currently informational and displayed to users during installation. Future versions will enforce granular permission prompts.
:::

---

## Plugin Entry Point

Your plugin must export an `activate` function and optionally a `deactivate` function.

### activate(context)

Called when the plugin is enabled or when SQL Pro starts with the plugin already enabled.

```typescript
import type { PluginContext, PluginModule } from '@sqlpro/plugin-sdk';

export const activate: PluginModule['activate'] = (context: PluginContext) => {
  // Access the API
  const { api, manifest, pluginPath } = context;

  // Register commands, menu items, hooks, etc.
  api.ui.showNotification({
    message: `${manifest.name} v${manifest.version} activated!`,
    type: 'success',
  });
};
```

The `context` object provides:

| Property     | Type             | Description                                                |
| ------------ | ---------------- | ---------------------------------------------------------- |
| `api`        | `PluginAPI`      | The complete Plugin API (see [API Reference](/plugin-api)) |
| `manifest`   | `PluginManifest` | Your plugin's manifest data                                |
| `pluginPath` | `string`         | Absolute path to plugin installation directory             |

### deactivate()

Called when the plugin is disabled, uninstalled, or when SQL Pro is shutting down.

```typescript
export const deactivate: PluginModule['deactivate'] = () => {
  // Clean up resources
  // - Cancel timers
  // - Close file handles
  // - Save unsaved state
};
```

::: tip Automatic Cleanup
Commands, menu items, panels, and hooks registered via the API are automatically cleaned up when the plugin is deactivated. You only need to handle custom cleanup tasks.
:::

---

## Plugin API Overview

The Plugin API is organized into four modules:

### UI Extension API (`context.api.ui`)

Add commands, menus, panels, and notifications to the UI.

```typescript
// Register a command in the command palette
const unregister = api.ui.registerCommand({
  id: 'myPlugin.doSomething',
  title: 'My Plugin: Do Something',
  shortcut: 'CmdOrCtrl+Shift+D',
  category: 'My Plugin',
  handler: async () => {
    // Action code here
  },
});

// Add a menu item
api.ui.registerMenuItem({
  id: 'myPlugin.menu.action',
  label: '&My Action',
  menuPath: 'Plugins/My Plugin',
  shortcut: 'CmdOrCtrl+Alt+A',
  handler: () => {
    /* ... */
  },
});

// Show a notification
api.ui.showNotification({
  message: 'Operation completed!',
  type: 'success', // 'info' | 'success' | 'warning' | 'error'
  duration: 3000, // Auto-dismiss in ms (0 for persistent)
});

// Register a panel
api.ui.registerPanel({
  id: 'myPlugin.sidebar',
  title: 'My Panel',
  location: 'sidebar', // 'sidebar' | 'bottom' | 'right'
  render: () => '<div>Panel content</div>',
  dispose: () => {
    /* cleanup */
  },
});
```

### Query Lifecycle API (`context.api.query`)

Hook into query execution to log, modify, or analyze queries.

```typescript
// Before query executes
const unregister = api.query.onBeforeQuery((context) => {
  console.log(`Executing: ${context.query}`);

  // Optionally modify the query
  return {
    query: `-- Logged\n${context.query}`,
    metadata: { startTime: Date.now() },
  };

  // Or cancel the query
  // return { cancel: true, cancelReason: 'Query blocked by policy' };
});

// After query succeeds
api.query.onAfterQuery((results, context) => {
  console.log(`Completed in ${results.executionTime}ms`);
  console.log(`Returned ${results.rows.length} rows`);

  // Optionally transform results
  return {
    ...results,
    metadata: { ...results.metadata, processedBy: 'myPlugin' },
  };
});

// When query fails
api.query.onQueryError((error) => {
  console.error(`Query failed: ${error.message}`);
  console.error(`Query: ${error.query}`);
});
```

### Storage API (`context.api.storage`)

Persist plugin data across sessions. Each plugin has isolated storage.

```typescript
// Save data
await api.storage.set('preferences', { theme: 'dark', fontSize: 14 });
await api.storage.set('lastRunTime', Date.now());

// Load data
const prefs = await api.storage.get<{ theme: string; fontSize: number }>(
  'preferences'
);
const lastRun = await api.storage.get<number>('lastRunTime');

// List all keys
const keys = await api.storage.keys();
console.log('Stored keys:', keys);

// Remove specific key
await api.storage.remove('lastRunTime');

// Clear all plugin data
await api.storage.clear();
```

### Metadata API (`context.api.metadata`)

Access information about the plugin, current connection, and app.

```typescript
// Get plugin manifest info
const pluginInfo = api.metadata.getPluginInfo();
console.log(`${pluginInfo.name} v${pluginInfo.version}`);

// Get current database connection (may be null)
const connection = api.metadata.getCurrentConnection();
if (connection) {
  console.log(`Connected to: ${connection.filename}`);
  console.log(`Path: ${connection.path}`);
  console.log(`Encrypted: ${connection.isEncrypted}`);
  console.log(`Read-only: ${connection.isReadOnly}`);
}

// Get app information
const app = api.metadata.getAppInfo();
console.log(`SQL Pro ${app.version}`);
console.log(`Platform: ${app.platform}/${app.arch}`);
console.log(`Development mode: ${app.isDev}`);
```

---

## Best Practices

### 1. Use Unique Identifiers

Always prefix command, menu, and panel IDs with your plugin ID to avoid conflicts:

```typescript
// Good - prefixed with plugin ID
api.ui.registerCommand({
  id: `${manifest.id}.myCommand`,
  title: 'My Command',
  // ...
});

// Bad - may conflict with other plugins
api.ui.registerCommand({
  id: 'myCommand',
  title: 'My Command',
  // ...
});
```

### 2. Handle Cleanup Properly

Store unregister functions and call them during deactivation:

```typescript
const disposables: Array<() => void> = [];

export const activate = (context: PluginContext) => {
  // Store all unregister functions
  disposables.push(
    api.ui.registerCommand({
      /* ... */
    }),
    api.ui.registerMenuItem({
      /* ... */
    }),
    api.query.onBeforeQuery(() => {
      /* ... */
    })
  );
};

export const deactivate = () => {
  // Clean up everything
  disposables.forEach((dispose) => dispose());
  disposables.length = 0;
};
```

### 3. Handle Errors Gracefully

Wrap async operations in try-catch blocks and provide helpful error messages:

```typescript
api.ui.registerCommand({
  id: `${manifest.id}.riskyOperation`,
  title: 'Risky Operation',
  handler: async () => {
    try {
      await performOperation();
      api.ui.showNotification({
        message: 'Operation succeeded!',
        type: 'success',
      });
    } catch (error) {
      api.ui.showNotification({
        message: `Operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        type: 'error',
        duration: 0, // Persistent - user must dismiss
      });
    }
  },
});
```

### 4. Persist User Preferences

Save user settings to storage and restore them on activation:

```typescript
interface Settings {
  enabled: boolean;
  threshold: number;
}

const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  threshold: 100,
};

let settings: Settings = { ...DEFAULT_SETTINGS };

export const activate = async (context: PluginContext) => {
  // Load saved settings
  const saved = await context.api.storage.get<Settings>('settings');
  if (saved) {
    settings = { ...DEFAULT_SETTINGS, ...saved };
  }
};
```

### 5. Use Descriptive Command Titles

Include your plugin name in command titles for discoverability:

```typescript
// Good - clear and discoverable
api.ui.registerCommand({
  title: 'Query Logger: Toggle Logging',
  category: 'Logging',
  // ...
});

// Bad - generic and confusing
api.ui.registerCommand({
  title: 'Toggle',
  // ...
});
```

### 6. Provide Keyboard Shortcuts

Add shortcuts for frequently used commands using [Electron accelerator format](https://www.electronjs.org/docs/latest/api/accelerator):

```typescript
// Common modifiers:
// - CmdOrCtrl: Cmd on macOS, Ctrl on Windows/Linux
// - Alt: Option on macOS, Alt on Windows/Linux
// - Shift: Shift on all platforms

api.ui.registerCommand({
  id: `${manifest.id}.quickAction`,
  title: 'Quick Action',
  shortcut: 'CmdOrCtrl+Shift+Q', // Cross-platform shortcut
  handler: () => {
    /* ... */
  },
});
```

### 7. Check Connection State

Always check if a database is connected before performing database-related operations:

```typescript
api.ui.registerCommand({
  id: `${manifest.id}.analyzeTable`,
  title: 'Analyze Current Table',
  handler: () => {
    const connection = api.metadata.getCurrentConnection();
    if (!connection) {
      api.ui.showNotification({
        message: 'Please open a database first.',
        type: 'warning',
      });
      return;
    }

    // Proceed with operation
    analyzeTable(connection.id);
  },
});
```

---

## Testing and Debugging

### Development Mode

When developing plugins, run SQL Pro in development mode for better debugging:

```bash
# In the SQL Pro repository
pnpm run dev
```

This enables:

- Chrome DevTools (press `Cmd+Option+I` / `Ctrl+Shift+I`)
- Hot reload for faster iteration
- Detailed error messages

### Console Logging

Use `console.log()` for debugging during development. Messages appear in the DevTools console:

```typescript
export const activate = (context: PluginContext) => {
  console.log('[MyPlugin] Activating...');
  console.log('[MyPlugin] Manifest:', context.manifest);
  console.log('[MyPlugin] Plugin path:', context.pluginPath);
};
```

::: warning Production Plugins
Remove or minimize console logging in production plugins to avoid cluttering the console.
:::

### Testing Query Hooks

Test your query hooks with various SQL statements:

```typescript
// Test different query types
const testQueries = [
  'SELECT * FROM users',
  'INSERT INTO logs (message) VALUES ("test")',
  'UPDATE settings SET value = "new" WHERE key = "theme"',
  'DELETE FROM cache WHERE expired = 1',
  'INVALID SQL QUERY', // Test error handling
];

testQueries.forEach((query) => {
  console.log(`Testing: ${query}`);
  // Your hook will be called automatically
});
```

### Error Handling in Hooks

Ensure your hooks don't crash on unexpected input:

```typescript
api.query.onBeforeQuery((context) => {
  try {
    // Your hook logic
    const processed = processQuery(context.query);
    return { query: processed };
  } catch (error) {
    // Log but don't throw - let the query proceed
    console.error('[MyPlugin] Hook error:', error);
    return undefined; // Use original query
  }
});
```

---

## Publishing Plugins

### Package Your Plugin

1. Ensure your manifest is complete with all metadata
2. Compile TypeScript to JavaScript (if using TypeScript)
3. Create a ZIP archive with the `.sqlpro-plugin` extension:

```bash
# From your plugin directory
zip -r my-plugin.sqlpro-plugin plugin.json index.js README.md icon.png
```

### Plugin Package Structure

```
my-plugin.sqlpro-plugin (ZIP archive)
├── plugin.json        # Required
├── index.js           # Entry point (path from manifest.main)
├── README.md          # Recommended
├── icon.png           # Recommended (128x128)
├── LICENSE            # Recommended
└── assets/            # Optional resources
    └── screenshot.png
```

### Size Limits

- Maximum plugin bundle size: **50 MB**
- Recommended icon size: **128x128 pixels** (PNG or SVG)

### Version Requirements

Use the `engines.sqlpro` field to specify SQL Pro version compatibility:

```json
{
  "engines": {
    "sqlpro": "^1.6.0"
  }
}
```

Supported version range formats:

- `^1.6.0` - Compatible with 1.6.0 and above (minor/patch updates OK)
- `~1.6.0` - Compatible with 1.6.x only (patch updates OK)
- `>=1.6.0` - Compatible with 1.6.0 and any newer version
- `1.6.0` - Exact version match only

### Marketplace Submission

To submit your plugin to the SQL Pro marketplace:

1. Create a GitHub repository for your plugin
2. Include a comprehensive README with:
   - Description of features
   - Installation instructions
   - Screenshots or GIFs
   - License information
3. Create a release with the `.sqlpro-plugin` archive
4. Submit a pull request to the [SQL Pro Plugins Registry](https://github.com/sqlpro/plugin-registry)

---

## Example Plugins

SQL Pro provides several example plugins as templates. Each demonstrates different API capabilities.

### Hello World Plugin

**Location:** `plugin-sdk/templates/hello-world/`

A minimal plugin demonstrating the basic structure:

- Plugin lifecycle (`activate` and `deactivate`)
- Command registration with keyboard shortcut
- Menu item registration with submenu
- Notification display
- Metadata API usage

```typescript
// Key patterns demonstrated
export const activate = (context: PluginContext) => {
  // Register a command
  disposables.push(
    api.ui.registerCommand({
      id: `${manifest.id}.sayHello`,
      title: 'Hello World: Say Hello',
      shortcut: 'CmdOrCtrl+Shift+H',
      handler: () => {
        api.ui.showNotification({
          message: 'Hello, World!',
          type: 'success',
        });
      },
    })
  );
};
```

### Menu Command Plugin

**Location:** `plugin-sdk/templates/menu-command/`

Demonstrates advanced menu and command patterns:

- Hierarchical menu structures with submenus
- Dynamic menu items based on connection state
- Toggle settings with visual indicators
- Storage API for persistent preferences
- Multiple keyboard shortcuts

### Query Hook Logger Plugin

**Location:** `plugin-sdk/templates/query-hook/`

A complete query logging solution demonstrating:

- All three query lifecycle hooks (`onBeforeQuery`, `onAfterQuery`, `onQueryError`)
- Query modification and metadata attachment
- Persistent log storage with size limits
- Statistics tracking and display
- Configurable settings with menu toggles

```typescript
// Key patterns demonstrated
api.query.onBeforeQuery((context) => {
  // Log query
  console.log(`[${new Date().toISOString()}] ${context.query}`);

  // Optionally modify
  return {
    query: `-- Logged at ${Date.now()}\n${context.query}`,
    metadata: { startTime: performance.now() },
  };
});

api.query.onAfterQuery((results, context) => {
  const duration = performance.now() - (results.metadata?.startTime ?? 0);
  console.log(`Query completed in ${duration.toFixed(2)}ms`);
});
```

---

## TypeScript Support

### Using the Plugin SDK Types

Import types from `@sqlpro/plugin-sdk` for full TypeScript support:

```typescript
import type {
  PluginContext,
  PluginModule,
  PluginManifest,
  CommandOptions,
  MenuItemOptions,
  PanelOptions,
  NotificationOptions,
  QueryContext,
  QueryResults,
  QueryError,
  QueryHookResult,
  BeforeQueryHook,
  AfterQueryHook,
  QueryErrorHook,
  UIExtensionAPI,
  QueryLifecycleAPI,
  StorageAPI,
  MetadataAPI,
  ConnectionInfo,
  AppInfo,
} from '@sqlpro/plugin-sdk';
```

### TypeScript Configuration

Recommended `tsconfig.json` for plugin development:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": false,
    "outDir": "./dist"
  },
  "include": ["*.ts"],
  "exclude": ["node_modules"]
}
```

### Building TypeScript Plugins

```bash
# Install dependencies
npm install typescript @sqlpro/plugin-sdk --save-dev

# Build
npx tsc

# Or use esbuild for faster builds
npx esbuild index.ts --bundle --outfile=index.js --platform=node
```

---

## Troubleshooting

### Plugin Won't Load

1. **Check the manifest** - Ensure `plugin.json` is valid JSON with all required fields
2. **Check the entry point** - Verify the `main` path points to an existing file
3. **Check version compatibility** - Ensure `engines.sqlpro` matches your SQL Pro version
4. **Check the console** - Open DevTools (`Cmd+Option+I`) and look for error messages

### Commands Not Appearing

1. **Check command ID uniqueness** - Use your plugin ID as a prefix
2. **Verify registration** - Ensure `registerCommand()` was called during activation
3. **Check for errors** - Look for errors in the console during activation

### Query Hooks Not Firing

1. **Verify registration** - Ensure hooks are registered in `activate()`
2. **Check for exceptions** - Hooks that throw errors may be silently ignored
3. **Test with simple queries** - Start with basic SELECT statements

### Storage Not Persisting

1. **Await all storage operations** - Storage methods are async and return Promises
2. **Check key names** - Keys must be non-empty strings
3. **Verify data is serializable** - Storage uses JSON, so functions and circular references won't work

### Plugin Crashes on Activation

1. **Check for syntax errors** - Ensure your JavaScript is valid
2. **Wrap initialization in try-catch** - Catch and log errors during activation
3. **Check dependencies** - Ensure all imported modules are available

---

## Security Considerations

### Sandboxing

SQL Pro plugins run in a sandboxed environment with the following restrictions:

- **No Node.js access** - `require()`, `fs`, `process`, etc. are not available
- **No direct file system access** - Use the Storage API for persistence
- **Memory limits** - Each plugin has a 128 MB memory limit
- **Isolated execution** - Plugins cannot access other plugins' data

### Best Practices

1. **Never store sensitive data** - Don't save passwords or API keys in plugin storage
2. **Validate user input** - Sanitize any data before using it
3. **Handle errors gracefully** - Don't let exceptions expose sensitive information
4. **Use HTTPS** - If fetching external resources, always use secure connections
5. **Minimize permissions** - Only request permissions you actually need

---

## Getting Help

Need assistance with plugin development?

- **[Plugin API Reference](/plugin-api)** - Complete API documentation with all methods and types
- **[Example Plugins](#example-plugins)** - Browse the example plugins in `plugin-sdk/templates/`
- **[GitHub Issues](https://github.com/kunish-homelab/sql-pro/issues)** - Report bugs or request features
- **[GitHub Discussions](https://github.com/kunish-homelab/sql-pro/discussions)** - Ask questions and share ideas

::: info Contributing to the Plugin System
Want to improve the plugin system itself? Check our [Contributing Guide](https://github.com/kunish-homelab/sql-pro/blob/main/CONTRIBUTING.md) for details on how to contribute to SQL Pro's core.
:::

---

## Next Steps

- 📖 **[Plugin API Reference](/plugin-api)** - Dive into detailed API documentation
- 🎯 **[Example Plugins](#example-plugins)** - Start with ready-to-use templates
- 🚀 **[Getting Started](/getting-started/)** - New to SQL Pro? Start here
- 📚 **[Features](/features/)** - Explore all SQL Pro features

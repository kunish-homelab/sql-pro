# Query Hook Logger Plugin Template

A comprehensive example plugin demonstrating the **Query Lifecycle API** for SQL Pro. This plugin logs all executed queries, tracks execution times, handles errors, and provides statistics - perfect for debugging, auditing, and learning about query hooks.

## Features

- **Before-Query Hooks** - Log queries before execution, optionally add metadata comments
- **After-Query Hooks** - Track execution times, row counts, and results
- **Error Hooks** - Capture and log query errors with notifications
- **Persistent Storage** - Query log persists across application restarts
- **Configurable Settings** - Toggle logging, filter by query type, customize behavior
- **Statistics Dashboard** - View query counts, success rates, and average execution times

## Quick Start

1. **Copy this template** to start your own query hook plugin:

   ```bash
   cp -r plugin-sdk/templates/query-hook my-query-plugin
   cd my-query-plugin
   ```

2. **Update `plugin.json`** with your plugin's information:

   ```json
   {
     "id": "com.yourname.my-query-plugin",
     "name": "My Query Plugin",
     "version": "1.0.0",
     "description": "Your plugin description",
     "author": "Your Name",
     ...
   }
   ```

3. **Modify `index.ts`** to implement your query hook logic

4. **Build and install** your plugin (see development guide)

## File Structure

```
query-hook/
├── plugin.json    # Plugin manifest with metadata and permissions
├── index.ts       # Plugin entry point with query hooks
└── README.md      # This file
```

## Query Lifecycle Hooks

### Before-Query Hook

Called **before** a query is executed. Can modify the query, cancel execution, or attach metadata.

```typescript
api.query.onBeforeQuery((context: QueryContext): QueryHookResult | void => {
  // Log the query
  console.log(`Executing: ${context.query}`);

  // Optionally modify the query
  return {
    query: `-- Modified by plugin\n${context.query}`,
    metadata: { loggedAt: Date.now() },
  };

  // Or cancel execution
  return {
    cancel: true,
    cancelReason: 'Query blocked by security policy',
  };
});
```

**QueryContext Properties:**
| Property | Type | Description |
|----------|------|-------------|
| `query` | `string` | The SQL query being executed |
| `connectionId` | `string` | Unique database connection ID |
| `dbPath` | `string` | File path to the database |
| `timestamp` | `number` | Unix timestamp when query started |

**QueryHookResult Properties:**
| Property | Type | Description |
|----------|------|-------------|
| `query` | `string?` | Modified query string |
| `cancel` | `boolean?` | Set to true to cancel execution |
| `cancelReason` | `string?` | Reason shown to user when cancelled |
| `metadata` | `object?` | Custom data passed to after-query hook |

### After-Query Hook

Called **after** a query executes successfully. Can transform results or perform logging.

```typescript
api.query.onAfterQuery((results: QueryResults, context: QueryContext): void => {
  console.log(`Query completed in ${results.executionTime}ms`);
  console.log(`Returned ${results.rows.length} rows`);

  // Access metadata from before-query hook
  if (results.metadata?.loggedAt) {
    console.log(`Logged at: ${results.metadata.loggedAt}`);
  }
});
```

**QueryResults Properties:**
| Property | Type | Description |
|----------|------|-------------|
| `columns` | `string[]` | Column names from result set |
| `rows` | `object[]` | Array of result rows |
| `rowsAffected` | `number?` | Rows affected (INSERT/UPDATE/DELETE) |
| `lastInsertRowId` | `number?` | Last inserted row ID |
| `executionTime` | `number` | Execution time in milliseconds |
| `metadata` | `object?` | Metadata from before-query hook |

### Query Error Hook

Called when a query **fails**. Use for error logging, notifications, or recovery.

```typescript
api.query.onQueryError((error: QueryError): void => {
  console.error(`Query failed: ${error.message}`);
  console.error(`Error code: ${error.code}`);
  console.error(`Failed query: ${error.query}`);

  // Show notification to user
  api.ui.showNotification({
    message: `Query error: ${error.message}`,
    type: 'error',
    duration: 5000,
  });
});
```

**QueryError Properties:**
| Property | Type | Description |
|----------|------|-------------|
| `message` | `string` | Error message |
| `code` | `string?` | SQLite error code (e.g., "SQLITE_CONSTRAINT") |
| `query` | `string` | The query that caused the error |
| `connectionId` | `string` | Connection where error occurred |

## Menu Structure

When enabled, this plugin adds the following menu items:

```
Plugins
└── Query Hook Logger
    ├── Logging (On/Off)           Cmd/Ctrl+Alt+L
    ├── View Statistics            Cmd/Ctrl+Alt+S
    ├── View Recent Queries        Cmd/Ctrl+Alt+R
    ├── Clear Log
    ├── Settings
    │   ├── Add Query Comments (On/Off)
    │   ├── Log SELECT Queries (On/Off)
    │   ├── Log Write Queries (On/Off)
    │   └── Show Error Notifications (On/Off)
    └── About
```

## Commands

Commands registered in the command palette (Cmd/Ctrl+Shift+P):

| Command             | Shortcut         | Description                  |
| ------------------- | ---------------- | ---------------------------- |
| Toggle Logging      | `Cmd/Ctrl+Alt+L` | Enable/disable query logging |
| View Statistics     | `Cmd/Ctrl+Alt+S` | Show query statistics        |
| View Recent Queries | `Cmd/Ctrl+Alt+R` | Show last 5 queries          |
| Clear Log           | -                | Clear all logged queries     |

## Settings

The plugin stores these configurable settings:

| Setting                  | Default | Description                       |
| ------------------------ | ------- | --------------------------------- |
| `isLoggingEnabled`       | `true`  | Master toggle for logging         |
| `addQueryComments`       | `false` | Add timestamp comments to queries |
| `maxLogEntries`          | `1000`  | Maximum log entries to keep       |
| `logSelectQueries`       | `true`  | Log SELECT/WITH queries           |
| `logWriteQueries`        | `true`  | Log INSERT/UPDATE/DELETE queries  |
| `showErrorNotifications` | `true`  | Show popup on query errors        |

## Use Cases

### Query Auditing

Log all queries for compliance or debugging:

```typescript
api.query.onAfterQuery(async (results, context) => {
  await saveToAuditLog({
    query: context.query,
    user: getCurrentUser(),
    timestamp: context.timestamp,
    rowsAffected: results.rowsAffected,
  });
});
```

### Query Optimization

Analyze slow queries:

```typescript
api.query.onAfterQuery((results, context) => {
  if (results.executionTime > 1000) {
    api.ui.showNotification({
      message: `Slow query detected: ${results.executionTime}ms`,
      type: 'warning',
    });
  }
});
```

### Security Policy

Block certain queries:

```typescript
api.query.onBeforeQuery((context) => {
  if (context.query.toUpperCase().includes('DROP TABLE')) {
    return {
      cancel: true,
      cancelReason: 'DROP TABLE queries are not allowed',
    };
  }
});
```

### Query Transformation

Automatically add conditions:

```typescript
api.query.onBeforeQuery((context) => {
  // Add soft-delete filter to all SELECT queries
  if (isSelectQuery(context.query)) {
    return {
      query: addWhereClause(context.query, 'deleted_at IS NULL'),
    };
  }
});
```

## APIs Used

| API            | Methods                                                         | Purpose                             |
| -------------- | --------------------------------------------------------------- | ----------------------------------- |
| `api.query`    | `onBeforeQuery()`, `onAfterQuery()`, `onQueryError()`           | Query lifecycle hooks               |
| `api.ui`       | `registerCommand()`, `registerMenuItem()`, `showNotification()` | UI extensions                       |
| `api.storage`  | `get()`, `set()`                                                | Persistent settings and log storage |
| `api.metadata` | `getPluginInfo()`                                               | Plugin information                  |

## Keyboard Shortcuts

| Action              | macOS       | Windows/Linux |
| ------------------- | ----------- | ------------- |
| Toggle Logging      | `Cmd+Alt+L` | `Ctrl+Alt+L`  |
| View Statistics     | `Cmd+Alt+S` | `Ctrl+Alt+S`  |
| View Recent Queries | `Cmd+Alt+R` | `Ctrl+Alt+R`  |

## Best Practices

1. **Don't block the UI** - Keep hook handlers fast, use async for heavy operations
2. **Handle errors gracefully** - Hook errors shouldn't break query execution
3. **Limit stored data** - Enforce max entries to prevent memory issues
4. **Use metadata** - Pass data between before and after hooks via metadata
5. **Clean up properly** - Store unregister functions and call them in deactivate

## Learn More

- [Plugin Development Guide](../../../docs/plugin-development.md)
- [Plugin API Reference](../../../docs/plugin-api.md)
- [Hello World Plugin](../hello-world/README.md) - Basic plugin structure
- [Menu Command Plugin](../menu-command/README.md) - Advanced menu patterns

## License

MIT - Feel free to use this template as a starting point for your own plugins!

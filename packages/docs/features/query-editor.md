# SQL Query Editor

The SQL Query Editor is the heart of SQL Pro, providing a powerful environment for writing, executing, and managing SQL queries. Built on the Monaco editor (the same editor that powers VS Code), it offers professional-grade features for database developers.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="/screenshots/query-dark.png">
  <source media="(prefers-color-scheme: light)" srcset="/screenshots/query.png">
  <img alt="SQL Pro Query Editor with Monaco-based code editing, syntax highlighting, and query results" src="/screenshots/query-dark.png">
</picture>

## Key Features

| Feature                      | Description                                                     |
| ---------------------------- | --------------------------------------------------------------- |
| **Monaco Editor**            | Professional code editing with the same engine as VS Code       |
| **Intelligent Autocomplete** | Context-aware suggestions for tables, columns, and SQL keywords |
| **Syntax Highlighting**      | Color-coded SQL for improved readability                        |
| **Vim Mode**                 | Full Vim keybindings for power users                            |
| **Query History**            | Searchable history of all executed queries                      |
| **Query Templates**          | Reusable templates for common operations                        |
| **Query Optimizer**          | Analyze execution plans and get optimization suggestions        |
| **AI Integration**           | Natural language to SQL conversion and result analysis          |
| **Multi-Tab Support**        | Work with multiple queries simultaneously                       |
| **Split View**               | Compare queries side-by-side                                    |

## Opening the Query Editor

The Query Editor is accessible from the main workspace:

1. Click the **Query** tab in the main content area, or
2. Press <kbd>Cmd/Ctrl</kbd> + <kbd>E</kbd> to focus the editor

## Writing SQL Queries

### Syntax Highlighting

SQL Pro provides rich syntax highlighting for SQL:

- **Keywords** - `SELECT`, `FROM`, `WHERE`, etc. are highlighted
- **Strings** - Text in quotes is color-coded
- **Numbers** - Numeric values stand out
- **Comments** - Both `--` and `/* */` style comments are supported

```sql
-- Example query with syntax highlighting
SELECT
    u.name,
    u.email,
    COUNT(o.id) as order_count
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE u.created_at > '2024-01-01'
GROUP BY u.id
HAVING order_count > 5
ORDER BY order_count DESC;
```

### Intelligent Autocomplete

As you type, SQL Pro suggests:

- **Table names** from your database schema
- **Column names** for the tables in your query
- **SQL keywords** and functions
- **Common SQL patterns**

::: tip Triggering Autocomplete
Autocomplete appears automatically as you type. You can also press <kbd>Ctrl</kbd> + <kbd>Space</kbd> to manually trigger suggestions.
:::

The autocomplete system is **context-aware**:

- After `FROM` or `JOIN`, it suggests table names
- After a table alias or dot (`.`), it suggests column names
- It adapts to your database schema automatically

### SQL Hover Documentation

Hover over SQL keywords to see documentation and usage examples. This is helpful when you need a quick reminder about SQL syntax.

### Find and Replace

Use the built-in find and replace functionality:

- <kbd>Cmd/Ctrl</kbd> + <kbd>F</kbd> - Find in editor
- <kbd>Cmd/Ctrl</kbd> + <kbd>H</kbd> - Find and replace

Features include:

- Case-sensitive search
- Regular expression support
- Replace single or all occurrences

## Executing Queries

### Running a Query

Execute your query using one of these methods:

1. **Click Execute** - Click the **Execute** button (▶️) in the toolbar
2. **Keyboard shortcut** - Press <kbd>Cmd/Ctrl</kbd> + <kbd>Enter</kbd>

### Multiple Queries

You can write multiple queries in the editor:

```sql
-- Query 1: Get all users
SELECT * FROM users;

-- Query 2: Count active users
SELECT COUNT(*) as active_users
FROM users
WHERE status = 'active';
```

To execute a specific query:

1. Place your cursor anywhere within the query you want to run
2. Press <kbd>Cmd/Ctrl</kbd> + <kbd>Enter</kbd>

SQL Pro executes only the query under your cursor.

### Query Results

After execution, results appear below the editor with:

- **Row count** - Number of rows returned
- **Execution time** - How long the query took (in milliseconds)
- **Last Insert ID** - For INSERT queries, the ID of the inserted row
- **Data grid** - Full results with sortable columns

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="/screenshots/query-dark.png">
  <source media="(prefers-color-scheme: light)" srcset="/screenshots/query.png">
  <img alt="SQL Pro Query results panel showing row count, execution time, and data grid with query output" src="/screenshots/query-dark.png">
</picture>

::: warning Large Result Sets
For queries returning many rows, consider using `LIMIT` to control result size:

```sql
SELECT * FROM large_table LIMIT 1000;
```

:::

### Error Handling

When a query fails, SQL Pro displays:

- Clear error message from SQLite
- Query that caused the error
- Failed status in query history

This helps you quickly identify and fix issues.

## SQL Formatting

Keep your SQL clean and readable with automatic formatting:

- Press <kbd>Cmd/Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>F</kbd> to format your SQL

Before formatting:

```sql
select u.name,u.email,count(o.id) as orders from users u left join orders o on u.id=o.user_id where u.status='active' group by u.id order by orders desc
```

After formatting:

```sql
SELECT
    u.name,
    u.email,
    COUNT(o.id) AS orders
FROM
    users u
    LEFT JOIN orders o ON u.id = o.user_id
WHERE
    u.status = 'active'
GROUP BY
    u.id
ORDER BY
    orders DESC
```

## Vim Mode

For developers who prefer Vim keybindings, SQL Pro includes full Vim mode support.

### Enabling Vim Mode

1. Open the Command Palette (<kbd>Cmd/Ctrl</kbd> + <kbd>K</kbd>)
2. Search for "Settings"
3. Toggle **Vim Mode** on

### Vim Features

When Vim mode is enabled:

- Full modal editing (Normal, Insert, Visual modes)
- Vim status bar shows current mode and pending commands
- Standard Vim motions (`hjkl`, `w`, `b`, `e`, etc.)
- Text objects (`iw`, `i"`, `ip`, etc.)
- Visual selection and operators (`d`, `c`, `y`, etc.)

::: info Vim Status Bar
The Vim status bar appears at the bottom of the editor when Vim mode is enabled, showing your current mode (NORMAL, INSERT, VISUAL) and any pending commands.
:::

### Common Vim Commands

| Command | Action                 |
| ------- | ---------------------- |
| `i`     | Enter insert mode      |
| `Esc`   | Return to normal mode  |
| `dd`    | Delete line            |
| `yy`    | Copy line              |
| `p`     | Paste                  |
| `/`     | Search forward         |
| `:w`    | Execute query (mapped) |

## Query History

SQL Pro maintains a complete history of all executed queries for each database.

### Accessing History

1. Click the **History** button in the toolbar, or
2. Press <kbd>Cmd/Ctrl</kbd> + <kbd>H</kbd>

### History Panel Features

- **Search** - Filter history by query text
- **Status indicators** - Green for successful, red for failed queries
- **Execution time** - See how long each query took
- **Timestamps** - When each query was executed
- **Click to reuse** - Click any history item to load it into the editor
- **Delete items** - Remove individual history entries
- **Clear all** - Remove entire history for current database

::: tip Persistent History
Query history is saved to disk and persists between sessions. Your history remains available even after closing and reopening SQL Pro.
:::

## Query Templates

Save time with reusable query templates for common operations.

### Using Templates

1. Click the **Templates** button in the toolbar
2. Browse or search templates
3. Click a template to insert it into the editor

### Built-in Templates

SQL Pro includes templates for common operations:

- **SELECT all** - Basic select query
- **INSERT row** - Insert new data
- **UPDATE row** - Modify existing data
- **DELETE row** - Remove data
- **CREATE TABLE** - Define new table structure
- **Add column** - ALTER TABLE examples
- **Create index** - Performance optimization

## Query Optimizer

Analyze your queries for performance optimization.

### Analyzing a Query

1. Write or select a query in the editor
2. Click the **Analyze** button (⚡)
3. View the execution plan and suggestions

### What You'll See

- **Execution plan** - How SQLite will execute your query
- **Table scans** - Identifies potential performance issues
- **Index usage** - Shows which indexes are being used
- **Suggestions** - Recommendations for optimization

::: tip Optimization Tips
Common suggestions include:

- Creating indexes on frequently filtered columns
- Avoiding `SELECT *` when you only need specific columns
- Using LIMIT for large result sets
  :::

## AI Features

SQL Pro includes AI-powered features to enhance your productivity.

### Natural Language to SQL

Convert plain English questions into SQL queries:

1. Click the **AI** dropdown in the toolbar
2. Select **Natural Language to SQL**
3. Type your question in plain English
4. Get a generated SQL query

Example:

- **Question**: "Show me all users who signed up this month"
- **Generated SQL**:

```sql
SELECT * FROM users
WHERE created_at >= date('now', 'start of month');
```

### Analyze Results

Get AI-powered insights about your query results:

1. Execute a query to get results
2. Click **AI** > **Analyze Results**
3. View patterns and insights about your data

### AI Settings

Configure your AI provider:

1. Click **AI** > **AI Settings**
2. Enter your API key (OpenAI, Anthropic, or compatible)
3. Configure model preferences

::: info AI Privacy
AI features use external APIs. Query results may be sent to the configured AI provider. Consider your data privacy requirements when using AI features.
:::

## Multi-Tab Editing

Work with multiple queries simultaneously using tabs.

### Creating Tabs

- Click the **+** button in the tab bar to create a new tab
- Each tab maintains its own query and results

### Tab Features

- **Independent queries** - Each tab has its own query text
- **Separate results** - Results don't interfere between tabs
- **Rename tabs** - Double-click tab name to rename
- **Close tabs** - Click the × on individual tabs

### Split View

Compare queries or results side-by-side:

1. Right-click on a tab
2. Select **Split Right** or **Split Down**
3. Work with two editors simultaneously

The split view allows:

- Horizontal or vertical layout
- Resizable panes
- Independent query execution
- Close split to return to single view

## Resizing the Editor

Adjust the editor height to suit your workflow:

- **Drag to resize** - Grab the resize handle at the bottom of the editor
- **Double-click** - Restore to default height

This lets you allocate more space to either the editor or results area.

## Keyboard Shortcuts

| Action               | macOS                                            | Windows/Linux                                     |
| -------------------- | ------------------------------------------------ | ------------------------------------------------- |
| Execute query        | <kbd>Cmd</kbd> + <kbd>Enter</kbd>                | <kbd>Ctrl</kbd> + <kbd>Enter</kbd>                |
| Format SQL           | <kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>F</kbd> | <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>F</kbd> |
| Toggle history       | <kbd>Cmd</kbd> + <kbd>H</kbd>                    | <kbd>Ctrl</kbd> + <kbd>H</kbd>                    |
| Find                 | <kbd>Cmd</kbd> + <kbd>F</kbd>                    | <kbd>Ctrl</kbd> + <kbd>F</kbd>                    |
| Find and replace     | <kbd>Cmd</kbd> + <kbd>H</kbd>                    | <kbd>Ctrl</kbd> + <kbd>H</kbd>                    |
| Focus editor         | <kbd>Cmd</kbd> + <kbd>E</kbd>                    | <kbd>Ctrl</kbd> + <kbd>E</kbd>                    |
| Trigger autocomplete | <kbd>Ctrl</kbd> + <kbd>Space</kbd>               | <kbd>Ctrl</kbd> + <kbd>Space</kbd>                |
| Undo                 | <kbd>Cmd</kbd> + <kbd>Z</kbd>                    | <kbd>Ctrl</kbd> + <kbd>Z</kbd>                    |
| Redo                 | <kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd> | <kbd>Ctrl</kbd> + <kbd>Y</kbd>                    |

See the complete [Keyboard Shortcuts](/shortcuts) reference for all available shortcuts.

## Theme Support

The Query Editor automatically matches your system theme:

- **Light mode** - Light background with dark text
- **Dark mode** - Dark background with light text
- **System** - Follows your OS preference

Both themes provide optimized syntax highlighting for SQL readability.

## Tips and Best Practices

### Writing Efficient Queries

1. **Use LIMIT** for large tables during exploration
2. **Select specific columns** instead of `SELECT *`
3. **Add indexes** on frequently queried columns
4. **Use EXPLAIN** to understand query execution

### Organizing Your Workflow

1. **Use tabs** to keep related queries together
2. **Save templates** for frequently used query patterns
3. **Check history** to find previous queries
4. **Format queries** for better readability

### Debugging Queries

1. **Start simple** and build complexity gradually
2. **Check error messages** for specific issues
3. **Use the optimizer** to identify performance problems
4. **Test with LIMIT 1** before running on full dataset

## Next Steps

- [Browse Schema Details](/features/schema-browser) - Explore your database structure
- [Edit Data Inline](/features/data-editing) - Make changes directly in the data grid
- [View ER Diagrams](/features/er-diagram) - Visualize table relationships
- [Learn All Shortcuts](/shortcuts) - Master keyboard navigation

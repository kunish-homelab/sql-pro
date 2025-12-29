# Your First Database Connection

This guide walks you through opening your first database in SQL Pro, understanding the interface, and running your first SQL query.

## Opening SQL Pro

After [installing SQL Pro](/getting-started/installation), launch the application:

- **macOS**: Open from Applications folder or Spotlight search
- **Windows**: Start menu or desktop shortcut
- **Linux**: Application menu or run `sql-pro` from terminal

You'll see the welcome screen:

![SQL Pro Welcome Screen - showing the main interface with Open Database button](/screenshots/welcome-dark.png)

## Opening a Database

SQL Pro supports both regular SQLite databases and encrypted SQLCipher databases.

### Opening an Existing Database

1. Click **Open Database** on the welcome screen, or use the keyboard shortcut <kbd>Cmd/Ctrl</kbd> + <kbd>O</kbd>

2. Navigate to your SQLite database file (`.db`, `.sqlite`, `.sqlite3`, or `.db3` extensions)

3. Click **Open**

::: tip Creating a Test Database
If you don't have a database to test with, you can create one. Open a terminal and run:
```bash
sqlite3 test.db "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT); INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com'), ('Bob', 'bob@example.com');"
```
This creates a simple database with a `users` table.
:::

### Opening an Encrypted Database (SQLCipher)

If your database is encrypted with SQLCipher:

1. Click **Open Database** and select the encrypted file

2. SQL Pro will detect it's encrypted and prompt for the password

3. Enter your password in the dialog

4. Optionally check **Remember password** to store it securely in your system keychain

::: info Secure Password Storage
SQL Pro uses your operating system's secure keychain (macOS Keychain, Windows Credential Manager, or Linux Secret Service) to store passwords. Your passwords are never stored in plain text.
:::

## Understanding the Interface

Once your database is open, you'll see the main workspace:

![SQL Pro Database View - showing the schema browser, data grid, and query editor](/screenshots/database-dark.png)

### Main Areas

| Area | Description |
|------|-------------|
| **Sidebar** | Browse tables, views, and indexes in your database |
| **Data Grid** | View and edit data from the selected table |
| **Query Editor** | Write and execute SQL queries |
| **Status Bar** | Shows connection status and current operation |

### Sidebar Navigation

The sidebar shows your database schema organized by type:

![Sidebar showing tables list](/screenshots/07-sidebar-tables-dark.png)

- **Tables** - All user tables in your database
- **Views** - Saved SQL queries that act as virtual tables
- **Indexes** - Performance indexes on your tables

Click any table name to view its data in the data grid.

## Viewing Table Data

Click on a table in the sidebar to view its contents:

![Table view showing data grid with rows and columns](/screenshots/table-dark.png)

### Data Grid Features

- **Sortable columns** - Click column headers to sort
- **Resizable columns** - Drag column borders to resize
- **Scrollable** - Navigate large datasets with smooth scrolling
- **Row numbers** - Track your position in the data

### Filtering Data

Use the filter bar above the data grid to search and filter:

1. Click the filter icon or press <kbd>Cmd/Ctrl</kbd> + <kbd>F</kbd>
2. Type your search term
3. Results filter in real-time as you type

::: tip Power Filtering
The filter supports searching across all columns. For column-specific filtering, prefix your search with the column name: `name:Alice`
:::

## Running Your First Query

The query editor lets you write and execute custom SQL queries.

### Opening the Query Editor

1. Click the **Query** tab in the main area, or
2. Press <kbd>Cmd/Ctrl</kbd> + <kbd>E</kbd> to focus the editor

### Writing a Query

The editor provides:

- **Syntax highlighting** - SQL keywords, strings, and numbers are color-coded
- **Autocomplete** - Table and column names suggest as you type
- **Line numbers** - Easily reference specific lines

Try this simple query:

```sql
SELECT * FROM users LIMIT 10;
```

### Executing the Query

Execute your query in one of these ways:

1. Click the **Run** button (▶️)
2. Press <kbd>Cmd/Ctrl</kbd> + <kbd>Enter</kbd>

![Query Editor showing a SELECT query with results](/screenshots/query-dark.png)

### Reading Results

Query results appear below the editor:

- **Row count** - Total rows returned
- **Execution time** - How long the query took
- **Data grid** - Full results with sorting and filtering

::: warning Large Result Sets
For queries returning many rows, results are paginated. Use `LIMIT` in your queries to control result size for better performance.
:::

## Working with Multiple Queries

You can write multiple queries in the editor:

```sql
-- Get all users
SELECT * FROM users;

-- Get user count
SELECT COUNT(*) as total_users FROM users;
```

To execute a specific query:
- Place your cursor anywhere in the query
- Press <kbd>Cmd/Ctrl</kbd> + <kbd>Enter</kbd>

SQL Pro executes the query under your cursor.

## Quick Reference: Essential Shortcuts

| Action | macOS | Windows/Linux |
|--------|-------|---------------|
| Open database | <kbd>Cmd</kbd> + <kbd>O</kbd> | <kbd>Ctrl</kbd> + <kbd>O</kbd> |
| Execute query | <kbd>Cmd</kbd> + <kbd>Enter</kbd> | <kbd>Ctrl</kbd> + <kbd>Enter</kbd> |
| Command palette | <kbd>Cmd</kbd> + <kbd>K</kbd> | <kbd>Ctrl</kbd> + <kbd>K</kbd> |
| Focus query editor | <kbd>Cmd</kbd> + <kbd>E</kbd> | <kbd>Ctrl</kbd> + <kbd>E</kbd> |
| Focus sidebar | <kbd>Cmd</kbd> + <kbd>1</kbd> | <kbd>Ctrl</kbd> + <kbd>1</kbd> |
| Focus data grid | <kbd>Cmd</kbd> + <kbd>2</kbd> | <kbd>Ctrl</kbd> + <kbd>2</kbd> |

See the complete [Keyboard Shortcuts](/shortcuts) reference for all available shortcuts.

## Recent Connections

SQL Pro remembers your recently opened databases. Access them from:

- The welcome screen's **Recent** list
- **File** > **Recent Databases** menu
- Command palette (<kbd>Cmd/Ctrl</kbd> + <kbd>K</kbd>) and search for the database name

## Troubleshooting Connection Issues

### Database Won't Open

**Symptoms**: Error message when opening a file

**Solutions**:
1. Verify the file is a valid SQLite database
2. Check file permissions - you need read access
3. Ensure the file isn't locked by another application

### Encrypted Database Errors

**Symptoms**: "Database is encrypted" or wrong password errors

**Solutions**:
1. Verify you're using the correct password
2. Ensure the database was created with SQLCipher (not another encryption)
3. Try the "Forget saved password" option if using stored credentials

For more solutions, see the [Troubleshooting Guide](/troubleshooting).

## Next Steps

Now that you've connected to your first database:

- [Explore the Query Editor](/features/query-editor) - Learn about autocomplete, Vim mode, and more
- [Browse Schema Details](/features/schema-browser) - Understand your database structure
- [Edit Data Inline](/features/data-editing) - Make changes directly in the data grid
- [View ER Diagrams](/features/er-diagram) - Visualize table relationships
- [Learn All Shortcuts](/shortcuts) - Master the keyboard for faster workflows

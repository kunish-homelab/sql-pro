# Query History & Templates

SQL Pro maintains a complete history of all executed queries for each database and provides reusable query templates to speed up your workflow. These features help you track your work, reuse past queries, and quickly insert common SQL patterns.

![Query Editor with History panel](/screenshots/query-dark.png)

## Key Features

| Feature | Description |
|---------|-------------|
| **Persistent History** | Query history saved per database, persists across sessions |
| **Search & Filter** | Find past queries with instant search |
| **Status Indicators** | Visual feedback for successful and failed queries |
| **Execution Time** | See how long each query took to execute |
| **Click to Reuse** | Load any past query into the editor with one click |
| **Built-in Templates** | 25+ pre-built templates for common SQL operations |
| **Custom Templates** | Create and save your own reusable query templates |
| **Template Categories** | Organize templates by type (SELECT, INSERT, UPDATE, etc.) |

## Query History

SQL Pro automatically tracks every query you execute, organized by database. This makes it easy to revisit past work, rerun queries, and learn from previous errors.

### Accessing Query History

Open the Query History panel using one of these methods:

1. **Click the History button** in the Query Editor toolbar
2. **Keyboard shortcut** - Press <kbd>Cmd/Ctrl</kbd> + <kbd>H</kbd>

The History panel slides in from the right side of the editor.

### History Panel Features

The Query History panel displays:

- **Search box** - Filter history by query text
- **Clear all button** - Remove entire history (with confirmation)
- **Scrollable list** - All past queries in reverse chronological order

Each history entry shows:

- **Execution status** - Green duration for success, red "Failed" for errors
- **Timestamp** - When the query was executed
- **Query preview** - First few lines of the query text
- **Delete button** - Remove individual entries (appears on hover)

```
┌─────────────────────────────────────┐
│  Query History                    X │
├─────────────────────────────────────┤
│  🔍 Search history...               │
├─────────────────────────────────────┤
│  234ms         10:45:32 AM          │
│  SELECT * FROM users WHERE...     X │
├─────────────────────────────────────┤
│  Failed        10:44:18 AM          │
│  SELECT * FROM nonexistent...     X │
├─────────────────────────────────────┤
│  1.2s          10:43:05 AM          │
│  INSERT INTO orders VALUES...     X │
└─────────────────────────────────────┘
```

### Using History Entries

To reuse a query from history:

1. Open the History panel
2. Click on any history entry
3. The query loads into the editor
4. The History panel closes automatically

This workflow lets you quickly revisit and modify past queries.

### Searching History

Use the search box to filter history entries:

1. Type any part of a query into the search box
2. History instantly filters to matching entries
3. Search is case-insensitive
4. Clear the search to see all history again

::: tip Search Tips
Search matches any text within the query, including:
- Table names (`users`, `orders`)
- SQL keywords (`SELECT`, `WHERE`)
- Column names (`email`, `created_at`)
- Values (`'active'`, `2024`)
:::

### Managing History

#### Delete Individual Entries

To remove a single history entry:

1. Hover over the entry in the History panel
2. Click the X button that appears
3. The entry is removed immediately

#### Clear All History

To remove all history for the current database:

1. Click the trash icon (🗑️) in the History panel header
2. Confirm the action in the dialog
3. All history entries are removed

::: warning Permanent Action
Clearing history cannot be undone. History is deleted from disk permanently.
:::

### History Storage

Query history is stored:

- **Per database** - Each database file has its own history
- **On disk** - History persists between sessions
- **Limited size** - Last 100 queries are kept per database

When you switch databases, SQL Pro automatically loads the history for that database.

### History Entry Details

Each history entry captures:

| Field | Description |
|-------|-------------|
| `queryText` | The full SQL query text |
| `executedAt` | Timestamp when the query ran |
| `durationMs` | Execution time in milliseconds |
| `success` | Whether the query succeeded or failed |
| `error` | Error message (for failed queries) |

## Query Templates

Query Templates provide reusable SQL patterns that you can quickly insert into the editor. SQL Pro includes built-in templates for common operations and lets you create your own custom templates.

### Opening Templates

Access templates using:

1. Click the **Templates** button in the Query Editor toolbar
2. The Templates dialog opens

### Templates Dialog

The Templates dialog provides:

- **Search box** - Filter templates by name, description, or query content
- **Category dropdown** - Filter by template category
- **New Template button** - Create a custom template
- **Template grid** - Browse available templates

### Built-in Templates

SQL Pro includes 25+ built-in templates organized by category:

#### SELECT Templates

| Template | Description |
|----------|-------------|
| Select All | `SELECT * FROM table_name;` |
| Select Specific Columns | Select with WHERE clause |
| Inner Join | Join two tables on a common column |
| Left Join | Left join two tables |
| Group By with Count | Group rows and count occurrences |
| Subquery Example | SELECT with subquery in WHERE |

#### INSERT Templates

| Template | Description |
|----------|-------------|
| Insert Single Row | Insert one row with values |
| Insert Multiple Rows | Insert multiple rows at once |
| Insert from Select | Copy data from another table |

#### UPDATE Templates

| Template | Description |
|----------|-------------|
| Update Single Column | Update one column with WHERE |
| Update Multiple Columns | Update multiple columns at once |

#### DELETE Templates

| Template | Description |
|----------|-------------|
| Delete with Condition | Delete rows matching criteria |
| Delete All Rows | Remove all data (use with caution!) |

#### Schema Templates

| Template | Description |
|----------|-------------|
| Create Table | Create table with common columns |
| Create Index | Create an index on a column |
| Add Column | ALTER TABLE to add column |
| Drop Table | Delete a table safely |

#### Analysis Templates

| Template | Description |
|----------|-------------|
| Count Rows | Get total row count |
| Distinct Values | Find unique values with counts |
| Count NULL Values | Analyze NULL vs non-NULL |
| Top N Records | Get top N by a column |
| Date Range Query | Query within date range |

#### Maintenance Templates

| Template | Description |
|----------|-------------|
| Vacuum Database | Reclaim unused space |
| Analyze Database | Update query optimizer stats |
| Integrity Check | Check database integrity |
| Table Info | Get column information |
| List Foreign Keys | Show foreign key relationships |
| List Indexes | Show all indexes for a table |
| Explain Query Plan | Analyze query execution |

### Using Templates

To insert a template:

1. Open the Templates dialog
2. Browse or search for a template
3. Click on the template card
4. The query is inserted into the editor
5. The dialog closes automatically
6. Modify the placeholder values (like `table_name`)

### Template Categories

Filter templates by category using the dropdown:

| Category | Color | Description |
|----------|-------|-------------|
| All Templates | Gray | Show all templates |
| SELECT | Blue | Read queries |
| INSERT | Green | Add data |
| UPDATE | Amber | Modify data |
| DELETE | Red | Remove data |
| Schema | Purple | Structure changes |
| Analysis | Cyan | Data analysis |
| Maintenance | Gray | Database maintenance |
| Custom | Pink | Your templates |

### Creating Custom Templates

Create your own reusable templates:

1. Click **New Template** in the Templates dialog
2. Fill in the template details:
   - **Name** - A descriptive name
   - **Description** - What the query does
   - **Category** - Choose from available categories
   - **SQL Query** - The template query text
3. Click **Create Template**

Example custom template:

```
Name: Find Inactive Users
Description: Users who haven't logged in for 30 days
Category: Analysis
Query:
SELECT id, name, email, last_login
FROM users
WHERE last_login < datetime('now', '-30 days')
ORDER BY last_login ASC;
```

::: tip Template Variables
Use placeholder names like `table_name`, `column_name`, or `condition` in your templates. You'll replace these each time you use the template.
:::

### Managing Custom Templates

#### Duplicate Templates

Create a copy of any template (built-in or custom):

1. Hover over a template card
2. Click the **Copy** icon
3. A new template is created with "(Copy)" appended to the name
4. Edit the copy as needed

#### Delete Templates

Remove custom templates you no longer need:

1. Hover over a custom template card
2. Click the **Trash** icon
3. The template is removed immediately

::: info Built-in Templates Protected
Built-in templates cannot be deleted. They can only be duplicated.
:::

#### Reset to Defaults

To restore all built-in templates and remove custom templates:

1. Open your browser's developer tools
2. Clear the `sql-pro-query-templates` key from localStorage
3. Refresh the page

### Template Storage

Templates are stored:

- **In browser localStorage** - Persists across sessions
- **Key name** - `sql-pro-query-templates`
- **Custom only** - Only custom templates are saved (built-in templates are always available)

## Keyboard Shortcuts

| Action | macOS | Windows/Linux |
|--------|-------|---------------|
| Toggle History panel | <kbd>Cmd</kbd> + <kbd>H</kbd> | <kbd>Ctrl</kbd> + <kbd>H</kbd> |
| Execute query | <kbd>Cmd</kbd> + <kbd>Enter</kbd> | <kbd>Ctrl</kbd> + <kbd>Enter</kbd> |

## Tips and Best Practices

### Effective History Usage

1. **Search before writing** - Check history before writing a query from scratch
2. **Learn from failures** - Failed queries in history help you avoid repeated mistakes
3. **Use as reference** - History shows your working queries for similar future tasks
4. **Review execution times** - Identify slow queries that might need optimization

### Template Best Practices

1. **Create templates for repeated patterns** - If you write similar queries often, make a template
2. **Use descriptive names** - "Get User Orders" is better than "Query 1"
3. **Add helpful descriptions** - Future you will thank present you
4. **Choose appropriate categories** - Makes templates easier to find
5. **Duplicate and modify** - Start from built-in templates for common patterns

### Workflow Integration

**For Data Exploration:**
1. Use built-in SELECT templates to start exploring
2. Modify and run queries
3. Check history to see what you've tried
4. Save useful queries as custom templates

**For Data Entry:**
1. Use INSERT templates as starting points
2. Run successful inserts
3. History keeps track of your insertions
4. Create templates for repeated data entry patterns

**For Maintenance:**
1. Use maintenance templates for common operations
2. Run VACUUM, ANALYZE, or integrity checks
3. History records when maintenance was performed

## Troubleshooting

### History Not Showing

If query history isn't appearing:

1. **Check database connection** - History is per-database, ensure you're connected
2. **Wait for load** - History loads asynchronously when you switch databases
3. **Check storage permissions** - Browser storage must be available

### Templates Not Persisting

If custom templates disappear:

1. **Check browser storage** - Ensure localStorage isn't being cleared
2. **Incognito mode** - Templates won't persist in private browsing
3. **Storage quota** - Clear old data if storage is full

### Search Not Finding Queries

If search doesn't find expected results:

1. **Check spelling** - Search is literal, typos won't match
2. **Use partial text** - Search matches any part of the query
3. **Case doesn't matter** - Search is case-insensitive

## Next Steps

- [Write SQL Queries](/features/query-editor) - Master the query editor
- [Browse Schema Details](/features/schema-browser) - Explore database structure
- [Edit Data Inline](/features/data-editing) - Modify data directly
- [Learn All Shortcuts](/shortcuts) - Keyboard navigation reference

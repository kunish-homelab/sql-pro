# Schema Browser

The Schema Browser provides a comprehensive view of your database structure, allowing you to explore tables, views, triggers, and all their associated metadata. Combined with the sidebar navigation, it offers an intuitive way to understand and navigate your database schema.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="/screenshots/database-dark.png">
  <source media="(prefers-color-scheme: light)" srcset="/screenshots/database.png">
  <img alt="SQL Pro Schema Browser showing database tables in the sidebar and schema details panel" src="/screenshots/database-dark.png">
</picture>

## Key Features

| Feature                  | Description                                                           |
| ------------------------ | --------------------------------------------------------------------- |
| **Schema Tree**          | Hierarchical view of all tables, views, and triggers in your database |
| **Quick Search**         | Filter tables and views instantly by name                             |
| **Row Counts**           | See the number of rows in each table at a glance                      |
| **Schema Details Panel** | View columns, indexes, foreign keys, and triggers for any table       |
| **CREATE Statements**    | Access the original SQL used to create tables and indexes             |
| **Multi-Schema Support** | Navigate databases with multiple schemas easily                       |
| **Vim Navigation**       | Full keyboard navigation with Vim keybindings                         |

## Sidebar Navigation

The sidebar on the left side of SQL Pro displays your database schema in a tree structure.

### Schema Tree Structure

The schema tree organizes your database objects by type:

- **Tables** - All table objects with their row counts
- **Views** - Database views (shown with an eye icon)
- **Triggers** - Database triggers organized by their timing and event type

Each section can be expanded or collapsed by clicking the chevron icon or the section header.

### Visual Indicators

- **Table icon** - Standard database tables
- **Eye icon** - Database views
- **Lightning bolt icon** - Database triggers
- **Row count** - Number displayed next to each table shows total row count

### Searching Tables

Use the search box at the top of the sidebar to quickly find tables and views:

1. Click the search box or press <kbd>/</kbd> (with Vim mode enabled)
2. Type any part of the table name
3. Results filter in real-time as you type

::: tip Case-Insensitive Search
Search is case-insensitive, so typing "user" will match "Users", "user_roles", and "USER_SETTINGS".
:::

### Selecting a Table

Click on any table or view to:

1. Load its data in the Data Browser tab
2. Enable the Schema Details panel
3. See the table structure in the ER Diagram

## Schema Details Panel

The Schema Details Panel provides comprehensive information about any selected table or view.

### Opening the Panel

There are several ways to open the Schema Details Panel:

1. **Click the Schema button** - In the tab bar, click the **Schema** button (ℹ️ icon)
2. **Keyboard shortcut** - Press <kbd>Cmd/Ctrl</kbd> + <kbd>4</kbd>

The panel appears on the right side of the workspace and can be resized by dragging its left edge.

### Panel Sections

The Schema Details Panel contains collapsible sections for each type of metadata:

#### Columns

Displays all columns in the table with:

| Property     | Description                                 |
| ------------ | ------------------------------------------- |
| **Name**     | The column name                             |
| **Type**     | Data type (INTEGER, TEXT, REAL, BLOB, etc.) |
| **Nullable** | Whether the column accepts NULL values      |
| **Default**  | Default value if any is defined             |
| **Key**      | Shows "PK" badge for primary key columns    |

```sql
-- Example: Viewing columns helps understand table structure
-- for writing queries
SELECT
    id,         -- INTEGER, PK
    name,       -- TEXT, NOT NULL
    email,      -- TEXT
    created_at  -- DATETIME, DEFAULT CURRENT_TIMESTAMP
FROM users;
```

#### Indexes

Lists all indexes on the table:

- **Index name** - The identifier for the index
- **Unique badge** - Shown for unique indexes
- **Columns** - Which columns are included in the index
- **SQL** - The CREATE INDEX statement

Understanding indexes helps optimize your queries. If a query filters or joins on columns that aren't indexed, consider creating an index.

#### Foreign Keys

Shows relationships to other tables:

- **Local column** - The column in the current table
- **Referenced table.column** - The table and column it references
- **ON DELETE** - Action when referenced row is deleted (CASCADE, SET NULL, RESTRICT, etc.)
- **ON UPDATE** - Action when referenced row is updated

```sql
-- Example: foreign key relationship
-- orders.user_id → users.id
-- ON DELETE CASCADE means deleting a user deletes their orders
```

::: info Understanding Relationships
Foreign keys are essential for understanding how tables relate to each other. Use this information when writing JOIN queries or when planning data modifications.
:::

#### Triggers

Displays database triggers associated with the table:

- **Trigger name** - The identifier
- **Timing badge** - BEFORE or AFTER
- **Event badge** - INSERT, UPDATE, or DELETE
- **SQL** - The complete trigger definition

Triggers can affect your data operations. Knowing what triggers exist helps you understand what happens automatically when data changes.

#### CREATE Statement

The original SQL statement used to create the table or view. This is useful for:

- Understanding the exact table definition
- Copying the structure for creating similar tables
- Reviewing constraints and defaults
- Documentation purposes

::: tip Copy CREATE Statement
You can select and copy the CREATE statement text to use it in your own scripts or to recreate the table in another database.
:::

### Expanding and Collapsing Sections

Each section in the Schema Details Panel can be expanded or collapsed:

1. **Click the section header** to toggle
2. **Chevron indicator** - Points down when expanded, right when collapsed
3. **Count badge** - Shows number of items in each section

By default, all sections start expanded to give you a complete overview.

## Multi-Schema Databases

SQL Pro supports databases with multiple schemas (common when using attached databases).

### Schema Headers

When your database has multiple schemas:

- Each schema appears as a top-level item with a database icon
- Click the schema header to expand/collapse all objects in that schema
- Schemas with no tables or views are hidden from the display

### Navigating Schemas

1. Expand the schema you want to explore
2. Expand the Tables or Views section within that schema
3. Select a table to view its data and details

## Vim Mode Navigation

With Vim mode enabled, you can navigate the schema tree entirely with the keyboard.

### Navigation Commands

| Key                              | Action                         |
| -------------------------------- | ------------------------------ |
| <kbd>j</kbd>                     | Move down to next item         |
| <kbd>k</kbd>                     | Move up to previous item       |
| <kbd>g</kbd><kbd>g</kbd>         | Jump to first item             |
| <kbd>G</kbd>                     | Jump to last item              |
| <kbd>Enter</kbd> or <kbd>l</kbd> | Select focused item            |
| <kbd>Space</kbd>                 | Toggle expand/collapse section |
| <kbd>/</kbd>                     | Focus search box               |
| <kbd>Esc</kbd>                   | Clear search and unfocus       |

::: tip Enabling Vim Mode
Enable App Vim Mode in Settings (<kbd>Cmd/Ctrl</kbd> + <kbd>,</kbd>) to use these keyboard shortcuts in the sidebar.
:::

### Visual Focus Indicator

When using Vim navigation:

- Focused item has a ring indicator
- Selected item has a highlighted background
- Both indicators can appear on the same item

## Keyboard Shortcuts

| Action                   | macOS                         | Windows/Linux                  |
| ------------------------ | ----------------------------- | ------------------------------ |
| Toggle Schema Panel      | <kbd>Cmd</kbd> + <kbd>4</kbd> | <kbd>Ctrl</kbd> + <kbd>4</kbd> |
| Open Settings            | <kbd>Cmd</kbd> + <kbd>,</kbd> | <kbd>Ctrl</kbd> + <kbd>,</kbd> |
| Focus Search (Vim mode)  | <kbd>/</kbd>                  | <kbd>/</kbd>                   |
| Navigate Down (Vim mode) | <kbd>j</kbd>                  | <kbd>j</kbd>                   |
| Navigate Up (Vim mode)   | <kbd>k</kbd>                  | <kbd>k</kbd>                   |

## Tips and Best Practices

### Understanding Your Database

1. **Start with the schema tree** - Get an overview of all tables in your database
2. **Check row counts** - Identify large tables that may need pagination
3. **Review foreign keys** - Understand table relationships before writing queries
4. **Study indexes** - Know what's indexed to write efficient queries

### Efficient Navigation

1. **Use search** for large databases with many tables
2. **Collapse sections** you don't need to reduce visual clutter
3. **Enable Vim mode** for keyboard-first navigation
4. **Use Cmd+4** to quickly toggle the details panel

### Working with Schemas

1. **Review column types** before writing INSERT statements
2. **Check nullable columns** to avoid constraint violations
3. **Copy CREATE statements** for documentation or migrations
4. **Understand triggers** to know what automated actions occur

### Common Workflows

**Before writing a query:**

1. Select the table you want to query
2. Open Schema Details (<kbd>Cmd/Ctrl</kbd> + <kbd>4</kbd>)
3. Review column names and types
4. Check indexes for columns you'll filter on

**Exploring relationships:**

1. Select a table with foreign keys
2. View the Foreign Keys section
3. Click on referenced tables to explore the relationship chain

## Troubleshooting

### Schema Not Loading

If the schema tree shows "Loading schema..." indefinitely:

1. Check your database connection is still active
2. Try disconnecting and reconnecting
3. For large databases, schema loading may take longer

### Missing Tables

If expected tables don't appear:

1. Check the search box isn't filtering them out
2. Verify the table exists in the database
3. Ensure the table is in an expanded schema section

### Schema Details Panel Empty

If you select a table but see "Select a table or view to see details":

1. Confirm a table is actually selected (highlighted in sidebar)
2. Try clicking the table again
3. Check for any connection errors

## Next Steps

- [Write SQL Queries](/features/query-editor) - Use schema information to write better queries
- [Edit Data Inline](/features/data-editing) - Make changes directly in the data grid
- [View ER Diagrams](/features/er-diagram) - Visualize table relationships graphically
- [Learn All Shortcuts](/shortcuts) - Master keyboard navigation

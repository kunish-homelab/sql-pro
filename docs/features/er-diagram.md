# ER Diagram

The ER (Entity-Relationship) Diagram provides an interactive visual representation of your database schema, showing all tables, views, and their relationships. Built on React Flow, it offers a powerful way to explore and understand your database structure at a glance.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="/screenshots/database-dark.png">
  <source media="(prefers-color-scheme: light)" srcset="/screenshots/database.png">
  <img alt="SQL Pro ER Diagram showing database tables, columns, and foreign key relationships" src="/screenshots/database-dark.png">
</picture>

## Key Features

| Feature                    | Description                                                 |
| -------------------------- | ----------------------------------------------------------- |
| **Interactive Canvas**     | Pan, zoom, and navigate the diagram freely                  |
| **Table Nodes**            | Visual cards showing table structure with columns and types |
| **Relationship Lines**     | Bezier curves connecting foreign keys to referenced tables  |
| **Cardinality Indicators** | Clear 1:1, 1:N notation on relationships                    |
| **Drag & Drop**            | Rearrange tables to create your preferred layout            |
| **Auto Layout**            | Automatic positioning using the dagre layout algorithm      |
| **Position Persistence**   | Your custom layout is saved per database                    |
| **Export Options**         | Download diagrams as PNG or SVG images                      |
| **Mini Map**               | Overview navigation for large schemas                       |
| **Theme Support**          | Seamless light and dark mode integration                    |

## Accessing the ER Diagram

To view the ER Diagram for your database:

1. Connect to a SQLite database
2. Click the **Diagram** tab in the main content area

The diagram automatically loads showing all tables and views in your database with their relationships.

::: tip Quick Navigation
Click on any table node in the diagram to navigate to that table's data in the Data Browser.
:::

## Understanding the Diagram

### Table Nodes

Each table in your database is represented as a card showing:

- **Header** - Table name with an icon (table icon for tables, eye icon for views)
- **Columns** - All columns with their data types
- **Key indicators** - Visual badges for primary keys and foreign keys

#### Column Indicators

| Icon                 | Meaning             |
| -------------------- | ------------------- |
| 🔑 (Key icon, amber) | Primary Key column  |
| 🔗 (Link icon, blue) | Foreign Key column  |
| Underlined name      | NOT NULL constraint |

```
┌─────────────────────┐
│ 📋 users            │  ← Table name with icon
├─────────────────────┤
│ 🔑   id      INTEGER│  ← Primary key (amber)
│      name    TEXT   │  ← Regular column
│      email   TEXT   │  ← Underline = NOT NULL
│ 🔗   role_id INTEGER│  ← Foreign key (blue)
└─────────────────────┘
```

### Relationship Lines

Foreign key relationships are displayed as curved lines (Bezier curves) connecting tables:

- **Source** - The table containing the foreign key
- **Target** - The referenced table (usually via its primary key)
- **Cardinality label** - Shows the relationship type

### Cardinality Notation

Relationship cardinality is shown on each connection line:

| Notation | Meaning                                |
| -------- | -------------------------------------- |
| **1:1**  | One-to-one relationship                |
| **1:N**  | One-to-many relationship (most common) |
| **N:1**  | Many-to-one relationship               |
| **M:N**  | Many-to-many relationship              |

SQL Pro automatically detects cardinality based on your schema:

- **1:1** - Foreign key column is also a primary key or has a unique constraint
- **1:N** - Standard foreign key relationship (default)

::: info Cardinality Detection
Cardinality is determined by analyzing indexes and constraints. A foreign key column with a unique index indicates a 1:1 relationship; otherwise, it's assumed to be 1:N.
:::

## Interactive Features

### Pan and Zoom

Navigate the diagram using:

- **Mouse drag** - Click and drag on the background to pan
- **Scroll wheel** - Zoom in and out
- **Pinch gesture** - Zoom on trackpad (two-finger pinch)
- **Zoom range** - From 10% to 200% for flexibility

### Selecting Nodes

- **Click** on a table to select it (highlighted with a ring)
- **Click** again to navigate to that table's data
- **Click background** to deselect

### Moving Tables

Customize your diagram layout:

1. **Click and hold** on a table node header
2. **Drag** to your desired position
3. **Release** to place the table

Your custom positions are automatically saved and restored when you reopen the database.

### Mini Map

The mini map in the bottom-right corner provides:

- **Overview** - See your entire diagram at a glance
- **Navigation** - Click and drag in the mini map to pan
- **Zoom** - Scroll within the mini map to zoom

The mini map is especially useful for large databases with many tables.

## Toolbar Controls

The ER Diagram toolbar in the top-right corner provides quick actions:

### Fit to View

Click the **Maximize** button (⛶) to:

- Automatically zoom and pan to show all tables
- Center the diagram in the viewport
- Apply smooth animation to the transition

### Reset Layout

Click the **Layout Grid** button (⊞) to:

- Reset all table positions to automatic layout
- Apply the dagre algorithm for optimal arrangement
- Clear any custom positioning you've made

::: warning Reset Warning
Resetting the layout will discard your custom table positions. This action cannot be undone.
:::

### Export Diagram

Click the **Export** dropdown to save your diagram:

#### Export as PNG

- High-resolution image (2x pixel ratio)
- Includes current theme colors
- Perfect for documentation and presentations
- File named `er-diagram-{timestamp}.png`

#### Export as SVG

- Vector format for scalability
- Maintains quality at any size
- Ideal for print or further editing
- File named `er-diagram-{timestamp}.svg`

Both formats:

- Use your current theme (light or dark background)
- Exclude the mini map and controls
- Capture the full diagram content

## Automatic Layout

When you first open a database or reset the layout, SQL Pro applies an automatic layout algorithm:

### Layout Algorithm

The dagre library arranges tables using these principles:

- **Left-to-right flow** - Referenced tables appear to the left of referencing tables
- **Hierarchy awareness** - Tables are ranked based on relationships
- **Spacing** - Consistent gaps between nodes (60px horizontal, 100px vertical)
- **Margins** - Padding around the diagram edges

### Node Sizing

Table nodes are sized dynamically:

- **Width** - Fixed at 220px for consistency
- **Height** - Calculated based on column count (24px per column + 40px header)
- **Minimum height** - 80px even for tables with few columns

## State Persistence

SQL Pro remembers your diagram preferences per database:

### What's Saved

- **Node positions** - Custom table placements
- **Viewport state** - Pan position and zoom level

### Storage

- Persisted to localStorage
- Keyed by database file path
- Survives browser refreshes and app restarts

### Multiple Databases

Each database maintains its own diagram state. Switching between databases restores each one's custom layout.

## Theme Support

The ER Diagram automatically matches your system theme:

### Light Mode

- White background with subtle grid
- Dark text and borders on table nodes
- High contrast for readability

### Dark Mode

- Dark zinc background
- Light text with subtle borders
- Blue accents for views and foreign keys
- Amber accents for primary keys

Theme changes apply immediately without losing your diagram state.

## Working with Large Schemas

For databases with many tables:

### Navigation Tips

1. **Use the mini map** to orient yourself
2. **Fit to view** to see everything, then zoom in
3. **Search in sidebar** to find a specific table
4. **Click table** in sidebar to highlight in diagram

### Performance

The ER Diagram handles large schemas efficiently:

- Nodes render on-demand as they enter the viewport
- Memoized components prevent unnecessary re-renders
- Smooth 60fps interactions even with 50+ tables

### Organizing Your Layout

1. **Group related tables** together by dragging
2. **Arrange by domain** (users, orders, products, etc.)
3. **Position hub tables** centrally (tables with many relationships)
4. **Use vertical space** for long relationship chains

## Tips and Best Practices

### Understanding Your Schema

1. **Start with an overview** - Fit to view to see all tables
2. **Identify hub tables** - Look for tables with many connections
3. **Follow relationships** - Trace foreign keys to understand data flow
4. **Check cardinality** - Understand one-to-many vs one-to-one patterns

### Creating Documentation

1. **Organize layout** - Arrange tables logically before exporting
2. **Use consistent positioning** - Related tables should be near each other
3. **Export as SVG** for editable diagrams in design tools
4. **Export as PNG** for quick sharing and documentation

### Workflow Integration

1. **Review before writing queries** - Visualize JOINs needed
2. **Validate foreign keys** - Ensure relationships are correctly defined
3. **Plan migrations** - See impact of schema changes visually
4. **Onboard team members** - Share diagrams for database orientation

## Keyboard Shortcuts

| Action                | macOS                                                | Windows/Linux                                           |
| --------------------- | ---------------------------------------------------- | ------------------------------------------------------- |
| Switch to Diagram tab | Click "Diagram"                                      | Click "Diagram"                                         |
| Zoom in               | <kbd>Scroll Up</kbd> / <kbd>⌘</kbd> + <kbd>+</kbd>   | <kbd>Scroll Up</kbd> / <kbd>Ctrl</kbd> + <kbd>+</kbd>   |
| Zoom out              | <kbd>Scroll Down</kbd> / <kbd>⌘</kbd> + <kbd>-</kbd> | <kbd>Scroll Down</kbd> / <kbd>Ctrl</kbd> + <kbd>-</kbd> |
| Pan                   | <kbd>Click + Drag</kbd>                              | <kbd>Click + Drag</kbd>                                 |
| Select table          | <kbd>Click</kbd>                                     | <kbd>Click</kbd>                                        |
| Move table            | <kbd>Drag</kbd>                                      | <kbd>Drag</kbd>                                         |

## Troubleshooting

### Diagram Not Loading

If the diagram shows "No schema loaded":

1. Verify you're connected to a database
2. Check the connection is still active
3. Try disconnecting and reconnecting

### No Tables Displayed

If the diagram shows "No tables in database":

1. The database may be empty
2. Check if tables exist in the Schema Browser
3. Ensure the database file is valid

### Layout Looks Wrong

If tables are overlapping or poorly positioned:

1. Click **Reset Layout** to apply automatic positioning
2. Drag tables manually to your preferred positions
3. Positions are saved automatically

### Export Not Working

If export fails:

1. Ensure the diagram has fully loaded
2. Try a different export format (PNG vs SVG)
3. Check browser console for specific errors
4. Refresh and try again

### Custom Positions Not Saving

If your layout resets unexpectedly:

1. Verify localStorage is not disabled or full
2. Check for browser privacy settings blocking storage
3. Positions are keyed by file path - renamed databases won't retain positions

### Performance Issues

For slow diagram interactions:

1. Close other browser tabs
2. Try zooming out to reduce visible nodes
3. Reset layout if positions are corrupted
4. Consider using a database with fewer tables for complex exploration

## Next Steps

- [Browse Schema Details](/features/schema-browser) - See detailed column and index information
- [Write SQL Queries](/features/query-editor) - Use relationships to write JOIN queries
- [Edit Data Inline](/features/data-editing) - Modify data in related tables
- [Learn All Shortcuts](/shortcuts) - Master keyboard navigation

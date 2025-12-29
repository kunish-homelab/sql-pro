# Data Editing

SQL Pro provides powerful inline data editing capabilities, allowing you to modify your database directly from the data grid. All changes are tracked with a visual diff preview, validated before applying, and can be undone at any time.

![Data grid with inline editing](/screenshots/table-dark.png)

## Key Features

| Feature | Description |
|---------|-------------|
| **Inline Editing** | Edit cell values directly by double-clicking |
| **Diff Preview Panel** | Review all pending changes before applying |
| **Insert Rows** | Add new rows with smart default values |
| **Delete Rows** | Mark rows for deletion with visual strikethrough |
| **Validation** | Automatic validation of changes against schema constraints |
| **Undo Support** | Undo individual changes or all changes at once |
| **Keyboard Navigation** | Navigate and edit using Tab, Enter, and arrow keys |
| **Copy & Paste** | Standard clipboard operations for cell values |

## Editing Cells

### Starting an Edit

There are several ways to edit a cell:

1. **Double-click** on any cell to start editing
2. **Press Enter** when a cell is focused
3. **Start typing** when a cell is focused (replaces content)

### Saving Changes

After editing a cell value:

- **Press Enter** to save and move to the next row
- **Press Tab** to save and move to the next column
- **Click outside** the cell to save
- **Press Escape** to cancel the edit

::: tip Smart Navigation
When editing, pressing **Tab** moves horizontally through columns, while **Enter** moves vertically through rows. This makes data entry fast and intuitive.
:::

### Keyboard Navigation

When not actively editing a cell, use these keys to navigate:

| Key | Action |
|-----|--------|
| <kbd>Arrow Keys</kbd> | Move focus between cells |
| <kbd>Enter</kbd> | Start editing the focused cell |
| <kbd>Tab</kbd> | Move to next cell and start editing |
| <kbd>Shift</kbd> + <kbd>Tab</kbd> | Move to previous cell and start editing |
| <kbd>Escape</kbd> | Cancel edit / Clear focus |

## Adding New Rows

To insert a new row:

1. Click the **Add Row** button in the table header
2. A new row appears at the top of the grid with a green "NEW" badge
3. The first cell is automatically focused for editing
4. Fill in the values for each column

```sql
-- New rows are inserted using standard INSERT statements
-- Auto-increment columns are handled automatically
INSERT INTO users (name, email, status)
VALUES ('John Doe', 'john@example.com', 'active');
```

### Auto-Increment Handling

SQL Pro intelligently handles auto-increment columns:

- **Primary key columns** with auto-increment are left empty
- The database assigns the ID automatically when changes are applied
- Other columns receive their default values from the schema

::: info New Row Indicator
New rows display with a green left border and a "NEW" badge on the first column, making them easy to identify in the grid.
:::

## Deleting Rows

To delete a row:

1. Click the **trash icon** (🗑️) at the end of the row
2. The row is marked for deletion with strikethrough styling
3. The row remains visible until changes are applied

Deleting a newly inserted row (before applying) removes it immediately since it doesn't exist in the database yet.

::: warning Delete Confirmation
Deleted rows are not removed until you apply changes. You can undo a delete by clicking the undo button in the diff preview panel.
:::

## Pending Changes

All edits, inserts, and deletes are tracked as "pending changes" until you explicitly apply them to the database. This provides a safety net and allows you to review all modifications before they're committed.

### Viewing Pending Changes

When you have unsaved changes, a button appears showing the count:

- Click **"N pending changes"** to open the Diff Preview panel
- The panel shows all pending changes organized by type

### Change Indicators

Visual indicators in the data grid show which rows have pending changes:

| Indicator | Meaning |
|-----------|---------|
| Green left border + "NEW" badge | Newly inserted row |
| Yellow/amber cell background | Modified cell value |
| Red strikethrough + faded row | Row marked for deletion |

## Diff Preview Panel

The Diff Preview panel provides a comprehensive view of all pending changes before they're applied to the database.

### Opening the Panel

Click the **"N pending changes"** button in the table header to open the panel on the right side of the screen.

### Panel Sections

The panel displays:

1. **Header** - Total number of pending changes
2. **Summary bar** - Count of inserts, updates, and deletes
3. **Changes list** - Detailed view of each change
4. **Action buttons** - Discard All or Apply Changes

### Change Details

Each change item shows:

- **Type icon** - Insert (green +), Update (amber pencil), Delete (red trash)
- **Table name** and row identifier
- **Expand/collapse** - Click to see detailed field changes

For updates, the diff shows:
- **Old value** in red with strikethrough
- **Arrow** (→) indicating the change direction
- **New value** in green

```
name: "John" → "Jonathan"
email: "old@email.com" → "new@email.com"
```

### Validation Errors

If a change fails validation:

- An error icon appears next to the change
- The error message displays when expanded
- Changes with errors cannot be applied until fixed

## Applying Changes

When you're ready to commit your changes to the database:

1. Open the Diff Preview panel
2. Review all pending changes
3. Click **Apply Changes**

The application will:
1. Validate all changes against schema constraints
2. Execute changes in a transaction (all succeed or all fail)
3. Refresh the data grid to show the updated data
4. Clear all pending changes

::: warning Transaction Safety
All changes are applied in a single database transaction. If any change fails, the entire operation is rolled back and no data is modified.
:::

## Discarding Changes

To discard pending changes:

- **Discard All** - Click the "Discard All" button in the Diff Preview panel
- **Undo individual** - Click the undo button (↩) on any change item
- **Remove change** - Click the X button on any change item

### Undo with Keyboard

Press <kbd>Cmd/Ctrl</kbd> + <kbd>Z</kbd> to undo the most recent change.

::: tip Undo Stack
The undo command removes changes in reverse chronological order - the most recent change is undone first.
:::

## Copy and Paste

SQL Pro supports standard clipboard operations for cell values.

### Copying Values

1. Focus a cell (click or navigate with arrow keys)
2. Press <kbd>Cmd/Ctrl</kbd> + <kbd>C</kbd>
3. The cell value is copied to your clipboard

### Pasting Values

1. Focus the target cell
2. Press <kbd>Cmd/Ctrl</kbd> + <kbd>V</kbd>
3. The clipboard content replaces the cell value (creates a pending change)

## Working with Views

Database views are read-only in SQL Pro:

- The **Add Row** button is hidden for views
- Cells cannot be edited
- Delete buttons are not shown
- A "View" badge appears in the table header

To modify data shown in a view, edit the underlying base tables directly.

## Keyboard Shortcuts

| Action | macOS | Windows/Linux |
|--------|-------|---------------|
| Undo last change | <kbd>Cmd</kbd> + <kbd>Z</kbd> | <kbd>Ctrl</kbd> + <kbd>Z</kbd> |
| Copy cell value | <kbd>Cmd</kbd> + <kbd>C</kbd> | <kbd>Ctrl</kbd> + <kbd>C</kbd> |
| Paste into cell | <kbd>Cmd</kbd> + <kbd>V</kbd> | <kbd>Ctrl</kbd> + <kbd>V</kbd> |
| Save and move down | <kbd>Enter</kbd> | <kbd>Enter</kbd> |
| Save and move right | <kbd>Tab</kbd> | <kbd>Tab</kbd> |
| Cancel editing | <kbd>Esc</kbd> | <kbd>Esc</kbd> |
| Navigate cells | <kbd>Arrow Keys</kbd> | <kbd>Arrow Keys</kbd> |

## Tips and Best Practices

### Efficient Data Entry

1. **Use Tab navigation** for horizontal data entry across columns
2. **Use Enter navigation** for vertical data entry down rows
3. **Add rows from the last cell** - pressing Enter on the last cell of a new row creates another new row
4. **Review before applying** - always check the diff preview for complex edits

### Safe Editing Workflow

1. **Make small batches** - apply changes frequently rather than accumulating many
2. **Validate first** - SQL Pro validates changes before applying, but check the preview anyway
3. **Use undo** - if you make a mistake, Cmd/Ctrl+Z immediately undoes it
4. **Discard if unsure** - you can always discard and start over

### Performance Tips

1. **Use filters** to work with smaller data sets
2. **Apply changes before navigating** to other tables
3. **Avoid too many pending changes** - large change sets take longer to validate

### Common Workflows

**Bulk updates:**
1. Filter to find the rows you want to update
2. Edit each row with Tab navigation
3. Review all changes in diff preview
4. Apply when ready

**Data correction:**
1. Find the incorrect value
2. Double-click to edit
3. Enter the correct value
4. Apply immediately

**Adding related records:**
1. Add the parent row first and apply
2. Note the auto-generated ID
3. Add child rows referencing that ID

## Troubleshooting

### Changes Not Saving

If your edits aren't being tracked:

1. Ensure you're not editing a view (views are read-only)
2. Check that you pressed Enter or Tab (not just clicked away)
3. Verify the table has a primary key (required for updates/deletes)

### Validation Errors

Common validation errors:

- **NOT NULL constraint** - A required column has a null value
- **UNIQUE constraint** - The value already exists in a unique column
- **Foreign key constraint** - Referenced record doesn't exist
- **Type mismatch** - Value doesn't match column type

### Cannot Apply Changes

If the Apply button is disabled:

1. Check for validation errors (red icons in diff preview)
2. Fix any invalid changes
3. Try applying again

### Lost Changes

Pending changes are stored in memory. They may be lost if:

- You refresh the browser window
- You navigate to a different database
- The application crashes

::: tip Save Frequently
Apply your changes frequently to avoid losing work. SQL Pro doesn't persist pending changes across sessions.
:::

## Next Steps

- [Browse Schema Details](/features/schema-browser) - Understand table structure before editing
- [Write SQL Queries](/features/query-editor) - Use UPDATE/INSERT/DELETE statements for bulk operations
- [View ER Diagrams](/features/er-diagram) - Understand relationships between tables
- [Learn All Shortcuts](/shortcuts) - Master keyboard navigation

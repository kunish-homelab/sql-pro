# Implementation Plan: Complete Data Editing Suite

**Feature ID**: 002-data-editing
**Date**: 2025-12-26

---

## Technical Context

### Existing Infrastructure

| Component        | Location                                           | Purpose                                        |
| ---------------- | -------------------------------------------------- | ---------------------------------------------- |
| EditableDataGrid | `src/renderer/src/components/EditableDataGrid.tsx` | Grid with virtualization, cell editing, delete |
| EditableCell     | `src/renderer/src/components/EditableCell.tsx`     | Individual cell editing with type conversion   |
| changes-store    | `src/renderer/src/stores/changes-store.ts`         | Zustand store for pending changes              |
| DiffPreview      | `src/renderer/src/components/DiffPreview.tsx`      | Change review panel                            |
| TableView        | `src/renderer/src/components/TableView.tsx`        | Parent component with pagination               |
| database.ts      | `src/main/services/database.ts`                    | Backend CRUD operations                        |

### Key Patterns

```typescript
// Change type from types/database.ts
interface PendingChange {
  id: string;
  table: string;
  rowId: string | number;
  type: 'insert' | 'update' | 'delete';
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  timestamp: Date;
  isValid: boolean;
  validationError?: string;
}
```

---

## Implementation Phases

### Phase 1: Row Insertion (P0)

**Objective**: Enable adding new rows to tables

#### Step 1.1: Add Row Button to TableView

**File**: `src/renderer/src/components/TableView.tsx`

```typescript
// Add import
import { Plus } from 'lucide-react';

// Add handler
const handleAddRow = () => {
  if (!selectedTable || selectedTable.type === 'view') return;

  // Generate temporary ID
  const tempId = -Date.now(); // Negative timestamp ensures uniqueness

  // Create empty row with column defaults
  const newRow: Record<string, unknown> = {};
  columns.forEach(col => {
    newRow[col.name] = col.defaultValue ?? null;
  });

  addChange({
    table: selectedTable.name,
    rowId: tempId,
    type: 'insert',
    oldValues: null,
    newValues: newRow,
  });
};

// Add button in header
<Button
  variant="outline"
  size="sm"
  onClick={handleAddRow}
  disabled={selectedTable?.type === 'view'}
>
  <Plus className="mr-2 h-4 w-4" />
  Add Row
</Button>
```

#### Step 1.2: Display New Rows in EditableDataGrid

**File**: `src/renderer/src/components/EditableDataGrid.tsx`

```typescript
// Modify displayRows to include pending inserts
const displayRows = useMemo(() => {
  // Get insert changes for this table
  const inserts = changes
    .filter((c) => c.table === tableName && c.type === 'insert')
    .map((c) => ({
      ...c.newValues,
      __rowId: c.rowId,
      __isNew: true,
      __change: c,
    }));

  // Prepend inserts to existing rows
  const existingRows = rows.map((row, index) => {
    // ... existing logic
  });

  return [...inserts, ...existingRows];
}, [rows, changes, tableName]);
```

#### Step 1.3: Visual Indicator for New Rows

Add green background and "NEW" badge to inserted rows.

---

### Phase 2: Keyboard Navigation (P0)

**Objective**: Enable Tab/Shift+Tab navigation between cells

#### Step 2.1: Focus Management System

**File**: `src/renderer/src/components/EditableDataGrid.tsx`

```typescript
// Track focused cell
const [focusedCell, setFocusedCell] = useState<{
  rowIndex: number;
  colIndex: number;
} | null>(null);

// Calculate next/prev cell
const getNextCell = (rowIdx: number, colIdx: number, reverse: boolean) => {
  const totalCols = columns.length;
  const totalRows = displayRows.length;

  if (reverse) {
    // Shift+Tab: go left, then up
    if (colIdx > 0) return { rowIndex: rowIdx, colIndex: colIdx - 1 };
    if (rowIdx > 0) return { rowIndex: rowIdx - 1, colIndex: totalCols - 1 };
    return null; // At start
  } else {
    // Tab: go right, then down
    if (colIdx < totalCols - 1)
      return { rowIndex: rowIdx, colIndex: colIdx + 1 };
    if (rowIdx < totalRows - 1) return { rowIndex: rowIdx + 1, colIndex: 0 };
    return null; // At end
  }
};

// Handle keyboard navigation
const handleKeyDown = (
  e: React.KeyboardEvent,
  rowIdx: number,
  colIdx: number
) => {
  if (e.key === 'Tab') {
    e.preventDefault();
    const next = getNextCell(rowIdx, colIdx, e.shiftKey);
    if (next) {
      setFocusedCell(next);
      setEditingCell(next);
    }
  }
};
```

#### Step 2.2: Update EditableCell for Focus

**File**: `src/renderer/src/components/EditableCell.tsx`

Pass focus handler and auto-focus when cell becomes editing.

---

### Phase 3: Undo Support (P1)

**Objective**: Enable granular undo for individual changes

#### Step 3.1: Add Undo to DiffPreview

**File**: `src/renderer/src/components/DiffPreview.tsx`

```typescript
// Already has removeChange - this IS undo for updates/deletes
// For inserts, removeChange removes the pending insert

// Add Ctrl+Z handler
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      // Remove most recent change
      const lastChange = changes[changes.length - 1];
      if (lastChange) {
        removeChange(lastChange.id);
      }
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [changes, removeChange]);
```

#### Step 3.2: Add Undo Button to Each Change Item

Add Undo2 icon button next to X button in ChangeItem component.

---

### Phase 4: Inline Validation (P1)

**Objective**: Show validation errors at cell level

#### Step 4.1: Client-Side Validation

**File**: `src/renderer/src/components/EditableCell.tsx`

```typescript
// Add validation state
const [validationError, setValidationError] = useState<string | null>(null);

// Validate on save
const handleSave = () => {
  // Check NOT NULL
  if (column.notNull && (editValue === '' || editValue === null)) {
    setValidationError('This field is required');
    return;
  }

  // Check type
  // ... type validation logic

  setValidationError(null);
  onSave(newValue);
};
```

#### Step 4.2: Visual Error Indicator

```typescript
// In EditableCell render
<div className={cn(
  'relative',
  validationError && 'ring-2 ring-destructive'
)}>
  {/* cell content */}
  {validationError && (
    <div className="absolute -top-6 left-0 rounded bg-destructive px-1 text-xs text-white">
      {validationError}
    </div>
  )}
</div>
```

---

### Phase 5: Copy/Paste (P2)

**Objective**: Enable clipboard operations

#### Step 5.1: Copy Handler

```typescript
const handleCopy = (value: unknown) => {
  const text = value === null ? '' : String(value);
  navigator.clipboard.writeText(text);
};
```

#### Step 5.2: Paste Handler

```typescript
const handlePaste = async () => {
  const text = await navigator.clipboard.readText();
  handleCellSave(focusedCell.rowIndex, focusedCell.colIndex, text);
};
```

---

## File Changes Summary

| File                   | Action | Changes                              |
| ---------------------- | ------ | ------------------------------------ |
| `TableView.tsx`        | MODIFY | Add "Add Row" button, handleAddRow   |
| `EditableDataGrid.tsx` | MODIFY | Display inserts, keyboard navigation |
| `EditableCell.tsx`     | MODIFY | Inline validation, focus management  |
| `DiffPreview.tsx`      | MODIFY | Undo button, Ctrl+Z handler          |
| `changes-store.ts`     | MINOR  | May need revertChange action         |

---

## Testing Strategy

### Unit Tests

- `changes-store.test.ts`: Verify insert/update/delete merging
- `EditableCell.test.ts`: Validation logic

### Integration Tests

- Tab navigation across multiple rows
- Insert → Edit → Delete flow
- Undo all change types

### Manual Testing

See [requirements checklist](./checklists/requirements.md)

---

## Risk Mitigation

| Risk                             | Mitigation                       |
| -------------------------------- | -------------------------------- |
| Focus lost during virtual scroll | Re-focus on row re-render        |
| Negative IDs conflict            | Use `Date.now()` for uniqueness  |
| Undo order confusion             | Sort by timestamp in DiffPreview |

---

## Implementation Order

1. **Phase 1**: Row Insertion (enables basic insert)
2. **Phase 2**: Keyboard Navigation (essential UX)
3. **Phase 3**: Undo Support (error recovery)
4. **Phase 4**: Inline Validation (data quality)
5. **Phase 5**: Copy/Paste (convenience)

Estimated effort: Phases 1-3 are essential for MVP, Phases 4-5 are polish.

# Tasks: Complete Data Editing Suite

**Feature ID**: 002-data-editing
**Date**: 2025-12-26

---

## Phase 1: Row Insertion (P0)

### 1.1 Core Infrastructure

- [ ] **T-001**: Add `addChange` import to TableView.tsx
  - File: `src/renderer/src/components/TableView.tsx`
  - Import `useChangesStore` already exists, add `addChange` to destructuring

- [ ] **T-002**: Create `handleAddRow` function in TableView
  - File: `src/renderer/src/components/TableView.tsx`
  - Generate temporary negative ID using `-Date.now()`
  - Initialize row with NULL values for each column
  - Call `addChange` with type 'insert'

- [ ] **T-003**: Add "Add Row" button to table header
  - File: `src/renderer/src/components/TableView.tsx`
  - Location: Next to pending changes button
  - Icon: Plus from lucide-react
  - Disable for views (readOnly)

### 1.2 Grid Display

- [ ] **T-004**: Modify displayRows to include pending inserts
  - File: `src/renderer/src/components/EditableDataGrid.tsx`
  - Filter changes for inserts on current table
  - Prepend inserts to existing rows
  - Add `__isNew: true` marker

- [ ] **T-005**: Add visual indicator for new rows
  - File: `src/renderer/src/components/EditableDataGrid.tsx`
  - Green background: `bg-green-500/10`
  - Left border accent
  - Optional: "NEW" badge

---

## Phase 2: Keyboard Navigation (P0)

### 2.1 Focus Management

- [ ] **T-010**: Add focusedCell state to EditableDataGrid
  - File: `src/renderer/src/components/EditableDataGrid.tsx`
  - State: `{ rowIndex: number; colIndex: number } | null`

- [ ] **T-011**: Create getNextCell navigation function
  - File: `src/renderer/src/components/EditableDataGrid.tsx`
  - Tab: right then down
  - Shift+Tab: left then up
  - Handle grid boundaries

- [ ] **T-012**: Implement keyboard event handler
  - File: `src/renderer/src/components/EditableDataGrid.tsx`
  - Handle Tab/Shift+Tab
  - Prevent default browser tab behavior
  - Update editingCell state

### 2.2 Cell Integration

- [ ] **T-013**: Pass colIndex to EditableCell
  - File: `src/renderer/src/components/EditableDataGrid.tsx`
  - Add colIndex prop to cell rendering

- [ ] **T-014**: Add onKeyDown prop to EditableCell
  - File: `src/renderer/src/components/EditableCell.tsx`
  - Forward keyboard events to parent
  - Handle Enter (confirm + navigate down)
  - Handle Escape (cancel edit)

---

## Phase 3: Undo Support (P1)

### 3.1 UI Components

- [ ] **T-020**: Add Undo button to ChangeItem in DiffPreview
  - File: `src/renderer/src/components/DiffPreview.tsx`
  - Icon: Undo2 from lucide-react
  - Position: Next to X (remove) button
  - Click handler: `removeChange(change.id)`

### 3.2 Keyboard Shortcut

- [ ] **T-021**: Add Ctrl+Z global handler
  - File: `src/renderer/src/components/DiffPreview.tsx`
  - useEffect with window event listener
  - Find most recent change by timestamp
  - Call removeChange for last change
  - Support both Ctrl and Cmd (Mac)

---

## Phase 4: Inline Validation (P1)

### 4.1 Validation Logic

- [ ] **T-030**: Add column metadata prop to EditableCell
  - File: `src/renderer/src/components/EditableCell.tsx`
  - Pass full ColumnSchema instead of just type string
  - Access notNull, defaultValue, etc.

- [ ] **T-031**: Implement client-side validation
  - File: `src/renderer/src/components/EditableCell.tsx`
  - Check NOT NULL constraint
  - Check type compatibility
  - Set validationError state

### 4.2 Visual Feedback

- [ ] **T-032**: Add validation error indicator
  - File: `src/renderer/src/components/EditableCell.tsx`
  - Red ring: `ring-2 ring-destructive`
  - Tooltip with error message
  - Clear error on valid input

---

## Phase 5: Copy/Paste (P2)

### 5.1 Clipboard Operations

- [ ] **T-040**: Add copy handler (Ctrl+C)
  - File: `src/renderer/src/components/EditableDataGrid.tsx`
  - Copy focused cell value to clipboard
  - Handle null values

- [ ] **T-041**: Add paste handler (Ctrl+V)
  - File: `src/renderer/src/components/EditableDataGrid.tsx`
  - Read clipboard text
  - Apply to focused cell with type conversion
  - Create change via existing flow

---

## Dependencies

```
T-001 → T-002 → T-003
T-004 → T-005
T-010 → T-011 → T-012 → T-013 → T-014
T-020 (standalone)
T-021 (standalone)
T-030 → T-031 → T-032
T-040, T-041 (can run parallel, depend on T-010)
```

---

## Execution Order

1. **Phase 1 first**: T-001 through T-005 (row insertion foundation)
2. **Phase 2 second**: T-010 through T-014 (keyboard navigation)
3. **Phase 3 third**: T-020, T-021 (undo support)
4. **Phase 4 fourth**: T-030 through T-032 (validation)
5. **Phase 5 last**: T-040, T-041 (copy/paste polish)

---

## Verification

After each phase, verify:

- Build passes: `pnpm run build`
- No TypeScript errors
- Manual test of implemented functionality

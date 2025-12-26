# Feature Specification: Complete Data Editing Suite

**Feature ID**: 002-data-editing
**Version**: 1.0
**Date**: 2025-12-26
**Status**: Draft

---

## 1. Overview

### 1.1 Problem Statement

SQL Pro currently has foundational editing infrastructure (cell editing, change tracking, diff preview), but lacks essential features for a complete data editing experience: row insertion, keyboard navigation, and robust undo capabilities.

### 1.2 Solution

Enhance the existing editing system to provide a complete CRUD (Create, Read, Update, Delete) experience with professional-grade UX including keyboard navigation, inline validation, and granular undo support.

### 1.3 Scope

**In Scope:**

- Row insertion with default/NULL values
- Keyboard navigation between cells (Tab/Shift+Tab, Arrow keys)
- Granular undo for individual changes
- Inline validation feedback
- Cell copy/paste support
- Polish existing cell editing UX

**Out of Scope:**

- Bulk import/export (separate feature)
- Schema editing (ALTER TABLE)
- Multi-row selection and batch operations
- Custom data entry forms

---

## 2. User Stories

### 2.1 Primary User Stories

| ID     | As a...       | I want to...                 | So that...                                            | Priority |
| ------ | ------------- | ---------------------------- | ----------------------------------------------------- | -------- |
| US-001 | Database user | Insert new rows into a table | I can add data without writing SQL                    | P0       |
| US-002 | Database user | Navigate cells with keyboard | I can edit data efficiently                           | P0       |
| US-003 | Database user | Undo individual changes      | I can correct mistakes without discarding all changes | P1       |
| US-004 | Database user | See validation errors inline | I know immediately if my data is invalid              | P1       |
| US-005 | Database user | Copy/paste cell values       | I can quickly replicate data                          | P2       |

### 2.2 User Scenarios

**Scenario 1: Adding a new customer record**

> User clicks "Add Row" button. A new row appears at the top of the grid with empty/NULL values. User tabs through cells entering customer data. On blur or Enter, each cell value is validated. User reviews changes in diff preview and clicks Apply.

**Scenario 2: Fixing a typo mid-edit**

> User is editing multiple cells across rows. They realize they made a mistake two cells ago. They click the undo button on that specific change in the diff preview, or use Ctrl+Z to undo the last change. The cell reverts to its original value.

**Scenario 3: Efficient bulk data entry**

> User needs to enter 10 new products. After inserting the first row, they Tab through cells quickly. After completing a row, pressing Enter on the last cell auto-creates a new row. Arrow keys allow quick navigation back to fix values.

---

## 3. Functional Requirements

### 3.1 Row Insertion

| ID     | Requirement                                                           | Priority |
| ------ | --------------------------------------------------------------------- | -------- |
| FR-001 | System SHALL provide an "Add Row" button in the table header          | P0       |
| FR-002 | New rows SHALL appear at the top of the grid with a visual indicator  | P0       |
| FR-003 | New row cells SHALL be initialized with NULL or column default values | P0       |
| FR-004 | Inserted rows SHALL be tracked as 'insert' type changes               | P0       |
| FR-005 | System SHALL generate temporary negative IDs for new rows             | P0       |
| FR-006 | Insert button SHALL be disabled for views (readOnly mode)             | P0       |

### 3.2 Keyboard Navigation

| ID     | Requirement                                              | Priority |
| ------ | -------------------------------------------------------- | -------- |
| FR-010 | Tab SHALL move focus to next cell (right, then next row) | P0       |
| FR-011 | Shift+Tab SHALL move focus to previous cell              | P0       |
| FR-012 | Arrow keys SHALL navigate between cells when not editing | P1       |
| FR-013 | Enter SHALL confirm edit and move to cell below          | P1       |
| FR-014 | Escape SHALL cancel current edit                         | P0       |
| FR-015 | Enter on last cell of new row MAY create another new row | P2       |

### 3.3 Undo/Redo

| ID     | Requirement                                           | Priority |
| ------ | ----------------------------------------------------- | -------- |
| FR-020 | Each change in diff preview SHALL have an undo button | P0       |
| FR-021 | Ctrl+Z SHALL undo the most recent change              | P1       |
| FR-022 | Undoing an insert SHALL remove the entire row         | P0       |
| FR-023 | Undoing an update SHALL revert cell to original value | P0       |
| FR-024 | Undoing a delete SHALL restore the row                | P0       |

### 3.4 Inline Validation

| ID     | Requirement                                              | Priority |
| ------ | -------------------------------------------------------- | -------- |
| FR-030 | NOT NULL violations SHALL show inline error indicator    | P1       |
| FR-031 | Type mismatch SHALL show inline error indicator          | P1       |
| FR-032 | Unique constraint violations SHALL show after validation | P1       |
| FR-033 | Foreign key violations SHALL show after validation       | P2       |

### 3.5 Copy/Paste

| ID     | Requirement                                          | Priority |
| ------ | ---------------------------------------------------- | -------- |
| FR-040 | Ctrl+C SHALL copy current cell value to clipboard    | P2       |
| FR-041 | Ctrl+V SHALL paste clipboard value into current cell | P2       |
| FR-042 | Pasting SHALL respect cell type conversion           | P2       |

---

## 4. Non-Functional Requirements

### 4.1 Performance

| ID      | Requirement                  | Target         |
| ------- | ---------------------------- | -------------- |
| NFR-001 | Cell edit initiation         | < 50ms         |
| NFR-002 | Keyboard navigation response | < 16ms (60fps) |
| NFR-003 | Row insertion rendering      | < 100ms        |

### 4.2 Accessibility

| ID      | Requirement                                        |
| ------- | -------------------------------------------------- |
| NFR-010 | All editing controls SHALL be keyboard accessible  |
| NFR-011 | Focus indicators SHALL be clearly visible          |
| NFR-012 | Screen reader announcements for edit state changes |

---

## 5. UI/UX Specifications

### 5.1 Add Row Button

**Location**: Table header, right side (next to existing pending changes button)
**Icon**: Plus icon
**Label**: "Add Row" (tooltip)
**State**: Disabled when `readOnly=true` or no table selected

### 5.2 New Row Indicator

**Visual**: Light green background (`bg-green-500/10`) with left border accent
**Position**: Top of data grid (index 0)
**Badge**: "NEW" label in first cell or row actions column

### 5.3 Validation Error Indicator

**Cell Level**: Red border ring (`ring-destructive`) with tooltip showing error
**Row Level**: Red background tint for rows with validation errors

### 5.4 Undo Button

**Location**: Within each change item in DiffPreview
**Icon**: Undo icon (circular arrow)
**Position**: Next to the X (remove) button

---

## 6. Technical Considerations

### 6.1 Existing Infrastructure

The following already exists and will be leveraged:

- `EditableDataGrid.tsx` - Grid component with virtual scrolling
- `EditableCell.tsx` - Cell editing with type conversion
- `changes-store.ts` - Zustand store for pending changes
- `DiffPreview.tsx` - Change review panel
- `applyChanges` IPC - Backend change application

### 6.2 Key Implementation Points

1. **Temporary Row IDs**: Use negative integers (e.g., -1, -2) for new rows to distinguish from database IDs
2. **Change Merging**: The existing `addChange` already handles merging - inserting then deleting removes both
3. **Keyboard Focus Management**: Use React refs and imperative focus APIs
4. **Validation**: Extend existing `validateChanges` IPC or add client-side pre-validation

### 6.3 IPC Changes

May need to extend or add:

- `db:insertRow` - For handling insert-specific logic
- Modify `db:validateChanges` - To handle new row validation

---

## 7. Success Criteria

| ID     | Criterion                                          | Measurement    |
| ------ | -------------------------------------------------- | -------------- |
| SC-001 | User can insert, edit, and delete rows without SQL | Manual testing |
| SC-002 | Tab navigation works across entire grid            | Manual testing |
| SC-003 | Undo works for all change types                    | Manual testing |
| SC-004 | Validation errors visible before apply             | Manual testing |
| SC-005 | No data loss from accidental navigation            | Manual testing |

---

## 8. Risks & Mitigations

| Risk                                            | Impact | Mitigation                                    |
| ----------------------------------------------- | ------ | --------------------------------------------- |
| Keyboard navigation conflicts with cell editing | High   | Clear mode separation (editing vs navigating) |
| Performance with many pending changes           | Medium | Virtualize diff preview list                  |
| Undo state complexity                           | Medium | Use change ID ordering, not undo stack        |

---

## 9. Dependencies

- Existing editing infrastructure (EditableDataGrid, changes-store)
- Zustand for state management
- @tanstack/react-virtual for virtualized rendering
- Tailwind CSS for styling

---

## 10. Open Questions

1. **RESOLVED**: Should Enter on last cell auto-create new row? → Yes, as P2 enhancement
2. **RESOLVED**: Should we support multi-cell selection? → No, out of scope
3. **TBD**: Should validation happen on blur or on explicit action?

---

## Revision History

| Version | Date       | Author | Changes               |
| ------- | ---------- | ------ | --------------------- |
| 1.0     | 2025-12-26 | Claude | Initial specification |

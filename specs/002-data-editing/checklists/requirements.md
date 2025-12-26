# Requirements Checklist: Complete Data Editing Suite

**Feature ID**: 002-data-editing
**Date**: 2025-12-26

---

## Row Insertion

- [ ] **FR-001**: Add Row button in table header
- [ ] **FR-002**: New rows appear at top with visual indicator
- [ ] **FR-003**: Cells initialized with NULL/defaults
- [ ] **FR-004**: Tracked as 'insert' type change
- [ ] **FR-005**: Temporary negative IDs for new rows
- [ ] **FR-006**: Disabled for views (readOnly)

## Keyboard Navigation

- [ ] **FR-010**: Tab moves to next cell
- [ ] **FR-011**: Shift+Tab moves to previous cell
- [ ] **FR-012**: Arrow keys navigate cells (non-edit mode)
- [ ] **FR-013**: Enter confirms and moves down
- [ ] **FR-014**: Escape cancels edit
- [ ] **FR-015**: Enter on last cell creates new row (P2)

## Undo/Redo

- [ ] **FR-020**: Undo button per change in DiffPreview
- [ ] **FR-021**: Ctrl+Z undoes last change
- [ ] **FR-022**: Undo insert removes row
- [ ] **FR-023**: Undo update reverts value
- [ ] **FR-024**: Undo delete restores row

## Inline Validation

- [ ] **FR-030**: NOT NULL inline error
- [ ] **FR-031**: Type mismatch inline error
- [ ] **FR-032**: Unique constraint error (after validate)
- [ ] **FR-033**: Foreign key error (after validate, P2)

## Copy/Paste

- [ ] **FR-040**: Ctrl+C copies cell value
- [ ] **FR-041**: Ctrl+V pastes into cell
- [ ] **FR-042**: Type conversion on paste

## Success Criteria

- [ ] **SC-001**: Full CRUD without SQL
- [ ] **SC-002**: Tab navigation across grid
- [ ] **SC-003**: Undo works for all changes
- [ ] **SC-004**: Validation errors visible
- [ ] **SC-005**: No accidental data loss

---

## Testing Notes

### Manual Test Cases

1. **Insert Row Flow**
   - Click Add Row
   - Verify row appears at top with green indicator
   - Fill values via Tab navigation
   - Verify change appears in DiffPreview
   - Apply and verify in database

2. **Keyboard Navigation**
   - Start in first cell
   - Tab through all cells in row
   - Verify Tab moves to next row
   - Shift+Tab reverses direction
   - Arrow keys work in non-edit mode

3. **Undo Scenarios**
   - Make 3 different edits
   - Undo middle edit via DiffPreview button
   - Verify only that change reverts
   - Ctrl+Z undoes most recent remaining change

4. **Validation Flow**
   - Insert row with NOT NULL column
   - Leave NOT NULL column empty
   - Verify inline error indicator
   - Try to apply, verify blocked
   - Fill value, verify error clears

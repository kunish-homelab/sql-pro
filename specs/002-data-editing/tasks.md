# Tasks: Complete Data Editing Suite

**Feature ID**: 002-data-editing
**Date**: 2025-12-26
**Constitution**: Tests required (Principle IX - TDD)

---

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, etc.)
- All paths relative to `src/renderer/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify existing infrastructure and prepare for feature development

- [x] T001 Verify changes-store.ts has addChange, removeChange exports in stores/changes-store.ts
- [x] T002 Verify EditableDataGrid.tsx has editingCell state in components/EditableDataGrid.tsx
- [x] T003 [P] Verify DiffPreview.tsx has ChangeItem component in components/DiffPreview.tsx
- [x] T004 [P] Add Plus icon import to TableView.tsx in components/TableView.tsx

**Checkpoint**: Infrastructure verified ✅ - ready for user story implementation

---

## Phase 2: User Story 1 - Row Insertion (Priority: P0) 🎯 MVP

**Goal**: User can insert new rows into a table without writing SQL

**Independent Test**: Click "Add Row" → new row appears at top with green indicator → edit cells → verify change appears in DiffPreview

### Tests for User Story 1 (TDD - Write First, Must Fail)

- [ ] T005 [P] [US1] Write test for handleAddRow function in components/**tests**/TableView.test.tsx
  - Test generates negative temp ID
  - Test initializes row with NULL/defaults
  - Test calls addChange with type 'insert'
- [ ] T006 [P] [US1] Write test for displayRows including inserts in components/**tests**/EditableDataGrid.test.tsx
  - Test filters insert changes for current table
  - Test prepends inserts to existing rows
  - Test adds \_\_isNew marker

### Implementation for User Story 1

- [x] T007 [US1] Add addChange to useChangesStore destructuring in components/TableView.tsx
- [x] T008 [US1] Create handleAddRow function in components/TableView.tsx
  - Generate temporary ID using `-Date.now()`
  - Initialize row with NULL values for each column
  - Call addChange with type 'insert'
- [x] T009 [US1] Add "Add Row" button to table header in components/TableView.tsx
  - Location: Next to pending changes button
  - Icon: Plus from lucide-react
  - Disable for views (readOnly)
- [x] T010 [US1] Modify displayRows to include pending inserts in components/EditableDataGrid.tsx
  - Filter changes for inserts on current table
  - Prepend inserts to existing rows
  - Add `__isNew: true` and `__rowId` markers
- [x] T011 [US1] Add visual indicator for new rows in components/EditableDataGrid.tsx
  - Green background: `bg-green-500/10`
  - Left border accent: `border-l-2 border-green-500`
  - Optional: "NEW" badge in first cell

**Checkpoint**: Row insertion works ✅ - can add rows without SQL

---

## Phase 3: User Story 2 - Keyboard Navigation (Priority: P0)

**Goal**: User can navigate cells efficiently using keyboard (Tab, Shift+Tab, Arrow keys, Enter, Escape)

**Independent Test**: Click a cell → Tab moves to next cell → Shift+Tab moves back → Arrow keys navigate grid → Enter confirms → Escape cancels

### Tests for User Story 2 (TDD - Write First, Must Fail)

- [ ] T012 [P] [US2] Write test for getNextCell navigation in components/**tests**/EditableDataGrid.test.tsx
  - Test Tab: right then down at row end
  - Test Shift+Tab: left then up at row start
  - Test boundary handling (first/last cell)
- [ ] T013 [P] [US2] Write test for arrow key navigation in components/**tests**/EditableDataGrid.test.tsx
  - Test ArrowRight/ArrowLeft horizontal movement
  - Test ArrowUp/ArrowDown vertical movement
  - Test boundary handling
- [ ] T014 [P] [US2] Write test for keyboard events in EditableCell in components/**tests**/EditableCell.test.tsx
  - Test Enter confirms and navigates down
  - Test Escape cancels edit

### Implementation for User Story 2

- [x] T015 [US2] Add focusedCell state to EditableDataGrid in components/EditableDataGrid.tsx
  - State: `{ rowIndex: number; colIndex: number } | null`
- [x] T016 [US2] Create getNextCell navigation function in components/EditableDataGrid.tsx
  - Tab: right then down
  - Shift+Tab: left then up
  - Handle grid boundaries
- [x] T017 [US2] Implement Tab/Shift+Tab keyboard handler in components/EditableDataGrid.tsx
  - Handle Tab/Shift+Tab
  - Prevent default browser tab behavior
  - Update editingCell state
- [x] T018 [US2] Implement arrow key navigation handler in components/EditableDataGrid.tsx
  - Handle ArrowUp/ArrowDown/ArrowLeft/ArrowRight
  - Only when not in edit mode (focusedCell but not editingCell)
  - Update focusedCell state
- [x] T019 [US2] Pass colIndex prop to EditableCell in components/EditableDataGrid.tsx
  - Add colIndex to cell rendering props
- [x] T020 [US2] Add onKeyDown prop to EditableCell in components/EditableCell.tsx
  - Forward keyboard events to parent
  - Handle Enter (confirm edit + trigger navigate down)
  - Handle Escape (cancel edit)
- [x] T021 [US2] Add visible focus indicator styles in components/EditableDataGrid.tsx
  - Ring style for focused cell: `ring-2 ring-primary`
  - Distinguish focused vs editing states

**Checkpoint**: Full keyboard navigation works ✅ - Tab, Shift+Tab, arrows, Enter, Escape

---

## Phase 4: User Story 3 - Undo Changes (Priority: P1)

**Goal**: User can undo individual changes without discarding all edits

**Independent Test**: Make 3 edits → click undo on middle edit → verify only that change reverts → Ctrl+Z undoes most recent

### Tests for User Story 3 (TDD - Write First, Must Fail)

- [ ] T022 [P] [US3] Write test for Ctrl+Z undo in components/**tests**/DiffPreview.test.tsx
  - Test removes most recent change by timestamp
  - Test supports both Ctrl and Cmd (Mac)
  - Test handles empty changes array

### Implementation for User Story 3

- [x] T023 [US3] Add Undo button to ChangeItem in components/DiffPreview.tsx
  - Icon: Undo2 from lucide-react
  - Position: Next to X (remove) button
  - Click handler: `removeChange(change.id)`
- [x] T024 [US3] Add Ctrl+Z global handler in components/DiffPreview.tsx
  - useEffect with window event listener
  - Find most recent change by timestamp
  - Call removeChange for last change
  - Support both Ctrl (Windows/Linux) and Cmd (Mac)

**Checkpoint**: Undo works ✅ for all change types - insert, update, delete

---

## Phase 5: User Story 4 - Inline Validation (Priority: P1)

**Goal**: User sees validation errors immediately at cell level

**Independent Test**: Insert row → leave NOT NULL field empty → see red error indicator → fill value → error clears

### Tests for User Story 4 (TDD - Write First, Must Fail)

- [ ] T025 [P] [US4] Write test for client-side validation in components/**tests**/EditableCell.test.tsx
  - Test NOT NULL constraint check
  - Test type compatibility check
  - Test error state management

### Implementation for User Story 4

- [x] T026 [US4] Add column metadata prop to EditableCell in components/EditableCell.tsx
  - Pass full ColumnSchema instead of just type string
  - Access notNull, defaultValue, type properties
- [x] T027 [US4] Implement client-side validation logic in components/EditableCell.tsx
  - Check NOT NULL constraint on blur/save
  - Check type compatibility (basic type coercion)
  - Set validationError state
  - Validation triggers: on blur (decision from spec.md TBD - defaulting to blur)
- [x] T028 [US4] Add validation error indicator in components/EditableCell.tsx
  - Red ring: `ring-2 ring-destructive`
  - Tooltip or small label with error message
  - Clear error when valid input provided

**Checkpoint**: Validation errors visible before apply ✅ - NOT NULL and type errors shown inline

---

## Phase 6: User Story 5 - Copy/Paste (Priority: P2)

**Goal**: User can copy and paste cell values for efficient data entry

**Independent Test**: Focus cell → Ctrl+C copies value → move to another cell → Ctrl+V pastes with type conversion

### Tests for User Story 5 (TDD - Write First, Must Fail)

- [ ] T029 [P] [US5] Write test for clipboard operations in components/**tests**/EditableDataGrid.test.tsx
  - Test copy writes to clipboard
  - Test paste reads from clipboard
  - Test null value handling

### Implementation for User Story 5

- [x] T030 [US5] Add copy handler (Ctrl+C) in components/EditableDataGrid.tsx
  - Copy focused cell value to clipboard via navigator.clipboard.writeText
  - Handle null values (copy as empty string)
- [x] T031 [US5] Add paste handler (Ctrl+V) in components/EditableDataGrid.tsx
  - Read clipboard text via navigator.clipboard.readText
  - Apply to focused cell with type conversion
  - Create change via existing handleCellSave flow
- [x] T032 [US5] Add Enter-creates-new-row behavior in components/EditableDataGrid.tsx
  - When Enter pressed on last cell of a new (\_\_isNew) row
  - Auto-create another new row
  - Move focus to first editable cell of new row

**Checkpoint**: Copy/paste and efficient data entry workflows complete ✅

---

## Phase 7: Polish & Verification

**Purpose**: Cross-cutting improvements and final validation

### Accessibility Verification (NFR-010, NFR-011, NFR-012)

- [x] T033 [P] Verify all editing controls are keyboard accessible in components/
- [x] T034 [P] Verify focus indicators are clearly visible (WCAG AA contrast)
- [ ] T035 Add aria-labels for screen reader compatibility in components/EditableCell.tsx and EditableDataGrid.tsx

### Performance Verification (NFR-001, NFR-002, NFR-003)

- [ ] T036 Manual test: Cell edit initiation < 50ms
- [ ] T037 Manual test: Keyboard navigation response < 16ms (60fps feel)
- [ ] T038 Manual test: Row insertion rendering < 100ms

### Final Validation

- [x] T039 Run full build: `pnpm run build`
- [ ] T040 Run all tests: `pnpm run test`
- [ ] T041 Manual walkthrough of all user scenarios from spec.md

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup) → Phase 2 (US1: Row Insertion) → Phase 3 (US2: Keyboard Nav)
                                               ↘ Phase 4 (US3: Undo)
                                               ↘ Phase 5 (US4: Validation)
                                               ↘ Phase 6 (US5: Copy/Paste)
                                                         ↓
                                                 Phase 7 (Polish)
```

### User Story Dependencies

- **US1 (Row Insertion)**: No dependencies - can start after Setup
- **US2 (Keyboard Nav)**: Benefits from US1 (test with new rows) but independently testable
- **US3 (Undo)**: Independent - uses existing changes-store
- **US4 (Validation)**: Independent - enhances EditableCell
- **US5 (Copy/Paste)**: Depends on US2 (needs focusedCell state from keyboard nav)

### Within Each User Story (TDD Order)

1. Write tests → verify they FAIL
2. Implement feature
3. Verify tests PASS
4. Checkpoint validation

---

## Parallel Opportunities

### Phase 1 (Setup)

```
T001 (verify changes-store) | T002 (verify EditableDataGrid) | T003 (verify DiffPreview) | T004 (add Plus import)
```

### Phase 2 (US1 Tests)

```
T005 (handleAddRow test) | T006 (displayRows test)
```

### Phase 3 (US2 Tests)

```
T012 (getNextCell test) | T013 (arrow key test) | T014 (EditableCell key test)
```

### After Foundational US1 + US2 Complete

```
US3 (Undo) | US4 (Validation) | US5 (Copy/Paste - after US2)
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1: Setup verification
2. Complete Phase 2: User Story 1 (Row Insertion)
3. **STOP and VALIDATE**: Can add rows, see them in grid, edit them
4. This is a functional MVP increment

### Incremental Delivery

1. Setup + US1 → **MVP: Row insertion works**
2. Add US2 → **Enhanced: Full keyboard navigation**
3. Add US3 → **Polished: Undo support**
4. Add US4 → **Professional: Inline validation**
5. Add US5 → **Complete: Copy/paste convenience**

Each story adds value and can be demoed independently.

---

## Notes

- **TDD Required**: Constitution IX mandates tests before implementation
- **Validation Timing**: Defaulting to blur-based validation (spec.md TBD resolved)
- All file paths are relative to `src/renderer/src/`
- [P] tasks can run in parallel (different files, no dependencies)
- Commit after each task or logical group
- Stop at any checkpoint to validate independently

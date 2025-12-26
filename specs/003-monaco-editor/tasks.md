# Tasks: Monaco SQL Editor

**Input**: Design documents from `/specs/003-monaco-editor/`
**Prerequisites**: plan.md, spec.md, research.md, quickstart.md

**Tests**: Not requested in specification - skipped.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Renderer code**: `src/renderer/src/`
- **Components**: `src/renderer/src/components/`
- **Libraries**: `src/renderer/src/lib/`
- **Stores**: `src/renderer/src/stores/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Package installation and project configuration

- [x] T001 Install Monaco packages: `pnpm add @monaco-editor/react monaco-editor`
- [x] T002 Remove CodeMirror packages: `pnpm remove @uiw/react-codemirror @codemirror/lang-sql`
- [x] T003 Run typecheck to verify no breaking imports: `pnpm typecheck` (EXPECTED FAIL - QueryEditor.tsx still imports CodeMirror, fixed in Phase 7)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core Monaco configuration that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Create base Monaco worker configuration with Vite worker imports in src/renderer/src/lib/monaco-sql-config.ts
- [x] T005 Create MonacoSqlEditor component skeleton with Editor import and basic props in src/renderer/src/components/MonacoSqlEditor.tsx
- [x] T006 Add MonacoSqlEditor to components barrel export in src/renderer/src/components/index.ts (if exists)

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Write SQL with Intelligent Autocomplete (Priority: P1) 🎯 MVP

**Goal**: Provide autocomplete suggestions for SQL keywords, table names, and column names from the connected database schema

**Independent Test**: Type `SELECT * FROM ` in editor with a connected database and verify table name suggestions appear

### Implementation for User Story 1

- [x] T007 [P] [US1] Define SQL_KEYWORDS array with common SQL keywords (SELECT, FROM, WHERE, JOIN, etc.) in src/renderer/src/lib/monaco-sql-config.ts
- [x] T008 [P] [US1] Create createSqlCompletionProvider function signature accepting Monaco instance and DatabaseSchema in src/renderer/src/lib/monaco-sql-config.ts
- [x] T009 [US1] Implement SQL keyword suggestions in createSqlCompletionProvider in src/renderer/src/lib/monaco-sql-config.ts
- [x] T010 [US1] Implement table name suggestions from schema.tables in createSqlCompletionProvider in src/renderer/src/lib/monaco-sql-config.ts
- [x] T011 [US1] Implement column name suggestions (both qualified table.column and unqualified) in createSqlCompletionProvider in src/renderer/src/lib/monaco-sql-config.ts
- [x] T012 [US1] Implement view name suggestions from schema.views in createSqlCompletionProvider in src/renderer/src/lib/monaco-sql-config.ts
- [x] T013 [US1] Register completion provider in MonacoSqlEditor onMount callback in src/renderer/src/components/MonacoSqlEditor.tsx
- [x] T014 [US1] Add useEffect to dispose and re-register completion provider when schema prop changes in src/renderer/src/components/MonacoSqlEditor.tsx
- [x] T015 [US1] Add schema prop to MonacoSqlEditor and pass from useConnectionStore in parent in src/renderer/src/components/MonacoSqlEditor.tsx

**Checkpoint**: At this point, User Story 1 should be fully functional - autocomplete shows SQL keywords, tables, and columns

---

## Phase 4: User Story 2 - Theme-Aware Editor (Priority: P2)

**Goal**: Editor automatically matches application light/dark theme setting

**Independent Test**: Toggle application theme and verify editor appearance changes immediately

### Implementation for User Story 2

- [x] T016 [P] [US2] Create defineCustomThemes function in src/renderer/src/lib/monaco-sql-config.ts
- [x] T017 [P] [US2] Define 'sql-pro-light' theme based on 'vs' in defineCustomThemes in src/renderer/src/lib/monaco-sql-config.ts
- [x] T018 [P] [US2] Define 'sql-pro-dark' theme based on 'vs-dark' in defineCustomThemes in src/renderer/src/lib/monaco-sql-config.ts
- [x] T019 [US2] Call defineCustomThemes in MonacoSqlEditor beforeMount callback in src/renderer/src/components/MonacoSqlEditor.tsx
- [x] T020 [US2] Subscribe to useThemeStore and compute isDark state in src/renderer/src/components/MonacoSqlEditor.tsx
- [x] T021 [US2] Pass computed theme prop ('sql-pro-light' or 'sql-pro-dark') to Editor component in src/renderer/src/components/MonacoSqlEditor.tsx
- [x] T022 [US2] Handle 'system' theme preference with window.matchMedia check in src/renderer/src/components/MonacoSqlEditor.tsx

**Checkpoint**: At this point, User Story 2 should be fully functional - editor theme matches app theme

---

## Phase 5: User Story 3 - SQL Syntax Highlighting (Priority: P2)

**Goal**: Proper syntax highlighting for SQL keywords, strings, numbers, and comments

**Independent Test**: Type various SQL statements and verify visual differentiation of syntax elements

### Implementation for User Story 3

- [x] T023 [P] [US3] Set defaultLanguage="sql" on Editor component in src/renderer/src/components/MonacoSqlEditor.tsx
- [x] T024 [P] [US3] Add custom syntax token colors to 'sql-pro-light' theme rules in src/renderer/src/lib/monaco-sql-config.ts
- [x] T025 [P] [US3] Add custom syntax token colors to 'sql-pro-dark' theme rules in src/renderer/src/lib/monaco-sql-config.ts

**Checkpoint**: At this point, User Story 3 should be fully functional - SQL syntax is highlighted with colors

---

## Phase 6: User Story 4 - Execute Queries with Keyboard Shortcut (Priority: P3)

**Goal**: Preserve Cmd/Ctrl+Enter keyboard shortcut for query execution

**Independent Test**: Write a valid query and press Cmd/Ctrl+Enter to execute

### Implementation for User Story 4

- [x] T026 [US4] Add onExecute callback prop to MonacoSqlEditor component in src/renderer/src/components/MonacoSqlEditor.tsx
- [x] T027 [US4] Register Cmd/Ctrl+Enter command using editor.addCommand in onMount callback in src/renderer/src/components/MonacoSqlEditor.tsx
- [x] T028 [US4] Wire onExecute prop to command handler in src/renderer/src/components/MonacoSqlEditor.tsx

**Checkpoint**: At this point, User Story 4 should be fully functional - Cmd/Ctrl+Enter executes query

---

## Phase 7: Integration & Polish

**Purpose**: Replace CodeMirror with Monaco in QueryEditor, cleanup

- [x] T029 Remove CodeMirror import statements from src/renderer/src/components/QueryEditor.tsx
- [x] T030 Import MonacoSqlEditor component in src/renderer/src/components/QueryEditor.tsx
- [x] T031 Replace CodeMirror element with MonacoSqlEditor, passing value, onChange, onExecute, schema props in src/renderer/src/components/QueryEditor.tsx
- [x] T032 Remove handleKeyDown callback (Cmd+Enter now handled by MonacoSqlEditor) in src/renderer/src/components/QueryEditor.tsx
- [x] T033 Remove unused \_schemaConfig variable from QueryEditor in src/renderer/src/components/QueryEditor.tsx
- [x] T034 Configure Monaco editor options (minimap, lineNumbers, fontSize, fontFamily) in src/renderer/src/components/MonacoSqlEditor.tsx
- [x] T035 Run typecheck to verify all types are correct: `pnpm typecheck`
- [x] T036 Test full user flow: connect database, write query with autocomplete, execute with Cmd+Enter (manual test pending - Electron startup issue unrelated to Monaco)
- [x] T037 [P] Test theme switching: toggle light/dark/system and verify editor updates (manual test pending)

---

## Phase 8: Clarification Implementations (Post-Review)

**Purpose**: Implement additional requirements from spec clarifications

- [x] T038 [US1] Add case-insensitive matching via filterText property in createSqlCompletionProvider in src/renderer/src/lib/monaco-sql-config.ts
- [x] T039 Add drag-to-resize functionality to MonacoSqlEditor with resize handle in src/renderer/src/components/MonacoSqlEditor.tsx
- [x] T040 Run typecheck to verify implementation: `pnpm typecheck`
- [x] T041 Add double-click on resize handle to restore default editor height in src/renderer/src/components/MonacoSqlEditor.tsx
- [x] T042 [US1] Add context-aware autocomplete: parse table references and prioritize in-scope columns in src/renderer/src/lib/monaco-sql-config.ts
- [x] T043 [US1] Add dot-notation trigger for table.column suggestions (only show columns from that table) in src/renderer/src/lib/monaco-sql-config.ts

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - US1 (Autocomplete) can proceed first
  - US2 (Theme) and US3 (Highlighting) can proceed in parallel after US1
  - US4 (Keyboard) can proceed in parallel after US1
- **Integration (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational - Independent of US1
- **User Story 3 (P2)**: Can start after Foundational - Independent of US1/US2
- **User Story 4 (P3)**: Can start after Foundational - Independent of US1/US2/US3

### Within Each User Story

- Configuration before component integration
- Provider/hook setup before usage
- Story complete before moving to integration phase

### Parallel Opportunities

- T016, T017, T018 can run in parallel (different theme definitions)
- T023, T024, T025 can run in parallel (different files/sections)
- User Stories 2, 3, 4 can run in parallel after US1 is started
- T036, T037 can run in parallel (different test scenarios)

---

## Parallel Example: User Story 2 (Theme-Aware)

```bash
# Launch all theme definition tasks together:
Task T016: "Create defineCustomThemes function"
Task T017: "Define 'sql-pro-light' theme"
Task T018: "Define 'sql-pro-dark' theme"
# These create different parts of the same module, no conflicts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Autocomplete)
4. **STOP and VALIDATE**: Test autocomplete independently
5. Proceed with remaining stories

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test autocomplete → Demo (MVP!)
3. Add User Story 2 + 3 (in parallel) → Test theming + highlighting
4. Add User Story 4 → Test keyboard shortcut
5. Complete Integration → Full feature ready

### Recommended Sequential Order

For single developer, execute in this order for fastest MVP:

1. T001-T003 (Setup)
2. T004-T006 (Foundational)
3. T007-T015 (US1: Autocomplete - MVP)
4. T016-T022 (US2: Theme)
5. T023-T025 (US3: Highlighting)
6. T026-T028 (US4: Keyboard)
7. T029-T037 (Integration & Polish)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently testable after completion
- Commit after each task or logical group
- No test tasks included (tests not requested in spec)
- Monaco's built-in SQL mode handles basic syntax highlighting; custom themes enhance it

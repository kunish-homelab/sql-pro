# Tasks: Connection Settings Management

**Input**: Design documents from `/specs/004-connection-settings/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/ipc-contracts.md, research.md, quickstart.md

**Tests**: Not requested in specification - skipped.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Main process**: `src/main/`
- **Preload**: `src/preload/`
- **Renderer**: `src/renderer/src/`
- **Shared types**: `src/shared/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Extend shared types and IPC infrastructure needed by all user stories

- [x] T001 [P] Add `displayName`, `readOnly`, `createdAt` fields to `RecentConnection` interface in src/shared/types.ts
- [x] T002 [P] Add `UpdateConnectionRequest`, `UpdateConnectionResponse` types in src/shared/types.ts
- [x] T003 [P] Add `RemoveConnectionRequest`, `RemoveConnectionResponse` types in src/shared/types.ts
- [x] T004 Add `CONNECTION_UPDATE` and `CONNECTION_REMOVE` to `IPC_CHANNELS` constant in src/shared/types.ts
- [x] T005 Run typecheck to verify type changes: `pnpm typecheck`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend services and IPC handlers that MUST be complete before UI work

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T006 Add `updateConnection(path, updates)` method to preferences service in src/main/services/preferences.ts
- [x] T007 Add `removeConnection(path)` method to preferences service in src/main/services/preferences.ts
- [x] T008 Add `connection:update` IPC handler in src/main/ipc/handlers.ts
- [x] T009 Add `connection:remove` IPC handler in src/main/ipc/handlers.ts
- [x] T010 [P] Add `connection.update()` and `connection.remove()` to sqlProAPI in src/preload/index.ts
- [x] T011 [P] Update type declarations for new connection APIs in src/preload/index.d.ts
- [x] T012 Run typecheck to verify backend changes: `pnpm typecheck`

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Save Connection with Custom Settings (Priority: P1) 🎯 MVP

**Goal**: Users can configure connection settings (display name, read-only mode, remember password) before connecting to a new database

**Independent Test**: Open a database, configure custom name and read-only mode, verify settings persist after reconnecting

### Implementation for User Story 1

- [x] T013 [US1] Create `ConnectionSettingsDialog.tsx` component skeleton with Dialog import in src/renderer/src/components/ConnectionSettingsDialog.tsx
- [x] T014 [US1] Add form fields: displayName input, readOnly checkbox, rememberPassword checkbox in src/renderer/src/components/ConnectionSettingsDialog.tsx
- [x] T015 [US1] Add form validation (displayName max 100 chars, non-empty) in src/renderer/src/components/ConnectionSettingsDialog.tsx
- [x] T016 [US1] Add onSubmit handler that calls parent callback with settings in src/renderer/src/components/ConnectionSettingsDialog.tsx
- [x] T017 [US1] Export `ConnectionSettingsDialog` from components barrel in src/renderer/src/components/index.ts
- [x] T018 [US1] Update `WelcomeScreen` to show `ConnectionSettingsDialog` after file selection in src/renderer/src/components/WelcomeScreen.tsx
- [x] T019 [US1] Wire dialog submission to save connection with custom settings in src/renderer/src/components/WelcomeScreen.tsx
- [x] T020 [US1] Pass `readOnly` flag to `window.sqlPro.db.open()` request in src/renderer/src/components/WelcomeScreen.tsx
- [x] T021 [US1] Handle password storage based on `rememberPassword` setting in src/renderer/src/components/WelcomeScreen.tsx
- [x] T022 [US1] Run typecheck: `pnpm typecheck`

**Checkpoint**: At this point, User Story 1 should be fully functional - users can save new connections with custom settings

---

## Phase 4: User Story 2 - View and Use Recent Connections (Priority: P1)

**Goal**: Recent connections display custom names and reconnect with saved settings (read-only, password)

**Independent Test**: Save connections with custom names, restart app, verify names display and settings apply on reconnect

### Implementation for User Story 2

- [x] T023 [US2] Update recent connection display to show `displayName` instead of `filename` when available in src/renderer/src/components/WelcomeScreen.tsx
- [x] T024 [US2] Add migration helper to handle old connections without new fields in src/renderer/src/components/WelcomeScreen.tsx (handled by fallback pattern)
- [x] T025 [US2] Update `handleRecentClick` to pass saved `readOnly` setting to db.open in src/renderer/src/components/WelcomeScreen.tsx
- [x] T026 [US2] Add visual indicator for read-only connections (icon or badge) in src/renderer/src/components/WelcomeScreen.tsx
- [ ] T027 [US2] Handle missing file error gracefully with option to remove from list in src/renderer/src/components/WelcomeScreen.tsx (deferred - enhancement)
- [x] T028 [US2] Update connection store types to include new optional fields in src/renderer/src/stores/connection-store.ts
- [x] T029 [US2] Run typecheck: `pnpm typecheck`

**Checkpoint**: At this point, User Story 2 should be fully functional - recent connections show custom names and apply saved settings

---

## Phase 5: User Story 3 - Edit Existing Connection Settings (Priority: P2)

**Goal**: Users can edit settings of saved connections via context menu

**Independent Test**: Right-click a saved connection, select Edit, modify settings, verify changes persist

### Implementation for User Story 3

- [x] T030 [US3] Add context menu component using Radix DropdownMenu to recent connection items in src/renderer/src/components/WelcomeScreen.tsx
- [x] T031 [US3] Add "Edit Settings" menu item that opens `ConnectionSettingsDialog` in edit mode in src/renderer/src/components/WelcomeScreen.tsx
- [x] T032 [US3] Add `mode` prop (new/edit) and `initialValues` prop to `ConnectionSettingsDialog` in src/renderer/src/components/ConnectionSettingsDialog.tsx
- [x] T033 [US3] Implement edit submission that calls `window.sqlPro.connection.update()` in src/renderer/src/components/WelcomeScreen.tsx
- [x] T034 [US3] Update local state after successful edit in src/renderer/src/components/WelcomeScreen.tsx
- [x] T035 [US3] Run typecheck: `pnpm typecheck`

**Checkpoint**: At this point, User Story 3 should be fully functional - users can edit existing connection settings

---

## Phase 6: User Story 4 - Rename Connection (Priority: P3)

**Goal**: Users can quickly rename connections via inline editing

**Independent Test**: Right-click and select Rename, type new name, press Enter, verify name updates

### Implementation for User Story 4

- [ ] T036 [P] [US4] Create `InlineRename.tsx` component with controlled input in src/renderer/src/components/InlineRename.tsx
- [ ] T037 [P] [US4] Add keyboard handlers: Enter to confirm, Escape to cancel in src/renderer/src/components/InlineRename.tsx
- [ ] T038 [US4] Add click-outside handler to confirm rename in src/renderer/src/components/InlineRename.tsx
- [ ] T039 [US4] Export `InlineRename` from components barrel in src/renderer/src/components/index.ts
- [ ] T040 [US4] Add "Rename" menu item to context menu in src/renderer/src/components/WelcomeScreen.tsx
- [ ] T041 [US4] Add `renamingPath` state to track which connection is being renamed in src/renderer/src/components/WelcomeScreen.tsx
- [ ] T042 [US4] Integrate `InlineRename` component into recent connection item in src/renderer/src/components/WelcomeScreen.tsx
- [ ] T043 [US4] Call `window.sqlPro.connection.update()` on rename confirm in src/renderer/src/components/WelcomeScreen.tsx
- [ ] T044 [US4] Run typecheck: `pnpm typecheck`

**Checkpoint**: At this point, User Story 4 should be fully functional - users can quickly rename connections inline

---

## Phase 7: User Story 5 - Delete Connection from List (Priority: P3)

**Goal**: Users can remove connections from the recent list with optional password cleanup

**Independent Test**: Right-click and select Remove, verify connection disappears and password is removed

### Implementation for User Story 5

- [x] T045 [US5] Add "Remove from List" menu item to context menu in src/renderer/src/components/WelcomeScreen.tsx
- [ ] T046 [US5] Add confirmation dialog for removal (optional, based on UX preference) in src/renderer/src/components/WelcomeScreen.tsx (skipped - direct removal is simpler UX)
- [x] T047 [US5] Implement `handleRemoveConnection` that calls `window.sqlPro.connection.remove()` in src/renderer/src/components/WelcomeScreen.tsx
- [x] T048 [US5] Pass `removePassword: true` to also delete saved password in src/renderer/src/components/WelcomeScreen.tsx
- [x] T049 [US5] Update local state to remove connection from list in src/renderer/src/components/WelcomeScreen.tsx
- [x] T050 [US5] Run typecheck: `pnpm typecheck`

**Checkpoint**: At this point, User Story 5 should be fully functional - users can remove connections and associated passwords

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Accessibility, refinements, and final validation

- [x] T051 [P] Ensure keyboard navigation works for context menu (Tab, Enter, Escape) in src/renderer/src/components/WelcomeScreen.tsx (Radix UI built-in)
- [x] T052 [P] Add ARIA labels to context menu items for screen readers in src/renderer/src/components/WelcomeScreen.tsx
- [x] T053 [P] Ensure focus returns to correct element after dialog closes in src/renderer/src/components/ConnectionSettingsDialog.tsx (Radix Dialog built-in)
- [x] T054 Run final typecheck: `pnpm typecheck`
- [ ] T055 Manual test: Complete user flow (save, view, edit, rename, delete connections)
- [ ] T056 Manual test: Verify settings persist across app restart

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - US1 and US2 can proceed in parallel (both P1)
  - US3 depends on context menu pattern from US3 itself
  - US4 and US5 can proceed in parallel after context menu is ready
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational - Uses settings saved by US1 but testable independently
- **User Story 3 (P2)**: Can start after Foundational - Adds context menu infrastructure used by US4/US5
- **User Story 4 (P3)**: Benefits from context menu from US3 but can be implemented independently
- **User Story 5 (P3)**: Benefits from context menu from US3 but can be implemented independently

### Within Each User Story

- Component creation before integration
- Core functionality before refinements
- Story complete before moving to next priority

### Parallel Opportunities

- T001, T002, T003 can run in parallel (different type definitions)
- T010, T011 can run in parallel (different files)
- T036, T037 can run in parallel (same component, different functions)
- T051, T052, T053 can run in parallel (different accessibility concerns)
- US1 and US2 can be worked on simultaneously
- US4 and US5 can be worked on simultaneously

---

## Parallel Example: Setup Phase

```bash
# Launch all type definition tasks together:
Task T001: "Add displayName, readOnly, createdAt to RecentConnection in src/shared/types.ts"
Task T002: "Add UpdateConnectionRequest, UpdateConnectionResponse in src/shared/types.ts"
Task T003: "Add RemoveConnectionRequest, RemoveConnectionResponse in src/shared/types.ts"
# Then sequential: T004 (adds to IPC_CHANNELS), T005 (typecheck)
```

## Parallel Example: User Story 4

```bash
# Launch component creation in parallel:
Task T036: "Create InlineRename component skeleton"
Task T037: "Add Enter/Escape keyboard handlers"
# Then sequential: T038-T044 (integration)
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Save Connection)
4. Complete Phase 4: User Story 2 (View Recent)
5. **STOP and VALIDATE**: Test saving and viewing connections
6. Proceed with remaining stories

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 + 2 → Test independently → Demo (MVP!)
3. Add User Story 3 → Test editing → Demo
4. Add User Story 4 + 5 → Test rename/delete → Demo
5. Complete Polish → Full feature ready

### Recommended Sequential Order

For single developer, execute in this order for fastest MVP:

1. T001-T005 (Setup)
2. T006-T012 (Foundational)
3. T013-T022 (US1: Save Connection - MVP core)
4. T023-T029 (US2: View Recent - MVP complete)
5. T030-T035 (US3: Edit Settings)
6. T036-T044 (US4: Rename)
7. T045-T050 (US5: Delete)
8. T051-T056 (Polish)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently testable after completion
- Commit after each task or logical group
- No test tasks included (tests not requested in spec)
- Context menu pattern established in US3 benefits US4/US5
- All IPC operations use existing electron-store and keychain infrastructure

# Feature Specification: Monaco SQL Editor

**Feature Branch**: `003-monaco-editor`
**Created**: 2025-12-26
**Status**: Draft
**Input**: User description: "使用 monaco 重构编辑器，支持明亮暗黑主题切换，支持 LSP，支持提示数据库名和表格名等"

## Clarifications

### Session 2025-12-26

- Q: Should autocomplete be case-sensitive? → A: Case-insensitive matching for all suggestions
- Q: Should the editor pane be resizable? → A: Yes, drag-to-resize for editor height

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Write SQL with Intelligent Autocomplete (Priority: P1)

As a database user, I want the SQL editor to suggest table names, column names, and SQL keywords as I type, so I can write queries faster and with fewer errors.

**Why this priority**: Autocomplete is the core productivity feature that makes Monaco Editor valuable. Without it, there's no compelling reason to switch from CodeMirror.

**Independent Test**: Can be tested by typing SQL in the editor and verifying that relevant suggestions appear based on the connected database schema.

**Acceptance Scenarios**:

1. **Given** a database is connected with tables, **When** I type `SELECT * FROM `, **Then** I see a list of available table names from the current database
2. **Given** I have typed `SELECT ` and then a table alias, **When** I type the alias followed by `.`, **Then** I see columns from the aliased table
3. **Given** I'm typing SQL, **When** I type common SQL keywords (SELECT, FROM, WHERE, JOIN, etc.), **Then** I see keyword suggestions
4. **Given** I see a suggestion list, **When** I press Tab or Enter, **Then** the selected suggestion is inserted into my query

---

### User Story 2 - Theme-Aware Editor (Priority: P2)

As a user who has set a light or dark theme preference, I want the SQL editor to automatically match my chosen theme, so the editor blends seamlessly with the rest of the application.

**Why this priority**: Visual consistency is important for user experience, but the editor is still functional without theme synchronization.

**Independent Test**: Can be tested by toggling the application theme and verifying the editor appearance changes accordingly.

**Acceptance Scenarios**:

1. **Given** the application is in dark mode, **When** I open the SQL editor, **Then** the editor uses a dark color scheme
2. **Given** the application is in light mode, **When** I open the SQL editor, **Then** the editor uses a light color scheme
3. **Given** I'm using the editor, **When** I change the application theme, **Then** the editor theme updates immediately without requiring a page refresh
4. **Given** the application is set to "system" theme, **When** the system theme changes, **Then** the editor reflects the new theme

---

### User Story 3 - SQL Syntax Highlighting (Priority: P2)

As a user writing SQL queries, I want proper syntax highlighting for SQL statements, so I can easily distinguish keywords, strings, numbers, and identifiers.

**Why this priority**: Syntax highlighting improves readability and reduces errors. It's a baseline expectation for any code editor.

**Independent Test**: Can be tested by typing various SQL statements and verifying visual differentiation of syntax elements.

**Acceptance Scenarios**:

1. **Given** I type SQL keywords (SELECT, FROM, WHERE, etc.), **When** rendered, **Then** they are visually distinct from other text
2. **Given** I type string literals ('text'), **When** rendered, **Then** they are highlighted as strings
3. **Given** I type numeric values, **When** rendered, **Then** they are highlighted as numbers
4. **Given** I type comments (-- or /\* \*/), **When** rendered, **Then** they are displayed in a comment style

---

### User Story 4 - Execute Queries with Keyboard Shortcut (Priority: P3)

As a power user, I want to execute my SQL query using Cmd/Ctrl+Enter, so I can run queries quickly without reaching for the mouse.

**Why this priority**: Preserves existing functionality from the current editor. Important for workflow but not a new capability.

**Independent Test**: Can be tested by writing a query and pressing the keyboard shortcut.

**Acceptance Scenarios**:

1. **Given** I have written a valid SQL query, **When** I press Cmd/Ctrl+Enter, **Then** the query executes and results are displayed
2. **Given** the query is executing, **When** I try to execute again, **Then** the action is ignored until the current execution completes

---

### Edge Cases

- What happens when typing in an editor with no database connected? (Suggestions should only show SQL keywords)
- How does the editor handle very long queries? (Should support scrolling and maintain performance)
- What happens when the database schema changes while the editor is open? (Suggestions should update after next schema refresh)
- How does autocomplete behave with complex queries involving subqueries or CTEs? (Should provide context-aware suggestions)

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Editor MUST replace the existing CodeMirror-based SQL editor with Monaco Editor
- **FR-002**: Editor MUST provide SQL syntax highlighting for SQLite dialect
- **FR-003**: Editor MUST synchronize its theme with the application's current theme setting (light/dark/system)
- **FR-004**: Editor MUST provide autocomplete suggestions for SQL keywords (SELECT, FROM, WHERE, JOIN, ORDER BY, GROUP BY, etc.)
- **FR-005**: Editor MUST provide autocomplete suggestions for table names from the connected database schema
- **FR-006**: Editor MUST provide autocomplete suggestions for column names when a table context is established (after table name or alias)
- **FR-007**: Editor MUST support Cmd/Ctrl+Enter keyboard shortcut to execute the current query
- **FR-008**: Editor MUST display line numbers
- **FR-009**: Editor MUST highlight the active line
- **FR-010**: Editor MUST support standard text editing operations (copy, paste, undo, redo, find/replace)
- **FR-011**: Autocomplete suggestions MUST update when the database schema changes (after reconnection or schema refresh)

### Key Entities

- **Database Schema**: Collection of tables and views, each with columns and their types. Used to populate autocomplete suggestions.
- **Editor State**: Current query text, cursor position, and selection. Managed by the editor component.
- **Theme Setting**: Application-wide preference (light/dark/system) that controls editor appearance.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can write a complete SQL query using only autocomplete suggestions for table and column names (no manual typing of schema identifiers required)
- **SC-002**: Theme changes are reflected in the editor within 100ms of the theme toggle action
- **SC-003**: Autocomplete popup appears within 200ms of triggering (typing a letter or pressing Ctrl+Space)
- **SC-004**: Editor maintains responsive typing (no perceptible lag) for queries up to 1000 lines
- **SC-005**: All existing query execution functionality (execute, history, results display) continues to work unchanged

## Assumptions

- The application already has a theme management system that can be observed for changes
- The database schema is available through the existing `useConnectionStore` hook
- Monaco Editor package is compatible with the current Electron/React setup
- SQLite dialect support is available or can be configured in Monaco

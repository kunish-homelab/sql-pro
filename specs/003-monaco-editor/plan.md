# Implementation Plan: Monaco SQL Editor

**Branch**: `003-monaco-editor` | **Date**: 2025-12-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-monaco-editor/spec.md`

## Summary

Replace the existing CodeMirror-based SQL editor with Monaco Editor to provide intelligent autocomplete for SQL keywords, table names, and column names from the connected database schema. The editor will synchronize its theme with the application's light/dark theme setting and maintain all existing functionality (execute queries via Cmd/Ctrl+Enter, query history, results display).

## Technical Context

**Language/Version**: TypeScript 5.9, React 19, Electron 39
**Primary Dependencies**: Monaco Editor (@monaco-editor/react), Zustand (state management), Radix UI (components)
**Storage**: N/A (editor state managed in React, schema from existing stores)
**Testing**: TypeScript typecheck (no test framework currently configured)
**Target Platform**: macOS, Windows, Linux (Electron desktop app)
**Project Type**: Electron app with React renderer (main/preload/renderer architecture)
**Performance Goals**: <200ms autocomplete response, no perceptible typing lag for 1000+ line queries
**Constraints**: Must work within Electron's CSP, must support both light and dark themes
**Scale/Scope**: Single editor component, integrates with existing schema from `useConnectionStore`

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                 | Status    | Notes                                                             |
| ------------------------- | --------- | ----------------------------------------------------------------- |
| I. SQLCipher First        | ✅ PASS   | Editor is read-only UI; does not affect encryption                |
| II. No Data Leakage       | ✅ PASS   | Query text is in-memory only; Monaco does not persist             |
| III. Secure by Default    | ✅ PASS   | No security-relevant defaults in editor component                 |
| IV. Preview Before Commit | N/A       | Editor does not perform write operations                          |
| V. Performance First      | ⚠️ VERIFY | Monaco must handle large queries; will configure virtualization   |
| VI. Accessibility         | ⚠️ VERIFY | Monaco has built-in accessibility; must verify keyboard nav works |
| VII. Type Safety          | ✅ PASS   | Monaco React wrapper is fully typed; schema types exist           |
| VIII. Component Isolation | ✅ PASS   | Editor runs in renderer process only; uses existing IPC           |
| IX. Test Coverage         | ⚠️ RISK   | No test framework configured; will document as tech debt          |

**Gate Result**: PASS with documented risks (test coverage deferred to future sprint)

## Phase Progress

| Phase             | Status      | Output                           |
| ----------------- | ----------- | -------------------------------- |
| Phase 0: Research | ✅ Complete | [research.md](./research.md)     |
| Phase 1: Design   | ✅ Complete | [quickstart.md](./quickstart.md) |
| Phase 2: Tasks    | ✅ Complete | [tasks.md](./tasks.md)           |

**Note**: `data-model.md` and `contracts/` are N/A - this is a UI component replacement with no new data models or API contracts.

## Project Structure

### Documentation (this feature)

```text
specs/003-monaco-editor/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (N/A - no API contracts)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── main/               # Main process (unchanged by this feature)
├── preload/            # Preload scripts (unchanged)
├── renderer/
│   └── src/
│       ├── components/
│       │   ├── QueryEditor.tsx        # MODIFY: Replace CodeMirror with Monaco
│       │   └── MonacoSqlEditor.tsx    # NEW: Monaco wrapper component
│       ├── lib/
│       │   └── monaco-sql-config.ts   # NEW: SQL language configuration
│       └── stores/
│           ├── connection-store.ts    # EXISTING: Schema source for autocomplete
│           ├── query-store.ts         # EXISTING: Query state
│           └── theme-store.ts         # EXISTING: Theme state for editor sync
└── shared/             # Shared types (unchanged)
```

**Structure Decision**: Minimal changes - new Monaco wrapper component and SQL configuration, modify existing QueryEditor to use the new component instead of CodeMirror.

## Complexity Tracking

| Violation          | Why Needed                   | Simpler Alternative Rejected Because                                                          |
| ------------------ | ---------------------------- | --------------------------------------------------------------------------------------------- |
| Test Coverage (IX) | No test framework configured | Adding testing infrastructure is out of scope for editor replacement; documented as tech debt |

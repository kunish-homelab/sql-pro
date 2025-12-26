# Implementation Plan: Connection Settings Management

**Branch**: `004-connection-settings` | **Date**: 2025-12-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-connection-settings/spec.md`

## Summary

This feature extends the existing connection management system to support saved connection profiles with custom settings (display name, read-only mode, password preferences). Users can configure connection options before connecting, rename/edit/delete saved connections, and reconnect quickly with saved settings from the welcome screen.

## Technical Context

**Language/Version**: TypeScript 5.9, React 19, Node.js (Electron 39)
**Primary Dependencies**: Zustand 5.x (state), Radix UI (dialogs/menus), better-sqlite3-multiple-ciphers
**Storage**: electron-store (preferences), system keychain (passwords via keytar)
**Testing**: Manual testing (test framework not yet configured)
**Target Platform**: macOS, Windows, Linux (Electron desktop)
**Project Type**: Electron desktop application (main/preload/renderer architecture)
**Performance Goals**: Recent connections list loads < 200ms, all operations complete < 100ms
**Constraints**: Passwords stored in keychain only (never in config files), context isolation enforced
**Scale/Scope**: Up to 10 recent connections (configurable), single-user desktop app

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                 | Status      | Notes                                                            |
| ------------------------- | ----------- | ---------------------------------------------------------------- |
| I. SQLCipher First        | ✅ PASS     | Extends existing encryption support, password handling unchanged |
| II. No Data Leakage       | ✅ PASS     | Passwords stored in keychain only, never in preferences          |
| III. Secure by Default    | ✅ PASS     | Read-only mode available, encryption prompt preserved            |
| IV. Preview Before Commit | ⚪ N/A      | No destructive data operations in this feature                   |
| V. Performance First      | ✅ PASS     | Recent list loads < 200ms, no memory concerns                    |
| VI. Accessibility         | ⚠️ WATCH    | Must ensure keyboard nav for context menu, inline rename         |
| VII. Type Safety          | ✅ PASS     | All IPC contracts will be typed                                  |
| VIII. Component Isolation | ✅ PASS     | UI in renderer, storage in main, IPC bridge defined              |
| IX. Test Coverage         | ⚠️ DEFERRED | Project lacks test framework; tests not requested in spec        |

**Gate Status**: PASS (no blocking violations)

## Project Structure

### Documentation (this feature)

```text
specs/004-connection-settings/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── main/
│   ├── services/
│   │   ├── database.ts           # Existing - add read-only support
│   │   ├── preferences.ts        # Existing - extend for connection profiles
│   │   └── password.ts           # Existing - no changes needed
│   └── ipc/
│       └── handlers.ts           # Existing - add new IPC handlers
├── preload/
│   └── index.ts                  # Existing - expose new APIs
├── renderer/
│   └── src/
│       ├── components/
│       │   ├── WelcomeScreen.tsx           # Existing - add context menu
│       │   ├── ConnectionSettingsDialog.tsx # NEW - settings before connect
│       │   └── InlineRename.tsx            # NEW - inline edit component
│       ├── stores/
│       │   └── connection-store.ts         # Existing - extend type
│       └── types/
│           └── database.ts                 # Existing - extend types
└── shared/
    └── types.ts                  # Existing - add new IPC contracts
```

**Structure Decision**: Extends existing Electron architecture. New components added to renderer, new IPC handlers to main. No structural changes.

## Complexity Tracking

> No constitution violations requiring justification.

| Decision                     | Rationale                                                 |
| ---------------------------- | --------------------------------------------------------- |
| Extend RecentConnection type | Adding fields to existing type is simpler than new entity |
| Single settings dialog       | Reuse for both new connections and editing existing       |
| Context menu over dropdown   | Standard desktop UX pattern, keyboard accessible          |

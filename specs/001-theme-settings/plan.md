# Implementation Plan: Theme Settings (Light/Dark Mode)

**Branch**: `001-theme-settings` | **Date**: 2025-12-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-theme-settings/spec.md`

## Summary

Add user-controllable theme switching with three options (Light, Dark, Follow System). The application already has CSS theming infrastructure with `.dark` class and color variables. Implementation requires: (1) theme preference store, (2) settings UI component, (3) system theme detection, and (4) preference persistence via existing IPC channels.

## Technical Context

**Language/Version**: TypeScript 5.9, React 19, Electron 39
**Primary Dependencies**: Zustand (state management), Tailwind CSS 4 (styling), Radix UI (components)
**Storage**: Local JSON file via existing preferences IPC (`app:getPreferences`, `app:setPreferences`)
**Testing**: Manual testing (no test framework currently configured)
**Target Platform**: macOS, Windows, Linux (Electron desktop)
**Project Type**: Electron app (main + preload + renderer)
**Performance Goals**: Theme switch < 100ms, no visible flash on app load
**Constraints**: Must work offline, no external API dependencies
**Scale/Scope**: Single-user desktop application

### Existing Infrastructure (No Changes Needed)

- **CSS Variables**: `globals.css` has light/dark theme variables via `:root` and `.dark` class
- **Preferences Type**: `src/shared/types.ts` already defines `theme: 'light' | 'dark' | 'system'`
- **IPC Channels**: `APP_GET_PREFERENCES` and `APP_SET_PREFERENCES` already exist
- **Preload API**: `window.sqlPro.app.getPreferences()` and `setPreferences()` exposed

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                 | Requirement                            | Status   | Notes                                                |
| ------------------------- | -------------------------------------- | -------- | ---------------------------------------------------- |
| I. SQLCipher First        | N/A for this feature                   | ✅ PASS  | Theme settings don't involve database operations     |
| II. No Data Leakage       | Theme preference is not sensitive data | ✅ PASS  | Only stores 'light'/'dark'/'system' string           |
| III. Secure by Default    | Default to "Follow System"             | ✅ PASS  | FR-006 specifies system default                      |
| IV. Preview Before Commit | N/A for this feature                   | ✅ PASS  | No destructive operations                            |
| V. Performance First      | Instant theme switching                | ✅ PASS  | CSS class toggle is O(1)                             |
| VI. Accessibility         | Contrast ratios maintained             | ⚠️ CHECK | Both themes must meet WCAG AA                        |
| VII. Type Safety          | Typed theme values                     | ✅ PASS  | Type already exists: `'light' \| 'dark' \| 'system'` |
| VIII. Component Isolation | UI in renderer only                    | ✅ PASS  | Theme logic stays in renderer process                |
| IX. Test Coverage         | No test framework                      | ⚠️ DEFER | Add manual testing checklist                         |

**Gate Result**: ✅ PASS - No constitutional violations. Accessibility will be verified during implementation.

## Project Structure

### Documentation (this feature)

```text
specs/001-theme-settings/
├── plan.md              # This file
├── research.md          # Phase 0: Technology decisions
├── data-model.md        # Phase 1: Theme store interface
├── quickstart.md        # Phase 1: Implementation guide
├── contracts/           # Phase 1: IPC contract updates (if any)
└── tasks.md             # Phase 2: Implementation tasks (via /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── main/
│   └── services/
│       └── ipc-handlers.ts    # [MODIFY] Ensure preferences persistence works
├── preload/
│   └── index.ts               # [NO CHANGE] Already exposes preferences API
├── renderer/
│   └── src/
│       ├── components/
│       │   └── ThemeToggle.tsx    # [NEW] Theme selector component
│       ├── stores/
│       │   └── theme-store.ts     # [NEW] Theme state management
│       ├── hooks/
│       │   └── use-theme.ts       # [NEW] Theme hook with system detection
│       └── App.tsx                # [MODIFY] Apply theme class to root
└── shared/
    └── types.ts                   # [NO CHANGE] Already has Preferences type
```

**Structure Decision**: Minimal changes - leverage existing infrastructure. Add only:

- 1 new store (`theme-store.ts`)
- 1 new hook (`use-theme.ts`)
- 1 new component (`ThemeToggle.tsx`)
- Modify `App.tsx` to apply theme

## Complexity Tracking

> No constitutional violations requiring justification.

| Aspect                 | Decision             | Rationale                                    |
| ---------------------- | -------------------- | -------------------------------------------- |
| State Management       | New Zustand store    | Consistent with existing stores pattern      |
| Settings UI            | Dropdown in titlebar | Quick access (2 clicks) per FR-007           |
| System Theme Detection | `matchMedia` API     | Standard browser API, no Electron IPC needed |

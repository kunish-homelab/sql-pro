# Data Model: Theme Settings

**Feature**: 001-theme-settings
**Date**: 2025-12-26

## Entities

### ThemePreference (Enum)

Represents the user's theme selection choice.

```typescript
type ThemePreference = 'light' | 'dark' | 'system';
```

| Value      | Description                                |
| ---------- | ------------------------------------------ |
| `'light'`  | Force light theme regardless of OS setting |
| `'dark'`   | Force dark theme regardless of OS setting  |
| `'system'` | Follow OS theme preference (default)       |

**Storage**: Part of `Preferences` object in local JSON file (`~/.sql-pro/preferences.json`)

---

### ResolvedTheme (Derived)

The actual theme applied to the UI after resolving 'system' preference.

```typescript
type ResolvedTheme = 'light' | 'dark';
```

**Note**: This is computed, not stored. When `ThemePreference` is `'system'`, `ResolvedTheme` is determined by OS preference.

---

### ThemeState (Zustand Store Interface)

```typescript
interface ThemeState {
  // State
  preference: ThemePreference; // User's stored preference
  resolvedTheme: ResolvedTheme; // Currently applied theme
  isLoading: boolean; // True during initial load from preferences

  // Actions
  setTheme: (theme: ThemePreference) => Promise<void>; // Change preference & persist
  initialize: () => Promise<void>; // Load from preferences on app start
}
```

---

## State Transitions

```
┌─────────────────────────────────────────────────────────────────┐
│                        App Startup                              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  Load preferences      │
              │  (getPreferences IPC)  │
              └────────────┬───────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  Resolve theme         │
              │  (if 'system', check   │
              │   matchMedia)          │
              └────────────┬───────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  Apply to DOM          │
              │  (add/remove .dark)    │
              └────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     User Changes Theme                          │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  Update store          │
              │  preference            │
              └────────────┬───────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  Persist via           │
              │  setPreferences IPC    │
              └────────────┬───────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  Resolve & apply       │
              │  to DOM                │
              └────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│              OS Theme Changes (when preference='system')        │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  matchMedia listener   │
              │  fires 'change' event  │
              └────────────┬───────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  Update resolvedTheme  │
              │  & apply to DOM        │
              └────────────────────────┘
```

---

## Validation Rules

| Field           | Rule                                           | Error Handling                       |
| --------------- | ---------------------------------------------- | ------------------------------------ |
| `preference`    | Must be one of `'light'`, `'dark'`, `'system'` | Default to `'system'` if invalid     |
| `resolvedTheme` | Computed from `preference` and OS              | Always valid (`'light'` or `'dark'`) |

---

## Persistence

**Location**: Existing preferences file (managed by main process)
**Format**: JSON within `Preferences` object

```json
{
  "theme": "system",
  "defaultPageSize": 50,
  "confirmBeforeApply": true,
  "recentConnectionsLimit": 10
}
```

**IPC Channels Used**:

- `app:getPreferences` - Read current preferences
- `app:setPreferences` - Update preferences (partial update supported)

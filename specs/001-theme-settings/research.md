# Research: Theme Settings Implementation

**Feature**: 001-theme-settings
**Date**: 2025-12-26

## Research Summary

This feature requires minimal research as the existing codebase already provides most of the infrastructure. Key decisions documented below.

---

## Decision 1: Theme State Management

**Question**: How should theme state be managed in the renderer process?

**Decision**: Create a new Zustand store (`theme-store.ts`)

**Rationale**:

- Consistent with existing patterns (`connection-store`, `table-data-store`, etc.)
- Zustand already installed and configured
- Simple API for reading/writing theme preference
- Supports persistence via `window.sqlPro.app` methods

**Alternatives Considered**:
| Alternative | Why Rejected |
|-------------|--------------|
| React Context | Not as convenient as Zustand for global state; would add new pattern |
| Local Storage directly | Would bypass existing preferences system; inconsistent |
| CSS-only (media query) | Can't support manual override while also supporting "follow system" |

---

## Decision 2: System Theme Detection

**Question**: How to detect and respond to OS theme changes?

**Decision**: Use `window.matchMedia('(prefers-color-scheme: dark)')` API

**Rationale**:

- Standard Web API, works in Electron renderer
- Supports both initial detection and real-time updates via `addEventListener('change')`
- No Electron IPC needed for this specific functionality
- Cross-platform (macOS, Windows, Linux)

**Implementation Pattern**:

```typescript
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
const systemIsDark = mediaQuery.matches;

// Listen for changes
mediaQuery.addEventListener('change', (e) => {
  if (themePreference === 'system') {
    applyTheme(e.matches ? 'dark' : 'light');
  }
});
```

**Alternatives Considered**:
| Alternative | Why Rejected |
|-------------|--------------|
| Electron `nativeTheme` API | Requires IPC; overkill when CSS media query works |
| Poll `prefers-color-scheme` | Inefficient; event listener is better |

---

## Decision 3: Theme Application Method

**Question**: How should the theme be applied to the UI?

**Decision**: Toggle `.dark` class on `document.documentElement` (HTML root)

**Rationale**:

- Existing `globals.css` already defines `.dark` class with all color variables
- Tailwind CSS v4 expects class-based dark mode
- Instant application, no re-render needed
- Works with all existing components

**Implementation Pattern**:

```typescript
function applyTheme(resolvedTheme: 'light' | 'dark') {
  if (resolvedTheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}
```

---

## Decision 4: Settings UI Placement

**Question**: Where should the theme toggle be placed?

**Decision**: Dropdown menu in the titlebar area, accessible from both Welcome screen and Database view

**Rationale**:

- Meets FR-007 requirement: visible settings entry point
- Meets SC-001: accessible within 2 clicks
- Titlebar has space available (right side, before window controls)
- Consistent with modern desktop app patterns (VS Code, Figma, etc.)

**UI Component Choice**: Radix UI `DropdownMenu` with icons (Sun/Moon/Monitor)

---

## Decision 5: Flash Prevention on App Load

**Question**: How to prevent white flash when app loads in dark mode?

**Decision**: Apply theme class in `main.tsx` before React renders, based on stored preference or system default

**Implementation Pattern**:

```typescript
// In main.tsx, BEFORE ReactDOM.createRoot()
async function initializeTheme() {
  const result = await window.sqlPro.app.getPreferences();
  const preference = result.preferences?.theme || 'system';

  let resolvedTheme: 'light' | 'dark';
  if (preference === 'system') {
    resolvedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } else {
    resolvedTheme = preference;
  }

  if (resolvedTheme === 'dark') {
    document.documentElement.classList.add('dark');
  }
}

await initializeTheme();
ReactDOM.createRoot(...);
```

---

## Research Conclusions

No NEEDS CLARIFICATION items remain. All technical decisions have clear implementation paths using existing infrastructure.

### Files to Create

1. `src/renderer/src/stores/theme-store.ts` - Theme state management
2. `src/renderer/src/hooks/use-theme.ts` - Theme hook with system detection
3. `src/renderer/src/components/ThemeToggle.tsx` - Settings UI component

### Files to Modify

1. `src/renderer/src/main.tsx` - Initialize theme before render
2. `src/renderer/src/App.tsx` - Integrate ThemeToggle component
3. `src/renderer/src/stores/index.ts` - Export new store

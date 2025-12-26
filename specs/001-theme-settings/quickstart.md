# Quickstart: Theme Settings Implementation

**Feature**: 001-theme-settings
**Date**: 2025-12-26

## Overview

This guide provides step-by-step instructions for implementing theme switching functionality. The implementation leverages existing infrastructure (CSS variables, preferences IPC) and adds minimal new code.

## Prerequisites

- Branch: `001-theme-settings`
- Existing CSS dark mode variables in `globals.css` ✅
- Existing `Preferences` type with `theme` field ✅
- Existing IPC handlers for preferences ✅

---

## Implementation Steps

### Step 1: Create Theme Store

**File**: `src/renderer/src/stores/theme-store.ts`

```typescript
import { create } from 'zustand';

type ThemePreference = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

interface ThemeState {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  isLoading: boolean;
  setTheme: (theme: ThemePreference) => Promise<void>;
  initialize: () => Promise<void>;
}

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function applyTheme(theme: ResolvedTheme) {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  preference: 'system',
  resolvedTheme: getSystemTheme(),
  isLoading: true,

  setTheme: async (theme) => {
    const resolved = theme === 'system' ? getSystemTheme() : theme;
    set({ preference: theme, resolvedTheme: resolved });
    applyTheme(resolved);

    // Persist preference
    await window.sqlPro.app.setPreferences({ theme });
  },

  initialize: async () => {
    const result = await window.sqlPro.app.getPreferences();
    const preference = result.preferences?.theme || 'system';
    const resolved = preference === 'system' ? getSystemTheme() : preference;

    set({ preference, resolvedTheme: resolved, isLoading: false });
    applyTheme(resolved);

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e) => {
      const { preference } = get();
      if (preference === 'system') {
        const newResolved = e.matches ? 'dark' : 'light';
        set({ resolvedTheme: newResolved });
        applyTheme(newResolved);
      }
    });
  },
}));
```

---

### Step 2: Create Theme Hook (Optional, for convenience)

**File**: `src/renderer/src/hooks/use-theme.ts`

```typescript
import { useThemeStore } from '@/stores/theme-store';

export function useTheme() {
  const { preference, resolvedTheme, isLoading, setTheme } = useThemeStore();
  return { preference, resolvedTheme, isLoading, setTheme };
}
```

---

### Step 3: Create ThemeToggle Component

**File**: `src/renderer/src/components/ThemeToggle.tsx`

```typescript
import { Sun, Moon, Monitor } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useThemeStore } from '@/stores/theme-store';

const themeOptions = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const;

export function ThemeToggle() {
  const { preference, resolvedTheme, setTheme } = useThemeStore();

  const currentIcon = resolvedTheme === 'dark' ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="titlebar-no-drag">
          <currentIcon className="h-4 w-4" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {themeOptions.map(({ value, label, icon: Icon }) => (
          <DropdownMenuItem
            key={value}
            onClick={() => setTheme(value)}
            className={preference === value ? 'bg-accent' : ''}
          >
            <Icon className="mr-2 h-4 w-4" />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

---

### Step 4: Update Store Exports

**File**: `src/renderer/src/stores/index.ts`

```typescript
export { useConnectionStore } from './connection-store';
export { useTableDataStore } from './table-data-store';
export { useChangesStore } from './changes-store';
export { useQueryStore } from './query-store';
export { useThemeStore } from './theme-store'; // ADD THIS LINE
```

---

### Step 5: Initialize Theme Before React Renders

**File**: `src/renderer/src/main.tsx`

```typescript
import './styles/globals.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Initialize theme BEFORE React renders to prevent flash
async function initializeApp() {
  // Apply theme immediately from preferences
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

  // Now render React
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

initializeApp();
```

---

### Step 6: Add ThemeToggle to Titlebar

**File**: `src/renderer/src/App.tsx`

```typescript
import { useEffect } from 'react';
import { useConnectionStore, useThemeStore } from '@/stores';
import { WelcomeScreen } from '@/components/WelcomeScreen';
import { DatabaseView } from '@/components/DatabaseView';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeToggle } from '@/components/ThemeToggle';

function App(): React.JSX.Element {
  const { connection, setRecentConnections } = useConnectionStore();
  const { initialize } = useThemeStore();

  useEffect(() => {
    initialize();  // Initialize theme store
  }, [initialize]);

  useEffect(() => {
    const loadRecentConnections = async () => {
      const result = await window.sqlPro.app.getRecentConnections();
      if (result.success && result.connections) {
        setRecentConnections(result.connections);
      }
    };
    loadRecentConnections();
  }, [setRecentConnections]);

  return (
    <TooltipProvider>
      <div className="flex h-screen flex-col bg-background text-foreground">
        {/* Titlebar with theme toggle */}
        <div className="titlebar flex h-10 shrink-0 items-center justify-end border-b border-border/50 px-3">
          <ThemeToggle />
        </div>
        {connection ? <DatabaseView /> : <WelcomeScreen />}
      </div>
    </TooltipProvider>
  );
}

export default App;
```

---

## Testing Checklist

- [ ] Theme defaults to "System" on fresh install
- [ ] Selecting "Light" applies light theme immediately
- [ ] Selecting "Dark" applies dark theme immediately
- [ ] Selecting "System" follows OS theme
- [ ] Theme preference persists after app restart
- [ ] Changing OS theme updates app when "System" is selected
- [ ] No white flash when app starts in dark mode
- [ ] Theme toggle is accessible within 2 clicks
- [ ] All UI elements update with theme change

---

## Files Changed Summary

| File                                          | Action                   |
| --------------------------------------------- | ------------------------ |
| `src/renderer/src/stores/theme-store.ts`      | CREATE                   |
| `src/renderer/src/hooks/use-theme.ts`         | CREATE (optional)        |
| `src/renderer/src/components/ThemeToggle.tsx` | CREATE                   |
| `src/renderer/src/stores/index.ts`            | MODIFY (add export)      |
| `src/renderer/src/main.tsx`                   | MODIFY (add theme init)  |
| `src/renderer/src/App.tsx`                    | MODIFY (add ThemeToggle) |

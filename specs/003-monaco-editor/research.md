# Phase 0 Research: Monaco SQL Editor

**Branch**: `003-monaco-editor` | **Date**: 2025-12-26 | **Spec**: [spec.md](./spec.md)

## Research Questions

### RQ-1: How to integrate Monaco Editor with React in an Electron/Vite environment?

**Finding**: Use `@monaco-editor/react` package which provides a clean React wrapper around Monaco Editor.

**Integration Approach**:

```tsx
import Editor from '@monaco-editor/react';
import { loader } from '@monaco-editor/react';

// For Vite/Electron, configure worker loading
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';

self.MonacoEnvironment = {
  getWorker(_, label) {
    return new editorWorker();
  },
};

loader.config({ monaco });
```

**Key Props**:

- `beforeMount`: Configure Monaco before editor mounts (register completions, themes)
- `onMount`: Access editor instance after mount
- `onChange`: Handle content changes
- `theme`: "light" | "vs-dark" or custom theme name

**Decision**: Use `@monaco-editor/react` with local monaco-editor package (not CDN) for offline Electron support.

---

### RQ-2: How to implement SQL autocomplete for table and column names?

**Finding**: Use `monaco.languages.registerCompletionItemProvider()` in `beforeMount` hook.

**Implementation Pattern**:

```typescript
monaco.languages.registerCompletionItemProvider('sql', {
  provideCompletionItems: (model, position) => {
    const word = model.getWordUntilPosition(position);
    const range = {
      startLineNumber: position.lineNumber,
      endLineNumber: position.lineNumber,
      startColumn: word.startColumn,
      endColumn: word.endColumn,
    };

    // Build suggestions from schema
    const tableSuggestions = schema.tables.map((table) => ({
      label: table.name,
      kind: monaco.languages.CompletionItemKind.Class,
      documentation: `Table: ${table.name}`,
      insertText: table.name,
      range,
    }));

    return { suggestions: tableSuggestions };
  },
});
```

**Schema Source**: `useConnectionStore().schema` provides `DatabaseSchema` with:

- `tables: TableSchema[]` - each with `name` and `columns: ColumnSchema[]`
- `views: TableSchema[]`

**Decision**: Register completion provider in `beforeMount`, fetch schema from Zustand store.

---

### RQ-3: How to synchronize Monaco theme with app light/dark theme?

**Finding**: Define custom themes with `monaco.editor.defineTheme()` and switch dynamically.

**Theme Sync Pattern**:

```typescript
// In beforeMount
monaco.editor.defineTheme('sql-pro-light', {
  base: 'vs',
  inherit: true,
  rules: [],
  colors: {}
});

monaco.editor.defineTheme('sql-pro-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [],
  colors: {}
});

// React component subscribes to theme store
const { theme } = useThemeStore();
const isDark = theme === 'dark' ||
  (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

<Editor theme={isDark ? 'sql-pro-dark' : 'sql-pro-light'} />
```

**Decision**: Create two custom themes that match app styling, switch based on `useThemeStore`.

---

### RQ-4: How to preserve Cmd/Ctrl+Enter for query execution?

**Finding**: Use `editor.addCommand()` in `onMount` callback.

**Pattern**:

```typescript
function handleMount(editor, monaco) {
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () =>
    handleExecute()
  );
}
```

**Decision**: Register keyboard shortcut in `onMount`, call existing `handleExecute` function.

---

### RQ-5: Vite/Electron worker configuration?

**Finding**: Monaco Editor requires web workers. In Vite, use `?worker` import syntax.

**Minimal Worker Setup** (SQL only - no TypeScript/JSON workers needed):

```typescript
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';

self.MonacoEnvironment = {
  getWorker() {
    return new editorWorker();
  },
};
```

**Decision**: Only import editor worker (not language-specific workers) since we only need SQL.

---

## Dependencies to Add

| Package                | Version | Purpose                                     |
| ---------------------- | ------- | ------------------------------------------- |
| `@monaco-editor/react` | ^4.6.0  | React wrapper for Monaco                    |
| `monaco-editor`        | ^0.52.0 | Monaco core (required for Vite integration) |

## Dependencies to Remove

| Package                 | Reason             |
| ----------------------- | ------------------ |
| `@uiw/react-codemirror` | Replaced by Monaco |
| `@codemirror/lang-sql`  | No longer needed   |

## Architecture Decisions

### AD-1: Component Structure

**Decision**: Create `MonacoSqlEditor.tsx` wrapper component

**Rationale**:

- Encapsulates Monaco configuration (workers, themes, completions)
- QueryEditor.tsx remains focused on query execution logic
- Easier to test and maintain

**Structure**:

```
src/renderer/src/
├── components/
│   ├── QueryEditor.tsx          # Uses MonacoSqlEditor
│   └── MonacoSqlEditor.tsx      # NEW: Monaco wrapper
└── lib/
    └── monaco-sql-config.ts     # NEW: SQL completions, themes
```

### AD-2: Schema Reactivity

**Decision**: Pass schema as prop to MonacoSqlEditor, re-register completions on change

**Rationale**:

- Completions need to update when user connects to different database
- Monaco's `registerCompletionItemProvider` returns a disposable
- Component should dispose and re-register on schema change

### AD-3: Theme Integration

**Decision**: Use controlled `theme` prop, not internal state

**Rationale**:

- Theme state already managed by `useThemeStore`
- Single source of truth for theming
- Monaco supports dynamic theme switching

## Risk Mitigations

| Risk                      | Mitigation                                                       |
| ------------------------- | ---------------------------------------------------------------- |
| Monaco bundle size (~2MB) | Already in Electron, no network cost; can code-split if needed   |
| Worker CSP issues         | Use `loader.config({ monaco })` with local package               |
| No SQL language worker    | SQL highlighting works without worker; only editor worker needed |

## Open Questions (Resolved)

1. ~~LSP support?~~ **Deferred** - Monaco's built-in SQL mode is sufficient for autocomplete. Full LSP would require a language server process.

2. ~~Multiple editor instances?~~ **N/A** - Only one query editor per connection, no multi-model needed.

## Next Steps

1. Generate `quickstart.md` with implementation guide
2. Generate `tasks.md` via `/speckit.tasks`
3. Implement feature

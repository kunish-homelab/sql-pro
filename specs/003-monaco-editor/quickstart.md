# Quickstart: Monaco SQL Editor Implementation

**Branch**: `003-monaco-editor` | **Date**: 2025-12-26 | **Spec**: [spec.md](./spec.md)

## Prerequisites

Before implementing, ensure you have read:

- [spec.md](./spec.md) - Feature specification
- [research.md](./research.md) - Research findings and architecture decisions

## Step 1: Install Dependencies

```bash
# Add Monaco packages
pnpm add @monaco-editor/react monaco-editor

# Remove CodeMirror packages
pnpm remove @uiw/react-codemirror @codemirror/lang-sql
```

## Step 2: Configure Vite for Monaco Workers

Update `electron.vite.config.ts` to handle Monaco worker imports:

```typescript
// No changes needed - Vite handles ?worker imports natively
// Workers are bundled automatically with ?worker suffix
```

## Step 3: Create Monaco Configuration Module

Create `src/renderer/src/lib/monaco-sql-config.ts`:

```typescript
import type * as Monaco from 'monaco-editor';
import type { DatabaseSchema } from '@/types/database';

// SQL Keywords for autocomplete
const SQL_KEYWORDS = [
  'SELECT',
  'FROM',
  'WHERE',
  'AND',
  'OR',
  'NOT',
  'IN',
  'LIKE',
  'ORDER BY',
  'GROUP BY',
  'HAVING',
  'LIMIT',
  'OFFSET',
  'INSERT INTO',
  'VALUES',
  'UPDATE',
  'SET',
  'DELETE FROM',
  'CREATE TABLE',
  'DROP TABLE',
  'ALTER TABLE',
  'JOIN',
  'LEFT JOIN',
  'RIGHT JOIN',
  'INNER JOIN',
  'OUTER JOIN',
  'ON',
  'AS',
  'DISTINCT',
  'COUNT',
  'SUM',
  'AVG',
  'MIN',
  'MAX',
  'NULL',
  'IS NULL',
  'IS NOT NULL',
  'BETWEEN',
  'CASE',
  'WHEN',
  'THEN',
  'ELSE',
  'END',
];

export function createSqlCompletionProvider(
  monaco: typeof Monaco,
  schema: DatabaseSchema | null
): Monaco.languages.CompletionItemProvider {
  return {
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const suggestions: Monaco.languages.CompletionItem[] = [];

      // SQL Keywords
      SQL_KEYWORDS.forEach((keyword) => {
        suggestions.push({
          label: keyword,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: keyword,
          range,
        });
      });

      // Table names from schema
      if (schema) {
        schema.tables.forEach((table) => {
          suggestions.push({
            label: table.name,
            kind: monaco.languages.CompletionItemKind.Class,
            detail: 'Table',
            documentation: `Columns: ${table.columns.map((c) => c.name).join(', ')}`,
            insertText: table.name,
            range,
          });

          // Column names
          table.columns.forEach((column) => {
            suggestions.push({
              label: `${table.name}.${column.name}`,
              kind: monaco.languages.CompletionItemKind.Field,
              detail: column.type,
              documentation: `${column.nullable ? 'NULL' : 'NOT NULL'}${column.isPrimaryKey ? ' PRIMARY KEY' : ''}`,
              insertText: `${table.name}.${column.name}`,
              range,
            });

            // Also add just the column name for simpler queries
            suggestions.push({
              label: column.name,
              kind: monaco.languages.CompletionItemKind.Field,
              detail: `${table.name}.${column.type}`,
              insertText: column.name,
              range,
            });
          });
        });

        // Views
        schema.views.forEach((view) => {
          suggestions.push({
            label: view.name,
            kind: monaco.languages.CompletionItemKind.Interface,
            detail: 'View',
            insertText: view.name,
            range,
          });
        });
      }

      return { suggestions };
    },
  };
}

export function defineCustomThemes(monaco: typeof Monaco): void {
  // Light theme matching app colors
  monaco.editor.defineTheme('sql-pro-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: '0000FF', fontStyle: 'bold' },
      { token: 'string', foreground: 'A31515' },
      { token: 'number', foreground: '098658' },
      { token: 'comment', foreground: '008000', fontStyle: 'italic' },
    ],
    colors: {
      'editor.background': '#FFFFFF',
      'editor.foreground': '#000000',
      'editorLineNumber.foreground': '#6E7781',
      'editor.selectionBackground': '#ADD6FF',
      'editor.lineHighlightBackground': '#F5F5F5',
    },
  });

  // Dark theme matching app colors
  monaco.editor.defineTheme('sql-pro-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: '569CD6', fontStyle: 'bold' },
      { token: 'string', foreground: 'CE9178' },
      { token: 'number', foreground: 'B5CEA8' },
      { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
    ],
    colors: {
      'editor.background': '#1E1E1E',
      'editor.foreground': '#D4D4D4',
      'editorLineNumber.foreground': '#858585',
      'editor.selectionBackground': '#264F78',
      'editor.lineHighlightBackground': '#2A2A2A',
    },
  });
}
```

## Step 4: Create MonacoSqlEditor Component

Create `src/renderer/src/components/MonacoSqlEditor.tsx`:

```typescript
import { useRef, useEffect, useCallback } from 'react';
import Editor, { loader, OnMount, BeforeMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import type { DatabaseSchema } from '@/types/database';
import { useThemeStore } from '@/stores';
import { createSqlCompletionProvider, defineCustomThemes } from '@/lib/monaco-sql-config';

// Configure Monaco to use local package
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';

self.MonacoEnvironment = {
  getWorker() {
    return new editorWorker();
  }
};

loader.config({ monaco });

interface MonacoSqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute: () => void;
  schema: DatabaseSchema | null;
  height?: string;
  placeholder?: string;
}

export function MonacoSqlEditor({
  value,
  onChange,
  onExecute,
  schema,
  height = '150px',
  placeholder = 'Enter your SQL query here...'
}: MonacoSqlEditorProps) {
  const { theme } = useThemeStore();
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const completionDisposableRef = useRef<Monaco.IDisposable | null>(null);

  // Determine effective theme
  const isDark = theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const editorTheme = isDark ? 'sql-pro-dark' : 'sql-pro-light';

  // Configure Monaco before mount
  const handleBeforeMount: BeforeMount = useCallback((monaco) => {
    defineCustomThemes(monaco);
  }, []);

  // Setup after editor mounts
  const handleMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;

    // Register Cmd/Ctrl+Enter shortcut
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
      () => onExecute()
    );

    // Register initial completion provider
    completionDisposableRef.current = monaco.languages.registerCompletionItemProvider(
      'sql',
      createSqlCompletionProvider(monaco, schema)
    );

    // Focus editor
    editor.focus();
  }, [onExecute, schema]);

  // Update completion provider when schema changes
  useEffect(() => {
    if (!editorRef.current) return;

    // Dispose old provider
    if (completionDisposableRef.current) {
      completionDisposableRef.current.dispose();
    }

    // Register new provider with updated schema
    import('monaco-editor').then((monaco) => {
      completionDisposableRef.current = monaco.languages.registerCompletionItemProvider(
        'sql',
        createSqlCompletionProvider(monaco, schema)
      );
    });
  }, [schema]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (completionDisposableRef.current) {
        completionDisposableRef.current.dispose();
      }
    };
  }, []);

  const handleChange = useCallback((value: string | undefined) => {
    onChange(value || '');
  }, [onChange]);

  return (
    <Editor
      height={height}
      defaultLanguage="sql"
      value={value}
      onChange={handleChange}
      beforeMount={handleBeforeMount}
      onMount={handleMount}
      theme={editorTheme}
      options={{
        minimap: { enabled: false },
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        fontSize: 13,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        tabSize: 2,
        wordWrap: 'on',
        placeholder,
        padding: { top: 8, bottom: 8 },
        renderLineHighlight: 'line',
        quickSuggestions: true,
        suggestOnTriggerCharacters: true,
        acceptSuggestionOnEnter: 'on',
        folding: false,
        glyphMargin: false
      }}
    />
  );
}
```

## Step 5: Update QueryEditor Component

Modify `src/renderer/src/components/QueryEditor.tsx`:

```typescript
// Replace CodeMirror import
- import CodeMirror from '@uiw/react-codemirror';
- import { sql, SQLite } from '@codemirror/lang-sql';
+ import { MonacoSqlEditor } from './MonacoSqlEditor';

// In the component, remove the CodeMirror element and replace with:
- <div className="shrink-0 border-b" onKeyDown={handleKeyDown}>
-   <CodeMirror
-     value={currentQuery}
-     onChange={setCurrentQuery}
-     extensions={[sql({ dialect: SQLite })]}
-     height="150px"
-     theme="light"
-     placeholder="Enter your SQL query here..."
-     basicSetup={{...}}
-   />
- </div>

+ <div className="shrink-0 border-b">
+   <MonacoSqlEditor
+     value={currentQuery}
+     onChange={setCurrentQuery}
+     onExecute={handleExecute}
+     schema={schema}
+     height="150px"
+   />
+ </div>

// Remove the handleKeyDown callback since MonacoSqlEditor handles Cmd+Enter internally
```

## Step 6: Verify Implementation

Run the application and verify:

1. **Editor renders** - Monaco editor appears in place of CodeMirror
2. **Theme sync** - Toggle light/dark mode, editor theme should update
3. **Autocomplete** - Type `SEL` and see SQL keywords suggested
4. **Schema autocomplete** - Connect to a database, type table name prefix
5. **Execute shortcut** - Press Cmd/Ctrl+Enter to execute query
6. **Query history** - Verify history panel still works

## Troubleshooting

### Worker not loading

- Ensure `monaco-editor` package is installed (not just `@monaco-editor/react`)
- Check browser console for worker errors

### Autocomplete not showing schema

- Verify `useConnectionStore().schema` has data
- Check that completion provider is registered after schema loads

### Theme not changing

- Verify `useThemeStore()` is correctly subscribed
- Check that custom themes are defined before editor mounts

## Files Changed Summary

| File                                              | Change                                 |
| ------------------------------------------------- | -------------------------------------- |
| `package.json`                                    | Add monaco packages, remove codemirror |
| `src/renderer/src/lib/monaco-sql-config.ts`       | NEW: SQL completions and themes        |
| `src/renderer/src/components/MonacoSqlEditor.tsx` | NEW: Monaco wrapper component          |
| `src/renderer/src/components/QueryEditor.tsx`     | MODIFY: Use MonacoSqlEditor            |

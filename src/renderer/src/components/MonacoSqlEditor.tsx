import { useRef, useEffect, useCallback, useState } from 'react';
import Editor, {
  loader,
  type OnMount,
  type BeforeMount,
} from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import type { DatabaseSchema } from '@/types/database';
import { useThemeStore } from '@/stores';
import { cn } from '@/lib/utils';
import {
  createSqlCompletionProvider,
  defineCustomThemes,
} from '@/lib/monaco-sql-config';

// Configure Monaco to use local package with Vite worker
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';

// Set up Monaco environment for Vite
self.MonacoEnvironment = {
  getWorker() {
    return new editorWorker();
  },
};

loader.config({ monaco });

interface MonacoSqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute: () => void;
  schema: DatabaseSchema | null;
  height?: string;
  minHeight?: number;
  maxHeight?: number;
}

/**
 * Monaco-based SQL editor with autocomplete, theme sync, and keyboard shortcuts.
 *
 * User Stories:
 * - US1: Intelligent autocomplete for SQL keywords, tables, columns
 * - US2: Theme-aware editor (light/dark sync)
 * - US3: SQL syntax highlighting
 * - US4: Cmd/Ctrl+Enter to execute queries
 */
export function MonacoSqlEditor({
  value,
  onChange,
  onExecute,
  schema,
  height = '150px',
  minHeight = 100,
  maxHeight = 500,
}: MonacoSqlEditorProps) {
  const { theme } = useThemeStore();
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const completionDisposableRef = useRef<Monaco.IDisposable | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Parse initial height from prop (support 'px' suffix)
  const parseHeight = (h: string): number => {
    const num = parseInt(h, 10);
    return isNaN(num) ? 150 : num;
  };

  // Store default height for double-click reset
  const defaultHeight = parseHeight(height);

  // Resizable state
  const [editorHeight, setEditorHeight] = useState(defaultHeight);
  const [isResizing, setIsResizing] = useState(false);

  // Compute effective theme (US2: Theme-Aware Editor)
  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  const editorTheme = isDark ? 'sql-pro-dark' : 'sql-pro-light';

  // Configure Monaco before mount - define custom themes (US2, US3)
  const handleBeforeMount: BeforeMount = useCallback((monacoInstance) => {
    defineCustomThemes(monacoInstance);
  }, []);

  // Setup after editor mounts (US1, US4)
  const handleMount: OnMount = useCallback(
    (editor, monacoInstance) => {
      editorRef.current = editor;
      monacoRef.current = monacoInstance;

      // US4: Register Cmd/Ctrl+Enter shortcut for query execution
      editor.addCommand(
        monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Enter,
        () => onExecute()
      );

      // US1: Register initial completion provider with current schema
      completionDisposableRef.current =
        monacoInstance.languages.registerCompletionItemProvider(
          'sql',
          createSqlCompletionProvider(monacoInstance, schema)
        );

      // Focus editor on mount
      editor.focus();
    },
    [onExecute, schema]
  );

  // US1: Update completion provider when schema changes
  useEffect(() => {
    if (!monacoRef.current) return;

    // Dispose old provider
    if (completionDisposableRef.current) {
      completionDisposableRef.current.dispose();
    }

    // Register new provider with updated schema
    completionDisposableRef.current =
      monacoRef.current.languages.registerCompletionItemProvider(
        'sql',
        createSqlCompletionProvider(monacoRef.current, schema)
      );
  }, [schema]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (completionDisposableRef.current) {
        completionDisposableRef.current.dispose();
      }
    };
  }, []);

  // Handle content changes
  const handleChange = useCallback(
    (newValue: string | undefined) => {
      onChange(newValue || '');
    },
    [onChange]
  );

  // Resize handlers for drag-to-resize functionality
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  // Double-click to restore default height
  const handleDoubleClick = useCallback(() => {
    setEditorHeight(defaultHeight);
  }, [defaultHeight]);

  // Handle mouse move during resize
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const newHeight = e.clientY - containerRect.top;

      // Clamp to min/max bounds
      const clampedHeight = Math.min(maxHeight, Math.max(minHeight, newHeight));
      setEditorHeight(clampedHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    // Add listeners to document for smooth dragging even outside component
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Prevent text selection during resize
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ns-resize';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing, minHeight, maxHeight]);

  return (
    <div ref={containerRef} className="relative flex flex-col">
      {/* Editor container */}
      <div style={{ height: editorHeight }}>
        <Editor
          height="100%"
          defaultLanguage="sql"
          value={value}
          onChange={handleChange}
          beforeMount={handleBeforeMount}
          onMount={handleMount}
          theme={editorTheme}
          options={{
            // Display options
            minimap: { enabled: false },
            lineNumbers: 'on',
            renderLineHighlight: 'line',
            scrollBeyondLastLine: false,
            folding: false,
            glyphMargin: false,

            // Typography
            fontSize: 13,
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontLigatures: false,
            tabSize: 2,

            // Editing
            wordWrap: 'on',
            automaticLayout: true,
            autoIndent: 'full',
            formatOnPaste: false,
            formatOnType: false,

            // Autocomplete (US1)
            quickSuggestions: true,
            suggestOnTriggerCharacters: true,
            acceptSuggestionOnEnter: 'on',
            tabCompletion: 'on',
            wordBasedSuggestions: 'off',

            // Scrollbar
            scrollbar: {
              vertical: 'auto',
              horizontal: 'auto',
              verticalScrollbarSize: 10,
              horizontalScrollbarSize: 10,
            },

            // Padding
            padding: { top: 8, bottom: 8 },
          }}
        />
      </div>

      {/* Resize handle - drag to resize, double-click to restore default */}
      <div
        onMouseDown={handleResizeStart}
        onDoubleClick={handleDoubleClick}
        className={cn(
          'h-1.5 cursor-ns-resize transition-colors',
          'bg-transparent hover:bg-primary/20',
          isResizing && 'bg-primary/30'
        )}
        title="Drag to resize, double-click to restore default"
      >
        {/* Visual indicator in center of handle */}
        <div className="mx-auto h-full w-8 flex items-center justify-center">
          <div className="h-0.5 w-4 rounded-full bg-muted-foreground/30" />
        </div>
      </div>
    </div>
  );
}

import type { BeforeMount, OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import type { VimMode } from 'monaco-vim';
import type { ErrorPosition } from '@/../../shared/types';
import type { DatabaseSchema } from '@/types/database';
import Editor, { loader } from '@monaco-editor/react';
// Configure Monaco to use local package with Vite worker
import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import { initVimMode } from 'monaco-vim';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createSqlCompletionProvider,
  createSqlHoverProvider,
  createSqlValidator,
  defineCustomThemes,
  formatSql,
} from '@/lib/monaco-sql-config';

import { cn } from '@/lib/utils';
import { useEditorFont, useSettingsStore, useThemeStore } from '@/stores';

// Default monospace font stack
const DEFAULT_FONT_FAMILY =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

// Set up Monaco environment for Vite
globalThis.MonacoEnvironment = {
  getWorker() {
    return new EditorWorker();
  },
};

loader.config({ monaco });

/**
 * Error information for highlighting execution errors in the editor.
 * This is passed from the parent component (QueryPane) when a query execution fails.
 */
export interface ExecutionErrorInfo {
  /** Human-readable error message */
  message: string;
  /** Position in SQL where the error occurred (optional) */
  position?: ErrorPosition;
}

interface MonacoSqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute: () => void;
  schema: DatabaseSchema | null;
  height?: string;
  minHeight?: number;
  maxHeight?: number;
  /** Error info from query execution for highlighting in editor */
  executionError?: ExecutionErrorInfo | null;
  /** Initial cursor position to restore on mount */
  initialCursorPosition?: {
    line: number;
    column: number;
  };
  /** Initial scroll position to restore on mount */
  initialScrollPosition?: number;
  /** Callback when cursor position changes */
  onCursorPositionChange?: (position: { line: number; column: number }) => void;
  /** Callback when scroll position changes */
  onScrollPositionChange?: (scrollTop: number) => void;
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
  executionError,
  initialCursorPosition,
  initialScrollPosition,
  onCursorPositionChange,
  onScrollPositionChange,
}: MonacoSqlEditorProps) {
  const { theme } = useThemeStore();
  const { editorVimMode, tabSize } = useSettingsStore();
  const editorFont = useEditorFont();
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const onExecuteRef = useRef(onExecute);
  const onCursorPositionChangeRef = useRef(onCursorPositionChange);
  const onScrollPositionChangeRef = useRef(onScrollPositionChange);
  const completionDisposableRef = useRef<Monaco.IDisposable | null>(null);
  const hoverDisposableRef = useRef<Monaco.IDisposable | null>(null);
  const validatorRef = useRef<{
    validate: (model: Monaco.editor.ITextModel) => void;
    dispose: () => void;
  } | null>(null);
  const modelChangeListenerRef = useRef<Monaco.IDisposable | null>(null);
  const blurListenerRef = useRef<Monaco.IDisposable | null>(null);
  const scrollListenerRef = useRef<Monaco.IDisposable | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const vimModeRef = useRef<VimMode | null>(null);
  const vimStatusRef = useRef<HTMLDivElement | null>(null);
  const [editorReady, setEditorReady] = useState(false);

  // Parse initial height from prop (support 'px' suffix)
  const parseHeight = (h: string): number => {
    const num = Number.parseInt(h, 10);
    return Number.isNaN(num) ? 150 : num;
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

  // Keep callback refs up to date
  useEffect(() => {
    onExecuteRef.current = onExecute;
  }, [onExecute]);

  useEffect(() => {
    onCursorPositionChangeRef.current = onCursorPositionChange;
  }, [onCursorPositionChange]);

  useEffect(() => {
    onScrollPositionChangeRef.current = onScrollPositionChange;
  }, [onScrollPositionChange]);

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
        () => onExecuteRef.current()
      );

      // Register Cmd/Ctrl+Shift+F shortcut for SQL formatting
      editor.addAction({
        id: 'sql-format',
        label: 'Format SQL',
        keybindings: [
          monacoInstance.KeyMod.CtrlCmd |
            monacoInstance.KeyMod.Shift |
            monacoInstance.KeyCode.KeyF,
        ],
        run: (ed) => {
          const model = ed.getModel();
          if (!model) return;

          // Get current value and cursor position
          const currentValue = model.getValue();
          const cursorPosition = ed.getPosition();

          // Format the SQL
          const formattedValue = formatSql(currentValue);

          // Only update if the value changed
          if (formattedValue !== currentValue) {
            // Use executeEdits to preserve undo history
            const fullRange = model.getFullModelRange();
            ed.executeEdits('sql-format', [
              {
                range: fullRange,
                text: formattedValue,
              },
            ]);

            // Try to restore cursor position (may not be exact after formatting)
            if (cursorPosition) {
              // Clamp cursor to valid range after formatting
              const lineCount = model.getLineCount();
              const newLine = Math.min(cursorPosition.lineNumber, lineCount);
              const newColumn = Math.min(
                cursorPosition.column,
                model.getLineMaxColumn(newLine)
              );
              ed.setPosition({ lineNumber: newLine, column: newColumn });
            }
          }
        },
      });

      // US1: Register initial completion provider with current schema
      completionDisposableRef.current =
        monacoInstance.languages.registerCompletionItemProvider(
          'sql',
          createSqlCompletionProvider(monacoInstance, schema)
        );

      // Register hover provider for SQL documentation
      hoverDisposableRef.current =
        monacoInstance.languages.registerHoverProvider(
          'sql',
          createSqlHoverProvider(monacoInstance)
        );

      // Create SQL validator and set up model change listener for live validation
      validatorRef.current = createSqlValidator(monacoInstance);
      const model = editor.getModel();
      if (model) {
        // Perform initial validation
        validatorRef.current.validate(model);

        // Listen for model content changes to trigger validation
        modelChangeListenerRef.current = model.onDidChangeContent(() => {
          if (validatorRef.current && model) {
            validatorRef.current.validate(model);
          }
        });
      }

      // Focus editor on mount
      editor.focus();

      // Restore cursor position if provided
      if (initialCursorPosition) {
        const model = editor.getModel();
        if (model) {
          // Clamp position to valid range
          const lineCount = model.getLineCount();
          const line = Math.min(
            Math.max(1, initialCursorPosition.line),
            lineCount
          );
          const column = Math.min(
            Math.max(1, initialCursorPosition.column),
            model.getLineMaxColumn(line)
          );

          editor.setPosition({ lineNumber: line, column });
          editor.revealPositionInCenter({ lineNumber: line, column });
        }
      }

      // Restore scroll position if provided
      if (initialScrollPosition !== undefined) {
        editor.setScrollTop(initialScrollPosition);
      }

      // Mark editor as ready for vim mode initialization
      setEditorReady(true);
    },
    [schema, initialCursorPosition, initialScrollPosition]
  );

  // Capture and save cursor position when editor loses focus
  useEffect(() => {
    if (!editorRef.current) return;

    // Listen for editor blur events
    blurListenerRef.current = editorRef.current.onDidBlurEditorText(() => {
      if (!editorRef.current) return;

      const position = editorRef.current.getPosition();
      if (position && onCursorPositionChangeRef.current) {
        onCursorPositionChangeRef.current({
          line: position.lineNumber,
          column: position.column,
        });
      }
    });

    return () => {
      if (blurListenerRef.current) {
        blurListenerRef.current.dispose();
        blurListenerRef.current = null;
      }
    };
  }, [editorReady]);

  // Capture and save scroll position when editor scrolls
  useEffect(() => {
    if (!editorRef.current) return;

    // Listen for scroll change events
    scrollListenerRef.current = editorRef.current.onDidScrollChange(() => {
      if (!editorRef.current) return;

      const scrollTop = editorRef.current.getScrollTop();
      if (onScrollPositionChangeRef.current) {
        onScrollPositionChangeRef.current(scrollTop);
      }
    });

    return () => {
      if (scrollListenerRef.current) {
        scrollListenerRef.current.dispose();
        scrollListenerRef.current = null;
      }
    };
  }, [editorReady]);

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

  // Handle execution error highlighting
  // Sets markers in the editor when a query execution error occurs with position info
  useEffect(() => {
    if (!monacoRef.current || !editorRef.current) return;

    const model = editorRef.current.getModel();
    if (!model) return;

    // Clear previous execution error markers
    monacoRef.current.editor.setModelMarkers(model, 'sql-execution-error', []);

    // If there's an execution error with position info, create a marker
    if (executionError && executionError.position) {
      const { line, column } = executionError.position;

      // Calculate end column - try to highlight a reasonable range
      // If the error is at a specific position, highlight at least 10 characters
      // or until the end of the line, whichever is shorter
      const lineContent = model.getLineContent(line);
      const maxColumn = lineContent.length + 1;
      const endColumn = Math.min(column + 10, maxColumn);

      const markers: Monaco.editor.IMarkerData[] = [
        {
          startLineNumber: line,
          startColumn: column,
          endLineNumber: line,
          endColumn: Math.max(endColumn, column + 1), // Ensure at least 1 character
          message: executionError.message,
          severity: monacoRef.current.MarkerSeverity.Error,
        },
      ];

      monacoRef.current.editor.setModelMarkers(
        model,
        'sql-execution-error',
        markers
      );

      // Reveal the error position in the editor
      editorRef.current.revealPositionInCenter({
        lineNumber: line,
        column,
      });
    }
  }, [executionError]);

  // Initialize or dispose vim mode based on editorMode setting
  // Must wait for both editor to be ready AND vimStatusRef to be mounted
  useEffect(() => {
    // Wait for editor to be ready
    if (!editorReady || !editorRef.current) return;

    if (editorVimMode) {
      // Wait for status bar element to be available (it renders when editorMode === 'vim')
      // Use requestAnimationFrame to ensure DOM is painted
      const initVim = () => {
        if (!vimStatusRef.current || !editorRef.current) {
          // Status bar not yet rendered, retry on next frame
          requestAnimationFrame(initVim);
          return;
        }

        // Initialize vim mode if not already active
        if (!vimModeRef.current) {
          vimModeRef.current = initVimMode(
            editorRef.current,
            vimStatusRef.current
          );
        }
      };

      requestAnimationFrame(initVim);
    } else {
      // Dispose vim mode if active
      if (vimModeRef.current) {
        vimModeRef.current.dispose();
        vimModeRef.current = null;
      }
    }
  }, [editorVimMode, editorReady]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (completionDisposableRef.current) {
        completionDisposableRef.current.dispose();
      }
      if (hoverDisposableRef.current) {
        hoverDisposableRef.current.dispose();
      }
      if (modelChangeListenerRef.current) {
        modelChangeListenerRef.current.dispose();
      }
      if (blurListenerRef.current) {
        blurListenerRef.current.dispose();
      }
      if (scrollListenerRef.current) {
        scrollListenerRef.current.dispose();
      }
      if (validatorRef.current) {
        validatorRef.current.dispose();
        validatorRef.current = null;
      }
      if (vimModeRef.current) {
        vimModeRef.current.dispose();
        vimModeRef.current = null;
      }
      // Clear execution error markers on unmount
      if (editorRef.current && monacoRef.current) {
        const model = editorRef.current.getModel();
        if (model) {
          monacoRef.current.editor.setModelMarkers(
            model,
            'sql-execution-error',
            []
          );
        }
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
            fontSize: editorFont.size,
            fontFamily: editorFont.family || DEFAULT_FONT_FAMILY,
            fontLigatures: false,
            tabSize,

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

            // Find/Replace (Cmd/Ctrl+F to find, Cmd/Ctrl+H to replace)
            find: {
              addExtraSpaceOnTop: true,
              autoFindInSelection: 'multiline',
              seedSearchStringFromSelection: 'always',
            },

            // Padding
            padding: { top: 8, bottom: 8 },
          }}
        />
      </div>

      {/* Vim status bar - shows vim mode and command input */}
      {editorVimMode && (
        <div
          ref={vimStatusRef}
          className="bg-muted/50 text-muted-foreground border-t px-2 py-1 font-mono text-xs"
        />
      )}

      {/* Resize handle - drag to resize, double-click to restore default */}
      <div
        onMouseDown={handleResizeStart}
        onDoubleClick={handleDoubleClick}
        className={cn(
          'h-1.5 cursor-ns-resize transition-colors',
          'hover:bg-primary/20 bg-transparent',
          isResizing && 'bg-primary/30'
        )}
        title="Drag to resize, double-click to restore default"
      >
        {/* Visual indicator in center of handle */}
        <div className="mx-auto flex h-full w-8 items-center justify-center">
          <div className="bg-muted-foreground/30 h-0.5 w-4 rounded-full" />
        </div>
      </div>
    </div>
  );
}

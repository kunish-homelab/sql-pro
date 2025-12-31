import * as monaco from 'monaco-editor';
import { useEffect, useRef } from 'react';

import { cn } from '@/lib/utils';
import { useThemeStore } from '@/stores';

interface SqlHighlightProps {
  /** SQL code to highlight */
  code: string;
  /** Additional CSS classes */
  className?: string;
  /** Maximum number of lines to show (uses line-clamp) */
  maxLines?: number;
}

/**
 * A lightweight component for displaying syntax-highlighted SQL code.
 * Uses Monaco Editor's colorizeElement for consistent highlighting with the main editor.
 *
 * This is ideal for read-only SQL display in:
 * - Query history
 * - Query templates
 * - Query optimizer previews
 * - AI-generated SQL display
 */
export function SqlHighlight({ code, className, maxLines }: SqlHighlightProps) {
  const { theme } = useThemeStore();
  const containerRef = useRef<HTMLPreElement>(null);

  // Compute effective theme
  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Set the plain text content first
    container.textContent = code;

    // Use Monaco's colorizeElement to safely highlight the element in place
    // This modifies the DOM element directly without innerHTML
    monaco.editor
      .colorizeElement(container, {
        theme: isDark ? 'vs-dark' : 'vs',
        tabSize: 2,
      })
      .catch(() => {
        // If colorization fails, the plain text is already displayed
      });
  }, [code, isDark]);

  // Generate line-clamp style based on maxLines
  const lineClampStyle = maxLines
    ? {
        display: '-webkit-box',
        WebkitLineClamp: maxLines,
        WebkitBoxOrient: 'vertical' as const,
        overflow: 'hidden',
      }
    : undefined;

  return (
    <pre
      ref={containerRef}
      data-lang="sql"
      className={cn(
        'overflow-hidden font-mono text-xs break-all whitespace-pre-wrap',
        className
      )}
      style={lineClampStyle}
    >
      {code}
    </pre>
  );
}

import type { ErrorComponentProps } from '@tanstack/react-router';
import { Button } from '@sqlpro/ui/button';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Copy,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface StackFrame {
  functionName: string;
  fileName: string;
  lineNumber: string;
  columnNumber: string;
  raw: string;
}

// Parse stack trace into structured frames
function parseStackTrace(stack: string): StackFrame[] {
  const lines = stack.split('\n').slice(1);
  return lines
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith('at ')) {
        return {
          functionName: '',
          fileName: '',
          lineNumber: '',
          columnNumber: '',
          raw: trimmed,
        };
      }

      // Parse "at functionName (file:line:col)" or "at file:line:col"
      const content = trimmed.slice(3); // Remove "at "

      // Try to match "functionName (location)" pattern
      const parenIndex = content.lastIndexOf('(');
      if (parenIndex !== -1 && content.endsWith(')')) {
        const functionName = content.slice(0, parenIndex).trim();
        const location = content.slice(parenIndex + 1, -1);
        const locMatch = location.match(/^(.+):(\d+):(\d+)$/);
        if (locMatch) {
          return {
            functionName: functionName || '(anonymous)',
            fileName: locMatch[1],
            lineNumber: locMatch[2],
            columnNumber: locMatch[3],
            raw: trimmed,
          };
        }
      }

      // Try to match direct "file:line:col" pattern
      const locMatch = content.match(/^(.+):(\d+):(\d+)$/);
      if (locMatch) {
        return {
          functionName: '(anonymous)',
          fileName: locMatch[1],
          lineNumber: locMatch[2],
          columnNumber: locMatch[3],
          raw: trimmed,
        };
      }

      return {
        functionName: '',
        fileName: '',
        lineNumber: '',
        columnNumber: '',
        raw: trimmed,
      };
    })
    .filter((frame) => frame.raw.startsWith('at'));
}

function formatFilePath(path: string): string {
  if (path.includes('node_modules')) {
    const parts = path.split('node_modules/');
    return `node_modules/${parts[parts.length - 1]}`;
  }
  if (path.includes('/src/')) {
    return path.substring(path.indexOf('/src/') + 1);
  }
  return path;
}

function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        {isOpen ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        {title}
      </button>
      {isOpen && (
        <div className="border-t border-zinc-200 px-3 py-2 dark:border-zinc-800">
          {children}
        </div>
      )}
    </div>
  );
}

function StackTraceViewer({ stack }: { stack: string }) {
  const [copied, setCopied] = useState(false);
  const frames = parseStackTrace(stack);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(stack);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500">
          {frames.length} stack frames
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={handleCopy}
        >
          <Copy className="mr-1 h-3 w-3" />
          {copied ? 'Copied!' : 'Copy'}
        </Button>
      </div>
      <div className="max-h-64 space-y-px overflow-auto rounded-md bg-zinc-100 dark:bg-zinc-900">
        {frames.map((frame, index) => (
          <div
            key={frame.raw}
            className={cn(
              'group flex items-start gap-2 px-2 py-1.5 font-mono text-xs',
              index === 0 && 'bg-red-100 dark:bg-red-900/30'
            )}
          >
            <span className="w-5 shrink-0 text-right text-zinc-400">
              {index}
            </span>
            <div className="min-w-0 flex-1">
              <span
                className={cn(
                  'font-medium',
                  index === 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-zinc-900 dark:text-zinc-100'
                )}
              >
                {frame.functionName}
              </span>
              {frame.fileName && (
                <div className="truncate text-zinc-500">
                  {formatFilePath(frame.fileName)}
                  <span className="text-zinc-400">
                    :{frame.lineNumber}:{frame.columnNumber}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Error fallback component for TanStack Router.
 * Displays when an error occurs within a route.
 */
export function RouterErrorFallback({ error, reset }: ErrorComponentProps) {
  const err = error instanceof Error ? error : new Error(String(error));

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="flex h-full min-h-screen flex-col items-center justify-center bg-white p-8 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="flex w-full max-w-2xl flex-col items-center text-center">
        {/* Error icon and title */}
        <div className="mb-4 rounded-full bg-red-100 p-3 dark:bg-red-900/30">
          <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
        </div>

        <h2 className="mb-1 text-xl font-semibold">Something went wrong</h2>
        <p className="mb-4 text-sm text-zinc-500">
          An unexpected error occurred in the application.
        </p>

        {/* Error message box */}
        <div className="mb-4 w-full rounded-lg border border-red-200 bg-red-50 p-4 text-left dark:border-red-800 dark:bg-red-900/20">
          <div className="flex items-start gap-2">
            <span className="rounded bg-red-200 px-1.5 py-0.5 font-mono text-xs font-medium text-red-700 dark:bg-red-800 dark:text-red-300">
              {err.name || 'Error'}
            </span>
          </div>
          <p className="mt-2 font-mono text-sm text-red-700 dark:text-red-300">
            {err.message}
          </p>
        </div>

        {/* Stack trace */}
        {err.stack && (
          <div className="mb-6 w-full space-y-3 text-left">
            <CollapsibleSection title="Stack Trace" defaultOpen>
              <StackTraceViewer stack={err.stack} />
            </CollapsibleSection>
          </div>
        )}

        {/* Recovery actions */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => reset()}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
          <Button onClick={handleReload}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Reload App
          </Button>
        </div>
      </div>
    </div>
  );
}

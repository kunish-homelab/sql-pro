/* eslint-disable react-refresh/only-export-components */
import type { ErrorInfo, ReactNode } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Copy,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { Component, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

interface StackFrame {
  functionName: string;
  fileName: string;
  lineNumber: string;
  columnNumber: string;
  raw: string;
}

// Parse stack trace into structured frames
function parseStackTrace(stack: string): StackFrame[] {
  const lines = stack.split('\n').slice(1); // Skip the error message line
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

// Format file path for display (show only relevant part)
function formatFilePath(path: string): string {
  // Remove webpack/vite internal paths
  if (path.includes('node_modules')) {
    const parts = path.split('node_modules/');
    return `node_modules/${parts[parts.length - 1]}`;
  }
  // Show path relative to src
  if (path.includes('/src/')) {
    return path.substring(path.indexOf('/src/') + 1);
  }
  return path;
}

// Collapsible section component
function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-border/50 overflow-hidden rounded-lg border">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="hover:bg-muted/50 flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium transition-colors"
      >
        {isOpen ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        {title}
      </button>
      {isOpen && (
        <div className="border-border/50 border-t px-3 py-2">{children}</div>
      )}
    </div>
  );
}

// Stack trace viewer component
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
        <span className="text-muted-foreground text-xs">
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
      <div className="bg-muted/30 max-h-64 space-y-px overflow-auto rounded-md">
        {frames.map((frame, index) => (
          <div
            key={`${frame.raw}`}
            className={cn(
              'group flex items-start gap-2 px-2 py-1.5 font-mono text-xs',
              index === 0 && 'bg-destructive/10'
            )}
          >
            <span className="text-muted-foreground w-5 shrink-0 text-right">
              {index}
            </span>
            <div className="min-w-0 flex-1">
              <span
                className={cn(
                  'font-medium',
                  index === 0 ? 'text-destructive' : 'text-foreground'
                )}
              >
                {frame.functionName}
              </span>
              {frame.fileName && (
                <div className="text-muted-foreground truncate">
                  {formatFilePath(frame.fileName)}
                  <span className="text-muted-foreground/70">
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

// Component stack viewer
function ComponentStackViewer({ componentStack }: { componentStack: string }) {
  const [copied, setCopied] = useState(false);
  const lines = componentStack
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(componentStack);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs">
          Component hierarchy
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
      <div className="bg-muted/30 max-h-48 space-y-px overflow-auto rounded-md p-2">
        {lines.map((line, index) => {
          const match = line.match(/at\s+(\w+)/);
          const componentName = match ? match[1] : line;
          return (
            <div
              key={line}
              className="flex items-center gap-1 font-mono text-xs"
              style={{ paddingLeft: `${index * 12}px` }}
            >
              <span className="text-muted-foreground">{'>'}</span>
              <span
                className={cn(
                  index === 0
                    ? 'text-destructive font-medium'
                    : 'text-foreground'
                )}
              >
                {componentName}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Error Boundary component that catches JavaScript errors anywhere in the child
 * component tree and displays a fallback UI instead of crashing the whole app.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    // Log error to console in development
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Call optional error handler
    this.props.onError?.(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, errorInfo } = this.state;

      // Default error UI
      return (
        <ErrorFallback
          error={error}
          errorInfo={errorInfo}
          onReset={this.handleReset}
          onReload={this.handleReload}
        />
      );
    }

    return this.props.children;
  }
}

// Extracted as a functional component to use hooks
function ErrorFallback({
  error,
  errorInfo,
  onReset,
  onReload,
}: {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  onReset: () => void;
  onReload: () => void;
}) {
  return (
    <div className="bg-background text-foreground flex h-full min-h-screen flex-col items-center justify-center p-8">
      <div className="flex w-full max-w-2xl flex-col items-center text-center">
        {/* Error icon and title */}
        <div className="bg-destructive/10 mb-4 rounded-full p-3">
          <AlertTriangle className="text-destructive h-8 w-8" />
        </div>

        <h2 className="mb-1 text-xl font-semibold">Something went wrong</h2>
        <p className="text-muted-foreground mb-4 text-sm">
          An unexpected error occurred in the application.
        </p>

        {/* Error message box */}
        {error && (
          <div className="bg-destructive/5 border-destructive/20 mb-4 w-full rounded-lg border p-4 text-left">
            <div className="text-destructive flex items-start gap-2">
              <span className="bg-destructive/20 rounded px-1.5 py-0.5 font-mono text-xs font-medium">
                {error.name || 'Error'}
              </span>
            </div>
            <p className="text-destructive mt-2 font-mono text-sm">
              {error.message}
            </p>
          </div>
        )}

        {/* Stack traces */}
        {error && (
          <div className="mb-6 w-full space-y-3 text-left">
            {error.stack && (
              <CollapsibleSection title="Stack Trace" defaultOpen>
                <StackTraceViewer stack={error.stack} />
              </CollapsibleSection>
            )}

            {errorInfo?.componentStack && (
              <CollapsibleSection title="Component Stack">
                <ComponentStackViewer
                  componentStack={errorInfo.componentStack}
                />
              </CollapsibleSection>
            )}
          </div>
        )}

        {/* Recovery actions */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={onReset}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
          <Button onClick={onReload}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Reload App
          </Button>
        </div>
      </div>
    </div>
  );
}

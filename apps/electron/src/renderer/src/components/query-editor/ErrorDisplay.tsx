import type { ErrorCode, ErrorPosition } from '@shared/types';
import {
  AlertCircle,
  ChevronRight,
  ExternalLink,
  Lightbulb,
  MapPin,
} from 'lucide-react';
import { memo } from 'react';
import { cn } from '@/lib/utils';

/**
 * Props for the enhanced error display component.
 * Extends basic error information with actionable suggestions and documentation links.
 */
export interface ErrorDisplayProps {
  /** Human-readable error message */
  error: string;
  /** Categorized error code for programmatic handling */
  errorCode?: ErrorCode;
  /** Position in SQL where the error occurred (for syntax errors) */
  errorPosition?: ErrorPosition;
  /** Actionable suggestions to fix the error (2-3 items) */
  suggestions?: string[];
  /** URL to relevant SQLite documentation */
  documentationUrl?: string;
  /** Step-by-step troubleshooting instructions (for connection errors) */
  troubleshootingSteps?: string[];
  /** Additional CSS classes */
  className?: string;
}

/**
 * Maps error codes to user-friendly titles.
 */
function getErrorTitle(errorCode?: ErrorCode): string {
  switch (errorCode) {
    case 'SQL_SYNTAX_ERROR':
      return 'Syntax Error';
    case 'SQL_CONSTRAINT_ERROR':
      return 'Constraint Violation';
    case 'CONNECTION_ERROR':
      return 'Connection Error';
    case 'ENCRYPTION_ERROR':
      return 'Encryption Error';
    case 'PERMISSION_ERROR':
      return 'Permission Denied';
    case 'FILE_NOT_FOUND':
      return 'File Not Found';
    case 'QUERY_EXECUTION_ERROR':
      return 'Query Error';
    default:
      return 'Query Error';
  }
}

/**
 * Enhanced error display component that shows:
 * - Error message with proper styling
 * - Error position (line/column) for syntax errors
 * - Actionable suggestions to fix the error
 * - Troubleshooting steps for connection errors
 * - Link to relevant SQLite documentation
 */
export const ErrorDisplay = memo(
  ({
    error,
    errorCode,
    errorPosition,
    suggestions,
    documentationUrl,
    troubleshootingSteps,
    className,
  }: ErrorDisplayProps) => {
    const title = getErrorTitle(errorCode);
    const hasSuggestions = suggestions && suggestions.length > 0;
    const hasTroubleshootingSteps =
      troubleshootingSteps && troubleshootingSteps.length > 0;
    const hasEnhancedInfo =
      hasSuggestions ||
      hasTroubleshootingSteps ||
      documentationUrl ||
      errorPosition;

    return (
      <div
        className={cn('flex h-full items-center justify-center p-4', className)}
      >
        <div
          className={cn(
            'border-destructive/50 bg-destructive/10 flex w-full max-w-lg flex-col gap-3 rounded-lg border p-4',
            hasEnhancedInfo && 'max-w-xl'
          )}
        >
          {/* Error Header */}
          <div className="flex items-start gap-3">
            <AlertCircle className="text-destructive mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-destructive font-medium">{title}</p>
              <p className="text-destructive/80 mt-1 text-sm wrap-break-word">
                {error}
              </p>
            </div>
          </div>

          {/* Error Position */}
          {errorPosition && (
            <div className="text-muted-foreground ml-8 flex items-center gap-2 text-xs">
              <MapPin className="h-3.5 w-3.5" />
              <span>
                Line {errorPosition.line}, Column {errorPosition.column}
              </span>
            </div>
          )}

          {/* Suggestions */}
          {hasSuggestions && (
            <div className="border-destructive/20 ml-8 border-t pt-3">
              <div className="text-foreground/80 mb-2 flex items-center gap-2 text-sm font-medium">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                <span>Suggestions</span>
              </div>
              <ul className="space-y-1.5">
                {suggestions.map((suggestion) => (
                  <li
                    key={suggestion}
                    className="text-muted-foreground flex items-start gap-2 text-sm"
                  >
                    <ChevronRight className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Troubleshooting Steps */}
          {hasTroubleshootingSteps && (
            <div className="border-destructive/20 ml-8 border-t pt-3">
              <div className="text-foreground/80 mb-2 flex items-center gap-2 text-sm font-medium">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                <span>Troubleshooting Steps</span>
              </div>
              <ol className="list-inside list-decimal space-y-1.5">
                {troubleshootingSteps.map((step) => (
                  <li key={step} className="text-muted-foreground text-sm">
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Documentation Link */}
          {documentationUrl && (
            <div className="border-destructive/20 ml-8 border-t pt-3">
              <a
                href={documentationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary inline-flex items-center gap-2 text-sm hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>View SQLite Documentation</span>
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }
);

ErrorDisplay.displayName = 'ErrorDisplay';

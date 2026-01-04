import { Alert, AlertDescription, AlertTitle } from '@sqlpro/ui/alert';
import { Button } from '@sqlpro/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@sqlpro/ui/card';
import { ScrollArea } from '@sqlpro/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sqlpro/ui/select';
import {
  AlertCircle,
  ArrowLeftRight,
  ChevronDown,
  ChevronUp,
  Database,
  GitCompare,
  Keyboard,
  Loader2,
  Table2,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ShortcutKbd } from '@/components/ui/kbd';
import { useConnectionStore, useDataDiffStore } from '@/stores';

interface DataDiffPanelProps {
  className?: string;
}

/**
 * Main container component for data diff feature.
 * Provides source/target table selection and displays comparison results.
 */
export function DataDiffPanel({ className }: DataDiffPanelProps) {
  const {
    source,
    target,
    comparisonResult,
    isComparing,
    comparisonError,
    filters,
    setSource,
    setTarget,
    setIsComparing,
    setComparisonError,
    setShowOnlyDifferences,
    resetFilters,
  } = useDataDiffStore();

  const { getAllConnections, getSchemaByConnectionId } = useConnectionStore();

  const connections = getAllConnections();

  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);

  // Ref to hold handleCompare function for keyboard shortcuts
  const handleCompareRef = useRef<(() => void) | null>(null);

  // Get tables from schema for source connection
  const sourceTables = source?.connectionId
    ? getSchemaByConnectionId(source.connectionId)?.tables || []
    : [];

  // Get tables from schema for target connection
  const targetTables = target?.connectionId
    ? getSchemaByConnectionId(target.connectionId)?.tables || []
    : [];

  // Keyboard shortcuts for common comparison actions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input/textarea or editable element
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Exception: Cmd/Ctrl+Enter to trigger comparison works even in inputs
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
          e.preventDefault();
          if (source && target && !isComparing) {
            handleCompareRef.current?.();
          }
        }
        return;
      }

      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case 'Enter':
            // Cmd/Ctrl+Enter: Run comparison
            e.preventDefault();
            if (source && target && !isComparing) {
              handleCompareRef.current?.();
            }
            break;
          case 'd':
          case 'D':
            // Cmd/Ctrl+D: Toggle "only differences" filter
            if (comparisonResult) {
              e.preventDefault();
              setShowOnlyDifferences(!filters.showOnlyDifferences);
            }
            break;
          case 'r':
          case 'R':
            // Cmd/Ctrl+R: Reset filters
            if (comparisonResult) {
              e.preventDefault();
              resetFilters();
            }
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    source,
    target,
    isComparing,
    comparisonResult,
    filters.showOnlyDifferences,
    setShowOnlyDifferences,
    resetFilters,
  ]);

  const handleCompare = useCallback(async () => {
    if (!source || !target) {
      setComparisonError(
        'Please select both source and target tables to compare'
      );
      return;
    }

    if (!source.connectionId || !source.tableName) {
      setComparisonError('Source connection and table are required');
      return;
    }

    if (!target.connectionId || !target.tableName) {
      setComparisonError('Target connection and table are required');
      return;
    }

    setIsComparing(true);
    setComparisonError(null);

    try {
      const response = await window.sqlPro.comparison.compareTables({
        sourceConnectionId: source.connectionId,
        sourceTable: source.tableName,
        sourceSchema: source.schemaName || 'main',
        targetConnectionId: target.connectionId,
        targetTable: target.tableName,
        targetSchema: target.schemaName || 'main',
        primaryKeys: [], // Auto-detect primary keys
        pagination: {
          offset: 0,
          limit: 1000,
        },
      });

      if (!response.success) {
        setComparisonError(response.error || 'Failed to compare tables');
        return;
      }

      if (response.result) {
        useDataDiffStore.getState().setComparisonResult(response.result);
      }
    } catch (error) {
      setComparisonError(
        error instanceof Error ? error.message : 'An unexpected error occurred'
      );
    } finally {
      setIsComparing(false);
    }
  }, [source, target, setIsComparing, setComparisonError]);

  // Store handleCompare in ref for keyboard shortcuts
  useEffect(() => {
    handleCompareRef.current = handleCompare;
  }, [handleCompare]);

  const canCompare =
    source &&
    target &&
    source.connectionId &&
    source.tableName &&
    target.connectionId &&
    target.tableName &&
    !isComparing;

  return (
    <div className={className}>
      <ScrollArea className="h-full">
        <div className="space-y-6 p-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GitCompare className="text-primary h-6 w-6" />
              <div>
                <h1 className="text-2xl font-semibold">Data Comparison</h1>
                <p className="text-muted-foreground text-sm">
                  Compare data between tables to identify row-level differences
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowKeyboardShortcuts(!showKeyboardShortcuts)}
              className="gap-2"
              title="Show keyboard shortcuts"
            >
              <Keyboard className="h-4 w-4" />
              <span className="hidden sm:inline">Shortcuts</span>
              {showKeyboardShortcuts ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Keyboard Shortcuts Help */}
          {showKeyboardShortcuts && (
            <Card className="bg-muted/50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Keyboard className="h-4 w-4" />
                  Keyboard Shortcuts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground whitespace-nowrap">
                      Run comparison
                    </span>
                    <ShortcutKbd
                      binding={{ key: 'Enter', modifiers: { cmd: true } }}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground whitespace-nowrap">
                      Toggle only differences
                    </span>
                    <ShortcutKbd
                      binding={{ key: 'd', modifiers: { cmd: true } }}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground whitespace-nowrap">
                      Reset filters
                    </span>
                    <ShortcutKbd
                      binding={{ key: 'r', modifiers: { cmd: true } }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Selection Cards */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Source Selector */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Database className="h-4 w-4" />
                  Source
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Connection Selector */}
                <div className="space-y-2">
                  <label className="text-muted-foreground text-xs font-medium">
                    Connection
                  </label>
                  <Select
                    value={source?.connectionId ?? ''}
                    onValueChange={(connectionId) => {
                      if (!connectionId) return;
                      const connection = connections.find(
                        (c) => c.id === connectionId
                      );
                      setSource({
                        connectionId,
                        tableName: '',
                        schemaName: source?.schemaName || 'main',
                        displayName: connection?.filename,
                      });
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select connection...">
                        {source?.connectionId
                          ? connections.find(
                              (c) => c.id === source.connectionId
                            )?.filename
                          : null}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {connections.map((conn) => (
                        <SelectItem key={conn.id} value={conn.id}>
                          {conn.filename}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Table Selector */}
                <div className="space-y-2">
                  <label className="text-muted-foreground text-xs font-medium">
                    Table
                  </label>
                  <Select
                    value={source?.tableName ?? ''}
                    onValueChange={(tableName) => {
                      if (!source || !tableName) return;
                      setSource({
                        ...source,
                        tableName,
                      });
                    }}
                    disabled={
                      !source?.connectionId || sourceTables.length === 0
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select table...">
                        {source?.tableName ? (
                          <div className="flex items-center gap-2">
                            <Table2 className="h-3 w-3 shrink-0" />
                            <span className="truncate">{source.tableName}</span>
                          </div>
                        ) : null}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {sourceTables.map((table) => (
                        <SelectItem key={table.name} value={table.name}>
                          <div className="flex items-center gap-2">
                            <Table2 className="h-3 w-3" />
                            {table.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Arrow Indicator */}
            <div className="hidden items-center justify-center md:absolute md:top-50 md:left-1/2 md:flex md:-translate-x-1/2">
              <ArrowLeftRight className="text-muted-foreground h-6 w-6" />
            </div>

            {/* Target Selector */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Database className="h-4 w-4" />
                  Target
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Connection Selector */}
                <div className="space-y-2">
                  <label className="text-muted-foreground text-xs font-medium">
                    Connection
                  </label>
                  <Select
                    value={target?.connectionId ?? ''}
                    onValueChange={(connectionId) => {
                      if (!connectionId) return;
                      const connection = connections.find(
                        (c) => c.id === connectionId
                      );
                      setTarget({
                        connectionId,
                        tableName: '',
                        schemaName: target?.schemaName || 'main',
                        displayName: connection?.filename,
                      });
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select connection...">
                        {target?.connectionId
                          ? connections.find(
                              (c) => c.id === target.connectionId
                            )?.filename
                          : null}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {connections.map((conn) => (
                        <SelectItem key={conn.id} value={conn.id}>
                          {conn.filename}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Table Selector */}
                <div className="space-y-2">
                  <label className="text-muted-foreground text-xs font-medium">
                    Table
                  </label>
                  <Select
                    value={target?.tableName ?? ''}
                    onValueChange={(tableName) => {
                      if (!target || !tableName) return;
                      setTarget({
                        ...target,
                        tableName,
                      });
                    }}
                    disabled={
                      !target?.connectionId || targetTables.length === 0
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select table...">
                        {target?.tableName ? (
                          <div className="flex items-center gap-2">
                            <Table2 className="h-3 w-3 shrink-0" />
                            <span className="truncate">{target.tableName}</span>
                          </div>
                        ) : null}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {targetTables.map((table) => (
                        <SelectItem key={table.name} value={table.name}>
                          <div className="flex items-center gap-2">
                            <Table2 className="h-3 w-3" />
                            {table.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Compare Button */}
          <div className="flex justify-center">
            <Button
              size="lg"
              onClick={handleCompare}
              disabled={!canCompare}
              className="min-w-50"
              title="Compare tables (⌘↵)"
            >
              {isComparing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Comparing...
                </>
              ) : (
                <>
                  <GitCompare className="mr-2 h-4 w-4" />
                  Compare Data
                </>
              )}
            </Button>
          </div>

          {/* Error Display */}
          {comparisonError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Comparison Error</AlertTitle>
              <AlertDescription>{comparisonError}</AlertDescription>
            </Alert>
          )}

          {/* Comparison Results */}
          {comparisonResult && (
            <div className="space-y-4">
              {/* Summary Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Comparison Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Source:</span>
                      <span className="font-medium">
                        {comparisonResult.sourceName}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Target:</span>
                      <span className="font-medium">
                        {comparisonResult.targetName}
                      </span>
                    </div>
                    <div className="mt-4 border-t pt-2">
                      <p className="text-muted-foreground text-sm">
                        Summary ({comparisonResult.summary.sourceRows} source
                        rows, {comparisonResult.summary.targetRows} target rows)
                      </p>
                      <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
                        <div className="rounded bg-green-100 p-2 dark:bg-green-950">
                          <div className="text-green-700 dark:text-green-300">
                            Added
                          </div>
                          <div className="text-lg font-semibold">
                            {comparisonResult.summary.rowsAdded}
                          </div>
                        </div>
                        <div className="rounded bg-red-100 p-2 dark:bg-red-950">
                          <div className="text-red-700 dark:text-red-300">
                            Removed
                          </div>
                          <div className="text-lg font-semibold">
                            {comparisonResult.summary.rowsRemoved}
                          </div>
                        </div>
                        <div className="rounded bg-amber-100 p-2 dark:bg-amber-950">
                          <div className="text-amber-700 dark:text-amber-300">
                            Modified
                          </div>
                          <div className="text-lg font-semibold">
                            {comparisonResult.summary.rowsModified}
                          </div>
                        </div>
                        <div className="rounded bg-blue-100 p-2 dark:bg-blue-950">
                          <div className="text-blue-700 dark:text-blue-300">
                            Unchanged
                          </div>
                          <div className="text-lg font-semibold">
                            {comparisonResult.summary.rowsUnchanged}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Detailed Diff View - Placeholder for future components */}
              <Card>
                <CardHeader>
                  <CardTitle>Row Differences</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm">
                    Detailed diff view will be implemented in subsequent
                    subtasks.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Empty State */}
          {!comparisonResult && !comparisonError && !isComparing && (
            <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 py-12 text-center">
              <GitCompare className="h-12 w-12 opacity-30" />
              <p className="font-medium">Ready to Compare</p>
              <p className="text-sm">
                Select source and target tables, then click Compare Data
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

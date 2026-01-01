import {
  AlertCircle,
  ArrowLeftRight,
  ChevronDown,
  ChevronUp,
  FileDown,
  GitCompare,
  Keyboard,
  Loader2,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShortcutKbd } from '@/components/ui/kbd';
import { ScrollArea } from '@/components/ui/scroll-area';
import { sqlPro } from '@/lib/api';
import { useSchemaComparisonStore } from '@/stores';
import { DiffFilterBar } from './DiffFilterBar';
import { DiffSummary } from './DiffSummary';
import { ExportReportDialog } from './ExportReportDialog';
import { MigrationPreview } from './MigrationPreview';
import { SchemaDiffView } from './SchemaDiffView';
import { SourceSelector } from './SourceSelector';

interface SchemaComparisonPanelProps {
  className?: string;
}

/**
 * Main container component for schema comparison feature.
 * Provides source/target selection and displays comparison results.
 */
export function SchemaComparisonPanel({
  className,
}: SchemaComparisonPanelProps) {
  const {
    source,
    target,
    comparisonResult,
    isComparing,
    comparisonError,
    isLoadingSnapshots,
    filters,
    setSource,
    setTarget,
    setIsComparing,
    setComparisonResult,
    setComparisonError,
    setAvailableSnapshots,
    setIsLoadingSnapshots,
    setShowOnlyDifferences,
    resetFilters,
  } = useSchemaComparisonStore();

  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);

  // Ref to hold handleCompare function for keyboard shortcuts (defined before useEffect)
  const handleCompareRef = useRef<(() => void) | null>(null);

  // Load available snapshots on mount
  useEffect(() => {
    const loadSnapshots = async () => {
      setIsLoadingSnapshots(true);
      try {
        const response = await sqlPro.schemaSnapshot.getAll();
        if (response.success && response.snapshots) {
          setAvailableSnapshots(response.snapshots);
        }
      } catch {
        // Silently fail - snapshots are optional
      } finally {
        setIsLoadingSnapshots(false);
      }
    };

    loadSnapshots();
  }, [setAvailableSnapshots, setIsLoadingSnapshots]);

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
          case 'e':
          case 'E':
            // Cmd/Ctrl+E: Export report
            if (comparisonResult) {
              e.preventDefault();
              setIsExportDialogOpen(true);
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
          case 'f':
          case 'F':
            // Cmd/Ctrl+F: Focus search input
            if (comparisonResult) {
              e.preventDefault();
              // Find and focus the search input in DiffFilterBar
              const searchInput = document.querySelector(
                'input[placeholder="Search by name..."]'
              ) as HTMLInputElement;
              if (searchInput) {
                searchInput.focus();
                searchInput.select();
              }
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
      setComparisonError('Please select both source and target to compare');
      return;
    }

    setIsComparing(true);
    setComparisonError(null);

    try {
      let response;

      // Determine comparison type based on source and target types
      if (source.type === 'connection' && target.type === 'connection') {
        // Compare two connections
        if (!source.connectionId || !target.connectionId) {
          throw new Error('Connection IDs are required');
        }

        response = await sqlPro.schemaComparison.compareConnections({
          sourceConnectionId: source.connectionId,
          targetConnectionId: target.connectionId,
        });
      } else if (source.type === 'connection' && target.type === 'snapshot') {
        // Compare connection to snapshot
        if (!source.connectionId || !target.snapshotId) {
          throw new Error('Connection ID and snapshot ID are required');
        }

        response = await sqlPro.schemaComparison.compareConnectionToSnapshot({
          connectionId: source.connectionId,
          snapshotId: target.snapshotId,
          reverse: false,
        });
      } else if (source.type === 'snapshot' && target.type === 'connection') {
        // Compare snapshot to connection (reverse)
        if (!source.snapshotId || !target.connectionId) {
          throw new Error('Snapshot ID and connection ID are required');
        }

        response = await sqlPro.schemaComparison.compareConnectionToSnapshot({
          connectionId: target.connectionId,
          snapshotId: source.snapshotId,
          reverse: true,
        });
      } else if (source.type === 'snapshot' && target.type === 'snapshot') {
        // Compare two snapshots
        if (!source.snapshotId || !target.snapshotId) {
          throw new Error('Snapshot IDs are required');
        }

        response = await sqlPro.schemaComparison.compareSnapshots({
          sourceSnapshotId: source.snapshotId,
          targetSnapshotId: target.snapshotId,
        });
      } else {
        throw new Error('Invalid comparison configuration');
      }

      if (response.success && response.result) {
        setComparisonResult(response.result);
      } else {
        setComparisonError(response.error || 'Comparison failed');
      }
    } catch (error) {
      setComparisonError(
        error instanceof Error ? error.message : 'An unexpected error occurred'
      );
    } finally {
      setIsComparing(false);
    }
  }, [source, target, setIsComparing, setComparisonResult, setComparisonError]);

  // Store handleCompare in ref for keyboard shortcuts
  useEffect(() => {
    handleCompareRef.current = handleCompare;
  }, [handleCompare]);

  const canCompare = source && target && !isComparing;

  return (
    <div className={className}>
      <ScrollArea className="h-full">
        <div className="space-y-6 p-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GitCompare className="text-primary h-6 w-6" />
              <div>
                <h1 className="text-2xl font-semibold">Schema Comparison</h1>
                <p className="text-muted-foreground text-sm">
                  Compare schemas between databases or snapshots to identify
                  differences
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
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">
                      Run comparison
                    </span>
                    <ShortcutKbd
                      binding={{ key: 'Enter', modifiers: { cmd: true } }}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">
                      Toggle only differences
                    </span>
                    <ShortcutKbd
                      binding={{ key: 'd', modifiers: { cmd: true } }}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Export report</span>
                    <ShortcutKbd
                      binding={{ key: 'e', modifiers: { cmd: true } }}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Reset filters</span>
                    <ShortcutKbd
                      binding={{ key: 'r', modifiers: { cmd: true } }}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Focus search</span>
                    <ShortcutKbd
                      binding={{ key: 'f', modifiers: { cmd: true } }}
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
                <CardTitle className="text-base">Source</CardTitle>
              </CardHeader>
              <CardContent>
                <SourceSelector
                  type="source"
                  value={source}
                  onChange={setSource}
                />
              </CardContent>
            </Card>

            {/* Arrow Indicator */}
            <div className="hidden items-center justify-center md:absolute md:top-50 md:left-1/2 md:flex md:-translate-x-1/2">
              <ArrowLeftRight className="text-muted-foreground h-6 w-6" />
            </div>

            {/* Target Selector */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Target</CardTitle>
              </CardHeader>
              <CardContent>
                <SourceSelector
                  type="target"
                  value={target}
                  onChange={setTarget}
                />
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
              title="Compare schemas (⌘↵)"
            >
              {isComparing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Comparing...
                </>
              ) : (
                <>
                  <GitCompare className="mr-2 h-4 w-4" />
                  Compare Schemas
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

          {/* Loading State */}
          {isLoadingSnapshots && (
            <div className="text-muted-foreground flex items-center justify-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading snapshots...
            </div>
          )}

          {/* Comparison Results */}
          {comparisonResult && (
            <div className="space-y-4">
              {/* Summary Card */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <CardTitle>Comparison Results</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsExportDialogOpen(true)}
                    title="Export comparison report (⌘E)"
                  >
                    <FileDown className="mr-2 h-4 w-4" />
                    Export Report
                  </Button>
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
                        Summary (
                        {comparisonResult.summary.sourceTables +
                          comparisonResult.summary.targetTables}{' '}
                        tables compared)
                      </p>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                        <div className="rounded bg-green-100 p-2 dark:bg-green-950">
                          <div className="text-green-700 dark:text-green-300">
                            Added
                          </div>
                          <div className="text-lg font-semibold">
                            {comparisonResult.summary.tablesAdded}
                          </div>
                        </div>
                        <div className="rounded bg-red-100 p-2 dark:bg-red-950">
                          <div className="text-red-700 dark:text-red-300">
                            Removed
                          </div>
                          <div className="text-lg font-semibold">
                            {comparisonResult.summary.tablesRemoved}
                          </div>
                        </div>
                        <div className="rounded bg-amber-100 p-2 dark:bg-amber-950">
                          <div className="text-amber-700 dark:text-amber-300">
                            Modified
                          </div>
                          <div className="text-lg font-semibold">
                            {comparisonResult.summary.tablesModified}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Diff Summary - Clickable counts */}
              <DiffSummary comparisonResult={comparisonResult} />

              {/* Detailed Diff View */}
              <Card>
                <CardHeader>
                  <CardTitle>Schema Differences</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Filter Bar */}
                  <DiffFilterBar />

                  {/* Diff View */}
                  <SchemaDiffView comparisonResult={comparisonResult} />
                </CardContent>
              </Card>

              {/* Migration SQL Preview */}
              <MigrationPreview />
            </div>
          )}

          {/* Empty State */}
          {!comparisonResult && !comparisonError && !isComparing && (
            <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 py-12 text-center">
              <GitCompare className="h-12 w-12 opacity-30" />
              <p className="font-medium">Ready to Compare</p>
              <p className="text-sm">
                Select a source and target, then click Compare Schemas
              </p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Export Report Dialog */}
      <ExportReportDialog
        open={isExportDialogOpen}
        onOpenChange={setIsExportDialogOpen}
        comparisonResult={comparisonResult}
      />
    </div>
  );
}

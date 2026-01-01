import { AlertCircle, ArrowLeftRight, GitCompare, Loader2 } from 'lucide-react';
import { useCallback, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { sqlPro } from '@/lib/api';
import { useSchemaComparisonStore } from '@/stores';
import { DiffFilterBar } from './DiffFilterBar';
import { DiffSummary } from './DiffSummary';
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
    setSource,
    setTarget,
    setIsComparing,
    setComparisonResult,
    setComparisonError,
    setAvailableSnapshots,
    setIsLoadingSnapshots,
  } = useSchemaComparisonStore();

  // Load available snapshots on mount
  useEffect(() => {
    const loadSnapshots = async () => {
      setIsLoadingSnapshots(true);
      try {
        const response = await sqlPro.schemaSnapshot.getAll();
        if (response.success && response.snapshots) {
          setAvailableSnapshots(response.snapshots);
        }
      } catch (error) {
        // Silently fail - snapshots are optional
      } finally {
        setIsLoadingSnapshots(false);
      }
    };

    loadSnapshots();
  }, [setAvailableSnapshots, setIsLoadingSnapshots]);

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
  }, [
    source,
    target,
    setIsComparing,
    setComparisonResult,
    setComparisonError,
  ]);

  const canCompare = source && target && !isComparing;

  return (
    <div className={className}>
      <ScrollArea className="h-full">
        <div className="space-y-6 p-6">
          {/* Header */}
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
            <div className="hidden items-center justify-center md:flex md:absolute md:left-1/2 md:top-[200px] md:-translate-x-1/2">
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
              className="min-w-[200px]"
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
    </div>
  );
}

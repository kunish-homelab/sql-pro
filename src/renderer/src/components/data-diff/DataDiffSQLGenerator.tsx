import type { GenerateSyncSQLResponse } from '@shared/types';
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  FileDown,
  FileText,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SqlHighlight } from '@/components/ui/sql-highlight';
import { Switch } from '@/components/ui/switch';
import { sqlPro } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  useConnectionStore,
  useDataDiffStore,
  useQueryTabsStore,
} from '@/stores';

interface DataDiffSQLGeneratorProps {
  className?: string;
}

/**
 * Component to display and manage generated sync SQL for data differences.
 * Supports generating INSERT/UPDATE/DELETE statements for selected rows,
 * copy to clipboard, save to file, and insert into query editor.
 */
export function DataDiffSQLGenerator({ className }: DataDiffSQLGeneratorProps) {
  const { comparisonResult, selectedRowKeys } = useDataDiffStore();
  const { activeConnectionId } = useConnectionStore();
  const { createTab } = useQueryTabsStore();

  const [syncSQL, setSyncSQL] = useState<GenerateSyncSQLResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [includeInserts, setIncludeInserts] = useState(true);
  const [includeUpdates, setIncludeUpdates] = useState(true);
  const [includeDeletes, setIncludeDeletes] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showWarnings, setShowWarnings] = useState(true);

  // Generate sync SQL when comparison result or options change
  useEffect(() => {
    if (!comparisonResult || selectedRowKeys.size === 0) {
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- Clearing state when no selection
      setSyncSQL(null);
      return;
    }

    let cancelled = false;

    const generateSQL = async () => {
      setIsGenerating(true);
      try {
        // Convert selected row keys back to primary key objects
        const selectedRows = Array.from(selectedRowKeys).map((key) =>
          JSON.parse(key)
        );

        const response = await sqlPro.dataDiff.generateSyncSQL({
          comparisonResult,
          selectedRows,
          includeInserts,
          includeUpdates,
          includeDeletes,
        });

        if (!cancelled) {
          setSyncSQL(response);
        }
      } catch (err) {
        if (!cancelled) {
          setSyncSQL({
            success: false,
            error:
              err instanceof Error
                ? err.message
                : 'Failed to generate sync SQL',
          });
        }
      } finally {
        if (!cancelled) {
          setIsGenerating(false);
        }
      }
    };

    generateSQL();

    return () => {
      cancelled = true;
    };
  }, [
    comparisonResult,
    selectedRowKeys,
    includeInserts,
    includeUpdates,
    includeDeletes,
  ]);

  const handleCopyToClipboard = useCallback(async () => {
    if (!syncSQL?.sql) return;

    try {
      await navigator.clipboard.writeText(syncSQL.sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Handle error silently
    }
  }, [syncSQL?.sql]);

  const handleSaveToFile = useCallback(async () => {
    if (!syncSQL?.sql) return;

    try {
      const result = await sqlPro.dialog.saveFile({
        title: 'Save Sync SQL',
        filters: [
          { name: 'SQL Files', extensions: ['sql'] },
          { name: 'All Files', extensions: ['*'] },
        ],
        defaultPath: `data_sync_${new Date().toISOString().split('T')[0]}.sql`,
      });

      if (result.success && result.filePath && !result.canceled) {
        // Write the file using Node.js fs API through electron
        // TODO: Add proper file write API

        // Since there's no direct file write API, we'll use the clipboard as a fallback
        // and inform the user to manually save
        await navigator.clipboard.writeText(syncSQL.sql);
        // eslint-disable-next-line no-alert
        alert(
          `SQL copied to clipboard. Please paste it into a file at:\n${result.filePath}`
        );
      }
    } catch {
      // Handle error silently
    }
  }, [syncSQL?.sql]);

  const handleInsertIntoEditor = useCallback(() => {
    if (!syncSQL?.sql || !activeConnectionId) return;

    // Create a new query tab with the sync SQL
    createTab(activeConnectionId, syncSQL.sql);
  }, [syncSQL?.sql, activeConnectionId, createTab]);

  if (!comparisonResult) {
    return null;
  }

  const hasSelection = selectedRowKeys.size > 0;

  // Calculate statement counts from selected rows
  const getStatementCounts = () => {
    if (!comparisonResult) return { inserts: 0, updates: 0, deletes: 0 };

    // Match selected rows with their diff types
    const selectedDiffs = comparisonResult.rowDiffs.filter((diff) => {
      const rowKey = JSON.stringify(diff.primaryKey);
      return selectedRowKeys.has(rowKey);
    });

    return {
      inserts: selectedDiffs.filter((d) => d.diffType === 'added').length,
      updates: selectedDiffs.filter((d) => d.diffType === 'modified').length,
      deletes: selectedDiffs.filter((d) => d.diffType === 'removed').length,
    };
  };

  const counts = getStatementCounts();

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Sync SQL Generator
          </CardTitle>
          {syncSQL?.statements && (
            <Badge variant="secondary">
              {syncSQL.statements.length} statement
              {syncSQL.statements.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Selection Info */}
        {!hasSelection && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No Rows Selected</AlertTitle>
            <AlertDescription>
              Select one or more rows from the comparison results to generate
              sync SQL statements.
            </AlertDescription>
          </Alert>
        )}

        {hasSelection && (
          <>
            {/* Selection Summary */}
            <div className="rounded-lg border p-3">
              <div className="text-muted-foreground mb-2 text-xs font-medium">
                Selected Rows: {selectedRowKeys.size}
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {counts.inserts > 0 && (
                  <div className="rounded bg-green-100 p-2 dark:bg-green-950">
                    <div className="text-green-700 dark:text-green-300">
                      Inserts
                    </div>
                    <div className="text-lg font-semibold">
                      {counts.inserts}
                    </div>
                  </div>
                )}
                {counts.updates > 0 && (
                  <div className="rounded bg-amber-100 p-2 dark:bg-amber-950">
                    <div className="text-amber-700 dark:text-amber-300">
                      Updates
                    </div>
                    <div className="text-lg font-semibold">
                      {counts.updates}
                    </div>
                  </div>
                )}
                {counts.deletes > 0 && (
                  <div className="rounded bg-red-100 p-2 dark:bg-red-950">
                    <div className="text-red-700 dark:text-red-300">
                      Deletes
                    </div>
                    <div className="text-lg font-semibold">
                      {counts.deletes}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Options */}
            <div className="flex flex-wrap items-center gap-4 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Switch
                  id="include-inserts"
                  checked={includeInserts}
                  onCheckedChange={setIncludeInserts}
                  disabled={isGenerating || counts.inserts === 0}
                />
                <Label
                  htmlFor="include-inserts"
                  className="cursor-pointer text-sm"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-green-600 dark:text-green-400">
                      ■
                    </span>
                    Include INSERT Statements
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-xs font-normal">
                    Add rows that exist in source but not in target
                  </p>
                </Label>
              </div>

              <div className="bg-border h-8 w-px" />

              <div className="flex items-center gap-2">
                <Switch
                  id="include-updates"
                  checked={includeUpdates}
                  onCheckedChange={setIncludeUpdates}
                  disabled={isGenerating || counts.updates === 0}
                />
                <Label
                  htmlFor="include-updates"
                  className="cursor-pointer text-sm"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-amber-600 dark:text-amber-400">
                      ■
                    </span>
                    Include UPDATE Statements
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-xs font-normal">
                    Modify rows with different values between source and target
                  </p>
                </Label>
              </div>

              <div className="bg-border h-8 w-px" />

              <div className="flex items-center gap-2">
                <Switch
                  id="include-deletes"
                  checked={includeDeletes}
                  onCheckedChange={setIncludeDeletes}
                  disabled={isGenerating || counts.deletes === 0}
                />
                <Label
                  htmlFor="include-deletes"
                  className="cursor-pointer text-sm"
                >
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="text-destructive h-3.5 w-3.5" />
                    Include DELETE Statements
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-xs font-normal">
                    Remove rows that exist in target but not in source (⚠️ data
                    loss)
                  </p>
                </Label>
              </div>
            </div>

            {/* Loading State */}
            {isGenerating && (
              <div className="text-muted-foreground flex items-center justify-center gap-2 py-8 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating sync SQL...
              </div>
            )}

            {/* Error State */}
            {syncSQL && !syncSQL.success && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Generation Error</AlertTitle>
                <AlertDescription>{syncSQL.error}</AlertDescription>
              </Alert>
            )}

            {/* No Operations Selected */}
            {!isGenerating &&
              syncSQL?.success &&
              !includeInserts &&
              !includeUpdates &&
              !includeDeletes && (
                <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 py-8 text-center">
                  <AlertCircle className="h-12 w-12 opacity-30" />
                  <p className="font-medium">No Operations Selected</p>
                  <p className="text-sm">
                    Enable at least one statement type (INSERT, UPDATE, or
                    DELETE)
                  </p>
                </div>
              )}

            {/* Success State with SQL */}
            {!isGenerating &&
              syncSQL?.success &&
              (includeInserts || includeUpdates || includeDeletes) && (
                <>
                  {/* Warnings */}
                  {syncSQL.warnings && syncSQL.warnings.length > 0 && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle className="flex items-center justify-between">
                        <span>Warnings ({syncSQL.warnings.length})</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowWarnings(!showWarnings)}
                          className="h-auto p-0 text-xs"
                        >
                          {showWarnings ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </AlertTitle>
                      {showWarnings && (
                        <AlertDescription className="mt-2">
                          <ul className="list-inside list-disc space-y-1 text-xs">
                            {syncSQL.warnings.map((warning) => (
                              <li key={warning}>{warning}</li>
                            ))}
                          </ul>
                        </AlertDescription>
                      )}
                    </Alert>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleCopyToClipboard}
                      disabled={!syncSQL.sql}
                    >
                      {copied ? (
                        <>
                          <Check className="mr-2 h-4 w-4" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="mr-2 h-4 w-4" />
                          Copy to Clipboard
                        </>
                      )}
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSaveToFile}
                      disabled={!syncSQL.sql}
                    >
                      <FileDown className="mr-2 h-4 w-4" />
                      Save to File
                    </Button>

                    {activeConnectionId && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleInsertIntoEditor}
                        disabled={!syncSQL.sql}
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        Open in Query Editor
                      </Button>
                    )}
                  </div>

                  {/* SQL Display */}
                  {syncSQL.sql && (
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">
                        Generated SQL:
                      </Label>
                      <ScrollArea className="h-100 rounded-lg border">
                        <div className="p-4">
                          <SqlHighlight
                            code={syncSQL.sql}
                            className={cn(
                              'text-sm',
                              syncSQL.sql.length > 5000 && 'text-xs'
                            )}
                          />
                        </div>
                      </ScrollArea>
                    </div>
                  )}

                  {/* Statement Count Info */}
                  {syncSQL.statements && syncSQL.statements.length > 0 && (
                    <p className="text-muted-foreground text-xs">
                      💡 Tip: Review the SQL carefully before executing,
                      especially if DELETE statements are included. Consider
                      backing up your database first.
                    </p>
                  )}
                </>
              )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

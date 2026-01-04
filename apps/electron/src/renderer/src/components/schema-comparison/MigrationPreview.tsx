import type { GenerateMigrationSQLResponse } from '@shared/types';
import { Alert, AlertDescription, AlertTitle } from '@sqlpro/ui/alert';
import { Badge } from '@sqlpro/ui/badge';
import { Button } from '@sqlpro/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@sqlpro/ui/card';
import { Label } from '@sqlpro/ui/label';
import { ScrollArea } from '@sqlpro/ui/scroll-area';
import { Switch } from '@sqlpro/ui/switch';
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  FileDown,
  FileText,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { SqlHighlight } from '@/components/ui/sql-highlight';
import { sqlPro } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  useConnectionStore,
  useQueryTabsStore,
  useSchemaComparisonStore,
} from '@/stores';

interface MigrationPreviewProps {
  className?: string;
}

/**
 * Component to display and manage generated migration SQL.
 * Supports forward/reverse migrations, copy to clipboard, save to file,
 * and insert into query editor.
 */
export function MigrationPreview({ className }: MigrationPreviewProps) {
  const { comparisonResult } = useSchemaComparisonStore();
  const { activeConnectionId } = useConnectionStore();
  const { createTab } = useQueryTabsStore();

  const [migrationSQL, setMigrationSQL] =
    useState<GenerateMigrationSQLResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [reverse, setReverse] = useState(false);
  const [includeDropStatements, setIncludeDropStatements] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showWarnings, setShowWarnings] = useState(true);

  // Generate migration SQL when comparison result or options change

  useEffect(() => {
    if (!comparisonResult) {
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- Clearing state when no comparison result
      setMigrationSQL(null);
      return;
    }

    let cancelled = false;

    const generateSQL = async () => {
      setIsGenerating(true);
      try {
        const response = await sqlPro.schemaComparison.generateMigrationSQL({
          comparisonResult,
          reverse,
          includeDropStatements,
        });

        if (!cancelled) {
          setMigrationSQL(response);
        }
      } catch (err) {
        if (!cancelled) {
          setMigrationSQL({
            success: false,
            error:
              err instanceof Error
                ? err.message
                : 'Failed to generate migration SQL',
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
  }, [comparisonResult, reverse, includeDropStatements]);

  const handleCopyToClipboard = useCallback(async () => {
    if (!migrationSQL?.sql) return;

    try {
      await navigator.clipboard.writeText(migrationSQL.sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Handle error silently
    }
  }, [migrationSQL?.sql]);

  const handleSaveToFile = useCallback(async () => {
    if (!migrationSQL?.sql) return;

    try {
      const result = await sqlPro.dialog.saveFile({
        title: 'Save Migration SQL',
        filters: [
          { name: 'SQL Files', extensions: ['sql'] },
          { name: 'All Files', extensions: ['*'] },
        ],
        defaultPath: `migration_${new Date().toISOString().split('T')[0]}.sql`,
      });

      if (result.success && result.filePath && !result.canceled) {
        // Write the file using Node.js fs API through electron
        // TODO: Add proper file write API

        // Since there's no direct file write API, we'll use the clipboard as a fallback
        // and inform the user to manually save
        await navigator.clipboard.writeText(migrationSQL.sql);
        // eslint-disable-next-line no-alert
        alert(
          `SQL copied to clipboard. Please paste it into a file at:\n${result.filePath}`
        );
      }
    } catch {
      // Handle error silently
    }
  }, [migrationSQL?.sql]);

  const handleInsertIntoEditor = useCallback(() => {
    if (!migrationSQL?.sql || !activeConnectionId) return;

    // Create a new query tab with the migration SQL
    createTab(activeConnectionId, migrationSQL.sql);
  }, [migrationSQL?.sql, activeConnectionId, createTab]);

  if (!comparisonResult) {
    return null;
  }

  const hasChanges =
    comparisonResult.summary.tablesAdded > 0 ||
    comparisonResult.summary.tablesRemoved > 0 ||
    comparisonResult.summary.tablesModified > 0;

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Migration SQL
          </CardTitle>
          {migrationSQL?.statements && (
            <Badge variant="secondary">
              {migrationSQL.statements.length} statement
              {migrationSQL.statements.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Options */}
        <div className="flex flex-wrap items-center gap-4 rounded-lg border p-3">
          <div className="flex items-center gap-2">
            <Switch
              id="reverse-migration"
              checked={reverse}
              onCheckedChange={setReverse}
              disabled={isGenerating}
            />
            <Label
              htmlFor="reverse-migration"
              className="cursor-pointer text-sm"
            >
              <div className="flex items-center gap-1.5">
                <RotateCcw className="h-3.5 w-3.5" />
                Reverse Migration
              </div>
              <p className="text-muted-foreground mt-0.5 text-xs font-normal">
                Generate SQL to go from target back to source
              </p>
            </Label>
          </div>

          <div className="bg-border h-8 w-px" />

          <div className="flex items-center gap-2">
            <Switch
              id="include-drops"
              checked={includeDropStatements}
              onCheckedChange={setIncludeDropStatements}
              disabled={isGenerating}
            />
            <Label htmlFor="include-drops" className="cursor-pointer text-sm">
              <div className="flex items-center gap-1.5">
                <AlertCircle className="text-destructive h-3.5 w-3.5" />
                Include DROP Statements
              </div>
              <p className="text-muted-foreground mt-0.5 text-xs font-normal">
                Include statements that remove tables/columns (may lose data)
              </p>
            </Label>
          </div>
        </div>

        {/* Loading State */}
        {isGenerating && (
          <div className="text-muted-foreground flex items-center justify-center gap-2 py-8 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating migration SQL...
          </div>
        )}

        {/* Error State */}
        {migrationSQL && !migrationSQL.success && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Generation Error</AlertTitle>
            <AlertDescription>{migrationSQL.error}</AlertDescription>
          </Alert>
        )}

        {/* No Changes */}
        {!isGenerating && migrationSQL?.success && !hasChanges && (
          <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 py-8 text-center">
            <Check className="h-12 w-12 opacity-30" />
            <p className="font-medium">No Changes Detected</p>
            <p className="text-sm">
              The schemas are identical - no migration is needed
            </p>
          </div>
        )}

        {/* Success State with SQL */}
        {!isGenerating && migrationSQL?.success && hasChanges && (
          <>
            {/* Warnings */}
            {migrationSQL.warnings && migrationSQL.warnings.length > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="flex items-center justify-between">
                  <span>Warnings ({migrationSQL.warnings.length})</span>
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
                      {migrationSQL.warnings.map((warning) => (
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
                disabled={!migrationSQL.sql}
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
                disabled={!migrationSQL.sql}
              >
                <FileDown className="mr-2 h-4 w-4" />
                Save to File
              </Button>

              {activeConnectionId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleInsertIntoEditor}
                  disabled={!migrationSQL.sql}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Open in Query Editor
                </Button>
              )}
            </div>

            {/* SQL Display */}
            {migrationSQL.sql && (
              <div className="space-y-2">
                <Label className="text-xs font-medium">Generated SQL:</Label>
                <ScrollArea className="h-100 rounded-lg border">
                  <div className="p-4">
                    <SqlHighlight
                      code={migrationSQL.sql}
                      className={cn(
                        'text-sm',
                        migrationSQL.sql.length > 5000 && 'text-xs'
                      )}
                    />
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Statement Count Info */}
            {migrationSQL.statements && migrationSQL.statements.length > 0 && (
              <p className="text-muted-foreground text-xs">
                💡 Tip: Review the SQL carefully before executing, especially if
                DROP statements are included. Consider backing up your database
                first.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

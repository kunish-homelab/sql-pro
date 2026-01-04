import type { ImportSchemaResponse, ShareableSchema } from '@shared/types';
import { Button } from '@sqlpro/ui/button';
import { Checkbox } from '@sqlpro/ui/checkbox';
import { Label } from '@sqlpro/ui/label';
import { Textarea } from '@sqlpro/ui/textarea';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Database,
  FileUp,
  Loader2,
  Upload,
} from 'lucide-react';
import { useCallback, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { sqlPro } from '@/lib/api';

export interface SchemaImportDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** Connection ID to import schema into */
  connectionId?: string;
  /** Callback when import completes successfully with the imported schema */
  onImportComplete?: (schema: ShareableSchema) => void;
}

export function SchemaImportDialog({
  open,
  onOpenChange,
  connectionId,
  onImportComplete,
}: SchemaImportDialogProps) {
  // Import state
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportSchemaResponse | null>(
    null
  );

  // Handle import - file dialog is shown by IPC handler
  const handleImport = useCallback(async () => {
    setIsImporting(true);
    setImportResult(null);

    try {
      // File path is selected via dialog in IPC handler
      const result = await sqlPro.sharing.importSchema({
        filePath: '',
      });

      setImportResult(result);

      if (result.success && result.schema && onImportComplete) {
        onImportComplete(result.schema);
      }
    } catch (err) {
      setImportResult({
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsImporting(false);
    }
  }, [onImportComplete]);

  // Reset dialog state on close
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        // Reset state when closing
        setImportResult(null);
      }
      onOpenChange(newOpen);
    },
    [onOpenChange]
  );

  const hasErrors =
    importResult?.validation?.errors &&
    importResult.validation.errors.length > 0;
  const hasWarnings =
    importResult?.validation?.warnings &&
    importResult.validation.warnings.length > 0;
  const isValid = importResult?.validation?.valid === true;
  const versionCompatible =
    importResult?.validation?.versionCompatible !== false;

  // Calculate statistics for the imported schema
  const getSchemaStats = (schema: ShareableSchema | undefined) => {
    if (!schema) return null;

    if (schema.format === 'json' && schema.schemas) {
      const totalTables = schema.schemas.reduce(
        (sum, s) => sum + s.tables.length,
        0
      );
      const totalViews = schema.schemas.reduce(
        (sum, s) => sum + (s.views?.length || 0),
        0
      );
      const totalIndexes = schema.schemas.reduce(
        (sum, s) =>
          sum +
          s.tables.reduce((t, table) => t + (table.indexes?.length || 0), 0),
        0
      );

      return {
        schemas: schema.schemas.length,
        tables: totalTables,
        views: totalViews,
        indexes: totalIndexes,
      };
    } else if (schema.format === 'sql' && schema.sqlStatements) {
      const createTableCount = schema.sqlStatements.filter((stmt) =>
        /^\s*CREATE\s+TABLE/i.test(stmt)
      ).length;
      const createIndexCount = schema.sqlStatements.filter((stmt) =>
        /^\s*CREATE\s+(?:UNIQUE\s+)?INDEX/i.test(stmt)
      ).length;
      const createTriggerCount = schema.sqlStatements.filter((stmt) =>
        /^\s*CREATE\s+TRIGGER/i.test(stmt)
      ).length;

      return {
        statements: schema.sqlStatements.length,
        tables: createTableCount,
        indexes: createIndexCount,
        triggers: createTriggerCount,
      };
    }

    return null;
  };

  const stats = getSchemaStats(importResult?.schema);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Schema
          </DialogTitle>
          <DialogDescription>
            Import schema definitions from a previously exported file with
            validation and preview
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!importResult ? (
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm">
                Click the button below to select a schema file to import. The
                file will be validated before you can use it.
              </p>
              {connectionId && (
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-sm">
                    <span className="font-medium">Note:</span> This schema will
                    be imported into the currently connected database. Make sure
                    to review the preview before applying any changes.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Validation Status */}
              <div className="space-y-3">
                {/* Version Compatibility */}
                {!versionCompatible && (
                  <div className="bg-destructive/10 flex items-start gap-3 rounded-lg p-4">
                    <AlertCircle className="text-destructive h-5 w-5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-destructive font-medium">
                        Version Incompatible
                      </p>
                      <p className="text-destructive/80 mt-1 text-sm">
                        This schema was created with an incompatible version and
                        may not work correctly.
                      </p>
                    </div>
                  </div>
                )}

                {/* Compression Info */}
                {importResult.validation?.compressionInfo?.compressed && (
                  <div className="bg-muted flex items-start gap-3 rounded-lg p-3">
                    <CheckCircle2 className="text-muted-foreground h-5 w-5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        Compressed File Detected
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Algorithm:{' '}
                        {importResult.validation.compressionInfo.algorithm}{' '}
                        {importResult.validation.compressionInfo.originalSize &&
                          importResult.validation.compressionInfo
                            .compressedSize && (
                            <>
                              • Original:{' '}
                              {Math.round(
                                importResult.validation.compressionInfo
                                  .originalSize / 1024
                              )}
                              KB → Compressed:{' '}
                              {Math.round(
                                importResult.validation.compressionInfo
                                  .compressedSize / 1024
                              )}
                              KB
                            </>
                          )}
                      </p>
                    </div>
                  </div>
                )}

                {/* Validation Errors */}
                {hasErrors && (
                  <div className="bg-destructive/10 space-y-2 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="text-destructive h-5 w-5 shrink-0" />
                      <div className="flex-1">
                        <p className="text-destructive font-medium">
                          Validation Errors
                        </p>
                        <p className="text-destructive/80 mt-1 text-sm">
                          The following errors were found in the imported
                          schema:
                        </p>
                      </div>
                    </div>
                    <ul className="text-destructive/80 ml-8 list-inside list-disc space-y-1 text-sm">
                      {importResult.validation!.errors!.map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Validation Warnings */}
                {hasWarnings && (
                  <div className="space-y-2 rounded-lg border border-yellow-500/30 bg-yellow-50 p-4 dark:bg-yellow-950/30">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 shrink-0 text-yellow-600 dark:text-yellow-400" />
                      <div className="flex-1">
                        <p className="font-medium text-yellow-900 dark:text-yellow-100">
                          Warnings
                        </p>
                        <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
                          The schema is valid but has some warnings:
                        </p>
                      </div>
                    </div>
                    <ul className="ml-8 list-inside list-disc space-y-1 text-sm text-yellow-700 dark:text-yellow-300">
                      {importResult.validation!.warnings!.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Success Status */}
                {isValid && !hasErrors && !hasWarnings && (
                  <div className="flex items-start gap-3 rounded-lg bg-green-50 p-4 dark:bg-green-950">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
                    <div className="flex-1">
                      <p className="font-medium text-green-900 dark:text-green-100">
                        Validation Successful
                      </p>
                      <p className="mt-1 text-sm text-green-700 dark:text-green-300">
                        The schema is valid and ready to use
                      </p>
                    </div>
                  </div>
                )}

                {/* Import Error */}
                {!importResult.success && (
                  <div className="bg-destructive/10 rounded-lg p-4">
                    <p className="text-destructive font-medium">
                      Import Failed
                    </p>
                    <p className="text-destructive/80 mt-1 text-sm">
                      {importResult.error || 'Unknown error occurred'}
                    </p>
                  </div>
                )}
              </div>

              {/* Schema Preview */}
              {importResult.schema && (
                <div className="space-y-4 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Schema Preview</h3>
                    {importResult.schema.metadata && (
                      <span className="text-muted-foreground text-xs">
                        Version: {importResult.schema.metadata.version}
                      </span>
                    )}
                  </div>

                  {/* Schema Name */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Schema Name</Label>
                    <p className="text-sm">{importResult.schema.name}</p>
                  </div>

                  {/* Description */}
                  {importResult.schema.description && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Description</Label>
                      <p className="text-muted-foreground text-sm">
                        {importResult.schema.description}
                      </p>
                    </div>
                  )}

                  {/* Database Info */}
                  <div className="grid grid-cols-2 gap-4">
                    {importResult.schema.databaseName && (
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">
                          Database Name
                        </Label>
                        <p className="text-muted-foreground text-sm">
                          {importResult.schema.databaseName}
                        </p>
                      </div>
                    )}
                    {importResult.schema.databaseType && (
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">
                          Database Type
                        </Label>
                        <p className="text-muted-foreground text-sm capitalize">
                          {importResult.schema.databaseType}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Format and Statistics */}
                  <div className="bg-muted space-y-2 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Database className="text-muted-foreground h-4 w-4" />
                      <Label className="text-xs font-medium">
                        Export Format
                      </Label>
                    </div>
                    <p className="text-sm">
                      {importResult.schema.format === 'json'
                        ? 'JSON (Schema Metadata)'
                        : 'SQL (CREATE Statements)'}
                    </p>
                    {stats && (
                      <div className="text-muted-foreground grid grid-cols-2 gap-2 pt-2 text-xs">
                        {importResult.schema.format === 'json' ? (
                          <>
                            <div>
                              <span className="font-medium">Schemas:</span>{' '}
                              {stats.schemas}
                            </div>
                            <div>
                              <span className="font-medium">Tables:</span>{' '}
                              {stats.tables}
                            </div>
                            {(stats.views ?? 0) > 0 && (
                              <div>
                                <span className="font-medium">Views:</span>{' '}
                                {stats.views}
                              </div>
                            )}
                            {stats.indexes > 0 && (
                              <div>
                                <span className="font-medium">Indexes:</span>{' '}
                                {stats.indexes}
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <div>
                              <span className="font-medium">
                                Total Statements:
                              </span>{' '}
                              {stats.statements}
                            </div>
                            <div>
                              <span className="font-medium">Tables:</span>{' '}
                              {stats.tables}
                            </div>
                            {stats.indexes > 0 && (
                              <div>
                                <span className="font-medium">Indexes:</span>{' '}
                                {stats.indexes}
                              </div>
                            )}
                            {(stats.triggers ?? 0) > 0 && (
                              <div>
                                <span className="font-medium">Triggers:</span>{' '}
                                {stats.triggers}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Export Options */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">
                      Export Options
                    </Label>
                    <div className="space-y-1.5 rounded-lg border p-3">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={
                            (importResult.schema.options?.includeIndexes as
                              | boolean
                              | undefined) ?? false
                          }
                          disabled
                        />
                        <span className="text-sm">Include Indexes</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={
                            (importResult.schema.options?.includeTriggers as
                              | boolean
                              | undefined) ?? false
                          }
                          disabled
                        />
                        <span className="text-sm">Include Triggers</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={
                            (importResult.schema.options?.includeForeignKeys as
                              | boolean
                              | undefined) ?? false
                          }
                          disabled
                        />
                        <span className="text-sm">Include Foreign Keys</span>
                      </div>
                    </div>
                  </div>

                  {/* Table List Preview (for JSON format) */}
                  {importResult.schema.format === 'json' &&
                    importResult.schema.schemas &&
                    importResult.schema.schemas.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-xs font-medium">
                          Tables Included
                        </Label>
                        <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border p-3">
                          {importResult.schema.schemas.map((schema) => (
                            <div key={schema.name} className="space-y-1">
                              <p className="text-sm font-medium">
                                {schema.name}
                              </p>
                              <div className="ml-4 space-y-0.5">
                                {schema.tables.map((table) => (
                                  <p
                                    key={table.name}
                                    className="text-muted-foreground text-xs"
                                  >
                                    • {table.name} ({table.columns.length}{' '}
                                    column
                                    {table.columns.length !== 1 ? 's' : ''})
                                  </p>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* SQL Preview (for SQL format) */}
                  {importResult.schema.format === 'sql' &&
                    importResult.schema.sqlStatements &&
                    importResult.schema.sqlStatements.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-xs font-medium">
                          SQL Statements Preview
                        </Label>
                        <Textarea
                          value={importResult.schema.sqlStatements
                            .slice(0, 5)
                            .join('\n\n')}
                          readOnly
                          className="bg-muted font-mono text-xs"
                          rows={10}
                        />
                        {importResult.schema.sqlStatements.length > 5 && (
                          <p className="text-muted-foreground text-xs">
                            Showing first 5 of{' '}
                            {importResult.schema.sqlStatements.length}{' '}
                            statements
                          </p>
                        )}
                      </div>
                    )}

                  {/* Documentation */}
                  {importResult.schema.documentation && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">
                        Documentation
                      </Label>
                      <Textarea
                        value={importResult.schema.documentation}
                        readOnly
                        className="bg-muted text-xs"
                        rows={4}
                      />
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="border-t pt-3">
                    <div className="text-muted-foreground grid grid-cols-2 gap-2 text-xs">
                      {importResult.schema.createdAt && (
                        <div>
                          <span className="font-medium">Created:</span>{' '}
                          {new Date(
                            importResult.schema.createdAt
                          ).toLocaleString()}
                        </div>
                      )}
                      {importResult.schema.author && (
                        <div>
                          <span className="font-medium">Author:</span>{' '}
                          {importResult.schema.author}
                        </div>
                      )}
                      {importResult.schema.metadata?.exportedAt && (
                        <div>
                          <span className="font-medium">Exported:</span>{' '}
                          {new Date(
                            importResult.schema.metadata.exportedAt
                          ).toLocaleString()}
                        </div>
                      )}
                      {importResult.schema.metadata?.appVersion && (
                        <div>
                          <span className="font-medium">App Version:</span>{' '}
                          {importResult.schema.metadata.appVersion}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Conflict Warning */}
                  {isValid && stats && stats.tables > 0 && (
                    <div className="space-y-2 rounded-lg border border-yellow-500/30 bg-yellow-50 p-3 dark:bg-yellow-950/30">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-600 dark:text-yellow-400" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                            Schema Conflict Warning
                          </p>
                          <p className="mt-1 text-xs text-yellow-700 dark:text-yellow-300">
                            This schema contains{' '}
                            {importResult.schema.format === 'json'
                              ? `${stats.tables} table${stats.tables !== 1 ? 's' : ''}`
                              : `${stats.statements} SQL statement${stats.statements !== 1 ? 's' : ''}`}
                            . Importing will create or replace tables in your
                            database. Make sure to back up your data before
                            applying this schema.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isImporting}
          >
            {importResult ? 'Close' : 'Cancel'}
          </Button>
          {!importResult && (
            <Button onClick={handleImport} disabled={isImporting}>
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <FileUp className="mr-2 h-4 w-4" />
                  Select File
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

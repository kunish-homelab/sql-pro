import type { ImportQueryResponse, ShareableQuery } from '@shared/types';
import { Button } from '@sqlpro/ui/button';
import { Label } from '@sqlpro/ui/label';
import { Textarea } from '@sqlpro/ui/textarea';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
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

export interface QueryImportDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** Callback when import completes successfully with the imported query */
  onImportComplete?: (query: ShareableQuery) => void;
}

export function QueryImportDialog({
  open,
  onOpenChange,
  onImportComplete,
}: QueryImportDialogProps) {
  // Import state
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportQueryResponse | null>(
    null
  );

  // Handle import - file dialog is shown by IPC handler
  const handleImport = useCallback(async () => {
    setIsImporting(true);
    setImportResult(null);

    try {
      // File path is selected via dialog in IPC handler
      const result = await sqlPro.sharing.importQuery({
        filePath: '',
      });

      setImportResult(result);

      if (result.success && result.query && onImportComplete) {
        onImportComplete(result.query);
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Query
          </DialogTitle>
          <DialogDescription>
            Import a query from a previously exported file with validation and
            preview
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!importResult ? (
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm">
                Click the button below to select a query file to import. The
                file will be validated before you can use it.
              </p>
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
                        This query was created with an incompatible version and
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
                          The following errors were found in the imported query:
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
                          The query is valid but has some warnings:
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
                        The query is valid and ready to use
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

              {/* Query Preview */}
              {importResult.query && (
                <div className="space-y-4 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Query Preview</h3>
                    {importResult.query.metadata && (
                      <span className="text-muted-foreground text-xs">
                        Version: {importResult.query.metadata.version}
                      </span>
                    )}
                  </div>

                  {/* Query Name */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Name</Label>
                    <p className="text-sm">{importResult.query.name}</p>
                  </div>

                  {/* Description */}
                  {importResult.query.description && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Description</Label>
                      <p className="text-muted-foreground text-sm">
                        {importResult.query.description}
                      </p>
                    </div>
                  )}

                  {/* SQL Query */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">SQL Query</Label>
                    <Textarea
                      value={importResult.query.sql}
                      readOnly
                      className="bg-muted font-mono text-xs"
                      rows={6}
                    />
                    <p className="text-muted-foreground text-xs">
                      {importResult.query.sql.length} characters
                    </p>
                  </div>

                  {/* Database Context */}
                  {importResult.query.databaseContext && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">
                        Database Context
                      </Label>
                      <p className="text-muted-foreground text-sm">
                        {importResult.query.databaseContext}
                      </p>
                    </div>
                  )}

                  {/* Tags */}
                  {importResult.query.tags &&
                    importResult.query.tags.length > 0 && (
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Tags</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {importResult.query.tags.map((tag) => (
                            <span
                              key={tag}
                              className="bg-muted text-muted-foreground rounded-md px-2 py-0.5 text-xs"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Documentation */}
                  {importResult.query.documentation && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">
                        Documentation
                      </Label>
                      <Textarea
                        value={importResult.query.documentation}
                        readOnly
                        className="bg-muted text-xs"
                        rows={4}
                      />
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="border-t pt-3">
                    <div className="text-muted-foreground grid grid-cols-2 gap-2 text-xs">
                      {importResult.query.createdAt && (
                        <div>
                          <span className="font-medium">Created:</span>{' '}
                          {new Date(
                            importResult.query.createdAt
                          ).toLocaleString()}
                        </div>
                      )}
                      {importResult.query.modifiedAt && (
                        <div>
                          <span className="font-medium">Modified:</span>{' '}
                          {new Date(
                            importResult.query.modifiedAt
                          ).toLocaleString()}
                        </div>
                      )}
                      {importResult.query.author && (
                        <div>
                          <span className="font-medium">Author:</span>{' '}
                          {importResult.query.author}
                        </div>
                      )}
                      {importResult.query.metadata?.exportedAt && (
                        <div>
                          <span className="font-medium">Exported:</span>{' '}
                          {new Date(
                            importResult.query.metadata.exportedAt
                          ).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
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

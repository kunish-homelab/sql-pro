import type { ExportBundleRequest, QueryHistoryEntry } from '@shared/types';
import { FileDown, Loader2, Package } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { sqlPro } from '@/lib/api';

export interface QueryBundleExportDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** Selected queries from history to export */
  queries: QueryHistoryEntry[];
  /** Initial database context */
  initialDatabaseContext?: string;
  /** Callback when export completes successfully */
  onExportComplete?: (filePath: string) => void;
}

interface QueryMetadata {
  name: string;
  description: string;
  notes: string;
  tags: string;
}

export function QueryBundleExportDialog({
  open,
  onOpenChange,
  queries,
  initialDatabaseContext = '',
  onExportComplete,
}: QueryBundleExportDialogProps) {
  // Bundle metadata state
  const [bundleName, setBundleName] = useState('');
  const [bundleDescription, setBundleDescription] = useState('');
  const [databaseContext, setDatabaseContext] = useState(
    initialDatabaseContext
  );
  const [bundleTags, setBundleTags] = useState('');
  const [documentation, setDocumentation] = useState('');
  const [compress, setCompress] = useState(false);

  // Individual query metadata state
  const [queryMetadata, setQueryMetadata] = useState<
    Record<string, QueryMetadata>
  >({});

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{
    success: boolean;
    filePath?: string;
    error?: string;
  } | null>(null);

  // Get or initialize metadata for a query
  const getQueryMetadata = useCallback(
    (queryId: string): QueryMetadata => {
      return (
        queryMetadata[queryId] || {
          name: '',
          description: '',
          notes: '',
          tags: '',
        }
      );
    },
    [queryMetadata]
  );

  // Update metadata for a specific query
  const updateQueryMetadata = useCallback(
    (queryId: string, field: keyof QueryMetadata, value: string) => {
      setQueryMetadata((prev) => ({
        ...prev,
        [queryId]: {
          ...getQueryMetadata(queryId),
          [field]: value,
        },
      }));
    },
    [getQueryMetadata]
  );

  // Parse tags from comma-separated input
  const parseBundleTags = bundleTags
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);

  // Validation
  const isValid = bundleName.trim().length > 0 && queries.length > 0;

  // Handle export
  const handleExport = useCallback(async () => {
    if (!isValid) return;

    setIsExporting(true);
    setExportResult(null);

    try {
      const request: ExportBundleRequest = {
        bundle: {
          name: bundleName.trim(),
          description: bundleDescription.trim() || undefined,
          queries: queries.map((query, index) => {
            const metadata = getQueryMetadata(query.id);
            const parsedTags = metadata.tags
              .split(',')
              .map((tag) => tag.trim())
              .filter((tag) => tag.length > 0);

            return {
              id: query.id,
              name: metadata.name.trim() || `Query ${index + 1}`,
              description: metadata.description.trim() || undefined,
              sql: query.queryText,
              notes: metadata.notes.trim() || undefined,
              tags: parsedTags.length > 0 ? parsedTags : undefined,
              order: index,
            };
          }),
          databaseContext: databaseContext.trim() || undefined,
          tags: parseBundleTags.length > 0 ? parseBundleTags : undefined,
          documentation: documentation.trim() || undefined,
        },
        compress,
      };

      const result = await sqlPro.sharing.exportBundle(request);

      setExportResult(result);

      if (result.success && result.filePath && onExportComplete) {
        onExportComplete(result.filePath);
      }
    } catch (err) {
      setExportResult({
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsExporting(false);
    }
  }, [
    bundleName,
    bundleDescription,
    databaseContext,
    parseBundleTags,
    documentation,
    compress,
    queries,
    isValid,
    getQueryMetadata,
    onExportComplete,
  ]);

  // Reset dialog state on close
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        // Reset state when closing
        setBundleName('');
        setBundleDescription('');
        setDatabaseContext(initialDatabaseContext);
        setBundleTags('');
        setDocumentation('');
        setCompress(false);
        setQueryMetadata({});
        setExportResult(null);
      }
      onOpenChange(newOpen);
    },
    [onOpenChange, initialDatabaseContext]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Export Query Bundle
          </DialogTitle>
          <DialogDescription>
            Export {queries.length} quer{queries.length !== 1 ? 'ies' : 'y'} as
            a bundle with shared metadata and individual query notes
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {exportResult ? (
            <div className="space-y-3">
              {exportResult.success ? (
                <div className="space-y-2 rounded-lg bg-green-50 p-4 dark:bg-green-950">
                  <p className="font-medium text-green-900 dark:text-green-100">
                    Export Successful
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Bundle exported successfully with {queries.length} quer
                    {queries.length !== 1 ? 'ies' : 'y'}
                  </p>
                  {exportResult.filePath && (
                    <p className="text-xs break-all text-green-600 dark:text-green-400">
                      {exportResult.filePath}
                    </p>
                  )}
                </div>
              ) : (
                <div className="bg-destructive/10 rounded-lg p-4">
                  <p className="text-destructive font-medium">Export Failed</p>
                  <p className="text-destructive/80 mt-1 text-sm">
                    {exportResult.error || 'Unknown error occurred'}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Bundle Metadata */}
              <div className="space-y-4 rounded-lg border p-4">
                <h4 className="text-sm font-semibold">Bundle Information</h4>

                {/* Bundle Name (Required) */}
                <div className="space-y-2">
                  <Label htmlFor="bundle-name" className="text-sm font-medium">
                    Bundle Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="bundle-name"
                    value={bundleName}
                    onChange={(e) => setBundleName(e.target.value)}
                    placeholder="e.g., Analytics Query Collection"
                    maxLength={200}
                    disabled={isExporting}
                  />
                  <p className="text-muted-foreground text-xs">
                    A descriptive name for this query bundle
                  </p>
                </div>

                {/* Bundle Description (Optional) */}
                <div className="space-y-2">
                  <Label
                    htmlFor="bundle-description"
                    className="text-sm font-medium"
                  >
                    Description
                  </Label>
                  <Textarea
                    id="bundle-description"
                    value={bundleDescription}
                    onChange={(e) => setBundleDescription(e.target.value)}
                    placeholder="Brief description of this query collection"
                    maxLength={1000}
                    rows={2}
                    disabled={isExporting}
                  />
                  <p className="text-muted-foreground text-xs">
                    Optional description of the bundle purpose
                  </p>
                </div>

                {/* Database Context (Optional) */}
                <div className="space-y-2">
                  <Label
                    htmlFor="database-context"
                    className="text-sm font-medium"
                  >
                    Database Context
                  </Label>
                  <Input
                    id="database-context"
                    value={databaseContext}
                    onChange={(e) => setDatabaseContext(e.target.value)}
                    placeholder="e.g., production, analytics, customers.db"
                    maxLength={200}
                    disabled={isExporting}
                  />
                  <p className="text-muted-foreground text-xs">
                    Optional context about which database these queries are for
                  </p>
                </div>

                {/* Bundle Tags (Optional) */}
                <div className="space-y-2">
                  <Label htmlFor="bundle-tags" className="text-sm font-medium">
                    Tags
                  </Label>
                  <Input
                    id="bundle-tags"
                    value={bundleTags}
                    onChange={(e) => setBundleTags(e.target.value)}
                    placeholder="e.g., analytics, reporting, templates"
                    disabled={isExporting}
                  />
                  <p className="text-muted-foreground text-xs">
                    Comma-separated tags for categorization
                    {parseBundleTags.length > 0 &&
                      ` (${parseBundleTags.length} tag${parseBundleTags.length !== 1 ? 's' : ''})`}
                  </p>
                </div>

                {/* Documentation (Optional) */}
                <div className="space-y-2">
                  <Label
                    htmlFor="bundle-documentation"
                    className="text-sm font-medium"
                  >
                    Documentation
                  </Label>
                  <Textarea
                    id="bundle-documentation"
                    value={documentation}
                    onChange={(e) => setDocumentation(e.target.value)}
                    placeholder="Additional notes, usage examples, or important considerations..."
                    maxLength={10000}
                    rows={3}
                    disabled={isExporting}
                  />
                  <p className="text-muted-foreground text-xs">
                    Optional detailed documentation ({documentation.length}
                    /10000)
                  </p>
                </div>
              </div>

              {/* Individual Query Metadata */}
              <div className="space-y-4 rounded-lg border p-4">
                <h4 className="text-sm font-semibold">
                  Individual Queries ({queries.length})
                </h4>
                <ScrollArea className="h-[300px] pr-4">
                  <div className="space-y-4">
                    {queries.map((query, index) => {
                      const metadata = getQueryMetadata(query.id);
                      return (
                        <div
                          key={query.id}
                          className="space-y-3 rounded-md border p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className="text-sm font-medium">
                                Query {index + 1}
                              </p>
                              <p className="text-muted-foreground font-mono text-xs">
                                {query.queryText.substring(0, 80)}
                                {query.queryText.length > 80 ? '...' : ''}
                              </p>
                            </div>
                          </div>

                          {/* Query Name */}
                          <div className="space-y-1.5">
                            <Label
                              htmlFor={`query-name-${query.id}`}
                              className="text-xs"
                            >
                              Name
                            </Label>
                            <Input
                              id={`query-name-${query.id}`}
                              value={metadata.name}
                              onChange={(e) =>
                                updateQueryMetadata(
                                  query.id,
                                  'name',
                                  e.target.value
                                )
                              }
                              placeholder={`Query ${index + 1}`}
                              maxLength={200}
                              disabled={isExporting}
                              className="h-8 text-xs"
                            />
                          </div>

                          {/* Query Description */}
                          <div className="space-y-1.5">
                            <Label
                              htmlFor={`query-description-${query.id}`}
                              className="text-xs"
                            >
                              Description
                            </Label>
                            <Textarea
                              id={`query-description-${query.id}`}
                              value={metadata.description}
                              onChange={(e) =>
                                updateQueryMetadata(
                                  query.id,
                                  'description',
                                  e.target.value
                                )
                              }
                              placeholder="Brief description"
                              maxLength={1000}
                              rows={2}
                              disabled={isExporting}
                              className="text-xs"
                            />
                          </div>

                          {/* Query Notes */}
                          <div className="space-y-1.5">
                            <Label
                              htmlFor={`query-notes-${query.id}`}
                              className="text-xs"
                            >
                              Notes
                            </Label>
                            <Textarea
                              id={`query-notes-${query.id}`}
                              value={metadata.notes}
                              onChange={(e) =>
                                updateQueryMetadata(
                                  query.id,
                                  'notes',
                                  e.target.value
                                )
                              }
                              placeholder="Optional notes for this query"
                              maxLength={1000}
                              rows={2}
                              disabled={isExporting}
                              className="text-xs"
                            />
                          </div>

                          {/* Query Tags */}
                          <div className="space-y-1.5">
                            <Label
                              htmlFor={`query-tags-${query.id}`}
                              className="text-xs"
                            >
                              Tags
                            </Label>
                            <Input
                              id={`query-tags-${query.id}`}
                              value={metadata.tags}
                              onChange={(e) =>
                                updateQueryMetadata(
                                  query.id,
                                  'tags',
                                  e.target.value
                                )
                              }
                              placeholder="comma, separated, tags"
                              disabled={isExporting}
                              className="h-8 text-xs"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>

              {/* Export Options */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Export Options</Label>
                <div className="space-y-3 rounded-md border p-3">
                  <label className="flex cursor-pointer items-center gap-2">
                    <Checkbox
                      checked={compress}
                      onCheckedChange={(checked) =>
                        setCompress(checked === true)
                      }
                      disabled={isExporting}
                    />
                    <div className="flex-1">
                      <p className="text-sm">Compress export file</p>
                      <p className="text-muted-foreground text-xs">
                        Automatically enabled for bundles larger than 100KB
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isExporting}
          >
            {exportResult ? 'Close' : 'Cancel'}
          </Button>
          {!exportResult && (
            <Button onClick={handleExport} disabled={!isValid || isExporting}>
              {isExporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <FileDown className="mr-2 h-4 w-4" />
                  Export Bundle
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

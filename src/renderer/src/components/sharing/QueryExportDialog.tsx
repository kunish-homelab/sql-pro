import type { ExportQueryRequest } from '@shared/types';
import { FileDown, Loader2, Share2 } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { sqlPro } from '@/lib/api';

export interface QueryExportDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** SQL query text to export */
  sql: string;
  /** Initial query name */
  initialName?: string;
  /** Initial description */
  initialDescription?: string;
  /** Initial database context */
  initialDatabaseContext?: string;
  /** Initial tags */
  initialTags?: string[];
  /** Initial documentation */
  initialDocumentation?: string;
  /** Callback when export completes successfully */
  onExportComplete?: (filePath: string) => void;
}

export function QueryExportDialog({
  open,
  onOpenChange,
  sql,
  initialName = '',
  initialDescription = '',
  initialDatabaseContext = '',
  initialTags = [],
  initialDocumentation = '',
  onExportComplete,
}: QueryExportDialogProps) {
  // Form state
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [databaseContext, setDatabaseContext] = useState(
    initialDatabaseContext
  );
  const [tagsInput, setTagsInput] = useState(initialTags.join(', '));
  const [documentation, setDocumentation] = useState(initialDocumentation);
  const [compress, setCompress] = useState(false);

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{
    success: boolean;
    filePath?: string;
    error?: string;
  } | null>(null);

  // Parse tags from comma-separated input
  const parsedTags = tagsInput
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);

  // Validation
  const isValid = name.trim().length > 0 && sql.trim().length > 0;

  // Handle export
  const handleExport = useCallback(async () => {
    if (!isValid) return;

    setIsExporting(true);
    setExportResult(null);

    try {
      const request: ExportQueryRequest = {
        query: {
          name: name.trim(),
          description: description.trim() || undefined,
          sql: sql.trim(),
          databaseContext: databaseContext.trim() || undefined,
          tags: parsedTags.length > 0 ? parsedTags : undefined,
          documentation: documentation.trim() || undefined,
        },
        compress,
      };

      const result = await sqlPro.sharing.exportQuery(request);

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
    name,
    description,
    sql,
    databaseContext,
    parsedTags,
    documentation,
    compress,
    isValid,
    onExportComplete,
  ]);

  // Reset dialog state on close
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        // Reset state when closing
        setName(initialName);
        setDescription(initialDescription);
        setDatabaseContext(initialDatabaseContext);
        setTagsInput(initialTags.join(', '));
        setDocumentation(initialDocumentation);
        setCompress(false);
        setExportResult(null);
      }
      onOpenChange(newOpen);
    },
    [
      onOpenChange,
      initialName,
      initialDescription,
      initialDatabaseContext,
      initialTags,
      initialDocumentation,
    ]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Export Query
          </DialogTitle>
          <DialogDescription>
            Export this query with metadata and documentation for sharing with
            your team
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
                    Query exported successfully
                  </p>
                  {exportResult.filePath && (
                    <p className="break-all text-xs text-green-600 dark:text-green-400">
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
              {/* Query Name (Required) */}
              <div className="space-y-2">
                <Label htmlFor="query-name" className="text-sm font-medium">
                  Query Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="query-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., User Activity Report"
                  maxLength={200}
                  disabled={isExporting}
                />
                <p className="text-muted-foreground text-xs">
                  A descriptive name for this query
                </p>
              </div>

              {/* Description (Optional) */}
              <div className="space-y-2">
                <Label
                  htmlFor="query-description"
                  className="text-sm font-medium"
                >
                  Description
                </Label>
                <Textarea
                  id="query-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of what this query does"
                  maxLength={1000}
                  rows={2}
                  disabled={isExporting}
                />
                <p className="text-muted-foreground text-xs">
                  Optional description to help others understand the query
                  purpose
                </p>
              </div>

              {/* SQL Preview (Read-only) */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">SQL Query</Label>
                <Textarea
                  value={sql}
                  readOnly
                  className="bg-muted font-mono text-sm"
                  rows={4}
                />
                <p className="text-muted-foreground text-xs">
                  {sql.length} characters
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
                  Optional context about which database this query is for
                </p>
              </div>

              {/* Tags (Optional) */}
              <div className="space-y-2">
                <Label htmlFor="query-tags" className="text-sm font-medium">
                  Tags
                </Label>
                <Input
                  id="query-tags"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="e.g., reporting, analytics, users"
                  disabled={isExporting}
                />
                <p className="text-muted-foreground text-xs">
                  Comma-separated tags for categorization
                  {parsedTags.length > 0 &&
                    ` (${parsedTags.length} tag${parsedTags.length !== 1 ? 's' : ''})`}
                </p>
              </div>

              {/* Documentation (Optional) */}
              <div className="space-y-2">
                <Label
                  htmlFor="query-documentation"
                  className="text-sm font-medium"
                >
                  Documentation
                </Label>
                <Textarea
                  id="query-documentation"
                  value={documentation}
                  onChange={(e) => setDocumentation(e.target.value)}
                  placeholder="Additional notes, usage examples, or important considerations..."
                  maxLength={10000}
                  rows={4}
                  disabled={isExporting}
                />
                <p className="text-muted-foreground text-xs">
                  Optional detailed documentation or usage notes (
                  {documentation.length}/10000)
                </p>
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
                        Automatically enabled for queries larger than 100KB
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
                  Export
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

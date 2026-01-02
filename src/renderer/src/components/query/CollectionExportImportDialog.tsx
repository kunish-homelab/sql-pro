import type { QueryCollection } from '@shared/types';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  FileJson,
  FolderOpen,
  Loader2,
  Upload,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
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
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCollectionsStore } from '@/stores/collections-store';
import { useSavedQueriesStore } from '@/stores/saved-queries-store';

interface CollectionExportImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ImportPreview {
  collections: Array<{
    name: string;
    description?: string;
    queryCount: number;
  }>;
  totalQueries: number;
}

type DuplicateStrategy = 'skip' | 'rename' | 'overwrite';

export function CollectionExportImportDialog({
  open,
  onOpenChange,
}: CollectionExportImportDialogProps) {
  // Store state
  const { collections, loadCollections } = useCollectionsStore();
  const { savedQueries } = useSavedQueriesStore();

  // Tab state
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');

  // Export state
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<{
    collections: number;
    queries: number;
  } | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Import state
  const [importFilePath, setImportFilePath] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [duplicateStrategy, setDuplicateStrategy] = useState<DuplicateStrategy>('rename');
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState<{
    collections: number;
    queries: number;
    skipped: number;
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Load collections on mount
  useEffect(() => {
    if (open) {
      loadCollections();
    }
  }, [open, loadCollections]);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setSelectedCollectionIds(new Set());
      setExportSuccess(null);
      setExportError(null);
      setImportFilePath(null);
      setImportPreview(null);
      setImportSuccess(null);
      setImportError(null);
      setDuplicateStrategy('rename');
      setActiveTab('export');
    }
  }, [open]);

  // Get query count for a collection
  const getQueryCountForCollection = useCallback(
    (collectionId: string): number => {
      return savedQueries.filter((q) => q.collectionIds.includes(collectionId)).length;
    },
    [savedQueries]
  );

  // Handle collection selection toggle
  const handleCollectionToggle = useCallback((collectionId: string) => {
    setSelectedCollectionIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(collectionId)) {
        newSet.delete(collectionId);
      } else {
        newSet.add(collectionId);
      }
      return newSet;
    });
  }, []);

  // Handle select all / deselect all
  const handleSelectAll = useCallback(() => {
    if (selectedCollectionIds.size === collections.length) {
      setSelectedCollectionIds(new Set());
    } else {
      setSelectedCollectionIds(new Set(collections.map((c) => c.id)));
    }
  }, [collections, selectedCollectionIds]);

  // Handle export
  const handleExport = useCallback(async () => {
    if (selectedCollectionIds.size === 0) {
      return;
    }

    setIsExporting(true);
    setExportSuccess(null);
    setExportError(null);

    try {
      // Show save file dialog
      const saveDialogResult = await window.sqlPro.dialog.saveFile({
        title: 'Export Collections',
        filters: [{ name: 'JSON Files', extensions: ['json'] }],
        defaultPath: `collections-export-${new Date().toISOString().split('T')[0]}.json`,
      });

      if (saveDialogResult.canceled || !saveDialogResult.filePath) {
        setIsExporting(false);
        return;
      }

      // Export collections
      const result = await window.sqlPro.collections.export({
        collectionIds: Array.from(selectedCollectionIds),
        filePath: saveDialogResult.filePath,
      });

      if (result.success) {
        setExportSuccess({
          collections: result.collectionsExported || 0,
          queries: result.queriesExported || 0,
        });
        setSelectedCollectionIds(new Set());
      } else {
        setExportError(result.error || 'Failed to export collections');
      }
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Failed to export collections');
    } finally {
      setIsExporting(false);
    }
  }, [selectedCollectionIds]);

  // Handle file selection for import
  const handleSelectImportFile = useCallback(async () => {
    try {
      const openDialogResult = await window.sqlPro.dialog.openFile({
        title: 'Import Collections',
        filters: [{ name: 'JSON Files', extensions: ['json'] }],
      });

      if (openDialogResult.canceled || !openDialogResult.filePath) {
        return;
      }

      setImportFilePath(openDialogResult.filePath);
      setImportSuccess(null);
      setImportError(null);

      // Read and parse the file to show preview
      try {
        // Note: In a real implementation, we would need to add an IPC method to read the file
        // For now, we'll show a basic preview message
        // TODO: Add preview functionality by reading the JSON file in main process
        setImportPreview({
          collections: [],
          totalQueries: 0,
        });
      } catch (error) {
        setImportError('Failed to read import file');
        setImportFilePath(null);
        setImportPreview(null);
      }
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Failed to select file');
    }
  }, []);

  // Handle import
  const handleImport = useCallback(async () => {
    if (!importFilePath) {
      return;
    }

    setIsImporting(true);
    setImportSuccess(null);
    setImportError(null);

    try {
      const result = await window.sqlPro.collections.import({
        filePath: importFilePath,
        duplicateStrategy,
      });

      if (result.success) {
        setImportSuccess({
          collections: result.collectionsImported || 0,
          queries: result.queriesImported || 0,
          skipped: result.skipped || 0,
        });
        setImportFilePath(null);
        setImportPreview(null);

        // Reload collections to show imported data
        await loadCollections();
      } else {
        setImportError(result.error || 'Failed to import collections');
      }
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Failed to import collections');
    } finally {
      setIsImporting(false);
    }
  }, [importFilePath, duplicateStrategy, loadCollections]);

  const isExportDisabled = isExporting || selectedCollectionIds.size === 0;
  const isImportDisabled = isImporting || !importFilePath;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileJson className="h-5 w-5" />
            Export / Import Collections
          </DialogTitle>
          <DialogDescription>
            Export collections to share with others or import collections from a file.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'export' | 'import')}>
          <TabsList>
            <TabsTrigger value="export">
              <ArrowUpFromLine className="mr-2 h-4 w-4" />
              Export
            </TabsTrigger>
            <TabsTrigger value="import">
              <ArrowDownToLine className="mr-2 h-4 w-4" />
              Import
            </TabsTrigger>
          </TabsList>

          {/* Export Tab */}
          <TabsContent value="export" className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  Select Collections to Export
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                  className="h-auto px-2 py-1 text-xs"
                >
                  {selectedCollectionIds.size === collections.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>

              <ScrollArea className="h-64 rounded-md border p-4">
                {collections.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-center">
                    <div>
                      <FolderOpen className="mx-auto h-12 w-12 text-muted-foreground/50" />
                      <p className="text-muted-foreground mt-2 text-sm">
                        No collections to export
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {collections.map((collection) => {
                      const queryCount = getQueryCountForCollection(collection.id);
                      const isSelected = selectedCollectionIds.has(collection.id);

                      return (
                        <div
                          key={collection.id}
                          className="flex items-start gap-3 rounded-md p-2 hover:bg-accent"
                        >
                          <Checkbox
                            id={`export-${collection.id}`}
                            checked={isSelected}
                            onCheckedChange={() => handleCollectionToggle(collection.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <Label
                              htmlFor={`export-${collection.id}`}
                              className="flex cursor-pointer items-center gap-2 font-medium"
                            >
                              <div
                                className="h-3 w-3 rounded-full"
                                style={{ backgroundColor: collection.color || '#3b82f6' }}
                              />
                              {collection.name}
                            </Label>
                            {collection.description && (
                              <p className="text-muted-foreground mt-1 text-xs">
                                {collection.description}
                              </p>
                            )}
                            <p className="text-muted-foreground mt-1 text-xs">
                              {queryCount} {queryCount === 1 ? 'query' : 'queries'}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Export success/error messages */}
            {exportSuccess && (
              <div className="flex items-start gap-2 rounded-md bg-green-50 dark:bg-green-950/30 p-3 text-sm">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-green-900 dark:text-green-100">
                    Export successful!
                  </p>
                  <p className="text-green-700 dark:text-green-300 text-xs mt-1">
                    Exported {exportSuccess.collections} {exportSuccess.collections === 1 ? 'collection' : 'collections'} with {exportSuccess.queries} {exportSuccess.queries === 1 ? 'query' : 'queries'}.
                  </p>
                </div>
              </div>
            )}

            {exportError && (
              <div className="flex items-start gap-2 rounded-md bg-red-50 dark:bg-red-950/30 p-3 text-sm">
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-900 dark:text-red-100">
                    Export failed
                  </p>
                  <p className="text-red-700 dark:text-red-300 text-xs mt-1">
                    {exportError}
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-4">
              <div className="text-muted-foreground text-sm">
                {selectedCollectionIds.size > 0 && (
                  <>
                    {selectedCollectionIds.size} {selectedCollectionIds.size === 1 ? 'collection' : 'collections'} selected
                  </>
                )}
              </div>
              <Button onClick={handleExport} disabled={isExportDisabled}>
                {isExporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <ArrowUpFromLine className="mr-2 h-4 w-4" />
                    Export to File
                  </>
                )}
              </Button>
            </div>
          </TabsContent>

          {/* Import Tab */}
          <TabsContent value="import" className="space-y-4">
            <div className="space-y-4">
              {/* File selection */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Import File</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSelectImportFile}
                    className="flex-1"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {importFilePath ? 'Change File' : 'Select File'}
                  </Button>
                </div>
                {importFilePath && (
                  <p className="text-muted-foreground text-xs">
                    Selected: {importFilePath.split('/').pop() || importFilePath.split('\\').pop()}
                  </p>
                )}
              </div>

              {/* Duplicate strategy */}
              <div className="space-y-2">
                <Label htmlFor="duplicate-strategy" className="text-sm font-medium">
                  If collection already exists
                </Label>
                <Select
                  value={duplicateStrategy}
                  onValueChange={(value) => setDuplicateStrategy(value as DuplicateStrategy)}
                >
                  <SelectTrigger id="duplicate-strategy">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="skip">
                      <div>
                        <div className="font-medium">Skip</div>
                        <div className="text-muted-foreground text-xs">
                          Don't import duplicate collections
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="rename">
                      <div>
                        <div className="font-medium">Rename</div>
                        <div className="text-muted-foreground text-xs">
                          Import with a new name (e.g., "Collection (1)")
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="overwrite">
                      <div>
                        <div className="font-medium">Overwrite</div>
                        <div className="text-muted-foreground text-xs">
                          Replace existing collections
                        </div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Import preview (placeholder for now) */}
              {importFilePath && importPreview && (
                <div className="rounded-md border p-3">
                  <Label className="text-sm font-medium">Preview</Label>
                  <p className="text-muted-foreground mt-2 text-sm">
                    Ready to import collections from the selected file.
                  </p>
                </div>
              )}
            </div>

            {/* Import success/error messages */}
            {importSuccess && (
              <div className="flex items-start gap-2 rounded-md bg-green-50 dark:bg-green-950/30 p-3 text-sm">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-green-900 dark:text-green-100">
                    Import successful!
                  </p>
                  <p className="text-green-700 dark:text-green-300 text-xs mt-1">
                    Imported {importSuccess.collections} {importSuccess.collections === 1 ? 'collection' : 'collections'} with {importSuccess.queries} {importSuccess.queries === 1 ? 'query' : 'queries'}.
                    {importSuccess.skipped > 0 && ` ${importSuccess.skipped} ${importSuccess.skipped === 1 ? 'item was' : 'items were'} skipped.`}
                  </p>
                </div>
              </div>
            )}

            {importError && (
              <div className="flex items-start gap-2 rounded-md bg-red-50 dark:bg-red-950/30 p-3 text-sm">
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-900 dark:text-red-100">
                    Import failed
                  </p>
                  <p className="text-red-700 dark:text-red-300 text-xs mt-1">
                    {importError}
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-4">
              <Button onClick={handleImport} disabled={isImportDisabled}>
                {isImporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <ArrowDownToLine className="mr-2 h-4 w-4" />
                    Import Collections
                  </>
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

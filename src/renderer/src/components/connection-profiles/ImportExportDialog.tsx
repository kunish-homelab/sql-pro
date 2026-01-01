import type { ConnectionProfile, ProfileFolder } from '@shared/types.ts';
import { Download, Upload } from 'lucide-react';
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
import { sqlPro } from '@/lib/api';

export interface ImportExportDialogProps {
  /** Dialog mode: 'export' or 'import' */
  mode: 'export' | 'import';
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** Available profiles for export */
  profiles?: ConnectionProfile[];
  /** Available folders for export */
  folders?: ProfileFolder[];
  /** Callback when import completes successfully */
  onImportComplete?: () => void;
}

export function ImportExportDialog({
  mode,
  open,
  onOpenChange,
  profiles = [],
  folders = [],
  onImportComplete,
}: ImportExportDialogProps) {
  // Export state
  const [selectedProfileIds, setSelectedProfileIds] = useState<Set<string>>(
    () => new Set()
  );
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(
    () => new Set()
  );
  const [exportResult, setExportResult] = useState<{
    success: boolean;
    filePath?: string;
    exportedCount?: number;
    error?: string;
  } | null>(null);

  // Import state
  const [importMerge, setImportMerge] = useState(true);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    importedCount?: number;
    skippedCount?: number;
    errors?: string[];
    error?: string;
  } | null>(null);

  // Loading state
  const [isProcessing, setIsProcessing] = useState(false);

  // Handle export
  const handleExport = useCallback(async () => {
    setIsProcessing(true);
    setExportResult(null);

    try {
      const result = await sqlPro.profile.export({
        profileIds:
          selectedProfileIds.size > 0
            ? Array.from(selectedProfileIds)
            : undefined,
        folderIds:
          selectedFolderIds.size > 0
            ? Array.from(selectedFolderIds)
            : undefined,
      });

      setExportResult(result);
    } catch (err) {
      setExportResult({
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsProcessing(false);
    }
  }, [selectedProfileIds, selectedFolderIds]);

  // Handle import
  const handleImport = useCallback(async () => {
    setIsProcessing(true);
    setImportResult(null);

    try {
      // The IPC handler will show the file dialog
      const result = await sqlPro.profile.import({
        filePath: '', // File path is selected via dialog in IPC handler
        merge: importMerge,
      });

      setImportResult(result);

      if (result.success && onImportComplete) {
        onImportComplete();
      }
    } catch (err) {
      setImportResult({
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsProcessing(false);
    }
  }, [importMerge, onImportComplete]);

  // Toggle profile selection
  const toggleProfile = useCallback((profileId: string) => {
    setSelectedProfileIds((prev) => {
      const next = new Set(prev);
      if (next.has(profileId)) {
        next.delete(profileId);
      } else {
        next.add(profileId);
      }
      return next;
    });
  }, []);

  // Toggle folder selection
  const toggleFolder = useCallback((folderId: string) => {
    setSelectedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }, []);

  // Select all profiles
  const selectAllProfiles = useCallback(() => {
    setSelectedProfileIds(new Set(profiles.map((p) => p.id)));
  }, [profiles]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedProfileIds(new Set());
    setSelectedFolderIds(new Set());
  }, []);

  // Reset dialog state on close
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        // Reset state when closing
        setSelectedProfileIds(new Set());
        setSelectedFolderIds(new Set());
        setExportResult(null);
        setImportResult(null);
        setImportMerge(true);
      }
      onOpenChange(newOpen);
    },
    [onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === 'export' ? (
              <>
                <Download className="mr-2 inline-block size-5" />
                Export Profiles
              </>
            ) : (
              <>
                <Upload className="mr-2 inline-block size-5" />
                Import Profiles
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {mode === 'export'
              ? 'Select profiles and folders to export. Passwords will not be included for security reasons.'
              : 'Import profiles from a previously exported file. You can choose to merge with existing profiles or skip duplicates.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {mode === 'export' ? (
            <>
              {/* Export mode UI */}
              {exportResult ? (
                <div className="space-y-3">
                  {exportResult.success ? (
                    <div className="space-y-2 rounded-lg bg-green-50 p-4 dark:bg-green-950">
                      <p className="font-medium text-green-900 dark:text-green-100">
                        Export Successful
                      </p>
                      <p className="text-sm text-green-700 dark:text-green-300">
                        Exported {exportResult.exportedCount} profile
                        {exportResult.exportedCount !== 1 ? 's' : ''}
                      </p>
                      {exportResult.filePath && (
                        <p className="text-xs break-all text-green-600 dark:text-green-400">
                          {exportResult.filePath}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="bg-destructive/10 rounded-lg p-4">
                      <p className="text-destructive font-medium">
                        Export Failed
                      </p>
                      <p className="text-destructive/80 mt-1 text-sm">
                        {exportResult.error || 'Unknown error occurred'}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {/* Selection controls */}
                    <div className="flex items-center justify-between border-b pb-2">
                      <span className="text-sm font-medium">
                        {selectedProfileIds.size + selectedFolderIds.size}{' '}
                        selected
                      </span>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={selectAllProfiles}
                        >
                          Select All
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={clearSelection}
                        >
                          Clear
                        </Button>
                      </div>
                    </div>

                    {/* Profiles list */}
                    <div className="max-h-96 space-y-2 overflow-y-auto">
                      {folders.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-muted-foreground text-xs font-semibold uppercase">
                            Folders
                          </h4>
                          {folders.map((folder) => (
                            <label
                              key={folder.id}
                              className="hover:bg-accent flex cursor-pointer items-center gap-3 rounded-sm px-2 py-1.5"
                            >
                              <Checkbox
                                checked={selectedFolderIds.has(folder.id)}
                                onCheckedChange={() => toggleFolder(folder.id)}
                              />
                              <span className="flex-1 text-sm">
                                {folder.name}
                              </span>
                            </label>
                          ))}
                        </div>
                      )}

                      {profiles.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-muted-foreground text-xs font-semibold uppercase">
                            Profiles
                          </h4>
                          {profiles.map((profile) => (
                            <label
                              key={profile.id}
                              className="hover:bg-accent flex cursor-pointer items-center gap-3 rounded-sm px-2 py-1.5"
                            >
                              <Checkbox
                                checked={selectedProfileIds.has(profile.id)}
                                onCheckedChange={() =>
                                  toggleProfile(profile.id)
                                }
                              />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm">
                                  {profile.displayName || profile.filename}
                                </p>
                                <p className="text-muted-foreground truncate text-xs">
                                  {profile.path}
                                </p>
                              </div>
                            </label>
                          ))}
                        </div>
                      )}

                      {profiles.length === 0 && folders.length === 0 && (
                        <p className="text-muted-foreground py-8 text-center text-sm">
                          No profiles or folders available to export
                        </p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              {/* Import mode UI */}
              <div className="space-y-3">
                {/* Import options */}
                <label className="flex cursor-pointer items-center gap-3">
                  <Checkbox
                    checked={importMerge}
                    onCheckedChange={(checked) =>
                      setImportMerge(checked === true)
                    }
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      Merge with existing profiles
                    </p>
                    <p className="text-muted-foreground text-xs">
                      If unchecked, duplicate profiles will be skipped
                    </p>
                  </div>
                </label>

                {/* Import result */}
                {importResult && (
                  <div className="mt-4 space-y-3">
                    {importResult.success ? (
                      <div className="space-y-2 rounded-lg bg-green-50 p-4 dark:bg-green-950">
                        <p className="font-medium text-green-900 dark:text-green-100">
                          Import Successful
                        </p>
                        <div className="space-y-1 text-sm text-green-700 dark:text-green-300">
                          <p>
                            Imported: {importResult.importedCount || 0}{' '}
                            profile(s)
                          </p>
                          {importResult.skippedCount !== undefined &&
                            importResult.skippedCount > 0 && (
                              <p>
                                Skipped: {importResult.skippedCount}{' '}
                                duplicate(s)
                              </p>
                            )}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-destructive/10 space-y-2 rounded-lg p-4">
                        <p className="text-destructive font-medium">
                          Import Failed
                        </p>
                        <p className="text-destructive/80 text-sm">
                          {importResult.error || 'Unknown error occurred'}
                        </p>
                        {importResult.errors &&
                          importResult.errors.length > 0 && (
                            <div className="mt-2 space-y-1">
                              <p className="text-destructive text-xs font-medium">
                                Validation Errors:
                              </p>
                              <ul className="text-destructive/80 list-inside list-disc space-y-0.5 text-xs">
                                {importResult.errors.map((error) => (
                                  <li key={error}>{error}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {exportResult || importResult ? 'Close' : 'Cancel'}
          </Button>
          {!exportResult && !importResult && (
            <Button
              onClick={mode === 'export' ? handleExport : handleImport}
              disabled={
                isProcessing ||
                (mode === 'export' &&
                  selectedProfileIds.size === 0 &&
                  selectedFolderIds.size === 0 &&
                  profiles.length > 0)
              }
            >
              {isProcessing ? (
                <>Processing...</>
              ) : mode === 'export' ? (
                <>
                  <Download className="mr-2 size-4" />
                  Export
                </>
              ) : (
                <>
                  <Upload className="mr-2 size-4" />
                  Import
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

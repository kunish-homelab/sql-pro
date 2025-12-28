import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  FileJson,
  FileSpreadsheet,
  FileText,
  Loader2,
  Upload,
  X,
} from 'lucide-react';
import { memo, useCallback, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

export type ExportFormat = 'csv' | 'json' | 'sql';

interface BulkOperationsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableName?: string;
  columns?: string[];
  onExport?: (format: ExportFormat, options: ExportOptions) => Promise<void>;
  onImport?: (file: File, options: ImportOptions) => Promise<ImportResult>;
}

interface ExportOptions {
  includeHeaders: boolean;
  delimiter: string;
  nullValue: string;
  dateFormat: string;
}

interface ImportOptions {
  hasHeaders: boolean;
  delimiter: string;
  skipRows: number;
  batchSize: number;
}

interface ImportResult {
  success: boolean;
  rowsImported: number;
  rowsFailed: number;
  errors: string[];
}

const FORMAT_INFO = {
  csv: {
    icon: FileSpreadsheet,
    label: 'CSV',
    description: 'Comma-separated values',
    extension: '.csv',
  },
  json: {
    icon: FileJson,
    label: 'JSON',
    description: 'JavaScript Object Notation',
    extension: '.json',
  },
  sql: {
    icon: FileText,
    label: 'SQL',
    description: 'SQL INSERT statements',
    extension: '.sql',
  },
};

export const BulkOperationsPanel = memo(
  ({
    open,
    onOpenChange,
    tableName,
    columns = [],
    onExport,
    onImport,
  }: BulkOperationsPanelProps) => {
    const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');

    // Export state
    const [exportFormat, setExportFormat] = useState<ExportFormat>('csv');
    const [exportOptions, setExportOptions] = useState<ExportOptions>({
      includeHeaders: true,
      delimiter: ',',
      nullValue: 'NULL',
      dateFormat: 'ISO',
    });
    const [isExporting, setIsExporting] = useState(false);

    // Import state
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importOptions, setImportOptions] = useState<ImportOptions>({
      hasHeaders: true,
      delimiter: ',',
      skipRows: 0,
      batchSize: 1000,
    });
    const [isImporting, setIsImporting] = useState(false);
    const [importProgress, setImportProgress] = useState(0);
    const [importResult, setImportResult] = useState<ImportResult | null>(null);

    const handleExport = useCallback(async () => {
      if (!onExport) return;
      setIsExporting(true);
      try {
        await onExport(exportFormat, exportOptions);
      } finally {
        setIsExporting(false);
      }
    }, [exportFormat, exportOptions, onExport]);

    const handleImport = useCallback(async () => {
      if (!onImport || !importFile) return;
      setIsImporting(true);
      setImportProgress(0);
      setImportResult(null);

      try {
        // Simulate progress updates
        const progressInterval = setInterval(() => {
          setImportProgress((prev) => Math.min(prev + 10, 90));
        }, 200);

        const result = await onImport(importFile, importOptions);
        clearInterval(progressInterval);
        setImportProgress(100);
        setImportResult(result);
      } catch {
        setImportResult({
          success: false,
          rowsImported: 0,
          rowsFailed: 0,
          errors: ['Import failed. Please check your file format.'],
        });
      } finally {
        setIsImporting(false);
      }
    }, [importFile, importOptions, onImport]);

    const handleFileSelect = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
          setImportFile(file);
          setImportResult(null);
        }
      },
      []
    );

    const handleDrop = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) {
        setImportFile(file);
        setImportResult(null);
      }
    }, []);

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {activeTab === 'export' ? (
                <ArrowDownToLine className="h-5 w-5" />
              ) : (
                <ArrowUpFromLine className="h-5 w-5" />
              )}
              Bulk Operations
              {tableName && (
                <Badge variant="secondary" className="ml-2">
                  {tableName}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              Export or import data in various formats.
            </DialogDescription>
          </DialogHeader>

          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as 'export' | 'import')}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="export" className="gap-2">
                <ArrowDownToLine className="h-4 w-4" />
                Export
              </TabsTrigger>
              <TabsTrigger value="import" className="gap-2">
                <ArrowUpFromLine className="h-4 w-4" />
                Import
              </TabsTrigger>
            </TabsList>

            <TabsContent value="export" className="space-y-4 pt-4">
              {/* Format Selection */}
              <div className="grid gap-2">
                <Label>Export Format</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(FORMAT_INFO) as ExportFormat[]).map(
                    (format) => {
                      const info = FORMAT_INFO[format];
                      const Icon = info.icon;
                      return (
                        <button
                          key={format}
                          onClick={() => setExportFormat(format)}
                          className={cn(
                            'flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors',
                            exportFormat === format
                              ? 'border-primary bg-primary/5'
                              : 'hover:border-primary/50'
                          )}
                        >
                          <Icon className="h-8 w-8" />
                          <span className="font-medium">{info.label}</span>
                          <span className="text-muted-foreground text-xs">
                            {info.extension}
                          </span>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              {/* CSV-specific options */}
              {exportFormat === 'csv' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="delimiter">Delimiter</Label>
                    <Select
                      value={exportOptions.delimiter}
                      onValueChange={(v) =>
                        setExportOptions({ ...exportOptions, delimiter: v })
                      }
                    >
                      <SelectTrigger id="delimiter">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value=",">Comma (,)</SelectItem>
                        <SelectItem value=";">Semicolon (;)</SelectItem>
                        <SelectItem value="\t">Tab</SelectItem>
                        <SelectItem value="|">Pipe (|)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="nullValue">NULL Representation</Label>
                    <Input
                      id="nullValue"
                      value={exportOptions.nullValue}
                      onChange={(e) =>
                        setExportOptions({
                          ...exportOptions,
                          nullValue: e.target.value,
                        })
                      }
                      placeholder="NULL"
                    />
                  </div>
                </div>
              )}

              {/* Columns Preview */}
              {columns.length > 0 && (
                <div className="grid gap-2">
                  <Label>Columns to Export ({columns.length})</Label>
                  <div className="bg-muted/50 flex flex-wrap gap-1 rounded-lg p-2">
                    {columns.map((col) => (
                      <Badge key={col} variant="secondary" className="text-xs">
                        {col}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="import" className="space-y-4 pt-4">
              {/* File Drop Zone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className={cn(
                  'flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors',
                  importFile
                    ? 'border-primary bg-primary/5'
                    : 'hover:border-primary/50'
                )}
              >
                {importFile ? (
                  <>
                    <div className="bg-primary/10 rounded-full p-3">
                      <FileSpreadsheet className="text-primary h-8 w-8" />
                    </div>
                    <div className="text-center">
                      <p className="font-medium">{importFile.name}</p>
                      <p className="text-muted-foreground text-sm">
                        {(importFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setImportFile(null)}
                    >
                      <X className="mr-1 h-4 w-4" />
                      Remove
                    </Button>
                  </>
                ) : (
                  <>
                    <Upload className="text-muted-foreground h-10 w-10" />
                    <div className="text-center">
                      <p className="font-medium">Drop a file here</p>
                      <p className="text-muted-foreground text-sm">
                        or click to browse
                      </p>
                    </div>
                    <Input
                      type="file"
                      accept=".csv,.json,.sql"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="file-upload"
                    />
                    <Label htmlFor="file-upload" className="cursor-pointer">
                      <Button variant="outline" asChild>
                        <span>Browse Files</span>
                      </Button>
                    </Label>
                  </>
                )}
              </div>

              {/* Import Options */}
              {importFile && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="hasHeaders">First Row as Headers</Label>
                    <Select
                      value={importOptions.hasHeaders ? 'yes' : 'no'}
                      onValueChange={(v) =>
                        setImportOptions({
                          ...importOptions,
                          hasHeaders: v === 'yes',
                        })
                      }
                    >
                      <SelectTrigger id="hasHeaders">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="batchSize">Batch Size</Label>
                    <Input
                      id="batchSize"
                      type="number"
                      value={importOptions.batchSize}
                      onChange={(e) =>
                        setImportOptions({
                          ...importOptions,
                          batchSize: Number.parseInt(e.target.value) || 1000,
                        })
                      }
                    />
                  </div>
                </div>
              )}

              {/* Import Progress */}
              {isImporting && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Importing...</span>
                    <span>{importProgress}%</span>
                  </div>
                  <Progress value={importProgress} />
                </div>
              )}

              {/* Import Result */}
              {importResult && (
                <div
                  className={cn(
                    'flex items-start gap-3 rounded-lg border p-4',
                    importResult.success
                      ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950'
                      : 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950'
                  )}
                >
                  {importResult.success ? (
                    <Check className="h-5 w-5 shrink-0 text-green-600" />
                  ) : (
                    <X className="h-5 w-5 shrink-0 text-red-600" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium">
                      {importResult.success
                        ? 'Import Complete'
                        : 'Import Failed'}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {importResult.rowsImported} rows imported
                      {importResult.rowsFailed > 0 &&
                        `, ${importResult.rowsFailed} failed`}
                    </p>
                    {importResult.errors.length > 0 && (
                      <ul className="mt-2 text-sm text-red-600">
                        {importResult.errors.slice(0, 3).map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {activeTab === 'export' ? (
              <Button onClick={handleExport} disabled={isExporting}>
                {isExporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowDownToLine className="mr-2 h-4 w-4" />
                )}
                Export
              </Button>
            ) : (
              <Button
                onClick={handleImport}
                disabled={isImporting || !importFile}
              >
                {isImporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUpFromLine className="mr-2 h-4 w-4" />
                )}
                Import
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
);

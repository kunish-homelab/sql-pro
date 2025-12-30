import type { ColumnInfo, ExportFormat } from '../../../shared/types';
import {
  FileCode,
  FileDown,
  FileJson,
  FileSpreadsheet,
  FileText,
  Loader2,
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

const DELIMITER_OPTIONS = [
  { value: ',', label: 'Comma (,)' },
  { value: '\t', label: 'Tab' },
  { value: ';', label: 'Semicolon (;)' },
  { value: '|', label: 'Pipe (|)' },
] as const;

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableName: string;
  columns: ColumnInfo[];
  rows: Record<string, unknown>[];
  connectionId: string;
  onExport: (options: ExportOptions) => void;
}

export interface ExportOptions {
  format: ExportFormat;
  columns: string[];
  tableName: string;
  rows: Record<string, unknown>[];
  connectionId: string;
  // Format-specific options
  delimiter?: string;
  includeHeaders?: boolean;
  prettyPrint?: boolean;
  sheetName?: string;
}

const FORMAT_OPTIONS: {
  value: ExportFormat;
  label: string;
  description: string;
  icon: typeof FileText;
}[] = [
  {
    value: 'csv',
    label: 'CSV',
    description: 'Comma-separated values',
    icon: FileText,
  },
  {
    value: 'json',
    label: 'JSON',
    description: 'JavaScript Object Notation',
    icon: FileJson,
  },
  {
    value: 'sql',
    label: 'SQL',
    description: 'INSERT statements',
    icon: FileCode,
  },
  {
    value: 'xlsx',
    label: 'Excel',
    description: 'Microsoft Excel workbook',
    icon: FileSpreadsheet,
  },
];

export function ExportDialog({
  open,
  onOpenChange,
  tableName,
  columns,
  rows,
  connectionId,
  onExport,
}: ExportDialogProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('csv');
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(
    () => new Set(columns.map((col) => col.name))
  );

  // Format-specific options
  const [delimiter, setDelimiter] = useState<string>(',');
  const [includeHeaders, setIncludeHeaders] = useState<boolean>(true);
  const [prettyPrint, setPrettyPrint] = useState<boolean>(false);
  const [sheetName, setSheetName] = useState<string>(tableName);

  // Export progress state
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);

  // Reset selected columns when columns prop changes (e.g., different table)
  useEffect(() => {
    setSelectedColumns(new Set(columns.map((col) => col.name)));
  }, [columns]);

  // Reset sheet name when table name changes
  useEffect(() => {
    setSheetName(tableName);
  }, [tableName]);

  // Reset export progress when dialog closes
  useEffect(() => {
    if (!open) {
      setIsExporting(false);
      setExportProgress(0);
    }
  }, [open]);

  const handleColumnToggle = (columnName: string, checked: boolean) => {
    setSelectedColumns((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(columnName);
      } else {
        next.delete(columnName);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedColumns(new Set(columns.map((col) => col.name)));
  };

  const handleDeselectAll = () => {
    setSelectedColumns(new Set());
  };

  const allSelected = selectedColumns.size === columns.length;
  const noneSelected = selectedColumns.size === 0;

  // Threshold for showing progress indicator (per spec: >1000 rows)
  const LARGE_EXPORT_THRESHOLD = 1000;
  const isLargeExport = rows.length > LARGE_EXPORT_THRESHOLD;

  const handleExport = useCallback(async () => {
    const columnNames = Array.from(selectedColumns);

    // For large exports, show progress indicator
    if (isLargeExport) {
      setIsExporting(true);
      setExportProgress(0);

      // Simulate progress for user feedback
      // The actual export happens asynchronously via IPC
      const progressInterval = setInterval(() => {
        setExportProgress((prev) => {
          if (prev >= 90) {
            return prev; // Cap at 90% until actually complete
          }
          // Slower progress for larger datasets
          const increment = Math.max(1, 10 - Math.floor(rows.length / 5000));
          return Math.min(90, prev + increment);
        });
      }, 100);

      try {
        onExport({
          format: selectedFormat,
          columns: columnNames,
          tableName,
          rows,
          connectionId,
          delimiter,
          includeHeaders,
          prettyPrint,
          sheetName: sheetName || tableName,
        });

        // Complete the progress
        clearInterval(progressInterval);
        setExportProgress(100);

        // Small delay to show 100% before closing
        await new Promise((resolve) => setTimeout(resolve, 300));
      } finally {
        clearInterval(progressInterval);
        setIsExporting(false);
        setExportProgress(0);
      }
    } else {
      onExport({
        format: selectedFormat,
        columns: columnNames,
        tableName,
        rows,
        connectionId,
        delimiter,
        includeHeaders,
        prettyPrint,
        sheetName: sheetName || tableName,
      });
    }

    onOpenChange(false);
  }, [
    selectedColumns,
    selectedFormat,
    tableName,
    rows,
    connectionId,
    delimiter,
    includeHeaders,
    prettyPrint,
    sheetName,
    isLargeExport,
    onExport,
    onOpenChange,
  ]);

  const selectedFormatInfo = FORMAT_OPTIONS.find(
    (opt) => opt.value === selectedFormat
  );
  const FormatIcon = selectedFormatInfo?.icon ?? FileText;

  const isExportDisabled = rows.length === 0 || noneSelected || isExporting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5" />
            Export Data
          </DialogTitle>
          <DialogDescription>
            Export {rows.length.toLocaleString()} rows from &quot;{tableName}
            &quot;
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Format Selection */}
          <div className="space-y-2">
            <Label htmlFor="export-format" className="text-sm font-medium">
              Export Format
            </Label>
            <Select
              value={selectedFormat}
              onValueChange={(value) =>
                setSelectedFormat(value as ExportFormat)
              }
            >
              <SelectTrigger id="export-format" className="w-full">
                <SelectValue placeholder="Select format">
                  <div className="flex items-center gap-2">
                    <FormatIcon className="h-4 w-4" />
                    <span>{selectedFormatInfo?.label}</span>
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {FORMAT_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  return (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <div className="flex flex-col">
                          <span>{option.label}</span>
                          <span className="text-muted-foreground text-xs">
                            {option.description}
                          </span>
                        </div>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Column Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">
                Columns ({selectedColumns.size} of {columns.length} selected)
              </Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto px-2 py-1 text-xs"
                  onClick={handleSelectAll}
                  disabled={allSelected}
                >
                  Select All
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto px-2 py-1 text-xs"
                  onClick={handleDeselectAll}
                  disabled={noneSelected}
                >
                  Deselect All
                </Button>
              </div>
            </div>
            <div className="border-input max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
              {columns.map((column) => (
                <label
                  key={column.name}
                  className="hover:bg-accent flex cursor-pointer items-center gap-2 rounded px-2 py-1"
                >
                  <Checkbox
                    checked={selectedColumns.has(column.name)}
                    onCheckedChange={(checked) =>
                      handleColumnToggle(column.name, checked === true)
                    }
                  />
                  <span className="text-sm">{column.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {column.type}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Format-Specific Options */}
          {selectedFormat === 'csv' && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">CSV Options</Label>
              <div className="space-y-3 rounded-md border p-3">
                <div className="space-y-2">
                  <Label
                    htmlFor="delimiter"
                    className="text-muted-foreground text-xs"
                  >
                    Delimiter
                  </Label>
                  <Select value={delimiter} onValueChange={setDelimiter}>
                    <SelectTrigger id="delimiter" className="w-full">
                      <SelectValue placeholder="Select delimiter" />
                    </SelectTrigger>
                    <SelectContent>
                      {DELIMITER_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex cursor-pointer items-center gap-2">
                  <Checkbox
                    checked={includeHeaders}
                    onCheckedChange={(checked) =>
                      setIncludeHeaders(checked === true)
                    }
                  />
                  <span className="text-sm">Include column headers</span>
                </label>
              </div>
            </div>
          )}

          {selectedFormat === 'json' && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">JSON Options</Label>
              <div className="space-y-3 rounded-md border p-3">
                <label className="flex cursor-pointer items-center gap-2">
                  <Checkbox
                    checked={prettyPrint}
                    onCheckedChange={(checked) =>
                      setPrettyPrint(checked === true)
                    }
                  />
                  <span className="text-sm">
                    Pretty-print (indented output)
                  </span>
                </label>
              </div>
            </div>
          )}

          {selectedFormat === 'xlsx' && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Excel Options</Label>
              <div className="space-y-3 rounded-md border p-3">
                <div className="space-y-2">
                  <Label
                    htmlFor="sheet-name"
                    className="text-muted-foreground text-xs"
                  >
                    Sheet Name
                  </Label>
                  <Input
                    id="sheet-name"
                    value={sheetName}
                    onChange={(e) => setSheetName(e.target.value)}
                    placeholder={tableName}
                    maxLength={31}
                  />
                  <p className="text-muted-foreground text-xs">
                    Maximum 31 characters
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Progress indicator for large exports */}
          {isExporting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Exporting {rows.length.toLocaleString()} rows...
                </span>
                <span className="text-muted-foreground">
                  {Math.round(exportProgress)}%
                </span>
              </div>
              <Progress value={exportProgress} className="h-2" />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isExporting}
          >
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExportDisabled}>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

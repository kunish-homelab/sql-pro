import type { SchemaComparisonResult } from '../../../../shared/types';
import { FileCode, FileDown, FileJson, FileText, Loader2 } from 'lucide-react';

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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type ReportFormat = 'html' | 'json' | 'markdown';

interface ReportFormatOption {
  value: ReportFormat;
  label: string;
  description: string;
  icon: typeof FileText;
  extension: string;
}

const FORMAT_OPTIONS: ReportFormatOption[] = [
  {
    value: 'html',
    label: 'HTML',
    description: 'Styled web page with visual indicators',
    icon: FileCode,
    extension: 'html',
  },
  {
    value: 'json',
    label: 'JSON',
    description: 'Raw data for programmatic use',
    icon: FileJson,
    extension: 'json',
  },
  {
    value: 'markdown',
    label: 'Markdown',
    description: 'Documentation-friendly format',
    icon: FileText,
    extension: 'md',
  },
];

interface ExportReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comparisonResult: SchemaComparisonResult | null;
}

/**
 * Dialog component to configure and export comparison reports.
 * Supports HTML, JSON, and Markdown formats with optional migration SQL inclusion.
 */
export function ExportReportDialog({
  open,
  onOpenChange,
  comparisonResult,
}: ExportReportDialogProps) {
  const [selectedFormat, setSelectedFormat] = useState<ReportFormat>('html');
  const [includeMigrationSQL, setIncludeMigrationSQL] =
    useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const handleExport = useCallback(async () => {
    if (!comparisonResult) {
      return;
    }

    setIsExporting(true);

    try {
      // Get the selected format option
      const formatOption = FORMAT_OPTIONS.find(
        (opt) => opt.value === selectedFormat
      );
      if (!formatOption) {
        throw new Error('Invalid format selected');
      }

      // Generate a default filename
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .slice(0, -5);
      const defaultFilename = `schema-comparison-${timestamp}.${formatOption.extension}`;

      // Show save dialog
      const filePath = await window.electron.showSaveDialog({
        title: 'Export Comparison Report',
        defaultPath: defaultFilename,
        filters: [
          {
            name: formatOption.label,
            extensions: [formatOption.extension],
          },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (!filePath) {
        // User cancelled
        return;
      }

      // Call IPC handler to export report
      const response = await window.sqlPro.schemaComparison.exportReport({
        comparisonResult,
        format: selectedFormat,
        filePath,
        includeMigrationSQL,
      });

      if (!response.success) {
        throw new Error(response.error || 'Export failed');
      }

      // Close dialog on success
      onOpenChange(false);
    } catch (error) {
      console.error('Export failed:', error);
      // TODO: Show error toast/notification
    } finally {
      setIsExporting(false);
    }
  }, [comparisonResult, selectedFormat, includeMigrationSQL, onOpenChange]);

  const selectedFormatInfo = FORMAT_OPTIONS.find(
    (opt) => opt.value === selectedFormat
  );
  const FormatIcon = selectedFormatInfo?.icon ?? FileText;

  const isExportDisabled = !comparisonResult || isExporting;

  // Calculate statistics for display
  const totalChanges = comparisonResult
    ? comparisonResult.summary.tablesAdded +
      comparisonResult.summary.tablesRemoved +
      comparisonResult.summary.tablesModified
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5" />
            Export Comparison Report
          </DialogTitle>
          <DialogDescription>
            {comparisonResult
              ? `Export comparison results with ${totalChanges} table ${totalChanges === 1 ? 'change' : 'changes'}`
              : 'No comparison results to export'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Format Selection */}
          <div className="space-y-2">
            <Label htmlFor="report-format" className="text-sm font-medium">
              Report Format
            </Label>
            <Select
              value={selectedFormat}
              onValueChange={(value) =>
                setSelectedFormat(value as ReportFormat)
              }
            >
              <SelectTrigger id="report-format" className="w-full">
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

          {/* Include Migration SQL Option */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Options</Label>
            <div className="space-y-3 rounded-md border p-3">
              <label className="flex cursor-pointer items-center gap-2">
                <Checkbox
                  checked={includeMigrationSQL}
                  onCheckedChange={(checked) =>
                    setIncludeMigrationSQL(checked === true)
                  }
                />
                <div className="flex flex-col">
                  <span className="text-sm">Include migration SQL</span>
                  <span className="text-muted-foreground text-xs">
                    Append generated SQL statements to the report
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Report Preview Info */}
          {comparisonResult && (
            <div className="space-y-2 rounded-md border p-3">
              <Label className="text-sm font-medium">Report Summary</Label>
              <div className="text-muted-foreground space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>Source:</span>
                  <span className="font-medium">
                    {comparisonResult.sourceName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Target:</span>
                  <span className="font-medium">
                    {comparisonResult.targetName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Tables compared:</span>
                  <span className="font-medium">
                    {comparisonResult.summary.sourceTables} →{' '}
                    {comparisonResult.summary.targetTables}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Total changes:</span>
                  <span className="font-medium">{totalChanges}</span>
                </div>
              </div>
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
                Export Report
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

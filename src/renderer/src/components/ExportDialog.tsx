import { FileDown, FileSpreadsheet, FileJson, FileCode, FileText } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
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
import type { ExportFormat, ColumnInfo } from '../../../shared/types';

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
  // Format-specific options (will be extended in subtask-5-3)
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

  const handleExport = () => {
    const columnNames = columns.map((col) => col.name);

    onExport({
      format: selectedFormat,
      columns: columnNames,
      tableName,
      rows,
      connectionId,
      // Default format-specific options
      delimiter: ',',
      includeHeaders: true,
      prettyPrint: false,
      sheetName: tableName,
    });

    onOpenChange(false);
  };

  const selectedFormatInfo = FORMAT_OPTIONS.find(
    (opt) => opt.value === selectedFormat
  );
  const FormatIcon = selectedFormatInfo?.icon ?? FileText;

  const isExportDisabled = rows.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5" />
            Export Data
          </DialogTitle>
          <DialogDescription>
            Export {rows.length.toLocaleString()} rows from &quot;{tableName}&quot;
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
              onValueChange={(value) => setSelectedFormat(value as ExportFormat)}
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

          {/* Column count info - placeholder for column selection in subtask-5-2 */}
          <div className="text-muted-foreground text-sm">
            {columns.length} column{columns.length !== 1 ? 's' : ''} will be exported
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExportDisabled}>
            <FileDown className="mr-2 h-4 w-4" />
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

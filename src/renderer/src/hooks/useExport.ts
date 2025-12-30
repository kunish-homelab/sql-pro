import type { ExportFormat, ExportResponse } from '../../../shared/types';
import { useCallback, useState } from 'react';
import { sqlPro } from '@/lib/api';

export interface ExportDataOptions {
  /** Export format */
  format: ExportFormat;
  /** Table name for SQL INSERT statements and file naming */
  tableName: string;
  /** Connection ID for database operations */
  connectionId: string;
  /** Rows to export (pre-filtered from UI) */
  rows: Record<string, unknown>[];
  /** Columns to include in export */
  columns: string[];
  /** CSV delimiter character (defaults to ',') */
  delimiter?: string;
  /** Include column headers in export (CSV format, defaults to true) */
  includeHeaders?: boolean;
  /** Pretty-print JSON output with indentation (defaults to false) */
  prettyPrint?: boolean;
  /** Excel worksheet name (defaults to table name) */
  sheetName?: string;
}

export interface UseExportResult {
  /** Initiates the export process with save dialog */
  exportData: (options: ExportDataOptions) => Promise<ExportResponse | null>;
  /** Whether an export is currently in progress */
  isExporting: boolean;
  /** Error from the last export attempt */
  error: Error | null;
  /** Result from the last successful export */
  lastExportResult: ExportResponse | null;
  /** Clear the current error state */
  clearError: () => void;
}

/** File extension map for export formats */
const FORMAT_EXTENSIONS: Record<ExportFormat, string> = {
  csv: 'csv',
  json: 'json',
  sql: 'sql',
  xlsx: 'xlsx',
};

/** File filter configurations for save dialog */
const FORMAT_FILTERS: Record<
  ExportFormat,
  { name: string; extensions: string[] }[]
> = {
  csv: [{ name: 'CSV Files', extensions: ['csv'] }],
  json: [{ name: 'JSON Files', extensions: ['json'] }],
  sql: [{ name: 'SQL Files', extensions: ['sql'] }],
  xlsx: [{ name: 'Excel Files', extensions: ['xlsx'] }],
};

/**
 * Hook for exporting table data to various formats.
 * Handles save dialog interaction and IPC communication with the main process.
 */
export function useExport(): UseExportResult {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastExportResult, setLastExportResult] =
    useState<ExportResponse | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const exportData = useCallback(
    async (options: ExportDataOptions): Promise<ExportResponse | null> => {
      const {
        format,
        tableName,
        connectionId,
        rows,
        columns,
        delimiter = ',',
        includeHeaders = true,
        prettyPrint = false,
        sheetName,
      } = options;

      // Validate inputs
      if (rows.length === 0) {
        const emptyError = new Error('No data to export');
        setError(emptyError);
        return null;
      }

      if (columns.length === 0) {
        const noColumnsError = new Error('No columns selected for export');
        setError(noColumnsError);
        return null;
      }

      setIsExporting(true);
      setError(null);

      try {
        // Show save file dialog
        const extension = FORMAT_EXTENSIONS[format];
        const filters = FORMAT_FILTERS[format];
        const defaultFilename = `${tableName}.${extension}`;

        const dialogResult = await sqlPro.dialog.saveFile({
          title: `Export to ${format.toUpperCase()}`,
          filters,
          defaultPath: defaultFilename,
        });

        // User cancelled the dialog
        if (
          !dialogResult.success ||
          dialogResult.canceled ||
          !dialogResult.filePath
        ) {
          setIsExporting(false);
          return null;
        }

        // Call export IPC handler
        const exportResult = await sqlPro.export.data({
          connectionId,
          table: tableName,
          format,
          filePath: dialogResult.filePath,
          columns,
          rows,
          delimiter,
          includeHeaders,
          prettyPrint,
          sheetName: sheetName || tableName,
        });

        if (!exportResult.success) {
          throw new Error(exportResult.error || 'Export failed');
        }

        setLastExportResult(exportResult);
        return exportResult;
      } catch (err) {
        const exportError = err instanceof Error ? err : new Error(String(err));
        setError(exportError);
        return null;
      } finally {
        setIsExporting(false);
      }
    },
    []
  );

  return {
    exportData,
    isExporting,
    error,
    lastExportResult,
    clearError,
  };
}

/**
 * Export generators for various data formats.
 * These utilities convert row data to different export formats (CSV, JSON, SQL, Excel).
 */
import Papa from 'papaparse';

import type { ColumnInfo } from '../../shared/types';

// ============ CSV Generator ============

export interface CSVExportOptions {
  /** Columns to include (all columns if not specified) */
  columns?: string[];
  /** Include header row (defaults to true) */
  includeHeaders?: boolean;
  /** Field delimiter (defaults to ',') */
  delimiter?: string;
}

/**
 * Generates CSV content from row data using PapaParse.
 *
 * @param rows - Array of data objects to export
 * @param allColumns - All available column definitions
 * @param options - CSV export configuration
 * @returns CSV formatted string
 */
export function generateCSV(
  rows: Record<string, unknown>[],
  allColumns: ColumnInfo[],
  options: CSVExportOptions = {}
): string {
  const { columns, includeHeaders = true, delimiter = ',' } = options;

  // Determine which columns to include
  const columnNames = columns ?? allColumns.map((c) => c.name);

  // Filter rows to only include selected columns
  const filteredRows = rows.map((row) => {
    const filteredRow: Record<string, unknown> = {};
    for (const col of columnNames) {
      filteredRow[col] = row[col];
    }
    return filteredRow;
  });

  // Use PapaParse to generate CSV
  // CRITICAL: quotes: false to avoid unnecessary quoting (per spec)
  // PapaParse will still quote fields when necessary (containing delimiter, newline, or quotes)
  return Papa.unparse(filteredRows, {
    quotes: false,
    delimiter,
    header: includeHeaders,
    columns: columnNames,
    newline: '\n',
  });
}

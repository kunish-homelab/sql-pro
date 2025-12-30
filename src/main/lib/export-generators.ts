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

// ============ JSON Generator ============

export interface JSONExportOptions {
  /** Columns to include (all columns if not specified) */
  columns?: string[];
  /** Pretty-print with indentation (defaults to false) */
  prettyPrint?: boolean;
  /** Indentation size when pretty-printing (defaults to 2) */
  indent?: number;
}

/**
 * Generates JSON content from row data.
 *
 * @param rows - Array of data objects to export
 * @param allColumns - All available column definitions
 * @param options - JSON export configuration
 * @returns JSON formatted string
 */
export function generateJSON(
  rows: Record<string, unknown>[],
  allColumns: ColumnInfo[],
  options: JSONExportOptions = {}
): string {
  const { columns, prettyPrint = false, indent = 2 } = options;

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

  // Generate JSON with optional pretty-printing
  // Dates are automatically converted to ISO strings by JSON.stringify
  if (prettyPrint) {
    return JSON.stringify(filteredRows, null, indent);
  }
  return JSON.stringify(filteredRows);
}

// ============ SQL INSERT Generator ============

export interface SQLExportOptions {
  /** Columns to include (all columns if not specified) */
  columns?: string[];
  /** Table name for INSERT statements (required) */
  tableName: string;
}

/**
 * Escapes a SQL identifier (table name or column name) to prevent SQL injection
 * and handle reserved keywords.
 *
 * @param identifier - The identifier to escape
 * @returns Escaped identifier wrapped in double quotes
 */
function escapeIdentifier(identifier: string): string {
  // Escape any double quotes by doubling them, then wrap in double quotes
  return `"${identifier.replace(/"/g, '""')}"`;
}

/**
 * Escapes a value for use in a SQL INSERT statement.
 * Handles NULL, strings (with quote escaping), booleans, and numbers.
 *
 * @param value - The value to escape
 * @returns SQL-safe string representation of the value
 */
function escapeSQLValue(value: unknown): string {
  // Handle NULL and undefined
  if (value === null || value === undefined) {
    return 'NULL';
  }

  // Handle strings - escape single quotes by doubling them
  if (typeof value === 'string') {
    return `'${value.replace(/'/g, "''")}'`;
  }

  // Handle booleans - SQLite uses 1/0
  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }

  // Handle numbers (including BigInt)
  if (typeof value === 'number' || typeof value === 'bigint') {
    return String(value);
  }

  // Handle Date objects - convert to ISO string
  if (value instanceof Date) {
    return `'${value.toISOString()}'`;
  }

  // Handle Buffer/Blob - convert to hex literal
  if (Buffer.isBuffer(value)) {
    return `X'${value.toString('hex')}'`;
  }

  // Fallback for other types - convert to string and escape
  return `'${String(value).replace(/'/g, "''")}'`;
}

/**
 * Generates SQL INSERT statements from row data.
 *
 * @param rows - Array of data objects to export
 * @param allColumns - All available column definitions
 * @param options - SQL export configuration (tableName is required)
 * @returns SQL INSERT statements as a string, one per line
 */
export function generateSQL(
  rows: Record<string, unknown>[],
  allColumns: ColumnInfo[],
  options: SQLExportOptions
): string {
  const { columns, tableName } = options;

  // Handle empty rows
  if (rows.length === 0) {
    return '';
  }

  // Determine which columns to include
  const columnNames = columns ?? allColumns.map((c) => c.name);

  // Escape table name and column names
  const escapedTableName = escapeIdentifier(tableName);
  const escapedColumnNames = columnNames.map(escapeIdentifier);
  const columnList = escapedColumnNames.join(', ');

  // Generate INSERT statements
  const insertStatements = rows.map((row) => {
    const values = columnNames.map((col) => escapeSQLValue(row[col])).join(', ');
    return `INSERT INTO ${escapedTableName} (${columnList}) VALUES (${values});`;
  });

  return insertStatements.join('\n');
}

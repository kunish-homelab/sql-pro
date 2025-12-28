import type { ColumnInfo } from '../../../shared/types';
import { useMemo } from 'react';

/**
 * Row data type with optional __rowId property
 */
export interface SearchableRow {
  __rowId?: string | number;
  [key: string]: unknown;
}

/**
 * Options for the useClientSearch hook
 */
export interface UseClientSearchOptions<T extends SearchableRow> {
  /** The rows to search through */
  rows: T[];
  /** The visible columns - search is performed only on these */
  columns: ColumnInfo[];
  /** The search term (case-insensitive) */
  searchTerm: string;
  /** Column IDs to exclude from search (e.g., internal columns starting with __) */
  excludeColumns?: string[];
}

/**
 * Stats about the search results
 */
export interface SearchStats {
  /** Total number of rows before filtering */
  totalRows: number;
  /** Number of rows matching the search */
  matchedRows: number;
  /** Whether a search is currently active */
  isSearching: boolean;
}

/**
 * Result returned by the useClientSearch hook
 */
export interface UseClientSearchResult<T extends SearchableRow> {
  /** Filtered rows matching the search term */
  filteredRows: T[];
  /** Statistics about the search */
  stats: SearchStats;
}

/**
 * Convert a cell value to a searchable string
 * Handles null, undefined, numbers, booleans, dates, and objects
 */
function valueToSearchString(value: unknown): string {
  if (value === null) {
    return 'NULL';
  }
  if (value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/**
 * Check if a row matches the search term
 * Returns true if any visible column value contains the search term (case-insensitive)
 */
function rowMatchesSearch<T extends SearchableRow>(
  row: T,
  columns: ColumnInfo[],
  searchTermLower: string,
  excludeColumns: Set<string>
): boolean {
  // Check each visible column
  for (const column of columns) {
    // Skip excluded columns
    if (excludeColumns.has(column.name)) {
      continue;
    }

    const cellValue = row[column.name];
    const searchableValue = valueToSearchString(cellValue).toLowerCase();

    if (searchableValue.includes(searchTermLower)) {
      return true;
    }
  }

  return false;
}

/**
 * Custom hook for client-side search/filtering of table rows.
 *
 * Filters rows based on a search term, matching against all visible column values.
 * Search is case-insensitive and matches partial strings.
 *
 * @example
 * ```tsx
 * const { filteredRows, stats } = useClientSearch({
 *   rows: displayRows,
 *   columns,
 *   searchTerm,
 * });
 *
 * // Use filteredRows in your DataTable
 * // Display stats.matchedRows of stats.totalRows if searching
 * ```
 */
export function useClientSearch<T extends SearchableRow>(
  options: UseClientSearchOptions<T>
): UseClientSearchResult<T> {
  const { rows, columns, searchTerm, excludeColumns = [] } = options;

  const result = useMemo(() => {
    const trimmedSearch = searchTerm.trim();
    const isSearching = trimmedSearch.length > 0;
    const totalRows = rows.length;

    // If no search term, return all rows
    if (!isSearching) {
      return {
        filteredRows: rows,
        stats: {
          totalRows,
          matchedRows: totalRows,
          isSearching: false,
        },
      };
    }

    // Build exclude columns set for faster lookup
    const excludeSet = new Set([
      ...excludeColumns,
      // Always exclude internal columns
      '__rowId',
      '__isNew',
      '__isDeleted',
      '__isModified',
      '__change',
    ]);

    // Normalize search term for case-insensitive comparison
    const searchTermLower = trimmedSearch.toLowerCase();

    // Filter rows that match the search term
    const filteredRows = rows.filter((row) =>
      rowMatchesSearch(row, columns, searchTermLower, excludeSet)
    );

    return {
      filteredRows,
      stats: {
        totalRows,
        matchedRows: filteredRows.length,
        isSearching: true,
      },
    };
  }, [rows, columns, searchTerm, excludeColumns]);

  return result;
}

import type {
  GenerateSyncSQLRequest,
  GenerateSyncSQLResponse,
  RowDiff,
} from '@shared/types';
import { Buffer } from 'node:buffer';

/**
 * Service for generating SQL sync statements from data comparison results.
 * Generates INSERT, UPDATE, and DELETE statements to sync target to match source.
 */
class DataDiffSyncGeneratorService {
  /**
   * Generate SQL statements to sync target table to match source table.
   * Supports filtering by selected rows and controlling which types of changes to include.
   */
  generateSyncSQL(request: GenerateSyncSQLRequest): GenerateSyncSQLResponse {
    try {
      const {
        comparisonResult,
        selectedRows = [],
        includeInserts = true,
        includeUpdates = true,
        includeDeletes = false, // Default to false for safety
      } = request;

      if (!comparisonResult) {
        return {
          success: false,
          error: 'Comparison result is required',
        };
      }

      const statements: string[] = [];
      const warnings: string[] = [];

      // Get the rows to process (filtered by selectedRows if provided)
      const rowsToProcess = this.filterRowsBySelection(
        comparisonResult.rowDiffs,
        selectedRows
      );

      // Process in order:
      // 1. DELETE statements (remove rows that don't exist in source)
      // 2. UPDATE statements (modify existing rows to match source)
      // 3. INSERT statements (add rows that exist in source but not target)

      // Phase 1: Generate DELETE statements for removed rows
      if (includeDeletes) {
        for (const rowDiff of rowsToProcess) {
          if (rowDiff.diffType === 'removed') {
            const deleteStmt = this.generateDeleteStatement(
              comparisonResult.targetTable,
              comparisonResult.targetSchema,
              rowDiff,
              comparisonResult.primaryKeys
            );
            statements.push(deleteStmt);
          }
        }

        const deleteCount = rowsToProcess.filter(
          (r) => r.diffType === 'removed'
        ).length;
        if (deleteCount > 0) {
          warnings.push(
            `${deleteCount} row(s) will be deleted from target table. ` +
              `This operation cannot be undone. Make sure to backup data before executing.`
          );
        }
      }

      // Phase 2: Generate UPDATE statements for modified rows
      if (includeUpdates) {
        for (const rowDiff of rowsToProcess) {
          if (rowDiff.diffType === 'modified') {
            const updateStmt = this.generateUpdateStatement(
              comparisonResult.targetTable,
              comparisonResult.targetSchema,
              rowDiff,
              comparisonResult.primaryKeys
            );
            statements.push(updateStmt);
          }
        }
      }

      // Phase 3: Generate INSERT statements for added rows
      if (includeInserts) {
        for (const rowDiff of rowsToProcess) {
          if (rowDiff.diffType === 'added') {
            const insertStmt = this.generateInsertStatement(
              comparisonResult.targetTable,
              comparisonResult.targetSchema,
              rowDiff
            );
            statements.push(insertStmt);
          }
        }
      }

      // Add general warnings
      if (statements.length === 0) {
        warnings.push(
          'No SQL statements generated. Check your selection and include options.'
        );
      }

      // Join all statements with semicolons and newlines
      const sql = statements.join(';\n\n') + (statements.length > 0 ? ';' : '');

      return {
        success: true,
        sql,
        statements,
        warnings,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error generating sync SQL',
      };
    }
  }

  /**
   * Filter rows based on selected primary keys.
   * If no selection provided, returns all rows.
   */
  private filterRowsBySelection(
    allRows: RowDiff[],
    selectedRows: Array<Record<string, unknown>>
  ): RowDiff[] {
    if (selectedRows.length === 0) {
      // No selection filter, return all rows
      return allRows;
    }

    // Create a set of selected primary key strings for efficient lookup
    const selectedKeys = new Set(selectedRows.map((pk) => JSON.stringify(pk)));

    // Filter rows that match selected primary keys
    return allRows.filter((row) => {
      const pkString = JSON.stringify(row.primaryKey);
      return selectedKeys.has(pkString);
    });
  }

  /**
   * Generate INSERT statement for an added row.
   */
  private generateInsertStatement(
    tableName: string,
    schema: string,
    rowDiff: RowDiff
  ): string {
    if (!rowDiff.sourceRow) {
      throw new Error('Cannot generate INSERT: source row is null');
    }

    const fullTableName =
      schema && schema !== 'main' ? `${schema}.${tableName}` : tableName;

    const columns = Object.keys(rowDiff.sourceRow);
    const values = columns.map((col) =>
      this.formatValue(rowDiff.sourceRow![col])
    );

    const columnList = columns.join(', ');
    const valueList = values.join(', ');

    return `INSERT INTO ${fullTableName} (${columnList}) VALUES (${valueList})`;
  }

  /**
   * Generate UPDATE statement for a modified row.
   */
  private generateUpdateStatement(
    tableName: string,
    schema: string,
    rowDiff: RowDiff,
    primaryKeys: string[]
  ): string {
    if (!rowDiff.sourceRow || !rowDiff.columnChanges) {
      throw new Error(
        'Cannot generate UPDATE: source row or column changes are null'
      );
    }

    const fullTableName =
      schema && schema !== 'main' ? `${schema}.${tableName}` : tableName;

    // Build SET clause from changed columns
    const setClause = rowDiff.columnChanges
      .map((change) => {
        const value = this.formatValue(change.sourceValue);
        return `${change.columnName} = ${value}`;
      })
      .join(', ');

    // Build WHERE clause from primary key
    const whereClause = this.buildWhereClause(rowDiff.primaryKey, primaryKeys);

    return `UPDATE ${fullTableName} SET ${setClause} WHERE ${whereClause}`;
  }

  /**
   * Generate DELETE statement for a removed row.
   */
  private generateDeleteStatement(
    tableName: string,
    schema: string,
    rowDiff: RowDiff,
    primaryKeys: string[]
  ): string {
    const fullTableName =
      schema && schema !== 'main' ? `${schema}.${tableName}` : tableName;

    // Build WHERE clause from primary key
    const whereClause = this.buildWhereClause(rowDiff.primaryKey, primaryKeys);

    return `DELETE FROM ${fullTableName} WHERE ${whereClause}`;
  }

  /**
   * Build WHERE clause from primary key values.
   */
  private buildWhereClause(
    primaryKey: Record<string, unknown>,
    primaryKeyColumns: string[]
  ): string {
    return primaryKeyColumns
      .map((col) => {
        const value = primaryKey[col];
        // Handle NULL values
        if (value === null || value === undefined) {
          return `${col} IS NULL`;
        }
        return `${col} = ${this.formatValue(value)}`;
      })
      .join(' AND ');
  }

  /**
   * Format a value for SQL statement.
   * Handles NULL, strings, numbers, booleans, and other types.
   */
  private formatValue(value: unknown): string {
    // Handle NULL
    if (value === null || value === undefined) {
      return 'NULL';
    }

    // Handle numbers and booleans
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    // Handle strings - escape single quotes
    if (typeof value === 'string') {
      return `'${this.escapeString(value)}'`;
    }

    // Handle Buffer (BLOB data)
    if (Buffer.isBuffer(value)) {
      // Convert to hex string for SQLite BLOB
      return `X'${value.toString('hex')}'`;
    }

    // Handle objects/arrays - convert to JSON string
    if (typeof value === 'object') {
      return `'${this.escapeString(JSON.stringify(value))}'`;
    }

    // Fallback: convert to string
    return `'${this.escapeString(String(value))}'`;
  }

  /**
   * Escape single quotes in SQL string values.
   */
  private escapeString(str: string): string {
    // In SQLite, single quotes are escaped by doubling them
    return str.replace(/'/g, "''");
  }
}

// Export singleton instance
export const dataDiffSyncGeneratorService = new DataDiffSyncGeneratorService();
export default dataDiffSyncGeneratorService;

import type {
  ColumnChange,
  DataComparisonPagination,
  DataComparisonResult,
  RowDiff,
} from '@shared/types';
import databaseService from './database';

/**
 * Service for comparing table data between two tables.
 * Supports comparing tables in the same or different database connections.
 */
class DataDiffService {
  /**
   * Compare data between two tables and generate a comprehensive diff.
   * Matches rows by primary key and detects added, removed, and modified rows.
   */
  async compareTableData(
    sourceConnectionId: string,
    sourceTable: string,
    sourceSchema: string,
    targetConnectionId: string,
    targetTable: string,
    targetSchema: string,
    primaryKeys: string[],
    pagination?: DataComparisonPagination
  ): Promise<DataComparisonResult> {
    // Fetch data from both tables
    const sourceData = await this.fetchTableData(
      sourceConnectionId,
      sourceTable,
      sourceSchema,
      pagination
    );

    const targetData = await this.fetchTableData(
      targetConnectionId,
      targetTable,
      targetSchema,
      pagination
    );

    // If no primary keys provided, try to detect from table schema
    const effectivePrimaryKeys =
      primaryKeys.length > 0
        ? primaryKeys
        : await this.detectPrimaryKeys(
            sourceConnectionId,
            sourceTable,
            sourceSchema
          );

    if (effectivePrimaryKeys.length === 0) {
      throw new Error(
        'No primary key columns specified and none could be detected. Please specify primary key columns for row matching.'
      );
    }

    // Generate row diffs
    const rowDiffs = this.compareRows(
      sourceData.rows,
      targetData.rows,
      effectivePrimaryKeys
    );

    // Calculate summary statistics
    const summary = this.calculateSummary(
      rowDiffs,
      sourceData.rows.length,
      targetData.rows.length
    );

    // Get connection info for display names
    const sourceConn = databaseService.getConnection(sourceConnectionId);
    const targetConn = databaseService.getConnection(targetConnectionId);

    return {
      sourceId: sourceConnectionId,
      sourceName: sourceConn
        ? `${sourceConn.filename} - ${sourceSchema}.${sourceTable}`
        : `${sourceSchema}.${sourceTable}`,
      sourceTable,
      sourceSchema,
      targetId: targetConnectionId,
      targetName: targetConn
        ? `${targetConn.filename} - ${targetSchema}.${targetTable}`
        : `${targetSchema}.${targetTable}`,
      targetTable,
      targetSchema,
      comparedAt: new Date().toISOString(),
      primaryKeys: effectivePrimaryKeys,
      rowDiffs,
      summary,
    };
  }

  /**
   * Fetch table data from a database connection.
   */
  private async fetchTableData(
    connectionId: string,
    table: string,
    schema: string,
    pagination?: DataComparisonPagination
  ): Promise<{ rows: Record<string, unknown>[] }> {
    // Use pagination if provided, otherwise fetch all data
    const page = pagination?.page ?? 0;
    const pageSize = pagination?.pageSize ?? 10000; // Default to large page size

    const result = databaseService.getTableData(
      connectionId,
      table,
      page,
      pageSize,
      undefined, // No sorting
      undefined,
      undefined, // No filters
      schema
    );

    if (!result.success) {
      throw new Error(
        `Failed to fetch data from ${schema}.${table}: ${result.error}`
      );
    }

    return { rows: result.rows || [] };
  }

  /**
   * Detect primary key columns from table schema.
   */
  private async detectPrimaryKeys(
    connectionId: string,
    table: string,
    schema: string
  ): Promise<string[]> {
    const schemaResult = databaseService.getSchema(connectionId);

    if (!schemaResult.success) {
      return [];
    }

    // Find the table in the schema
    for (const schemaInfo of schemaResult.schemas) {
      if (schemaInfo.name === schema) {
        const tableInfo = [...schemaInfo.tables, ...schemaInfo.views].find(
          (t) => t.name === table
        );

        if (tableInfo && tableInfo.primaryKey.length > 0) {
          return tableInfo.primaryKey;
        }
      }
    }

    return [];
  }

  /**
   * Compare rows from source and target tables.
   * Matches rows by primary key and detects added, removed, and modified rows.
   */
  private compareRows(
    sourceRows: Record<string, unknown>[],
    targetRows: Record<string, unknown>[],
    primaryKeys: string[]
  ): RowDiff[] {
    const diffs: RowDiff[] = [];

    // Create maps for efficient lookup using primary key
    const sourceMap = new Map<string, Record<string, unknown>>();
    const targetMap = new Map<string, Record<string, unknown>>();

    // Build source map
    for (const row of sourceRows) {
      const key = this.buildPrimaryKeyValue(row, primaryKeys);
      sourceMap.set(key, row);
    }

    // Build target map
    for (const row of targetRows) {
      const key = this.buildPrimaryKeyValue(row, primaryKeys);
      targetMap.set(key, row);
    }

    // Get all unique primary key values
    const allKeys = new Set([...sourceMap.keys(), ...targetMap.keys()]);

    // Compare each row
    for (const key of allKeys) {
      const sourceRow = sourceMap.get(key);
      const targetRow = targetMap.get(key);

      if (!sourceRow && targetRow) {
        // Row added in target
        diffs.push({
          primaryKey: this.extractPrimaryKeyValues(targetRow, primaryKeys),
          diffType: 'added',
          sourceRow: null,
          targetRow,
        });
      } else if (sourceRow && !targetRow) {
        // Row removed from source
        diffs.push({
          primaryKey: this.extractPrimaryKeyValues(sourceRow, primaryKeys),
          diffType: 'removed',
          sourceRow,
          targetRow: null,
        });
      } else if (sourceRow && targetRow) {
        // Row exists in both, check for modifications
        const columnChanges = this.detectColumnChanges(sourceRow, targetRow);

        if (columnChanges.length > 0) {
          diffs.push({
            primaryKey: this.extractPrimaryKeyValues(sourceRow, primaryKeys),
            diffType: 'modified',
            sourceRow,
            targetRow,
            columnChanges,
          });
        } else {
          diffs.push({
            primaryKey: this.extractPrimaryKeyValues(sourceRow, primaryKeys),
            diffType: 'unchanged',
            sourceRow,
            targetRow,
          });
        }
      }
    }

    return diffs;
  }

  /**
   * Build a string key from primary key values for efficient lookup.
   */
  private buildPrimaryKeyValue(
    row: Record<string, unknown>,
    primaryKeys: string[]
  ): string {
    return primaryKeys
      .map((key) => {
        const value = row[key];
        // Handle null/undefined
        if (value === null || value === undefined) {
          return '__NULL__';
        }
        // Convert to string for comparison
        return String(value);
      })
      .join('|||');
  }

  /**
   * Extract primary key values as a record.
   */
  private extractPrimaryKeyValues(
    row: Record<string, unknown>,
    primaryKeys: string[]
  ): Record<string, unknown> {
    const pkValues: Record<string, unknown> = {};
    for (const key of primaryKeys) {
      pkValues[key] = row[key];
    }
    return pkValues;
  }

  /**
   * Detect column-level changes between two rows.
   */
  private detectColumnChanges(
    sourceRow: Record<string, unknown>,
    targetRow: Record<string, unknown>
  ): ColumnChange[] {
    const changes: ColumnChange[] = [];

    // Get all unique column names from both rows
    const allColumns = new Set([
      ...Object.keys(sourceRow),
      ...Object.keys(targetRow),
    ]);

    for (const columnName of allColumns) {
      const sourceValue = sourceRow[columnName];
      const targetValue = targetRow[columnName];

      // Compare values (handle null/undefined properly)
      if (!this.valuesEqual(sourceValue, targetValue)) {
        changes.push({
          columnName,
          sourceValue,
          targetValue,
        });
      }
    }

    return changes;
  }

  /**
   * Compare two values for equality, handling null/undefined and type differences.
   */
  private valuesEqual(a: unknown, b: unknown): boolean {
    // Both null or undefined
    if ((a === null || a === undefined) && (b === null || b === undefined)) {
      return true;
    }

    // One is null/undefined, other is not
    if (a === null || a === undefined || b === null || b === undefined) {
      return false;
    }

    // For objects/arrays, use JSON comparison
    if (typeof a === 'object' && typeof b === 'object') {
      return JSON.stringify(a) === JSON.stringify(b);
    }

    // Direct comparison
    return a === b;
  }

  /**
   * Calculate summary statistics from row diffs.
   */
  private calculateSummary(
    rowDiffs: RowDiff[],
    sourceRowCount: number,
    targetRowCount: number
  ): DataComparisonResult['summary'] {
    const summary = {
      sourceRows: sourceRowCount,
      targetRows: targetRowCount,
      rowsAdded: 0,
      rowsRemoved: 0,
      rowsModified: 0,
      rowsUnchanged: 0,
    };

    for (const diff of rowDiffs) {
      if (diff.diffType === 'added') {
        summary.rowsAdded++;
      } else if (diff.diffType === 'removed') {
        summary.rowsRemoved++;
      } else if (diff.diffType === 'modified') {
        summary.rowsModified++;
      } else if (diff.diffType === 'unchanged') {
        summary.rowsUnchanged++;
      }
    }

    return summary;
  }
}

// Export singleton instance
export const dataDiffService = new DataDiffService();
export default dataDiffService;

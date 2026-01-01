import type {
  ColumnDiff,
  ColumnInfo,
  ForeignKeyDiff,
  ForeignKeyInfo,
  IndexDiff,
  IndexInfo,
  SchemaComparisonResult,
  SchemaInfo,
  TableDiff,
  TableInfo,
  TriggerDiff,
  TriggerInfo,
} from '../../shared/types';

/**
 * Service for comparing database schemas and generating diffs.
 * Supports comparing live connections, snapshots, and connection-to-snapshot.
 */
class SchemaComparisonService {
  /**
   * Compare two schema infos and generate a comprehensive diff.
   * This is the core comparison logic used by all public methods.
   */
  compareSchemas(
    sourceSchemas: SchemaInfo[],
    targetSchemas: SchemaInfo[],
    sourceId: string,
    sourceName: string,
    sourceType: 'connection' | 'snapshot',
    targetId: string,
    targetName: string,
    targetType: 'connection' | 'snapshot'
  ): SchemaComparisonResult {
    const tableDiffs: TableDiff[] = [];

    // Create maps for efficient lookup
    const sourceTablesMap = new Map<string, TableInfo>();
    const targetTablesMap = new Map<string, TableInfo>();

    // Collect all tables from all schemas
    for (const schema of sourceSchemas) {
      for (const table of [...schema.tables, ...schema.views]) {
        const key = `${table.schema}.${table.name}`;
        sourceTablesMap.set(key, table);
      }
    }

    for (const schema of targetSchemas) {
      for (const table of [...schema.tables, ...schema.views]) {
        const key = `${table.schema}.${table.name}`;
        targetTablesMap.set(key, table);
      }
    }

    // Get all unique table keys
    const allTableKeys = new Set([
      ...sourceTablesMap.keys(),
      ...targetTablesMap.keys(),
    ]);

    // Compare each table
    for (const tableKey of allTableKeys) {
      const sourceTable = sourceTablesMap.get(tableKey);
      const targetTable = targetTablesMap.get(tableKey);

      if (!sourceTable && targetTable) {
        // Table added in target
        tableDiffs.push({
          name: targetTable.name,
          schema: targetTable.schema,
          diffType: 'added',
          source: null,
          target: targetTable,
        });
      } else if (sourceTable && !targetTable) {
        // Table removed from source
        tableDiffs.push({
          name: sourceTable.name,
          schema: sourceTable.schema,
          diffType: 'removed',
          source: sourceTable,
          target: null,
        });
      } else if (sourceTable && targetTable) {
        // Table exists in both, check for modifications
        const tableDiff = this.compareTable(sourceTable, targetTable);
        tableDiffs.push(tableDiff);
      }
    }

    // Calculate summary statistics
    const summary = this.calculateSummary(tableDiffs);

    return {
      sourceId,
      sourceName,
      sourceType,
      targetId,
      targetName,
      targetType,
      comparedAt: new Date().toISOString(),
      tableDiffs,
      summary,
    };
  }

  /**
   * Compare two tables and generate a detailed diff.
   */
  private compareTable(source: TableInfo, target: TableInfo): TableDiff {
    // Compare columns
    const columnDiffs = this.compareColumns(source.columns, target.columns);

    // Compare indexes
    const indexDiffs = this.compareIndexes(source.indexes, target.indexes);

    // Compare foreign keys
    const foreignKeyDiffs = this.compareForeignKeys(
      source.foreignKeys,
      target.foreignKeys
    );

    // Compare triggers
    const triggerDiffs = this.compareTriggers(source.triggers, target.triggers);

    // Compare primary keys
    const primaryKeyChanges = this.comparePrimaryKeys(
      source.primaryKey,
      target.primaryKey
    );

    // Determine if table is modified
    const hasChanges =
      columnDiffs.some((d) => d.diffType !== 'unchanged') ||
      indexDiffs.some((d) => d.diffType !== 'unchanged') ||
      foreignKeyDiffs.some((d) => d.diffType !== 'unchanged') ||
      triggerDiffs.some((d) => d.diffType !== 'unchanged') ||
      primaryKeyChanges !== null;

    return {
      name: source.name,
      schema: source.schema,
      diffType: hasChanges ? 'modified' : 'unchanged',
      source,
      target,
      columnDiffs,
      indexDiffs,
      foreignKeyDiffs,
      triggerDiffs,
      primaryKeyChanges: primaryKeyChanges || undefined,
    };
  }

  /**
   * Compare columns between two tables.
   */
  private compareColumns(
    sourceColumns: ColumnInfo[],
    targetColumns: ColumnInfo[]
  ): ColumnDiff[] {
    const diffs: ColumnDiff[] = [];

    // Create maps for efficient lookup
    const sourceMap = new Map(sourceColumns.map((c) => [c.name, c]));
    const targetMap = new Map(targetColumns.map((c) => [c.name, c]));

    // Get all unique column names
    const allColumnNames = new Set([
      ...sourceColumns.map((c) => c.name),
      ...targetColumns.map((c) => c.name),
    ]);

    for (const columnName of allColumnNames) {
      const sourceColumn = sourceMap.get(columnName);
      const targetColumn = targetMap.get(columnName);

      if (!sourceColumn && targetColumn) {
        // Column added
        diffs.push({
          name: columnName,
          diffType: 'added',
          source: null,
          target: targetColumn,
        });
      } else if (sourceColumn && !targetColumn) {
        // Column removed
        diffs.push({
          name: columnName,
          diffType: 'removed',
          source: sourceColumn,
          target: null,
        });
      } else if (sourceColumn && targetColumn) {
        // Column exists in both, check for changes
        const changes = this.detectColumnChanges(sourceColumn, targetColumn);
        const hasChanges = changes !== undefined;

        diffs.push({
          name: columnName,
          diffType: hasChanges ? 'modified' : 'unchanged',
          source: sourceColumn,
          target: targetColumn,
          changes,
        });
      }
    }

    return diffs;
  }

  /**
   * Detect specific changes in a column.
   */
  private detectColumnChanges(
    source: ColumnInfo,
    target: ColumnInfo
  ): ColumnDiff['changes'] {
    const changes: NonNullable<ColumnDiff['changes']> = {};

    // Type change
    if (source.type !== target.type) {
      changes.type = { from: source.type, to: target.type };
    }

    // Nullable change
    if (source.nullable !== target.nullable) {
      changes.nullable = { from: source.nullable, to: target.nullable };
    }

    // Default value change
    if (source.defaultValue !== target.defaultValue) {
      changes.defaultValue = {
        from: source.defaultValue,
        to: target.defaultValue,
      };
    }

    // Primary key change
    if (source.isPrimaryKey !== target.isPrimaryKey) {
      changes.isPrimaryKey = {
        from: source.isPrimaryKey,
        to: target.isPrimaryKey,
      };
    }

    return Object.keys(changes).length > 0 ? changes : undefined;
  }

  /**
   * Compare indexes between two tables.
   */
  private compareIndexes(
    sourceIndexes: IndexInfo[],
    targetIndexes: IndexInfo[]
  ): IndexDiff[] {
    const diffs: IndexDiff[] = [];

    // Create maps for efficient lookup
    const sourceMap = new Map(sourceIndexes.map((i) => [i.name, i]));
    const targetMap = new Map(targetIndexes.map((i) => [i.name, i]));

    // Get all unique index names
    const allIndexNames = new Set([
      ...sourceIndexes.map((i) => i.name),
      ...targetIndexes.map((i) => i.name),
    ]);

    for (const indexName of allIndexNames) {
      const sourceIndex = sourceMap.get(indexName);
      const targetIndex = targetMap.get(indexName);

      if (!sourceIndex && targetIndex) {
        // Index added
        diffs.push({
          name: indexName,
          diffType: 'added',
          source: null,
          target: targetIndex,
        });
      } else if (sourceIndex && !targetIndex) {
        // Index removed
        diffs.push({
          name: indexName,
          diffType: 'removed',
          source: sourceIndex,
          target: null,
        });
      } else if (sourceIndex && targetIndex) {
        // Index exists in both, check for changes
        const changes = this.detectIndexChanges(sourceIndex, targetIndex);
        const hasChanges = changes !== undefined;

        diffs.push({
          name: indexName,
          diffType: hasChanges ? 'modified' : 'unchanged',
          source: sourceIndex,
          target: targetIndex,
          changes,
        });
      }
    }

    return diffs;
  }

  /**
   * Detect specific changes in an index.
   */
  private detectIndexChanges(
    source: IndexInfo,
    target: IndexInfo
  ): IndexDiff['changes'] {
    const changes: NonNullable<IndexDiff['changes']> = {};

    // Columns change
    const sourceColumns = JSON.stringify(source.columns);
    const targetColumns = JSON.stringify(target.columns);
    if (sourceColumns !== targetColumns) {
      changes.columns = { from: source.columns, to: target.columns };
    }

    // Unique constraint change
    if (source.isUnique !== target.isUnique) {
      changes.isUnique = { from: source.isUnique, to: target.isUnique };
    }

    return Object.keys(changes).length > 0 ? changes : undefined;
  }

  /**
   * Compare foreign keys between two tables.
   */
  private compareForeignKeys(
    sourceFKs: ForeignKeyInfo[],
    targetFKs: ForeignKeyInfo[]
  ): ForeignKeyDiff[] {
    const diffs: ForeignKeyDiff[] = [];

    // Create maps for efficient lookup (use column name as key)
    const sourceMap = new Map(sourceFKs.map((fk) => [fk.column, fk]));
    const targetMap = new Map(targetFKs.map((fk) => [fk.column, fk]));

    // Get all unique FK column names
    const allFKColumns = new Set([
      ...sourceFKs.map((fk) => fk.column),
      ...targetFKs.map((fk) => fk.column),
    ]);

    for (const column of allFKColumns) {
      const sourceFk = sourceMap.get(column);
      const targetFk = targetMap.get(column);

      if (!sourceFk && targetFk) {
        // Foreign key added
        diffs.push({
          column,
          diffType: 'added',
          source: null,
          target: targetFk,
        });
      } else if (sourceFk && !targetFk) {
        // Foreign key removed
        diffs.push({
          column,
          diffType: 'removed',
          source: sourceFk,
          target: null,
        });
      } else if (sourceFk && targetFk) {
        // Foreign key exists in both, check for changes
        const changes = this.detectForeignKeyChanges(sourceFk, targetFk);
        const hasChanges = changes !== undefined;

        diffs.push({
          column,
          diffType: hasChanges ? 'modified' : 'unchanged',
          source: sourceFk,
          target: targetFk,
          changes,
        });
      }
    }

    return diffs;
  }

  /**
   * Detect specific changes in a foreign key.
   */
  private detectForeignKeyChanges(
    source: ForeignKeyInfo,
    target: ForeignKeyInfo
  ): ForeignKeyDiff['changes'] {
    const changes: NonNullable<ForeignKeyDiff['changes']> = {};

    // Referenced table change
    if (source.referencedTable !== target.referencedTable) {
      changes.referencedTable = {
        from: source.referencedTable,
        to: target.referencedTable,
      };
    }

    // Referenced column change
    if (source.referencedColumn !== target.referencedColumn) {
      changes.referencedColumn = {
        from: source.referencedColumn,
        to: target.referencedColumn,
      };
    }

    // onDelete change
    if (source.onDelete !== target.onDelete) {
      changes.onDelete = { from: source.onDelete, to: target.onDelete };
    }

    // onUpdate change
    if (source.onUpdate !== target.onUpdate) {
      changes.onUpdate = { from: source.onUpdate, to: target.onUpdate };
    }

    return Object.keys(changes).length > 0 ? changes : undefined;
  }

  /**
   * Compare triggers between two tables.
   */
  private compareTriggers(
    sourceTriggers: TriggerInfo[],
    targetTriggers: TriggerInfo[]
  ): TriggerDiff[] {
    const diffs: TriggerDiff[] = [];

    // Create maps for efficient lookup
    const sourceMap = new Map(sourceTriggers.map((t) => [t.name, t]));
    const targetMap = new Map(targetTriggers.map((t) => [t.name, t]));

    // Get all unique trigger names
    const allTriggerNames = new Set([
      ...sourceTriggers.map((t) => t.name),
      ...targetTriggers.map((t) => t.name),
    ]);

    for (const triggerName of allTriggerNames) {
      const sourceTrigger = sourceMap.get(triggerName);
      const targetTrigger = targetMap.get(triggerName);

      if (!sourceTrigger && targetTrigger) {
        // Trigger added
        diffs.push({
          name: triggerName,
          diffType: 'added',
          source: null,
          target: targetTrigger,
        });
      } else if (sourceTrigger && !targetTrigger) {
        // Trigger removed
        diffs.push({
          name: triggerName,
          diffType: 'removed',
          source: sourceTrigger,
          target: null,
        });
      } else if (sourceTrigger && targetTrigger) {
        // Trigger exists in both, check for changes
        const changes = this.detectTriggerChanges(sourceTrigger, targetTrigger);
        const hasChanges = changes !== undefined;

        diffs.push({
          name: triggerName,
          diffType: hasChanges ? 'modified' : 'unchanged',
          source: sourceTrigger,
          target: targetTrigger,
          changes,
        });
      }
    }

    return diffs;
  }

  /**
   * Detect specific changes in a trigger.
   */
  private detectTriggerChanges(
    source: TriggerInfo,
    target: TriggerInfo
  ): TriggerDiff['changes'] {
    const changes: NonNullable<TriggerDiff['changes']> = {};

    // Timing change
    if (source.timing !== target.timing) {
      changes.timing = { from: source.timing, to: target.timing };
    }

    // Event change
    if (source.event !== target.event) {
      changes.event = { from: source.event, to: target.event };
    }

    // SQL change
    if (source.sql !== target.sql) {
      changes.sql = { from: source.sql, to: target.sql };
    }

    return Object.keys(changes).length > 0 ? changes : undefined;
  }

  /**
   * Compare primary keys and return changes if any.
   */
  private comparePrimaryKeys(
    sourcePK: string[],
    targetPK: string[]
  ): { from: string[]; to: string[] } | null {
    const sourceStr = JSON.stringify(sourcePK.sort());
    const targetStr = JSON.stringify(targetPK.sort());

    if (sourceStr !== targetStr) {
      return { from: sourcePK, to: targetPK };
    }

    return null;
  }

  /**
   * Calculate summary statistics from table diffs.
   */
  private calculateSummary(
    tableDiffs: TableDiff[]
  ): SchemaComparisonResult['summary'] {
    const summary = {
      sourceTables: 0,
      targetTables: 0,
      tablesAdded: 0,
      tablesRemoved: 0,
      tablesModified: 0,
      tablesUnchanged: 0,
      totalColumnChanges: 0,
      totalIndexChanges: 0,
      totalForeignKeyChanges: 0,
      totalTriggerChanges: 0,
    };

    for (const tableDiff of tableDiffs) {
      // Count tables by type
      if (tableDiff.source) summary.sourceTables++;
      if (tableDiff.target) summary.targetTables++;

      // Count table changes
      if (tableDiff.diffType === 'added') {
        summary.tablesAdded++;
      } else if (tableDiff.diffType === 'removed') {
        summary.tablesRemoved++;
      } else if (tableDiff.diffType === 'modified') {
        summary.tablesModified++;
      } else if (tableDiff.diffType === 'unchanged') {
        summary.tablesUnchanged++;
      }

      // Count component changes
      if (tableDiff.columnDiffs) {
        summary.totalColumnChanges += tableDiff.columnDiffs.filter(
          (d) => d.diffType !== 'unchanged'
        ).length;
      }

      if (tableDiff.indexDiffs) {
        summary.totalIndexChanges += tableDiff.indexDiffs.filter(
          (d) => d.diffType !== 'unchanged'
        ).length;
      }

      if (tableDiff.foreignKeyDiffs) {
        summary.totalForeignKeyChanges += tableDiff.foreignKeyDiffs.filter(
          (d) => d.diffType !== 'unchanged'
        ).length;
      }

      if (tableDiff.triggerDiffs) {
        summary.totalTriggerChanges += tableDiff.triggerDiffs.filter(
          (d) => d.diffType !== 'unchanged'
        ).length;
      }
    }

    return summary;
  }
}

// Export singleton instance
export const schemaComparisonService = new SchemaComparisonService();

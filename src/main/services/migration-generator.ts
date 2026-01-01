import type {
  ColumnDiff,
  ColumnInfo,
  ForeignKeyDiff,
  GenerateMigrationSQLRequest,
  GenerateMigrationSQLResponse,
  IndexDiff,
  IndexInfo,
  TableDiff,
  TableInfo,
  TriggerDiff,
  TriggerInfo,
} from '../../shared/types';

/**
 * Service for generating migration SQL from schema comparison results.
 * Handles SQLite-specific limitations and dependencies between statements.
 */
class MigrationGeneratorService {
  /**
   * Generate migration SQL from a comparison result.
   * Supports forward (source -> target) and reverse (target -> source) migrations.
   */
  generateMigrationSQL(
    request: GenerateMigrationSQLRequest
  ): GenerateMigrationSQLResponse {
    try {
      const {
        comparisonResult,
        reverse = false,
        includeDropStatements = false,
      } = request;

      const statements: string[] = [];
      const warnings: string[] = [];

      // Get table diffs, potentially reversed
      const tableDiffs = reverse
        ? this.reverseTableDiffs(comparisonResult.tableDiffs)
        : comparisonResult.tableDiffs;

      // Process in dependency order:
      // 1. Drop triggers (must happen before table changes)
      // 2. Drop foreign keys (must happen before dropping columns/tables)
      // 3. Drop indexes (must happen before dropping columns)
      // 4. Drop tables (if includeDropStatements is true)
      // 5. Modify existing tables (add/modify columns)
      // 6. Create new tables
      // 7. Create indexes
      // 8. Create foreign keys
      // 9. Create triggers

      // Phase 1: Drop triggers for removed/modified tables
      for (const tableDiff of tableDiffs) {
        if (tableDiff.diffType === 'removed' && includeDropStatements) {
          // Drop all triggers from removed table
          if (tableDiff.source?.triggers) {
            for (const trigger of tableDiff.source.triggers) {
              statements.push(this.generateDropTrigger(trigger.name));
            }
          }
        } else if (
          tableDiff.diffType === 'modified' &&
          tableDiff.triggerDiffs
        ) {
          // Drop removed/modified triggers
          for (const triggerDiff of tableDiff.triggerDiffs) {
            if (triggerDiff.diffType === 'removed' && includeDropStatements) {
              statements.push(
                this.generateDropTrigger(triggerDiff.source!.name)
              );
            } else if (triggerDiff.diffType === 'modified') {
              // Drop and recreate modified triggers
              statements.push(
                this.generateDropTrigger(triggerDiff.source!.name)
              );
            }
          }
        }
      }

      // Phase 2: Drop foreign keys for removed/modified tables
      // Note: SQLite doesn't support dropping individual foreign keys
      // This would require table recreation, which we'll handle separately
      const tablesNeedingRecreation: TableDiff[] = [];

      for (const tableDiff of tableDiffs) {
        if (tableDiff.diffType === 'modified') {
          const needsRecreation = this.checkIfTableNeedsRecreation(
            tableDiff,
            includeDropStatements
          );
          if (needsRecreation) {
            tablesNeedingRecreation.push(tableDiff);
            warnings.push(
              `Table "${tableDiff.name}" requires recreation to apply changes (SQLite limitation). ` +
                `This involves creating a temporary table, copying data, and recreating the table.`
            );
          }
        }
      }

      // Phase 3: Drop indexes for removed/modified tables
      for (const tableDiff of tableDiffs) {
        if (tableDiff.diffType === 'removed' && includeDropStatements) {
          // Drop all indexes from removed table
          if (tableDiff.source?.indexes) {
            for (const index of tableDiff.source.indexes) {
              statements.push(this.generateDropIndex(index.name));
            }
          }
        } else if (tableDiff.diffType === 'modified' && tableDiff.indexDiffs) {
          // Drop removed/modified indexes
          for (const indexDiff of tableDiff.indexDiffs) {
            if (indexDiff.diffType === 'removed' && includeDropStatements) {
              statements.push(this.generateDropIndex(indexDiff.source!.name));
            } else if (indexDiff.diffType === 'modified') {
              // Drop and recreate modified indexes
              statements.push(this.generateDropIndex(indexDiff.source!.name));
            }
          }
        }
      }

      // Phase 4: Drop removed tables
      if (includeDropStatements) {
        for (const tableDiff of tableDiffs) {
          if (tableDiff.diffType === 'removed') {
            statements.push(
              this.generateDropTable(
                tableDiff.source!.name,
                tableDiff.source!.schema
              )
            );
            warnings.push(
              `Dropping table "${tableDiff.name}" will permanently delete all data. ` +
                `Make sure to backup data before running this migration.`
            );
          }
        }
      }

      // Phase 5: Modify existing tables (add columns only - SQLite limitation)
      for (const tableDiff of tableDiffs) {
        if (
          tableDiff.diffType === 'modified' &&
          !tablesNeedingRecreation.includes(tableDiff)
        ) {
          if (tableDiff.columnDiffs) {
            for (const columnDiff of tableDiff.columnDiffs) {
              if (columnDiff.diffType === 'added') {
                statements.push(
                  this.generateAddColumn(
                    tableDiff.name,
                    columnDiff.target!,
                    tableDiff.schema
                  )
                );
              } else if (
                columnDiff.diffType === 'removed' &&
                includeDropStatements
              ) {
                warnings.push(
                  `Cannot drop column "${columnDiff.name}" from table "${tableDiff.name}" - ` +
                    `SQLite does not support ALTER TABLE DROP COLUMN. Table recreation required.`
                );
              } else if (columnDiff.diffType === 'modified') {
                warnings.push(
                  `Cannot modify column "${columnDiff.name}" in table "${tableDiff.name}" - ` +
                    `SQLite does not support ALTER TABLE MODIFY COLUMN. Table recreation required.`
                );
              }
            }
          }
        }
      }

      // Phase 6: Recreate tables that need it (for complex changes)
      for (const tableDiff of tablesNeedingRecreation) {
        const recreationStatements = this.generateTableRecreation(
          tableDiff,
          includeDropStatements
        );
        statements.push(...recreationStatements);
      }

      // Phase 7: Create new tables
      for (const tableDiff of tableDiffs) {
        if (tableDiff.diffType === 'added') {
          statements.push(this.generateCreateTable(tableDiff.target!));
        }
      }

      // Phase 8: Create new indexes
      for (const tableDiff of tableDiffs) {
        if (tableDiff.diffType === 'added') {
          // Create all indexes for new table
          if (tableDiff.target?.indexes) {
            for (const index of tableDiff.target.indexes) {
              statements.push(this.generateCreateIndex(index));
            }
          }
        } else if (
          tableDiff.diffType === 'modified' &&
          tableDiff.indexDiffs &&
          !tablesNeedingRecreation.includes(tableDiff)
        ) {
          // Create new/modified indexes for existing table
          for (const indexDiff of tableDiff.indexDiffs) {
            if (
              indexDiff.diffType === 'added' ||
              indexDiff.diffType === 'modified'
            ) {
              statements.push(this.generateCreateIndex(indexDiff.target!));
            }
          }
        }
      }

      // Phase 9: Create new triggers
      for (const tableDiff of tableDiffs) {
        if (tableDiff.diffType === 'added') {
          // Create all triggers for new table
          if (tableDiff.target?.triggers) {
            for (const trigger of tableDiff.target.triggers) {
              statements.push(this.generateCreateTrigger(trigger));
            }
          }
        } else if (
          tableDiff.diffType === 'modified' &&
          tableDiff.triggerDiffs
        ) {
          // Create new/modified triggers for existing table
          for (const triggerDiff of tableDiff.triggerDiffs) {
            if (
              triggerDiff.diffType === 'added' ||
              triggerDiff.diffType === 'modified'
            ) {
              statements.push(this.generateCreateTrigger(triggerDiff.target!));
            }
          }
        }
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
            : 'Unknown error generating migration SQL',
      };
    }
  }

  /**
   * Reverse table diffs to generate a migration from target back to source.
   */
  private reverseTableDiffs(tableDiffs: TableDiff[]): TableDiff[] {
    return tableDiffs.map((tableDiff) => {
      // Swap source and target
      const reversed: TableDiff = {
        ...tableDiff,
        source: tableDiff.target,
        target: tableDiff.source,
        diffType:
          tableDiff.diffType === 'added'
            ? 'removed'
            : tableDiff.diffType === 'removed'
              ? 'added'
              : tableDiff.diffType,
      };

      // Reverse nested diffs
      if (tableDiff.columnDiffs) {
        reversed.columnDiffs = this.reverseColumnDiffs(tableDiff.columnDiffs);
      }
      if (tableDiff.indexDiffs) {
        reversed.indexDiffs = this.reverseIndexDiffs(tableDiff.indexDiffs);
      }
      if (tableDiff.foreignKeyDiffs) {
        reversed.foreignKeyDiffs = this.reverseForeignKeyDiffs(
          tableDiff.foreignKeyDiffs
        );
      }
      if (tableDiff.triggerDiffs) {
        reversed.triggerDiffs = this.reverseTriggerDiffs(
          tableDiff.triggerDiffs
        );
      }
      if (tableDiff.primaryKeyChanges) {
        reversed.primaryKeyChanges = {
          from: tableDiff.primaryKeyChanges.to,
          to: tableDiff.primaryKeyChanges.from,
        };
      }

      return reversed;
    });
  }

  /**
   * Reverse column diffs.
   */
  private reverseColumnDiffs(columnDiffs: ColumnDiff[]): ColumnDiff[] {
    return columnDiffs.map((diff) => ({
      ...diff,
      source: diff.target,
      target: diff.source,
      diffType:
        diff.diffType === 'added'
          ? 'removed'
          : diff.diffType === 'removed'
            ? 'added'
            : diff.diffType,
      changes: diff.changes
        ? {
            type: diff.changes.type
              ? { from: diff.changes.type.to, to: diff.changes.type.from }
              : undefined,
            nullable: diff.changes.nullable
              ? {
                  from: diff.changes.nullable.to,
                  to: diff.changes.nullable.from,
                }
              : undefined,
            defaultValue: diff.changes.defaultValue
              ? {
                  from: diff.changes.defaultValue.to,
                  to: diff.changes.defaultValue.from,
                }
              : undefined,
            isPrimaryKey: diff.changes.isPrimaryKey
              ? {
                  from: diff.changes.isPrimaryKey.to,
                  to: diff.changes.isPrimaryKey.from,
                }
              : undefined,
          }
        : undefined,
    }));
  }

  /**
   * Reverse index diffs.
   */
  private reverseIndexDiffs(indexDiffs: IndexDiff[]): IndexDiff[] {
    return indexDiffs.map((diff) => ({
      ...diff,
      source: diff.target,
      target: diff.source,
      diffType:
        diff.diffType === 'added'
          ? 'removed'
          : diff.diffType === 'removed'
            ? 'added'
            : diff.diffType,
      changes: diff.changes
        ? {
            columns: diff.changes.columns
              ? { from: diff.changes.columns.to, to: diff.changes.columns.from }
              : undefined,
            isUnique: diff.changes.isUnique
              ? {
                  from: diff.changes.isUnique.to,
                  to: diff.changes.isUnique.from,
                }
              : undefined,
          }
        : undefined,
    }));
  }

  /**
   * Reverse foreign key diffs.
   */
  private reverseForeignKeyDiffs(
    foreignKeyDiffs: ForeignKeyDiff[]
  ): ForeignKeyDiff[] {
    return foreignKeyDiffs.map((diff) => ({
      ...diff,
      source: diff.target,
      target: diff.source,
      diffType:
        diff.diffType === 'added'
          ? 'removed'
          : diff.diffType === 'removed'
            ? 'added'
            : diff.diffType,
      changes: diff.changes
        ? {
            referencedTable: diff.changes.referencedTable
              ? {
                  from: diff.changes.referencedTable.to,
                  to: diff.changes.referencedTable.from,
                }
              : undefined,
            referencedColumn: diff.changes.referencedColumn
              ? {
                  from: diff.changes.referencedColumn.to,
                  to: diff.changes.referencedColumn.from,
                }
              : undefined,
            onDelete: diff.changes.onDelete
              ? {
                  from: diff.changes.onDelete.to,
                  to: diff.changes.onDelete.from,
                }
              : undefined,
            onUpdate: diff.changes.onUpdate
              ? {
                  from: diff.changes.onUpdate.to,
                  to: diff.changes.onUpdate.from,
                }
              : undefined,
          }
        : undefined,
    }));
  }

  /**
   * Reverse trigger diffs.
   */
  private reverseTriggerDiffs(triggerDiffs: TriggerDiff[]): TriggerDiff[] {
    return triggerDiffs.map((diff) => ({
      ...diff,
      source: diff.target,
      target: diff.source,
      diffType:
        diff.diffType === 'added'
          ? 'removed'
          : diff.diffType === 'removed'
            ? 'added'
            : diff.diffType,
      changes: diff.changes
        ? {
            timing: diff.changes.timing
              ? { from: diff.changes.timing.to, to: diff.changes.timing.from }
              : undefined,
            event: diff.changes.event
              ? { from: diff.changes.event.to, to: diff.changes.event.from }
              : undefined,
            sql: diff.changes.sql
              ? { from: diff.changes.sql.to, to: diff.changes.sql.from }
              : undefined,
          }
        : undefined,
    }));
  }

  /**
   * Check if a table needs recreation due to SQLite limitations.
   * Returns true if changes require recreating the table.
   */
  private checkIfTableNeedsRecreation(
    tableDiff: TableDiff,
    includeDropStatements: boolean
  ): boolean {
    // Check if any columns need to be removed (requires recreation)
    if (
      includeDropStatements &&
      tableDiff.columnDiffs?.some((d) => d.diffType === 'removed')
    ) {
      return true;
    }

    // Check if any columns need to be modified (requires recreation)
    if (tableDiff.columnDiffs?.some((d) => d.diffType === 'modified')) {
      return true;
    }

    // Check if primary key changed (requires recreation)
    if (tableDiff.primaryKeyChanges) {
      return true;
    }

    // Check if foreign keys changed (requires recreation)
    if (
      tableDiff.foreignKeyDiffs?.some(
        (d) => d.diffType === 'removed' || d.diffType === 'modified'
      )
    ) {
      return true;
    }

    return false;
  }

  /**
   * Generate SQL to recreate a table with changes.
   * This is necessary for SQLite when dropping/modifying columns or changing constraints.
   */
  private generateTableRecreation(
    tableDiff: TableDiff,
    _includeDropStatements: boolean
  ): string[] {
    const statements: string[] = [];
    const tableName = tableDiff.name;
    const schema = tableDiff.schema;
    const tempTableName = `${tableName}_new`;
    const fullTableName =
      schema && schema !== 'main' ? `${schema}.${tableName}` : tableName;
    const fullTempTableName =
      schema && schema !== 'main'
        ? `${schema}.${tempTableName}`
        : tempTableName;

    // Get target table structure (what we want to end up with)
    const targetTable = tableDiff.target;
    if (!targetTable) {
      return statements;
    }

    // Step 1: Create new table with target structure
    statements.push(this.generateCreateTable(targetTable, tempTableName));

    // Step 2: Copy data from old table to new table
    // Get list of columns that exist in both source and target
    const sourceColumns = new Set(
      tableDiff.source?.columns.map((c) => c.name) || []
    );
    const targetColumns = targetTable.columns.map((c) => c.name);
    const commonColumns = targetColumns.filter((col) => sourceColumns.has(col));

    if (commonColumns.length > 0) {
      const columnList = commonColumns.join(', ');
      statements.push(
        `INSERT INTO ${fullTempTableName} (${columnList}) SELECT ${columnList} FROM ${fullTableName}`
      );
    }

    // Step 3: Drop old table
    statements.push(`DROP TABLE ${fullTableName}`);

    // Step 4: Rename new table to original name
    statements.push(`ALTER TABLE ${fullTempTableName} RENAME TO ${tableName}`);

    return statements;
  }

  /**
   * Generate CREATE TABLE statement from table info.
   */
  private generateCreateTable(table: TableInfo, tableName?: string): string {
    const name = tableName || table.name;
    const fullTableName =
      table.schema && table.schema !== 'main'
        ? `${table.schema}.${name}`
        : name;

    const columnDefs: string[] = [];

    // Add columns
    for (const column of table.columns) {
      columnDefs.push(this.generateColumnDefinition(column));
    }

    // Add primary key constraint if composite
    if (table.primaryKey.length > 1) {
      columnDefs.push(`PRIMARY KEY (${table.primaryKey.join(', ')})`);
    }

    // Add foreign key constraints
    for (const fk of table.foreignKeys) {
      const onDelete = fk.onDelete ? ` ON DELETE ${fk.onDelete}` : '';
      const onUpdate = fk.onUpdate ? ` ON UPDATE ${fk.onUpdate}` : '';
      columnDefs.push(
        `FOREIGN KEY (${fk.column}) REFERENCES ${fk.referencedTable}(${fk.referencedColumn})${onDelete}${onUpdate}`
      );
    }

    return `CREATE TABLE ${fullTableName} (\n  ${columnDefs.join(',\n  ')}\n)`;
  }

  /**
   * Generate column definition for CREATE TABLE or ALTER TABLE ADD COLUMN.
   */
  private generateColumnDefinition(column: ColumnInfo): string {
    let def = column.name;

    // Add type
    def += ` ${column.type}`;

    // Add primary key if single column
    if (column.isPrimaryKey) {
      def += ' PRIMARY KEY';
    }

    // Add NOT NULL constraint
    if (!column.nullable) {
      def += ' NOT NULL';
    }

    // Add default value
    if (column.defaultValue !== null) {
      def += ` DEFAULT ${column.defaultValue}`;
    }

    return def;
  }

  /**
   * Generate DROP TABLE statement.
   */
  private generateDropTable(tableName: string, schema: string): string {
    const fullTableName =
      schema && schema !== 'main' ? `${schema}.${tableName}` : tableName;
    return `DROP TABLE ${fullTableName}`;
  }

  /**
   * Generate ALTER TABLE ADD COLUMN statement.
   */
  private generateAddColumn(
    tableName: string,
    column: ColumnInfo,
    schema: string
  ): string {
    const fullTableName =
      schema && schema !== 'main' ? `${schema}.${tableName}` : tableName;
    return `ALTER TABLE ${fullTableName} ADD COLUMN ${this.generateColumnDefinition(column)}`;
  }

  /**
   * Generate CREATE INDEX statement.
   */
  private generateCreateIndex(index: IndexInfo): string {
    // If we have the original SQL, use it
    if (index.sql && index.sql.trim()) {
      return index.sql;
    }

    // Otherwise construct it
    const unique = index.isUnique ? 'UNIQUE ' : '';
    const columns = index.columns.join(', ');
    return `CREATE ${unique}INDEX ${index.name} ON ${index.columns[0]} (${columns})`;
  }

  /**
   * Generate DROP INDEX statement.
   */
  private generateDropIndex(indexName: string): string {
    return `DROP INDEX ${indexName}`;
  }

  /**
   * Generate CREATE TRIGGER statement.
   */
  private generateCreateTrigger(trigger: TriggerInfo): string {
    // If we have the original SQL, use it
    if (trigger.sql && trigger.sql.trim()) {
      return trigger.sql;
    }

    // Otherwise construct it (basic form - may not capture all trigger logic)
    return `CREATE TRIGGER ${trigger.name} ${trigger.timing} ${trigger.event} ON ${trigger.tableName} BEGIN /* TODO: Add trigger body */ END`;
  }

  /**
   * Generate DROP TRIGGER statement.
   */
  private generateDropTrigger(triggerName: string): string {
    return `DROP TRIGGER ${triggerName}`;
  }
}

// Export singleton instance
export const migrationGeneratorService = new MigrationGeneratorService();

import type {
  ColumnInfo,
  ForeignKeyInfo,
  IndexInfo,
  SchemaComparisonResult,
  TableDiff,
  TableInfo,
  TriggerInfo,
} from '@shared/types';
/**
 * Unit tests for MigrationGeneratorService
 * Tests migration SQL generation including CREATE/DROP statements and SQLite limitations
 */
import { describe, expect, it } from 'vitest';
import { migrationGeneratorService } from './migration-generator';

describe('migrationGeneratorService', () => {
  // Helper function to create a basic column
  const createColumn = (
    name: string,
    type = 'TEXT',
    nullable = true,
    isPrimaryKey = false,
    defaultValue: string | null = null
  ): ColumnInfo => ({
    name,
    type,
    nullable,
    isPrimaryKey,
    defaultValue,
  });

  // Helper function to create a basic table
  const createTable = (
    name: string,
    schema = 'main',
    columns: ColumnInfo[] = [],
    indexes: IndexInfo[] = [],
    foreignKeys: ForeignKeyInfo[] = [],
    triggers: TriggerInfo[] = [],
    primaryKey: string[] = [],
    sql = ''
  ): TableInfo => ({
    name,
    schema,
    type: 'table',
    columns,
    indexes,
    foreignKeys,
    triggers,
    primaryKey,
    sql,
  });

  // Helper function to create comparison result
  const createComparisonResult = (
    tableDiffs: TableDiff[]
  ): SchemaComparisonResult => ({
    sourceId: 'source-id',
    sourceName: 'Source',
    sourceType: 'connection',
    targetId: 'target-id',
    targetName: 'Target',
    targetType: 'connection',
    comparedAt: new Date().toISOString(),
    tableDiffs,
    summary: {
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
    },
  });

  describe('generateMigrationSQL - CREATE TABLE', () => {
    it('should generate CREATE TABLE for added tables', () => {
      const tableDiff: TableDiff = {
        name: 'users',
        schema: 'main',
        diffType: 'added',
        source: null,
        target: createTable('users', 'main', [
          createColumn('id', 'INTEGER', false, true),
          createColumn('name', 'TEXT', false),
          createColumn('email', 'TEXT', true),
        ]),
      };

      const result = migrationGeneratorService.generateMigrationSQL({
        comparisonResult: createComparisonResult([tableDiff]),
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('CREATE TABLE users');
      expect(result.sql).toContain('id INTEGER PRIMARY KEY NOT NULL');
      expect(result.sql).toContain('name TEXT NOT NULL');
      expect(result.sql).toContain('email TEXT');
      expect(result.statements).toHaveLength(1);
    });

    it('should generate CREATE TABLE with composite primary key', () => {
      const tableDiff: TableDiff = {
        name: 'order_items',
        schema: 'main',
        diffType: 'added',
        source: null,
        target: createTable(
          'order_items',
          'main',
          [
            createColumn('order_id', 'INTEGER', false),
            createColumn('item_id', 'INTEGER', false),
            createColumn('quantity', 'INTEGER', false),
          ],
          [],
          [],
          [],
          ['order_id', 'item_id']
        ),
      };

      const result = migrationGeneratorService.generateMigrationSQL({
        comparisonResult: createComparisonResult([tableDiff]),
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('CREATE TABLE order_items');
      expect(result.sql).toContain('PRIMARY KEY (order_id, item_id)');
    });

    it('should generate CREATE TABLE with foreign keys', () => {
      const tableDiff: TableDiff = {
        name: 'orders',
        schema: 'main',
        diffType: 'added',
        source: null,
        target: createTable(
          'orders',
          'main',
          [
            createColumn('id', 'INTEGER', false, true),
            createColumn('user_id', 'INTEGER'),
          ],
          [],
          [
            {
              column: 'user_id',
              referencedTable: 'users',
              referencedColumn: 'id',
              onDelete: 'CASCADE',
              onUpdate: 'CASCADE',
            },
          ]
        ),
      };

      const result = migrationGeneratorService.generateMigrationSQL({
        comparisonResult: createComparisonResult([tableDiff]),
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('CREATE TABLE orders');
      expect(result.sql).toContain(
        'FOREIGN KEY (user_id) REFERENCES users(id)'
      );
      expect(result.sql).toContain('ON DELETE CASCADE');
      expect(result.sql).toContain('ON UPDATE CASCADE');
    });

    it('should generate CREATE TABLE with default values', () => {
      const tableDiff: TableDiff = {
        name: 'users',
        schema: 'main',
        diffType: 'added',
        source: null,
        target: createTable('users', 'main', [
          createColumn('id', 'INTEGER', false, true),
          createColumn('status', 'TEXT', true, false, "'active'"),
          createColumn('created_at', 'TEXT', true, false, 'CURRENT_TIMESTAMP'),
        ]),
      };

      const result = migrationGeneratorService.generateMigrationSQL({
        comparisonResult: createComparisonResult([tableDiff]),
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain("status TEXT DEFAULT 'active'");
      expect(result.sql).toContain('created_at TEXT DEFAULT CURRENT_TIMESTAMP');
    });
  });

  describe('generateMigrationSQL - DROP TABLE', () => {
    it('should generate DROP TABLE for removed tables when includeDropStatements is true', () => {
      const tableDiff: TableDiff = {
        name: 'old_table',
        schema: 'main',
        diffType: 'removed',
        source: createTable('old_table', 'main', [
          createColumn('id', 'INTEGER'),
        ]),
        target: null,
      };

      const result = migrationGeneratorService.generateMigrationSQL({
        comparisonResult: createComparisonResult([tableDiff]),
        includeDropStatements: true,
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('DROP TABLE old_table');
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings![0]).toContain(
        'Dropping table "old_table" will permanently delete all data'
      );
      expect(result.warnings![0]).toContain(
        'Make sure to backup data before running this migration'
      );
    });

    it('should not generate DROP TABLE when includeDropStatements is false', () => {
      const tableDiff: TableDiff = {
        name: 'old_table',
        schema: 'main',
        diffType: 'removed',
        source: createTable('old_table', 'main', [
          createColumn('id', 'INTEGER'),
        ]),
        target: null,
      };

      const result = migrationGeneratorService.generateMigrationSQL({
        comparisonResult: createComparisonResult([tableDiff]),
        includeDropStatements: false,
      });

      expect(result.success).toBe(true);
      expect(result.sql).not.toContain('DROP TABLE');
    });
  });

  describe('generateMigrationSQL - ALTER TABLE ADD COLUMN', () => {
    it('should generate ALTER TABLE ADD COLUMN for added columns', () => {
      const tableDiff: TableDiff = {
        name: 'users',
        schema: 'main',
        diffType: 'modified',
        source: createTable('users', 'main', [
          createColumn('id', 'INTEGER', false, true),
        ]),
        target: createTable('users', 'main', [
          createColumn('id', 'INTEGER', false, true),
          createColumn('email', 'TEXT'),
        ]),
        columnDiffs: [
          {
            name: 'id',
            diffType: 'unchanged',
            source: createColumn('id', 'INTEGER', false, true),
            target: createColumn('id', 'INTEGER', false, true),
          },
          {
            name: 'email',
            diffType: 'added',
            source: null,
            target: createColumn('email', 'TEXT'),
          },
        ],
      };

      const result = migrationGeneratorService.generateMigrationSQL({
        comparisonResult: createComparisonResult([tableDiff]),
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('ALTER TABLE users ADD COLUMN email TEXT');
    });

    it('should generate ALTER TABLE ADD COLUMN with NOT NULL and DEFAULT', () => {
      const tableDiff: TableDiff = {
        name: 'users',
        schema: 'main',
        diffType: 'modified',
        source: createTable('users', 'main', [
          createColumn('id', 'INTEGER', false, true),
        ]),
        target: createTable('users', 'main', [
          createColumn('id', 'INTEGER', false, true),
          createColumn('status', 'TEXT', false, false, "'active'"),
        ]),
        columnDiffs: [
          {
            name: 'id',
            diffType: 'unchanged',
            source: createColumn('id', 'INTEGER', false, true),
            target: createColumn('id', 'INTEGER', false, true),
          },
          {
            name: 'status',
            diffType: 'added',
            source: null,
            target: createColumn('status', 'TEXT', false, false, "'active'"),
          },
        ],
      };

      const result = migrationGeneratorService.generateMigrationSQL({
        comparisonResult: createComparisonResult([tableDiff]),
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain(
        "ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'"
      );
    });
  });

  describe('generateMigrationSQL - Index Operations', () => {
    it('should generate CREATE INDEX for added indexes', () => {
      const tableDiff: TableDiff = {
        name: 'users',
        schema: 'main',
        diffType: 'modified',
        source: createTable('users', 'main', [createColumn('email', 'TEXT')]),
        target: createTable('users', 'main', [createColumn('email', 'TEXT')]),
        indexDiffs: [
          {
            name: 'idx_users_email',
            diffType: 'added',
            source: null,
            target: {
              name: 'idx_users_email',
              columns: ['email'],
              isUnique: true,
              sql: 'CREATE UNIQUE INDEX idx_users_email ON users(email)',
            },
          },
        ],
      };

      const result = migrationGeneratorService.generateMigrationSQL({
        comparisonResult: createComparisonResult([tableDiff]),
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain(
        'CREATE UNIQUE INDEX idx_users_email ON users(email)'
      );
    });

    it('should generate DROP INDEX for removed indexes when includeDropStatements is true', () => {
      const tableDiff: TableDiff = {
        name: 'users',
        schema: 'main',
        diffType: 'modified',
        source: createTable('users', 'main', [createColumn('email', 'TEXT')]),
        target: createTable('users', 'main', [createColumn('email', 'TEXT')]),
        indexDiffs: [
          {
            name: 'idx_old',
            diffType: 'removed',
            source: {
              name: 'idx_old',
              columns: ['email'],
              isUnique: false,
              sql: 'CREATE INDEX idx_old ON users(email)',
            },
            target: null,
          },
        ],
      };

      const result = migrationGeneratorService.generateMigrationSQL({
        comparisonResult: createComparisonResult([tableDiff]),
        includeDropStatements: true,
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('DROP INDEX idx_old');
    });

    it('should drop and recreate modified indexes', () => {
      const tableDiff: TableDiff = {
        name: 'users',
        schema: 'main',
        diffType: 'modified',
        source: createTable('users', 'main', [createColumn('email', 'TEXT')]),
        target: createTable('users', 'main', [createColumn('email', 'TEXT')]),
        indexDiffs: [
          {
            name: 'idx_users_email',
            diffType: 'modified',
            source: {
              name: 'idx_users_email',
              columns: ['email'],
              isUnique: false,
              sql: 'CREATE INDEX idx_users_email ON users(email)',
            },
            target: {
              name: 'idx_users_email',
              columns: ['email'],
              isUnique: true,
              sql: 'CREATE UNIQUE INDEX idx_users_email ON users(email)',
            },
          },
        ],
      };

      const result = migrationGeneratorService.generateMigrationSQL({
        comparisonResult: createComparisonResult([tableDiff]),
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('DROP INDEX idx_users_email');
      expect(result.sql).toContain(
        'CREATE UNIQUE INDEX idx_users_email ON users(email)'
      );
    });
  });

  describe('generateMigrationSQL - Trigger Operations', () => {
    it('should generate CREATE TRIGGER for added triggers', () => {
      const tableDiff: TableDiff = {
        name: 'users',
        schema: 'main',
        diffType: 'modified',
        source: createTable('users', 'main', [createColumn('id', 'INTEGER')]),
        target: createTable('users', 'main', [createColumn('id', 'INTEGER')]),
        triggerDiffs: [
          {
            name: 'tr_audit',
            diffType: 'added',
            source: null,
            target: {
              name: 'tr_audit',
              tableName: 'users',
              timing: 'AFTER',
              event: 'INSERT',
              sql: 'CREATE TRIGGER tr_audit AFTER INSERT ON users BEGIN ...',
            },
          },
        ],
      };

      const result = migrationGeneratorService.generateMigrationSQL({
        comparisonResult: createComparisonResult([tableDiff]),
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain(
        'CREATE TRIGGER tr_audit AFTER INSERT ON users BEGIN ...'
      );
    });

    it('should generate DROP TRIGGER for removed triggers when includeDropStatements is true', () => {
      const tableDiff: TableDiff = {
        name: 'users',
        schema: 'main',
        diffType: 'modified',
        source: createTable('users', 'main', [createColumn('id', 'INTEGER')]),
        target: createTable('users', 'main', [createColumn('id', 'INTEGER')]),
        triggerDiffs: [
          {
            name: 'tr_old',
            diffType: 'removed',
            source: {
              name: 'tr_old',
              tableName: 'users',
              timing: 'BEFORE',
              event: 'UPDATE',
              sql: 'CREATE TRIGGER tr_old BEFORE UPDATE ON users BEGIN ...',
            },
            target: null,
          },
        ],
      };

      const result = migrationGeneratorService.generateMigrationSQL({
        comparisonResult: createComparisonResult([tableDiff]),
        includeDropStatements: true,
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('DROP TRIGGER tr_old');
    });
  });

  describe('generateMigrationSQL - SQLite Limitations', () => {
    it('should warn about column removal requiring table recreation', () => {
      const tableDiff: TableDiff = {
        name: 'users',
        schema: 'main',
        diffType: 'modified',
        source: createTable('users', 'main', [
          createColumn('id', 'INTEGER', false, true),
          createColumn('old_column', 'TEXT'),
        ]),
        target: createTable('users', 'main', [
          createColumn('id', 'INTEGER', false, true),
        ]),
        columnDiffs: [
          {
            name: 'id',
            diffType: 'unchanged',
            source: createColumn('id', 'INTEGER', false, true),
            target: createColumn('id', 'INTEGER', false, true),
          },
          {
            name: 'old_column',
            diffType: 'removed',
            source: createColumn('old_column', 'TEXT'),
            target: null,
          },
        ],
      };

      const result = migrationGeneratorService.generateMigrationSQL({
        comparisonResult: createComparisonResult([tableDiff]),
        includeDropStatements: true,
      });

      expect(result.success).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings![0]).toContain(
        'Table "users" requires recreation'
      );
      expect(result.warnings![0]).toContain('SQLite limitation');
    });

    it('should warn about column modification requiring table recreation', () => {
      const tableDiff: TableDiff = {
        name: 'users',
        schema: 'main',
        diffType: 'modified',
        source: createTable('users', 'main', [createColumn('age', 'TEXT')]),
        target: createTable('users', 'main', [createColumn('age', 'INTEGER')]),
        columnDiffs: [
          {
            name: 'age',
            diffType: 'modified',
            source: createColumn('age', 'TEXT'),
            target: createColumn('age', 'INTEGER'),
            changes: {
              type: { from: 'TEXT', to: 'INTEGER' },
            },
          },
        ],
      };

      const result = migrationGeneratorService.generateMigrationSQL({
        comparisonResult: createComparisonResult([tableDiff]),
      });

      expect(result.success).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings![0]).toContain(
        'Table "users" requires recreation'
      );
    });

    it('should generate table recreation statements for column removal', () => {
      const tableDiff: TableDiff = {
        name: 'users',
        schema: 'main',
        diffType: 'modified',
        source: createTable('users', 'main', [
          createColumn('id', 'INTEGER', false, true),
          createColumn('old_column', 'TEXT'),
          createColumn('name', 'TEXT'),
        ]),
        target: createTable('users', 'main', [
          createColumn('id', 'INTEGER', false, true),
          createColumn('name', 'TEXT'),
        ]),
        columnDiffs: [
          {
            name: 'id',
            diffType: 'unchanged',
            source: createColumn('id', 'INTEGER', false, true),
            target: createColumn('id', 'INTEGER', false, true),
          },
          {
            name: 'old_column',
            diffType: 'removed',
            source: createColumn('old_column', 'TEXT'),
            target: null,
          },
          {
            name: 'name',
            diffType: 'unchanged',
            source: createColumn('name', 'TEXT'),
            target: createColumn('name', 'TEXT'),
          },
        ],
      };

      const result = migrationGeneratorService.generateMigrationSQL({
        comparisonResult: createComparisonResult([tableDiff]),
        includeDropStatements: true,
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('CREATE TABLE users_new');
      expect(result.sql).toContain(
        'INSERT INTO users_new (id, name) SELECT id, name FROM users'
      );
      expect(result.sql).toContain('DROP TABLE users');
      expect(result.sql).toContain('ALTER TABLE users_new RENAME TO users');
    });
  });

  describe('generateMigrationSQL - Reverse Migrations', () => {
    it('should generate reverse migration for added tables', () => {
      const tableDiff: TableDiff = {
        name: 'users',
        schema: 'main',
        diffType: 'added',
        source: null,
        target: createTable('users', 'main', [
          createColumn('id', 'INTEGER', false, true),
        ]),
      };

      const result = migrationGeneratorService.generateMigrationSQL({
        comparisonResult: createComparisonResult([tableDiff]),
        reverse: true,
        includeDropStatements: true,
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('DROP TABLE users');
    });

    it('should generate reverse migration for removed tables', () => {
      const tableDiff: TableDiff = {
        name: 'users',
        schema: 'main',
        diffType: 'removed',
        source: createTable('users', 'main', [
          createColumn('id', 'INTEGER', false, true),
          createColumn('name', 'TEXT'),
        ]),
        target: null,
      };

      const result = migrationGeneratorService.generateMigrationSQL({
        comparisonResult: createComparisonResult([tableDiff]),
        reverse: true,
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('CREATE TABLE users');
      expect(result.sql).toContain('id INTEGER PRIMARY KEY NOT NULL');
      expect(result.sql).toContain('name TEXT');
    });

    it('should generate reverse migration for added columns', () => {
      const tableDiff: TableDiff = {
        name: 'users',
        schema: 'main',
        diffType: 'modified',
        source: createTable('users', 'main', [
          createColumn('id', 'INTEGER', false, true),
        ]),
        target: createTable('users', 'main', [
          createColumn('id', 'INTEGER', false, true),
          createColumn('email', 'TEXT'),
        ]),
        columnDiffs: [
          {
            name: 'id',
            diffType: 'unchanged',
            source: createColumn('id', 'INTEGER', false, true),
            target: createColumn('id', 'INTEGER', false, true),
          },
          {
            name: 'email',
            diffType: 'added',
            source: null,
            target: createColumn('email', 'TEXT'),
          },
        ],
      };

      const result = migrationGeneratorService.generateMigrationSQL({
        comparisonResult: createComparisonResult([tableDiff]),
        reverse: true,
        includeDropStatements: true,
      });

      expect(result.success).toBe(true);
      // Reverse migration should recreate table without the email column
      expect(result.sql).toContain('users_new');
    });
  });

  describe('generateMigrationSQL - Statement Ordering', () => {
    it('should order statements correctly for dependencies', () => {
      const tableDiffs: TableDiff[] = [
        // Add a table with indexes and triggers
        {
          name: 'users',
          schema: 'main',
          diffType: 'added',
          source: null,
          target: createTable(
            'users',
            'main',
            [
              createColumn('id', 'INTEGER', false, true),
              createColumn('email', 'TEXT'),
            ],
            [
              {
                name: 'idx_users_email',
                columns: ['email'],
                isUnique: true,
                sql: 'CREATE UNIQUE INDEX idx_users_email ON users(email)',
              },
            ],
            [],
            [
              {
                name: 'tr_users_audit',
                tableName: 'users',
                timing: 'AFTER',
                event: 'INSERT',
                sql: 'CREATE TRIGGER tr_users_audit AFTER INSERT ON users BEGIN ...',
              },
            ]
          ),
        },
      ];

      const result = migrationGeneratorService.generateMigrationSQL({
        comparisonResult: createComparisonResult(tableDiffs),
      });

      expect(result.success).toBe(true);
      const sql = result.sql!;

      // Tables should be created before indexes and triggers
      const tablePos = sql.indexOf('CREATE TABLE users');
      const indexPos = sql.indexOf('CREATE UNIQUE INDEX idx_users_email');
      const triggerPos = sql.indexOf('CREATE TRIGGER tr_users_audit');

      expect(tablePos).toBeLessThan(indexPos);
      expect(tablePos).toBeLessThan(triggerPos);
      expect(indexPos).toBeLessThan(triggerPos);
    });
  });

  describe('generateMigrationSQL - Edge Cases', () => {
    it('should handle empty comparison result', () => {
      const result = migrationGeneratorService.generateMigrationSQL({
        comparisonResult: createComparisonResult([]),
      });

      expect(result.success).toBe(true);
      expect(result.sql).toBe('');
      expect(result.statements).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should handle comparison with no changes', () => {
      const tableDiff: TableDiff = {
        name: 'users',
        schema: 'main',
        diffType: 'unchanged',
        source: createTable('users', 'main', [
          createColumn('id', 'INTEGER', false, true),
        ]),
        target: createTable('users', 'main', [
          createColumn('id', 'INTEGER', false, true),
        ]),
      };

      const result = migrationGeneratorService.generateMigrationSQL({
        comparisonResult: createComparisonResult([tableDiff]),
      });

      expect(result.success).toBe(true);
      expect(result.sql).toBe('');
      expect(result.statements).toHaveLength(0);
    });

    it('should handle schema prefix correctly', () => {
      const tableDiff: TableDiff = {
        name: 'users',
        schema: 'temp',
        diffType: 'added',
        source: null,
        target: createTable('users', 'temp', [
          createColumn('id', 'INTEGER', false, true),
        ]),
      };

      const result = migrationGeneratorService.generateMigrationSQL({
        comparisonResult: createComparisonResult([tableDiff]),
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('CREATE TABLE temp.users');
    });

    it('should not use schema prefix for main schema', () => {
      const tableDiff: TableDiff = {
        name: 'users',
        schema: 'main',
        diffType: 'added',
        source: null,
        target: createTable('users', 'main', [
          createColumn('id', 'INTEGER', false, true),
        ]),
      };

      const result = migrationGeneratorService.generateMigrationSQL({
        comparisonResult: createComparisonResult([tableDiff]),
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('CREATE TABLE users');
      expect(result.sql).not.toContain('CREATE TABLE main.users');
    });

    it('should return error response on exception', () => {
      // Create an invalid comparison result that will cause an error
      const invalidResult = {
        ...createComparisonResult([]),
        tableDiffs: null as any, // Force an error
      };

      const result = migrationGeneratorService.generateMigrationSQL({
        comparisonResult: invalidResult,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
    });
  });

  describe('generateMigrationSQL - Complex Scenarios', () => {
    it('should handle multiple table operations in correct order', () => {
      const tableDiffs: TableDiff[] = [
        // Remove a table
        {
          name: 'old_table',
          schema: 'main',
          diffType: 'removed',
          source: createTable('old_table', 'main', [
            createColumn('id', 'INTEGER'),
          ]),
          target: null,
        },
        // Add a new table
        {
          name: 'new_table',
          schema: 'main',
          diffType: 'added',
          source: null,
          target: createTable('new_table', 'main', [
            createColumn('id', 'INTEGER', false, true),
          ]),
        },
        // Modify an existing table
        {
          name: 'users',
          schema: 'main',
          diffType: 'modified',
          source: createTable('users', 'main', [
            createColumn('id', 'INTEGER', false, true),
          ]),
          target: createTable('users', 'main', [
            createColumn('id', 'INTEGER', false, true),
            createColumn('email', 'TEXT'),
          ]),
          columnDiffs: [
            {
              name: 'id',
              diffType: 'unchanged',
              source: createColumn('id', 'INTEGER', false, true),
              target: createColumn('id', 'INTEGER', false, true),
            },
            {
              name: 'email',
              diffType: 'added',
              source: null,
              target: createColumn('email', 'TEXT'),
            },
          ],
        },
      ];

      const result = migrationGeneratorService.generateMigrationSQL({
        comparisonResult: createComparisonResult(tableDiffs),
        includeDropStatements: true,
      });

      expect(result.success).toBe(true);
      const sql = result.sql!;

      // DROP should come before CREATE and ALTER
      const dropPos = sql.indexOf('DROP TABLE old_table');
      const alterPos = sql.indexOf('ALTER TABLE users');
      const createPos = sql.indexOf('CREATE TABLE new_table');

      expect(dropPos).toBeLessThan(alterPos);
      expect(alterPos).toBeLessThan(createPos);
    });
  });
});

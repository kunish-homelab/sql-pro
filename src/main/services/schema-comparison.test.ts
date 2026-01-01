import type {
  ColumnInfo,
  ForeignKeyInfo,
  IndexInfo,
  SchemaInfo,
  TableInfo,
  TriggerInfo,
} from '../../shared/types';
/**
 * Unit tests for SchemaComparisonService
 * Tests schema comparison logic including table, column, index, foreign key, and trigger comparisons
 */
import { describe, expect, it } from 'vitest';
import { schemaComparisonService } from './schema-comparison';

describe('schemaComparisonService', () => {
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
    primaryKey: string[] = []
  ): TableInfo => ({
    name,
    schema,
    type: 'table',
    columns,
    indexes,
    foreignKeys,
    triggers,
    primaryKey,
  });

  // Helper function to create a schema
  const createSchema = (
    name: string,
    tables: TableInfo[] = [],
    views: TableInfo[] = []
  ): SchemaInfo => ({
    name,
    tables,
    views,
  });

  describe('compareSchemas - Basic Table Comparisons', () => {
    it('should detect added tables', () => {
      const sourceSchemas: SchemaInfo[] = [createSchema('main', [])];
      const targetSchemas: SchemaInfo[] = [
        createSchema('main', [
          createTable('users', 'main', [
            createColumn('id', 'INTEGER', false, true),
            createColumn('name', 'TEXT'),
          ]),
        ]),
      ];

      const result = schemaComparisonService.compareSchemas(
        sourceSchemas,
        targetSchemas,
        'source-id',
        'Source',
        'connection',
        'target-id',
        'Target',
        'connection'
      );

      expect(result.tableDiffs).toHaveLength(1);
      expect(result.tableDiffs[0]).toMatchObject({
        name: 'users',
        schema: 'main',
        diffType: 'added',
        source: null,
      });
      expect(result.tableDiffs[0].target).toBeDefined();
      expect(result.summary.tablesAdded).toBe(1);
      expect(result.summary.tablesRemoved).toBe(0);
      expect(result.summary.tablesModified).toBe(0);
    });

    it('should detect removed tables', () => {
      const sourceSchemas: SchemaInfo[] = [
        createSchema('main', [
          createTable('users', 'main', [
            createColumn('id', 'INTEGER', false, true),
          ]),
        ]),
      ];
      const targetSchemas: SchemaInfo[] = [createSchema('main', [])];

      const result = schemaComparisonService.compareSchemas(
        sourceSchemas,
        targetSchemas,
        'source-id',
        'Source',
        'connection',
        'target-id',
        'Target',
        'connection'
      );

      expect(result.tableDiffs).toHaveLength(1);
      expect(result.tableDiffs[0]).toMatchObject({
        name: 'users',
        schema: 'main',
        diffType: 'removed',
        target: null,
      });
      expect(result.tableDiffs[0].source).toBeDefined();
      expect(result.summary.tablesRemoved).toBe(1);
      expect(result.summary.tablesAdded).toBe(0);
    });

    it('should detect unchanged tables', () => {
      const sourceSchemas: SchemaInfo[] = [
        createSchema('main', [
          createTable('users', 'main', [
            createColumn('id', 'INTEGER', false, true),
            createColumn('name', 'TEXT'),
          ]),
        ]),
      ];
      const targetSchemas: SchemaInfo[] = [
        createSchema('main', [
          createTable('users', 'main', [
            createColumn('id', 'INTEGER', false, true),
            createColumn('name', 'TEXT'),
          ]),
        ]),
      ];

      const result = schemaComparisonService.compareSchemas(
        sourceSchemas,
        targetSchemas,
        'source-id',
        'Source',
        'connection',
        'target-id',
        'Target',
        'connection'
      );

      expect(result.tableDiffs).toHaveLength(1);
      expect(result.tableDiffs[0]).toMatchObject({
        name: 'users',
        schema: 'main',
        diffType: 'unchanged',
      });
      expect(result.summary.tablesUnchanged).toBe(1);
      expect(result.summary.tablesModified).toBe(0);
    });
  });

  describe('compareSchemas - Column Comparisons', () => {
    it('should detect added columns', () => {
      const sourceSchemas: SchemaInfo[] = [
        createSchema('main', [
          createTable('users', 'main', [
            createColumn('id', 'INTEGER', false, true),
          ]),
        ]),
      ];
      const targetSchemas: SchemaInfo[] = [
        createSchema('main', [
          createTable('users', 'main', [
            createColumn('id', 'INTEGER', false, true),
            createColumn('name', 'TEXT'),
          ]),
        ]),
      ];

      const result = schemaComparisonService.compareSchemas(
        sourceSchemas,
        targetSchemas,
        'source-id',
        'Source',
        'connection',
        'target-id',
        'Target',
        'connection'
      );

      expect(result.tableDiffs[0].diffType).toBe('modified');
      expect(result.tableDiffs[0].columnDiffs).toHaveLength(2);

      const addedColumn = result.tableDiffs[0].columnDiffs?.find(
        (c) => c.name === 'name'
      );
      expect(addedColumn).toMatchObject({
        name: 'name',
        diffType: 'added',
        source: null,
      });
      expect(addedColumn?.target).toBeDefined();
      expect(result.summary.totalColumnChanges).toBe(1);
    });

    it('should detect removed columns', () => {
      const sourceSchemas: SchemaInfo[] = [
        createSchema('main', [
          createTable('users', 'main', [
            createColumn('id', 'INTEGER', false, true),
            createColumn('name', 'TEXT'),
          ]),
        ]),
      ];
      const targetSchemas: SchemaInfo[] = [
        createSchema('main', [
          createTable('users', 'main', [
            createColumn('id', 'INTEGER', false, true),
          ]),
        ]),
      ];

      const result = schemaComparisonService.compareSchemas(
        sourceSchemas,
        targetSchemas,
        'source-id',
        'Source',
        'connection',
        'target-id',
        'Target',
        'connection'
      );

      expect(result.tableDiffs[0].diffType).toBe('modified');
      const removedColumn = result.tableDiffs[0].columnDiffs?.find(
        (c) => c.name === 'name'
      );
      expect(removedColumn).toMatchObject({
        name: 'name',
        diffType: 'removed',
        target: null,
      });
      expect(result.summary.totalColumnChanges).toBe(1);
    });

    it('should detect column type changes', () => {
      const sourceSchemas: SchemaInfo[] = [
        createSchema('main', [
          createTable('users', 'main', [createColumn('age', 'TEXT')]),
        ]),
      ];
      const targetSchemas: SchemaInfo[] = [
        createSchema('main', [
          createTable('users', 'main', [createColumn('age', 'INTEGER')]),
        ]),
      ];

      const result = schemaComparisonService.compareSchemas(
        sourceSchemas,
        targetSchemas,
        'source-id',
        'Source',
        'connection',
        'target-id',
        'Target',
        'connection'
      );

      const modifiedColumn = result.tableDiffs[0].columnDiffs?.find(
        (c) => c.name === 'age'
      );
      expect(modifiedColumn).toMatchObject({
        name: 'age',
        diffType: 'modified',
      });
      expect(modifiedColumn?.changes?.type).toEqual({
        from: 'TEXT',
        to: 'INTEGER',
      });
    });

    it('should detect nullable changes', () => {
      const sourceSchemas: SchemaInfo[] = [
        createSchema('main', [
          createTable('users', 'main', [createColumn('name', 'TEXT', true)]),
        ]),
      ];
      const targetSchemas: SchemaInfo[] = [
        createSchema('main', [
          createTable('users', 'main', [createColumn('name', 'TEXT', false)]),
        ]),
      ];

      const result = schemaComparisonService.compareSchemas(
        sourceSchemas,
        targetSchemas,
        'source-id',
        'Source',
        'connection',
        'target-id',
        'Target',
        'connection'
      );

      const modifiedColumn = result.tableDiffs[0].columnDiffs?.find(
        (c) => c.name === 'name'
      );
      expect(modifiedColumn?.changes?.nullable).toEqual({
        from: true,
        to: false,
      });
    });

    it('should detect default value changes', () => {
      const sourceSchemas: SchemaInfo[] = [
        createSchema('main', [
          createTable('users', 'main', [
            createColumn('status', 'TEXT', true, false, null),
          ]),
        ]),
      ];
      const targetSchemas: SchemaInfo[] = [
        createSchema('main', [
          createTable('users', 'main', [
            createColumn('status', 'TEXT', true, false, "'active'"),
          ]),
        ]),
      ];

      const result = schemaComparisonService.compareSchemas(
        sourceSchemas,
        targetSchemas,
        'source-id',
        'Source',
        'connection',
        'target-id',
        'Target',
        'connection'
      );

      const modifiedColumn = result.tableDiffs[0].columnDiffs?.find(
        (c) => c.name === 'status'
      );
      expect(modifiedColumn?.changes?.defaultValue).toEqual({
        from: null,
        to: "'active'",
      });
    });

    it('should detect primary key changes', () => {
      const sourceSchemas: SchemaInfo[] = [
        createSchema('main', [
          createTable('users', 'main', [
            createColumn('id', 'INTEGER', false, false),
          ]),
        ]),
      ];
      const targetSchemas: SchemaInfo[] = [
        createSchema('main', [
          createTable('users', 'main', [
            createColumn('id', 'INTEGER', false, true),
          ]),
        ]),
      ];

      const result = schemaComparisonService.compareSchemas(
        sourceSchemas,
        targetSchemas,
        'source-id',
        'Source',
        'connection',
        'target-id',
        'Target',
        'connection'
      );

      const modifiedColumn = result.tableDiffs[0].columnDiffs?.find(
        (c) => c.name === 'id'
      );
      expect(modifiedColumn?.changes?.isPrimaryKey).toEqual({
        from: false,
        to: true,
      });
    });
  });

  describe('compareSchemas - Index Comparisons', () => {
    it('should detect added indexes', () => {
      const sourceSchemas: SchemaInfo[] = [
        createSchema('main', [
          createTable('users', 'main', [createColumn('email', 'TEXT')], []),
        ]),
      ];
      const targetSchemas: SchemaInfo[] = [
        createSchema('main', [
          createTable(
            'users',
            'main',
            [createColumn('email', 'TEXT')],
            [
              {
                name: 'idx_users_email',
                columns: ['email'],
                isUnique: true,
                sql: 'CREATE UNIQUE INDEX idx_users_email ON users(email)',
              },
            ]
          ),
        ]),
      ];

      const result = schemaComparisonService.compareSchemas(
        sourceSchemas,
        targetSchemas,
        'source-id',
        'Source',
        'connection',
        'target-id',
        'Target',
        'connection'
      );

      expect(result.tableDiffs[0].indexDiffs).toHaveLength(1);
      expect(result.tableDiffs[0].indexDiffs?.[0]).toMatchObject({
        name: 'idx_users_email',
        diffType: 'added',
        source: null,
      });
      expect(result.summary.totalIndexChanges).toBe(1);
    });

    it('should detect removed indexes', () => {
      const sourceSchemas: SchemaInfo[] = [
        createSchema('main', [
          createTable(
            'users',
            'main',
            [createColumn('email', 'TEXT')],
            [
              {
                name: 'idx_users_email',
                columns: ['email'],
                isUnique: true,
                sql: 'CREATE UNIQUE INDEX idx_users_email ON users(email)',
              },
            ]
          ),
        ]),
      ];
      const targetSchemas: SchemaInfo[] = [
        createSchema('main', [
          createTable('users', 'main', [createColumn('email', 'TEXT')], []),
        ]),
      ];

      const result = schemaComparisonService.compareSchemas(
        sourceSchemas,
        targetSchemas,
        'source-id',
        'Source',
        'connection',
        'target-id',
        'Target',
        'connection'
      );

      expect(result.tableDiffs[0].indexDiffs).toHaveLength(1);
      expect(result.tableDiffs[0].indexDiffs?.[0]).toMatchObject({
        name: 'idx_users_email',
        diffType: 'removed',
        target: null,
      });
    });

    it('should detect index column changes', () => {
      const sourceSchemas: SchemaInfo[] = [
        createSchema('main', [
          createTable(
            'users',
            'main',
            [createColumn('email', 'TEXT'), createColumn('name', 'TEXT')],
            [
              {
                name: 'idx_users',
                columns: ['email'],
                isUnique: false,
                sql: '',
              },
            ]
          ),
        ]),
      ];
      const targetSchemas: SchemaInfo[] = [
        createSchema('main', [
          createTable(
            'users',
            'main',
            [createColumn('email', 'TEXT'), createColumn('name', 'TEXT')],
            [
              {
                name: 'idx_users',
                columns: ['email', 'name'],
                isUnique: false,
                sql: '',
              },
            ]
          ),
        ]),
      ];

      const result = schemaComparisonService.compareSchemas(
        sourceSchemas,
        targetSchemas,
        'source-id',
        'Source',
        'connection',
        'target-id',
        'Target',
        'connection'
      );

      const modifiedIndex = result.tableDiffs[0].indexDiffs?.[0];
      expect(modifiedIndex?.diffType).toBe('modified');
      expect(modifiedIndex?.changes?.columns).toBeDefined();
    });

    it('should detect unique constraint changes', () => {
      const sourceSchemas: SchemaInfo[] = [
        createSchema('main', [
          createTable(
            'users',
            'main',
            [createColumn('email', 'TEXT')],
            [
              {
                name: 'idx_users_email',
                columns: ['email'],
                isUnique: false,
                sql: '',
              },
            ]
          ),
        ]),
      ];
      const targetSchemas: SchemaInfo[] = [
        createSchema('main', [
          createTable(
            'users',
            'main',
            [createColumn('email', 'TEXT')],
            [
              {
                name: 'idx_users_email',
                columns: ['email'],
                isUnique: true,
                sql: '',
              },
            ]
          ),
        ]),
      ];

      const result = schemaComparisonService.compareSchemas(
        sourceSchemas,
        targetSchemas,
        'source-id',
        'Source',
        'connection',
        'target-id',
        'Target',
        'connection'
      );

      const modifiedIndex = result.tableDiffs[0].indexDiffs?.[0];
      expect(modifiedIndex?.changes?.isUnique).toEqual({
        from: false,
        to: true,
      });
    });
  });

  describe('compareSchemas - Foreign Key Comparisons', () => {
    it('should detect added foreign keys', () => {
      const sourceSchemas: SchemaInfo[] = [
        createSchema('main', [
          createTable(
            'orders',
            'main',
            [createColumn('user_id', 'INTEGER')],
            [],
            []
          ),
        ]),
      ];
      const targetSchemas: SchemaInfo[] = [
        createSchema('main', [
          createTable(
            'orders',
            'main',
            [createColumn('user_id', 'INTEGER')],
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
        ]),
      ];

      const result = schemaComparisonService.compareSchemas(
        sourceSchemas,
        targetSchemas,
        'source-id',
        'Source',
        'connection',
        'target-id',
        'Target',
        'connection'
      );

      expect(result.tableDiffs[0].foreignKeyDiffs).toHaveLength(1);
      expect(result.tableDiffs[0].foreignKeyDiffs?.[0]).toMatchObject({
        column: 'user_id',
        diffType: 'added',
        source: null,
      });
      expect(result.summary.totalForeignKeyChanges).toBe(1);
    });

    it('should detect removed foreign keys', () => {
      const sourceSchemas: SchemaInfo[] = [
        createSchema('main', [
          createTable(
            'orders',
            'main',
            [createColumn('user_id', 'INTEGER')],
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
        ]),
      ];
      const targetSchemas: SchemaInfo[] = [
        createSchema('main', [
          createTable(
            'orders',
            'main',
            [createColumn('user_id', 'INTEGER')],
            [],
            []
          ),
        ]),
      ];

      const result = schemaComparisonService.compareSchemas(
        sourceSchemas,
        targetSchemas,
        'source-id',
        'Source',
        'connection',
        'target-id',
        'Target',
        'connection'
      );

      expect(result.tableDiffs[0].foreignKeyDiffs?.[0]).toMatchObject({
        column: 'user_id',
        diffType: 'removed',
        target: null,
      });
    });

    it('should detect foreign key cascade rule changes', () => {
      const sourceSchemas: SchemaInfo[] = [
        createSchema('main', [
          createTable(
            'orders',
            'main',
            [createColumn('user_id', 'INTEGER')],
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
        ]),
      ];
      const targetSchemas: SchemaInfo[] = [
        createSchema('main', [
          createTable(
            'orders',
            'main',
            [createColumn('user_id', 'INTEGER')],
            [],
            [
              {
                column: 'user_id',
                referencedTable: 'users',
                referencedColumn: 'id',
                onDelete: 'SET NULL',
                onUpdate: 'NO ACTION',
              },
            ]
          ),
        ]),
      ];

      const result = schemaComparisonService.compareSchemas(
        sourceSchemas,
        targetSchemas,
        'source-id',
        'Source',
        'connection',
        'target-id',
        'Target',
        'connection'
      );

      const modifiedFk = result.tableDiffs[0].foreignKeyDiffs?.[0];
      expect(modifiedFk?.diffType).toBe('modified');
      expect(modifiedFk?.changes?.onDelete).toEqual({
        from: 'CASCADE',
        to: 'SET NULL',
      });
      expect(modifiedFk?.changes?.onUpdate).toEqual({
        from: 'CASCADE',
        to: 'NO ACTION',
      });
    });
  });

  describe('compareSchemas - Trigger Comparisons', () => {
    it('should detect added triggers', () => {
      const sourceSchemas: SchemaInfo[] = [
        createSchema('main', [
          createTable(
            'users',
            'main',
            [createColumn('id', 'INTEGER')],
            [],
            [],
            []
          ),
        ]),
      ];
      const targetSchemas: SchemaInfo[] = [
        createSchema('main', [
          createTable(
            'users',
            'main',
            [createColumn('id', 'INTEGER')],
            [],
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
        ]),
      ];

      const result = schemaComparisonService.compareSchemas(
        sourceSchemas,
        targetSchemas,
        'source-id',
        'Source',
        'connection',
        'target-id',
        'Target',
        'connection'
      );

      expect(result.tableDiffs[0].triggerDiffs).toHaveLength(1);
      expect(result.tableDiffs[0].triggerDiffs?.[0]).toMatchObject({
        name: 'tr_users_audit',
        diffType: 'added',
        source: null,
      });
      expect(result.summary.totalTriggerChanges).toBe(1);
    });

    it('should detect removed triggers', () => {
      const sourceSchemas: SchemaInfo[] = [
        createSchema('main', [
          createTable(
            'users',
            'main',
            [createColumn('id', 'INTEGER')],
            [],
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
        ]),
      ];
      const targetSchemas: SchemaInfo[] = [
        createSchema('main', [
          createTable(
            'users',
            'main',
            [createColumn('id', 'INTEGER')],
            [],
            [],
            []
          ),
        ]),
      ];

      const result = schemaComparisonService.compareSchemas(
        sourceSchemas,
        targetSchemas,
        'source-id',
        'Source',
        'connection',
        'target-id',
        'Target',
        'connection'
      );

      expect(result.tableDiffs[0].triggerDiffs?.[0]).toMatchObject({
        name: 'tr_users_audit',
        diffType: 'removed',
        target: null,
      });
    });

    it('should detect trigger timing/event changes', () => {
      const sourceSchemas: SchemaInfo[] = [
        createSchema('main', [
          createTable(
            'users',
            'main',
            [createColumn('id', 'INTEGER')],
            [],
            [],
            [
              {
                name: 'tr_users_audit',
                tableName: 'users',
                timing: 'BEFORE',
                event: 'UPDATE',
                sql: 'CREATE TRIGGER tr_users_audit BEFORE UPDATE ON users BEGIN ...',
              },
            ]
          ),
        ]),
      ];
      const targetSchemas: SchemaInfo[] = [
        createSchema('main', [
          createTable(
            'users',
            'main',
            [createColumn('id', 'INTEGER')],
            [],
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
        ]),
      ];

      const result = schemaComparisonService.compareSchemas(
        sourceSchemas,
        targetSchemas,
        'source-id',
        'Source',
        'connection',
        'target-id',
        'Target',
        'connection'
      );

      const modifiedTrigger = result.tableDiffs[0].triggerDiffs?.[0];
      expect(modifiedTrigger?.diffType).toBe('modified');
      expect(modifiedTrigger?.changes?.timing).toEqual({
        from: 'BEFORE',
        to: 'AFTER',
      });
      expect(modifiedTrigger?.changes?.event).toEqual({
        from: 'UPDATE',
        to: 'INSERT',
      });
    });
  });

  describe('compareSchemas - Edge Cases', () => {
    it('should handle empty schemas', () => {
      const sourceSchemas: SchemaInfo[] = [createSchema('main', [])];
      const targetSchemas: SchemaInfo[] = [createSchema('main', [])];

      const result = schemaComparisonService.compareSchemas(
        sourceSchemas,
        targetSchemas,
        'source-id',
        'Source',
        'connection',
        'target-id',
        'Target',
        'connection'
      );

      expect(result.tableDiffs).toHaveLength(0);
      expect(result.summary.sourceTables).toBe(0);
      expect(result.summary.targetTables).toBe(0);
      expect(result.summary.tablesAdded).toBe(0);
      expect(result.summary.tablesRemoved).toBe(0);
      expect(result.summary.tablesModified).toBe(0);
    });

    it('should handle identical schemas', () => {
      const table = createTable('users', 'main', [
        createColumn('id', 'INTEGER', false, true),
        createColumn('name', 'TEXT', false),
        createColumn('email', 'TEXT', false),
      ]);

      const sourceSchemas: SchemaInfo[] = [createSchema('main', [table])];
      const targetSchemas: SchemaInfo[] = [createSchema('main', [table])];

      const result = schemaComparisonService.compareSchemas(
        sourceSchemas,
        targetSchemas,
        'source-id',
        'Source',
        'connection',
        'target-id',
        'Target',
        'connection'
      );

      expect(result.tableDiffs).toHaveLength(1);
      expect(result.tableDiffs[0].diffType).toBe('unchanged');
      expect(result.summary.tablesUnchanged).toBe(1);
      expect(result.summary.totalColumnChanges).toBe(0);
      expect(result.summary.totalIndexChanges).toBe(0);
    });

    it('should handle composite primary key changes', () => {
      const sourceSchemas: SchemaInfo[] = [
        createSchema('main', [
          createTable(
            'order_items',
            'main',
            [
              createColumn('order_id', 'INTEGER'),
              createColumn('item_id', 'INTEGER'),
            ],
            [],
            [],
            [],
            ['order_id']
          ),
        ]),
      ];
      const targetSchemas: SchemaInfo[] = [
        createSchema('main', [
          createTable(
            'order_items',
            'main',
            [
              createColumn('order_id', 'INTEGER'),
              createColumn('item_id', 'INTEGER'),
            ],
            [],
            [],
            [],
            ['order_id', 'item_id']
          ),
        ]),
      ];

      const result = schemaComparisonService.compareSchemas(
        sourceSchemas,
        targetSchemas,
        'source-id',
        'Source',
        'connection',
        'target-id',
        'Target',
        'connection'
      );

      expect(result.tableDiffs[0].diffType).toBe('modified');
      expect(result.tableDiffs[0].primaryKeyChanges).toBeDefined();
      // Note: comparePrimaryKeys sorts the arrays, so we check the sorted result
      expect(result.tableDiffs[0].primaryKeyChanges?.from.sort()).toEqual([
        'order_id',
      ]);
      expect(result.tableDiffs[0].primaryKeyChanges?.to.sort()).toEqual([
        'item_id',
        'order_id',
      ]);
    });

    it('should handle multiple schema comparisons', () => {
      const sourceSchemas: SchemaInfo[] = [
        createSchema('main', [
          createTable('users', 'main', [createColumn('id', 'INTEGER')]),
        ]),
        createSchema('temp', [
          createTable('sessions', 'temp', [createColumn('id', 'INTEGER')]),
        ]),
      ];
      const targetSchemas: SchemaInfo[] = [
        createSchema('main', [
          createTable('users', 'main', [createColumn('id', 'INTEGER')]),
        ]),
        createSchema('temp', [
          createTable('sessions', 'temp', [createColumn('id', 'INTEGER')]),
        ]),
      ];

      const result = schemaComparisonService.compareSchemas(
        sourceSchemas,
        targetSchemas,
        'source-id',
        'Source',
        'connection',
        'target-id',
        'Target',
        'connection'
      );

      expect(result.tableDiffs).toHaveLength(2);
      expect(result.tableDiffs.every((d) => d.diffType === 'unchanged')).toBe(
        true
      );
    });

    it('should include metadata in comparison result', () => {
      const result = schemaComparisonService.compareSchemas(
        [],
        [],
        'source-123',
        'My Source DB',
        'connection',
        'target-456',
        'My Target DB',
        'snapshot'
      );

      expect(result.sourceId).toBe('source-123');
      expect(result.sourceName).toBe('My Source DB');
      expect(result.sourceType).toBe('connection');
      expect(result.targetId).toBe('target-456');
      expect(result.targetName).toBe('My Target DB');
      expect(result.targetType).toBe('snapshot');
      expect(result.comparedAt).toBeDefined();
      expect(new Date(result.comparedAt)).toBeInstanceOf(Date);
    });
  });

  describe('compareSchemas - Summary Statistics', () => {
    it('should calculate correct summary statistics', () => {
      const sourceSchemas: SchemaInfo[] = [
        createSchema('main', [
          createTable('users', 'main', [createColumn('id', 'INTEGER')]),
          createTable('posts', 'main', [createColumn('id', 'INTEGER')]),
        ]),
      ];
      const targetSchemas: SchemaInfo[] = [
        createSchema('main', [
          createTable('users', 'main', [
            createColumn('id', 'INTEGER'),
            createColumn('name', 'TEXT'),
          ]),
          createTable('comments', 'main', [createColumn('id', 'INTEGER')]),
        ]),
      ];

      const result = schemaComparisonService.compareSchemas(
        sourceSchemas,
        targetSchemas,
        'source-id',
        'Source',
        'connection',
        'target-id',
        'Target',
        'connection'
      );

      expect(result.summary).toMatchObject({
        sourceTables: 2,
        targetTables: 2,
        tablesAdded: 1, // comments
        tablesRemoved: 1, // posts
        tablesModified: 1, // users (column added)
        tablesUnchanged: 0,
        totalColumnChanges: 1, // name column added to users
      });
    });
  });
});

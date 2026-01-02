/**
 * Integration Tests for Query & Schema Sharing
 *
 * Tests the complete end-to-end sharing workflows:
 * 1. Query Export/Import Cycle with file operations
 * 2. Schema Export/Import Cycle (JSON format)
 * 3. Schema Export/Import Cycle (SQL format)
 * 4. Bundle Export/Import Cycle with multiple queries
 * 5. Compression round-trip with large data
 * 6. Validation and compatibility checks
 * 7. File handling (write to disk, read from disk)
 *
 * These tests verify integration between:
 * - Export functions (exportQuery, exportSchema, exportBundle)
 * - Serialization with compression (serializeShareableData)
 * - Import functions (importQuery, importSchema, importBundle)
 * - File I/O operations
 * - Validation and safety checks
 */

import type { SchemaInfo } from '@shared/types';
import { randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  exportBundle,
  exportQuery,
  exportSchema,
  importBundle,
  importQuery,
  importSchema,
  serializeShareableData,
} from './query-schema-sharing';

describe('query & Schema Sharing Integration Tests', () => {
  let testDir: string;

  beforeEach(() => {
    // Create temporary directory for test files
    testDir = join(tmpdir(), `sql-pro-test-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Cleanup: Remove test directory and files
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  // ============ Query Export/Import Cycle ============

  describe('query Export/Import Cycle', () => {
    it('should complete full query export/import cycle with file operations', async () => {
      // Step 1: Export query with full metadata
      const originalQuery = {
        name: 'User Activity Report',
        sql: 'SELECT user_id, COUNT(*) as actions FROM user_actions GROUP BY user_id',
        description: 'Generates user activity statistics',
        tags: ['users', 'analytics', 'reporting'],
        databaseContext: 'analytics_db',
        documentation:
          'This query is used for monthly user activity reporting.',
      };

      const exportResult = await exportQuery(originalQuery);
      expect(exportResult.data.id).toBeDefined();
      expect(exportResult.data.name).toBe(originalQuery.name);
      expect(exportResult.data.metadata.version).toBe('1.0.0');

      // Step 2: Serialize to JSON
      const { result: jsonString } = await serializeShareableData(
        exportResult.data,
        false,
        true
      );
      expect(jsonString).toBeTruthy();
      expect(() => JSON.parse(jsonString)).not.toThrow();

      // Step 3: Save to file
      const filePath = join(testDir, 'query-export.json');
      writeFileSync(filePath, jsonString, 'utf8');
      expect(existsSync(filePath)).toBe(true);

      // Step 4: Read from file
      const fileContent = readFileSync(filePath, 'utf8');
      expect(fileContent).toBe(jsonString);

      // Step 5: Import and validate
      const importResult = await importQuery(fileContent);
      expect(importResult.query).toBeDefined();
      expect(importResult.validation.valid).toBe(true);
      expect(importResult.validation.errors).toBeUndefined();

      // Step 6: Verify all data matches
      expect(importResult.query.name).toBe(originalQuery.name);
      expect(importResult.query.sql).toBe(originalQuery.sql);
      expect(importResult.query.description).toBe(originalQuery.description);
      expect(importResult.query.tags).toEqual(originalQuery.tags);
      expect(importResult.query.databaseContext).toBe(
        originalQuery.databaseContext
      );
      expect(importResult.query.documentation).toBe(
        originalQuery.documentation
      );
      expect(importResult.query.metadata.version).toBe('1.0.0');
    });

    it('should preserve query metadata through export/import cycle', async () => {
      const query = {
        name: 'Simple Select',
        sql: 'SELECT * FROM products',
        description: 'Lists all products',
        tags: ['products'],
        databaseContext: 'shop_db',
      };

      // Export
      const exportResult = await exportQuery(query);
      const queryId = exportResult.data.id;
      const createdAt = exportResult.data.createdAt;

      // Serialize
      const { result } = await serializeShareableData(exportResult.data);

      // Import
      const importResult = await importQuery(result);

      // Verify metadata preserved
      expect(importResult.query.id).toBe(queryId);
      expect(importResult.query.createdAt).toBe(createdAt);
      expect(importResult.query.metadata.exportedAt).toBeDefined();
      expect(importResult.query.metadata.version).toBe('1.0.0');
    });

    it('should detect SQL safety warnings during import', async () => {
      const dangerousQuery = {
        name: 'Dangerous Query',
        sql: 'DROP TABLE users; DELETE FROM sessions',
      };

      const exportResult = await exportQuery(dangerousQuery);
      const { result } = await serializeShareableData(exportResult.data);

      const importResult = await importQuery(result);

      // Should import successfully but with warnings
      expect(importResult.validation.valid).toBe(true);
      expect(importResult.validation.warnings).toBeDefined();
      expect(importResult.validation.warnings!.length).toBeGreaterThan(0);
      expect(
        importResult.validation.warnings!.some((w) => w.includes('DROP'))
      ).toBe(true);
    });
  });

  // ============ Schema Export/Import Cycle (JSON Format) ============

  describe('schema Export/Import Cycle - JSON Format', () => {
    it('should complete full schema JSON export/import cycle', async () => {
      // Step 1: Create schema with tables
      const testSchema: SchemaInfo[] = [
        {
          name: 'main',
          tables: [
            {
              name: 'users',
              schema: 'main',
              type: 'table' as const,
              columns: [
                {
                  name: 'id',
                  type: 'INTEGER',
                  nullable: false,
                  defaultValue: null,
                  isPrimaryKey: true,
                },
                {
                  name: 'username',
                  type: 'TEXT',
                  nullable: false,
                  defaultValue: null,
                  isPrimaryKey: false,
                },
              ],
              primaryKey: ['id'],
              foreignKeys: [],
              indexes: [
                {
                  name: 'idx_username',
                  isUnique: true,
                  columns: ['username'],
                  sql: 'CREATE UNIQUE INDEX idx_username ON users(username)',
                },
              ],
              triggers: [],
              sql: 'CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT NOT NULL)',
            },
          ],
          views: [],
        },
      ];

      const originalSchema = {
        name: 'User Database Schema',
        description: 'Schema for user management',
        databaseName: 'users.db',
        databaseType: 'sqlite',
        format: 'json' as const,
        schemas: testSchema,
        options: {
          format: 'json' as const,
          includeIndexes: true,
          includeTriggers: false,
          includeForeignKeys: true,
        },
      };

      // Step 2: Export schema
      const exportResult = await exportSchema(originalSchema);
      expect(exportResult.data.id).toBeDefined();
      expect(exportResult.data.format).toBe('json');

      // Step 3: Serialize to JSON
      const { result: jsonString } = await serializeShareableData(
        exportResult.data
      );
      const filePath = join(testDir, 'schema-json-export.json');
      writeFileSync(filePath, jsonString, 'utf8');

      // Step 4: Read from file and import
      const fileContent = readFileSync(filePath, 'utf8');
      const importResult = await importSchema(fileContent);

      // Step 5: Verify schema structure
      expect(importResult.schema.name).toBe(originalSchema.name);
      expect(importResult.schema.format).toBe('json');
      expect(importResult.schema.schemas).toHaveLength(1);
      expect(importResult.schema.schemas![0].tables).toHaveLength(1);
      expect(importResult.schema.schemas![0].tables[0].name).toBe('users');
      expect(importResult.schema.schemas![0].tables[0].columns).toHaveLength(2);
      expect(importResult.schema.schemas![0].tables[0].indexes).toHaveLength(1);

      // Step 6: Verify validation passed
      expect(importResult.validation.valid).toBe(true);
      expect(importResult.validation.errors).toBeUndefined();
    });

    it('should handle schema with multiple tables and indexes', async () => {
      const multiTableSchema: SchemaInfo[] = [
        {
          name: 'main',
          tables: [
            {
              name: 'products',
              schema: 'main',
              type: 'table' as const,
              columns: [
                {
                  name: 'id',
                  type: 'INTEGER',
                  nullable: false,
                  defaultValue: null,
                  isPrimaryKey: true,
                },
                {
                  name: 'name',
                  type: 'TEXT',
                  nullable: false,
                  defaultValue: null,
                  isPrimaryKey: false,
                },
              ],
              primaryKey: ['id'],
              foreignKeys: [],
              indexes: [],
              triggers: [],
              sql: 'CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT NOT NULL)',
            },
            {
              name: 'orders',
              schema: 'main',
              type: 'table' as const,
              columns: [
                {
                  name: 'id',
                  type: 'INTEGER',
                  nullable: false,
                  defaultValue: null,
                  isPrimaryKey: true,
                },
                {
                  name: 'product_id',
                  type: 'INTEGER',
                  nullable: false,
                  defaultValue: null,
                  isPrimaryKey: false,
                },
              ],
              primaryKey: ['id'],
              foreignKeys: [
                {
                  column: 'product_id',
                  referencedTable: 'products',
                  referencedColumn: 'id',
                  onUpdate: 'NO ACTION',
                  onDelete: 'CASCADE',
                },
              ],
              indexes: [],
              triggers: [],
              sql: 'CREATE TABLE orders (id INTEGER PRIMARY KEY, product_id INTEGER REFERENCES products(id) ON DELETE CASCADE)',
            },
          ],
          views: [],
        },
      ];

      const schema = {
        name: 'E-Commerce Schema',
        format: 'json' as const,
        schemas: multiTableSchema,
        options: {
          format: 'json' as const,
          includeIndexes: true,
          includeForeignKeys: true,
        },
      };

      const exportResult = await exportSchema(schema);
      const { result } = await serializeShareableData(exportResult.data);
      const importResult = await importSchema(result);

      // Verify both tables imported
      expect(importResult.schema.schemas![0].tables).toHaveLength(2);
      expect(importResult.schema.schemas![0].tables[0].name).toBe('products');
      expect(importResult.schema.schemas![0].tables[1].name).toBe('orders');

      // Verify foreign key relationship preserved
      expect(
        importResult.schema.schemas![0].tables[1].foreignKeys
      ).toHaveLength(1);
      expect(
        importResult.schema.schemas![0].tables[1].foreignKeys[0].referencedTable
      ).toBe('products');
    });
  });

  // ============ Schema Export/Import Cycle (SQL Format) ============

  describe('schema Export/Import Cycle - SQL Format', () => {
    it('should complete full schema SQL export/import cycle', async () => {
      // Step 1: Create SQL schema
      const sqlStatements = [
        'CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT NOT NULL, email TEXT UNIQUE)',
        'CREATE INDEX idx_username ON users(username)',
        'CREATE TRIGGER update_timestamp AFTER UPDATE ON users BEGIN UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END',
      ];

      const originalSchema = {
        name: 'User Schema SQL',
        description: 'SQL format schema',
        format: 'sql' as const,
        sqlStatements,
        options: {
          format: 'sql' as const,
          includeIndexes: true,
          includeTriggers: true,
          includeComments: true,
        },
      };

      // Step 2: Export and serialize
      const exportResult = await exportSchema(originalSchema);
      expect(exportResult.data.format).toBe('sql');
      expect(exportResult.data.sqlStatements).toHaveLength(3);

      const { result: jsonString } = await serializeShareableData(
        exportResult.data
      );
      const filePath = join(testDir, 'schema-sql-export.json');
      writeFileSync(filePath, jsonString, 'utf8');

      // Step 3: Read and import
      const fileContent = readFileSync(filePath, 'utf8');
      const importResult = await importSchema(fileContent);

      // Step 4: Verify SQL statements preserved
      expect(importResult.schema.format).toBe('sql');
      expect(importResult.schema.sqlStatements).toHaveLength(3);
      expect(importResult.schema.sqlStatements![0]).toContain(
        'CREATE TABLE users'
      );
      expect(importResult.schema.sqlStatements![1]).toContain('CREATE INDEX');
      expect(importResult.schema.sqlStatements![2]).toContain('CREATE TRIGGER');

      // Verify validation
      expect(importResult.validation.valid).toBe(true);
    });

    it('should handle schema with complex SQL statements', async () => {
      // Schemas can legitimately contain DROP, CREATE, and other DDL statements
      const complexSQL = [
        'CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)',
        'CREATE INDEX idx_name ON test(name)',
        'DROP TABLE IF EXISTS old_table',
        'CREATE TRIGGER update_timestamp AFTER UPDATE ON test BEGIN UPDATE test SET updated = CURRENT_TIMESTAMP; END',
      ];

      const schema = {
        name: 'Complex Schema',
        format: 'sql' as const,
        sqlStatements: complexSQL,
        options: {
          format: 'sql' as const,
        },
      };

      const exportResult = await exportSchema(schema);
      const { result } = await serializeShareableData(exportResult.data);
      const importResult = await importSchema(result);

      // Should import successfully (schemas can contain DDL statements)
      expect(importResult.validation.valid).toBe(true);
      expect(importResult.schema.sqlStatements).toHaveLength(4);
      expect(importResult.schema.sqlStatements![2]).toContain('DROP TABLE');
    });
  });

  // ============ Bundle Export/Import Cycle ============

  describe('bundle Export/Import Cycle', () => {
    it('should complete full bundle export/import cycle with multiple queries', async () => {
      // Step 1: Create bundle with multiple queries
      const originalBundle = {
        name: 'Analytics Query Bundle',
        description: 'Collection of analytics queries',
        queries: [
          {
            id: '1',
            name: 'Daily Active Users',
            sql: 'SELECT DATE(timestamp) as date, COUNT(DISTINCT user_id) as dau FROM events GROUP BY DATE(timestamp)',
            description: 'Calculate daily active users',
            tags: ['analytics', 'users'],
            order: 1,
          },
          {
            id: '2',
            name: 'Revenue Summary',
            sql: 'SELECT SUM(amount) as total_revenue, AVG(amount) as avg_revenue FROM transactions',
            description: 'Calculate revenue metrics',
            tags: ['analytics', 'revenue'],
            order: 2,
          },
          {
            id: '3',
            name: 'Top Products',
            sql: 'SELECT product_id, COUNT(*) as sales FROM orders GROUP BY product_id ORDER BY sales DESC LIMIT 10',
            description: 'Top selling products',
            tags: ['analytics', 'products'],
            order: 3,
          },
        ],
        tags: ['analytics', 'reporting'],
        databaseContext: 'analytics_db',
        documentation: 'Monthly analytics queries for reporting',
      };

      // Step 2: Export bundle
      const exportResult = await exportBundle(originalBundle);
      expect(exportResult.data.id).toBeDefined();
      expect(exportResult.data.queries).toHaveLength(3);

      // Step 3: Serialize to JSON
      const { result: jsonString } = await serializeShareableData(
        exportResult.data
      );
      const filePath = join(testDir, 'bundle-export.json');
      writeFileSync(filePath, jsonString, 'utf8');

      // Step 4: Read and import
      const fileContent = readFileSync(filePath, 'utf8');
      const importResult = await importBundle(fileContent);

      // Step 5: Verify bundle structure
      expect(importResult.bundle.name).toBe(originalBundle.name);
      expect(importResult.bundle.description).toBe(originalBundle.description);
      expect(importResult.bundle.queries).toHaveLength(3);
      expect(importResult.bundle.tags).toEqual(originalBundle.tags);
      expect(importResult.bundle.databaseContext).toBe(
        originalBundle.databaseContext
      );
      expect(importResult.bundle.documentation).toBe(
        originalBundle.documentation
      );

      // Step 6: Verify each query in bundle
      importResult.bundle.queries.forEach((query, index) => {
        expect(query.name).toBe(originalBundle.queries[index].name);
        expect(query.sql).toBe(originalBundle.queries[index].sql);
        expect(query.description).toBe(
          originalBundle.queries[index].description
        );
        expect(query.tags).toEqual(originalBundle.queries[index].tags);
        expect(query.order).toBe(originalBundle.queries[index].order);
      });

      // Verify validation
      expect(importResult.validation.valid).toBe(true);
      expect(importResult.validation.errors).toBeUndefined();
    });

    it('should validate each query in bundle separately', async () => {
      const bundleWithDangerousQuery = {
        name: 'Mixed Bundle',
        queries: [
          {
            id: '1',
            name: 'Safe Query',
            sql: 'SELECT * FROM users',
          },
          {
            id: '2',
            name: 'Dangerous Query',
            sql: 'DROP TABLE old_users',
          },
        ],
      };

      const exportResult = await exportBundle(bundleWithDangerousQuery);
      const { result } = await serializeShareableData(exportResult.data);
      const importResult = await importBundle(result);

      // Should import but with warnings for dangerous query
      expect(importResult.validation.valid).toBe(true);
      expect(importResult.validation.warnings!.length).toBeGreaterThan(0);
      expect(
        importResult.validation.warnings!.some((w) => w.includes('DROP'))
      ).toBe(true);
    });
  });

  // ============ Compression Round-Trip ============

  describe('compression Round-Trip with Large Data', () => {
    it('should automatically compress large queries and decompress on import', async () => {
      // Create a large query (>100KB) by repeating SQL
      const largeSql = `SELECT * FROM users WHERE ${Array.from({
        length: 10000,
      })
        .fill("username = 'user' OR ")
        .join('')}username = 'user'`;

      const largeQuery = {
        name: 'Large Query',
        sql: largeSql,
        description: 'A very large query for compression testing',
        documentation: 'Lorem ipsum dolor sit amet. '.repeat(300), // ~8700 chars, under limit
      };

      // Step 1: Export and serialize with auto-compression
      const exportResult = await exportQuery(largeQuery);
      const { result, compressionInfo } = await serializeShareableData(
        exportResult.data,
        undefined, // Auto-compress based on size
        true
      );

      // Verify compression occurred
      expect(compressionInfo).toBeDefined();
      expect(compressionInfo!.compressed).toBe(true);
      expect(compressionInfo!.algorithm).toBe('gzip');
      expect(compressionInfo!.compressedSize).toBeLessThan(
        compressionInfo!.originalSize ?? Number.POSITIVE_INFINITY
      );

      // Step 2: Save compressed data to file
      const filePath = join(testDir, 'large-query-compressed.json');
      writeFileSync(filePath, result, 'utf8');

      // Step 3: Read and import (should auto-decompress)
      const fileContent = readFileSync(filePath, 'utf8');
      const importResult = await importQuery(fileContent);

      // Step 4: Verify decompression and data integrity
      expect(importResult.query.sql).toBe(largeSql);
      expect(importResult.query.name).toBe(largeQuery.name);
      expect(importResult.query.documentation).toBe(largeQuery.documentation);
      expect(importResult.validation.compressionInfo?.compressed).toBe(true);
      expect(importResult.validation.valid).toBe(true);
    });

    it('should handle large schema with compression', async () => {
      // Create a large schema with many tables (500 tables to exceed 100KB)
      const tables = Array.from({ length: 500 }, (_, i) => ({
        name: `table_${i}`,
        schema: 'main',
        type: 'table' as const,
        columns: [
          {
            name: 'id',
            type: 'INTEGER',
            nullable: false,
            defaultValue: null,
            isPrimaryKey: true,
          },
          {
            name: `data_${i}`,
            type: 'TEXT',
            nullable: true,
            defaultValue: null,
            isPrimaryKey: false,
          },
          {
            name: `timestamp_${i}`,
            type: 'TEXT',
            nullable: true,
            defaultValue: null,
            isPrimaryKey: false,
          },
        ],
        primaryKey: ['id'],
        foreignKeys: [],
        indexes: [],
        triggers: [],
        sql: `CREATE TABLE table_${i} (id INTEGER PRIMARY KEY, data_${i} TEXT, timestamp_${i} TEXT)`,
      }));

      const largeSchema = {
        name: 'Large Schema',
        format: 'json' as const,
        schemas: [{ name: 'main', tables, views: [] }],
        options: { format: 'json' as const },
      };

      const exportResult = await exportSchema(largeSchema);
      const { result, compressionInfo } = await serializeShareableData(
        exportResult.data
      );

      // Large schema should trigger compression
      expect(compressionInfo).toBeDefined();
      expect(compressionInfo!.compressed).toBe(true);

      // Import should decompress successfully
      const importResult = await importSchema(result);
      expect(importResult.schema.schemas![0].tables).toHaveLength(500);
      expect(importResult.validation.valid).toBe(true);
    });

    it('should preserve data integrity through compression cycle', async () => {
      const bundle = {
        name: 'Large Bundle',
        queries: Array.from({ length: 50 }, (_, i) => ({
          id: `${i}`,
          name: `Query ${i}`,
          sql: `SELECT * FROM table_${i} WHERE id = ${i}`,
          description: 'Test query '.repeat(100), // Make it large
        })),
      };

      // Export, compress, decompress, import
      const exportResult = await exportBundle(bundle);
      const { result } = await serializeShareableData(exportResult.data);
      const importResult = await importBundle(result);

      // Verify all 50 queries preserved
      expect(importResult.bundle.queries).toHaveLength(50);
      importResult.bundle.queries.forEach((query, i) => {
        expect(query.name).toBe(`Query ${i}`);
        expect(query.sql).toBe(`SELECT * FROM table_${i} WHERE id = ${i}`);
      });
    });
  });

  // ============ Validation and Compatibility Checks ============

  describe('validation and Compatibility Checks', () => {
    it('should validate version compatibility on import', async () => {
      const query = {
        name: 'Test Query',
        sql: 'SELECT * FROM test',
      };

      const exportResult = await exportQuery(query);

      // Manually modify version to simulate incompatible version
      const modifiedData = {
        ...exportResult.data,
        metadata: {
          ...exportResult.data.metadata,
          version: '2.0.0', // Major version change
        },
      };

      const { result } = await serializeShareableData(modifiedData);
      const importResult = await importQuery(result);

      // Should fail validation due to major version mismatch
      expect(importResult.validation.valid).toBe(false);
      expect(importResult.validation.errors!.length).toBeGreaterThan(0);
      expect(
        importResult.validation.errors!.some((e) => e.includes('version'))
      ).toBe(true);
    });

    it('should warn on minor version differences', async () => {
      const query = {
        name: 'Test Query',
        sql: 'SELECT * FROM test',
      };

      const exportResult = await exportQuery(query);

      // Modify to different minor version
      const modifiedData = {
        ...exportResult.data,
        metadata: {
          ...exportResult.data.metadata,
          version: '1.5.0', // Different minor version
        },
      };

      const { result } = await serializeShareableData(modifiedData);
      const importResult = await importQuery(result);

      // Should pass but with warning
      expect(importResult.validation.valid).toBe(true);
      expect(importResult.validation.warnings!.length).toBeGreaterThan(0);
    });

    it('should detect and report field length violations', async () => {
      // Create a valid query first
      const validQuery = {
        name: 'Test',
        sql: 'SELECT * FROM test',
        description: 'Short description',
        documentation: 'Short docs',
      };

      const exportResult = await exportQuery(validQuery);

      // Manually modify the exported data to have long fields (simulating external file)
      const modifiedData = {
        ...exportResult.data,
        description: 'x'.repeat(2000), // Exceeds 1000 char limit
        documentation: 'y'.repeat(20000), // Exceeds 10000 char limit
      };

      const { result } = await serializeShareableData(modifiedData);
      const importResult = await importQuery(result);

      // Should import but with warnings about field lengths
      expect(importResult.validation.valid).toBe(true);
      expect(importResult.validation.warnings).toBeDefined();
      expect(importResult.validation.warnings!.length).toBeGreaterThan(0);
    });
  });

  // ============ File Handling Edge Cases ============

  describe('file Handling Edge Cases', () => {
    it('should handle corrupted file data gracefully', async () => {
      const corruptData = 'This is not valid JSON data!@#$%^&*()';
      const filePath = join(testDir, 'corrupt.json');
      writeFileSync(filePath, corruptData, 'utf8');

      const fileContent = readFileSync(filePath, 'utf8');

      // Should throw error for invalid JSON
      await expect(importQuery(fileContent)).rejects.toThrow();
    });

    it('should handle empty file', async () => {
      const filePath = join(testDir, 'empty.json');
      writeFileSync(filePath, '', 'utf8');

      const fileContent = readFileSync(filePath, 'utf8');

      // Should throw error for empty data
      await expect(importQuery(fileContent)).rejects.toThrow();
    });

    it('should verify file persistence after write', async () => {
      const query = {
        name: 'Persistence Test',
        sql: 'SELECT * FROM test',
      };

      const exportResult = await exportQuery(query);
      const { result } = await serializeShareableData(exportResult.data);

      const filePath = join(testDir, 'persistence-test.json');
      writeFileSync(filePath, result, 'utf8');

      // Verify file exists
      expect(existsSync(filePath)).toBe(true);

      // Read multiple times to verify persistence
      const read1 = readFileSync(filePath, 'utf8');
      const read2 = readFileSync(filePath, 'utf8');

      expect(read1).toBe(read2);
      expect(read1).toBe(result);
    });
  });

  // ============ Full E2E Flow ============

  describe('full E2E Flow - Complete Sharing Workflow', () => {
    it('should complete entire sharing workflow from export to import', async () => {
      // Scenario: User exports query, shares file, another user imports

      // Step 1: User A exports a query
      const userAQuery = {
        name: 'Sales Report',
        sql: 'SELECT product_name, SUM(quantity) as total_sold FROM sales GROUP BY product_name',
        description: 'Monthly sales report by product',
        tags: ['sales', 'reporting'],
        databaseContext: 'production_db',
        documentation: 'Run this at the end of each month for reporting',
      };

      const exportResult = await exportQuery(userAQuery);
      const { result: exportedData } = await serializeShareableData(
        exportResult.data
      );

      // Step 2: Save to shared location (simulate file sharing)
      const sharedFilePath = join(testDir, 'shared-sales-report.json');
      writeFileSync(sharedFilePath, exportedData, 'utf8');

      // Step 3: User B receives file and imports
      const receivedData = readFileSync(sharedFilePath, 'utf8');
      const importResult = await importQuery(receivedData);

      // Step 4: Verify User B has exact same query
      expect(importResult.query.name).toBe(userAQuery.name);
      expect(importResult.query.sql).toBe(userAQuery.sql);
      expect(importResult.query.description).toBe(userAQuery.description);
      expect(importResult.query.tags).toEqual(userAQuery.tags);
      expect(importResult.query.databaseContext).toBe(
        userAQuery.databaseContext
      );
      expect(importResult.query.documentation).toBe(userAQuery.documentation);

      // Step 5: Verify import validation
      expect(importResult.validation.valid).toBe(true);
      expect(importResult.validation.errors).toBeUndefined();

      // Step 6: Verify metadata
      expect(importResult.query.id).toBe(exportResult.data.id);
      expect(importResult.query.metadata.version).toBe('1.0.0');
      expect(importResult.query.metadata.exportedAt).toBeDefined();
    });

    it('should handle complete bundle sharing workflow', async () => {
      // Team sharing: Export bundle of related queries

      const teamBundle = {
        name: 'Database Maintenance Queries',
        description: 'Weekly database maintenance tasks',
        queries: [
          {
            id: '1',
            name: 'Vacuum Database',
            sql: 'VACUUM',
            description: 'Optimize database file',
          },
          {
            id: '2',
            name: 'Analyze Tables',
            sql: 'ANALYZE',
            description: 'Update query planner statistics',
          },
          {
            id: '3',
            name: 'Check Integrity',
            sql: 'PRAGMA integrity_check',
            description: 'Verify database integrity',
          },
        ],
        tags: ['maintenance', 'admin'],
        documentation: 'Run these queries every Sunday at 2 AM',
      };

      // Export bundle
      const exportResult = await exportBundle(teamBundle);
      const { result } = await serializeShareableData(exportResult.data);

      // Save and share
      const filePath = join(testDir, 'team-maintenance-bundle.json');
      writeFileSync(filePath, result, 'utf8');

      // Team member imports
      const importedData = readFileSync(filePath, 'utf8');
      const importResult = await importBundle(importedData);

      // Verify complete bundle
      expect(importResult.bundle.queries).toHaveLength(3);
      expect(importResult.bundle.name).toBe(teamBundle.name);
      expect(importResult.validation.valid).toBe(true);

      // Verify each query
      teamBundle.queries.forEach((originalQuery, index) => {
        const importedQuery = importResult.bundle.queries[index];
        expect(importedQuery.name).toBe(originalQuery.name);
        expect(importedQuery.sql).toBe(originalQuery.sql);
        expect(importedQuery.description).toBe(originalQuery.description);
      });
    });

    it('should handle schema migration workflow', async () => {
      // Scenario: Developer exports schema from dev DB to share with team

      const devSchema: SchemaInfo[] = [
        {
          name: 'main',
          tables: [
            {
              name: 'migrations',
              schema: 'main',
              type: 'table' as const,
              columns: [
                {
                  name: 'version',
                  type: 'INTEGER',
                  nullable: false,
                  defaultValue: null,
                  isPrimaryKey: true,
                },
                {
                  name: 'applied_at',
                  type: 'TEXT',
                  nullable: false,
                  defaultValue: null,
                  isPrimaryKey: false,
                },
              ],
              primaryKey: ['version'],
              foreignKeys: [],
              indexes: [],
              triggers: [],
              sql: 'CREATE TABLE migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)',
            },
          ],
          views: [],
        },
      ];

      const schemaExport = {
        name: 'Migration Schema v2.1',
        description: 'Updated schema with migration tracking',
        format: 'json' as const,
        schemas: devSchema,
        options: {
          format: 'json' as const,
          includeIndexes: true,
        },
        documentation: 'Apply this schema to staging and production',
      };

      // Export schema
      const exportResult = await exportSchema(schemaExport);
      const { result } = await serializeShareableData(exportResult.data);

      // Save to shared location
      const filePath = join(testDir, 'migration-schema-v2.1.json');
      writeFileSync(filePath, result, 'utf8');

      // Team member imports schema
      const importedData = readFileSync(filePath, 'utf8');
      const importResult = await importSchema(importedData);

      // Verify schema for application
      expect(importResult.schema.name).toBe(schemaExport.name);
      expect(importResult.schema.schemas![0].tables).toHaveLength(1);
      expect(importResult.schema.schemas![0].tables[0].name).toBe('migrations');
      expect(importResult.validation.valid).toBe(true);
    });
  });
});

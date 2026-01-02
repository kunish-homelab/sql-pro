/**
 * Tests for query and schema sharing service.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  exportQuery,
  exportSchema,
  exportBundle,
  generateSQLStatements,
  serializeShareableData,
  importQuery,
  importSchema,
  importBundle,
} from './query-schema-sharing';
import type { ShareableQuery, ShareableSchema, ShareableBundle } from '@shared/types';

describe('Query and Schema Sharing Service', () => {
  describe('exportQuery', () => {
    it('should export a valid query with metadata', async () => {
      const result = await exportQuery({
        name: 'Test Query',
        sql: 'SELECT * FROM users',
        description: 'A test query',
        tags: ['test', 'users'],
        databaseContext: 'test-db',
      });

      expect(result.data.id).toBeDefined();
      expect(result.data.name).toBe('Test Query');
      expect(result.data.sql).toBe('SELECT * FROM users');
      expect(result.data.metadata.version).toBe('1.0.0');
      expect(result.data.createdAt).toBeDefined();
    });

    it('should reject empty query name', async () => {
      await expect(
        exportQuery({
          name: '',
          sql: 'SELECT * FROM users',
        })
      ).rejects.toThrow('Query name cannot be empty');
    });

    it('should reject empty SQL', async () => {
      await expect(
        exportQuery({
          name: 'Test Query',
          sql: '',
        })
      ).rejects.toThrow('Query SQL cannot be empty');
    });

    it('should reject SQL with invalid keywords', async () => {
      await expect(
        exportQuery({
          name: 'Test Query',
          sql: 'INVALID QUERY',
        })
      ).rejects.toThrow('Query SQL must start with a valid SQL keyword');
    });

    it('should accept SQL with comments', async () => {
      const result = await exportQuery({
        name: 'Test Query',
        sql: '-- This is a comment\nSELECT * FROM users',
      });

      expect(result.data.sql).toBe('-- This is a comment\nSELECT * FROM users');
    });
  });

  describe('exportSchema', () => {
    it('should export a valid JSON format schema', async () => {
      const result = await exportSchema({
        name: 'Test Schema',
        format: 'json',
        schemas: [
          {
            name: 'main',
            tables: [
              {
                name: 'users',
                schema: 'main',
                type: 'table' as const,
                columns: [],
                primaryKey: [],
                foreignKeys: [],
                indexes: [],
                triggers: [],
                sql: 'CREATE TABLE users (id INTEGER PRIMARY KEY)',
              },
            ],
            views: [],
          },
        ],
        options: {
          format: 'json',
          includeIndexes: true,
        },
      });

      expect(result.data.id).toBeDefined();
      expect(result.data.name).toBe('Test Schema');
      expect(result.data.format).toBe('json');
      expect(result.data.schemas).toBeDefined();
      expect(result.data.schemas?.length).toBe(1);
      expect(result.data.metadata.version).toBe('1.0.0');
    });

    it('should export a valid SQL format schema', async () => {
      const result = await exportSchema({
        name: 'Test Schema',
        format: 'sql',
        sqlStatements: [
          'CREATE TABLE users (id INTEGER PRIMARY KEY)',
          'CREATE INDEX idx_users_id ON users(id)',
        ],
        options: {
          format: 'sql',
          includeIndexes: true,
        },
      });

      expect(result.data.id).toBeDefined();
      expect(result.data.name).toBe('Test Schema');
      expect(result.data.format).toBe('sql');
      expect(result.data.sqlStatements).toBeDefined();
      expect(result.data.sqlStatements?.length).toBe(2);
    });

    it('should reject empty schema name', async () => {
      await expect(
        exportSchema({
          name: '',
          format: 'json',
          schemas: [
            {
              name: 'main',
              tables: [
                {
                  name: 'users',
                  schema: 'main',
                  type: 'table' as const,
                  columns: [],
                  primaryKey: [],
                  foreignKeys: [],
                  indexes: [],
                  triggers: [],
                  sql: 'CREATE TABLE users (id INTEGER PRIMARY KEY)',
                },
              ],
              views: [],
            },
          ],
          options: { format: 'json' },
        })
      ).rejects.toThrow('Schema name cannot be empty');
    });

    it('should reject JSON format without schemas array', async () => {
      await expect(
        exportSchema({
          name: 'Test Schema',
          format: 'json',
          schemas: [],
          options: { format: 'json' },
        })
      ).rejects.toThrow('JSON format requires at least one schema in schemas array');
    });

    it('should reject JSON format with empty schemas', async () => {
      await expect(
        exportSchema({
          name: 'Test Schema',
          format: 'json',
          schemas: [
            {
              name: 'main',
              tables: [],
              views: [],
            },
          ],
          options: { format: 'json' },
        })
      ).rejects.toThrow('Schema must contain at least one table or view');
    });

    it('should reject SQL format without statements', async () => {
      await expect(
        exportSchema({
          name: 'Test Schema',
          format: 'sql',
          sqlStatements: [],
          options: { format: 'sql' },
        })
      ).rejects.toThrow('SQL format requires at least one SQL statement');
    });

    it('should reject format mismatch', async () => {
      await expect(
        exportSchema({
          name: 'Test Schema',
          format: 'json',
          schemas: [
            {
              name: 'main',
              tables: [
                {
                  name: 'users',
                  schema: 'main',
                  type: 'table' as const,
                  columns: [],
                  primaryKey: [],
                  foreignKeys: [],
                  indexes: [],
                  triggers: [],
                  sql: 'CREATE TABLE users (id INTEGER PRIMARY KEY)',
                },
              ],
              views: [],
            },
          ],
          options: { format: 'sql' }, // Mismatch: schema is JSON but options say SQL
        })
      ).rejects.toThrow('Format mismatch');
    });

    it('should validate description length', async () => {
      const longDescription = 'x'.repeat(1001);
      await expect(
        exportSchema({
          name: 'Test Schema',
          description: longDescription,
          format: 'json',
          schemas: [
            {
              name: 'main',
              tables: [
                {
                  name: 'users',
                  schema: 'main',
                  type: 'table' as const,
                  columns: [],
                  primaryKey: [],
                  foreignKeys: [],
                  indexes: [],
                  triggers: [],
                  sql: 'CREATE TABLE users (id INTEGER PRIMARY KEY)',
                },
              ],
              views: [],
            },
          ],
          options: { format: 'json' },
        })
      ).rejects.toThrow('Description cannot exceed 1000 characters');
    });
  });

  describe('generateSQLStatements', () => {
    it('should generate CREATE TABLE statements', () => {
      const schemas = [
        {
          name: 'main',
          tables: [
            {
              name: 'users',
              sql: 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)',
            },
          ],
          views: [],
        },
      ];

      const statements = generateSQLStatements(schemas, { includeComments: false });

      expect(statements).toContain('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);');
    });

    it('should include comments when requested', () => {
      const schemas = [
        {
          name: 'main',
          tables: [
            {
              name: 'users',
              sql: 'CREATE TABLE users (id INTEGER PRIMARY KEY)',
            },
          ],
          views: [],
        },
      ];

      const statements = generateSQLStatements(
        schemas,
        { includeComments: true },
        'Test documentation'
      );

      expect(statements.join('\n')).toContain('-- Test documentation');
      expect(statements.join('\n')).toContain('-- Table: users');
    });

    it('should include indexes when requested', () => {
      const schemas = [
        {
          name: 'main',
          tables: [
            {
              name: 'users',
              sql: 'CREATE TABLE users (id INTEGER PRIMARY KEY)',
              indexes: [
                {
                  name: 'idx_users_id',
                  sql: 'CREATE INDEX idx_users_id ON users(id)',
                },
              ],
            },
          ],
          views: [],
        },
      ];

      const statements = generateSQLStatements(schemas, {
        includeIndexes: true,
        includeComments: false,
      });

      expect(statements.join('\n')).toContain('CREATE INDEX idx_users_id ON users(id);');
    });

    it('should exclude indexes when not requested', () => {
      const schemas = [
        {
          name: 'main',
          tables: [
            {
              name: 'users',
              sql: 'CREATE TABLE users (id INTEGER PRIMARY KEY)',
              indexes: [
                {
                  name: 'idx_users_id',
                  sql: 'CREATE INDEX idx_users_id ON users(id)',
                },
              ],
            },
          ],
          views: [],
        },
      ];

      const statements = generateSQLStatements(schemas, {
        includeIndexes: false,
        includeComments: false,
      });

      expect(statements.join('\n')).not.toContain('CREATE INDEX');
    });

    it('should include triggers when requested', () => {
      const schemas = [
        {
          name: 'main',
          tables: [
            {
              name: 'users',
              sql: 'CREATE TABLE users (id INTEGER PRIMARY KEY)',
              triggers: [
                {
                  name: 'update_timestamp',
                  sql: 'CREATE TRIGGER update_timestamp AFTER UPDATE ON users BEGIN UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END',
                },
              ],
            },
          ],
          views: [],
        },
      ];

      const statements = generateSQLStatements(schemas, {
        includeTriggers: true,
        includeComments: false,
      });

      expect(statements.join('\n')).toContain('CREATE TRIGGER update_timestamp');
    });

    it('should handle views', () => {
      const schemas = [
        {
          name: 'main',
          tables: [],
          views: [
            {
              name: 'active_users',
              sql: 'CREATE VIEW active_users AS SELECT * FROM users WHERE active = 1',
            },
          ],
        },
      ];

      const statements = generateSQLStatements(schemas, { includeComments: false });

      expect(statements.join('\n')).toContain(
        'CREATE VIEW active_users AS SELECT * FROM users WHERE active = 1;'
      );
    });

    it('should handle multiple schemas', () => {
      const schemas = [
        {
          name: 'main',
          tables: [
            {
              name: 'users',
              sql: 'CREATE TABLE users (id INTEGER PRIMARY KEY)',
            },
          ],
          views: [],
        },
        {
          name: 'attached_db',
          tables: [
            {
              name: 'products',
              sql: 'CREATE TABLE products (id INTEGER PRIMARY KEY)',
            },
          ],
          views: [],
        },
      ];

      const statements = generateSQLStatements(schemas, { includeComments: true });

      expect(statements.join('\n')).toContain('-- Schema: attached_db');
      expect(statements.join('\n')).toContain('CREATE TABLE users');
      expect(statements.join('\n')).toContain('CREATE TABLE products');
    });
  });

  describe('serializeShareableData', () => {
    it('should serialize query without compression for small data', async () => {
      const query: ShareableQuery = {
        id: '123',
        name: 'Test Query',
        sql: 'SELECT * FROM users',
        createdAt: '2024-01-01T00:00:00Z',
        metadata: {
          version: '1.0.0',
          exportedAt: '2024-01-01T00:00:00Z',
          compressed: false,
        },
      };

      const result = await serializeShareableData(query);

      expect(result.compressionInfo).toBeUndefined();
      expect(result.result).toContain('"name": "Test Query"');
      expect(JSON.parse(result.result)).toEqual(query);
    });

    it('should compress large data', async () => {
      const largeSql = 'SELECT * FROM users WHERE ' + 'x'.repeat(200000);
      const query: ShareableQuery = {
        id: '123',
        name: 'Test Query',
        sql: largeSql,
        createdAt: '2024-01-01T00:00:00Z',
        metadata: {
          version: '1.0.0',
          exportedAt: '2024-01-01T00:00:00Z',
          compressed: false,
        },
      };

      const result = await serializeShareableData(query);

      expect(result.compressionInfo).toBeDefined();
      expect(result.compressionInfo?.compressed).toBe(true);
      expect(result.compressionInfo?.algorithm).toBe('gzip');
      expect(result.compressionInfo?.compressedSize).toBeLessThan(
        result.compressionInfo?.originalSize ?? 0
      );
    });
  });

  describe('importQuery', () => {
    it('should import a valid query', async () => {
      const originalQuery: ShareableQuery = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test Query',
        sql: 'SELECT * FROM users',
        createdAt: '2024-01-01T00:00:00Z',
        metadata: {
          version: '1.0.0',
          exportedAt: '2024-01-01T00:00:00Z',
        },
      };

      const serialized = JSON.stringify(originalQuery);
      const result = await importQuery(serialized);

      expect(result.validation.valid).toBe(true);
      expect(result.query.name).toBe('Test Query');
      expect(result.query.sql).toBe('SELECT * FROM users');
    });

    it('should reject invalid JSON', async () => {
      await expect(importQuery('invalid json')).rejects.toThrow('Invalid JSON format');
    });

    it('should reject missing required fields', async () => {
      const invalidQuery = JSON.stringify({
        id: '550e8400-e29b-41d4-a716-446655440000',
        // Missing name and sql
      });

      await expect(importQuery(invalidQuery)).rejects.toThrow('Schema validation failed');
    });
  });

  describe('importSchema', () => {
    it('should import a valid JSON format schema', async () => {
      const originalSchema: ShareableSchema = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Test Schema',
        format: 'json',
        schemas: [
          {
            name: 'main',
            tables: [
              {
                name: 'users',
                schema: 'main',
                type: 'table' as const,
                columns: [],
                primaryKey: [],
                foreignKeys: [],
                indexes: [],
                triggers: [],
                sql: 'CREATE TABLE users (id INTEGER PRIMARY KEY)',
              },
            ],
            views: [],
          },
        ],
        options: { format: 'json' },
        createdAt: '2024-01-01T00:00:00Z',
        metadata: {
          version: '1.0.0',
          exportedAt: '2024-01-01T00:00:00Z',
        },
      };

      const serialized = JSON.stringify(originalSchema);
      const result = await importSchema(serialized);

      expect(result.validation.valid).toBe(true);
      expect(result.schema.name).toBe('Test Schema');
      expect(result.schema.format).toBe('json');
    });

    it('should import a valid SQL format schema', async () => {
      const originalSchema: ShareableSchema = {
        id: '550e8400-e29b-41d4-a716-446655440002',
        name: 'Test Schema',
        format: 'sql',
        sqlStatements: ['CREATE TABLE users (id INTEGER PRIMARY KEY)'],
        options: { format: 'sql' },
        createdAt: '2024-01-01T00:00:00Z',
        metadata: {
          version: '1.0.0',
          exportedAt: '2024-01-01T00:00:00Z',
        },
      };

      const serialized = JSON.stringify(originalSchema);
      const result = await importSchema(serialized);

      expect(result.validation.valid).toBe(true);
      expect(result.schema.name).toBe('Test Schema');
      expect(result.schema.format).toBe('sql');
      expect(result.schema.sqlStatements?.length).toBe(1);
    });
  });

  describe('exportBundle', () => {
    it('should export a valid bundle', async () => {
      const result = await exportBundle({
        name: 'Test Bundle',
        queries: [
          {
            id: '1',
            name: 'Query 1',
            sql: 'SELECT * FROM users',
          },
          {
            id: '2',
            name: 'Query 2',
            sql: 'SELECT * FROM products',
          },
        ],
      });

      expect(result.data.id).toBeDefined();
      expect(result.data.name).toBe('Test Bundle');
      expect(result.data.queries.length).toBe(2);
      expect(result.data.metadata.version).toBe('1.0.0');
    });
  });

  describe('importBundle', () => {
    it('should import a valid bundle', async () => {
      const originalBundle: ShareableBundle = {
        id: '550e8400-e29b-41d4-a716-446655440003',
        name: 'Test Bundle',
        queries: [
          {
            id: '1',
            name: 'Query 1',
            sql: 'SELECT * FROM users',
          },
        ],
        createdAt: '2024-01-01T00:00:00Z',
        metadata: {
          version: '1.0.0',
          exportedAt: '2024-01-01T00:00:00Z',
        },
      };

      const serialized = JSON.stringify(originalBundle);
      const result = await importBundle(serialized);

      expect(result.validation.valid).toBe(true);
      expect(result.bundle.name).toBe('Test Bundle');
      expect(result.bundle.queries.length).toBe(1);
    });
  });
});

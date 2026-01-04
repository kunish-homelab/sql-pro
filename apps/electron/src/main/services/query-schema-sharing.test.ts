import type {
  ShareableBundle,
  ShareableQuery,
  ShareableSchema,
} from '@shared/types';
/**
 * Tests for query and schema sharing service.
 */
import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import {
  exportBundle,
  exportQuery,
  exportSchema,
  generateSQLStatements,
  importBundle,
  importQuery,
  importSchema,
  serializeShareableData,
} from './query-schema-sharing';

describe('query and Schema Sharing Service', () => {
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
      expect(result.data.metadata?.version).toBe('1.0.0');
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
      expect(result.data.metadata?.version).toBe('1.0.0');
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
      ).rejects.toThrow(
        'JSON format requires at least one schema in schemas array'
      );
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

      const statements = generateSQLStatements(schemas, {
        includeComments: false,
      });

      expect(statements).toContain(
        'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);'
      );
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

      expect(statements.join('\n')).toContain(
        'CREATE INDEX idx_users_id ON users(id);'
      );
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

      expect(statements.join('\n')).toContain(
        'CREATE TRIGGER update_timestamp'
      );
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

      const statements = generateSQLStatements(schemas, {
        includeComments: false,
      });

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

      const statements = generateSQLStatements(schemas, {
        includeComments: true,
      });

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
      const largeSql = `SELECT * FROM users WHERE ${'x'.repeat(200000)}`;
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
      await expect(importQuery('invalid json')).rejects.toThrow(
        'Invalid JSON format'
      );
    });

    it('should reject missing required fields', async () => {
      const invalidQuery = JSON.stringify({
        id: '550e8400-e29b-41d4-a716-446655440000',
        // Missing name and sql
      });

      await expect(importQuery(invalidQuery)).rejects.toThrow(
        'Schema validation failed'
      );
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
      expect(result.data.queries?.length).toBe(2);
      expect(result.data.metadata?.version).toBe('1.0.0');
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
      expect(result.bundle.queries?.length).toBe(1);
    });
  });

  describe('import Validation Enhancements', () => {
    describe('sQL Safety Validation', () => {
      it('should warn about DROP statements', async () => {
        const query: ShareableQuery = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Dangerous Query',
          sql: 'DROP TABLE users',
          createdAt: '2024-01-01T00:00:00Z',
          metadata: {
            version: '1.0.0',
            exportedAt: '2024-01-01T00:00:00Z',
          },
        };

        const result = await importQuery(JSON.stringify(query));

        expect(result.validation.valid).toBe(true);
        expect(result.validation.warnings).toBeDefined();
        expect(result.validation.warnings).toContain(
          'Query contains DROP statement - use caution when executing'
        );
      });

      it('should warn about DELETE without WHERE', async () => {
        const query: ShareableQuery = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Delete All Query',
          sql: 'DELETE FROM users',
          createdAt: '2024-01-01T00:00:00Z',
          metadata: {
            version: '1.0.0',
            exportedAt: '2024-01-01T00:00:00Z',
          },
        };

        const result = await importQuery(JSON.stringify(query));

        expect(result.validation.valid).toBe(true);
        expect(result.validation.warnings).toBeDefined();
        expect(result.validation.warnings).toContain(
          'Query contains DELETE without WHERE clause - this will delete all rows'
        );
      });

      it('should warn about UPDATE without WHERE', async () => {
        const query: ShareableQuery = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Update All Query',
          sql: 'UPDATE users SET active = 1',
          createdAt: '2024-01-01T00:00:00Z',
          metadata: {
            version: '1.0.0',
            exportedAt: '2024-01-01T00:00:00Z',
          },
        };

        const result = await importQuery(JSON.stringify(query));

        expect(result.validation.valid).toBe(true);
        expect(result.validation.warnings).toBeDefined();
        expect(result.validation.warnings).toContain(
          'Query contains UPDATE without WHERE clause - this will update all rows'
        );
      });

      it('should warn about PRAGMA statements', async () => {
        const query: ShareableQuery = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Pragma Query',
          sql: 'PRAGMA foreign_keys = ON',
          createdAt: '2024-01-01T00:00:00Z',
          metadata: {
            version: '1.0.0',
            exportedAt: '2024-01-01T00:00:00Z',
          },
        };

        const result = await importQuery(JSON.stringify(query));

        expect(result.validation.valid).toBe(true);
        expect(result.validation.warnings).toBeDefined();
        expect(result.validation.warnings).toContain(
          'Query contains PRAGMA statement - ensure you understand the implications'
        );
      });

      it('should not warn about safe UPDATE with WHERE', async () => {
        const query: ShareableQuery = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Safe Update',
          sql: 'UPDATE users SET active = 1 WHERE id = 5',
          createdAt: '2024-01-01T00:00:00Z',
          metadata: {
            version: '1.0.0',
            exportedAt: '2024-01-01T00:00:00Z',
          },
        };

        const result = await importQuery(JSON.stringify(query));

        expect(result.validation.valid).toBe(true);
        const updateWarnings = result.validation.warnings?.filter((w) =>
          w.includes('UPDATE without WHERE')
        );
        expect(updateWarnings?.length || 0).toBe(0);
      });
    });

    describe('field Length Validations', () => {
      it('should reject oversized query name via Zod validation', async () => {
        const query = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'x'.repeat(250),
          sql: 'SELECT * FROM users',
          createdAt: '2024-01-01T00:00:00Z',
          metadata: {
            version: '1.0.0',
            exportedAt: '2024-01-01T00:00:00Z',
          },
        };

        // Zod schema validation catches this before custom validation
        await expect(importQuery(JSON.stringify(query))).rejects.toThrow(
          'Schema validation failed'
        );
      });

      it('should warn about oversized tags', async () => {
        const query: ShareableQuery = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Test Query',
          sql: 'SELECT * FROM users',
          tags: ['x'.repeat(60), 'valid-tag'],
          createdAt: '2024-01-01T00:00:00Z',
          metadata: {
            version: '1.0.0',
            exportedAt: '2024-01-01T00:00:00Z',
          },
        };

        const result = await importQuery(JSON.stringify(query));

        expect(result.validation.valid).toBe(true);
        expect(result.validation.warnings).toBeDefined();
        const tagWarning = result.validation.warnings?.find((w) =>
          w.includes('exceeds 50 characters')
        );
        expect(tagWarning).toBeDefined();
      });

      it('should warn about empty tags', async () => {
        const query: ShareableQuery = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Test Query',
          sql: 'SELECT * FROM users',
          tags: ['valid-tag', '', 'another-tag'],
          createdAt: '2024-01-01T00:00:00Z',
          metadata: {
            version: '1.0.0',
            exportedAt: '2024-01-01T00:00:00Z',
          },
        };

        const result = await importQuery(JSON.stringify(query));

        expect(result.validation.valid).toBe(true);
        expect(result.validation.warnings).toBeDefined();
        const tagWarning = result.validation.warnings?.find((w) =>
          w.includes('Tag at index 1 is empty')
        );
        expect(tagWarning).toBeDefined();
      });

      it('should warn about oversized schema description', async () => {
        const schema: ShareableSchema = {
          id: '550e8400-e29b-41d4-a716-446655440001',
          name: 'Test Schema',
          description: 'x'.repeat(1100),
          format: 'sql',
          sqlStatements: ['CREATE TABLE users (id INTEGER)'],
          options: { format: 'sql' },
          createdAt: '2024-01-01T00:00:00Z',
          metadata: {
            version: '1.0.0',
            exportedAt: '2024-01-01T00:00:00Z',
          },
        };

        const result = await importSchema(JSON.stringify(schema));

        expect(result.validation.valid).toBe(true);
        expect(result.validation.warnings).toContain(
          'Description exceeds 1000 characters and may be truncated'
        );
      });
    });

    describe('sQL Comment-Only Validation', () => {
      it('should invalidate query with only comments', async () => {
        const query: ShareableQuery = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Comment Only Query',
          sql: '-- This is just a comment\n/* Another comment */',
          createdAt: '2024-01-01T00:00:00Z',
          metadata: {
            version: '1.0.0',
            exportedAt: '2024-01-01T00:00:00Z',
          },
        };

        const result = await importQuery(JSON.stringify(query));

        expect(result.validation.valid).toBe(false);
        expect(result.validation.errors).toContain(
          'Query SQL contains only comments - no executable statements'
        );
      });

      it('should invalidate bundle query with only comments', async () => {
        const bundle: ShareableBundle = {
          id: '550e8400-e29b-41d4-a716-446655440003',
          name: 'Test Bundle',
          queries: [
            {
              id: '1',
              name: 'Comment Query',
              sql: '-- Just a comment',
            },
          ],
          createdAt: '2024-01-01T00:00:00Z',
          metadata: {
            version: '1.0.0',
            exportedAt: '2024-01-01T00:00:00Z',
          },
        };

        const result = await importBundle(JSON.stringify(bundle));

        expect(result.validation.valid).toBe(false);
        expect(result.validation.errors).toBeDefined();
        const commentError = result.validation.errors?.find((e) =>
          e.includes('contains only comments - no executable statements')
        );
        expect(commentError).toBeDefined();
      });
    });

    describe('timestamp Validation', () => {
      it('should warn about invalid createdAt timestamp', async () => {
        const query: ShareableQuery = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Test Query',
          sql: 'SELECT * FROM users',
          createdAt: 'not-a-valid-timestamp',
          metadata: {
            version: '1.0.0',
            exportedAt: '2024-01-01T00:00:00Z',
          },
        };

        const result = await importQuery(JSON.stringify(query));

        expect(result.validation.valid).toBe(true);
        expect(result.validation.warnings).toContain(
          'Invalid createdAt timestamp format'
        );
      });

      it('should warn about invalid modifiedAt timestamp', async () => {
        const query: ShareableQuery = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Test Query',
          sql: 'SELECT * FROM users',
          createdAt: '2024-01-01T00:00:00Z',
          modifiedAt: 'invalid-date',
          metadata: {
            version: '1.0.0',
            exportedAt: '2024-01-01T00:00:00Z',
          },
        };

        const result = await importQuery(JSON.stringify(query));

        expect(result.validation.valid).toBe(true);
        expect(result.validation.warnings).toContain(
          'Invalid modifiedAt timestamp format'
        );
      });
    });

    describe('bundle Query Validation', () => {
      it('should validate each query in bundle with SQL safety checks', async () => {
        const bundle: ShareableBundle = {
          id: '550e8400-e29b-41d4-a716-446655440003',
          name: 'Test Bundle',
          queries: [
            {
              id: '1',
              name: 'Safe Query',
              sql: 'SELECT * FROM users',
            },
            {
              id: '2',
              name: 'Dangerous Query',
              sql: 'DROP TABLE users',
            },
          ],
          createdAt: '2024-01-01T00:00:00Z',
          metadata: {
            version: '1.0.0',
            exportedAt: '2024-01-01T00:00:00Z',
          },
        };

        const result = await importBundle(JSON.stringify(bundle));

        expect(result.validation.valid).toBe(true);
        expect(result.validation.warnings).toBeDefined();
        const dropWarning = result.validation.warnings?.find((w) =>
          w.includes('Query 2 (Dangerous Query): Query contains DROP statement')
        );
        expect(dropWarning).toBeDefined();
      });

      it('should validate bundle query tags', async () => {
        const bundle: ShareableBundle = {
          id: '550e8400-e29b-41d4-a716-446655440003',
          name: 'Test Bundle',
          queries: [
            {
              id: '1',
              name: 'Tagged Query',
              sql: 'SELECT * FROM users',
              tags: ['valid', '', 'x'.repeat(60)],
            },
          ],
          createdAt: '2024-01-01T00:00:00Z',
          metadata: {
            version: '1.0.0',
            exportedAt: '2024-01-01T00:00:00Z',
          },
        };

        const result = await importBundle(JSON.stringify(bundle));

        expect(result.validation.valid).toBe(true);
        expect(result.validation.warnings).toBeDefined();
        const emptyTagWarning = result.validation.warnings?.find((w) =>
          w.includes('tag at index 1 is empty')
        );
        const longTagWarning = result.validation.warnings?.find((w) =>
          w.includes('exceeds 50 characters')
        );
        expect(emptyTagWarning).toBeDefined();
        expect(longTagWarning).toBeDefined();
      });
    });

    describe('schema Format Validation', () => {
      it('should invalidate JSON schema with no tables or views', async () => {
        const schema: ShareableSchema = {
          id: '550e8400-e29b-41d4-a716-446655440001',
          name: 'Empty Schema',
          format: 'json',
          schemas: [
            {
              name: 'main',
              tables: [],
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

        const result = await importSchema(JSON.stringify(schema));

        expect(result.validation.valid).toBe(false);
        expect(result.validation.errors).toBeDefined();
        const emptySchemaError = result.validation.errors?.find((e) =>
          e.includes('Schema must contain at least one table or view')
        );
        expect(emptySchemaError).toBeDefined();
      });

      it('should invalidate SQL schema with all empty statements', async () => {
        const schema: ShareableSchema = {
          id: '550e8400-e29b-41d4-a716-446655440001',
          name: 'Empty SQL Schema',
          format: 'sql',
          sqlStatements: ['', '  ', '\n'],
          options: { format: 'sql' },
          createdAt: '2024-01-01T00:00:00Z',
          metadata: {
            version: '1.0.0',
            exportedAt: '2024-01-01T00:00:00Z',
          },
        };

        const result = await importSchema(JSON.stringify(schema));

        expect(result.validation.valid).toBe(false);
        expect(result.validation.errors).toBeDefined();
        const emptyStmtsError = result.validation.errors?.find((e) =>
          e.includes('All SQL statements are empty')
        );
        expect(emptyStmtsError).toBeDefined();
      });

      it('should warn about empty SQL statements but not fail', async () => {
        const schema: ShareableSchema = {
          id: '550e8400-e29b-41d4-a716-446655440001',
          name: 'Mixed SQL Schema',
          format: 'sql',
          sqlStatements: [
            'CREATE TABLE users (id INTEGER)',
            '',
            'CREATE TABLE posts (id INTEGER)',
          ],
          options: { format: 'sql' },
          createdAt: '2024-01-01T00:00:00Z',
          metadata: {
            version: '1.0.0',
            exportedAt: '2024-01-01T00:00:00Z',
          },
        };

        const result = await importSchema(JSON.stringify(schema));

        expect(result.validation.valid).toBe(true);
        expect(result.validation.warnings).toBeDefined();
        const emptyStmtWarning = result.validation.warnings?.find((w) =>
          w.includes('SQL statement at index 1 is empty')
        );
        expect(emptyStmtWarning).toBeDefined();
      });
    });
  });

  describe('version Compatibility Validation', () => {
    it('should reject query with invalid version format', async () => {
      const query = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test Query',
        sql: 'SELECT * FROM users',
        createdAt: '2024-01-01T00:00:00Z',
        metadata: {
          version: 'invalid-version',
          exportedAt: '2024-01-01T00:00:00Z',
        },
      };

      // Zod validation catches invalid version format before custom validation
      await expect(importQuery(JSON.stringify(query))).rejects.toThrow(
        'Schema validation failed'
      );
    });

    it('should reject query with missing version', async () => {
      const query = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test Query',
        sql: 'SELECT * FROM users',
        createdAt: '2024-01-01T00:00:00Z',
        metadata: {
          exportedAt: '2024-01-01T00:00:00Z',
        },
      };

      await expect(importQuery(JSON.stringify(query))).rejects.toThrow(
        'Schema validation failed'
      );
    });

    it('should reject query with incompatible major version', async () => {
      const query: ShareableQuery = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test Query',
        sql: 'SELECT * FROM users',
        createdAt: '2024-01-01T00:00:00Z',
        metadata: {
          version: '2.0.0', // Major version 2 vs current 1
          exportedAt: '2024-01-01T00:00:00Z',
        },
      };

      const result = await importQuery(JSON.stringify(query));

      expect(result.validation.valid).toBe(false);
      expect(result.validation.errors).toBeDefined();
      const versionError = result.validation.errors?.find((e) =>
        e.includes('Incompatible version')
      );
      expect(versionError).toBeDefined();
      expect(versionError).toContain('Major versions must match');
    });

    it('should warn about minor version mismatch but still import', async () => {
      const query: ShareableQuery = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test Query',
        sql: 'SELECT * FROM users',
        createdAt: '2024-01-01T00:00:00Z',
        metadata: {
          version: '1.1.0', // Minor version 1 vs current 0
          exportedAt: '2024-01-01T00:00:00Z',
        },
      };

      const result = await importQuery(JSON.stringify(query));

      expect(result.validation.valid).toBe(true);
      expect(result.validation.warnings).toBeDefined();
      const versionWarning = result.validation.warnings?.find((w) =>
        w.includes('Version mismatch')
      );
      expect(versionWarning).toBeDefined();
      expect(versionWarning).toContain('Import should still work');
    });

    it('should warn about patch version mismatch but still import', async () => {
      const query: ShareableQuery = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test Query',
        sql: 'SELECT * FROM users',
        createdAt: '2024-01-01T00:00:00Z',
        metadata: {
          version: '1.0.1', // Patch version 1 vs current 0
          exportedAt: '2024-01-01T00:00:00Z',
        },
      };

      const result = await importQuery(JSON.stringify(query));

      expect(result.validation.valid).toBe(true);
      expect(result.validation.warnings).toBeDefined();
      const versionWarning = result.validation.warnings?.find((w) =>
        w.includes('Version mismatch')
      );
      expect(versionWarning).toBeDefined();
    });

    it('should accept matching version without warnings', async () => {
      const query: ShareableQuery = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test Query',
        sql: 'SELECT * FROM users',
        createdAt: '2024-01-01T00:00:00Z',
        metadata: {
          version: '1.0.0', // Exact match
          exportedAt: '2024-01-01T00:00:00Z',
        },
      };

      const result = await importQuery(JSON.stringify(query));

      expect(result.validation.valid).toBe(true);
      // No version-related warnings
      const versionWarnings = result.validation.warnings?.filter((w) =>
        w.includes('version')
      );
      expect(versionWarnings?.length || 0).toBe(0);
    });

    it('should reject schema with incompatible major version', async () => {
      const schema: ShareableSchema = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Test Schema',
        format: 'sql',
        sqlStatements: ['CREATE TABLE users (id INTEGER)'],
        options: { format: 'sql' },
        createdAt: '2024-01-01T00:00:00Z',
        metadata: {
          version: '3.0.0', // Major version 3 vs current 1
          exportedAt: '2024-01-01T00:00:00Z',
        },
      };

      const result = await importSchema(JSON.stringify(schema));

      expect(result.validation.valid).toBe(false);
      expect(result.validation.errors).toBeDefined();
      const versionError = result.validation.errors?.find((e) =>
        e.includes('Incompatible version')
      );
      expect(versionError).toBeDefined();
    });

    it('should reject bundle with incompatible major version', async () => {
      const bundle: ShareableBundle = {
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
          version: '0.5.0', // Major version 0 vs current 1
          exportedAt: '2024-01-01T00:00:00Z',
        },
      };

      const result = await importBundle(JSON.stringify(bundle));

      expect(result.validation.valid).toBe(false);
      expect(result.validation.errors).toBeDefined();
      const versionError = result.validation.errors?.find((e) =>
        e.includes('Incompatible version')
      );
      expect(versionError).toBeDefined();
    });
  });

  describe('additional Edge Cases', () => {
    it('should handle corrupt compressed data gracefully', async () => {
      // Create invalid base64 that looks like gzip header but is corrupted
      const corruptData = Buffer.from([
        0x1F, 0x8B, 0x00, 0xFF, 0xFF, 0xFF,
      ]).toString('base64');

      await expect(importQuery(corruptData)).rejects.toThrow();
    });

    it('should reject empty data', async () => {
      await expect(importQuery('')).rejects.toThrow('Import data is empty');
    });

    it('should reject null data', async () => {
      await expect(importQuery(JSON.stringify(null))).rejects.toThrow();
    });

    it('should reject array instead of object', async () => {
      await expect(
        importQuery(JSON.stringify([{ name: 'test' }]))
      ).rejects.toThrow();
    });

    it('should handle extremely long query names via Zod validation', async () => {
      const query = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'x'.repeat(500),
        sql: 'SELECT * FROM users',
        createdAt: '2024-01-01T00:00:00Z',
        metadata: {
          version: '1.0.0',
          exportedAt: '2024-01-01T00:00:00Z',
        },
      };

      await expect(importQuery(JSON.stringify(query))).rejects.toThrow(
        'Schema validation failed'
      );
    });

    it('should handle SQL injection patterns in query without treating them as dangerous during import', async () => {
      // Note: Import validation focuses on structure, not SQL injection prevention
      // Actual SQL injection prevention happens during query execution
      const query: ShareableQuery = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Potential Injection',
        sql: "SELECT * FROM users WHERE name = '' OR '1'='1'",
        createdAt: '2024-01-01T00:00:00Z',
        metadata: {
          version: '1.0.0',
          exportedAt: '2024-01-01T00:00:00Z',
        },
      };

      const result = await importQuery(JSON.stringify(query));

      // Should import successfully - SQL injection prevention is not part of import validation
      expect(result.validation.valid).toBe(true);
      expect(result.query.sql).toBe(
        "SELECT * FROM users WHERE name = '' OR '1'='1'"
      );
    });

    it('should handle query with special Unicode characters', async () => {
      const query: ShareableQuery = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Unicode Test 你好 🚀',
        sql: 'SELECT * FROM users WHERE name = "测试"',
        description: 'Test with émojis and åccents',
        createdAt: '2024-01-01T00:00:00Z',
        metadata: {
          version: '1.0.0',
          exportedAt: '2024-01-01T00:00:00Z',
        },
      };

      const serialized = JSON.stringify(query);
      const result = await importQuery(serialized);

      expect(result.validation.valid).toBe(true);
      expect(result.query.name).toBe('Unicode Test 你好 🚀');
      expect(result.query.description).toBe('Test with émojis and åccents');
    });

    it('should handle bundle with no queries via Zod validation', async () => {
      const bundle = {
        id: '550e8400-e29b-41d4-a716-446655440003',
        name: 'Empty Bundle',
        queries: [], // Empty queries array
        createdAt: '2024-01-01T00:00:00Z',
        metadata: {
          version: '1.0.0',
          exportedAt: '2024-01-01T00:00:00Z',
        },
      };

      await expect(importBundle(JSON.stringify(bundle))).rejects.toThrow(
        'Schema validation failed'
      );
    });

    it('should handle schema with format mismatch between format field and data', async () => {
      const schema: ShareableSchema = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Mismatched Schema',
        format: 'json', // Says JSON
        sqlStatements: ['CREATE TABLE users (id INTEGER)'], // But provides SQL
        // schemas array is missing
        options: { format: 'json' },
        createdAt: '2024-01-01T00:00:00Z',
        metadata: {
          version: '1.0.0',
          exportedAt: '2024-01-01T00:00:00Z',
        },
      };

      const result = await importSchema(JSON.stringify(schema));

      expect(result.validation.valid).toBe(false);
      expect(result.validation.errors).toBeDefined();
      expect(result.validation.errors!.length).toBeGreaterThan(0);
      // Check that some validation error was caught
      const hasFormatError = result.validation.errors?.some(
        (e) =>
          e.toLowerCase().includes('schema') ||
          e.toLowerCase().includes('format')
      );
      expect(hasFormatError).toBe(true);
    });
  });

  describe('compression (100KB threshold)', () => {
    it('should not compress data smaller than 100KB', async () => {
      const query = await exportQuery({
        name: 'Small Query',
        sql: 'SELECT * FROM users WHERE id = 1',
        description: 'A small test query',
      });

      const serialized = await serializeShareableData(query.data);

      expect(serialized.compressionInfo).toBeUndefined();
      expect(serialized.result).toContain('"name": "Small Query"');
      // Should be valid JSON
      expect(() => JSON.parse(serialized.result)).not.toThrow();
    });

    it('should automatically compress data larger than 100KB', async () => {
      // Create a query with SQL larger than 100KB
      // Need to account for the entire JSON structure size, not just SQL
      const largeSql = `SELECT * FROM users WHERE id IN (${'12345,'.repeat(50000)}1)`;
      const query = await exportQuery({
        name: 'Large Query',
        sql: largeSql,
        description: 'A large test query with many values',
      });

      const serialized = await serializeShareableData(query.data);

      expect(serialized.compressionInfo).toBeDefined();
      expect(serialized.compressionInfo?.compressed).toBe(true);
      expect(serialized.compressionInfo?.algorithm).toBe('gzip');
      expect(serialized.compressionInfo?.originalSize).toBeGreaterThanOrEqual(
        100 * 1024
      );
      expect(serialized.compressionInfo?.compressedSize).toBeLessThan(
        serialized.compressionInfo?.originalSize ?? 0
      );
      // Should be base64 encoded, not plain JSON
      expect(() => JSON.parse(serialized.result)).toThrow();
    });

    it('should compress data right at the 100KB threshold', async () => {
      // Create exactly 100KB of data
      const targetSize = 100 * 1024;
      const baseSql = 'SELECT * FROM users WHERE ';
      const query = await exportQuery({
        name: 'Threshold Query',
        sql: baseSql + 'x'.repeat(targetSize - 200), // Account for other JSON fields
      });

      const serialized = await serializeShareableData(query.data);

      // Should be compressed since it's >= threshold
      expect(serialized.compressionInfo).toBeDefined();
      expect(serialized.compressionInfo?.compressed).toBe(true);
    });

    it('should decompress and import compressed queries correctly', async () => {
      const largeSql = `SELECT * FROM users WHERE name LIKE ${"'test%' OR ".repeat(30000)}'end'`;
      const query = await exportQuery({
        name: 'Large Compressed Query',
        sql: largeSql,
        description: 'Large query that will be compressed',
        tags: ['large', 'test'],
        databaseContext: 'production',
      });

      // Serialize with compression
      const serialized = await serializeShareableData(query.data);
      expect(serialized.compressionInfo?.compressed).toBe(true);

      // Import the compressed data
      const imported = await importQuery(serialized.result);

      expect(imported.validation.valid).toBe(true);
      expect(imported.validation.compressionInfo?.compressed).toBe(true);
      expect(imported.validation.compressionInfo?.algorithm).toBe('gzip');
      expect(imported.query.name).toBe('Large Compressed Query');
      expect(imported.query.sql).toBe(largeSql);
      expect(imported.query.description).toBe(
        'Large query that will be compressed'
      );
      expect(imported.query.tags).toEqual(['large', 'test']);
    });

    it('should decompress and import compressed schemas correctly', async () => {
      // Create a large schema with many tables
      const tables = Array.from({ length: 100 }, (_, i) => ({
        name: `table_${i}`,
        schema: 'main',
        type: 'table' as const,
        columns: Array.from({ length: 50 }, (_, j) => ({
          name: `column_${j}`,
          type: 'TEXT',
          nullable: true,
          defaultValue: null,
          isPrimaryKey: false,
        })),
        primaryKey: ['id'],
        foreignKeys: [],
        indexes: [],
        triggers: [],
        sql: `CREATE TABLE table_${i} (id INTEGER PRIMARY KEY, ${Array.from({ length: 50 }, (_, j) => `column_${j} TEXT`).join(', ')})`,
      }));

      const schema = await exportSchema({
        name: 'Large Schema',
        format: 'json',
        schemas: [{ name: 'main', tables, views: [] }],
        description: 'A large schema export',
        options: { format: 'json', includeIndexes: true },
      });

      // Serialize with compression (should auto-compress due to size)
      const serialized = await serializeShareableData(schema.data);
      expect(serialized.compressionInfo?.compressed).toBe(true);

      // Import the compressed data
      const imported = await importSchema(serialized.result);

      expect(imported.validation.valid).toBe(true);
      expect(imported.validation.compressionInfo?.compressed).toBe(true);
      expect(imported.schema.name).toBe('Large Schema');
      expect(imported.schema.schemas?.[0]?.tables.length).toBe(100);
    });

    it('should decompress and import compressed bundles correctly', async () => {
      // Create a bundle with many large queries
      const queries = Array.from({ length: 50 }, (_, i) => ({
        id: `query-${i}`,
        name: `Query ${i}`,
        sql: `SELECT * FROM users WHERE ${`id = ${i} AND name LIKE '%test%' `.repeat(500)}`,
        notes: `Query notes ${i}`,
        tags: ['tag1', 'tag2'],
      }));

      const bundle = await exportBundle({
        name: 'Large Bundle',
        queries,
        description: 'A bundle with many queries',
      });

      // Serialize with compression
      const serialized = await serializeShareableData(bundle.data);
      expect(serialized.compressionInfo?.compressed).toBe(true);

      // Import the compressed data
      const imported = await importBundle(serialized.result);

      expect(imported.validation.valid).toBe(true);
      expect(imported.validation.compressionInfo?.compressed).toBe(true);
      expect(imported.bundle.name).toBe('Large Bundle');
      expect(imported.bundle.queries?.length).toBe(50);
    });

    it('should handle forced compression for small data', async () => {
      const query = await exportQuery({
        name: 'Small Query',
        sql: 'SELECT * FROM users',
      });

      // Force compression even though data is small
      const serialized = await serializeShareableData(query.data, true);

      expect(serialized.compressionInfo?.compressed).toBe(true);
      expect(serialized.compressionInfo?.algorithm).toBe('gzip');

      // Import should still work
      const imported = await importQuery(serialized.result);
      expect(imported.validation.valid).toBe(true);
      expect(imported.query.name).toBe('Small Query');
    });

    it('should handle disabled compression for large data', async () => {
      const largeSql = `SELECT * FROM users WHERE id IN (${'1,'.repeat(30000)}1)`;
      const query = await exportQuery({
        name: 'Large Query',
        sql: largeSql,
      });

      // Disable compression even though data is large
      const serialized = await serializeShareableData(query.data, false);

      expect(serialized.compressionInfo).toBeUndefined();
      // Should be valid JSON
      expect(() => JSON.parse(serialized.result)).not.toThrow();

      // Import should still work
      const imported = await importQuery(serialized.result);
      expect(imported.validation.valid).toBe(true);
      expect(imported.query.name).toBe('Large Query');
    });

    it('should preserve metadata compression flag after compression', async () => {
      const largeSql = `SELECT * FROM users WHERE ${'id = 1 OR '.repeat(20000)}id = 2`;
      const query = await exportQuery({
        name: 'Large Query',
        sql: largeSql,
      });

      const serialized = await serializeShareableData(query.data);
      const imported = await importQuery(serialized.result);

      // The imported query should have compressed flag in metadata
      expect(imported.query.metadata?.compressed).toBe(true);
    });

    it('should report accurate compression statistics', async () => {
      // Create data with high compressibility (repeated pattern)
      const repetitiveSql = `${'SELECT * FROM users WHERE name = "test" AND '.repeat(10000)}id = 1`;
      const query = await exportQuery({
        name: 'Repetitive Query',
        sql: repetitiveSql,
      });

      const serialized = await serializeShareableData(query.data);

      expect(serialized.compressionInfo).toBeDefined();
      expect(serialized.compressionInfo?.originalSize).toBeGreaterThan(
        100 * 1024
      );
      expect(serialized.compressionInfo?.compressedSize).toBeLessThan(
        serialized.compressionInfo?.originalSize ?? 0
      );
      // High compression ratio expected for repetitive data
      const compressionRatio =
        (serialized.compressionInfo?.compressedSize ?? 0) /
        (serialized.compressionInfo?.originalSize ?? 1);
      expect(compressionRatio).toBeLessThan(0.1); // Should compress to less than 10% of original
    });
  });
});

import type { PendingChange } from './collections';
import { describe, expect, it } from 'vitest';
import {
  generateSQLForChange,
  generateSQLForChanges,
  generateSQLScript,
} from './sql-generator';

describe('sql-generator', () => {
  describe('generateSQLForChange', () => {
    it('should generate INSERT statement', () => {
      const change: PendingChange = {
        id: 'test-1',
        table: 'users',
        schema: 'main',
        rowId: -1,
        type: 'insert',
        oldValues: null,
        newValues: { name: 'John', age: 30 },
        timestamp: new Date(),
        isValid: true,
      };

      const sql = generateSQLForChange(change);
      expect(sql).toBe(
        'INSERT INTO "users" ("name", "age") VALUES (\'John\', 30);'
      );
    });

    it('should generate INSERT statement for non-main schema', () => {
      const change: PendingChange = {
        id: 'test-1',
        table: 'users',
        schema: 'temp',
        rowId: -1,
        type: 'insert',
        oldValues: null,
        newValues: { name: 'John' },
        timestamp: new Date(),
        isValid: true,
      };

      const sql = generateSQLForChange(change);
      expect(sql).toBe(
        'INSERT INTO "temp"."users" ("name") VALUES (\'John\');'
      );
    });

    it('should generate UPDATE statement with explicit primaryKeyColumn', () => {
      const change: PendingChange = {
        id: 'test-2',
        table: 'users',
        schema: 'main',
        rowId: 1,
        type: 'update',
        oldValues: { name: 'John', age: 30 },
        newValues: { name: 'Jane', age: 25 },
        primaryKeyColumn: 'id',
        timestamp: new Date(),
        isValid: true,
      };

      const sql = generateSQLForChange(change);
      expect(sql).toBe(
        'UPDATE "users" SET "name" = \'Jane\', "age" = 25 WHERE "id" = 1;'
      );
    });

    it('should generate UPDATE statement by inferring id column', () => {
      const change: PendingChange = {
        id: 'test-2',
        table: 'users',
        schema: 'main',
        rowId: 1,
        type: 'update',
        oldValues: { id: 1, name: 'John' },
        newValues: { name: 'Jane' },
        timestamp: new Date(),
        isValid: true,
      };

      const sql = generateSQLForChange(change);
      expect(sql).toBe('UPDATE "users" SET "name" = \'Jane\' WHERE "id" = 1;');
    });

    it('should generate UPDATE statement using rowid as fallback', () => {
      const change: PendingChange = {
        id: 'test-2',
        table: 'users',
        schema: 'main',
        rowId: 42,
        type: 'update',
        oldValues: { name: 'John' },
        newValues: { name: 'Jane' },
        timestamp: new Date(),
        isValid: true,
      };

      const sql = generateSQLForChange(change);
      // When no pk column can be inferred, it should use rowid (commented for safety)
      expect(sql).toContain('UPDATE');
      expect(sql).toContain('rowid = 42');
    });

    it('should generate DELETE statement', () => {
      const change: PendingChange = {
        id: 'test-3',
        table: 'users',
        schema: 'main',
        rowId: 1,
        type: 'delete',
        oldValues: { name: 'John', age: 30 },
        newValues: null,
        primaryKeyColumn: 'id',
        timestamp: new Date(),
        isValid: true,
      };

      const sql = generateSQLForChange(change);
      expect(sql).toBe('DELETE FROM "users" WHERE "id" = 1;');
    });

    it('should generate DELETE statement with inferred id column', () => {
      const change: PendingChange = {
        id: 'test-3',
        table: 'users',
        schema: 'main',
        rowId: 1,
        type: 'delete',
        oldValues: { id: 1, name: 'John' },
        newValues: null,
        timestamp: new Date(),
        isValid: true,
      };

      const sql = generateSQLForChange(change);
      expect(sql).toBe('DELETE FROM "users" WHERE "id" = 1;');
    });

    it('should generate DELETE statement using rowid as fallback', () => {
      const change: PendingChange = {
        id: 'test-3',
        table: 'users',
        schema: 'main',
        rowId: 42,
        type: 'delete',
        oldValues: { name: 'John' },
        newValues: null,
        timestamp: new Date(),
        isValid: true,
      };

      const sql = generateSQLForChange(change);
      expect(sql).toBe('DELETE FROM "users" WHERE rowid = 42;');
    });

    it('should escape single quotes in strings', () => {
      const change: PendingChange = {
        id: 'test-4',
        table: 'users',
        rowId: -1,
        type: 'insert',
        oldValues: null,
        newValues: { name: "O'Brien" },
        timestamp: new Date(),
        isValid: true,
      };

      const sql = generateSQLForChange(change);
      expect(sql).toBe('INSERT INTO "users" ("name") VALUES (\'O\'\'Brien\');');
    });

    it('should handle NULL values', () => {
      const change: PendingChange = {
        id: 'test-5',
        table: 'users',
        rowId: -1,
        type: 'insert',
        oldValues: null,
        newValues: { name: 'John', email: null },
        timestamp: new Date(),
        isValid: true,
      };

      const sql = generateSQLForChange(change);
      expect(sql).toBe(
        'INSERT INTO "users" ("name", "email") VALUES (\'John\', NULL);'
      );
    });

    it('should handle boolean values', () => {
      const change: PendingChange = {
        id: 'test-6',
        table: 'users',
        rowId: -1,
        type: 'insert',
        oldValues: null,
        newValues: { active: true, verified: false },
        timestamp: new Date(),
        isValid: true,
      };

      const sql = generateSQLForChange(change);
      expect(sql).toBe(
        'INSERT INTO "users" ("active", "verified") VALUES (1, 0);'
      );
    });

    it('should filter out internal __ prefixed fields', () => {
      const change: PendingChange = {
        id: 'test-7',
        table: 'users',
        rowId: -1,
        type: 'insert',
        oldValues: null,
        newValues: { __rowId: 123, name: 'John', __isNew: true },
        timestamp: new Date(),
        isValid: true,
      };

      const sql = generateSQLForChange(change);
      expect(sql).toBe('INSERT INTO "users" ("name") VALUES (\'John\');');
    });

    it('should escape double quotes in identifiers', () => {
      const change: PendingChange = {
        id: 'test-8',
        table: 'my"table',
        rowId: -1,
        type: 'insert',
        oldValues: null,
        newValues: { 'col"name': 'value' },
        timestamp: new Date(),
        isValid: true,
      };

      const sql = generateSQLForChange(change);
      expect(sql).toBe(
        'INSERT INTO "my""table" ("col""name") VALUES (\'value\');'
      );
    });
  });

  describe('generateSQLForChanges', () => {
    it('should generate SQL for multiple changes', () => {
      const changes: PendingChange[] = [
        {
          id: 'test-1',
          table: 'users',
          rowId: -1,
          type: 'insert',
          oldValues: null,
          newValues: { name: 'John' },
          timestamp: new Date(),
          isValid: true,
        },
        {
          id: 'test-2',
          table: 'users',
          rowId: 1,
          type: 'delete',
          oldValues: { id: 1, name: 'Jane' },
          newValues: null,
          timestamp: new Date(),
          isValid: true,
        },
      ];

      const sqls = generateSQLForChanges(changes);
      expect(sqls).toHaveLength(2);
      expect(sqls[0]).toBe('INSERT INTO "users" ("name") VALUES (\'John\');');
      expect(sqls[1]).toBe('DELETE FROM "users" WHERE "id" = 1;');
    });
  });

  describe('generateSQLScript', () => {
    it('should generate a complete SQL script', () => {
      const changes: PendingChange[] = [
        {
          id: 'test-1',
          table: 'users',
          rowId: -1,
          type: 'insert',
          oldValues: null,
          newValues: { name: 'John' },
          timestamp: new Date(),
          isValid: true,
        },
      ];

      const script = generateSQLScript(changes);
      expect(script).toContain('-- Pending Changes SQL Preview');
      expect(script).toContain('BEGIN TRANSACTION;');
      expect(script).toContain('-- Table: main.users');
      expect(script).toContain(
        'INSERT INTO "users" ("name") VALUES (\'John\');'
      );
      expect(script).toContain('COMMIT;');
    });

    it('should return no changes message for empty array', () => {
      const script = generateSQLScript([]);
      expect(script).toBe('-- No pending changes');
    });

    it('should group changes by table', () => {
      const changes: PendingChange[] = [
        {
          id: 'test-1',
          table: 'users',
          rowId: -1,
          type: 'insert',
          oldValues: null,
          newValues: { name: 'John' },
          timestamp: new Date(),
          isValid: true,
        },
        {
          id: 'test-2',
          table: 'orders',
          rowId: -1,
          type: 'insert',
          oldValues: null,
          newValues: { amount: 100 },
          timestamp: new Date(),
          isValid: true,
        },
        {
          id: 'test-3',
          table: 'users',
          rowId: 1,
          type: 'update',
          oldValues: { id: 1, name: 'Old' },
          newValues: { name: 'New' },
          timestamp: new Date(),
          isValid: true,
        },
      ];

      const script = generateSQLScript(changes);
      expect(script).toContain('-- Table: main.users');
      expect(script).toContain('-- Table: main.orders');
    });
  });
});

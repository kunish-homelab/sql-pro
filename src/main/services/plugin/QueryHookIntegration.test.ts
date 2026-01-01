/**
 * Query Hook Integration Tests
 *
 * These tests verify query lifecycle hook integration by simulating
 * the query-hook example plugin's behavior without requiring full
 * plugin file system operations.
 *
 * Verification steps from subtask-8-4:
 * 1. Register query hooks (simulating plugin activation)
 * 2. Execute SQL queries
 * 3. Verify onBeforeQuery hook was called
 * 4. Verify onAfterQuery hook was called
 * 5. Verify query entries are logged to storage
 */

import type { QueryContext, QueryError, QueryResults } from '@/types/plugin';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { queryLifecycleService } from '@/plugin-api/QueryLifecycleAPI';
import { storageService } from '@/plugin-api/StorageAPI';

// Mock electron-store
const mockStore = new Map<string, unknown>();
vi.mock('electron-store', () => ({
  default: class MockStore {
    get(key: string, defaultValue?: unknown) {
      return mockStore.get(key) ?? defaultValue;
    }
    set(key: string, value: unknown) {
      mockStore.set(key, value);
    }
    delete(key: string) {
      mockStore.delete(key);
    }
    clear() {
      mockStore.clear();
    }
  },
}));

// ============================================================================
// Query Hook Plugin Simulation
// ============================================================================

/**
 * Simulates the query-hook example plugin's behavior for testing.
 * This matches the actual plugin implementation from plugin-sdk/templates/query-hook/
 */
class QueryHookPluginSimulator {
  private pluginId = 'com.sqlpro.example.query-hook';
  private queryLog: Array<{
    id: string;
    timestamp: number;
    query: string;
    connectionId: string;
    dbPath: string;
    status: 'success' | 'error';
    executionTime?: number;
    rowCount?: number;
    rowsAffected?: number;
    errorMessage?: string;
    errorCode?: string;
  }> = [];
  private logIdCounter = 0;
  private settings = {
    isLoggingEnabled: true,
    addQueryComments: false,
    logSelectQueries: true,
    logWriteQueries: true,
  };
  private unregisterCallbacks: Array<() => void> = [];

  /**
   * Activate the plugin by registering hooks.
   */
  async activate(): Promise<void> {
    // Load saved settings
    const savedSettingsResult = await storageService.getPluginData(
      this.pluginId,
      'settings'
    );
    if (savedSettingsResult.success && savedSettingsResult.data) {
      this.settings = { ...this.settings, ...savedSettingsResult.data };
    }

    // Load saved log
    const savedLogResult = await storageService.getPluginData(
      this.pluginId,
      'queryLog'
    );
    if (
      savedLogResult.success &&
      savedLogResult.data &&
      Array.isArray(savedLogResult.data)
    ) {
      this.queryLog = savedLogResult.data;
      this.logIdCounter = savedLogResult.data.length;
    }

    // Register before-query hook
    const unregisterBefore = queryLifecycleService.registerBeforeQueryHook(
      this.pluginId,
      (context) => {
        if (!this.shouldLogQuery(context.query)) return undefined;

        if (this.settings.addQueryComments) {
          const timestamp = new Date(context.timestamp).toLocaleString();
          const comment = `-- [Query Hook Logger] Executed at ${timestamp}`;
          return {
            query: `${comment}\n${context.query}`,
            metadata: {
              loggedAt: context.timestamp,
              originalQuery: context.query,
            },
          };
        }
        return undefined;
      }
    );
    if (unregisterBefore.success) {
      this.unregisterCallbacks.push(unregisterBefore.data!);
    }

    // Register after-query hook
    const unregisterAfter = queryLifecycleService.registerAfterQueryHook(
      this.pluginId,
      async (results, context) => {
        if (!this.shouldLogQuery(context.query)) return results;

        this.logIdCounter++;
        const entry = {
          id: `log-${Date.now()}-${this.logIdCounter}`,
          timestamp: context.timestamp,
          query: context.query,
          connectionId: context.connectionId,
          dbPath: context.dbPath,
          status: 'success' as const,
          executionTime: results.executionTime,
          rowCount: results.rows.length,
          rowsAffected: results.rowsAffected,
        };

        this.queryLog.push(entry);
        await storageService.setPluginData(
          this.pluginId,
          'queryLog',
          this.queryLog
        );

        return results;
      }
    );
    if (unregisterAfter.success) {
      this.unregisterCallbacks.push(unregisterAfter.data!);
    }

    // Register error hook
    const unregisterError = queryLifecycleService.registerQueryErrorHook(
      this.pluginId,
      async (error) => {
        if (!this.shouldLogQuery(error.query)) return;

        this.logIdCounter++;
        const entry = {
          id: `log-${Date.now()}-${this.logIdCounter}`,
          timestamp: Date.now(),
          query: error.query,
          connectionId: error.connectionId,
          dbPath: '',
          status: 'error' as const,
          errorMessage: error.message,
          errorCode: error.code,
        };

        this.queryLog.push(entry);
        await storageService.setPluginData(
          this.pluginId,
          'queryLog',
          this.queryLog
        );
      }
    );
    if (unregisterError.success) {
      this.unregisterCallbacks.push(unregisterError.data!);
    }
  }

  /**
   * Deactivate the plugin by unregistering hooks.
   */
  deactivate(): void {
    this.unregisterCallbacks.forEach((cb) => cb());
    this.unregisterCallbacks = [];
  }

  /**
   * Check if a query should be logged based on settings.
   */
  private shouldLogQuery(query: string): boolean {
    if (!this.settings.isLoggingEnabled) return false;

    const trimmed = query.trim().toUpperCase();
    const isSelect = trimmed.startsWith('SELECT') || trimmed.startsWith('WITH');
    const isWrite =
      trimmed.startsWith('INSERT') ||
      trimmed.startsWith('UPDATE') ||
      trimmed.startsWith('DELETE') ||
      trimmed.startsWith('CREATE') ||
      trimmed.startsWith('DROP') ||
      trimmed.startsWith('ALTER');

    if (isSelect && !this.settings.logSelectQueries) return false;
    if (isWrite && !this.settings.logWriteQueries) return false;

    return true;
  }

  /**
   * Get the current query log.
   */
  getQueryLog() {
    return this.queryLog;
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('query Hook Plugin Integration', () => {
  let plugin: QueryHookPluginSimulator;
  const pluginId = 'com.sqlpro.example.query-hook';

  beforeEach(async () => {
    // Clear state
    mockStore.clear();
    queryLifecycleService.clear();

    // Create and activate plugin simulator
    plugin = new QueryHookPluginSimulator();
    await plugin.activate();
  });

  afterEach(() => {
    plugin.deactivate();
    queryLifecycleService.clear();
    mockStore.clear();
  });

  describe('verification Step 1: Enable query-hook example plugin', () => {
    it('should register query lifecycle hooks when activated', () => {
      // Verify hooks are registered
      const beforeHooks = queryLifecycleService.getBeforeQueryHooks(pluginId);
      const afterHooks = queryLifecycleService.getAfterQueryHooks(pluginId);
      const errorHooks = queryLifecycleService.getQueryErrorHooks(pluginId);

      expect(beforeHooks.length).toBe(1);
      expect(afterHooks.length).toBe(1);
      expect(errorHooks.length).toBe(1);
    });
  });

  describe('verification Step 2 & 3: Execute SQL query and verify onBeforeQuery hook', () => {
    it('should call onBeforeQuery hook when query is executed', async () => {
      const hookCallTracker: string[] = [];

      // Listen for hook execution
      queryLifecycleService.on('beforeQuery:executed', () => {
        hookCallTracker.push('beforeQuery:executed');
      });

      // Execute query through lifecycle
      const queryContext: QueryContext = {
        query: 'SELECT * FROM users WHERE id = 1',
        connectionId: 'test-conn-001',
        dbPath: '/tmp/test.db',
        timestamp: Date.now(),
      };

      const hookResult =
        await queryLifecycleService.executeBeforeQueryHooks(queryContext);

      // Verify hook was called
      expect(hookCallTracker).toContain('beforeQuery:executed');
      expect(hookResult.cancelled).toBe(false);
    });

    it('should execute onBeforeQuery hook for SELECT queries', async () => {
      const queries = [
        'SELECT * FROM users',
        'SELECT COUNT(*) FROM products',
        'WITH cte AS (SELECT 1) SELECT * FROM cte',
      ];

      for (const query of queries) {
        const context: QueryContext = {
          query,
          connectionId: 'conn-001',
          dbPath: '/tmp/test.db',
          timestamp: Date.now(),
        };

        const result =
          await queryLifecycleService.executeBeforeQueryHooks(context);
        expect(result.cancelled).toBe(false);
      }
    });

    it('should execute onBeforeQuery hook for write queries', async () => {
      const queries = [
        'INSERT INTO users (name) VALUES ("Test")',
        'UPDATE users SET active = 1',
        'DELETE FROM users WHERE id = 1',
      ];

      for (const query of queries) {
        const context: QueryContext = {
          query,
          connectionId: 'conn-001',
          dbPath: '/tmp/test.db',
          timestamp: Date.now(),
        };

        const result =
          await queryLifecycleService.executeBeforeQueryHooks(context);
        expect(result.cancelled).toBe(false);
      }
    });
  });

  describe('verification Step 4: Verify onAfterQuery hook was called', () => {
    it('should call onAfterQuery hook after successful query execution', async () => {
      const hookCallTracker: string[] = [];

      // Listen for hook execution
      queryLifecycleService.on('afterQuery:executed', () => {
        hookCallTracker.push('afterQuery:executed');
      });

      const queryContext: QueryContext = {
        query: 'SELECT name, email FROM users',
        connectionId: 'test-conn-002',
        dbPath: '/tmp/test.db',
        timestamp: Date.now(),
      };

      const queryResults: QueryResults = {
        rows: [
          { name: 'Alice', email: 'alice@example.com' },
          { name: 'Bob', email: 'bob@example.com' },
        ],
        columns: ['name', 'email'],
        executionTime: 12,
        rowsAffected: 0,
      };

      // Execute hooks
      await queryLifecycleService.executeBeforeQueryHooks(queryContext);
      await queryLifecycleService.executeAfterQueryHooks(
        queryResults,
        queryContext
      );

      // Verify hook was called
      expect(hookCallTracker).toContain('afterQuery:executed');
    });

    it('should execute onAfterQuery hook with query results', async () => {
      const queryContext: QueryContext = {
        query: 'SELECT * FROM products WHERE price > 100',
        connectionId: 'test-conn-003',
        dbPath: '/tmp/test.db',
        timestamp: Date.now(),
      };

      const queryResults: QueryResults = {
        rows: [
          { id: 1, name: 'Product A', price: 150 },
          { id: 2, name: 'Product B', price: 200 },
        ],
        columns: ['id', 'name', 'price'],
        executionTime: 25,
        rowsAffected: 0,
      };

      await queryLifecycleService.executeBeforeQueryHooks(queryContext);
      const transformedResults =
        await queryLifecycleService.executeAfterQueryHooks(
          queryResults,
          queryContext
        );

      // Results should be returned
      expect(transformedResults.rows.length).toBe(2);
      expect(transformedResults.executionTime).toBe(25);
    });
  });

  describe('verification Step 5: Check plugin log file for query entries', () => {
    it('should log queries to plugin storage', async () => {
      const queryContext: QueryContext = {
        query: 'SELECT * FROM orders WHERE status = "pending"',
        connectionId: 'test-conn-004',
        dbPath: '/tmp/test.db',
        timestamp: Date.now(),
      };

      const queryResults: QueryResults = {
        rows: [{ id: 1, status: 'pending' }],
        columns: ['id', 'status'],
        executionTime: 18,
        rowsAffected: 0,
      };

      // Execute query lifecycle
      await queryLifecycleService.executeBeforeQueryHooks(queryContext);
      await queryLifecycleService.executeAfterQueryHooks(
        queryResults,
        queryContext
      );

      // Check plugin storage for logged query
      const result = await storageService.getPluginData(pluginId, 'queryLog');

      expect(result.success).toBe(true);
      if (!result.success) return;

      const queryLog = result.data;
      expect(queryLog).toBeDefined();
      expect(Array.isArray(queryLog)).toBe(true);
      const typedQueryLog = queryLog as Array<{
        query: string;
        status: string;
        executionTime: number;
        rowCount: number;
        connectionId: string;
      }>;
      expect(typedQueryLog).toHaveLength(1);

      const entry = typedQueryLog[0];
      expect(entry.query).toBe('SELECT * FROM orders WHERE status = "pending"');
      expect(entry.status).toBe('success');
      expect(entry.executionTime).toBe(18);
      expect(entry.rowCount).toBe(1);
      expect(entry.connectionId).toBe('test-conn-004');
    });

    it('should log multiple queries in sequence', async () => {
      const queries = [
        {
          context: {
            query: 'SELECT COUNT(*) FROM users',
            connectionId: 'conn-005',
            dbPath: '/tmp/test.db',
            timestamp: Date.now(),
          },
          results: {
            rows: [{ 'COUNT(*)': 5 }],
            columns: ['COUNT(*)'],
            executionTime: 8,
            rowsAffected: 0,
          },
        },
        {
          context: {
            query: 'INSERT INTO users (name) VALUES ("Test")',
            connectionId: 'conn-005',
            dbPath: '/tmp/test.db',
            timestamp: Date.now() + 100,
          },
          results: {
            rows: [],
            columns: [],
            executionTime: 5,
            rowsAffected: 1,
          },
        },
        {
          context: {
            query: 'UPDATE users SET active = 1',
            connectionId: 'conn-005',
            dbPath: '/tmp/test.db',
            timestamp: Date.now() + 200,
          },
          results: {
            rows: [],
            columns: [],
            executionTime: 3,
            rowsAffected: 10,
          },
        },
      ];

      // Execute all queries
      for (const query of queries) {
        await queryLifecycleService.executeBeforeQueryHooks(query.context);
        await queryLifecycleService.executeAfterQueryHooks(
          query.results,
          query.context
        );
      }

      // Check plugin storage
      const result = await storageService.getPluginData(pluginId, 'queryLog');

      expect(result.success).toBe(true);
      if (!result.success) return;

      const queryLog = result.data as Array<{
        query: string;
        status: string;
        rowCount: number;
        rowsAffected: number;
      }>;
      expect(queryLog).toBeDefined();
      expect(Array.isArray(queryLog)).toBe(true);
      expect(queryLog).toHaveLength(3);

      // Verify queries are logged correctly
      expect(queryLog[0].query).toContain('SELECT COUNT(*)');
      expect(queryLog[0].rowCount).toBe(1);
      expect(queryLog[1].query).toContain('INSERT INTO users');
      expect(queryLog[1].rowsAffected).toBe(1);
      expect(queryLog[2].query).toContain('UPDATE users');
      expect(queryLog[2].rowsAffected).toBe(10);

      // All should be successful
      queryLog.forEach((entry: { status: string }) => {
        expect(entry.status).toBe('success');
      });
    });

    it('should log query errors to storage', async () => {
      const queryError: QueryError = {
        message: 'SQLITE_ERROR: no such table: nonexistent',
        code: 'SQLITE_ERROR',
        query: 'SELECT * FROM nonexistent',
        connectionId: 'conn-006',
      };

      // Execute error hook
      await queryLifecycleService.executeQueryErrorHooks(queryError);

      // Check plugin storage for logged error
      const result = await storageService.getPluginData(pluginId, 'queryLog');

      expect(result.success).toBe(true);
      if (!result.success) return;

      const queryLog = result.data as Array<{
        query: string;
        status: string;
        errorMessage: string;
        errorCode: string;
      }>;
      expect(queryLog).toBeDefined();
      expect(Array.isArray(queryLog)).toBe(true);
      expect(queryLog).toHaveLength(1);

      const entry = queryLog[0];
      expect(entry.query).toBe('SELECT * FROM nonexistent');
      expect(entry.status).toBe('error');
      expect(entry.errorMessage).toContain('no such table');
      expect(entry.errorCode).toBe('SQLITE_ERROR');
    });

    it('should persist query log across plugin lifecycle', async () => {
      // Execute some queries
      const query1: QueryContext = {
        query: 'SELECT * FROM test1',
        connectionId: 'conn-007',
        dbPath: '/tmp/test.db',
        timestamp: Date.now(),
      };

      await queryLifecycleService.executeBeforeQueryHooks(query1);
      await queryLifecycleService.executeAfterQueryHooks(
        { rows: [], columns: [], executionTime: 5, rowsAffected: 0 },
        query1
      );

      // Verify log exists
      const logBeforeResult = await storageService.getPluginData(
        pluginId,
        'queryLog'
      );
      expect(logBeforeResult.success).toBe(true);
      if (!logBeforeResult.success) return;
      expect(logBeforeResult.data).toHaveLength(1);

      // Deactivate and reactivate plugin
      plugin.deactivate();
      plugin = new QueryHookPluginSimulator();
      await plugin.activate();

      // Execute another query
      const query2: QueryContext = {
        query: 'SELECT * FROM test2',
        connectionId: 'conn-007',
        dbPath: '/tmp/test.db',
        timestamp: Date.now(),
      };

      await queryLifecycleService.executeBeforeQueryHooks(query2);
      await queryLifecycleService.executeAfterQueryHooks(
        { rows: [], columns: [], executionTime: 3, rowsAffected: 0 },
        query2
      );

      // Verify both queries are in log
      const logAfterResult = await storageService.getPluginData(
        pluginId,
        'queryLog'
      );
      expect(logAfterResult.success).toBe(true);
      if (!logAfterResult.success) return;

      const logAfter = logAfterResult.data as Array<{ query: string }>;
      expect(logAfter).toHaveLength(2);
      expect(logAfter[0].query).toBe('SELECT * FROM test1');
      expect(logAfter[1].query).toBe('SELECT * FROM test2');
    });
  });

  describe('complete Query Lifecycle Verification', () => {
    it('should handle full query lifecycle: before → execute → after', async () => {
      const lifecycle: string[] = [];

      // Track lifecycle events
      queryLifecycleService.on('beforeQuery:executed', () =>
        lifecycle.push('before')
      );
      queryLifecycleService.on('afterQuery:executed', () =>
        lifecycle.push('after')
      );

      // Execute query
      const queryContext: QueryContext = {
        query: 'SELECT * FROM products WHERE category = "electronics"',
        connectionId: 'conn-008',
        dbPath: '/tmp/test.db',
        timestamp: Date.now(),
      };

      const queryResults: QueryResults = {
        rows: [
          { id: 1, name: 'Laptop', category: 'electronics' },
          { id: 2, name: 'Phone', category: 'electronics' },
        ],
        columns: ['id', 'name', 'category'],
        executionTime: 22,
        rowsAffected: 0,
      };

      // Execute lifecycle
      const beforeResult =
        await queryLifecycleService.executeBeforeQueryHooks(queryContext);
      expect(beforeResult.cancelled).toBe(false);

      await queryLifecycleService.executeAfterQueryHooks(
        queryResults,
        queryContext
      );

      // Verify lifecycle
      expect(lifecycle).toEqual(['before', 'after']);

      // Verify query was logged
      const result = await storageService.getPluginData(pluginId, 'queryLog');
      expect(result.success).toBe(true);
      if (!result.success) return;

      const queryLog = result.data as Array<{
        query: string;
        rowCount: number;
        executionTime: number;
      }>;
      expect(queryLog).toHaveLength(1);
      expect(queryLog[0].query).toContain('electronics');
      expect(queryLog[0].rowCount).toBe(2);
      expect(queryLog[0].executionTime).toBe(22);
    });
  });
});

import type { QueryContext, QueryError, QueryResults } from '@/types/plugin';
/**
 * Query Lifecycle API Integration Tests
 *
 * End-to-end tests for the query lifecycle hooks:
 * 1. Enable query-hook example plugin
 * 2. Execute SQL query in query editor
 * 3. Verify onBeforeQuery hook was called
 * 4. Verify onAfterQuery hook was called
 * 5. Verify onQueryError hook was called (for errors)
 * 6. Check plugin log for query entries
 *
 * These tests verify integration between:
 * - QueryLifecycleAPI (hook management)
 * - PluginRuntime (executing hooks)
 * - PluginService (orchestration)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ============ Import Service ============

import {
  queryLifecycleService,
  QueryLifecycleService,
} from './QueryLifecycleAPI';

// ============ Shared Mock State ============

const { mockState } = vi.hoisted(() => {
  const mockState = {
    beforeQueryCalls: [] as QueryContext[],
    afterQueryCalls: [] as { results: QueryResults; context: QueryContext }[],
    queryErrorCalls: [] as QueryError[],
    cancelledQueries: [] as { query: string; reason?: string }[],
    modifiedQueries: [] as { original: string; modified: string }[],
    hookMetadata: [] as Record<string, unknown>[],
  };

  return { mockState };
});

// Reset mock state helper
function resetMockState(): void {
  mockState.beforeQueryCalls = [];
  mockState.afterQueryCalls = [];
  mockState.queryErrorCalls = [];
  mockState.cancelledQueries = [];
  mockState.modifiedQueries = [];
  mockState.hookMetadata = [];
}

// ============ Tests ============

describe('queryLifecycleAPI Integration', () => {
  beforeEach(() => {
    resetMockState();
    queryLifecycleService.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryLifecycleService.clear();
  });

  describe('before Query Hook Integration', () => {
    it('should call onBeforeQuery hook when query is executed', async () => {
      const pluginId = 'com.example.query-logger';

      // Register a before-query hook (simulating plugin activation)
      const result = queryLifecycleService.registerBeforeQueryHook(
        pluginId,
        (context) => {
          mockState.beforeQueryCalls.push({ ...context });
          return undefined; // Continue without modification
        }
      );

      expect(result.success).toBe(true);

      // Simulate query execution
      const queryContext: QueryContext = {
        query: 'SELECT * FROM users WHERE id = 1',
        connectionId: 'conn-123',
        dbPath: '/path/to/database.db',
        timestamp: Date.now(),
      };

      const hookResult =
        await queryLifecycleService.executeBeforeQueryHooks(queryContext);

      // Verify hook was called
      expect(mockState.beforeQueryCalls.length).toBe(1);
      expect(mockState.beforeQueryCalls[0].query).toBe(
        'SELECT * FROM users WHERE id = 1'
      );
      expect(mockState.beforeQueryCalls[0].connectionId).toBe('conn-123');
      expect(hookResult.cancelled).toBe(false);
    });

    it('should allow hook to modify query', async () => {
      const pluginId = 'com.example.query-optimizer';

      // Register a hook that modifies queries
      queryLifecycleService.registerBeforeQueryHook(pluginId, (context) => {
        // Add a comment to the query
        const modifiedQuery = `-- Logged at ${new Date().toISOString()}\n${context.query}`;
        mockState.modifiedQueries.push({
          original: context.query,
          modified: modifiedQuery,
        });
        return { query: modifiedQuery };
      });

      const queryContext: QueryContext = {
        query: 'SELECT * FROM products',
        connectionId: 'conn-456',
        dbPath: '/path/to/database.db',
        timestamp: Date.now(),
      };

      const hookResult =
        await queryLifecycleService.executeBeforeQueryHooks(queryContext);

      // Verify query was modified
      expect(mockState.modifiedQueries.length).toBe(1);
      expect(mockState.modifiedQueries[0].original).toBe(
        'SELECT * FROM products'
      );
      expect(hookResult.context.query).toContain('-- Logged at');
      expect(hookResult.context.query).toContain('SELECT * FROM products');
    });

    it('should allow hook to cancel query execution', async () => {
      const pluginId = 'com.example.query-guard';

      // Register a hook that cancels dangerous queries
      queryLifecycleService.registerBeforeQueryHook(pluginId, (context) => {
        if (context.query.toUpperCase().includes('DROP TABLE')) {
          mockState.cancelledQueries.push({
            query: context.query,
            reason: 'DROP TABLE operations are not allowed',
          });
          return {
            cancel: true,
            cancelReason: 'DROP TABLE operations are not allowed',
          };
        }
        return undefined;
      });

      const dangerousQuery: QueryContext = {
        query: 'DROP TABLE users',
        connectionId: 'conn-789',
        dbPath: '/path/to/database.db',
        timestamp: Date.now(),
      };

      const hookResult =
        await queryLifecycleService.executeBeforeQueryHooks(dangerousQuery);

      // Verify query was cancelled
      expect(hookResult.cancelled).toBe(true);
      expect(hookResult.cancelReason).toBe(
        'DROP TABLE operations are not allowed'
      );
      expect(mockState.cancelledQueries.length).toBe(1);
    });

    it('should support hook metadata attachment', async () => {
      const pluginId = 'com.example.metadata-plugin';

      // Register a hook that attaches metadata
      queryLifecycleService.registerBeforeQueryHook(pluginId, (context) => {
        const metadata = {
          loggedAt: Date.now(),
          queryType: context.query.trim().split(' ')[0].toUpperCase(),
          source: 'query-logger-plugin',
        };
        mockState.hookMetadata.push(metadata);
        return { metadata };
      });

      const queryContext: QueryContext = {
        query: 'INSERT INTO users (name) VALUES ("John")',
        connectionId: 'conn-001',
        dbPath: '/path/to/database.db',
        timestamp: Date.now(),
      };

      const hookResult =
        await queryLifecycleService.executeBeforeQueryHooks(queryContext);

      // Verify metadata was attached
      expect(hookResult.metadata).toBeDefined();
      expect(hookResult.metadata?.queryType).toBe('INSERT');
      expect(hookResult.metadata?.source).toBe('query-logger-plugin');
    });

    it('should execute multiple hooks in priority order', async () => {
      const executionOrder: string[] = [];

      // Register hooks with different priorities
      queryLifecycleService.registerBeforeQueryHook(
        'plugin-c',
        () => {
          executionOrder.push('plugin-c');
        },
        { priority: 300 }
      );

      queryLifecycleService.registerBeforeQueryHook(
        'plugin-a',
        () => {
          executionOrder.push('plugin-a');
        },
        { priority: 100 }
      );

      queryLifecycleService.registerBeforeQueryHook(
        'plugin-b',
        () => {
          executionOrder.push('plugin-b');
        },
        { priority: 200 }
      );

      const queryContext: QueryContext = {
        query: 'SELECT 1',
        connectionId: 'conn-001',
        dbPath: '/path/to/database.db',
        timestamp: Date.now(),
      };

      await queryLifecycleService.executeBeforeQueryHooks(queryContext);

      // Verify execution order (lower priority runs first)
      expect(executionOrder).toEqual(['plugin-a', 'plugin-b', 'plugin-c']);
    });

    it('should continue execution if a hook throws an error', async () => {
      const pluginId1 = 'com.example.bad-plugin';
      const pluginId2 = 'com.example.good-plugin';
      const hookErrors: string[] = [];

      // Listen for hook errors
      queryLifecycleService.on('hook:error', (event) => {
        hookErrors.push(event.error as string);
      });

      // Register a hook that throws
      queryLifecycleService.registerBeforeQueryHook(
        pluginId1,
        () => {
          throw new Error('Hook crashed!');
        },
        { priority: 10 }
      );

      // Register a good hook
      queryLifecycleService.registerBeforeQueryHook(
        pluginId2,
        (context) => {
          mockState.beforeQueryCalls.push({ ...context });
        },
        { priority: 20 }
      );

      const queryContext: QueryContext = {
        query: 'SELECT * FROM test',
        connectionId: 'conn-001',
        dbPath: '/path/to/database.db',
        timestamp: Date.now(),
      };

      await queryLifecycleService.executeBeforeQueryHooks(queryContext);

      // Verify the good hook still ran
      expect(mockState.beforeQueryCalls.length).toBe(1);
      // Verify error was logged
      expect(hookErrors.length).toBe(1);
      expect(hookErrors[0]).toBe('Hook crashed!');
    });
  });

  describe('after Query Hook Integration', () => {
    it('should call onAfterQuery hook after successful query execution', async () => {
      const pluginId = 'com.example.query-logger';

      // Register an after-query hook
      const result = queryLifecycleService.registerAfterQueryHook(
        pluginId,
        (results, context) => {
          mockState.afterQueryCalls.push({
            results: { ...results },
            context: { ...context },
          });
          return results;
        }
      );

      expect(result.success).toBe(true);

      const queryContext: QueryContext = {
        query: 'SELECT name, email FROM users',
        connectionId: 'conn-123',
        dbPath: '/path/to/database.db',
        timestamp: Date.now(),
      };

      const queryResults: QueryResults = {
        rows: [
          { name: 'John', email: 'john@example.com' },
          { name: 'Jane', email: 'jane@example.com' },
        ],
        columns: ['name', 'email'],
        executionTime: 15,
        rowsAffected: 0,
      };

      const hookResults = await queryLifecycleService.executeAfterQueryHooks(
        queryResults,
        queryContext
      );

      // Verify hook was called with results
      expect(mockState.afterQueryCalls.length).toBe(1);
      expect(mockState.afterQueryCalls[0].results.rows.length).toBe(2);
      expect(mockState.afterQueryCalls[0].results.executionTime).toBe(15);
      expect(mockState.afterQueryCalls[0].context.query).toBe(
        'SELECT name, email FROM users'
      );
      expect(hookResults.rows.length).toBe(2);
    });

    it('should allow hook to transform query results', async () => {
      const pluginId = 'com.example.result-transformer';

      // Register a hook that transforms results
      queryLifecycleService.registerAfterQueryHook(pluginId, (results) => {
        // Add a computed field to each row
        const transformedRows = results.rows.map((row) => ({
          ...row,
          _transformed: true,
          _rowHash: `hash-${Math.random().toString(36).slice(2, 11)}`,
        }));

        return {
          ...results,
          rows: transformedRows,
        };
      });

      const queryContext: QueryContext = {
        query: 'SELECT id FROM items',
        connectionId: 'conn-456',
        dbPath: '/path/to/database.db',
        timestamp: Date.now(),
      };

      const queryResults: QueryResults = {
        rows: [{ id: 1 }, { id: 2 }, { id: 3 }],
        columns: ['id'],
        executionTime: 5,
        rowsAffected: 0,
      };

      const hookResults = await queryLifecycleService.executeAfterQueryHooks(
        queryResults,
        queryContext
      );

      // Verify results were transformed
      expect(hookResults.rows.length).toBe(3);
      expect(hookResults.rows[0]._transformed).toBe(true);
      expect(hookResults.rows[0]._rowHash).toBeDefined();
    });

    it('should chain multiple after-query hooks', async () => {
      // Register first hook that adds a field
      queryLifecycleService.registerAfterQueryHook(
        'plugin-1',
        (results) => {
          return {
            ...results,
            rows: results.rows.map((row) => ({ ...row, step1: true })),
          };
        },
        { priority: 10 }
      );

      // Register second hook that adds another field
      queryLifecycleService.registerAfterQueryHook(
        'plugin-2',
        (results) => {
          return {
            ...results,
            rows: results.rows.map((row) => ({ ...row, step2: true })),
          };
        },
        { priority: 20 }
      );

      const queryContext: QueryContext = {
        query: 'SELECT 1 as value',
        connectionId: 'conn-001',
        dbPath: '/path/to/database.db',
        timestamp: Date.now(),
      };

      const queryResults: QueryResults = {
        rows: [{ value: 1 }],
        columns: ['value'],
        executionTime: 1,
        rowsAffected: 0,
      };

      const hookResults = await queryLifecycleService.executeAfterQueryHooks(
        queryResults,
        queryContext
      );

      // Verify both hooks transformed the results
      expect(hookResults.rows[0].step1).toBe(true);
      expect(hookResults.rows[0].step2).toBe(true);
    });

    it('should log execution time in hook', async () => {
      const pluginId = 'com.example.perf-tracker';
      const loggedExecutionTimes: number[] = [];

      queryLifecycleService.registerAfterQueryHook(pluginId, (results) => {
        loggedExecutionTimes.push(results.executionTime);
        return results;
      });

      const queryContext: QueryContext = {
        query: 'SELECT * FROM large_table',
        connectionId: 'conn-001',
        dbPath: '/path/to/database.db',
        timestamp: Date.now(),
      };

      const queryResults: QueryResults = {
        rows: [],
        columns: [],
        executionTime: 1250, // 1.25 seconds
        rowsAffected: 0,
      };

      await queryLifecycleService.executeAfterQueryHooks(
        queryResults,
        queryContext
      );

      expect(loggedExecutionTimes.length).toBe(1);
      expect(loggedExecutionTimes[0]).toBe(1250);
    });
  });

  describe('query Error Hook Integration', () => {
    it('should call onQueryError hook when query fails', async () => {
      const pluginId = 'com.example.error-logger';

      // Register an error hook
      const result = queryLifecycleService.registerQueryErrorHook(
        pluginId,
        (error) => {
          mockState.queryErrorCalls.push({ ...error });
        }
      );

      expect(result.success).toBe(true);

      const queryError: QueryError = {
        message: 'SQLITE_ERROR: no such table: nonexistent',
        code: 'SQLITE_ERROR',
        query: 'SELECT * FROM nonexistent',
        connectionId: 'conn-123',
      };

      await queryLifecycleService.executeQueryErrorHooks(queryError);

      // Verify error hook was called
      expect(mockState.queryErrorCalls.length).toBe(1);
      expect(mockState.queryErrorCalls[0].message).toContain('no such table');
      expect(mockState.queryErrorCalls[0].code).toBe('SQLITE_ERROR');
      expect(mockState.queryErrorCalls[0].query).toBe(
        'SELECT * FROM nonexistent'
      );
    });

    it('should capture SQL syntax errors', async () => {
      const pluginId = 'com.example.syntax-checker';
      const syntaxErrors: QueryError[] = [];

      queryLifecycleService.registerQueryErrorHook(pluginId, (error) => {
        if (error.message.includes('syntax error')) {
          syntaxErrors.push(error);
        }
      });

      const queryError: QueryError = {
        message: 'SQLITE_ERROR: near "SELEC": syntax error',
        code: 'SQLITE_ERROR',
        query: 'SELEC * FROM users',
        connectionId: 'conn-456',
      };

      await queryLifecycleService.executeQueryErrorHooks(queryError);

      expect(syntaxErrors.length).toBe(1);
      expect(syntaxErrors[0].query).toBe('SELEC * FROM users');
    });

    it('should continue executing error hooks even if one throws', async () => {
      const hookErrors: string[] = [];
      const processedErrors: QueryError[] = [];

      queryLifecycleService.on('hook:error', (event) => {
        hookErrors.push(event.error as string);
      });

      // First hook throws
      queryLifecycleService.registerQueryErrorHook(
        'bad-plugin',
        () => {
          throw new Error('Error hook failed!');
        },
        { priority: 10 }
      );

      // Second hook works fine
      queryLifecycleService.registerQueryErrorHook(
        'good-plugin',
        (error) => {
          processedErrors.push(error);
        },
        { priority: 20 }
      );

      const queryError: QueryError = {
        message: 'Some database error',
        code: 'SQLITE_ERROR',
        query: 'SELECT * FROM test',
        connectionId: 'conn-001',
      };

      await queryLifecycleService.executeQueryErrorHooks(queryError);

      // Good hook should still run
      expect(processedErrors.length).toBe(1);
      expect(hookErrors.length).toBe(1);
    });
  });

  describe('full Query Lifecycle Integration', () => {
    it('should execute complete query lifecycle: before → after', async () => {
      const pluginId = 'com.example.full-logger';
      const lifecycle: string[] = [];

      // Register before hook
      queryLifecycleService.registerBeforeQueryHook(pluginId, (context) => {
        lifecycle.push(`before: ${context.query}`);
        return { metadata: { startTime: Date.now() } };
      });

      // Register after hook
      queryLifecycleService.registerAfterQueryHook(
        pluginId,
        (results, context) => {
          lifecycle.push(
            `after: ${context.query} (${results.rows.length} rows)`
          );
          return results;
        }
      );

      const queryContext: QueryContext = {
        query: 'SELECT * FROM users',
        connectionId: 'conn-001',
        dbPath: '/path/to/database.db',
        timestamp: Date.now(),
      };

      // Simulate query execution lifecycle
      const beforeResult =
        await queryLifecycleService.executeBeforeQueryHooks(queryContext);

      // Query should not be cancelled
      expect(beforeResult.cancelled).toBe(false);

      // Simulate successful query result
      const queryResults: QueryResults = {
        rows: [{ id: 1 }, { id: 2 }],
        columns: ['id'],
        executionTime: 10,
        rowsAffected: 0,
      };

      await queryLifecycleService.executeAfterQueryHooks(
        queryResults,
        queryContext
      );

      // Verify lifecycle
      expect(lifecycle).toEqual([
        'before: SELECT * FROM users',
        'after: SELECT * FROM users (2 rows)',
      ]);
    });

    it('should execute complete query lifecycle: before → error', async () => {
      const pluginId = 'com.example.error-tracker';
      const lifecycle: string[] = [];

      // Register before hook
      queryLifecycleService.registerBeforeQueryHook(pluginId, (context) => {
        lifecycle.push(`before: ${context.query}`);
      });

      // Register error hook
      queryLifecycleService.registerQueryErrorHook(pluginId, (error) => {
        lifecycle.push(`error: ${error.query} - ${error.code}`);
      });

      const queryContext: QueryContext = {
        query: 'SELECT * FROM invalid_table',
        connectionId: 'conn-001',
        dbPath: '/path/to/database.db',
        timestamp: Date.now(),
      };

      // Before hook
      await queryLifecycleService.executeBeforeQueryHooks(queryContext);

      // Simulate error
      const queryError: QueryError = {
        message: 'no such table: invalid_table',
        code: 'SQLITE_ERROR',
        query: 'SELECT * FROM invalid_table',
        connectionId: 'conn-001',
      };

      await queryLifecycleService.executeQueryErrorHooks(queryError);

      // Verify lifecycle
      expect(lifecycle).toEqual([
        'before: SELECT * FROM invalid_table',
        'error: SELECT * FROM invalid_table - SQLITE_ERROR',
      ]);
    });

    it('should skip after hooks when query is cancelled', async () => {
      const pluginId = 'com.example.guard';
      const lifecycle: string[] = [];

      // Register before hook that cancels
      queryLifecycleService.registerBeforeQueryHook(pluginId, (context) => {
        lifecycle.push(`before: ${context.query}`);
        if (context.query.includes('DELETE')) {
          lifecycle.push('cancelled: dangerous query');
          return { cancel: true, cancelReason: 'DELETE queries are blocked' };
        }
      });

      // Register after hook that should not be called
      queryLifecycleService.registerAfterQueryHook(pluginId, (results) => {
        lifecycle.push('after: should not reach here');
        return results;
      });

      const queryContext: QueryContext = {
        query: 'DELETE FROM users WHERE id = 1',
        connectionId: 'conn-001',
        dbPath: '/path/to/database.db',
        timestamp: Date.now(),
      };

      const beforeResult =
        await queryLifecycleService.executeBeforeQueryHooks(queryContext);

      // Query should be cancelled
      expect(beforeResult.cancelled).toBe(true);
      expect(beforeResult.cancelReason).toBe('DELETE queries are blocked');

      // After hook should not be called (simulating application behavior)
      // The application would check `cancelled` and skip execution
      expect(lifecycle).toEqual([
        'before: DELETE FROM users WHERE id = 1',
        'cancelled: dangerous query',
      ]);
    });
  });

  describe('plugin Cleanup Integration', () => {
    it('should unregister all hooks when plugin is disabled', () => {
      const pluginId = 'com.example.temp-plugin';

      // Register multiple hooks
      queryLifecycleService.registerBeforeQueryHook(pluginId, () => {});
      queryLifecycleService.registerBeforeQueryHook(pluginId, () => {});
      queryLifecycleService.registerAfterQueryHook(pluginId, () => {});
      queryLifecycleService.registerQueryErrorHook(pluginId, () => {});
      queryLifecycleService.registerQueryErrorHook(pluginId, () => {});

      // Verify hooks are registered
      expect(queryLifecycleService.getBeforeQueryHooks(pluginId).length).toBe(
        2
      );
      expect(queryLifecycleService.getAfterQueryHooks(pluginId).length).toBe(1);
      expect(queryLifecycleService.getQueryErrorHooks(pluginId).length).toBe(2);

      // Simulate plugin disable
      const removedCounts =
        queryLifecycleService.unregisterAllForPlugin(pluginId);

      // Verify all hooks were removed
      expect(removedCounts.beforeQuery).toBe(2);
      expect(removedCounts.afterQuery).toBe(1);
      expect(removedCounts.queryError).toBe(2);
      expect(queryLifecycleService.getBeforeQueryHooks(pluginId).length).toBe(
        0
      );
      expect(queryLifecycleService.getAfterQueryHooks(pluginId).length).toBe(0);
      expect(queryLifecycleService.getQueryErrorHooks(pluginId).length).toBe(0);
    });

    it('should not affect other plugins when one is disabled', () => {
      const plugin1 = 'com.example.plugin1';
      const plugin2 = 'com.example.plugin2';

      // Register hooks for both plugins
      queryLifecycleService.registerBeforeQueryHook(plugin1, () => {});
      queryLifecycleService.registerBeforeQueryHook(plugin2, () => {});
      queryLifecycleService.registerAfterQueryHook(plugin1, () => {});
      queryLifecycleService.registerAfterQueryHook(plugin2, () => {});

      // Disable plugin1
      queryLifecycleService.unregisterAllForPlugin(plugin1);

      // plugin1 hooks should be removed
      expect(queryLifecycleService.getBeforeQueryHooks(plugin1).length).toBe(0);
      expect(queryLifecycleService.getAfterQueryHooks(plugin1).length).toBe(0);

      // plugin2 hooks should still exist
      expect(queryLifecycleService.getBeforeQueryHooks(plugin2).length).toBe(1);
      expect(queryLifecycleService.getAfterQueryHooks(plugin2).length).toBe(1);
    });
  });

  describe('event Emission Integration', () => {
    it('should emit events during hook lifecycle', async () => {
      const pluginId = 'com.example.event-test';
      const events: string[] = [];

      queryLifecycleService.on('beforeQuery:registered', () =>
        events.push('beforeQuery:registered')
      );
      queryLifecycleService.on('beforeQuery:executed', () =>
        events.push('beforeQuery:executed')
      );
      queryLifecycleService.on('afterQuery:registered', () =>
        events.push('afterQuery:registered')
      );
      queryLifecycleService.on('afterQuery:executed', () =>
        events.push('afterQuery:executed')
      );

      // Register hooks
      queryLifecycleService.registerBeforeQueryHook(pluginId, () => {});
      queryLifecycleService.registerAfterQueryHook(pluginId, () => {});

      expect(events).toContain('beforeQuery:registered');
      expect(events).toContain('afterQuery:registered');

      // Execute hooks
      const queryContext: QueryContext = {
        query: 'SELECT 1',
        connectionId: 'conn-001',
        dbPath: '/path/to/database.db',
        timestamp: Date.now(),
      };

      await queryLifecycleService.executeBeforeQueryHooks(queryContext);
      await queryLifecycleService.executeAfterQueryHooks(
        { rows: [], columns: [], executionTime: 1, rowsAffected: 0 },
        queryContext
      );

      expect(events).toContain('beforeQuery:executed');
      expect(events).toContain('afterQuery:executed');
    });

    it('should emit query:modified event when query is changed', async () => {
      const pluginId = 'com.example.modifier';
      const modifyEvents: { original: string; modified: string }[] = [];

      queryLifecycleService.on('query:modified', (event) => {
        modifyEvents.push({
          original: event.originalQuery as string,
          modified: event.modifiedQuery as string,
        });
      });

      queryLifecycleService.registerBeforeQueryHook(pluginId, (context) => {
        return { query: `/* modified */ ${context.query}` };
      });

      const queryContext: QueryContext = {
        query: 'SELECT 1',
        connectionId: 'conn-001',
        dbPath: '/path/to/database.db',
        timestamp: Date.now(),
      };

      await queryLifecycleService.executeBeforeQueryHooks(queryContext);

      expect(modifyEvents.length).toBe(1);
      expect(modifyEvents[0].original).toBe('SELECT 1');
      expect(modifyEvents[0].modified).toBe('/* modified */ SELECT 1');
    });

    it('should emit query:cancelled event when query is blocked', async () => {
      const pluginId = 'com.example.blocker';
      const cancelEvents: { reason?: string }[] = [];

      queryLifecycleService.on('query:cancelled', (event) => {
        cancelEvents.push({ reason: event.reason as string | undefined });
      });

      queryLifecycleService.registerBeforeQueryHook(pluginId, () => {
        return { cancel: true, cancelReason: 'Query blocked by policy' };
      });

      const queryContext: QueryContext = {
        query: 'DROP DATABASE test',
        connectionId: 'conn-001',
        dbPath: '/path/to/database.db',
        timestamp: Date.now(),
      };

      await queryLifecycleService.executeBeforeQueryHooks(queryContext);

      expect(cancelEvents.length).toBe(1);
      expect(cancelEvents[0].reason).toBe('Query blocked by policy');
    });
  });

  describe('statistics and Query Methods', () => {
    it('should track hook statistics correctly', () => {
      const plugin1 = 'com.example.plugin1';
      const plugin2 = 'com.example.plugin2';

      queryLifecycleService.registerBeforeQueryHook(plugin1, () => {});
      queryLifecycleService.registerBeforeQueryHook(plugin1, () => {});
      queryLifecycleService.registerBeforeQueryHook(plugin2, () => {});
      queryLifecycleService.registerAfterQueryHook(plugin1, () => {});
      queryLifecycleService.registerQueryErrorHook(plugin2, () => {});

      const stats = queryLifecycleService.getStats();

      expect(stats.beforeQueryHookCount).toBe(3);
      expect(stats.afterQueryHookCount).toBe(1);
      expect(stats.queryErrorHookCount).toBe(1);
      expect(stats.totalHookCount).toBe(5);
      expect(stats.pluginCount).toBe(2);
    });

    it('should report hasHooks correctly', () => {
      expect(queryLifecycleService.hasHooks()).toBe(false);

      queryLifecycleService.registerBeforeQueryHook('plugin', () => {});
      expect(queryLifecycleService.hasHooks()).toBe(true);

      queryLifecycleService.clear();
      expect(queryLifecycleService.hasHooks()).toBe(false);
    });
  });

  describe('query Hook Logger Plugin Simulation', () => {
    it('should simulate query-hook plugin logging queries correctly', async () => {
      const pluginId = 'com.example.query-hook-logger';
      const queryLog: Array<{
        id: string;
        timestamp: number;
        query: string;
        status: 'success' | 'error';
        executionTime?: number;
        rowCount?: number;
        errorMessage?: string;
      }> = [];

      let logCounter = 0;

      // Simulate plugin's before-query hook
      queryLifecycleService.registerBeforeQueryHook(pluginId, () => {
        // Before hook typically just logs that query is starting
        return { metadata: { logStartTime: Date.now() } };
      });

      // Simulate plugin's after-query hook
      queryLifecycleService.registerAfterQueryHook(
        pluginId,
        (results, context) => {
          logCounter++;
          queryLog.push({
            id: `log-${logCounter}`,
            timestamp: context.timestamp,
            query: context.query,
            status: 'success',
            executionTime: results.executionTime,
            rowCount: results.rows.length,
          });
          return results;
        }
      );

      // Simulate plugin's error hook
      queryLifecycleService.registerQueryErrorHook(pluginId, (error) => {
        logCounter++;
        queryLog.push({
          id: `log-${logCounter}`,
          timestamp: Date.now(),
          query: error.query,
          status: 'error',
          errorMessage: error.message,
        });
      });

      // Execute successful query
      const context1: QueryContext = {
        query: 'SELECT * FROM users',
        connectionId: 'conn-001',
        dbPath: '/path/to/db.sqlite',
        timestamp: Date.now(),
      };

      await queryLifecycleService.executeBeforeQueryHooks(context1);
      await queryLifecycleService.executeAfterQueryHooks(
        {
          rows: [{ id: 1 }, { id: 2 }],
          columns: ['id'],
          executionTime: 25,
          rowsAffected: 0,
        },
        context1
      );

      // Execute another successful query
      const context2: QueryContext = {
        query: 'INSERT INTO users (name) VALUES ("Test")',
        connectionId: 'conn-001',
        dbPath: '/path/to/db.sqlite',
        timestamp: Date.now(),
      };

      await queryLifecycleService.executeBeforeQueryHooks(context2);
      await queryLifecycleService.executeAfterQueryHooks(
        { rows: [], columns: [], executionTime: 5, rowsAffected: 1 },
        context2
      );

      // Execute failed query
      const context3: QueryContext = {
        query: 'SELECT * FROM nonexistent',
        connectionId: 'conn-001',
        dbPath: '/path/to/db.sqlite',
        timestamp: Date.now(),
      };

      await queryLifecycleService.executeBeforeQueryHooks(context3);
      await queryLifecycleService.executeQueryErrorHooks({
        message: 'no such table: nonexistent',
        code: 'SQLITE_ERROR',
        query: 'SELECT * FROM nonexistent',
        connectionId: 'conn-001',
      });

      // Verify query log
      expect(queryLog.length).toBe(3);

      // First query
      expect(queryLog[0].query).toBe('SELECT * FROM users');
      expect(queryLog[0].status).toBe('success');
      expect(queryLog[0].executionTime).toBe(25);
      expect(queryLog[0].rowCount).toBe(2);

      // Second query
      expect(queryLog[1].query).toContain('INSERT INTO users');
      expect(queryLog[1].status).toBe('success');
      expect(queryLog[1].executionTime).toBe(5);

      // Failed query
      expect(queryLog[2].query).toBe('SELECT * FROM nonexistent');
      expect(queryLog[2].status).toBe('error');
      expect(queryLog[2].errorMessage).toContain('no such table');
    });
  });
});

describe('queryLifecycleService Instance', () => {
  it('should be a singleton instance', () => {
    expect(queryLifecycleService).toBeDefined();
    expect(queryLifecycleService).toBeInstanceOf(QueryLifecycleService);
  });

  it('should export QueryLifecycleService class for testing', () => {
    expect(QueryLifecycleService).toBeDefined();
    const instance = new QueryLifecycleService();
    expect(instance).toBeInstanceOf(QueryLifecycleService);
  });
});

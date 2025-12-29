import type { QueryResult } from '@/types/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useQueryStore } from './query-store';

// Helper function to create a mock QueryResult
function createMockQueryResult(
  overrides: Partial<QueryResult> = {}
): QueryResult {
  return {
    columns: ['id', 'name'],
    rows: [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ],
    rowsAffected: 0,
    ...overrides,
  };
}

describe('query-store', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useQueryStore.setState({
      currentQuery: '',
      results: null,
      error: null,
      isExecuting: false,
      executionTime: null,
      history: [],
    });
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have empty currentQuery', () => {
      const { currentQuery } = useQueryStore.getState();
      expect(currentQuery).toBe('');
    });

    it('should have null results', () => {
      const { results } = useQueryStore.getState();
      expect(results).toBeNull();
    });

    it('should have null error', () => {
      const { error } = useQueryStore.getState();
      expect(error).toBeNull();
    });

    it('should have isExecuting as false', () => {
      const { isExecuting } = useQueryStore.getState();
      expect(isExecuting).toBe(false);
    });

    it('should have null executionTime', () => {
      const { executionTime } = useQueryStore.getState();
      expect(executionTime).toBeNull();
    });

    it('should have empty history array', () => {
      const { history } = useQueryStore.getState();
      expect(history).toEqual([]);
    });
  });

  describe('setCurrentQuery', () => {
    it('should set currentQuery', () => {
      const { setCurrentQuery } = useQueryStore.getState();

      setCurrentQuery('SELECT * FROM users');

      const { currentQuery } = useQueryStore.getState();
      expect(currentQuery).toBe('SELECT * FROM users');
    });

    it('should update currentQuery', () => {
      const { setCurrentQuery } = useQueryStore.getState();

      setCurrentQuery('SELECT * FROM users');
      setCurrentQuery('SELECT * FROM orders');

      const { currentQuery } = useQueryStore.getState();
      expect(currentQuery).toBe('SELECT * FROM orders');
    });

    it('should clear currentQuery when set to empty string', () => {
      const { setCurrentQuery } = useQueryStore.getState();

      setCurrentQuery('SELECT * FROM users');
      setCurrentQuery('');

      const { currentQuery } = useQueryStore.getState();
      expect(currentQuery).toBe('');
    });

    it('should handle multiline queries', () => {
      const { setCurrentQuery } = useQueryStore.getState();

      const multilineQuery = `SELECT
        id,
        name
      FROM users
      WHERE id > 10`;
      setCurrentQuery(multilineQuery);

      const { currentQuery } = useQueryStore.getState();
      expect(currentQuery).toBe(multilineQuery);
    });
  });

  describe('setResults', () => {
    it('should set results', () => {
      const mockResult = createMockQueryResult();
      const { setResults } = useQueryStore.getState();

      setResults(mockResult);

      const { results } = useQueryStore.getState();
      expect(results).toEqual(mockResult);
    });

    it('should clear error when results are set', () => {
      const { setError, setResults } = useQueryStore.getState();

      // Set an error first
      setError('Query failed');
      expect(useQueryStore.getState().error).toBe('Query failed');

      // Setting results should clear the error
      setResults(createMockQueryResult());
      expect(useQueryStore.getState().error).toBeNull();
    });

    it('should clear results when set to null', () => {
      const { setResults } = useQueryStore.getState();

      setResults(createMockQueryResult());
      setResults(null);

      const { results } = useQueryStore.getState();
      expect(results).toBeNull();
    });

    it('should also clear error when results set to null', () => {
      const { setError, setResults } = useQueryStore.getState();

      setError('Some error');
      setResults(null);

      expect(useQueryStore.getState().error).toBeNull();
    });
  });

  describe('setError', () => {
    it('should set error message', () => {
      const { setError } = useQueryStore.getState();

      setError('Query syntax error');

      const { error } = useQueryStore.getState();
      expect(error).toBe('Query syntax error');
    });

    it('should clear results when error is set', () => {
      const { setResults, setError } = useQueryStore.getState();

      // Set results first
      setResults(createMockQueryResult());
      expect(useQueryStore.getState().results).not.toBeNull();

      // Setting error should clear results
      setError('Query failed');
      expect(useQueryStore.getState().results).toBeNull();
    });

    it('should clear error when set to null', () => {
      const { setError } = useQueryStore.getState();

      setError('Some error');
      setError(null);

      const { error } = useQueryStore.getState();
      expect(error).toBeNull();
    });

    it('should also clear results when error set to null', () => {
      const { setResults, setError } = useQueryStore.getState();

      setResults(createMockQueryResult());
      setError(null);

      expect(useQueryStore.getState().results).toBeNull();
    });

    it('should update error message', () => {
      const { setError } = useQueryStore.getState();

      setError('First error');
      expect(useQueryStore.getState().error).toBe('First error');

      setError('Second error');
      expect(useQueryStore.getState().error).toBe('Second error');
    });
  });

  describe('setIsExecuting', () => {
    it('should set isExecuting to true', () => {
      const { setIsExecuting } = useQueryStore.getState();

      setIsExecuting(true);

      const { isExecuting } = useQueryStore.getState();
      expect(isExecuting).toBe(true);
    });

    it('should set isExecuting to false', () => {
      const { setIsExecuting } = useQueryStore.getState();

      setIsExecuting(true);
      setIsExecuting(false);

      const { isExecuting } = useQueryStore.getState();
      expect(isExecuting).toBe(false);
    });
  });

  describe('setExecutionTime', () => {
    it('should set executionTime', () => {
      const { setExecutionTime } = useQueryStore.getState();

      setExecutionTime(125);

      const { executionTime } = useQueryStore.getState();
      expect(executionTime).toBe(125);
    });

    it('should clear executionTime when set to null', () => {
      const { setExecutionTime } = useQueryStore.getState();

      setExecutionTime(100);
      setExecutionTime(null);

      const { executionTime } = useQueryStore.getState();
      expect(executionTime).toBeNull();
    });

    it('should handle zero execution time', () => {
      const { setExecutionTime } = useQueryStore.getState();

      setExecutionTime(0);

      const { executionTime } = useQueryStore.getState();
      expect(executionTime).toBe(0);
    });

    it('should handle large execution times', () => {
      const { setExecutionTime } = useQueryStore.getState();

      setExecutionTime(999999);

      const { executionTime } = useQueryStore.getState();
      expect(executionTime).toBe(999999);
    });
  });

  describe('addToHistory', () => {
    const testDbPath = '/test/db.sqlite';

    it('should add entry to history', async () => {
      const { addToHistory } = useQueryStore.getState();

      await addToHistory(testDbPath, 'SELECT * FROM users', true, 100);

      const { history } = useQueryStore.getState();
      expect(history).toHaveLength(1);
      expect(history[0].queryText).toBe('SELECT * FROM users');
      expect(history[0].success).toBe(true);
      expect(history[0].durationMs).toBe(100);
      expect(history[0].executedAt).toBeDefined();
    });

    it('should add failed query to history', async () => {
      const { addToHistory } = useQueryStore.getState();

      await addToHistory(
        testDbPath,
        'INVALID QUERY',
        false,
        50,
        'Syntax error'
      );

      const { history } = useQueryStore.getState();
      expect(history[0].success).toBe(false);
      expect(history[0].error).toBe('Syntax error');
    });

    it('should prepend new entries to history', async () => {
      const { addToHistory } = useQueryStore.getState();

      await addToHistory(testDbPath, 'Query 1', true, 10);
      await addToHistory(testDbPath, 'Query 2', true, 20);
      await addToHistory(testDbPath, 'Query 3', true, 30);

      const { history } = useQueryStore.getState();
      expect(history[0].queryText).toBe('Query 3');
      expect(history[1].queryText).toBe('Query 2');
      expect(history[2].queryText).toBe('Query 1');
    });

    it('should limit history to MAX_HISTORY_LENGTH (100)', async () => {
      const { addToHistory } = useQueryStore.getState();

      // Add 105 entries
      for (let i = 0; i < 105; i++) {
        await addToHistory(testDbPath, `Query ${i}`, true, 10);
      }

      const { history } = useQueryStore.getState();
      expect(history).toHaveLength(100);
      // Most recent should be first
      expect(history[0].queryText).toBe('Query 104');
      // Oldest kept should be Query 5 (0-4 were pushed out)
      expect(history[99].queryText).toBe('Query 5');
    });

    it('should maintain exactly 100 entries when at limit', async () => {
      const { addToHistory } = useQueryStore.getState();

      // Add exactly 100 entries
      for (let i = 0; i < 100; i++) {
        await addToHistory(testDbPath, `Query ${i}`, true, 10);
      }
      expect(useQueryStore.getState().history).toHaveLength(100);

      // Add one more
      await addToHistory(testDbPath, 'New Query', true, 10);

      const { history } = useQueryStore.getState();
      expect(history).toHaveLength(100);
      expect(history[0].queryText).toBe('New Query');
    });

    it('should include durationMs in history entry', async () => {
      const { addToHistory } = useQueryStore.getState();

      await addToHistory(testDbPath, 'SELECT * FROM users', true, 150);

      const { history } = useQueryStore.getState();
      expect(history[0].durationMs).toBe(150);
    });

    it('should handle zero durationMs', async () => {
      const { addToHistory } = useQueryStore.getState();

      await addToHistory(testDbPath, 'DELETE FROM empty_table', true, 0);

      const { history } = useQueryStore.getState();
      expect(history[0].durationMs).toBe(0);
    });
  });

  describe('clearHistory', () => {
    const testDbPath = '/test/db.sqlite';

    it('should clear all history entries', async () => {
      const { addToHistory, clearHistory } = useQueryStore.getState();

      await addToHistory(testDbPath, 'Query 1', true, 10);
      await addToHistory(testDbPath, 'Query 2', true, 20);
      await addToHistory(testDbPath, 'Query 3', true, 30);

      expect(useQueryStore.getState().history).toHaveLength(3);

      await clearHistory(testDbPath);

      expect(useQueryStore.getState().history).toHaveLength(0);
    });

    it('should be safe to call on empty history', async () => {
      const { clearHistory } = useQueryStore.getState();

      await expect(clearHistory(testDbPath)).resolves.not.toThrow();
      expect(useQueryStore.getState().history).toHaveLength(0);
    });
  });

  describe('reset', () => {
    const testDbPath = '/test/db.sqlite';

    it('should reset all state to initial values', async () => {
      const {
        setCurrentQuery,
        setError,
        setIsExecuting,
        setExecutionTime,
        addToHistory,
        reset,
      } = useQueryStore.getState();

      // Set all state values
      setCurrentQuery('SELECT * FROM users');
      setError('Some error');
      setIsExecuting(true);
      setExecutionTime(100);
      await addToHistory(testDbPath, 'Query 1', true, 10);

      // Verify state is set
      let state = useQueryStore.getState();
      expect(state.currentQuery).not.toBe('');
      expect(state.error).not.toBeNull();
      expect(state.isExecuting).toBe(true);
      expect(state.executionTime).not.toBeNull();
      expect(state.history).toHaveLength(1);

      // Reset
      reset();

      // Verify all state is reset
      state = useQueryStore.getState();
      expect(state.currentQuery).toBe('');
      expect(state.results).toBeNull();
      expect(state.error).toBeNull();
      expect(state.isExecuting).toBe(false);
      expect(state.executionTime).toBeNull();
      expect(state.history).toEqual([]);
    });

    it('should be callable multiple times without error', () => {
      const { reset } = useQueryStore.getState();

      expect(() => {
        reset();
        reset();
        reset();
      }).not.toThrow();
    });

    it('should reset error state', () => {
      const { setError, reset } = useQueryStore.getState();

      setError('Some error');
      expect(useQueryStore.getState().error).toBe('Some error');

      reset();
      expect(useQueryStore.getState().error).toBeNull();
    });
  });

  describe('store API', () => {
    it('should expose getState method', () => {
      expect(typeof useQueryStore.getState).toBe('function');
    });

    it('should expose setState method', () => {
      expect(typeof useQueryStore.setState).toBe('function');
    });

    it('should expose subscribe method', () => {
      expect(typeof useQueryStore.subscribe).toBe('function');
    });

    it('should allow subscribing to state changes', () => {
      const listener = vi.fn();
      const unsubscribe = useQueryStore.subscribe(listener);

      const { setCurrentQuery } = useQueryStore.getState();
      setCurrentQuery('SELECT * FROM users');

      expect(listener).toHaveBeenCalled();

      unsubscribe();
    });

    it('should stop receiving updates after unsubscribe', () => {
      const listener = vi.fn();
      const unsubscribe = useQueryStore.subscribe(listener);

      unsubscribe();
      listener.mockClear();

      const { setCurrentQuery } = useQueryStore.getState();
      setCurrentQuery('SELECT * FROM users');

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('typical query execution flow', () => {
    const testDbPath = '/test/db.sqlite';

    it('should handle successful query execution flow', async () => {
      const {
        setCurrentQuery,
        setIsExecuting,
        setResults,
        setExecutionTime,
        addToHistory,
      } = useQueryStore.getState();

      // User enters query
      setCurrentQuery('SELECT * FROM users');
      expect(useQueryStore.getState().currentQuery).toBe('SELECT * FROM users');

      // Query starts executing
      setIsExecuting(true);
      expect(useQueryStore.getState().isExecuting).toBe(true);

      // Query completes successfully
      const result = createMockQueryResult({ rowsAffected: 5 });
      setResults(result);
      setExecutionTime(50);
      setIsExecuting(false);
      await addToHistory(testDbPath, 'SELECT * FROM users', true, 50);

      // Verify final state
      const state = useQueryStore.getState();
      expect(state.isExecuting).toBe(false);
      expect(state.results?.rowsAffected).toBe(5);
      expect(state.executionTime).toBe(50);
      expect(state.error).toBeNull();
      expect(state.history).toHaveLength(1);
    });

    it('should handle failed query execution flow', async () => {
      const { setCurrentQuery, setIsExecuting, setError, addToHistory } =
        useQueryStore.getState();

      // User enters invalid query
      setCurrentQuery('INVALID QUERY');

      // Query starts executing
      setIsExecuting(true);

      // Query fails
      setError('Syntax error near INVALID');
      setIsExecuting(false);
      await addToHistory(
        testDbPath,
        'INVALID QUERY',
        false,
        10,
        'Syntax error near INVALID'
      );

      // Verify final state
      const state = useQueryStore.getState();
      expect(state.isExecuting).toBe(false);
      expect(state.error).toBe('Syntax error near INVALID');
      expect(state.results).toBeNull();
      expect(state.history[0].success).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle very long query strings', () => {
      const { setCurrentQuery } = useQueryStore.getState();

      const longQuery = `SELECT ${'a, '.repeat(10000)}b FROM table`;
      setCurrentQuery(longQuery);

      expect(useQueryStore.getState().currentQuery).toBe(longQuery);
    });

    it('should handle special characters in queries', () => {
      const { setCurrentQuery } = useQueryStore.getState();

      const specialQuery = "SELECT * FROM users WHERE name = 'O''Brien'";
      setCurrentQuery(specialQuery);

      expect(useQueryStore.getState().currentQuery).toBe(specialQuery);
    });

    it('should handle unicode in queries', () => {
      const { setCurrentQuery } = useQueryStore.getState();

      const unicodeQuery = "SELECT * FROM users WHERE name = '日本語'";
      setCurrentQuery(unicodeQuery);

      expect(useQueryStore.getState().currentQuery).toBe(unicodeQuery);
    });

    it('should handle empty results', () => {
      const { setResults } = useQueryStore.getState();

      const emptyResult = createMockQueryResult({
        columns: [],
        rows: [],
        rowsAffected: 0,
      });
      setResults(emptyResult);

      const { results } = useQueryStore.getState();
      expect(results?.rowsAffected).toBe(0);
      expect(results?.rows).toEqual([]);
    });
  });
});

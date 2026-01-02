/**
 * Query Lifecycle API
 *
 * Provides plugin API methods for intercepting and modifying query execution:
 * - onBeforeQuery(): Register hooks that run before query execution
 * - onAfterQuery(): Register hooks that run after successful query execution
 * - onQueryError(): Register hooks that run when a query encounters an error
 *
 * Following the service module pattern from database.ts and UIExtensionAPI.ts
 */

import type {
  AfterQueryHook,
  BeforeQueryHook,
  QueryContext,
  QueryError,
  QueryErrorHook,
  QueryResults,
} from '@shared/types/plugin';
import EventEmitter from 'eventemitter3';

// ============ Types ============

/**
 * Result type for query lifecycle operations.
 */
export type QueryLifecycleResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string; errorCode?: QueryLifecycleErrorCode };

/**
 * Error codes specific to query lifecycle operations.
 */
export type QueryLifecycleErrorCode =
  | 'HOOK_ALREADY_REGISTERED'
  | 'HOOK_NOT_FOUND'
  | 'HOOK_EXECUTION_FAILED'
  | 'INVALID_HOOK'
  | 'PLUGIN_NOT_FOUND';

/**
 * Internal representation of a registered before-query hook.
 */
interface RegisteredBeforeQueryHook {
  /** Unique hook ID */
  hookId: string;
  /** Plugin ID that registered this hook */
  pluginId: string;
  /** Hook function */
  hook: BeforeQueryHook;
  /** Priority (lower runs first) */
  priority: number;
}

/**
 * Internal representation of a registered after-query hook.
 */
interface RegisteredAfterQueryHook {
  /** Unique hook ID */
  hookId: string;
  /** Plugin ID that registered this hook */
  pluginId: string;
  /** Hook function */
  hook: AfterQueryHook;
  /** Priority (lower runs first) */
  priority: number;
}

/**
 * Internal representation of a registered query error hook.
 */
interface RegisteredQueryErrorHook {
  /** Unique hook ID */
  hookId: string;
  /** Plugin ID that registered this hook */
  pluginId: string;
  /** Hook function */
  hook: QueryErrorHook;
  /** Priority (lower runs first) */
  priority: number;
}

/**
 * Options for registering a hook.
 */
export interface HookRegistrationOptions {
  /** Optional priority (default: 100, lower runs first) */
  priority?: number;
}

// ============ Event Types ============

/**
 * Event types emitted by QueryLifecycleService.
 */
export type QueryLifecycleEventType =
  | 'beforeQuery:registered'
  | 'beforeQuery:unregistered'
  | 'beforeQuery:executed'
  | 'afterQuery:registered'
  | 'afterQuery:unregistered'
  | 'afterQuery:executed'
  | 'queryError:registered'
  | 'queryError:unregistered'
  | 'queryError:executed'
  | 'query:cancelled'
  | 'query:modified'
  | 'hook:error';

/**
 * Event payload types.
 */
export interface QueryLifecycleEvents {
  'beforeQuery:registered': { pluginId: string; hookId: string };
  'beforeQuery:unregistered': { pluginId: string; hookId: string };
  'beforeQuery:executed': {
    pluginId: string;
    hookId: string;
    context: QueryContext;
  };
  'afterQuery:registered': { pluginId: string; hookId: string };
  'afterQuery:unregistered': { pluginId: string; hookId: string };
  'afterQuery:executed': {
    pluginId: string;
    hookId: string;
    results: QueryResults;
  };
  'queryError:registered': { pluginId: string; hookId: string };
  'queryError:unregistered': { pluginId: string; hookId: string };
  'queryError:executed': {
    pluginId: string;
    hookId: string;
    error: QueryError;
  };
  'query:cancelled': { pluginId: string; hookId: string; reason?: string };
  'query:modified': {
    pluginId: string;
    hookId: string;
    originalQuery: string;
    modifiedQuery: string;
  };
  'hook:error': {
    pluginId: string;
    hookId: string;
    hookType: string;
    error: string;
  };
}

// ============ ID Generation ============

let hookCounter = 0;

function generateHookId(pluginId: string, hookType: string): string {
  hookCounter += 1;
  return `${pluginId}:${hookType}:${hookCounter}_${Date.now()}`;
}

// ============ QueryLifecycleService Class ============

/**
 * QueryLifecycleService
 *
 * Central service for managing plugin query lifecycle hooks.
 * Follows the singleton service pattern from database.ts.
 *
 * Key features:
 * - Before-query hooks can modify or cancel queries
 * - After-query hooks can transform results
 * - Error hooks provide custom error handling
 * - Priority-based hook execution order
 * - Automatic cleanup when plugins are unloaded
 *
 * @example
 * ```typescript
 * // Register a before-query hook from a plugin
 * queryLifecycleService.registerBeforeQueryHook('my-plugin', async (context) => {
 *   console.log('Query:', context.query);
 *   // Return modified query
 *   return { query: context.query.toUpperCase() };
 * });
 *
 * // Register an after-query hook
 * queryLifecycleService.registerAfterQueryHook('my-plugin', async (results, context) => {
 *   console.log('Results:', results.rows.length, 'rows');
 *   return results;
 * });
 *
 * // Register an error hook
 * queryLifecycleService.registerQueryErrorHook('my-plugin', async (error) => {
 *   console.error('Query failed:', error.message);
 * });
 * ```
 */
class QueryLifecycleService extends EventEmitter {
  /**
   * Map of registered before-query hooks.
   * Key is the hook ID.
   */
  private beforeQueryHooks: Map<string, RegisteredBeforeQueryHook> = new Map();

  /**
   * Map of registered after-query hooks.
   * Key is the hook ID.
   */
  private afterQueryHooks: Map<string, RegisteredAfterQueryHook> = new Map();

  /**
   * Map of registered query error hooks.
   * Key is the hook ID.
   */
  private queryErrorHooks: Map<string, RegisteredQueryErrorHook> = new Map();

  /**
   * Default hook priority.
   */
  private readonly DEFAULT_PRIORITY = 100;

  constructor() {
    super();
  }

  // ============ Before-Query Hook API ============

  /**
   * Register a before-query hook.
   *
   * Before-query hooks are called before query execution and can:
   * - Modify the query string
   * - Cancel the query execution
   * - Add metadata to the query context
   *
   * @param pluginId - The ID of the plugin registering the hook
   * @param hook - The hook function to register
   * @param options - Optional registration options (priority)
   * @returns Result with unregister function or error
   *
   * @example
   * ```typescript
   * const result = queryLifecycleService.registerBeforeQueryHook(
   *   'my-plugin',
   *   async (context) => {
   *     // Log the query
   *     console.log('Executing:', context.query);
   *
   *     // Optionally modify the query
   *     if (context.query.includes('SELECT *')) {
   *       return { query: context.query.replace('SELECT *', 'SELECT id, name') };
   *     }
   *
   *     // Cancel queries that look dangerous
   *     if (context.query.includes('DROP TABLE')) {
   *       return { cancel: true, cancelReason: 'DROP TABLE is not allowed' };
   *     }
   *
   *     // Return nothing to continue without changes
   *   },
   *   { priority: 50 }
   * );
   * ```
   */
  registerBeforeQueryHook(
    pluginId: string,
    hook: BeforeQueryHook,
    options?: HookRegistrationOptions
  ): QueryLifecycleResult<() => void> {
    // Validate hook
    if (!hook || typeof hook !== 'function') {
      return {
        success: false,
        error: 'Hook must be a function',
        errorCode: 'INVALID_HOOK',
      };
    }

    // Generate hook ID
    const hookId = generateHookId(pluginId, 'beforeQuery');
    const priority = options?.priority ?? this.DEFAULT_PRIORITY;

    // Register the hook
    const registeredHook: RegisteredBeforeQueryHook = {
      hookId,
      pluginId,
      hook,
      priority,
    };

    this.beforeQueryHooks.set(hookId, registeredHook);

    // Emit event
    this.emit('beforeQuery:registered', { pluginId, hookId });

    // Return unregister function
    const unregister = () => {
      this.unregisterBeforeQueryHook(pluginId, hookId);
    };

    return { success: true, data: unregister };
  }

  /**
   * Unregister a before-query hook.
   *
   * @param pluginId - The plugin ID that registered the hook
   * @param hookId - The hook ID to unregister
   * @returns Success or error result
   */
  unregisterBeforeQueryHook(
    pluginId: string,
    hookId: string
  ): QueryLifecycleResult {
    const hook = this.beforeQueryHooks.get(hookId);

    if (!hook) {
      return {
        success: false,
        error: `Hook not found: ${hookId}`,
        errorCode: 'HOOK_NOT_FOUND',
      };
    }

    // Verify ownership
    if (hook.pluginId !== pluginId) {
      return {
        success: false,
        error: 'Cannot unregister hook owned by another plugin',
        errorCode: 'HOOK_NOT_FOUND',
      };
    }

    this.beforeQueryHooks.delete(hookId);

    // Emit event
    this.emit('beforeQuery:unregistered', { pluginId, hookId });

    return { success: true };
  }

  // ============ After-Query Hook API ============

  /**
   * Register an after-query hook.
   *
   * After-query hooks are called after successful query execution and can:
   * - Transform query results
   * - Add metadata to results
   * - Log query execution
   *
   * @param pluginId - The ID of the plugin registering the hook
   * @param hook - The hook function to register
   * @param options - Optional registration options (priority)
   * @returns Result with unregister function or error
   *
   * @example
   * ```typescript
   * const result = queryLifecycleService.registerAfterQueryHook(
   *   'my-plugin',
   *   async (results, context) => {
   *     // Log execution time
   *     console.log(`Query took ${results.executionTime}ms`);
   *
   *     // Transform results
   *     const transformedRows = results.rows.map(row => ({
   *       ...row,
   *       _formatted: true,
   *     }));
   *
   *     return { ...results, rows: transformedRows };
   *   }
   * );
   * ```
   */
  registerAfterQueryHook(
    pluginId: string,
    hook: AfterQueryHook,
    options?: HookRegistrationOptions
  ): QueryLifecycleResult<() => void> {
    // Validate hook
    if (!hook || typeof hook !== 'function') {
      return {
        success: false,
        error: 'Hook must be a function',
        errorCode: 'INVALID_HOOK',
      };
    }

    // Generate hook ID
    const hookId = generateHookId(pluginId, 'afterQuery');
    const priority = options?.priority ?? this.DEFAULT_PRIORITY;

    // Register the hook
    const registeredHook: RegisteredAfterQueryHook = {
      hookId,
      pluginId,
      hook,
      priority,
    };

    this.afterQueryHooks.set(hookId, registeredHook);

    // Emit event
    this.emit('afterQuery:registered', { pluginId, hookId });

    // Return unregister function
    const unregister = () => {
      this.unregisterAfterQueryHook(pluginId, hookId);
    };

    return { success: true, data: unregister };
  }

  /**
   * Unregister an after-query hook.
   *
   * @param pluginId - The plugin ID that registered the hook
   * @param hookId - The hook ID to unregister
   * @returns Success or error result
   */
  unregisterAfterQueryHook(
    pluginId: string,
    hookId: string
  ): QueryLifecycleResult {
    const hook = this.afterQueryHooks.get(hookId);

    if (!hook) {
      return {
        success: false,
        error: `Hook not found: ${hookId}`,
        errorCode: 'HOOK_NOT_FOUND',
      };
    }

    // Verify ownership
    if (hook.pluginId !== pluginId) {
      return {
        success: false,
        error: 'Cannot unregister hook owned by another plugin',
        errorCode: 'HOOK_NOT_FOUND',
      };
    }

    this.afterQueryHooks.delete(hookId);

    // Emit event
    this.emit('afterQuery:unregistered', { pluginId, hookId });

    return { success: true };
  }

  // ============ Query Error Hook API ============

  /**
   * Register a query error hook.
   *
   * Query error hooks are called when a query fails and can:
   * - Log errors
   * - Provide custom error handling
   * - Notify users or external systems
   *
   * @param pluginId - The ID of the plugin registering the hook
   * @param hook - The hook function to register
   * @param options - Optional registration options (priority)
   * @returns Result with unregister function or error
   *
   * @example
   * ```typescript
   * const result = queryLifecycleService.registerQueryErrorHook(
   *   'my-plugin',
   *   async (error) => {
   *     // Log the error
   *     console.error(`Query failed: ${error.message}`);
   *     console.error(`Query was: ${error.query}`);
   *
   *     // Send to error tracking service
   *     await errorTracker.capture(error);
   *   }
   * );
   * ```
   */
  registerQueryErrorHook(
    pluginId: string,
    hook: QueryErrorHook,
    options?: HookRegistrationOptions
  ): QueryLifecycleResult<() => void> {
    // Validate hook
    if (!hook || typeof hook !== 'function') {
      return {
        success: false,
        error: 'Hook must be a function',
        errorCode: 'INVALID_HOOK',
      };
    }

    // Generate hook ID
    const hookId = generateHookId(pluginId, 'queryError');
    const priority = options?.priority ?? this.DEFAULT_PRIORITY;

    // Register the hook
    const registeredHook: RegisteredQueryErrorHook = {
      hookId,
      pluginId,
      hook,
      priority,
    };

    this.queryErrorHooks.set(hookId, registeredHook);

    // Emit event
    this.emit('queryError:registered', { pluginId, hookId });

    // Return unregister function
    const unregister = () => {
      this.unregisterQueryErrorHook(pluginId, hookId);
    };

    return { success: true, data: unregister };
  }

  /**
   * Unregister a query error hook.
   *
   * @param pluginId - The plugin ID that registered the hook
   * @param hookId - The hook ID to unregister
   * @returns Success or error result
   */
  unregisterQueryErrorHook(
    pluginId: string,
    hookId: string
  ): QueryLifecycleResult {
    const hook = this.queryErrorHooks.get(hookId);

    if (!hook) {
      return {
        success: false,
        error: `Hook not found: ${hookId}`,
        errorCode: 'HOOK_NOT_FOUND',
      };
    }

    // Verify ownership
    if (hook.pluginId !== pluginId) {
      return {
        success: false,
        error: 'Cannot unregister hook owned by another plugin',
        errorCode: 'HOOK_NOT_FOUND',
      };
    }

    this.queryErrorHooks.delete(hookId);

    // Emit event
    this.emit('queryError:unregistered', { pluginId, hookId });

    return { success: true };
  }

  // ============ Hook Execution ============

  /**
   * Execute all registered before-query hooks.
   *
   * Hooks are executed in priority order (lower priority runs first).
   * A hook can:
   * - Return nothing to continue without changes
   * - Return { query: string } to modify the query
   * - Return { cancel: true, cancelReason: string } to cancel execution
   *
   * @param context - The query context
   * @returns Modified context and cancellation status
   */
  async executeBeforeQueryHooks(context: QueryContext): Promise<{
    context: QueryContext;
    cancelled: boolean;
    cancelReason?: string;
    metadata?: Record<string, unknown>;
  }> {
    let currentContext = { ...context };
    let cancelled = false;
    let cancelReason: string | undefined;
    let metadata: Record<string, unknown> = {};

    // Get hooks sorted by priority
    const hooks = this.getSortedBeforeQueryHooks();

    for (const registeredHook of hooks) {
      try {
        const result = await Promise.resolve(
          registeredHook.hook(currentContext)
        );

        // Emit execution event
        this.emit('beforeQuery:executed', {
          pluginId: registeredHook.pluginId,
          hookId: registeredHook.hookId,
          context: currentContext,
        });

        if (result) {
          // Check for cancellation
          if (result.cancel) {
            cancelled = true;
            cancelReason = result.cancelReason;

            // Emit cancellation event
            this.emit('query:cancelled', {
              pluginId: registeredHook.pluginId,
              hookId: registeredHook.hookId,
              reason: cancelReason,
            });

            break;
          }

          // Check for query modification
          if (result.query && result.query !== currentContext.query) {
            const originalQuery = currentContext.query;
            currentContext = { ...currentContext, query: result.query };

            // Emit modification event
            this.emit('query:modified', {
              pluginId: registeredHook.pluginId,
              hookId: registeredHook.hookId,
              originalQuery,
              modifiedQuery: result.query,
            });
          }

          // Merge metadata
          if (result.metadata) {
            metadata = { ...metadata, ...result.metadata };
          }
        }
      } catch (error) {
        // Log error but continue with other hooks
        this.emit('hook:error', {
          pluginId: registeredHook.pluginId,
          hookId: registeredHook.hookId,
          hookType: 'beforeQuery',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { context: currentContext, cancelled, cancelReason, metadata };
  }

  /**
   * Execute all registered after-query hooks.
   *
   * Hooks are executed in priority order (lower priority runs first).
   * A hook can return modified results or nothing to pass through unchanged.
   *
   * @param results - The query results
   * @param context - The original query context
   * @returns Potentially modified query results
   */
  async executeAfterQueryHooks(
    results: QueryResults,
    context: QueryContext
  ): Promise<QueryResults> {
    let currentResults = { ...results };

    // Get hooks sorted by priority
    const hooks = this.getSortedAfterQueryHooks();

    for (const registeredHook of hooks) {
      try {
        const result = await Promise.resolve(
          registeredHook.hook(currentResults, context)
        );

        // Emit execution event
        this.emit('afterQuery:executed', {
          pluginId: registeredHook.pluginId,
          hookId: registeredHook.hookId,
          results: currentResults,
        });

        // Apply modifications if returned
        if (result && typeof result === 'object') {
          currentResults = result as QueryResults;
        }
      } catch (error) {
        // Log error but continue with other hooks
        this.emit('hook:error', {
          pluginId: registeredHook.pluginId,
          hookId: registeredHook.hookId,
          hookType: 'afterQuery',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return currentResults;
  }

  /**
   * Execute all registered query error hooks.
   *
   * Hooks are executed in priority order (lower priority runs first).
   * All hooks are executed regardless of any errors they throw.
   *
   * @param error - The query error information
   */
  async executeQueryErrorHooks(error: QueryError): Promise<void> {
    // Get hooks sorted by priority
    const hooks = this.getSortedQueryErrorHooks();

    for (const registeredHook of hooks) {
      try {
        await Promise.resolve(registeredHook.hook(error));

        // Emit execution event
        this.emit('queryError:executed', {
          pluginId: registeredHook.pluginId,
          hookId: registeredHook.hookId,
          error,
        });
      } catch (hookError) {
        // Log error but continue with other hooks
        this.emit('hook:error', {
          pluginId: registeredHook.pluginId,
          hookId: registeredHook.hookId,
          hookType: 'queryError',
          error:
            hookError instanceof Error ? hookError.message : String(hookError),
        });
      }
    }
  }

  // ============ Query Methods ============

  /**
   * Get all registered before-query hooks for a plugin.
   *
   * @param pluginId - Optional filter by plugin ID
   * @returns Array of hook IDs
   */
  getBeforeQueryHooks(pluginId?: string): string[] {
    const hooks = Array.from(this.beforeQueryHooks.values());

    if (pluginId) {
      return hooks.filter((h) => h.pluginId === pluginId).map((h) => h.hookId);
    }

    return hooks.map((h) => h.hookId);
  }

  /**
   * Get all registered after-query hooks for a plugin.
   *
   * @param pluginId - Optional filter by plugin ID
   * @returns Array of hook IDs
   */
  getAfterQueryHooks(pluginId?: string): string[] {
    const hooks = Array.from(this.afterQueryHooks.values());

    if (pluginId) {
      return hooks.filter((h) => h.pluginId === pluginId).map((h) => h.hookId);
    }

    return hooks.map((h) => h.hookId);
  }

  /**
   * Get all registered query error hooks for a plugin.
   *
   * @param pluginId - Optional filter by plugin ID
   * @returns Array of hook IDs
   */
  getQueryErrorHooks(pluginId?: string): string[] {
    const hooks = Array.from(this.queryErrorHooks.values());

    if (pluginId) {
      return hooks.filter((h) => h.pluginId === pluginId).map((h) => h.hookId);
    }

    return hooks.map((h) => h.hookId);
  }

  /**
   * Check if there are any hooks registered.
   *
   * @returns True if any hooks are registered
   */
  hasHooks(): boolean {
    return (
      this.beforeQueryHooks.size > 0 ||
      this.afterQueryHooks.size > 0 ||
      this.queryErrorHooks.size > 0
    );
  }

  // ============ Plugin Cleanup ============

  /**
   * Unregister all hooks for a plugin.
   * Called when a plugin is disabled or uninstalled.
   *
   * @param pluginId - The plugin ID to clean up
   * @returns Count of hooks removed
   */
  unregisterAllForPlugin(pluginId: string): {
    beforeQuery: number;
    afterQuery: number;
    queryError: number;
  } {
    let beforeQueryRemoved = 0;
    let afterQueryRemoved = 0;
    let queryErrorRemoved = 0;

    // Remove before-query hooks
    for (const [hookId, hook] of this.beforeQueryHooks.entries()) {
      if (hook.pluginId === pluginId) {
        this.beforeQueryHooks.delete(hookId);
        beforeQueryRemoved++;
        this.emit('beforeQuery:unregistered', { pluginId, hookId });
      }
    }

    // Remove after-query hooks
    for (const [hookId, hook] of this.afterQueryHooks.entries()) {
      if (hook.pluginId === pluginId) {
        this.afterQueryHooks.delete(hookId);
        afterQueryRemoved++;
        this.emit('afterQuery:unregistered', { pluginId, hookId });
      }
    }

    // Remove query error hooks
    for (const [hookId, hook] of this.queryErrorHooks.entries()) {
      if (hook.pluginId === pluginId) {
        this.queryErrorHooks.delete(hookId);
        queryErrorRemoved++;
        this.emit('queryError:unregistered', { pluginId, hookId });
      }
    }

    return {
      beforeQuery: beforeQueryRemoved,
      afterQuery: afterQueryRemoved,
      queryError: queryErrorRemoved,
    };
  }

  // ============ Helper Methods ============

  /**
   * Get before-query hooks sorted by priority (ascending).
   */
  private getSortedBeforeQueryHooks(): RegisteredBeforeQueryHook[] {
    return Array.from(this.beforeQueryHooks.values()).sort(
      (a, b) => a.priority - b.priority
    );
  }

  /**
   * Get after-query hooks sorted by priority (ascending).
   */
  private getSortedAfterQueryHooks(): RegisteredAfterQueryHook[] {
    return Array.from(this.afterQueryHooks.values()).sort(
      (a, b) => a.priority - b.priority
    );
  }

  /**
   * Get query error hooks sorted by priority (ascending).
   */
  private getSortedQueryErrorHooks(): RegisteredQueryErrorHook[] {
    return Array.from(this.queryErrorHooks.values()).sort(
      (a, b) => a.priority - b.priority
    );
  }

  /**
   * Get statistics about registered hooks.
   */
  getStats(): {
    beforeQueryHookCount: number;
    afterQueryHookCount: number;
    queryErrorHookCount: number;
    totalHookCount: number;
    pluginCount: number;
  } {
    const plugins = new Set<string>();

    for (const hook of this.beforeQueryHooks.values()) {
      plugins.add(hook.pluginId);
    }

    for (const hook of this.afterQueryHooks.values()) {
      plugins.add(hook.pluginId);
    }

    for (const hook of this.queryErrorHooks.values()) {
      plugins.add(hook.pluginId);
    }

    return {
      beforeQueryHookCount: this.beforeQueryHooks.size,
      afterQueryHookCount: this.afterQueryHooks.size,
      queryErrorHookCount: this.queryErrorHooks.size,
      totalHookCount:
        this.beforeQueryHooks.size +
        this.afterQueryHooks.size +
        this.queryErrorHooks.size,
      pluginCount: plugins.size,
    };
  }

  /**
   * Clear all registered hooks.
   * Use with caution - mainly for testing purposes.
   */
  clear(): void {
    this.beforeQueryHooks.clear();
    this.afterQueryHooks.clear();
    this.queryErrorHooks.clear();
  }
}

// Export singleton instance following the service pattern
export const queryLifecycleService = new QueryLifecycleService();

// Export class for testing purposes
export { QueryLifecycleService };

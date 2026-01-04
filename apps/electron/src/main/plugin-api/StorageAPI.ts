/**
 * Storage API
 *
 * Provides plugin API methods for per-plugin persistent data storage:
 * - get(): Retrieve a value from plugin storage
 * - set(): Store a value in plugin storage
 * - remove(): Remove a value from plugin storage
 * - keys(): Get all keys in plugin storage
 * - clear(): Clear all plugin storage
 *
 * Each plugin has isolated storage that persists across application restarts.
 * Storage is namespaced by plugin ID to prevent collisions.
 *
 * Following the service module pattern from database.ts and store.ts
 */

import Store from 'electron-store';
import EventEmitter from 'eventemitter3';

// ============ Types ============

/**
 * Result type for storage operations.
 */
export type StorageResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string; errorCode?: StorageErrorCode };

/**
 * Error codes specific to storage operations.
 */
export type StorageErrorCode =
  | 'PLUGIN_ID_REQUIRED'
  | 'KEY_REQUIRED'
  | 'INVALID_KEY'
  | 'INVALID_VALUE'
  | 'STORAGE_READ_ERROR'
  | 'STORAGE_WRITE_ERROR'
  | 'STORAGE_DELETE_ERROR'
  | 'SERIALIZATION_ERROR'
  | 'QUOTA_EXCEEDED';

/**
 * Storage schema for electron-store.
 */
interface PluginStorageSchema {
  /** Per-plugin storage data keyed by plugin ID */
  pluginData: Record<string, Record<string, unknown>>;
  /** Storage metadata keyed by plugin ID */
  pluginMetadata: Record<string, PluginStorageMetadata>;
}

/**
 * Metadata about a plugin's storage usage.
 */
interface PluginStorageMetadata {
  /** Number of keys stored */
  keyCount: number;
  /** Approximate size in bytes */
  approximateSize: number;
  /** Last access timestamp */
  lastAccessed: string;
  /** Last modified timestamp */
  lastModified: string;
}

// ============ Constants ============

/** Maximum number of keys per plugin */
const MAX_KEYS_PER_PLUGIN = 1000;

/** Maximum size per key in bytes (approximately) */
const MAX_VALUE_SIZE = 5 * 1024 * 1024; // 5MB

/** Storage store name */
const STORAGE_STORE_NAME = 'sql-pro-plugin-storage';

// ============ Event Types ============

/**
 * Event types emitted by StorageService.
 */
export type StorageEventType =
  | 'storage:get'
  | 'storage:set'
  | 'storage:remove'
  | 'storage:clear'
  | 'storage:error';

/**
 * Event payload types.
 */
export interface StorageEvents {
  'storage:get': { pluginId: string; key: string };
  'storage:set': { pluginId: string; key: string; size: number };
  'storage:remove': { pluginId: string; key: string };
  'storage:clear': { pluginId: string; keyCount: number };
  'storage:error': { pluginId: string; operation: string; error: string };
}

// ============ Storage Instance ============

// Lazy-initialize store to ensure app is ready before accessing userData path
let _storageStore: Store<PluginStorageSchema> | null = null;

function getStorageStore(): Store<PluginStorageSchema> {
  if (!_storageStore) {
    _storageStore = new Store<PluginStorageSchema>({
      name: STORAGE_STORE_NAME,
      defaults: {
        pluginData: {},
        pluginMetadata: {},
      },
    });
  }
  return _storageStore;
}

// ============ StorageService Class ============

/**
 * StorageService
 *
 * Central service for managing per-plugin persistent storage.
 * Follows the singleton service pattern from database.ts and store.ts.
 *
 * Key features:
 * - Isolated storage per plugin (namespaced by plugin ID)
 * - Persistent storage using electron-store
 * - Automatic JSON serialization/deserialization
 * - Storage quota enforcement
 * - Storage metadata tracking
 *
 * @example
 * ```typescript
 * // Get a value from plugin storage
 * const result = storageService.getPluginData('my-plugin', 'settings');
 * if (result.success) {
 *   const settings = result.data;
 * }
 *
 * // Set a value in plugin storage
 * storageService.setPluginData('my-plugin', 'settings', { theme: 'dark' });
 *
 * // Remove a value from plugin storage
 * storageService.removePluginData('my-plugin', 'settings');
 *
 * // Get all keys for a plugin
 * const keys = storageService.getPluginDataKeys('my-plugin');
 *
 * // Clear all storage for a plugin
 * storageService.clearPluginStorage('my-plugin');
 * ```
 */
class StorageService extends EventEmitter {
  constructor() {
    super();
  }

  // ============ Core Storage API ============

  /**
   * Get a value from plugin storage.
   *
   * @param pluginId - The plugin ID
   * @param key - The storage key
   * @returns Result containing the stored value or undefined if not found
   *
   * @example
   * ```typescript
   * const result = storageService.getPluginData<UserSettings>(
   *   'my-plugin',
   *   'user-settings'
   * );
   * if (result.success && result.data) {
   *   console.log('Settings:', result.data.theme);
   * }
   * ```
   */
  getPluginData<T = unknown>(
    pluginId: string,
    key: string
  ): StorageResult<T | undefined> {
    // Validate inputs
    if (!pluginId || typeof pluginId !== 'string') {
      return {
        success: false,
        error: 'Plugin ID is required and must be a string',
        errorCode: 'PLUGIN_ID_REQUIRED',
      };
    }

    if (!key || typeof key !== 'string') {
      return {
        success: false,
        error: 'Key is required and must be a string',
        errorCode: 'KEY_REQUIRED',
      };
    }

    // Validate key format
    if (!this.isValidKey(key)) {
      return {
        success: false,
        error:
          'Invalid key format. Keys must be non-empty strings without null characters.',
        errorCode: 'INVALID_KEY',
      };
    }

    try {
      const pluginData = getStorageStore().get('pluginData', {});
      const data = pluginData[pluginId];

      // Update last accessed timestamp
      this.updateAccessTime(pluginId);

      // Emit event
      this.emit('storage:get', { pluginId, key });

      if (!data || !(key in data)) {
        return { success: true, data: undefined };
      }

      return { success: true, data: data[key] as T };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.emit('storage:error', {
        pluginId,
        operation: 'get',
        error: errorMessage,
      });

      return {
        success: false,
        error: `Failed to read storage: ${errorMessage}`,
        errorCode: 'STORAGE_READ_ERROR',
      };
    }
  }

  /**
   * Set a value in plugin storage.
   *
   * @param pluginId - The plugin ID
   * @param key - The storage key
   * @param value - The value to store (must be JSON-serializable)
   * @returns Success or error result
   *
   * @example
   * ```typescript
   * const result = storageService.setPluginData(
   *   'my-plugin',
   *   'user-settings',
   *   { theme: 'dark', fontSize: 14 }
   * );
   * if (!result.success) {
   *   console.error('Failed to save settings:', result.error);
   * }
   * ```
   */
  setPluginData<T = unknown>(
    pluginId: string,
    key: string,
    value: T
  ): StorageResult {
    // Validate inputs
    if (!pluginId || typeof pluginId !== 'string') {
      return {
        success: false,
        error: 'Plugin ID is required and must be a string',
        errorCode: 'PLUGIN_ID_REQUIRED',
      };
    }

    if (!key || typeof key !== 'string') {
      return {
        success: false,
        error: 'Key is required and must be a string',
        errorCode: 'KEY_REQUIRED',
      };
    }

    // Validate key format
    if (!this.isValidKey(key)) {
      return {
        success: false,
        error:
          'Invalid key format. Keys must be non-empty strings without null characters.',
        errorCode: 'INVALID_KEY',
      };
    }

    try {
      // Check if value is serializable and get size estimate
      const serialized = JSON.stringify(value);
      const valueSize = new TextEncoder().encode(serialized).length;

      // Check value size limit
      if (valueSize > MAX_VALUE_SIZE) {
        return {
          success: false,
          error: `Value exceeds maximum size limit of ${MAX_VALUE_SIZE / 1024 / 1024}MB`,
          errorCode: 'QUOTA_EXCEEDED',
        };
      }

      const pluginData = getStorageStore().get('pluginData', {});

      // Initialize plugin data if not exists
      if (!pluginData[pluginId]) {
        pluginData[pluginId] = {};
      }

      // Check key count limit (only for new keys)
      const isNewKey = !(key in pluginData[pluginId]);
      const currentKeyCount = Object.keys(pluginData[pluginId]).length;

      if (isNewKey && currentKeyCount >= MAX_KEYS_PER_PLUGIN) {
        return {
          success: false,
          error: `Plugin storage key limit exceeded (max ${MAX_KEYS_PER_PLUGIN} keys)`,
          errorCode: 'QUOTA_EXCEEDED',
        };
      }

      // Store the value
      pluginData[pluginId][key] = value;
      getStorageStore().set('pluginData', pluginData);

      // Update metadata
      this.updateMetadata(pluginId);

      // Emit event
      this.emit('storage:set', { pluginId, key, size: valueSize });

      return { success: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Check for serialization errors
      if (
        errorMessage.includes('circular') ||
        errorMessage.includes('serialize')
      ) {
        this.emit('storage:error', {
          pluginId,
          operation: 'set',
          error: errorMessage,
        });

        return {
          success: false,
          error:
            'Value is not JSON-serializable. Ensure the value does not contain circular references or non-serializable types.',
          errorCode: 'SERIALIZATION_ERROR',
        };
      }

      this.emit('storage:error', {
        pluginId,
        operation: 'set',
        error: errorMessage,
      });

      return {
        success: false,
        error: `Failed to write storage: ${errorMessage}`,
        errorCode: 'STORAGE_WRITE_ERROR',
      };
    }
  }

  /**
   * Remove a value from plugin storage.
   *
   * @param pluginId - The plugin ID
   * @param key - The storage key to remove
   * @returns Success or error result
   *
   * @example
   * ```typescript
   * const result = storageService.removePluginData('my-plugin', 'cache');
   * if (result.success) {
   *   console.log('Cache cleared');
   * }
   * ```
   */
  removePluginData(pluginId: string, key: string): StorageResult {
    // Validate inputs
    if (!pluginId || typeof pluginId !== 'string') {
      return {
        success: false,
        error: 'Plugin ID is required and must be a string',
        errorCode: 'PLUGIN_ID_REQUIRED',
      };
    }

    if (!key || typeof key !== 'string') {
      return {
        success: false,
        error: 'Key is required and must be a string',
        errorCode: 'KEY_REQUIRED',
      };
    }

    try {
      const pluginData = getStorageStore().get('pluginData', {});
      const data = pluginData[pluginId];

      if (data) {
        delete data[key];
        getStorageStore().set('pluginData', pluginData);

        // Update metadata
        this.updateMetadata(pluginId);
      }

      // Emit event
      this.emit('storage:remove', { pluginId, key });

      return { success: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.emit('storage:error', {
        pluginId,
        operation: 'remove',
        error: errorMessage,
      });

      return {
        success: false,
        error: `Failed to remove from storage: ${errorMessage}`,
        errorCode: 'STORAGE_DELETE_ERROR',
      };
    }
  }

  /**
   * Get all storage keys for a plugin.
   *
   * @param pluginId - The plugin ID
   * @returns Result containing array of storage keys
   *
   * @example
   * ```typescript
   * const result = storageService.getPluginDataKeys('my-plugin');
   * if (result.success) {
   *   console.log('Stored keys:', result.data);
   * }
   * ```
   */
  getPluginDataKeys(pluginId: string): StorageResult<string[]> {
    // Validate inputs
    if (!pluginId || typeof pluginId !== 'string') {
      return {
        success: false,
        error: 'Plugin ID is required and must be a string',
        errorCode: 'PLUGIN_ID_REQUIRED',
      };
    }

    try {
      const pluginData = getStorageStore().get('pluginData', {});
      const data = pluginData[pluginId];

      const keys = data ? Object.keys(data) : [];

      return { success: true, data: keys };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.emit('storage:error', {
        pluginId,
        operation: 'keys',
        error: errorMessage,
      });

      return {
        success: false,
        error: `Failed to get storage keys: ${errorMessage}`,
        errorCode: 'STORAGE_READ_ERROR',
      };
    }
  }

  /**
   * Clear all storage for a plugin.
   *
   * @param pluginId - The plugin ID
   * @returns Success or error result
   *
   * @example
   * ```typescript
   * const result = storageService.clearPluginStorage('my-plugin');
   * if (result.success) {
   *   console.log('Plugin storage cleared');
   * }
   * ```
   */
  clearPluginStorage(pluginId: string): StorageResult {
    // Validate inputs
    if (!pluginId || typeof pluginId !== 'string') {
      return {
        success: false,
        error: 'Plugin ID is required and must be a string',
        errorCode: 'PLUGIN_ID_REQUIRED',
      };
    }

    try {
      const pluginData = getStorageStore().get('pluginData', {});
      const keyCount = pluginData[pluginId]
        ? Object.keys(pluginData[pluginId]).length
        : 0;

      // Remove plugin data
      delete pluginData[pluginId];
      getStorageStore().set('pluginData', pluginData);

      // Remove metadata
      const metadata = getStorageStore().get('pluginMetadata', {});
      delete metadata[pluginId];
      getStorageStore().set('pluginMetadata', metadata);

      // Emit event
      this.emit('storage:clear', { pluginId, keyCount });

      return { success: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.emit('storage:error', {
        pluginId,
        operation: 'clear',
        error: errorMessage,
      });

      return {
        success: false,
        error: `Failed to clear storage: ${errorMessage}`,
        errorCode: 'STORAGE_DELETE_ERROR',
      };
    }
  }

  // ============ Async API (for Plugin Context) ============

  /**
   * Create an async storage API for a specific plugin.
   * This is the API exposed to plugins via the PluginContext.
   *
   * @param pluginId - The plugin ID
   * @returns Async storage API interface
   *
   * @example
   * ```typescript
   * const storage = storageService.createPluginStorageAPI('my-plugin');
   *
   * // In plugin code:
   * await storage.set('key', 'value');
   * const value = await storage.get('key');
   * ```
   */
  createPluginStorageAPI(pluginId: string): {
    get: <T = unknown>(key: string) => Promise<T | undefined>;
    set: <T = unknown>(key: string, value: T) => Promise<void>;
    remove: (key: string) => Promise<void>;
    keys: () => Promise<string[]>;
    clear: () => Promise<void>;
  } {
    return {
      get: async <T = unknown>(key: string): Promise<T | undefined> => {
        const result = this.getPluginData<T>(pluginId, key);
        if (!result.success) {
          throw new Error(result.error);
        }
        return result.data;
      },

      set: async <T = unknown>(key: string, value: T): Promise<void> => {
        const result = this.setPluginData(pluginId, key, value);
        if (!result.success) {
          throw new Error(result.error);
        }
      },

      remove: async (key: string): Promise<void> => {
        const result = this.removePluginData(pluginId, key);
        if (!result.success) {
          throw new Error(result.error);
        }
      },

      keys: async (): Promise<string[]> => {
        const result = this.getPluginDataKeys(pluginId);
        if (!result.success) {
          throw new Error(result.error);
        }
        return result.data ?? [];
      },

      clear: async (): Promise<void> => {
        const result = this.clearPluginStorage(pluginId);
        if (!result.success) {
          throw new Error(result.error);
        }
      },
    };
  }

  // ============ Metadata and Stats ============

  /**
   * Get storage metadata for a plugin.
   *
   * @param pluginId - The plugin ID
   * @returns Storage metadata or null if not found
   */
  getPluginMetadata(pluginId: string): PluginStorageMetadata | null {
    const metadata = getStorageStore().get('pluginMetadata', {});
    return metadata[pluginId] || null;
  }

  /**
   * Get storage statistics for all plugins.
   *
   * @returns Object containing storage statistics
   */
  getStats(): {
    totalPlugins: number;
    totalKeys: number;
    pluginStats: Array<{
      pluginId: string;
      keyCount: number;
      approximateSize: number;
      lastModified: string;
    }>;
  } {
    const pluginData = getStorageStore().get('pluginData', {});
    const metadata = getStorageStore().get('pluginMetadata', {});

    const pluginStats: Array<{
      pluginId: string;
      keyCount: number;
      approximateSize: number;
      lastModified: string;
    }> = [];

    let totalKeys = 0;

    for (const pluginId of Object.keys(pluginData)) {
      const data = pluginData[pluginId];
      const keyCount = data ? Object.keys(data).length : 0;
      totalKeys += keyCount;

      const meta = metadata[pluginId];

      pluginStats.push({
        pluginId,
        keyCount,
        approximateSize: meta?.approximateSize ?? 0,
        lastModified: meta?.lastModified ?? 'unknown',
      });
    }

    return {
      totalPlugins: Object.keys(pluginData).length,
      totalKeys,
      pluginStats,
    };
  }

  /**
   * Check if a plugin has any stored data.
   *
   * @param pluginId - The plugin ID
   * @returns True if the plugin has stored data
   */
  hasPluginData(pluginId: string): boolean {
    const pluginData = getStorageStore().get('pluginData', {});
    return (
      pluginId in pluginData && Object.keys(pluginData[pluginId]).length > 0
    );
  }

  // ============ Helper Methods ============

  /**
   * Validate a storage key.
   */
  private isValidKey(key: string): boolean {
    // Keys must be non-empty strings without null characters
    return (
      typeof key === 'string' &&
      key.length > 0 &&
      key.length <= 256 &&
      !key.includes('\0')
    );
  }

  /**
   * Update the last accessed timestamp for a plugin.
   */
  private updateAccessTime(pluginId: string): void {
    try {
      const metadata = getStorageStore().get('pluginMetadata', {});
      if (!metadata[pluginId]) {
        metadata[pluginId] = {
          keyCount: 0,
          approximateSize: 0,
          lastAccessed: new Date().toISOString(),
          lastModified: new Date().toISOString(),
        };
      } else {
        metadata[pluginId].lastAccessed = new Date().toISOString();
      }
      getStorageStore().set('pluginMetadata', metadata);
    } catch {
      // Ignore metadata update errors
    }
  }

  /**
   * Update metadata for a plugin after a write operation.
   */
  private updateMetadata(pluginId: string): void {
    try {
      const pluginData = getStorageStore().get('pluginData', {});
      const data = pluginData[pluginId];
      const metadata = getStorageStore().get('pluginMetadata', {});

      const keyCount = data ? Object.keys(data).length : 0;
      const approximateSize = data
        ? new TextEncoder().encode(JSON.stringify(data)).length
        : 0;
      const now = new Date().toISOString();

      metadata[pluginId] = {
        keyCount,
        approximateSize,
        lastAccessed: now,
        lastModified: now,
      };

      getStorageStore().set('pluginMetadata', metadata);
    } catch {
      // Ignore metadata update errors
    }
  }

  /**
   * Clear all plugin storage data.
   * Use with caution - mainly for testing purposes.
   */
  clear(): void {
    getStorageStore().set('pluginData', {});
    getStorageStore().set('pluginMetadata', {});
  }

  /**
   * Get the path to the storage file.
   * Useful for debugging.
   */
  getStorePath(): string {
    return getStorageStore().path;
  }
}

// Export singleton instance following the service pattern
export const storageService = new StorageService();

// Export class for testing purposes
export { StorageService };

// Export storage store getter for advanced usage (testing, debugging)
export { getStorageStore };

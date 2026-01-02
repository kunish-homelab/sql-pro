/**
 * PluginRegistry Service
 *
 * Responsible for tracking installed plugins and their enable/disable state.
 * Persists plugin state across application restarts using electron-store.
 *
 * Following the service module pattern from database.ts and store.ts
 */

import type {
  PluginEvent,
  PluginEventType,
  PluginInfo,
  PluginManifest,
  PluginRegistryEntry,
  PluginState,
} from '@shared/types/plugin';
import Store from 'electron-store';
import EventEmitter from 'eventemitter3';

// ============ Types ============

/**
 * Plugin state stored in electron-store.
 */
interface StoredPluginState {
  /** Plugin ID */
  id: string;
  /** Whether plugin is enabled */
  enabled: boolean;
  /** Timestamp when plugin was installed */
  installedAt: string;
  /** Timestamp when plugin was last updated */
  updatedAt?: string;
  /** Plugin path on disk */
  path: string;
}

/**
 * Store schema for plugin registry.
 */
interface PluginRegistryStoreSchema {
  /** Map of plugin ID to stored state */
  pluginStates: Record<string, StoredPluginState>;
}

/**
 * Error codes specific to plugin registry operations.
 */
export type PluginRegistryErrorCode =
  | 'PLUGIN_NOT_FOUND'
  | 'PLUGIN_ALREADY_REGISTERED'
  | 'PLUGIN_NOT_REGISTERED'
  | 'INVALID_STATE_TRANSITION';

/**
 * Result type for registry operations.
 */
export type PluginRegistryResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string; errorCode?: PluginRegistryErrorCode };

// ============ Store Instance ============

const pluginStore = new Store<PluginRegistryStoreSchema>({
  name: 'sql-pro-plugins',
  defaults: {
    pluginStates: {},
  },
  // Enable schema migration for future updates
  migrations: {
    // Future migrations can be added here
    // '1.0.0': (store) => { ... }
  },
});

// ============ PluginRegistry Class ============

/**
 * PluginRegistry Service
 *
 * Manages the registry of installed plugins and their states.
 * Follows the singleton service pattern from database.ts.
 */
class PluginRegistry extends EventEmitter {
  /**
   * In-memory cache of registered plugins.
   * Maps plugin ID to registry entry.
   */
  private plugins: Map<string, PluginRegistryEntry> = new Map();

  constructor() {
    super();
  }

  /**
   * Initialize the registry by loading stored plugin states.
   * Should be called during app startup after plugins directory is scanned.
   */
  initialize(): void {
    // Clear any stale in-memory state
    this.plugins.clear();
  }

  /**
   * Register a new plugin in the registry.
   *
   * @param manifest - The plugin manifest
   * @param pluginPath - Absolute path to the plugin directory
   * @returns Success result or error
   *
   * @example
   * ```typescript
   * const result = pluginRegistry.register(manifest, '/path/to/plugin');
   * if (result.success) {
   *   console.log('Plugin registered successfully');
   * }
   * ```
   */
  register(manifest: PluginManifest, pluginPath: string): PluginRegistryResult {
    const pluginId = manifest.id;

    // Check if already registered
    if (this.plugins.has(pluginId)) {
      return {
        success: false,
        error: `Plugin already registered: ${pluginId}`,
        errorCode: 'PLUGIN_ALREADY_REGISTERED',
      };
    }

    // Load stored state if exists, otherwise create new state
    const storedStates = pluginStore.get('pluginStates', {});
    const storedState = storedStates[pluginId];

    const now = new Date().toISOString();
    const enabled = storedState?.enabled ?? false;
    const installedAt = storedState?.installedAt ?? now;

    // Create plugin info
    const info: PluginInfo = {
      manifest,
      path: pluginPath,
      state: enabled ? 'enabled' : 'installed',
      enabled,
      installedAt,
      updatedAt: storedState?.updatedAt,
    };

    // Create registry entry
    const entry: PluginRegistryEntry = {
      info,
      isLoaded: false,
    };

    // Add to in-memory registry
    this.plugins.set(pluginId, entry);

    // Persist state if new
    if (!storedState) {
      storedStates[pluginId] = {
        id: pluginId,
        enabled,
        installedAt,
        path: pluginPath,
      };
      pluginStore.set('pluginStates', storedStates);
    }

    // Emit event
    this.emitPluginEvent('plugin:installed', pluginId, info);

    return { success: true };
  }

  /**
   * Unregister a plugin from the registry.
   * This removes the plugin from the registry and clears stored state.
   *
   * @param pluginId - The plugin ID to unregister
   * @param removeData - Whether to remove stored plugin data
   * @returns Success result or error
   */
  unregister(pluginId: string, removeData = true): PluginRegistryResult {
    const entry = this.plugins.get(pluginId);

    if (!entry) {
      return {
        success: false,
        error: `Plugin not registered: ${pluginId}`,
        errorCode: 'PLUGIN_NOT_REGISTERED',
      };
    }

    // Store info before removal for event
    const info = entry.info;

    // Remove from in-memory registry
    this.plugins.delete(pluginId);

    // Remove from stored state if requested
    if (removeData) {
      const storedStates = pluginStore.get('pluginStates', {});
      delete storedStates[pluginId];
      pluginStore.set('pluginStates', storedStates);
    }

    // Emit event
    this.emitPluginEvent('plugin:uninstalled', pluginId, info);

    return { success: true };
  }

  /**
   * Enable a plugin.
   * The plugin must be registered before it can be enabled.
   *
   * @param pluginId - The plugin ID to enable
   * @returns Success result or error
   */
  enable(pluginId: string): PluginRegistryResult {
    const entry = this.plugins.get(pluginId);

    if (!entry) {
      return {
        success: false,
        error: `Plugin not found: ${pluginId}`,
        errorCode: 'PLUGIN_NOT_FOUND',
      };
    }

    // Update in-memory state
    entry.info.enabled = true;
    entry.info.state = 'enabled';

    // Persist state
    const storedStates = pluginStore.get('pluginStates', {});
    if (storedStates[pluginId]) {
      storedStates[pluginId].enabled = true;
      storedStates[pluginId].updatedAt = new Date().toISOString();
      pluginStore.set('pluginStates', storedStates);
    }

    // Emit event
    this.emitPluginEvent('plugin:enabled', pluginId, entry.info);

    return { success: true };
  }

  /**
   * Disable a plugin.
   * The plugin must be registered before it can be disabled.
   *
   * @param pluginId - The plugin ID to disable
   * @returns Success result or error
   */
  disable(pluginId: string): PluginRegistryResult {
    const entry = this.plugins.get(pluginId);

    if (!entry) {
      return {
        success: false,
        error: `Plugin not found: ${pluginId}`,
        errorCode: 'PLUGIN_NOT_FOUND',
      };
    }

    // Update in-memory state
    entry.info.enabled = false;
    entry.info.state = 'disabled';

    // Persist state
    const storedStates = pluginStore.get('pluginStates', {});
    if (storedStates[pluginId]) {
      storedStates[pluginId].enabled = false;
      storedStates[pluginId].updatedAt = new Date().toISOString();
      pluginStore.set('pluginStates', storedStates);
    }

    // Emit event
    this.emitPluginEvent('plugin:disabled', pluginId, entry.info);

    return { success: true };
  }

  /**
   * Update a plugin's state.
   *
   * @param pluginId - The plugin ID
   * @param state - The new state
   * @param error - Optional error message for error state
   * @returns Success result or error
   */
  updateState(
    pluginId: string,
    state: PluginState,
    error?: string
  ): PluginRegistryResult {
    const entry = this.plugins.get(pluginId);

    if (!entry) {
      return {
        success: false,
        error: `Plugin not found: ${pluginId}`,
        errorCode: 'PLUGIN_NOT_FOUND',
      };
    }

    // Update in-memory state
    entry.info.state = state;
    if (error) {
      entry.info.error = error;
    } else {
      delete entry.info.error;
    }

    // If state is 'error', emit error event
    if (state === 'error') {
      this.emitPluginEvent('plugin:error', pluginId, entry.info, error);
    }

    return { success: true };
  }

  /**
   * Mark a plugin as loaded (running in runtime).
   *
   * @param pluginId - The plugin ID
   * @param instanceId - The runtime instance ID
   * @returns Success result or error
   */
  setLoaded(pluginId: string, instanceId: string): PluginRegistryResult {
    const entry = this.plugins.get(pluginId);

    if (!entry) {
      return {
        success: false,
        error: `Plugin not found: ${pluginId}`,
        errorCode: 'PLUGIN_NOT_FOUND',
      };
    }

    entry.isLoaded = true;
    entry.instanceId = instanceId;

    return { success: true };
  }

  /**
   * Mark a plugin as unloaded (not running in runtime).
   *
   * @param pluginId - The plugin ID
   * @returns Success result or error
   */
  setUnloaded(pluginId: string): PluginRegistryResult {
    const entry = this.plugins.get(pluginId);

    if (!entry) {
      return {
        success: false,
        error: `Plugin not found: ${pluginId}`,
        errorCode: 'PLUGIN_NOT_FOUND',
      };
    }

    entry.isLoaded = false;
    entry.instanceId = undefined;

    return { success: true };
  }

  /**
   * Get a plugin by ID.
   *
   * @param pluginId - The plugin ID
   * @returns Plugin info or null if not found
   */
  get(pluginId: string): PluginInfo | null {
    const entry = this.plugins.get(pluginId);
    return entry?.info ?? null;
  }

  /**
   * Get the registry entry for a plugin.
   *
   * @param pluginId - The plugin ID
   * @returns Registry entry or null if not found
   */
  getEntry(pluginId: string): PluginRegistryEntry | null {
    return this.plugins.get(pluginId) ?? null;
  }

  /**
   * Check if a plugin is registered.
   *
   * @param pluginId - The plugin ID
   * @returns True if registered
   */
  has(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  /**
   * Check if a plugin is enabled.
   *
   * @param pluginId - The plugin ID
   * @returns True if enabled, false if disabled or not found
   */
  isEnabled(pluginId: string): boolean {
    const entry = this.plugins.get(pluginId);
    return entry?.info.enabled ?? false;
  }

  /**
   * Check if a plugin is loaded in runtime.
   *
   * @param pluginId - The plugin ID
   * @returns True if loaded, false if not loaded or not found
   */
  isLoaded(pluginId: string): boolean {
    const entry = this.plugins.get(pluginId);
    return entry?.isLoaded ?? false;
  }

  /**
   * Get all registered plugins.
   *
   * @returns Array of all plugin info objects
   */
  getAll(): PluginInfo[] {
    return Array.from(this.plugins.values()).map((entry) => entry.info);
  }

  /**
   * Get all enabled plugins.
   *
   * @returns Array of enabled plugin info objects
   */
  getEnabled(): PluginInfo[] {
    return this.getAll().filter((info) => info.enabled);
  }

  /**
   * Get all disabled plugins.
   *
   * @returns Array of disabled plugin info objects
   */
  getDisabled(): PluginInfo[] {
    return this.getAll().filter((info) => !info.enabled);
  }

  /**
   * Get all loaded plugins (running in runtime).
   *
   * @returns Array of loaded plugin entries
   */
  getLoaded(): PluginRegistryEntry[] {
    return Array.from(this.plugins.values()).filter((entry) => entry.isLoaded);
  }

  /**
   * Get plugins by state.
   *
   * @param state - The state to filter by
   * @returns Array of plugin info objects with the given state
   */
  getByState(state: PluginState): PluginInfo[] {
    return this.getAll().filter((info) => info.state === state);
  }

  /**
   * Get the count of registered plugins.
   *
   * @returns Number of registered plugins
   */
  count(): number {
    return this.plugins.size;
  }

  /**
   * Get the stored enabled state for a plugin.
   * Used during initialization to restore state from disk.
   *
   * @param pluginId - The plugin ID
   * @returns Stored state or null if not found
   */
  getStoredState(pluginId: string): StoredPluginState | null {
    const storedStates = pluginStore.get('pluginStates', {});
    return storedStates[pluginId] ?? null;
  }

  /**
   * Get all stored plugin states.
   *
   * @returns Map of plugin ID to stored state
   */
  getAllStoredStates(): Record<string, StoredPluginState> {
    return pluginStore.get('pluginStates', {});
  }

  /**
   * Update the plugin manifest (e.g., after an update).
   *
   * @param pluginId - The plugin ID
   * @param manifest - The new manifest
   * @returns Success result or error
   */
  updateManifest(
    pluginId: string,
    manifest: PluginManifest
  ): PluginRegistryResult {
    const entry = this.plugins.get(pluginId);

    if (!entry) {
      return {
        success: false,
        error: `Plugin not found: ${pluginId}`,
        errorCode: 'PLUGIN_NOT_FOUND',
      };
    }

    // Update manifest
    entry.info.manifest = manifest;
    entry.info.updatedAt = new Date().toISOString();

    // Update stored state
    const storedStates = pluginStore.get('pluginStates', {});
    if (storedStates[pluginId]) {
      storedStates[pluginId].updatedAt = entry.info.updatedAt;
      pluginStore.set('pluginStates', storedStates);
    }

    // Emit event
    this.emitPluginEvent('plugin:updated', pluginId, entry.info);

    return { success: true };
  }

  /**
   * Clear all registry state (in-memory and stored).
   * Use with caution - mainly for testing purposes.
   */
  clear(): void {
    this.plugins.clear();
    pluginStore.set('pluginStates', {});
  }

  /**
   * Emit a plugin lifecycle event.
   *
   * @param type - Event type
   * @param pluginId - Plugin ID
   * @param plugin - Plugin info
   * @param error - Optional error message
   */
  private emitPluginEvent(
    type: PluginEventType,
    pluginId: string,
    plugin?: PluginInfo,
    error?: string
  ): void {
    const event: PluginEvent = {
      type,
      pluginId,
      plugin,
      error,
      timestamp: new Date().toISOString(),
    };

    this.emit('plugin-event', event);
    this.emit(type, event);
  }
}

// Export singleton instance following the service pattern
export const pluginRegistry = new PluginRegistry();

// Export class for testing purposes
export { PluginRegistry };

// Export store for advanced usage (testing, debugging)
export { pluginStore };

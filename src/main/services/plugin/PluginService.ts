/**
 * PluginService Orchestrator
 *
 * The main orchestrator for the plugin system, coordinating the PluginLoader,
 * PluginRegistry, and PluginRuntime services to manage the complete plugin lifecycle.
 *
 * Responsibilities:
 * - Initialize and coordinate plugin infrastructure
 * - Install/uninstall plugins from various sources
 * - Enable/disable plugins with runtime activation
 * - Provide per-plugin persistent storage
 * - Handle marketplace operations
 * - Manage plugin updates
 *
 * Following the service module pattern from database.ts
 */

import type {
  MarketplaceRegistry,
  PluginEvent,
  PluginEventType,
  PluginInfo,
  PluginListing,
  PluginState,
  PluginUpdate,
} from '@shared/types/plugin';
import { Buffer } from 'node:buffer';
import Store from 'electron-store';
import EventEmitter from 'eventemitter3';
import { pluginLoader } from './PluginLoader';
import { pluginRegistry } from './PluginRegistry';
import { pluginRuntime } from './PluginRuntime';

// ============ Types ============

/**
 * Result type for plugin service operations.
 */
export type PluginServiceResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string; errorCode?: PluginServiceErrorCode };

/**
 * Error codes specific to plugin service operations.
 */
export type PluginServiceErrorCode =
  | 'INITIALIZATION_FAILED'
  | 'INSTALLATION_FAILED'
  | 'UNINSTALLATION_FAILED'
  | 'ENABLE_FAILED'
  | 'DISABLE_FAILED'
  | 'PLUGIN_NOT_FOUND'
  | 'PLUGIN_ALREADY_INSTALLED'
  | 'UPDATE_FAILED'
  | 'MARKETPLACE_FETCH_FAILED'
  | 'STORAGE_ERROR';

/**
 * Plugin storage schema for electron-store.
 */
interface PluginStorageSchema {
  /** Per-plugin storage data */
  pluginData: Record<string, Record<string, unknown>>;
  /** Marketplace cache */
  marketplaceCache?: {
    registry: MarketplaceRegistry;
    cachedAt: string;
  };
}

/**
 * Configuration options for plugin service initialization.
 */
export interface PluginServiceConfig {
  /** URL for marketplace registry */
  marketplaceUrl?: string;
  /** Cache duration for marketplace in milliseconds */
  marketplaceCacheDuration?: number;
  /** Whether to auto-load enabled plugins on startup */
  autoLoadEnabled?: boolean;
}

// ============ Constants ============

/** Default marketplace URL (to be configured) */
const DEFAULT_MARKETPLACE_URL =
  'https://raw.githubusercontent.com/example/sql-pro-plugins/main/registry.json';

/** Default cache duration: 1 hour */
const DEFAULT_CACHE_DURATION = 60 * 60 * 1000;

// ============ Storage Instance ============

const pluginStorageStore = new Store<PluginStorageSchema>({
  name: 'sql-pro-plugin-storage',
  defaults: {
    pluginData: {},
  },
});

// ============ PluginService Class ============

/**
 * PluginService
 *
 * Main orchestrator for the plugin system. Manages the complete plugin lifecycle
 * including installation, enabling, disabling, uninstallation, and updates.
 *
 * Follows the singleton service pattern from database.ts.
 */
class PluginService extends EventEmitter {
  /**
   * Whether the service has been initialized.
   */
  private initialized = false;

  /**
   * Service configuration.
   */
  private config: Required<PluginServiceConfig> = {
    marketplaceUrl: DEFAULT_MARKETPLACE_URL,
    marketplaceCacheDuration: DEFAULT_CACHE_DURATION,
    autoLoadEnabled: true,
  };

  constructor() {
    super();
    this.setupEventForwarding();
  }

  /**
   * Initialize the plugin service.
   * Should be called during app startup after IPC handlers are registered.
   *
   * @param config - Optional configuration options
   * @returns Success result or error
   *
   * @example
   * ```typescript
   * const result = await pluginService.initialize();
   * if (result.success) {
   *   console.log('Plugin system initialized');
   * }
   * ```
   */
  async initialize(config?: PluginServiceConfig): Promise<PluginServiceResult> {
    if (this.initialized) {
      return { success: true };
    }

    // Apply configuration
    if (config) {
      this.config = { ...this.config, ...config };
    }

    try {
      // Initialize plugin runtime
      const runtimeResult = await pluginRuntime.initialize();
      if (!runtimeResult.success) {
        // Runtime is optional - continue with degraded mode
        this.emit('service:warning', {
          message: 'Plugin runtime not available, running in degraded mode',
          error: runtimeResult.error,
        });
      }

      // Initialize registry
      pluginRegistry.initialize();

      // Scan installed plugins and register them
      const installedPlugins = pluginLoader.listInstalledPlugins();

      for (const pluginInfo of installedPlugins) {
        const registerResult = pluginRegistry.register(
          pluginInfo.manifest,
          pluginInfo.path
        );

        if (!registerResult.success) {
          this.emit('service:warning', {
            message: `Failed to register plugin: ${pluginInfo.manifest.id}`,
            error: registerResult.error,
          });
        }
      }

      // Auto-load enabled plugins if configured
      if (this.config.autoLoadEnabled) {
        await this.loadEnabledPlugins();
      }

      this.initialized = true;

      this.emit('service:initialized', {
        pluginCount: pluginRegistry.count(),
        runtimeAvailable: pluginRuntime.isAvailable(),
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to initialize plugin service: ${error instanceof Error ? error.message : String(error)}`,
        errorCode: 'INITIALIZATION_FAILED',
      };
    }
  }

  /**
   * Check if the service is initialized.
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  // ============ Installation ============

  /**
   * Install a plugin from a source (archive, directory, or URL).
   *
   * @param source - Path or URL to the plugin
   * @param sourceType - Type of source
   * @returns Success result with plugin info or error
   *
   * @example
   * ```typescript
   * const result = await pluginService.installPlugin(
   *   '/path/to/plugin.sqlpro-plugin',
   *   'archive'
   * );
   * if (result.success) {
   *   console.log('Installed:', result.data.manifest.name);
   * }
   * ```
   */
  async installPlugin(
    source: string,
    sourceType: 'archive' | 'directory' | 'url'
  ): Promise<PluginServiceResult<PluginInfo>> {
    try {
      // Load and validate the plugin
      const loadResult = await pluginLoader.loadPlugin(source, sourceType);

      if (!loadResult.success) {
        return {
          success: false,
          error: loadResult.error,
          errorCode: 'INSTALLATION_FAILED',
        };
      }

      const { manifest, pluginPath } = loadResult;

      // Check if already installed
      if (pluginRegistry.has(manifest.id)) {
        return {
          success: false,
          error: `Plugin already installed: ${manifest.id}`,
          errorCode: 'PLUGIN_ALREADY_INSTALLED',
        };
      }

      // Register the plugin
      const registerResult = pluginRegistry.register(manifest, pluginPath);

      if (!registerResult.success) {
        // Clean up installed files
        await pluginLoader.removePlugin(manifest.id);

        return {
          success: false,
          error: registerResult.error,
          errorCode: 'INSTALLATION_FAILED',
        };
      }

      // Get the registered plugin info
      const pluginInfo = pluginRegistry.get(manifest.id);

      if (!pluginInfo) {
        return {
          success: false,
          error: 'Failed to retrieve registered plugin',
          errorCode: 'INSTALLATION_FAILED',
        };
      }

      this.emitPluginEvent('plugin:installed', manifest.id, pluginInfo);

      return { success: true, data: pluginInfo };
    } catch (error) {
      return {
        success: false,
        error: `Installation failed: ${error instanceof Error ? error.message : String(error)}`,
        errorCode: 'INSTALLATION_FAILED',
      };
    }
  }

  /**
   * Install a plugin from the marketplace.
   *
   * @param pluginListing - The marketplace listing for the plugin
   * @returns Success result with plugin info or error
   */
  async installFromMarketplace(
    pluginListing: PluginListing
  ): Promise<PluginServiceResult<PluginInfo>> {
    return this.installPlugin(pluginListing.downloadUrl, 'url');
  }

  // ============ Uninstallation ============

  /**
   * Uninstall a plugin.
   *
   * @param pluginId - The plugin ID to uninstall
   * @param removeData - Whether to remove plugin data (default: true)
   * @returns Success result or error
   *
   * @example
   * ```typescript
   * const result = await pluginService.uninstallPlugin('com.example.myplugin');
   * if (result.success) {
   *   console.log('Plugin uninstalled');
   * }
   * ```
   */
  async uninstallPlugin(
    pluginId: string,
    removeData = true
  ): Promise<PluginServiceResult> {
    try {
      // Check if plugin exists
      const pluginInfo = pluginRegistry.get(pluginId);

      if (!pluginInfo) {
        return {
          success: false,
          error: `Plugin not found: ${pluginId}`,
          errorCode: 'PLUGIN_NOT_FOUND',
        };
      }

      // Unload from runtime if loaded
      if (pluginRegistry.isLoaded(pluginId)) {
        const unloadResult = await pluginRuntime.unloadPlugin(pluginId);
        if (!unloadResult.success) {
          // Log warning but continue with uninstallation
          this.emit('service:warning', {
            message: `Failed to unload plugin: ${pluginId}`,
            error: unloadResult.error,
          });
        }
      }

      // Unregister from registry
      const unregisterResult = pluginRegistry.unregister(pluginId, removeData);

      if (!unregisterResult.success) {
        return {
          success: false,
          error: unregisterResult.error,
          errorCode: 'UNINSTALLATION_FAILED',
        };
      }

      // Remove plugin files from disk
      const removeResult = await pluginLoader.removePlugin(pluginId);

      if (!removeResult.success) {
        // Log warning but consider uninstallation successful
        // since the plugin is already unregistered
        this.emit('service:warning', {
          message: `Failed to remove plugin files: ${pluginId}`,
          error: removeResult.error,
        });
      }

      // Remove plugin data if requested
      if (removeData) {
        this.clearPluginStorage(pluginId);
      }

      this.emitPluginEvent('plugin:uninstalled', pluginId);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Uninstallation failed: ${error instanceof Error ? error.message : String(error)}`,
        errorCode: 'UNINSTALLATION_FAILED',
      };
    }
  }

  // ============ Enable/Disable ============

  /**
   * Enable a plugin and load it into the runtime.
   *
   * @param pluginId - The plugin ID to enable
   * @returns Success result or error
   *
   * @example
   * ```typescript
   * const result = await pluginService.enablePlugin('com.example.myplugin');
   * if (result.success) {
   *   console.log('Plugin enabled and loaded');
   * }
   * ```
   */
  async enablePlugin(pluginId: string): Promise<PluginServiceResult> {
    try {
      // Check if plugin exists
      const pluginInfo = pluginRegistry.get(pluginId);

      if (!pluginInfo) {
        return {
          success: false,
          error: `Plugin not found: ${pluginId}`,
          errorCode: 'PLUGIN_NOT_FOUND',
        };
      }

      // Check if already enabled
      if (pluginInfo.enabled) {
        return { success: true };
      }

      // Enable in registry first
      const enableResult = pluginRegistry.enable(pluginId);

      if (!enableResult.success) {
        return {
          success: false,
          error: enableResult.error,
          errorCode: 'ENABLE_FAILED',
        };
      }

      // Load plugin into runtime
      const loadResult = await this.loadPlugin(pluginId);

      if (!loadResult.success) {
        // Revert enable state
        pluginRegistry.disable(pluginId);

        // Update state to error
        pluginRegistry.updateState(pluginId, 'error', loadResult.error);

        return {
          success: false,
          error: loadResult.error,
          errorCode: 'ENABLE_FAILED',
        };
      }

      this.emitPluginEvent(
        'plugin:enabled',
        pluginId,
        pluginRegistry.get(pluginId) ?? undefined
      );

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Enable failed: ${error instanceof Error ? error.message : String(error)}`,
        errorCode: 'ENABLE_FAILED',
      };
    }
  }

  /**
   * Disable a plugin and unload it from the runtime.
   *
   * @param pluginId - The plugin ID to disable
   * @returns Success result or error
   *
   * @example
   * ```typescript
   * const result = await pluginService.disablePlugin('com.example.myplugin');
   * if (result.success) {
   *   console.log('Plugin disabled');
   * }
   * ```
   */
  async disablePlugin(pluginId: string): Promise<PluginServiceResult> {
    try {
      // Check if plugin exists
      const pluginInfo = pluginRegistry.get(pluginId);

      if (!pluginInfo) {
        return {
          success: false,
          error: `Plugin not found: ${pluginId}`,
          errorCode: 'PLUGIN_NOT_FOUND',
        };
      }

      // Check if already disabled
      if (!pluginInfo.enabled) {
        return { success: true };
      }

      // Unload from runtime first
      if (pluginRegistry.isLoaded(pluginId)) {
        const unloadResult = await pluginRuntime.unloadPlugin(pluginId);

        if (!unloadResult.success) {
          // Log warning but continue with disable
          this.emit('service:warning', {
            message: `Failed to unload plugin: ${pluginId}`,
            error: unloadResult.error,
          });
        }

        pluginRegistry.setUnloaded(pluginId);
      }

      // Disable in registry
      const disableResult = pluginRegistry.disable(pluginId);

      if (!disableResult.success) {
        return {
          success: false,
          error: disableResult.error,
          errorCode: 'DISABLE_FAILED',
        };
      }

      this.emitPluginEvent(
        'plugin:disabled',
        pluginId,
        pluginRegistry.get(pluginId) ?? undefined
      );

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Disable failed: ${error instanceof Error ? error.message : String(error)}`,
        errorCode: 'DISABLE_FAILED',
      };
    }
  }

  // ============ Plugin Loading ============

  /**
   * Load a plugin into the runtime.
   *
   * @param pluginId - The plugin ID to load
   * @returns Success result or error
   */
  private async loadPlugin(
    pluginId: string
  ): Promise<PluginServiceResult<string>> {
    const pluginInfo = pluginRegistry.get(pluginId);

    if (!pluginInfo) {
      return {
        success: false,
        error: `Plugin not found: ${pluginId}`,
        errorCode: 'PLUGIN_NOT_FOUND',
      };
    }

    // Read plugin code
    const code = pluginLoader.readPluginCode(
      pluginInfo.path,
      pluginInfo.manifest
    );

    if (!code) {
      return {
        success: false,
        error: 'Failed to read plugin code',
        errorCode: 'ENABLE_FAILED',
      };
    }

    // Update state to loading
    pluginRegistry.updateState(pluginId, 'loading');

    // Load into runtime
    const loadResult = await pluginRuntime.loadPlugin(
      pluginId,
      pluginInfo.manifest,
      code,
      pluginInfo.path
    );

    if (!loadResult.success) {
      pluginRegistry.updateState(pluginId, 'error', loadResult.error);
      return {
        success: false,
        error: loadResult.error,
        errorCode: 'ENABLE_FAILED',
      };
    }

    // Mark as loaded
    pluginRegistry.setLoaded(pluginId, loadResult.data!);
    pluginRegistry.updateState(pluginId, 'enabled');

    return { success: true, data: loadResult.data };
  }

  /**
   * Load all enabled plugins into the runtime.
   * Called during initialization if autoLoadEnabled is true.
   */
  private async loadEnabledPlugins(): Promise<void> {
    const enabledPlugins = pluginRegistry.getEnabled();

    for (const pluginInfo of enabledPlugins) {
      try {
        const result = await this.loadPlugin(pluginInfo.manifest.id);

        if (!result.success) {
          this.emit('service:warning', {
            message: `Failed to load enabled plugin: ${pluginInfo.manifest.id}`,
            error: result.error,
          });
        }
      } catch (error) {
        this.emit('service:warning', {
          message: `Error loading plugin: ${pluginInfo.manifest.id}`,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  // ============ Plugin Queries ============

  /**
   * Get a plugin by ID.
   *
   * @param pluginId - The plugin ID
   * @returns Plugin info or null
   */
  getPlugin(pluginId: string): PluginInfo | null {
    return pluginRegistry.get(pluginId);
  }

  /**
   * Get all installed plugins.
   *
   * @returns Array of plugin info objects
   */
  getAll(): PluginInfo[] {
    return pluginRegistry.getAll();
  }

  /**
   * Get enabled plugins.
   *
   * @returns Array of enabled plugin info objects
   */
  getEnabled(): PluginInfo[] {
    return pluginRegistry.getEnabled();
  }

  /**
   * Get disabled plugins.
   *
   * @returns Array of disabled plugin info objects
   */
  getDisabled(): PluginInfo[] {
    return pluginRegistry.getDisabled();
  }

  /**
   * Get plugins by state.
   *
   * @param state - Plugin state to filter by
   * @returns Array of plugin info objects
   */
  getByState(state: PluginState): PluginInfo[] {
    return pluginRegistry.getByState(state);
  }

  /**
   * Check if a plugin is installed.
   *
   * @param pluginId - Plugin ID
   * @returns True if installed
   */
  isInstalled(pluginId: string): boolean {
    return pluginRegistry.has(pluginId);
  }

  /**
   * Check if a plugin is enabled.
   *
   * @param pluginId - Plugin ID
   * @returns True if enabled
   */
  isEnabled(pluginId: string): boolean {
    return pluginRegistry.isEnabled(pluginId);
  }

  /**
   * Check if a plugin is loaded in runtime.
   *
   * @param pluginId - Plugin ID
   * @returns True if loaded
   */
  isLoaded(pluginId: string): boolean {
    return pluginRegistry.isLoaded(pluginId);
  }

  /**
   * Get the count of installed plugins.
   *
   * @returns Number of installed plugins
   */
  count(): number {
    return pluginRegistry.count();
  }

  // ============ Plugin Storage ============

  /**
   * Get a value from plugin storage.
   *
   * @param pluginId - Plugin ID
   * @param key - Storage key
   * @returns Stored value or undefined
   */
  getPluginData<T = unknown>(pluginId: string, key: string): T | undefined {
    const pluginData = pluginStorageStore.get('pluginData', {});
    const data = pluginData[pluginId];

    if (!data) {
      return undefined;
    }

    return data[key] as T | undefined;
  }

  /**
   * Set a value in plugin storage.
   *
   * @param pluginId - Plugin ID
   * @param key - Storage key
   * @param value - Value to store
   */
  setPluginData<T = unknown>(pluginId: string, key: string, value: T): void {
    const pluginData = pluginStorageStore.get('pluginData', {});

    if (!pluginData[pluginId]) {
      pluginData[pluginId] = {};
    }

    pluginData[pluginId][key] = value;
    pluginStorageStore.set('pluginData', pluginData);
  }

  /**
   * Remove a value from plugin storage.
   *
   * @param pluginId - Plugin ID
   * @param key - Storage key
   */
  removePluginData(pluginId: string, key: string): void {
    const pluginData = pluginStorageStore.get('pluginData', {});
    const data = pluginData[pluginId];

    if (data) {
      delete data[key];
      pluginStorageStore.set('pluginData', pluginData);
    }
  }

  /**
   * Get all storage keys for a plugin.
   *
   * @param pluginId - Plugin ID
   * @returns Array of storage keys
   */
  getPluginDataKeys(pluginId: string): string[] {
    const pluginData = pluginStorageStore.get('pluginData', {});
    const data = pluginData[pluginId];

    return data ? Object.keys(data) : [];
  }

  /**
   * Clear all storage for a plugin.
   *
   * @param pluginId - Plugin ID
   */
  clearPluginStorage(pluginId: string): void {
    const pluginData = pluginStorageStore.get('pluginData', {});
    delete pluginData[pluginId];
    pluginStorageStore.set('pluginData', pluginData);
  }

  // ============ Updates ============

  /**
   * Update a plugin to a newer version.
   *
   * @param pluginId - Plugin ID to update
   * @param newSource - Source of the new version
   * @param sourceType - Type of source
   * @returns Success result with updated plugin info or error
   */
  async updatePlugin(
    pluginId: string,
    newSource: string,
    sourceType: 'archive' | 'directory' | 'url'
  ): Promise<PluginServiceResult<PluginInfo>> {
    try {
      // Get current plugin info
      const currentInfo = pluginRegistry.get(pluginId);

      if (!currentInfo) {
        return {
          success: false,
          error: `Plugin not found: ${pluginId}`,
          errorCode: 'PLUGIN_NOT_FOUND',
        };
      }

      const wasEnabled = currentInfo.enabled;

      // Disable and unload if currently enabled
      if (wasEnabled) {
        await this.disablePlugin(pluginId);
      }

      // Unregister the old version (but keep data)
      pluginRegistry.unregister(pluginId, false);

      // Load the new version
      const loadResult = await pluginLoader.loadPlugin(newSource, sourceType);

      if (!loadResult.success) {
        // Try to restore the old version
        const restoreResult = pluginLoader.loadFromDirectory(currentInfo.path);
        if (restoreResult.success) {
          pluginRegistry.register(
            restoreResult.manifest,
            restoreResult.pluginPath
          );
        }

        return {
          success: false,
          error: loadResult.error,
          errorCode: 'UPDATE_FAILED',
        };
      }

      const { manifest, pluginPath } = loadResult;

      // Verify plugin ID matches
      if (manifest.id !== pluginId) {
        // Restore old version
        const restoreResult = pluginLoader.loadFromDirectory(currentInfo.path);
        if (restoreResult.success) {
          pluginRegistry.register(
            restoreResult.manifest,
            restoreResult.pluginPath
          );
        }

        return {
          success: false,
          error: `Plugin ID mismatch: expected ${pluginId}, got ${manifest.id}`,
          errorCode: 'UPDATE_FAILED',
        };
      }

      // Remove old plugin files
      await pluginLoader.removePlugin(pluginId);

      // Register new version
      const registerResult = pluginRegistry.register(manifest, pluginPath);

      if (!registerResult.success) {
        return {
          success: false,
          error: registerResult.error,
          errorCode: 'UPDATE_FAILED',
        };
      }

      // Update manifest in registry
      pluginRegistry.updateManifest(pluginId, manifest);

      // Re-enable if it was enabled before
      if (wasEnabled) {
        await this.enablePlugin(pluginId);
      }

      const updatedInfo = pluginRegistry.get(pluginId);

      this.emitPluginEvent(
        'plugin:updated',
        pluginId,
        updatedInfo ?? undefined
      );

      return { success: true, data: updatedInfo ?? undefined };
    } catch (error) {
      return {
        success: false,
        error: `Update failed: ${error instanceof Error ? error.message : String(error)}`,
        errorCode: 'UPDATE_FAILED',
      };
    }
  }

  /**
   * Check for updates for installed plugins.
   *
   * @param pluginIds - Specific plugin IDs to check (optional)
   * @returns Array of available updates
   */
  async checkForUpdates(
    pluginIds?: string[]
  ): Promise<PluginServiceResult<PluginUpdate[]>> {
    try {
      // Fetch marketplace registry
      const marketplaceResult = await this.fetchMarketplace();

      if (!marketplaceResult.success) {
        return {
          success: false,
          error: marketplaceResult.error,
          errorCode: 'MARKETPLACE_FETCH_FAILED',
        };
      }

      if (!marketplaceResult.data) {
        return {
          success: false,
          error: 'Failed to fetch marketplace',
          errorCode: 'MARKETPLACE_FETCH_FAILED',
        };
      }

      const registry = marketplaceResult.data;
      const updates: PluginUpdate[] = [];

      // Get plugins to check
      const pluginsToCheck = pluginIds
        ? pluginIds
            .map((id) => pluginRegistry.get(id))
            .filter((p): p is PluginInfo => p !== null)
        : pluginRegistry.getAll();

      for (const plugin of pluginsToCheck) {
        const listing = registry.plugins.find(
          (p) => p.id === plugin.manifest.id
        );

        if (
          listing &&
          this.isNewerVersion(listing.version, plugin.manifest.version)
        ) {
          updates.push({
            pluginId: plugin.manifest.id,
            currentVersion: plugin.manifest.version,
            newVersion: listing.version,
            changelog: undefined, // Could be fetched separately
            downloadUrl: listing.downloadUrl,
          });
        }
      }

      return { success: true, data: updates };
    } catch (error) {
      return {
        success: false,
        error: `Failed to check updates: ${error instanceof Error ? error.message : String(error)}`,
        errorCode: 'UPDATE_FAILED',
      };
    }
  }

  // ============ Marketplace ============

  /**
   * Fetch the marketplace registry.
   *
   * @param forceRefresh - Force refresh cache
   * @returns Marketplace registry or error
   */
  async fetchMarketplace(
    forceRefresh = false
  ): Promise<PluginServiceResult<MarketplaceRegistry>> {
    try {
      // Check cache first
      if (!forceRefresh) {
        const cache = pluginStorageStore.get('marketplaceCache');

        if (cache) {
          const cacheAge = Date.now() - new Date(cache.cachedAt).getTime();

          if (cacheAge < this.config.marketplaceCacheDuration) {
            return { success: true, data: cache.registry };
          }
        }
      }

      // Fetch from network
      const { net } = await import('electron');

      return new Promise((resolve) => {
        const request = net.request(this.config.marketplaceUrl);

        request.on('response', (response) => {
          if (response.statusCode !== 200) {
            // Try to return cached data if available
            const cache = pluginStorageStore.get('marketplaceCache');
            if (cache) {
              resolve({ success: true, data: cache.registry });
              return;
            }

            resolve({
              success: false,
              error: `Failed to fetch marketplace: HTTP ${response.statusCode}`,
              errorCode: 'MARKETPLACE_FETCH_FAILED',
            });
            return;
          }

          const chunks: Buffer[] = [];

          response.on('data', (chunk) => {
            chunks.push(chunk);
          });

          response.on('end', () => {
            try {
              const body = Buffer.concat(chunks).toString('utf-8');
              const registry = JSON.parse(body) as MarketplaceRegistry;

              // Update cache
              pluginStorageStore.set('marketplaceCache', {
                registry,
                cachedAt: new Date().toISOString(),
              });

              resolve({ success: true, data: registry });
            } catch (error) {
              resolve({
                success: false,
                error: `Failed to parse marketplace response: ${error instanceof Error ? error.message : String(error)}`,
                errorCode: 'MARKETPLACE_FETCH_FAILED',
              });
            }
          });

          response.on('error', (error) => {
            // Try to return cached data
            const cache = pluginStorageStore.get('marketplaceCache');
            if (cache) {
              resolve({ success: true, data: cache.registry });
              return;
            }

            resolve({
              success: false,
              error: `Network error: ${error.message}`,
              errorCode: 'MARKETPLACE_FETCH_FAILED',
            });
          });
        });

        request.on('error', (error) => {
          // Try to return cached data
          const cache = pluginStorageStore.get('marketplaceCache');
          if (cache) {
            resolve({ success: true, data: cache.registry });
            return;
          }

          resolve({
            success: false,
            error: `Request error: ${error.message}`,
            errorCode: 'MARKETPLACE_FETCH_FAILED',
          });
        });

        request.end();
      });
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch marketplace: ${error instanceof Error ? error.message : String(error)}`,
        errorCode: 'MARKETPLACE_FETCH_FAILED',
      };
    }
  }

  /**
   * Search the marketplace.
   *
   * @param query - Search query
   * @param category - Optional category filter
   * @returns Filtered plugin listings
   */
  async searchMarketplace(
    query?: string,
    category?: string
  ): Promise<PluginServiceResult<PluginListing[]>> {
    const marketplaceResult = await this.fetchMarketplace();

    if (!marketplaceResult.success) {
      return {
        success: false,
        error: marketplaceResult.error,
        errorCode: 'MARKETPLACE_FETCH_FAILED',
      };
    }

    if (!marketplaceResult.data) {
      return {
        success: false,
        error: 'Failed to fetch marketplace',
        errorCode: 'MARKETPLACE_FETCH_FAILED',
      };
    }

    let plugins = marketplaceResult.data.plugins;

    // Filter by category
    if (category) {
      plugins = plugins.filter(
        (p) => p.categories?.includes(category) ?? false
      );
    }

    // Filter by search query
    if (query) {
      const lowerQuery = query.toLowerCase();
      plugins = plugins.filter(
        (p) =>
          p.name.toLowerCase().includes(lowerQuery) ||
          p.description.toLowerCase().includes(lowerQuery) ||
          p.author.toLowerCase().includes(lowerQuery) ||
          p.id.toLowerCase().includes(lowerQuery)
      );
    }

    return { success: true, data: plugins };
  }

  // ============ Query Hooks ============

  /**
   * Execute before-query hooks for all loaded plugins.
   * Returns the potentially modified query context.
   */
  async executeBeforeQueryHooks(
    context: import('@shared/types/plugin').QueryContext
  ): Promise<{
    context: import('@shared/types/plugin').QueryContext;
    cancelled: boolean;
    cancelReason?: string;
  }> {
    return pluginRuntime.executeBeforeQueryHooks(context);
  }

  /**
   * Execute after-query hooks for all loaded plugins.
   */
  async executeAfterQueryHooks(
    results: import('@shared/types/plugin').QueryResults,
    context: import('@shared/types/plugin').QueryContext
  ): Promise<import('@shared/types/plugin').QueryResults> {
    return pluginRuntime.executeAfterQueryHooks(results, context);
  }

  /**
   * Execute query error hooks for all loaded plugins.
   */
  async executeQueryErrorHooks(
    error: import('@shared/types/plugin').QueryError
  ): Promise<void> {
    return pluginRuntime.executeQueryErrorHooks(error);
  }

  // ============ Helpers ============

  /**
   * Compare version strings to check if version a is newer than version b.
   */
  private isNewerVersion(a: string, b: string): boolean {
    const parseVersion = (v: string): number[] => {
      return v
        .replace(/^v/, '')
        .split('.')
        .map((n) => Number.parseInt(n, 10) || 0);
    };

    const [aMajor, aMinor = 0, aPatch = 0] = parseVersion(a);
    const [bMajor, bMinor = 0, bPatch = 0] = parseVersion(b);

    if (aMajor !== bMajor) return aMajor > bMajor;
    if (aMinor !== bMinor) return aMinor > bMinor;
    return aPatch > bPatch;
  }

  /**
   * Set up event forwarding from child services.
   */
  private setupEventForwarding(): void {
    // Forward registry events
    pluginRegistry.on('plugin-event', (event: PluginEvent) => {
      this.emit('plugin-event', event);
    });

    // Forward runtime events
    pluginRuntime.on('plugin:loaded', (data) => {
      this.emit('runtime:plugin:loaded', data);
    });

    pluginRuntime.on('plugin:unloaded', (data) => {
      this.emit('runtime:plugin:unloaded', data);
    });

    pluginRuntime.on('hook:error', (data) => {
      this.emit('runtime:hook:error', data);
    });

    pluginRuntime.on('plugin:log', (data) => {
      this.emit('plugin:log', data);
    });

    // Forward UI events
    pluginRuntime.on('command:registered', (data) => {
      this.emit('command:registered', data);
    });

    pluginRuntime.on('menuItem:registered', (data) => {
      this.emit('menuItem:registered', data);
    });

    pluginRuntime.on('panel:registered', (data) => {
      this.emit('panel:registered', data);
    });

    pluginRuntime.on('notification:show', (data) => {
      this.emit('notification:show', data);
    });
  }

  /**
   * Emit a plugin lifecycle event.
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

  /**
   * Shutdown the plugin service.
   * Unloads all plugins and cleans up resources.
   */
  async shutdown(): Promise<void> {
    // Unload all running plugins
    const loadedPlugins = pluginRegistry.getLoaded();

    for (const entry of loadedPlugins) {
      try {
        await pluginRuntime.unloadPlugin(entry.info.manifest.id);
      } catch {
        // Ignore errors during shutdown
      }
    }

    // Clear runtime
    await pluginRuntime.clear();

    this.initialized = false;
    this.emit('service:shutdown');
  }
}

// Export singleton instance following the service pattern
export const pluginService = new PluginService();

// Export class for testing purposes
export { PluginService };

// Export storage store for advanced usage (testing, debugging)
export { pluginStorageStore };

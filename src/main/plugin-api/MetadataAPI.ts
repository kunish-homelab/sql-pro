/**
 * Metadata API
 *
 * Provides plugin API methods for accessing application and connection metadata:
 * - getPluginInfo(): Get plugin's own manifest information
 * - getCurrentConnection(): Get current database connection (if any)
 * - getAppInfo(): Get application information (version, platform, arch, isDev)
 *
 * This API allows plugins to query read-only information about the application
 * state and their own configuration without being able to modify anything.
 *
 * Following the service module pattern from database.ts
 */

import type {
  AppInfo,
  ConnectionInfo,
  MetadataAPI,
  PluginManifest,
} from '@/types/plugin';

import process from 'node:process';
import { app } from 'electron';

import EventEmitter from 'eventemitter3';

// ============ Types ============

/**
 * Result type for metadata operations.
 */
export type MetadataResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; errorCode?: MetadataErrorCode };

/**
 * Error codes specific to metadata operations.
 */
export type MetadataErrorCode =
  | 'PLUGIN_ID_REQUIRED'
  | 'PLUGIN_NOT_FOUND'
  | 'CONNECTION_NOT_FOUND'
  | 'METADATA_READ_ERROR';

// ============ Event Types ============

/**
 * Event types emitted by MetadataService.
 */
export type MetadataEventType =
  | 'metadata:connection_changed'
  | 'metadata:plugin_registered'
  | 'metadata:plugin_unregistered';

/**
 * Event payload types.
 */
export interface MetadataEvents {
  'metadata:connection_changed': { connectionId: string | null };
  'metadata:plugin_registered': { pluginId: string };
  'metadata:plugin_unregistered': { pluginId: string };
}

// ============ MetadataService Class ============

/**
 * MetadataService
 *
 * Central service for managing metadata access for plugins.
 * Follows the singleton service pattern from database.ts and store.ts.
 *
 * Key features:
 * - Read-only access to application metadata
 * - Plugin manifest access (registered plugins only)
 * - Current connection tracking
 * - Application version and platform information
 *
 * @example
 * ```typescript
 * // Register a plugin's manifest
 * metadataService.registerPluginManifest('my-plugin', manifest);
 *
 * // Create a plugin-scoped metadata API
 * const api = metadataService.createPluginMetadataAPI('my-plugin');
 *
 * // In plugin code:
 * const info = api.getPluginInfo();
 * const connection = api.getCurrentConnection();
 * const appInfo = api.getAppInfo();
 * ```
 */
class MetadataService extends EventEmitter {
  /** Registered plugin manifests keyed by plugin ID */
  private pluginManifests: Map<string, PluginManifest> = new Map();

  /** Current active connection info */
  private currentConnection: ConnectionInfo | null = null;

  /** Cached app info */
  private appInfoCache: AppInfo | null = null;

  constructor() {
    super();
  }

  // ============ Plugin Registration ============

  /**
   * Register a plugin's manifest for metadata access.
   * Called when a plugin is loaded.
   *
   * @param pluginId - The plugin ID
   * @param manifest - The plugin manifest
   *
   * @example
   * ```typescript
   * metadataService.registerPluginManifest('my-plugin', {
   *   id: 'my-plugin',
   *   name: 'My Plugin',
   *   version: '1.0.0',
   *   // ...
   * });
   * ```
   */
  registerPluginManifest(pluginId: string, manifest: PluginManifest): void {
    this.pluginManifests.set(pluginId, manifest);
    this.emit('metadata:plugin_registered', { pluginId });
  }

  /**
   * Unregister a plugin's manifest.
   * Called when a plugin is unloaded.
   *
   * @param pluginId - The plugin ID
   *
   * @example
   * ```typescript
   * metadataService.unregisterPluginManifest('my-plugin');
   * ```
   */
  unregisterPluginManifest(pluginId: string): void {
    this.pluginManifests.delete(pluginId);
    this.emit('metadata:plugin_unregistered', { pluginId });
  }

  /**
   * Check if a plugin is registered.
   *
   * @param pluginId - The plugin ID
   * @returns True if the plugin is registered
   */
  isPluginRegistered(pluginId: string): boolean {
    return this.pluginManifests.has(pluginId);
  }

  /**
   * Get the number of registered plugins.
   */
  getRegisteredPluginCount(): number {
    return this.pluginManifests.size;
  }

  // ============ Core Metadata API ============

  /**
   * Get a plugin's manifest information.
   *
   * @param pluginId - The plugin ID
   * @returns Result containing the plugin manifest or error
   *
   * @example
   * ```typescript
   * const result = metadataService.getPluginInfo('my-plugin');
   * if (result.success) {
   *   console.log('Plugin version:', result.data.version);
   * }
   * ```
   */
  getPluginInfo(pluginId: string): MetadataResult<PluginManifest> {
    // Validate input
    if (!pluginId || typeof pluginId !== 'string') {
      return {
        success: false,
        error: 'Plugin ID is required and must be a string',
        errorCode: 'PLUGIN_ID_REQUIRED',
      };
    }

    const manifest = this.pluginManifests.get(pluginId);

    if (!manifest) {
      return {
        success: false,
        error: `Plugin '${pluginId}' is not registered`,
        errorCode: 'PLUGIN_NOT_FOUND',
      };
    }

    // Return a copy to prevent modification
    return {
      success: true,
      data: { ...manifest },
    };
  }

  /**
   * Get the current database connection information.
   *
   * @returns Current connection info or null if not connected
   *
   * @example
   * ```typescript
   * const connection = metadataService.getCurrentConnection();
   * if (connection) {
   *   console.log('Connected to:', connection.filename);
   * }
   * ```
   */
  getCurrentConnection(): ConnectionInfo | null {
    // Return a copy to prevent modification
    return this.currentConnection ? { ...this.currentConnection } : null;
  }

  /**
   * Set the current database connection information.
   * Called by the database service when a connection is opened or closed.
   *
   * @param connection - Connection info or null when disconnecting
   *
   * @example
   * ```typescript
   * metadataService.setCurrentConnection({
   *   id: 'conn_123',
   *   path: '/path/to/db.sqlite',
   *   filename: 'db.sqlite',
   *   isEncrypted: false,
   *   isReadOnly: false,
   * });
   *
   * // When disconnecting:
   * metadataService.setCurrentConnection(null);
   * ```
   */
  setCurrentConnection(connection: ConnectionInfo | null): void {
    this.currentConnection = connection;
    this.emit('metadata:connection_changed', {
      connectionId: connection?.id ?? null,
    });
  }

  /**
   * Get application information.
   *
   * @returns Application info including version, platform, architecture, and dev mode status
   *
   * @example
   * ```typescript
   * const appInfo = metadataService.getAppInfo();
   * console.log('App version:', appInfo.version);
   * console.log('Platform:', appInfo.platform);
   * ```
   */
  getAppInfo(): AppInfo {
    // Use cached value if available
    if (this.appInfoCache) {
      return { ...this.appInfoCache };
    }

    // Build app info
    const appInfo: AppInfo = {
      version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      isDev: !app.isPackaged,
    };

    // Cache for future calls
    this.appInfoCache = appInfo;

    return { ...appInfo };
  }

  // ============ Plugin-Scoped API Factory ============

  /**
   * Create a plugin-scoped metadata API.
   * This is the API exposed to plugins via the PluginContext.
   *
   * @param pluginId - The plugin ID
   * @returns Plugin-scoped metadata API
   *
   * @example
   * ```typescript
   * const metadataApi = metadataService.createPluginMetadataAPI('my-plugin');
   *
   * // In plugin code:
   * const info = metadataApi.getPluginInfo();
   * const connection = metadataApi.getCurrentConnection();
   * const appInfo = metadataApi.getAppInfo();
   * ```
   */
  createPluginMetadataAPI(pluginId: string): MetadataAPI {
    return {
      getPluginInfo: (): PluginManifest => {
        const result = this.getPluginInfo(pluginId);
        if (result.success === true) {
          return result.data;
        }
        throw new Error(result.error);
      },

      getCurrentConnection: (): ConnectionInfo | null => {
        return this.getCurrentConnection();
      },

      getAppInfo: (): AppInfo => {
        return this.getAppInfo();
      },
    };
  }

  // ============ Utility Methods ============

  /**
   * Get all registered plugin IDs.
   *
   * @returns Array of registered plugin IDs
   */
  getRegisteredPluginIds(): string[] {
    return Array.from(this.pluginManifests.keys());
  }

  /**
   * Get all registered plugin manifests.
   *
   * @returns Array of registered plugin manifests
   */
  getAllPluginManifests(): PluginManifest[] {
    return Array.from(this.pluginManifests.values()).map((m) => ({ ...m }));
  }

  /**
   * Clear all registered plugins and reset state.
   * Use with caution - mainly for testing purposes.
   */
  clear(): void {
    this.pluginManifests.clear();
    this.currentConnection = null;
    this.appInfoCache = null;
  }

  /**
   * Get statistics about the metadata service.
   */
  getStats(): {
    registeredPlugins: number;
    hasActiveConnection: boolean;
    connectionId: string | null;
  } {
    return {
      registeredPlugins: this.pluginManifests.size,
      hasActiveConnection: this.currentConnection !== null,
      connectionId: this.currentConnection?.id ?? null,
    };
  }
}

// Export singleton instance following the service pattern
export const metadataService = new MetadataService();

// Export class for testing purposes
export { MetadataService };

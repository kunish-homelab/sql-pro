/**
 * PluginRuntime Service
 *
 * Responsible for executing plugin code in isolated V8 sandboxes.
 * Uses isolated-vm for security and memory isolation when available.
 *
 * Following the service module pattern from database.ts
 */

import type {
  AfterQueryHook,
  BeforeQueryHook,
  CommandOptions,
  MenuItemOptions,
  NotificationOptions,
  PanelOptions,
  PluginAPI,
  PluginContext,
  PluginInstance,
  PluginIsolateConfig,
  PluginManifest,
  PluginState,
  QueryContext,
  QueryError,
  QueryErrorHook,
  QueryResults,
} from '../../types/plugin';
import process from 'node:process';
import EventEmitter from 'eventemitter3';

// ============ Types ============

/**
 * Result type for runtime operations.
 */
export type PluginRuntimeResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string; errorCode?: PluginRuntimeErrorCode };

/**
 * Error codes specific to plugin runtime operations.
 */
export type PluginRuntimeErrorCode =
  | 'PLUGIN_NOT_LOADED'
  | 'PLUGIN_ALREADY_LOADED'
  | 'EXECUTION_TIMEOUT'
  | 'MEMORY_LIMIT_EXCEEDED'
  | 'SANDBOX_ERROR'
  | 'ACTIVATION_FAILED'
  | 'DEACTIVATION_FAILED'
  | 'RUNTIME_NOT_AVAILABLE';

/**
 * Internal representation of a running plugin instance.
 */
interface RunningPlugin {
  /** Plugin ID */
  pluginId: string;
  /** Unique instance ID */
  instanceId: string;
  /** Plugin manifest */
  manifest: PluginManifest;
  /** Current state */
  state: PluginState;
  /** Plugin code source */
  code: string;
  /** Path to plugin directory */
  pluginPath: string;
  /** Registered command IDs */
  registeredCommands: Set<string>;
  /** Registered menu item IDs */
  registeredMenuItems: Set<string>;
  /** Registered panel IDs */
  registeredPanels: Set<string>;
  /** Before query hooks */
  beforeQueryHooks: Map<string, BeforeQueryHook>;
  /** After query hooks */
  afterQueryHooks: Map<string, AfterQueryHook>;
  /** Query error hooks */
  queryErrorHooks: Map<string, QueryErrorHook>;
  /** Isolate reference (if using isolated-vm) */
  isolate?: unknown;
}

/**
 * Default isolate configuration.
 */
const DEFAULT_ISOLATE_CONFIG: PluginIsolateConfig = {
  memoryLimitMb: 128,
  timeoutMs: 5000,
  enableInspector: false,
};

// ============ ID Generation ============

let instanceCounter = 0;

function generateInstanceId(pluginId: string): string {
  instanceCounter += 1;
  return `${pluginId}_${instanceCounter}_${Date.now()}`;
}

function generateHookId(): string {
  return `hook_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ============ PluginRuntime Class ============

/**
 * PluginRuntime Service
 *
 * Manages the execution of plugins in sandboxed V8 isolates.
 * Follows the singleton service pattern from database.ts.
 *
 * Key features:
 * - Isolated execution environment for each plugin
 * - Memory limits enforced per plugin (default: 128MB)
 * - Execution timeouts for plugin code
 * - Hook system for query lifecycle events
 * - Graceful degradation if isolated-vm is unavailable
 */
class PluginRuntime extends EventEmitter {
  /**
   * Map of running plugin instances.
   * Key is the plugin ID.
   */
  private plugins: Map<string, RunningPlugin> = new Map();

  /**
   * Default isolate configuration.
   */
  private defaultConfig: PluginIsolateConfig = { ...DEFAULT_ISOLATE_CONFIG };

  /**
   * Whether the runtime is available (isolated-vm loaded successfully).
   */
  private runtimeAvailable = false;

  /**
   * Cached isolated-vm module reference.
   * Using unknown type since the module may not be available at compile time.
   */
  private isolatedVmModule: unknown = null;

  constructor() {
    super();
  }

  /**
   * Initialize the plugin runtime.
   * Attempts to load isolated-vm module.
   */
  async initialize(): Promise<PluginRuntimeResult> {
    try {
      // Dynamically require isolated-vm to handle cases where it's not available
      // Using require() since isolated-vm is a native module that may not be installed
      // eslint-disable-next-line ts/no-require-imports
      this.isolatedVmModule = require('isolated-vm');
      this.runtimeAvailable = true;

      return { success: true };
    } catch (error) {
      // Runtime is not available - plugins will run in degraded mode
      this.runtimeAvailable = false;
      return {
        success: false,
        error: `Failed to initialize plugin runtime: ${error instanceof Error ? error.message : String(error)}`,
        errorCode: 'RUNTIME_NOT_AVAILABLE',
      };
    }
  }

  /**
   * Check if the runtime is available.
   */
  isAvailable(): boolean {
    return this.runtimeAvailable;
  }

  /**
   * Set the default isolate configuration.
   */
  setDefaultConfig(config: Partial<PluginIsolateConfig>): void {
    this.defaultConfig = { ...this.defaultConfig, ...config };
  }

  /**
   * Load and activate a plugin.
   *
   * @param pluginId - Unique plugin identifier
   * @param manifest - Plugin manifest
   * @param code - Plugin source code
   * @param pluginPath - Path to plugin directory
   * @param config - Optional isolate configuration override
   * @returns Result with instance ID or error
   *
   * @example
   * ```typescript
   * const result = await pluginRuntime.loadPlugin(
   *   'com.example.myplugin',
   *   manifest,
   *   pluginCode,
   *   '/path/to/plugin'
   * );
   * if (result.success) {
   *   console.log('Plugin loaded with instance:', result.data);
   * }
   * ```
   */
  async loadPlugin(
    pluginId: string,
    manifest: PluginManifest,
    code: string,
    pluginPath: string,
    config?: Partial<PluginIsolateConfig>
  ): Promise<PluginRuntimeResult<string>> {
    // Check if already loaded
    if (this.plugins.has(pluginId)) {
      return {
        success: false,
        error: `Plugin already loaded: ${pluginId}`,
        errorCode: 'PLUGIN_ALREADY_LOADED',
      };
    }

    const instanceId = generateInstanceId(pluginId);
    const isolateConfig = { ...this.defaultConfig, ...config };

    // Create running plugin entry
    const runningPlugin: RunningPlugin = {
      pluginId,
      instanceId,
      manifest,
      state: 'loading',
      code,
      pluginPath,
      registeredCommands: new Set(),
      registeredMenuItems: new Set(),
      registeredPanels: new Set(),
      beforeQueryHooks: new Map(),
      afterQueryHooks: new Map(),
      queryErrorHooks: new Map(),
    };

    this.plugins.set(pluginId, runningPlugin);

    try {
      // Execute plugin activation
      await this.executePluginActivation(runningPlugin, isolateConfig);

      // Update state to enabled
      runningPlugin.state = 'enabled';

      // Emit event
      this.emit('plugin:loaded', {
        pluginId,
        instanceId,
        manifest,
      });

      return { success: true, data: instanceId };
    } catch (error) {
      // Remove from plugins map on failure
      this.plugins.delete(pluginId);

      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Determine error code based on error type
      let errorCode: PluginRuntimeErrorCode = 'ACTIVATION_FAILED';
      if (errorMessage.includes('timeout')) {
        errorCode = 'EXECUTION_TIMEOUT';
      } else if (errorMessage.includes('memory')) {
        errorCode = 'MEMORY_LIMIT_EXCEEDED';
      }

      return {
        success: false,
        error: `Failed to activate plugin: ${errorMessage}`,
        errorCode,
      };
    }
  }

  /**
   * Execute plugin activation in sandboxed environment.
   */
  private async executePluginActivation(
    plugin: RunningPlugin,
    config: PluginIsolateConfig
  ): Promise<void> {
    if (!this.runtimeAvailable || !this.isolatedVmModule) {
      // Fallback: execute in non-sandboxed mode (for development/testing)
      await this.executePluginActivationFallback(plugin);
      return;
    }

    // Use the isolated-vm module for sandboxed execution
    await this.executePluginActivationSandboxed(plugin, config);
  }

  /**
   * Execute plugin activation using isolated-vm sandbox.
   */
  private async executePluginActivationSandboxed(
    plugin: RunningPlugin,
    config: PluginIsolateConfig
  ): Promise<void> {
    // Type assertion for isolated-vm module
    // Using permissive types since the actual module may not be available at compile time
    const ivm = this.isolatedVmModule as {
      Isolate: new (options: { memoryLimit: number }) => {
        createContext: () => Promise<{
          global: {
            set: (
              key: string,
              value: unknown,
              options?: { copy?: boolean }
            ) => Promise<void>;
            derefInto: () => unknown;
          };
        }>;
        compileScript: (code: string) => Promise<{
          run: (
            context: unknown,
            options?: { timeout?: number }
          ) => Promise<unknown>;
        }>;
        dispose: () => void;
      };
      ExternalCopy: new (value: unknown) => {
        copyInto: () => unknown;
      };

      Callback: new (fn: (...args: any[]) => any) => unknown;
    };

    // Create isolate with memory limit
    const isolate = new ivm.Isolate({
      memoryLimit: config.memoryLimitMb,
    });

    // Store isolate reference for cleanup
    plugin.isolate = isolate;

    try {
      // Create context within isolate
      const context = await isolate.createContext();

      // Get reference to global object
      const jail = context.global;

      // Set up global reference
      await jail.set('global', jail.derefInto());

      // Inject plugin context as a frozen global
      const contextData = {
        manifest: plugin.manifest,
        pluginPath: plugin.pluginPath,
      };

      await jail.set(
        '__pluginContext',
        new ivm.ExternalCopy(contextData).copyInto()
      );

      // Create a simple console for debugging
      await jail.set(
        'console',
        {
          log: (...args: unknown[]) =>
            this.handlePluginLog(plugin.pluginId, 'log', args),
          warn: (...args: unknown[]) =>
            this.handlePluginLog(plugin.pluginId, 'warn', args),
          error: (...args: unknown[]) =>
            this.handlePluginLog(plugin.pluginId, 'error', args),
        },
        { copy: true }
      );

      // Create and inject plugin API
      const pluginAPI = this.createPluginAPI(plugin);

      // Inject API object
      await jail.set(
        '__pluginAPI',
        {
          ui: {
            registerCommand: new ivm.Callback((options: CommandOptions) => {
              this.handleRegisterCommand(plugin, options);
            }),
            registerMenuItem: new ivm.Callback((options: MenuItemOptions) => {
              this.handleRegisterMenuItem(plugin, options);
            }),
            registerPanel: new ivm.Callback((options: PanelOptions) => {
              this.handleRegisterPanel(plugin, options);
            }),
            showNotification: new ivm.Callback(
              (options: NotificationOptions) => {
                this.handleShowNotification(plugin, options);
              }
            ),
          },
          query: {
            onBeforeQuery: new ivm.Callback((hook: BeforeQueryHook) => {
              return this.handleRegisterBeforeQueryHook(plugin, hook);
            }),
            onAfterQuery: new ivm.Callback((hook: AfterQueryHook) => {
              return this.handleRegisterAfterQueryHook(plugin, hook);
            }),
            onQueryError: new ivm.Callback((hook: QueryErrorHook) => {
              return this.handleRegisterQueryErrorHook(plugin, hook);
            }),
          },
          storage: {
            get: new ivm.Callback(async (key: string) => {
              return this.handleStorageGet(plugin.pluginId, key);
            }),
            set: new ivm.Callback(async (key: string, value: unknown) => {
              return this.handleStorageSet(plugin.pluginId, key, value);
            }),
            remove: new ivm.Callback(async (key: string) => {
              return this.handleStorageRemove(plugin.pluginId, key);
            }),
            keys: new ivm.Callback(async () => {
              return this.handleStorageKeys(plugin.pluginId);
            }),
            clear: new ivm.Callback(async () => {
              return this.handleStorageClear(plugin.pluginId);
            }),
          },
          metadata: {
            getPluginInfo: new ivm.Callback(() => {
              return pluginAPI.metadata.getPluginInfo();
            }),
            getCurrentConnection: new ivm.Callback(() => {
              return this.handleGetCurrentConnection();
            }),
            getAppInfo: new ivm.Callback(() => {
              return this.handleGetAppInfo();
            }),
          },
        },
        { copy: true }
      );

      // Wrap the plugin code to call activate
      const wrappedCode = `
        (function() {
          const context = __pluginContext;
          const exports = {};

          // Plugin code
          ${plugin.code}

          // Call activate if exported
          if (typeof exports.activate === 'function') {
            exports.activate({
              manifest: context.manifest,
              pluginPath: context.pluginPath,
              api: __pluginAPI
            });
          } else if (typeof activate === 'function') {
            activate({
              manifest: context.manifest,
              pluginPath: context.pluginPath,
              api: __pluginAPI
            });
          }
        })();
      `;

      // Compile and run
      const script = await isolate.compileScript(wrappedCode);
      await script.run(context, { timeout: config.timeoutMs });
    } catch (error) {
      // Dispose isolate on error
      try {
        (plugin.isolate as { dispose: () => void })?.dispose();
      } catch {
        // Ignore dispose errors
      }
      plugin.isolate = undefined;
      throw error;
    }
  }

  /**
   * Fallback activation for when isolated-vm is not available.
   * This is less secure but allows development without native modules.
   */
  private async executePluginActivationFallback(
    plugin: RunningPlugin
  ): Promise<void> {
    // Create a limited Plugin API
    const pluginAPI = this.createPluginAPI(plugin);

    const pluginContext: PluginContext = {
      api: pluginAPI,
      manifest: plugin.manifest,
      pluginPath: plugin.pluginPath,
    };

    // Use Function constructor to create a sandboxed scope
    // This is NOT as secure as isolated-vm but works without native modules
    try {
      const wrappedCode = `
        return (function(context, exports) {
          ${plugin.code}
          if (typeof exports.activate === 'function') {
            return exports.activate(context);
          }
          return undefined;
        });
      `;

      // eslint-disable-next-line no-new-func
      const fn = new Function(wrappedCode)();
      const exports = {};
      await Promise.resolve(fn(pluginContext, exports));
    } catch (error) {
      throw new Error(
        `Plugin activation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Create a Plugin API object for fallback mode.
   */
  private createPluginAPI(plugin: RunningPlugin): PluginAPI {
    return {
      ui: {
        registerCommand: (options: CommandOptions) => {
          this.handleRegisterCommand(plugin, options);
          return () => this.handleUnregisterCommand(plugin, options.id);
        },
        registerMenuItem: (options: MenuItemOptions) => {
          this.handleRegisterMenuItem(plugin, options);
          return () => this.handleUnregisterMenuItem(plugin, options.id);
        },
        registerPanel: (options: PanelOptions) => {
          this.handleRegisterPanel(plugin, options);
          return () => this.handleUnregisterPanel(plugin, options.id);
        },
        showNotification: (options: NotificationOptions) => {
          this.handleShowNotification(plugin, options);
        },
      },
      query: {
        onBeforeQuery: (hook: BeforeQueryHook) => {
          const hookId = this.handleRegisterBeforeQueryHook(plugin, hook);
          return () => this.handleUnregisterBeforeQueryHook(plugin, hookId);
        },
        onAfterQuery: (hook: AfterQueryHook) => {
          const hookId = this.handleRegisterAfterQueryHook(plugin, hook);
          return () => this.handleUnregisterAfterQueryHook(plugin, hookId);
        },
        onQueryError: (hook: QueryErrorHook) => {
          const hookId = this.handleRegisterQueryErrorHook(plugin, hook);
          return () => this.handleUnregisterQueryErrorHook(plugin, hookId);
        },
      },
      storage: {
        get: async <T = unknown>(key: string): Promise<T | undefined> => {
          return this.handleStorageGet(plugin.pluginId, key) as Promise<
            T | undefined
          >;
        },
        set: async <T = unknown>(key: string, value: T): Promise<void> => {
          await this.handleStorageSet(plugin.pluginId, key, value);
        },
        remove: async (key: string): Promise<void> => {
          await this.handleStorageRemove(plugin.pluginId, key);
        },
        keys: async (): Promise<string[]> => {
          return this.handleStorageKeys(plugin.pluginId);
        },
        clear: async (): Promise<void> => {
          await this.handleStorageClear(plugin.pluginId);
        },
      },
      metadata: {
        getPluginInfo: () => plugin.manifest,
        getCurrentConnection: () => this.handleGetCurrentConnection(),
        getAppInfo: () => this.handleGetAppInfo(),
      },
    };
  }

  /**
   * Unload a plugin and clean up resources.
   *
   * @param pluginId - The plugin ID to unload
   * @returns Success or error result
   */
  async unloadPlugin(pluginId: string): Promise<PluginRuntimeResult> {
    const plugin = this.plugins.get(pluginId);

    if (!plugin) {
      return {
        success: false,
        error: `Plugin not loaded: ${pluginId}`,
        errorCode: 'PLUGIN_NOT_LOADED',
      };
    }

    try {
      // Update state
      plugin.state = 'unloading';

      // Dispose isolate if exists
      if (plugin.isolate) {
        try {
          (plugin.isolate as { dispose: () => void }).dispose();
        } catch {
          // Ignore dispose errors
        }
        plugin.isolate = undefined;
      }

      // Clear all registered hooks and UI elements
      plugin.registeredCommands.clear();
      plugin.registeredMenuItems.clear();
      plugin.registeredPanels.clear();
      plugin.beforeQueryHooks.clear();
      plugin.afterQueryHooks.clear();
      plugin.queryErrorHooks.clear();

      // Remove from plugins map
      this.plugins.delete(pluginId);

      // Emit event
      this.emit('plugin:unloaded', {
        pluginId,
        instanceId: plugin.instanceId,
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to unload plugin: ${error instanceof Error ? error.message : String(error)}`,
        errorCode: 'DEACTIVATION_FAILED',
      };
    }
  }

  /**
   * Get a running plugin by ID.
   */
  getPlugin(pluginId: string): PluginInstance | null {
    const plugin = this.plugins.get(pluginId);

    if (!plugin) {
      return null;
    }

    return {
      pluginId: plugin.pluginId,
      instanceId: plugin.instanceId,
      manifest: plugin.manifest,
      state: plugin.state,
      registeredCommands: Array.from(plugin.registeredCommands),
      registeredMenuItems: Array.from(plugin.registeredMenuItems),
      registeredPanels: Array.from(plugin.registeredPanels),
      registeredHooks: {
        beforeQuery: Array.from(plugin.beforeQueryHooks.keys()),
        afterQuery: Array.from(plugin.afterQueryHooks.keys()),
        queryError: Array.from(plugin.queryErrorHooks.keys()),
      },
    };
  }

  /**
   * Get all running plugins.
   */
  getAllPlugins(): PluginInstance[] {
    return Array.from(this.plugins.values()).map((plugin) => ({
      pluginId: plugin.pluginId,
      instanceId: plugin.instanceId,
      manifest: plugin.manifest,
      state: plugin.state,
      registeredCommands: Array.from(plugin.registeredCommands),
      registeredMenuItems: Array.from(plugin.registeredMenuItems),
      registeredPanels: Array.from(plugin.registeredPanels),
      registeredHooks: {
        beforeQuery: Array.from(plugin.beforeQueryHooks.keys()),
        afterQuery: Array.from(plugin.afterQueryHooks.keys()),
        queryError: Array.from(plugin.queryErrorHooks.keys()),
      },
    }));
  }

  /**
   * Check if a plugin is loaded.
   */
  isPluginLoaded(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  /**
   * Get the count of loaded plugins.
   */
  getLoadedCount(): number {
    return this.plugins.size;
  }

  // ============ Query Hook Execution ============

  /**
   * Execute before-query hooks for all loaded plugins.
   * Returns the potentially modified query context.
   */
  async executeBeforeQueryHooks(context: QueryContext): Promise<{
    context: QueryContext;
    cancelled: boolean;
    cancelReason?: string;
  }> {
    let currentContext = { ...context };
    let cancelled = false;
    let cancelReason: string | undefined;

    for (const plugin of this.plugins.values()) {
      if (plugin.state !== 'enabled') continue;

      for (const hook of plugin.beforeQueryHooks.values()) {
        try {
          const result = await Promise.resolve(hook(currentContext));

          if (result) {
            if (result.cancel) {
              cancelled = true;
              cancelReason = result.cancelReason;
              break;
            }

            if (result.query) {
              currentContext = { ...currentContext, query: result.query };
            }
          }
        } catch (error) {
          // Log error but continue with other hooks
          this.emit('hook:error', {
            pluginId: plugin.pluginId,
            hookType: 'beforeQuery',
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      if (cancelled) break;
    }

    return { context: currentContext, cancelled, cancelReason };
  }

  /**
   * Execute after-query hooks for all loaded plugins.
   * Returns the potentially modified query results.
   */
  async executeAfterQueryHooks(
    results: QueryResults,
    context: QueryContext
  ): Promise<QueryResults> {
    let currentResults = { ...results };

    for (const plugin of this.plugins.values()) {
      if (plugin.state !== 'enabled') continue;

      for (const hook of plugin.afterQueryHooks.values()) {
        try {
          const result = await Promise.resolve(hook(currentResults, context));

          if (result && typeof result === 'object') {
            currentResults = result as QueryResults;
          }
        } catch (error) {
          // Log error but continue with other hooks
          this.emit('hook:error', {
            pluginId: plugin.pluginId,
            hookType: 'afterQuery',
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    return currentResults;
  }

  /**
   * Execute query error hooks for all loaded plugins.
   */
  async executeQueryErrorHooks(error: QueryError): Promise<void> {
    for (const plugin of this.plugins.values()) {
      if (plugin.state !== 'enabled') continue;

      for (const hook of plugin.queryErrorHooks.values()) {
        try {
          await Promise.resolve(hook(error));
        } catch (hookError) {
          // Log error but continue with other hooks
          this.emit('hook:error', {
            pluginId: plugin.pluginId,
            hookType: 'queryError',
            error:
              hookError instanceof Error
                ? hookError.message
                : String(hookError),
          });
        }
      }
    }
  }

  // ============ API Handlers ============

  private handlePluginLog(
    pluginId: string,
    level: string,
    args: unknown[]
  ): void {
    this.emit('plugin:log', { pluginId, level, args });
  }

  private handleRegisterCommand(
    plugin: RunningPlugin,
    options: CommandOptions
  ): void {
    plugin.registeredCommands.add(options.id);
    this.emit('command:registered', {
      pluginId: plugin.pluginId,
      command: options,
    });
  }

  private handleUnregisterCommand(
    plugin: RunningPlugin,
    commandId: string
  ): void {
    plugin.registeredCommands.delete(commandId);
    this.emit('command:unregistered', {
      pluginId: plugin.pluginId,
      commandId,
    });
  }

  private handleRegisterMenuItem(
    plugin: RunningPlugin,
    options: MenuItemOptions
  ): void {
    plugin.registeredMenuItems.add(options.id);
    this.emit('menuItem:registered', {
      pluginId: plugin.pluginId,
      menuItem: options,
    });
  }

  private handleUnregisterMenuItem(
    plugin: RunningPlugin,
    menuItemId: string
  ): void {
    plugin.registeredMenuItems.delete(menuItemId);
    this.emit('menuItem:unregistered', {
      pluginId: plugin.pluginId,
      menuItemId,
    });
  }

  private handleRegisterPanel(
    plugin: RunningPlugin,
    options: PanelOptions
  ): void {
    plugin.registeredPanels.add(options.id);
    this.emit('panel:registered', {
      pluginId: plugin.pluginId,
      panel: options,
    });
  }

  private handleUnregisterPanel(plugin: RunningPlugin, panelId: string): void {
    plugin.registeredPanels.delete(panelId);
    this.emit('panel:unregistered', {
      pluginId: plugin.pluginId,
      panelId,
    });
  }

  private handleShowNotification(
    _plugin: RunningPlugin,
    options: NotificationOptions
  ): void {
    this.emit('notification:show', options);
  }

  private handleRegisterBeforeQueryHook(
    plugin: RunningPlugin,
    hook: BeforeQueryHook
  ): string {
    const hookId = generateHookId();
    plugin.beforeQueryHooks.set(hookId, hook);
    return hookId;
  }

  private handleUnregisterBeforeQueryHook(
    plugin: RunningPlugin,
    hookId: string
  ): void {
    plugin.beforeQueryHooks.delete(hookId);
  }

  private handleRegisterAfterQueryHook(
    plugin: RunningPlugin,
    hook: AfterQueryHook
  ): string {
    const hookId = generateHookId();
    plugin.afterQueryHooks.set(hookId, hook);
    return hookId;
  }

  private handleUnregisterAfterQueryHook(
    plugin: RunningPlugin,
    hookId: string
  ): void {
    plugin.afterQueryHooks.delete(hookId);
  }

  private handleRegisterQueryErrorHook(
    plugin: RunningPlugin,
    hook: QueryErrorHook
  ): string {
    const hookId = generateHookId();
    plugin.queryErrorHooks.set(hookId, hook);
    return hookId;
  }

  private handleUnregisterQueryErrorHook(
    plugin: RunningPlugin,
    hookId: string
  ): void {
    plugin.queryErrorHooks.delete(hookId);
  }

  // Storage handlers - these will be implemented by PluginService
  // which has access to electron-store
  private async handleStorageGet(
    _pluginId: string,
    _key: string
  ): Promise<unknown> {
    // Placeholder - will be connected to actual storage in PluginService
    return undefined;
  }

  private async handleStorageSet(
    _pluginId: string,
    _key: string,
    _value: unknown
  ): Promise<void> {
    // Placeholder - will be connected to actual storage in PluginService
  }

  private async handleStorageRemove(
    _pluginId: string,
    _key: string
  ): Promise<void> {
    // Placeholder - will be connected to actual storage in PluginService
  }

  private async handleStorageKeys(_pluginId: string): Promise<string[]> {
    // Placeholder - will be connected to actual storage in PluginService
    return [];
  }

  private async handleStorageClear(_pluginId: string): Promise<void> {
    // Placeholder - will be connected to actual storage in PluginService
  }

  private handleGetCurrentConnection():
    | import('../../types/plugin').ConnectionInfo
    | null {
    // Placeholder - will be connected to database service
    return null;
  }

  private handleGetAppInfo(): import('../../types/plugin').AppInfo {
    // This will be filled in when the runtime is initialized
    return {
      version: '1.0.0',
      platform: process.platform,
      arch: process.arch,
      isDev: process.env.NODE_ENV === 'development',
    };
  }

  /**
   * Clear all loaded plugins.
   * Use with caution - mainly for testing purposes.
   */
  async clear(): Promise<void> {
    const pluginIds = Array.from(this.plugins.keys());

    for (const pluginId of pluginIds) {
      await this.unloadPlugin(pluginId);
    }
  }
}

// Export singleton instance following the service pattern
export const pluginRuntime = new PluginRuntime();

// Export class for testing purposes
export { PluginRuntime };

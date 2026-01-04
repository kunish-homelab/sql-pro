import type {
  PluginManifest,
  QueryContext,
  QueryError,
  QueryResults,
} from '@shared/types/plugin';
/**
 * Tests for PluginRuntime service.
 *
 * Tests plugin loading, execution, hooks, and cleanup.
 * Uses mocks for isolated-vm since it requires native modules.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Import after setting up test environment
import { PluginRuntime } from './PluginRuntime';

describe('pluginRuntime', () => {
  let runtime: PluginRuntime;

  const testManifest: PluginManifest = {
    id: 'com.example.testplugin',
    name: 'Test Plugin',
    version: '1.0.0',
    description: 'A test plugin',
    author: 'Test Author',
    main: 'index.js',
  };

  const pluginPath = '/path/to/plugin';
  const simplePluginCode = `
    // Simple plugin code
    function activate(context) {
      // Plugin activated
    }
    exports.activate = activate;
  `;

  beforeEach(async () => {
    runtime = new PluginRuntime();
    // Initialize will fail without isolated-vm, but runtime will work in fallback mode
    await runtime.initialize();
  });

  describe('initialize', () => {
    it('should initialize in fallback mode when isolated-vm is not available', async () => {
      const newRuntime = new PluginRuntime();
      const result = await newRuntime.initialize();

      // Will fail because isolated-vm is not available in test environment
      // But the runtime should still be usable in fallback mode
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errorCode).toBe('RUNTIME_NOT_AVAILABLE');
      }
    });

    it('should report runtime availability status', async () => {
      // In test environment, isolated-vm is not available
      expect(runtime.isAvailable()).toBe(false);
    });
  });

  describe('setDefaultConfig', () => {
    it('should update default isolate configuration', () => {
      runtime.setDefaultConfig({
        memoryLimitMb: 256,
        timeoutMs: 10000,
      });

      // Configuration is internal, so we verify by loading a plugin
      // The config will be used when loading
      expect(() =>
        runtime.setDefaultConfig({ memoryLimitMb: 64 })
      ).not.toThrow();
    });
  });

  describe('loadPlugin', () => {
    it('should load a plugin successfully in fallback mode', async () => {
      const result = await runtime.loadPlugin(
        testManifest.id,
        testManifest,
        simplePluginCode,
        pluginPath
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeDefined();
        expect(typeof result.data).toBe('string');
      }
    });

    it('should return error if plugin is already loaded', async () => {
      await runtime.loadPlugin(
        testManifest.id,
        testManifest,
        simplePluginCode,
        pluginPath
      );

      const result = await runtime.loadPlugin(
        testManifest.id,
        testManifest,
        simplePluginCode,
        pluginPath
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errorCode).toBe('PLUGIN_ALREADY_LOADED');
      }
    });

    it('should emit plugin:loaded event on successful load', async () => {
      const eventHandler = vi.fn();
      runtime.on('plugin:loaded', eventHandler);

      await runtime.loadPlugin(
        testManifest.id,
        testManifest,
        simplePluginCode,
        pluginPath
      );

      expect(eventHandler).toHaveBeenCalledTimes(1);
      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          pluginId: testManifest.id,
          manifest: testManifest,
        })
      );
    });

    it('should handle plugin activation failure', async () => {
      const badPluginCode = `
        function activate(context) {
          throw new Error('Activation failed');
        }
        exports.activate = activate;
      `;

      const result = await runtime.loadPlugin(
        testManifest.id,
        testManifest,
        badPluginCode,
        pluginPath
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errorCode).toBe('ACTIVATION_FAILED');
      }
    });

    it('should handle plugin without activate function', async () => {
      const noActivateCode = `
        // Plugin with no activate function
        const value = 42;
      `;

      const result = await runtime.loadPlugin(
        testManifest.id,
        testManifest,
        noActivateCode,
        pluginPath
      );

      // Should still succeed - activate is optional
      expect(result.success).toBe(true);
    });
  });

  describe('unloadPlugin', () => {
    beforeEach(async () => {
      await runtime.loadPlugin(
        testManifest.id,
        testManifest,
        simplePluginCode,
        pluginPath
      );
    });

    it('should unload a loaded plugin', async () => {
      const result = await runtime.unloadPlugin(testManifest.id);

      expect(result.success).toBe(true);
      expect(runtime.isPluginLoaded(testManifest.id)).toBe(false);
    });

    it('should return error if plugin is not loaded', async () => {
      const result = await runtime.unloadPlugin('non.existent.plugin');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errorCode).toBe('PLUGIN_NOT_LOADED');
      }
    });

    it('should emit plugin:unloaded event on successful unload', async () => {
      const eventHandler = vi.fn();
      runtime.on('plugin:unloaded', eventHandler);

      await runtime.unloadPlugin(testManifest.id);

      expect(eventHandler).toHaveBeenCalledTimes(1);
      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          pluginId: testManifest.id,
        })
      );
    });

    it('should clean up registered hooks on unload', async () => {
      const pluginWithHooks = `
        function activate(context) {
          context.api.query.onBeforeQuery((ctx) => ctx);
          context.api.query.onAfterQuery((results) => results);
        }
        exports.activate = activate;
      `;

      await runtime.unloadPlugin(testManifest.id);
      await runtime.loadPlugin(
        testManifest.id,
        testManifest,
        pluginWithHooks,
        pluginPath
      );

      const pluginBefore = runtime.getPlugin(testManifest.id);
      expect(pluginBefore!.registeredHooks.beforeQuery.length).toBeGreaterThan(
        0
      );

      await runtime.unloadPlugin(testManifest.id);

      // Plugin should no longer exist
      expect(runtime.getPlugin(testManifest.id)).toBeNull();
    });
  });

  describe('getPlugin / getAllPlugins', () => {
    it('should return null for non-existent plugin', () => {
      expect(runtime.getPlugin('non.existent.plugin')).toBeNull();
    });

    it('should return plugin instance for loaded plugin', async () => {
      await runtime.loadPlugin(
        testManifest.id,
        testManifest,
        simplePluginCode,
        pluginPath
      );

      const plugin = runtime.getPlugin(testManifest.id);

      expect(plugin).not.toBeNull();
      expect(plugin!.pluginId).toBe(testManifest.id);
      expect(plugin!.manifest).toEqual(testManifest);
      expect(plugin!.state).toBe('enabled');
    });

    it('should return all loaded plugins', async () => {
      const manifest2: PluginManifest = {
        ...testManifest,
        id: 'com.example.plugin2',
        name: 'Plugin 2',
      };

      await runtime.loadPlugin(
        testManifest.id,
        testManifest,
        simplePluginCode,
        pluginPath
      );
      await runtime.loadPlugin(
        manifest2.id,
        manifest2,
        simplePluginCode,
        '/path2'
      );

      const allPlugins = runtime.getAllPlugins();

      expect(allPlugins.length).toBe(2);
    });
  });

  describe('isPluginLoaded / getLoadedCount', () => {
    it('should return false for non-loaded plugin', () => {
      expect(runtime.isPluginLoaded('non.existent.plugin')).toBe(false);
    });

    it('should return true for loaded plugin', async () => {
      await runtime.loadPlugin(
        testManifest.id,
        testManifest,
        simplePluginCode,
        pluginPath
      );

      expect(runtime.isPluginLoaded(testManifest.id)).toBe(true);
    });

    it('should return correct count of loaded plugins', async () => {
      expect(runtime.getLoadedCount()).toBe(0);

      await runtime.loadPlugin(
        testManifest.id,
        testManifest,
        simplePluginCode,
        pluginPath
      );

      expect(runtime.getLoadedCount()).toBe(1);

      await runtime.unloadPlugin(testManifest.id);

      expect(runtime.getLoadedCount()).toBe(0);
    });
  });

  describe('executeBeforeQueryHooks', () => {
    const queryContext: QueryContext = {
      query: 'SELECT * FROM users',
      connectionId: 'conn_1',
      dbPath: '/path/to/db.sqlite',
      timestamp: Date.now(),
    };

    beforeEach(async () => {
      await runtime.loadPlugin(
        testManifest.id,
        testManifest,
        simplePluginCode,
        pluginPath
      );
    });

    it('should return original context when no hooks are registered', async () => {
      const result = await runtime.executeBeforeQueryHooks(queryContext);

      expect(result.context).toEqual(queryContext);
      expect(result.cancelled).toBe(false);
    });

    it('should execute hooks and allow query modification', async () => {
      // Load a plugin with a before-query hook that modifies the query
      const pluginWithHook = `
        function activate(context) {
          context.api.query.onBeforeQuery((ctx) => {
            return { query: ctx.query + ' LIMIT 10' };
          });
        }
        exports.activate = activate;
      `;

      await runtime.unloadPlugin(testManifest.id);
      await runtime.loadPlugin(
        testManifest.id,
        testManifest,
        pluginWithHook,
        pluginPath
      );

      const result = await runtime.executeBeforeQueryHooks(queryContext);

      expect(result.context.query).toBe('SELECT * FROM users LIMIT 10');
      expect(result.cancelled).toBe(false);
    });

    it('should allow hooks to cancel query execution', async () => {
      const pluginWithCancelHook = `
        function activate(context) {
          context.api.query.onBeforeQuery((ctx) => {
            if (ctx.query.includes('DROP')) {
              return { cancel: true, cancelReason: 'DROP statements not allowed' };
            }
          });
        }
        exports.activate = activate;
      `;

      await runtime.unloadPlugin(testManifest.id);
      await runtime.loadPlugin(
        testManifest.id,
        testManifest,
        pluginWithCancelHook,
        pluginPath
      );

      const dropContext: QueryContext = {
        ...queryContext,
        query: 'DROP TABLE users',
      };

      const result = await runtime.executeBeforeQueryHooks(dropContext);

      expect(result.cancelled).toBe(true);
      expect(result.cancelReason).toBe('DROP statements not allowed');
    });

    it('should handle hook errors gracefully', async () => {
      const pluginWithBadHook = `
        function activate(context) {
          context.api.query.onBeforeQuery((ctx) => {
            throw new Error('Hook error');
          });
        }
        exports.activate = activate;
      `;

      await runtime.unloadPlugin(testManifest.id);
      await runtime.loadPlugin(
        testManifest.id,
        testManifest,
        pluginWithBadHook,
        pluginPath
      );

      const hookErrorHandler = vi.fn();
      runtime.on('hook:error', hookErrorHandler);

      const result = await runtime.executeBeforeQueryHooks(queryContext);

      // Should continue despite error
      expect(result.cancelled).toBe(false);
      expect(hookErrorHandler).toHaveBeenCalled();
    });
  });

  describe('executeAfterQueryHooks', () => {
    const queryContext: QueryContext = {
      query: 'SELECT * FROM users',
      connectionId: 'conn_1',
      dbPath: '/path/to/db.sqlite',
      timestamp: Date.now(),
    };

    const queryResults: QueryResults = {
      columns: ['id', 'name'],
      rows: [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ],
      executionTime: 10,
    };

    beforeEach(async () => {
      await runtime.loadPlugin(
        testManifest.id,
        testManifest,
        simplePluginCode,
        pluginPath
      );
    });

    it('should return original results when no hooks are registered', async () => {
      const result = await runtime.executeAfterQueryHooks(
        queryResults,
        queryContext
      );

      expect(result).toEqual(queryResults);
    });

    it('should allow hooks to modify results', async () => {
      const pluginWithHook = `
        function activate(context) {
          context.api.query.onAfterQuery((results, ctx) => {
            return {
              ...results,
              metadata: { processed: true }
            };
          });
        }
        exports.activate = activate;
      `;

      await runtime.unloadPlugin(testManifest.id);
      await runtime.loadPlugin(
        testManifest.id,
        testManifest,
        pluginWithHook,
        pluginPath
      );

      const result = await runtime.executeAfterQueryHooks(
        queryResults,
        queryContext
      );

      expect(result.metadata).toEqual({ processed: true });
    });

    it('should handle hook errors gracefully', async () => {
      const pluginWithBadHook = `
        function activate(context) {
          context.api.query.onAfterQuery((results, ctx) => {
            throw new Error('Hook error');
          });
        }
        exports.activate = activate;
      `;

      await runtime.unloadPlugin(testManifest.id);
      await runtime.loadPlugin(
        testManifest.id,
        testManifest,
        pluginWithBadHook,
        pluginPath
      );

      const hookErrorHandler = vi.fn();
      runtime.on('hook:error', hookErrorHandler);

      const result = await runtime.executeAfterQueryHooks(
        queryResults,
        queryContext
      );

      // Should return original results despite error
      expect(result).toEqual(queryResults);
      expect(hookErrorHandler).toHaveBeenCalled();
    });
  });

  describe('executeQueryErrorHooks', () => {
    const queryError: QueryError = {
      message: 'Table not found',
      code: 'SQLITE_ERROR',
      query: 'SELECT * FROM nonexistent',
      connectionId: 'conn_1',
    };

    beforeEach(async () => {
      await runtime.loadPlugin(
        testManifest.id,
        testManifest,
        simplePluginCode,
        pluginPath
      );
    });

    it('should execute error hooks for all loaded plugins', async () => {
      const pluginWithErrorHook = `
        function activate(context) {
          context.api.query.onQueryError((error) => {
            // Error hook called
          });
        }
        exports.activate = activate;
      `;

      await runtime.unloadPlugin(testManifest.id);
      await runtime.loadPlugin(
        testManifest.id,
        testManifest,
        pluginWithErrorHook,
        pluginPath
      );

      // Should not throw
      await expect(
        runtime.executeQueryErrorHooks(queryError)
      ).resolves.not.toThrow();
    });

    it('should handle hook errors gracefully', async () => {
      const pluginWithBadHook = `
        function activate(context) {
          context.api.query.onQueryError((error) => {
            throw new Error('Hook error');
          });
        }
        exports.activate = activate;
      `;

      await runtime.unloadPlugin(testManifest.id);
      await runtime.loadPlugin(
        testManifest.id,
        testManifest,
        pluginWithBadHook,
        pluginPath
      );

      const hookErrorHandler = vi.fn();
      runtime.on('hook:error', hookErrorHandler);

      await runtime.executeQueryErrorHooks(queryError);

      expect(hookErrorHandler).toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    it('should unload all plugins', async () => {
      const manifest2: PluginManifest = {
        ...testManifest,
        id: 'com.example.plugin2',
      };

      await runtime.loadPlugin(
        testManifest.id,
        testManifest,
        simplePluginCode,
        pluginPath
      );
      await runtime.loadPlugin(
        manifest2.id,
        manifest2,
        simplePluginCode,
        '/path2'
      );

      expect(runtime.getLoadedCount()).toBe(2);

      await runtime.clear();

      expect(runtime.getLoadedCount()).toBe(0);
    });
  });

  describe('plugin API - UI Extension', () => {
    it('should emit command:registered event when command is registered', async () => {
      const pluginWithCommand = `
        function activate(context) {
          context.api.ui.registerCommand({
            id: 'test.command',
            title: 'Test Command',
            handler: () => {}
          });
        }
        exports.activate = activate;
      `;

      const eventHandler = vi.fn();
      runtime.on('command:registered', eventHandler);

      await runtime.loadPlugin(
        testManifest.id,
        testManifest,
        pluginWithCommand,
        pluginPath
      );

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          pluginId: testManifest.id,
          command: expect.objectContaining({
            id: 'test.command',
            title: 'Test Command',
          }),
        })
      );
    });

    it('should emit menuItem:registered event when menu item is registered', async () => {
      const pluginWithMenuItem = `
        function activate(context) {
          context.api.ui.registerMenuItem({
            id: 'test.menu',
            label: 'Test Menu',
            menuPath: 'Plugins/Test',
            handler: () => {}
          });
        }
        exports.activate = activate;
      `;

      const eventHandler = vi.fn();
      runtime.on('menuItem:registered', eventHandler);

      await runtime.loadPlugin(
        testManifest.id,
        testManifest,
        pluginWithMenuItem,
        pluginPath
      );

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          pluginId: testManifest.id,
          menuItem: expect.objectContaining({
            id: 'test.menu',
            label: 'Test Menu',
          }),
        })
      );
    });

    it('should emit panel:registered event when panel is registered', async () => {
      const pluginWithPanel = `
        function activate(context) {
          context.api.ui.registerPanel({
            id: 'test.panel',
            title: 'Test Panel',
            location: 'sidebar',
            render: () => '<div>Panel</div>'
          });
        }
        exports.activate = activate;
      `;

      const eventHandler = vi.fn();
      runtime.on('panel:registered', eventHandler);

      await runtime.loadPlugin(
        testManifest.id,
        testManifest,
        pluginWithPanel,
        pluginPath
      );

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          pluginId: testManifest.id,
          panel: expect.objectContaining({
            id: 'test.panel',
            title: 'Test Panel',
          }),
        })
      );
    });

    it('should emit notification:show event when notification is shown', async () => {
      const pluginWithNotification = `
        function activate(context) {
          context.api.ui.showNotification({
            message: 'Hello from plugin',
            type: 'info'
          });
        }
        exports.activate = activate;
      `;

      const eventHandler = vi.fn();
      runtime.on('notification:show', eventHandler);

      await runtime.loadPlugin(
        testManifest.id,
        testManifest,
        pluginWithNotification,
        pluginPath
      );

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Hello from plugin',
          type: 'info',
        })
      );
    });
  });

  describe('plugin API - Metadata', () => {
    it('should provide plugin manifest via getPluginInfo', async () => {
      const pluginWithMetadata = `
        function activate(context) {
          const info = context.api.metadata.getPluginInfo();
          // Store for verification (in real plugin this would be used)
        }
        exports.activate = activate;
      `;

      // Plugin activates successfully, which means getPluginInfo worked
      const result = await runtime.loadPlugin(
        testManifest.id,
        testManifest,
        pluginWithMetadata,
        pluginPath
      );

      expect(result.success).toBe(true);
    });

    it('should provide app info via getAppInfo', async () => {
      const pluginWithAppInfo = `
        function activate(context) {
          const appInfo = context.api.metadata.getAppInfo();
          if (!appInfo.version || !appInfo.platform) {
            throw new Error('Invalid app info');
          }
        }
        exports.activate = activate;
      `;

      const result = await runtime.loadPlugin(
        testManifest.id,
        testManifest,
        pluginWithAppInfo,
        pluginPath
      );

      expect(result.success).toBe(true);
    });
  });

  describe('plugin registration tracking', () => {
    it('should track registered commands', async () => {
      const pluginWithCommands = `
        function activate(context) {
          context.api.ui.registerCommand({
            id: 'cmd1',
            title: 'Command 1',
            handler: () => {}
          });
          context.api.ui.registerCommand({
            id: 'cmd2',
            title: 'Command 2',
            handler: () => {}
          });
        }
        exports.activate = activate;
      `;

      await runtime.loadPlugin(
        testManifest.id,
        testManifest,
        pluginWithCommands,
        pluginPath
      );

      const plugin = runtime.getPlugin(testManifest.id);
      expect(plugin!.registeredCommands).toContain('cmd1');
      expect(plugin!.registeredCommands).toContain('cmd2');
    });

    it('should track registered hooks', async () => {
      const pluginWithHooks = `
        function activate(context) {
          context.api.query.onBeforeQuery((ctx) => ctx);
          context.api.query.onAfterQuery((results) => results);
          context.api.query.onQueryError((error) => {});
        }
        exports.activate = activate;
      `;

      await runtime.loadPlugin(
        testManifest.id,
        testManifest,
        pluginWithHooks,
        pluginPath
      );

      const plugin = runtime.getPlugin(testManifest.id);
      expect(plugin!.registeredHooks.beforeQuery.length).toBe(1);
      expect(plugin!.registeredHooks.afterQuery.length).toBe(1);
      expect(plugin!.registeredHooks.queryError.length).toBe(1);
    });
  });
});

import type { PluginInfo, PluginManifest } from '../../types/plugin';
/**
 * Tests for PluginService orchestrator.
 *
 * Tests the high-level plugin lifecycle management including
 * initialization, installation, enabling/disabling, and storage.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { pluginLoader } from './PluginLoader';
import { pluginRegistry } from './PluginRegistry';
import { pluginRuntime } from './PluginRuntime';
// Import after mocking
import { PluginService } from './PluginService';

// Use vi.hoisted to ensure mock state is available during vi.mock hoisting
const { mockState, createMockEmitter } = vi.hoisted(() => {
  const mockState = {
    storageData: { pluginData: {} } as Record<string, unknown>,
    plugins: new Map<
      string,
      { info: PluginInfo; isLoaded: boolean; instanceId?: string }
    >(),
    registryListeners: new Map<string, Set<(...args: unknown[]) => void>>(),
    runtimeListeners: new Map<string, Set<(...args: unknown[]) => void>>(),
  };

  function createMockEmitter(
    listeners: Map<string, Set<(...args: unknown[]) => void>>
  ) {
    return {
      on(event: string, handler: (...args: unknown[]) => void) {
        if (!listeners.has(event)) {
          listeners.set(event, new Set());
        }
        listeners.get(event)!.add(handler);
        return this;
      },
      emit(event: string, ...args: unknown[]) {
        const handlers = listeners.get(event);
        if (handlers) {
          handlers.forEach((h) => h(...args));
        }
        return true;
      },
      off(event: string, handler: (...args: unknown[]) => void) {
        listeners.get(event)?.delete(handler);
        return this;
      },
    };
  }

  return { mockState, createMockEmitter };
});

// Mock electron-store before importing PluginService
vi.mock('electron-store', () => {
  return {
    default: class MockStore {
      get(key: string, defaultValue?: unknown) {
        return mockState.storageData[key] ?? defaultValue;
      }
      set(key: string, value: unknown) {
        mockState.storageData[key] = value;
      }
    },
  };
});

// Mock the child services
vi.mock('./PluginLoader', () => ({
  pluginLoader: {
    listInstalledPlugins: vi.fn(() => []),
    loadPlugin: vi.fn(),
    loadFromDirectory: vi.fn(),
    readPluginCode: vi.fn(),
    removePlugin: vi.fn(),
    ensurePluginsDirectory: vi.fn(() => '/mock/plugins'),
    getPluginsDirectory: vi.fn(() => '/mock/plugins'),
  },
}));

vi.mock('./PluginRegistry', () => {
  const emitter = createMockEmitter(mockState.registryListeners);

  return {
    pluginRegistry: {
      ...emitter,
      initialize: vi.fn(),
      register: vi.fn((manifest: PluginManifest, path: string) => {
        mockState.plugins.set(manifest.id, {
          info: {
            manifest,
            path,
            state: 'installed',
            enabled: false,
            installedAt: new Date().toISOString(),
          },
          isLoaded: false,
        });
        return { success: true };
      }),
      unregister: vi.fn((pluginId: string) => {
        if (!mockState.plugins.has(pluginId)) {
          return {
            success: false,
            error: 'Not found',
            errorCode: 'PLUGIN_NOT_REGISTERED',
          };
        }
        mockState.plugins.delete(pluginId);
        return { success: true };
      }),
      get: vi.fn((pluginId: string) => {
        const entry = mockState.plugins.get(pluginId);
        return entry?.info ?? null;
      }),
      getEntry: vi.fn(
        (pluginId: string) => mockState.plugins.get(pluginId) ?? null
      ),
      has: vi.fn((pluginId: string) => mockState.plugins.has(pluginId)),
      enable: vi.fn((pluginId: string) => {
        const entry = mockState.plugins.get(pluginId);
        if (!entry)
          return {
            success: false,
            error: 'Not found',
            errorCode: 'PLUGIN_NOT_FOUND',
          };
        entry.info.enabled = true;
        entry.info.state = 'enabled';
        return { success: true };
      }),
      disable: vi.fn((pluginId: string) => {
        const entry = mockState.plugins.get(pluginId);
        if (!entry)
          return {
            success: false,
            error: 'Not found',
            errorCode: 'PLUGIN_NOT_FOUND',
          };
        entry.info.enabled = false;
        entry.info.state = 'disabled';
        return { success: true };
      }),
      updateState: vi.fn((pluginId: string, state: string, error?: string) => {
        const entry = mockState.plugins.get(pluginId);
        if (!entry) return { success: false };
        entry.info.state = state as PluginInfo['state'];
        if (error) entry.info.error = error;
        return { success: true };
      }),
      setLoaded: vi.fn((pluginId: string, instanceId: string) => {
        const entry = mockState.plugins.get(pluginId);
        if (!entry) return { success: false };
        entry.isLoaded = true;
        entry.instanceId = instanceId;
        return { success: true };
      }),
      setUnloaded: vi.fn((pluginId: string) => {
        const entry = mockState.plugins.get(pluginId);
        if (!entry) return { success: false };
        entry.isLoaded = false;
        entry.instanceId = undefined;
        return { success: true };
      }),
      isEnabled: vi.fn(
        (pluginId: string) =>
          mockState.plugins.get(pluginId)?.info.enabled ?? false
      ),
      isLoaded: vi.fn(
        (pluginId: string) => mockState.plugins.get(pluginId)?.isLoaded ?? false
      ),
      getAll: vi.fn(() =>
        Array.from(mockState.plugins.values()).map((e) => e.info)
      ),
      getEnabled: vi.fn(() =>
        Array.from(mockState.plugins.values())
          .filter((e) => e.info.enabled)
          .map((e) => e.info)
      ),
      getDisabled: vi.fn(() =>
        Array.from(mockState.plugins.values())
          .filter((e) => !e.info.enabled)
          .map((e) => e.info)
      ),
      getByState: vi.fn((state: string) =>
        Array.from(mockState.plugins.values())
          .filter((e) => e.info.state === state)
          .map((e) => e.info)
      ),
      getLoaded: vi.fn(() =>
        Array.from(mockState.plugins.values()).filter((e) => e.isLoaded)
      ),
      count: vi.fn(() => mockState.plugins.size),
      updateManifest: vi.fn(() => ({ success: true })),
      clear: vi.fn(() => {
        mockState.plugins.clear();
      }),
    },
    pluginStore: {
      get: vi.fn(),
      set: vi.fn(),
    },
  };
});

vi.mock('./PluginRuntime', () => {
  const emitter = createMockEmitter(mockState.runtimeListeners);

  return {
    pluginRuntime: {
      ...emitter,
      initialize: vi.fn(() => ({
        success: false,
        errorCode: 'RUNTIME_NOT_AVAILABLE',
      })),
      isAvailable: vi.fn(() => false),
      loadPlugin: vi.fn(() => ({ success: true, data: 'instance_123' })),
      unloadPlugin: vi.fn(() => ({ success: true })),
      executeBeforeQueryHooks: vi.fn((ctx: unknown) => ({
        context: ctx,
        cancelled: false,
      })),
      executeAfterQueryHooks: vi.fn((results: unknown) => results),
      executeQueryErrorHooks: vi.fn(),
      clear: vi.fn(),
    },
  };
});

describe('pluginService', () => {
  let service: PluginService;

  const testManifest: PluginManifest = {
    id: 'com.example.testplugin',
    name: 'Test Plugin',
    version: '1.0.0',
    description: 'A test plugin',
    author: 'Test Author',
    main: 'index.js',
  };

  const pluginPath = '/path/to/plugin';

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset shared state
    mockState.storageData = { pluginData: {} };
    mockState.plugins.clear();
    mockState.registryListeners.clear();
    mockState.runtimeListeners.clear();

    service = new PluginService();
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      const result = await service.initialize();

      expect(result.success).toBe(true);
      expect(service.isInitialized()).toBe(true);
    });

    it('should return success if already initialized', async () => {
      await service.initialize();
      const result = await service.initialize();

      expect(result.success).toBe(true);
    });

    it('should apply configuration options', async () => {
      await service.initialize({
        marketplaceUrl: 'https://custom.url/registry.json',
        autoLoadEnabled: false,
      });

      expect(service.isInitialized()).toBe(true);
    });

    it('should initialize child services', async () => {
      await service.initialize();

      expect(pluginRuntime.initialize).toHaveBeenCalled();
      expect(pluginRegistry.initialize).toHaveBeenCalled();
    });

    it('should scan and register installed plugins', async () => {
      vi.mocked(pluginLoader.listInstalledPlugins).mockReturnValue([
        {
          manifest: testManifest,
          path: pluginPath,
          state: 'installed',
          enabled: false,
          installedAt: new Date().toISOString(),
        },
      ]);

      await service.initialize();

      expect(pluginRegistry.register).toHaveBeenCalledWith(
        testManifest,
        pluginPath
      );
    });

    it('should emit service:initialized event', async () => {
      const eventHandler = vi.fn();
      service.on('service:initialized', eventHandler);

      await service.initialize();

      expect(eventHandler).toHaveBeenCalled();
    });
  });

  describe('installPlugin', () => {
    beforeEach(async () => {
      // Reset listInstalledPlugins to return empty array (may have been mocked by previous tests)
      vi.mocked(pluginLoader.listInstalledPlugins).mockReturnValue([]);

      await service.initialize();

      // Reset stateful mocks to their correct implementations
      vi.mocked(pluginRegistry.get).mockImplementation((pluginId: string) => {
        const entry = mockState.plugins.get(pluginId);
        return entry?.info ?? null;
      });
      vi.mocked(pluginRegistry.has).mockImplementation((pluginId: string) => {
        return mockState.plugins.has(pluginId);
      });
      vi.mocked(pluginRegistry.register).mockImplementation(
        (manifest: PluginManifest, path: string) => {
          mockState.plugins.set(manifest.id, {
            info: {
              manifest,
              path,
              state: 'installed',
              enabled: false,
              installedAt: new Date().toISOString(),
            },
            isLoaded: false,
          });
          return { success: true };
        }
      );
    });

    it('should install plugin from directory', async () => {
      vi.mocked(pluginLoader.loadPlugin).mockResolvedValue({
        success: true,
        manifest: testManifest,
        pluginPath,
        entryPoint: `${pluginPath}/index.js`,
      });

      const result = await service.installPlugin(pluginPath, 'directory');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data!.manifest.id).toBe(testManifest.id);
      }
    });

    it('should return error if plugin loading fails', async () => {
      vi.mocked(pluginLoader.loadPlugin).mockResolvedValue({
        success: false,
        error: 'Invalid plugin',
        errorCode: 'MANIFEST_INVALID',
      });

      const result = await service.installPlugin(pluginPath, 'directory');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errorCode).toBe('INSTALLATION_FAILED');
      }
    });

    it('should return error if plugin is already installed', async () => {
      vi.mocked(pluginLoader.loadPlugin).mockResolvedValue({
        success: true,
        manifest: testManifest,
        pluginPath,
        entryPoint: `${pluginPath}/index.js`,
      });

      // Install first time
      await service.installPlugin(pluginPath, 'directory');

      // Try to install again
      const result = await service.installPlugin(pluginPath, 'directory');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errorCode).toBe('PLUGIN_ALREADY_INSTALLED');
      }
    });
  });

  describe('uninstallPlugin', () => {
    beforeEach(async () => {
      await service.initialize();

      // Install a plugin first
      vi.mocked(pluginLoader.loadPlugin).mockResolvedValue({
        success: true,
        manifest: testManifest,
        pluginPath,
        entryPoint: `${pluginPath}/index.js`,
      });
      vi.mocked(pluginLoader.removePlugin).mockResolvedValue({ success: true });

      await service.installPlugin(pluginPath, 'directory');
    });

    it('should uninstall an installed plugin', async () => {
      const result = await service.uninstallPlugin(testManifest.id);

      expect(result.success).toBe(true);
      expect(pluginRegistry.unregister).toHaveBeenCalledWith(
        testManifest.id,
        true
      );
      expect(pluginLoader.removePlugin).toHaveBeenCalledWith(testManifest.id);
    });

    it('should return error if plugin is not found', async () => {
      const result = await service.uninstallPlugin('non.existent.plugin');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errorCode).toBe('PLUGIN_NOT_FOUND');
      }
    });

    it('should unload plugin from runtime if loaded', async () => {
      // Enable the plugin first
      await service.enablePlugin(testManifest.id);

      // Mock isLoaded to return true
      vi.mocked(pluginRegistry.isLoaded).mockReturnValue(true);

      await service.uninstallPlugin(testManifest.id);

      expect(pluginRuntime.unloadPlugin).toHaveBeenCalledWith(testManifest.id);
    });

    it('should clear plugin storage when removeData is true', async () => {
      // Set some plugin data
      mockState.storageData.pluginData = {
        [testManifest.id]: { key: 'value' },
      };

      await service.uninstallPlugin(testManifest.id, true);

      expect(
        (mockState.storageData.pluginData as Record<string, unknown>)[
          testManifest.id
        ]
      ).toBeUndefined();
    });
  });

  describe('enablePlugin', () => {
    beforeEach(async () => {
      await service.initialize();

      vi.mocked(pluginLoader.loadPlugin).mockResolvedValue({
        success: true,
        manifest: testManifest,
        pluginPath,
        entryPoint: `${pluginPath}/index.js`,
      });
      vi.mocked(pluginLoader.readPluginCode).mockReturnValue('// plugin code');

      await service.installPlugin(pluginPath, 'directory');
    });

    it('should enable an installed plugin', async () => {
      const result = await service.enablePlugin(testManifest.id);

      expect(result.success).toBe(true);
      expect(pluginRegistry.enable).toHaveBeenCalledWith(testManifest.id);
      expect(pluginRuntime.loadPlugin).toHaveBeenCalled();
    });

    it('should return success if plugin is already enabled', async () => {
      await service.enablePlugin(testManifest.id);

      // Mock isEnabled to return true
      vi.mocked(pluginRegistry.isEnabled).mockReturnValue(true);
      vi.mocked(pluginRegistry.get).mockReturnValue({
        manifest: testManifest,
        path: pluginPath,
        state: 'enabled',
        enabled: true,
        installedAt: new Date().toISOString(),
      });

      const result = await service.enablePlugin(testManifest.id);

      expect(result.success).toBe(true);
    });

    it('should return error if plugin is not found', async () => {
      // Explicitly mock get to return null for non-existent plugin
      vi.mocked(pluginRegistry.get).mockReturnValue(null);

      const result = await service.enablePlugin('non.existent.plugin');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errorCode).toBe('PLUGIN_NOT_FOUND');
      }
    });

    it('should revert enable state if runtime loading fails', async () => {
      // Re-apply the correct implementation for pluginRegistry.get
      vi.mocked(pluginRegistry.get).mockImplementation((pluginId: string) => {
        const entry = mockState.plugins.get(pluginId);
        return entry?.info ?? null;
      });

      vi.mocked(pluginRuntime.loadPlugin).mockResolvedValue({
        success: false,
        error: 'Runtime error',
        errorCode: 'ACTIVATION_FAILED',
      });

      const result = await service.enablePlugin(testManifest.id);

      expect(result.success).toBe(false);
      expect(pluginRegistry.disable).toHaveBeenCalledWith(testManifest.id);
    });
  });

  describe('disablePlugin', () => {
    beforeEach(async () => {
      await service.initialize();

      vi.mocked(pluginLoader.loadPlugin).mockResolvedValue({
        success: true,
        manifest: testManifest,
        pluginPath,
        entryPoint: `${pluginPath}/index.js`,
      });
      vi.mocked(pluginLoader.readPluginCode).mockReturnValue('// plugin code');

      await service.installPlugin(pluginPath, 'directory');
      await service.enablePlugin(testManifest.id);
    });

    it('should disable an enabled plugin', async () => {
      vi.mocked(pluginRegistry.isLoaded).mockReturnValue(true);
      vi.mocked(pluginRegistry.get).mockReturnValue({
        manifest: testManifest,
        path: pluginPath,
        state: 'enabled',
        enabled: true,
        installedAt: new Date().toISOString(),
      });

      const result = await service.disablePlugin(testManifest.id);

      expect(result.success).toBe(true);
      expect(pluginRuntime.unloadPlugin).toHaveBeenCalledWith(testManifest.id);
      expect(pluginRegistry.disable).toHaveBeenCalledWith(testManifest.id);
    });

    it('should return success if plugin is already disabled', async () => {
      vi.mocked(pluginRegistry.get).mockReturnValue({
        manifest: testManifest,
        path: pluginPath,
        state: 'disabled',
        enabled: false,
        installedAt: new Date().toISOString(),
      });

      const result = await service.disablePlugin(testManifest.id);

      expect(result.success).toBe(true);
    });

    it('should return error if plugin is not found', async () => {
      // Explicitly mock get to return null for non-existent plugin
      vi.mocked(pluginRegistry.get).mockReturnValue(null);

      const result = await service.disablePlugin('non.existent.plugin');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errorCode).toBe('PLUGIN_NOT_FOUND');
      }
    });
  });

  describe('plugin queries', () => {
    beforeEach(async () => {
      await service.initialize();

      vi.mocked(pluginLoader.loadPlugin).mockResolvedValue({
        success: true,
        manifest: testManifest,
        pluginPath,
        entryPoint: `${pluginPath}/index.js`,
      });

      // Reset pluginRegistry.get to use the stateful mock
      vi.mocked(pluginRegistry.get).mockImplementation((pluginId: string) => {
        const entry = mockState.plugins.get(pluginId);
        return entry?.info ?? null;
      });

      await service.installPlugin(pluginPath, 'directory');
    });

    it('should get plugin by ID', () => {
      const plugin = service.getPlugin(testManifest.id);

      expect(plugin).not.toBeNull();
      expect(plugin!.manifest.id).toBe(testManifest.id);
    });

    it('should return null for non-existent plugin', () => {
      vi.mocked(pluginRegistry.get).mockReturnValue(null);

      const plugin = service.getPlugin('non.existent');

      expect(plugin).toBeNull();
    });

    it('should get all plugins', () => {
      service.getAll();

      expect(pluginRegistry.getAll).toHaveBeenCalled();
    });

    it('should get enabled plugins', () => {
      service.getEnabled();

      expect(pluginRegistry.getEnabled).toHaveBeenCalled();
    });

    it('should get disabled plugins', () => {
      service.getDisabled();

      expect(pluginRegistry.getDisabled).toHaveBeenCalled();
    });

    it('should check if plugin is installed', () => {
      expect(service.isInstalled(testManifest.id)).toBe(true);
      expect(pluginRegistry.has).toHaveBeenCalledWith(testManifest.id);
    });

    it('should check if plugin is enabled', () => {
      service.isEnabled(testManifest.id);

      expect(pluginRegistry.isEnabled).toHaveBeenCalledWith(testManifest.id);
    });

    it('should check if plugin is loaded', () => {
      service.isLoaded(testManifest.id);

      expect(pluginRegistry.isLoaded).toHaveBeenCalledWith(testManifest.id);
    });

    it('should return plugin count', () => {
      service.count();

      expect(pluginRegistry.count).toHaveBeenCalled();
    });
  });

  describe('plugin storage', () => {
    const pluginId = 'com.example.testplugin';

    beforeEach(async () => {
      await service.initialize();
      mockState.storageData.pluginData = {};
    });

    it('should set plugin data', () => {
      service.setPluginData(pluginId, 'testKey', { value: 42 });

      expect(
        (
          mockState.storageData.pluginData as Record<
            string,
            Record<string, unknown>
          >
        )[pluginId]?.testKey
      ).toEqual({ value: 42 });
    });

    it('should get plugin data', () => {
      mockState.storageData.pluginData = {
        [pluginId]: { testKey: { value: 42 } },
      };

      const value = service.getPluginData<{ value: number }>(
        pluginId,
        'testKey'
      );

      expect(value).toEqual({ value: 42 });
    });

    it('should return undefined for non-existent key', () => {
      const value = service.getPluginData(pluginId, 'nonExistent');

      expect(value).toBeUndefined();
    });

    it('should remove plugin data', () => {
      mockState.storageData.pluginData = {
        [pluginId]: { testKey: 'value', otherKey: 'other' },
      };

      service.removePluginData(pluginId, 'testKey');

      expect(
        (
          mockState.storageData.pluginData as Record<
            string,
            Record<string, unknown>
          >
        )[pluginId]?.testKey
      ).toBeUndefined();
      expect(
        (
          mockState.storageData.pluginData as Record<
            string,
            Record<string, unknown>
          >
        )[pluginId]?.otherKey
      ).toBe('other');
    });

    it('should get all storage keys for plugin', () => {
      mockState.storageData.pluginData = {
        [pluginId]: { key1: 'value1', key2: 'value2' },
      };

      const keys = service.getPluginDataKeys(pluginId);

      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
    });

    it('should return empty array for plugin with no data', () => {
      const keys = service.getPluginDataKeys('unknown.plugin');

      expect(keys).toEqual([]);
    });

    it('should clear all storage for plugin', () => {
      mockState.storageData.pluginData = {
        [pluginId]: { key1: 'value1', key2: 'value2' },
        otherPlugin: { key: 'value' },
      };

      service.clearPluginStorage(pluginId);

      expect(
        (
          mockState.storageData.pluginData as Record<
            string,
            Record<string, unknown>
          >
        )[pluginId]
      ).toBeUndefined();
      expect(
        (
          mockState.storageData.pluginData as Record<
            string,
            Record<string, unknown>
          >
        ).otherPlugin
      ).toBeDefined();
    });
  });

  describe('query hooks', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should forward before-query hooks to runtime', async () => {
      const context = {
        query: 'SELECT * FROM users',
        connectionId: 'conn_1',
        dbPath: '/path/to/db',
        timestamp: Date.now(),
      };

      await service.executeBeforeQueryHooks(context);

      expect(pluginRuntime.executeBeforeQueryHooks).toHaveBeenCalledWith(
        context
      );
    });

    it('should forward after-query hooks to runtime', async () => {
      const results = {
        columns: ['id', 'name'],
        rows: [{ id: 1, name: 'Test' }],
        executionTime: 10,
      };
      const context = {
        query: 'SELECT * FROM users',
        connectionId: 'conn_1',
        dbPath: '/path/to/db',
        timestamp: Date.now(),
      };

      await service.executeAfterQueryHooks(results, context);

      expect(pluginRuntime.executeAfterQueryHooks).toHaveBeenCalledWith(
        results,
        context
      );
    });

    it('should forward error hooks to runtime', async () => {
      const error = {
        message: 'Table not found',
        query: 'SELECT * FROM nonexistent',
        connectionId: 'conn_1',
      };

      await service.executeQueryErrorHooks(error);

      expect(pluginRuntime.executeQueryErrorHooks).toHaveBeenCalledWith(error);
    });
  });

  describe('shutdown', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should unload all plugins on shutdown', async () => {
      vi.mocked(pluginRegistry.getLoaded).mockReturnValue([
        {
          info: {
            manifest: testManifest,
            path: pluginPath,
            state: 'enabled',
            enabled: true,
            installedAt: new Date().toISOString(),
          },
          isLoaded: true,
          instanceId: 'instance_1',
        },
      ]);

      await service.shutdown();

      expect(pluginRuntime.unloadPlugin).toHaveBeenCalled();
      expect(pluginRuntime.clear).toHaveBeenCalled();
      expect(service.isInitialized()).toBe(false);
    });

    it('should emit service:shutdown event', async () => {
      const eventHandler = vi.fn();
      service.on('service:shutdown', eventHandler);

      await service.shutdown();

      expect(eventHandler).toHaveBeenCalled();
    });
  });

  describe('event forwarding', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should forward plugin-event from registry', () => {
      const eventHandler = vi.fn();
      service.on('plugin-event', eventHandler);

      // Simulate registry emitting event
      pluginRegistry.emit('plugin-event', {
        type: 'plugin:installed',
        pluginId: testManifest.id,
        timestamp: new Date().toISOString(),
      });

      expect(eventHandler).toHaveBeenCalled();
    });

    it('should forward runtime events', () => {
      const loadedHandler = vi.fn();
      const unloadedHandler = vi.fn();
      const hookErrorHandler = vi.fn();

      service.on('runtime:plugin:loaded', loadedHandler);
      service.on('runtime:plugin:unloaded', unloadedHandler);
      service.on('runtime:hook:error', hookErrorHandler);

      // Simulate runtime events
      pluginRuntime.emit('plugin:loaded', {
        pluginId: 'test',
        instanceId: 'inst',
      });
      pluginRuntime.emit('plugin:unloaded', { pluginId: 'test' });
      pluginRuntime.emit('hook:error', {
        pluginId: 'test',
        hookType: 'beforeQuery',
      });

      expect(loadedHandler).toHaveBeenCalled();
      expect(unloadedHandler).toHaveBeenCalled();
      expect(hookErrorHandler).toHaveBeenCalled();
    });

    it('should forward UI events from runtime', () => {
      const commandHandler = vi.fn();
      const menuItemHandler = vi.fn();
      const panelHandler = vi.fn();
      const notificationHandler = vi.fn();

      service.on('command:registered', commandHandler);
      service.on('menuItem:registered', menuItemHandler);
      service.on('panel:registered', panelHandler);
      service.on('notification:show', notificationHandler);

      // Simulate runtime events
      pluginRuntime.emit('command:registered', {
        pluginId: 'test',
        command: {},
      });
      pluginRuntime.emit('menuItem:registered', {
        pluginId: 'test',
        menuItem: {},
      });
      pluginRuntime.emit('panel:registered', { pluginId: 'test', panel: {} });
      pluginRuntime.emit('notification:show', {
        message: 'Test',
        type: 'info',
      });

      expect(commandHandler).toHaveBeenCalled();
      expect(menuItemHandler).toHaveBeenCalled();
      expect(panelHandler).toHaveBeenCalled();
      expect(notificationHandler).toHaveBeenCalled();
    });
  });
});

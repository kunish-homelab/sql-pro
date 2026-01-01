import type { PluginEvent, PluginInfo, PluginManifest } from '@/types/plugin';
/**
 * Plugin Lifecycle Integration Tests
 *
 * End-to-end tests for the complete plugin lifecycle:
 * 1. Install and enable a plugin
 * 2. Verify plugin menu items appear
 * 3. Disable plugin
 * 4. Verify plugin menu items removed
 * 5. Re-enable plugin
 * 6. Verify plugin works again
 * 7. Uninstall plugin
 * 8. Verify plugin removed from list and files deleted
 *
 * These tests verify integration between:
 * - PluginService (orchestrator)
 * - PluginRegistry (state management)
 * - PluginRuntime (execution)
 * - UIExtensionAPI (menu items, commands, panels)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ============ Import After Mocking ============

import { pluginLoader } from './PluginLoader';
import { pluginRegistry } from './PluginRegistry';
import { pluginRuntime } from './PluginRuntime';
import { PluginService } from './PluginService';

// ============ Shared Mock State ============

const { mockState, createMockEmitter } = vi.hoisted(() => {
  const mockState = {
    storageData: { pluginData: {} } as Record<string, unknown>,
    plugins: new Map<
      string,
      { info: PluginInfo; isLoaded: boolean; instanceId?: string }
    >(),
    registryListeners: new Map<string, Set<(...args: unknown[]) => void>>(),
    runtimeListeners: new Map<string, Set<(...args: unknown[]) => void>>(),
    uiListeners: new Map<string, Set<(...args: unknown[]) => void>>(),
    commands: new Map<string, unknown>(),
    menuItems: new Map<string, unknown>(),
    panels: new Map<string, unknown>(),
    pluginFiles: new Map<string, boolean>(),
    installedPlugins: [] as PluginInfo[],
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
      removeAllListeners() {
        listeners.clear();
        return this;
      },
    };
  }

  return { mockState, createMockEmitter };
});

// ============ Mocks ============

// Mock electron-store
vi.mock('electron-store', () => ({
  default: class MockStore {
    get(key: string, defaultValue?: unknown) {
      return mockState.storageData[key] ?? defaultValue;
    }
    set(key: string, value: unknown) {
      mockState.storageData[key] = value;
    }
  },
}));

// Mock PluginLoader
vi.mock('./PluginLoader', () => ({
  pluginLoader: {
    listInstalledPlugins: vi.fn(() => mockState.installedPlugins),
    loadPlugin: vi.fn(),
    loadFromDirectory: vi.fn(),
    readPluginCode: vi.fn(
      () => `
      module.exports = {
        activate: (context) => {
          context.ui.registerCommand({
            id: 'test-command',
            title: 'Test Command',
            handler: () => {}
          });
          context.ui.registerMenuItem({
            id: 'test-menu',
            label: 'Test Menu Item',
            menuPath: 'Plugins/Test',
            handler: () => {}
          });
        },
        deactivate: () => {}
      };
    `
    ),
    removePlugin: vi.fn((pluginId: string) => {
      mockState.pluginFiles.delete(pluginId);
      return { success: true };
    }),
    ensurePluginsDirectory: vi.fn(() => '/mock/plugins'),
    getPluginsDirectory: vi.fn(() => '/mock/plugins'),
  },
}));

// Mock PluginRegistry with full lifecycle event handling
vi.mock('./PluginRegistry', () => {
  const emitter = createMockEmitter(mockState.registryListeners);

  return {
    pluginRegistry: {
      ...emitter,
      initialize: vi.fn(),
      register: vi.fn((manifest: PluginManifest, path: string) => {
        const info: PluginInfo = {
          manifest,
          path,
          state: 'installed',
          enabled: false,
          installedAt: new Date().toISOString(),
        };
        mockState.plugins.set(manifest.id, {
          info,
          isLoaded: false,
        });
        mockState.pluginFiles.set(manifest.id, true);

        // Emit installed event
        emitter.emit('plugin:installed', {
          type: 'plugin:installed',
          pluginId: manifest.id,
          plugin: info,
          timestamp: new Date().toISOString(),
        });

        return { success: true };
      }),
      unregister: vi.fn((pluginId: string) => {
        const entry = mockState.plugins.get(pluginId);
        if (!entry) {
          return {
            success: false,
            error: 'Not found',
            errorCode: 'PLUGIN_NOT_REGISTERED',
          };
        }

        // Emit uninstalled event
        emitter.emit('plugin:uninstalled', {
          type: 'plugin:uninstalled',
          pluginId,
          timestamp: new Date().toISOString(),
        });

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

        // Emit enabled event
        emitter.emit('plugin:enabled', {
          type: 'plugin:enabled',
          pluginId,
          plugin: entry.info,
          timestamp: new Date().toISOString(),
        });
        emitter.emit('plugin-event', {
          type: 'plugin:enabled',
          pluginId,
          plugin: entry.info,
          timestamp: new Date().toISOString(),
        });

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

        // Emit disabled event
        emitter.emit('plugin:disabled', {
          type: 'plugin:disabled',
          pluginId,
          plugin: entry.info,
          timestamp: new Date().toISOString(),
        });
        emitter.emit('plugin-event', {
          type: 'plugin:disabled',
          pluginId,
          plugin: entry.info,
          timestamp: new Date().toISOString(),
        });

        return { success: true };
      }),
      updateState: vi.fn((pluginId: string, state: string, error?: string) => {
        const entry = mockState.plugins.get(pluginId);
        if (!entry) return { success: false };
        entry.info.state = state as PluginInfo['state'];
        if (error) entry.info.error = error;
        else delete entry.info.error;
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

// Mock PluginRuntime
vi.mock('./PluginRuntime', () => {
  const emitter = createMockEmitter(mockState.runtimeListeners);

  return {
    pluginRuntime: {
      ...emitter,
      initialize: vi.fn(() => ({ success: true })),
      isAvailable: vi.fn(() => true),
      loadPlugin: vi.fn((pluginId: string) => {
        // Simulate plugin registering UI extensions
        const commandId = `${pluginId}:test-command`;
        const menuItemId = `${pluginId}:test-menu`;

        mockState.commands.set(commandId, {
          pluginId,
          options: { id: commandId, title: 'Test Command' },
        });
        mockState.menuItems.set(menuItemId, {
          pluginId,
          options: {
            id: menuItemId,
            label: 'Test Menu Item',
            menuPath: 'Plugins/Test',
          },
        });

        emitter.emit('command:registered', { pluginId, commandId });
        emitter.emit('menuItem:registered', { pluginId, menuItemId });

        return { success: true, data: `instance_${pluginId}_${Date.now()}` };
      }),
      unloadPlugin: vi.fn((pluginId: string) => {
        // Remove UI extensions when plugin is unloaded
        for (const [id] of mockState.commands) {
          if (id.startsWith(`${pluginId}:`)) {
            mockState.commands.delete(id);
          }
        }
        for (const [id] of mockState.menuItems) {
          if (id.startsWith(`${pluginId}:`)) {
            mockState.menuItems.delete(id);
          }
        }
        for (const [id] of mockState.panels) {
          if (id.startsWith(`${pluginId}:`)) {
            mockState.panels.delete(id);
          }
        }

        emitter.emit('plugin:unloaded', { pluginId });
        return { success: true };
      }),
      executeBeforeQueryHooks: vi.fn((ctx: unknown) => ({
        context: ctx,
        cancelled: false,
      })),
      executeAfterQueryHooks: vi.fn((results: unknown) => results),
      executeQueryErrorHooks: vi.fn(),
      clear: vi.fn(() => {
        mockState.commands.clear();
        mockState.menuItems.clear();
        mockState.panels.clear();
      }),
    },
  };
});

// ============ Tests ============

describe('plugin Lifecycle Integration', () => {
  let service: PluginService;

  const testManifest: PluginManifest = {
    id: 'com.example.lifecycle-test',
    name: 'Lifecycle Test Plugin',
    version: '1.0.0',
    description: 'A plugin for testing lifecycle operations',
    author: 'Test Author',
    main: 'index.js',
    permissions: ['ui:command', 'ui:menu'],
  };

  const pluginPath = '/mock/plugins/com.example.lifecycle-test';

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset all shared state
    mockState.storageData = { pluginData: {} };
    mockState.plugins.clear();
    mockState.registryListeners.clear();
    mockState.runtimeListeners.clear();
    mockState.uiListeners.clear();
    mockState.commands.clear();
    mockState.menuItems.clear();
    mockState.panels.clear();
    mockState.pluginFiles.clear();
    mockState.installedPlugins = [];

    service = new PluginService();
  });

  afterEach(async () => {
    // Ensure clean shutdown
    if (service.isInitialized()) {
      await service.shutdown();
    }
  });

  describe('full Lifecycle: Install → Enable → Disable → Re-enable → Uninstall', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should complete full plugin lifecycle successfully', async () => {
      // ============ Step 1: Install the plugin ============

      vi.mocked(pluginLoader.loadPlugin).mockResolvedValue({
        success: true,
        manifest: testManifest,
        pluginPath,
        entryPoint: `${pluginPath}/index.js`,
      });

      const installResult = await service.installPlugin(
        pluginPath,
        'directory'
      );

      expect(installResult.success).toBe(true);
      expect(service.isInstalled(testManifest.id)).toBe(true);
      expect(service.count()).toBe(1);

      // Plugin should be installed but not enabled
      const installedPlugin = service.getPlugin(testManifest.id);
      expect(installedPlugin).not.toBeNull();
      expect(installedPlugin!.enabled).toBe(false);
      expect(installedPlugin!.state).toBe('installed');

      // No UI extensions should be registered yet
      expect(mockState.commands.size).toBe(0);
      expect(mockState.menuItems.size).toBe(0);

      // ============ Step 2: Enable the plugin ============

      const enableResult = await service.enablePlugin(testManifest.id);

      expect(enableResult.success).toBe(true);
      expect(service.isEnabled(testManifest.id)).toBe(true);
      expect(pluginRuntime.loadPlugin).toHaveBeenCalled();

      // Verify UI extensions are registered
      expect(mockState.commands.size).toBe(1);
      expect(mockState.menuItems.size).toBe(1);
      expect(mockState.commands.has(`${testManifest.id}:test-command`)).toBe(
        true
      );
      expect(mockState.menuItems.has(`${testManifest.id}:test-menu`)).toBe(
        true
      );

      // ============ Step 3: Disable the plugin ============

      // Update isLoaded mock to return true before disabling
      vi.mocked(pluginRegistry.isLoaded).mockReturnValue(true);

      const disableResult = await service.disablePlugin(testManifest.id);

      expect(disableResult.success).toBe(true);
      expect(service.isEnabled(testManifest.id)).toBe(false);
      expect(pluginRuntime.unloadPlugin).toHaveBeenCalledWith(testManifest.id);

      // Verify UI extensions are removed
      expect(mockState.commands.size).toBe(0);
      expect(mockState.menuItems.size).toBe(0);

      // Plugin should still be installed
      expect(service.isInstalled(testManifest.id)).toBe(true);

      // ============ Step 4: Re-enable the plugin ============

      // Reset isLoaded for re-enable
      vi.mocked(pluginRegistry.isLoaded).mockImplementation(
        (pluginId: string) => {
          return mockState.plugins.get(pluginId)?.isLoaded ?? false;
        }
      );

      const reEnableResult = await service.enablePlugin(testManifest.id);

      expect(reEnableResult.success).toBe(true);
      expect(service.isEnabled(testManifest.id)).toBe(true);

      // UI extensions should be registered again
      expect(mockState.commands.size).toBe(1);
      expect(mockState.menuItems.size).toBe(1);

      // ============ Step 5: Uninstall the plugin ============

      vi.mocked(pluginRegistry.isLoaded).mockReturnValue(true);

      const uninstallResult = await service.uninstallPlugin(
        testManifest.id,
        true
      );

      expect(uninstallResult.success).toBe(true);
      expect(service.isInstalled(testManifest.id)).toBe(false);
      expect(service.count()).toBe(0);

      // Plugin files should be removed
      expect(pluginLoader.removePlugin).toHaveBeenCalledWith(testManifest.id);

      // Plugin data should be cleared
      expect(
        (mockState.storageData.pluginData as Record<string, unknown>)[
          testManifest.id
        ]
      ).toBeUndefined();

      // UI extensions should be removed
      expect(mockState.commands.size).toBe(0);
      expect(mockState.menuItems.size).toBe(0);
    });
  });

  describe('install and Enable Plugin', () => {
    beforeEach(async () => {
      await service.initialize();
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
      expect(service.isInstalled(testManifest.id)).toBe(true);
      expect(pluginRegistry.register).toHaveBeenCalledWith(
        testManifest,
        pluginPath
      );
    });

    it('should enable installed plugin and load into runtime', async () => {
      vi.mocked(pluginLoader.loadPlugin).mockResolvedValue({
        success: true,
        manifest: testManifest,
        pluginPath,
        entryPoint: `${pluginPath}/index.js`,
      });

      await service.installPlugin(pluginPath, 'directory');
      const result = await service.enablePlugin(testManifest.id);

      expect(result.success).toBe(true);
      expect(pluginRegistry.enable).toHaveBeenCalledWith(testManifest.id);
      expect(pluginRuntime.loadPlugin).toHaveBeenCalled();
    });

    it('should emit plugin events during lifecycle', async () => {
      const events: PluginEvent[] = [];
      service.on('plugin-event', (event: PluginEvent) => {
        events.push(event);
      });

      vi.mocked(pluginLoader.loadPlugin).mockResolvedValue({
        success: true,
        manifest: testManifest,
        pluginPath,
        entryPoint: `${pluginPath}/index.js`,
      });

      await service.installPlugin(pluginPath, 'directory');
      await service.enablePlugin(testManifest.id);

      // Should have received events
      expect(
        events.some(
          (e) => e.type === 'plugin:installed' || e.type === 'plugin:enabled'
        )
      ).toBe(true);
    });
  });

  describe('disable Plugin and Verify Cleanup', () => {
    beforeEach(async () => {
      await service.initialize();

      // Reset pluginRegistry.get to use the stateful implementation
      vi.mocked(pluginRegistry.get).mockImplementation((pluginId: string) => {
        const entry = mockState.plugins.get(pluginId);
        return entry?.info ?? null;
      });

      // Install and enable the plugin
      vi.mocked(pluginLoader.loadPlugin).mockResolvedValue({
        success: true,
        manifest: testManifest,
        pluginPath,
        entryPoint: `${pluginPath}/index.js`,
      });

      await service.installPlugin(pluginPath, 'directory');
      await service.enablePlugin(testManifest.id);
    });

    it('should disable plugin and unload from runtime', async () => {
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

    it('should remove UI extensions when disabled', async () => {
      // Manually add extensions to verify they exist (mocks were already called in beforeEach)
      const commandId = `${testManifest.id}:test-command`;
      const menuItemId = `${testManifest.id}:test-menu`;
      mockState.commands.set(commandId, {
        pluginId: testManifest.id,
        options: { id: commandId },
      });
      mockState.menuItems.set(menuItemId, {
        pluginId: testManifest.id,
        options: { id: menuItemId },
      });

      // Verify extensions exist before disable
      expect(mockState.commands.size).toBeGreaterThan(0);
      expect(mockState.menuItems.size).toBeGreaterThan(0);

      vi.mocked(pluginRegistry.isLoaded).mockReturnValue(true);
      vi.mocked(pluginRegistry.get).mockReturnValue({
        manifest: testManifest,
        path: pluginPath,
        state: 'enabled',
        enabled: true,
        installedAt: new Date().toISOString(),
      });

      await service.disablePlugin(testManifest.id);

      // Extensions should be removed
      expect(mockState.commands.size).toBe(0);
      expect(mockState.menuItems.size).toBe(0);
    });

    it('should keep plugin installed after disable', async () => {
      vi.mocked(pluginRegistry.isLoaded).mockReturnValue(true);

      await service.disablePlugin(testManifest.id);

      expect(service.isInstalled(testManifest.id)).toBe(true);
      expect(service.isEnabled(testManifest.id)).toBe(false);
    });
  });

  describe('re-enable Plugin', () => {
    beforeEach(async () => {
      await service.initialize();

      // Install, enable, then disable
      vi.mocked(pluginLoader.loadPlugin).mockResolvedValue({
        success: true,
        manifest: testManifest,
        pluginPath,
        entryPoint: `${pluginPath}/index.js`,
      });

      await service.installPlugin(pluginPath, 'directory');
      await service.enablePlugin(testManifest.id);

      vi.mocked(pluginRegistry.isLoaded).mockReturnValue(true);
      vi.mocked(pluginRegistry.get).mockReturnValue({
        manifest: testManifest,
        path: pluginPath,
        state: 'enabled',
        enabled: true,
        installedAt: new Date().toISOString(),
      });

      await service.disablePlugin(testManifest.id);

      // Reset mocks to reflect disabled state
      vi.mocked(pluginRegistry.isLoaded).mockReturnValue(false);
      vi.mocked(pluginRegistry.get).mockImplementation((pluginId: string) => {
        const entry = mockState.plugins.get(pluginId);
        return entry?.info ?? null;
      });
    });

    it('should re-enable previously disabled plugin', async () => {
      const result = await service.enablePlugin(testManifest.id);

      expect(result.success).toBe(true);
      expect(pluginRuntime.loadPlugin).toHaveBeenCalled();
    });

    it('should re-register UI extensions on re-enable', async () => {
      // Before re-enable, extensions should be cleared
      expect(mockState.commands.size).toBe(0);

      await service.enablePlugin(testManifest.id);

      // Extensions should be registered again
      expect(mockState.commands.size).toBe(1);
      expect(mockState.menuItems.size).toBe(1);
    });
  });

  describe('uninstall Plugin', () => {
    beforeEach(async () => {
      await service.initialize();

      vi.mocked(pluginLoader.loadPlugin).mockResolvedValue({
        success: true,
        manifest: testManifest,
        pluginPath,
        entryPoint: `${pluginPath}/index.js`,
      });

      await service.installPlugin(pluginPath, 'directory');
      await service.enablePlugin(testManifest.id);
    });

    it('should uninstall enabled plugin', async () => {
      vi.mocked(pluginRegistry.isLoaded).mockReturnValue(true);

      const result = await service.uninstallPlugin(testManifest.id);

      expect(result.success).toBe(true);
      expect(service.isInstalled(testManifest.id)).toBe(false);
    });

    it('should remove plugin files on uninstall', async () => {
      vi.mocked(pluginRegistry.isLoaded).mockReturnValue(true);

      await service.uninstallPlugin(testManifest.id);

      expect(pluginLoader.removePlugin).toHaveBeenCalledWith(testManifest.id);
    });

    it('should unload from runtime before uninstalling', async () => {
      vi.mocked(pluginRegistry.isLoaded).mockReturnValue(true);

      await service.uninstallPlugin(testManifest.id);

      expect(pluginRuntime.unloadPlugin).toHaveBeenCalledWith(testManifest.id);
    });

    it('should clear plugin data on uninstall with removeData=true', async () => {
      // Set some plugin data
      mockState.storageData.pluginData = {
        [testManifest.id]: { setting1: 'value1', setting2: 'value2' },
      };

      vi.mocked(pluginRegistry.isLoaded).mockReturnValue(true);

      await service.uninstallPlugin(testManifest.id, true);

      expect(
        (mockState.storageData.pluginData as Record<string, unknown>)[
          testManifest.id
        ]
      ).toBeUndefined();
    });

    it('should preserve plugin data on uninstall with removeData=false', async () => {
      // Set some plugin data
      mockState.storageData.pluginData = {
        [testManifest.id]: { setting1: 'value1' },
      };

      vi.mocked(pluginRegistry.isLoaded).mockReturnValue(true);

      await service.uninstallPlugin(testManifest.id, false);

      // Data should still exist
      expect(
        (mockState.storageData.pluginData as Record<string, unknown>)[
          testManifest.id
        ]
      ).toBeDefined();
    });

    it('should remove all UI extensions on uninstall', async () => {
      vi.mocked(pluginRegistry.isLoaded).mockReturnValue(true);

      // Extensions should exist before uninstall
      expect(mockState.commands.size).toBeGreaterThan(0);

      await service.uninstallPlugin(testManifest.id);

      // All extensions should be removed
      expect(mockState.commands.size).toBe(0);
      expect(mockState.menuItems.size).toBe(0);
      expect(mockState.panels.size).toBe(0);
    });

    it('should return error when uninstalling non-existent plugin', async () => {
      vi.mocked(pluginRegistry.get).mockReturnValue(null);

      const result = await service.uninstallPlugin('non.existent.plugin');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errorCode).toBe('PLUGIN_NOT_FOUND');
      }
    });
  });

  describe('multiple Plugin Lifecycle', () => {
    const plugin1: PluginManifest = {
      ...testManifest,
      id: 'com.example.plugin1',
      name: 'Plugin 1',
    };

    const plugin2: PluginManifest = {
      ...testManifest,
      id: 'com.example.plugin2',
      name: 'Plugin 2',
    };

    const plugin3: PluginManifest = {
      ...testManifest,
      id: 'com.example.plugin3',
      name: 'Plugin 3',
    };

    beforeEach(async () => {
      await service.initialize();

      // Reset pluginRegistry methods to use stateful implementations
      vi.mocked(pluginRegistry.get).mockImplementation((pluginId: string) => {
        const entry = mockState.plugins.get(pluginId);
        return entry?.info ?? null;
      });
      vi.mocked(pluginRegistry.isEnabled).mockImplementation(
        (pluginId: string) => {
          return mockState.plugins.get(pluginId)?.info.enabled ?? false;
        }
      );
      vi.mocked(pluginRegistry.isLoaded).mockImplementation(
        (pluginId: string) => {
          return mockState.plugins.get(pluginId)?.isLoaded ?? false;
        }
      );
    });

    it('should manage multiple plugins independently', async () => {
      // Install all plugins
      for (const manifest of [plugin1, plugin2, plugin3]) {
        vi.mocked(pluginLoader.loadPlugin).mockResolvedValueOnce({
          success: true,
          manifest,
          pluginPath: `/mock/plugins/${manifest.id}`,
          entryPoint: `/mock/plugins/${manifest.id}/index.js`,
        });
        await service.installPlugin(
          `/mock/plugins/${manifest.id}`,
          'directory'
        );
      }

      expect(service.count()).toBe(3);

      // Enable only plugin1 and plugin2
      await service.enablePlugin(plugin1.id);
      await service.enablePlugin(plugin2.id);

      expect(service.isEnabled(plugin1.id)).toBe(true);
      expect(service.isEnabled(plugin2.id)).toBe(true);
      expect(service.isEnabled(plugin3.id)).toBe(false);

      // Disable plugin1
      await service.disablePlugin(plugin1.id);

      // Uninstall plugin2
      await service.uninstallPlugin(plugin2.id);

      expect(service.isInstalled(plugin1.id)).toBe(true);
      expect(service.isInstalled(plugin2.id)).toBe(false);
      expect(service.isInstalled(plugin3.id)).toBe(true);
      expect(service.count()).toBe(2);
    });
  });

  describe('error Handling in Lifecycle', () => {
    beforeEach(async () => {
      await service.initialize();

      // Reset pluginRegistry methods to use stateful implementations
      vi.mocked(pluginRegistry.get).mockImplementation((pluginId: string) => {
        const entry = mockState.plugins.get(pluginId);
        return entry?.info ?? null;
      });
      vi.mocked(pluginRegistry.isEnabled).mockImplementation(
        (pluginId: string) => {
          return mockState.plugins.get(pluginId)?.info.enabled ?? false;
        }
      );
      vi.mocked(pluginRegistry.isLoaded).mockImplementation(
        (pluginId: string) => {
          return mockState.plugins.get(pluginId)?.isLoaded ?? false;
        }
      );
    });

    it('should handle install failure gracefully', async () => {
      vi.mocked(pluginLoader.loadPlugin).mockResolvedValue({
        success: false,
        error: 'Invalid manifest',
        errorCode: 'MANIFEST_INVALID',
      });

      const result = await service.installPlugin('/invalid/path', 'directory');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errorCode).toBe('INSTALLATION_FAILED');
      }
      expect(service.count()).toBe(0);
    });

    it('should handle enable failure and revert state', async () => {
      vi.mocked(pluginLoader.loadPlugin).mockResolvedValue({
        success: true,
        manifest: testManifest,
        pluginPath,
        entryPoint: `${pluginPath}/index.js`,
      });

      await service.installPlugin(pluginPath, 'directory');

      // Make runtime.loadPlugin fail
      vi.mocked(pluginRuntime.loadPlugin).mockResolvedValueOnce({
        success: false,
        error: 'Activation failed',
        errorCode: 'ACTIVATION_FAILED',
      });

      const result = await service.enablePlugin(testManifest.id);

      expect(result.success).toBe(false);
      // Enable should be reverted
      expect(pluginRegistry.disable).toHaveBeenCalledWith(testManifest.id);
    });

    it('should continue uninstall even if runtime unload fails', async () => {
      vi.mocked(pluginLoader.loadPlugin).mockResolvedValue({
        success: true,
        manifest: testManifest,
        pluginPath,
        entryPoint: `${pluginPath}/index.js`,
      });

      await service.installPlugin(pluginPath, 'directory');
      await service.enablePlugin(testManifest.id);

      // Override isLoaded to return true for uninstall check
      vi.mocked(pluginRegistry.isLoaded).mockReturnValue(true);
      vi.mocked(pluginRuntime.unloadPlugin).mockResolvedValueOnce({
        success: false,
        error: 'Unload failed',
        errorCode: 'DEACTIVATION_FAILED',
      });

      const result = await service.uninstallPlugin(testManifest.id);

      // Should still succeed - uninstall continues despite unload failure
      expect(result.success).toBe(true);
      expect(service.isInstalled(testManifest.id)).toBe(false);
    });
  });

  describe('state Transitions', () => {
    beforeEach(async () => {
      await service.initialize();

      // Reset pluginRegistry methods to use stateful implementations
      vi.mocked(pluginRegistry.get).mockImplementation((pluginId: string) => {
        const entry = mockState.plugins.get(pluginId);
        return entry?.info ?? null;
      });
      vi.mocked(pluginRegistry.isEnabled).mockImplementation(
        (pluginId: string) => {
          return mockState.plugins.get(pluginId)?.info.enabled ?? false;
        }
      );
      vi.mocked(pluginRegistry.isLoaded).mockImplementation(
        (pluginId: string) => {
          return mockState.plugins.get(pluginId)?.isLoaded ?? false;
        }
      );

      vi.mocked(pluginLoader.loadPlugin).mockResolvedValue({
        success: true,
        manifest: testManifest,
        pluginPath,
        entryPoint: `${pluginPath}/index.js`,
      });

      await service.installPlugin(pluginPath, 'directory');
    });

    it('should track state: installed → enabled → disabled → enabled', async () => {
      // Initial state: installed
      let plugin = service.getPlugin(testManifest.id);
      expect(plugin!.state).toBe('installed');

      // Enable → enabled
      await service.enablePlugin(testManifest.id);
      plugin = service.getPlugin(testManifest.id);
      expect(plugin!.state).toBe('enabled');
      expect(plugin!.enabled).toBe(true);

      // Disable → disabled
      await service.disablePlugin(testManifest.id);
      plugin = service.getPlugin(testManifest.id);
      expect(plugin!.state).toBe('disabled');
      expect(plugin!.enabled).toBe(false);

      // Re-enable → enabled
      await service.enablePlugin(testManifest.id);
      plugin = service.getPlugin(testManifest.id);
      expect(plugin!.state).toBe('enabled');
      expect(plugin!.enabled).toBe(true);
    });
  });

  describe('uI Extension Lifecycle', () => {
    beforeEach(async () => {
      await service.initialize();

      // Reset pluginRegistry methods to use stateful implementations
      vi.mocked(pluginRegistry.get).mockImplementation((pluginId: string) => {
        const entry = mockState.plugins.get(pluginId);
        return entry?.info ?? null;
      });
      vi.mocked(pluginRegistry.isEnabled).mockImplementation(
        (pluginId: string) => {
          return mockState.plugins.get(pluginId)?.info.enabled ?? false;
        }
      );
      vi.mocked(pluginRegistry.isLoaded).mockImplementation(
        (pluginId: string) => {
          return mockState.plugins.get(pluginId)?.isLoaded ?? false;
        }
      );

      vi.mocked(pluginLoader.loadPlugin).mockResolvedValue({
        success: true,
        manifest: testManifest,
        pluginPath,
        entryPoint: `${pluginPath}/index.js`,
      });
    });

    it('should register commands on enable', async () => {
      await service.installPlugin(pluginPath, 'directory');

      expect(mockState.commands.size).toBe(0);

      await service.enablePlugin(testManifest.id);

      // The mock adds a command when loadPlugin is called
      expect(mockState.commands.size).toBe(1);
      const commandId = `${testManifest.id}:test-command`;
      expect(mockState.commands.has(commandId)).toBe(true);
    });

    it('should register menu items on enable', async () => {
      await service.installPlugin(pluginPath, 'directory');

      expect(mockState.menuItems.size).toBe(0);

      await service.enablePlugin(testManifest.id);

      // The mock adds a menu item when loadPlugin is called
      expect(mockState.menuItems.size).toBe(1);
      const menuItemId = `${testManifest.id}:test-menu`;
      expect(mockState.menuItems.has(menuItemId)).toBe(true);
    });

    it('should unregister all extensions on disable', async () => {
      await service.installPlugin(pluginPath, 'directory');
      await service.enablePlugin(testManifest.id);

      expect(mockState.commands.size).toBe(1);
      expect(mockState.menuItems.size).toBe(1);

      await service.disablePlugin(testManifest.id);

      // unloadPlugin clears the extensions
      expect(mockState.commands.size).toBe(0);
      expect(mockState.menuItems.size).toBe(0);
    });

    it('should re-register extensions on re-enable', async () => {
      await service.installPlugin(pluginPath, 'directory');
      await service.enablePlugin(testManifest.id);

      await service.disablePlugin(testManifest.id);

      expect(mockState.commands.size).toBe(0);

      await service.enablePlugin(testManifest.id);

      expect(mockState.commands.size).toBe(1);
      expect(mockState.menuItems.size).toBe(1);
    });
  });
});

describe('plugin Lifecycle Events', () => {
  let service: PluginService;

  const testManifest: PluginManifest = {
    id: 'com.example.event-test',
    name: 'Event Test Plugin',
    version: '1.0.0',
    description: 'Plugin for testing events',
    author: 'Test',
    main: 'index.js',
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockState.storageData = { pluginData: {} };
    mockState.plugins.clear();
    mockState.registryListeners.clear();
    mockState.runtimeListeners.clear();
    mockState.commands.clear();
    mockState.menuItems.clear();
    mockState.panels.clear();
    mockState.pluginFiles.clear();
    mockState.installedPlugins = [];

    service = new PluginService();
    await service.initialize();
  });

  afterEach(async () => {
    if (service.isInitialized()) {
      await service.shutdown();
    }
  });

  it('should emit install event on successful installation', async () => {
    const events: PluginEvent[] = [];
    service.on('plugin-event', (event: PluginEvent) => {
      events.push(event);
    });

    vi.mocked(pluginLoader.loadPlugin).mockResolvedValue({
      success: true,
      manifest: testManifest,
      pluginPath: '/mock/path',
      entryPoint: '/mock/path/index.js',
    });

    await service.installPlugin('/mock/path', 'directory');

    const installEvent = events.find((e) => e.type === 'plugin:installed');
    expect(installEvent).toBeDefined();
    expect(installEvent?.pluginId).toBe(testManifest.id);
  });

  it('should emit enable event on successful enable', async () => {
    const events: PluginEvent[] = [];
    service.on('plugin-event', (event: PluginEvent) => {
      events.push(event);
    });

    vi.mocked(pluginLoader.loadPlugin).mockResolvedValue({
      success: true,
      manifest: testManifest,
      pluginPath: '/mock/path',
      entryPoint: '/mock/path/index.js',
    });

    await service.installPlugin('/mock/path', 'directory');
    await service.enablePlugin(testManifest.id);

    const enableEvent = events.find((e) => e.type === 'plugin:enabled');
    expect(enableEvent).toBeDefined();
    expect(enableEvent?.pluginId).toBe(testManifest.id);
  });

  it('should emit disable event on successful disable', async () => {
    const events: PluginEvent[] = [];
    service.on('plugin-event', (event: PluginEvent) => {
      events.push(event);
    });

    vi.mocked(pluginLoader.loadPlugin).mockResolvedValue({
      success: true,
      manifest: testManifest,
      pluginPath: '/mock/path',
      entryPoint: '/mock/path/index.js',
    });

    await service.installPlugin('/mock/path', 'directory');
    await service.enablePlugin(testManifest.id);

    vi.mocked(pluginRegistry.isLoaded).mockReturnValue(true);
    vi.mocked(pluginRegistry.get).mockReturnValue({
      manifest: testManifest,
      path: '/mock/path',
      state: 'enabled',
      enabled: true,
      installedAt: new Date().toISOString(),
    });

    await service.disablePlugin(testManifest.id);

    const disableEvent = events.find((e) => e.type === 'plugin:disabled');
    expect(disableEvent).toBeDefined();
    expect(disableEvent?.pluginId).toBe(testManifest.id);
  });

  it('should emit uninstall event on successful uninstall', async () => {
    const events: PluginEvent[] = [];
    service.on('plugin-event', (event: PluginEvent) => {
      events.push(event);
    });

    vi.mocked(pluginLoader.loadPlugin).mockResolvedValue({
      success: true,
      manifest: testManifest,
      pluginPath: '/mock/path',
      entryPoint: '/mock/path/index.js',
    });

    await service.installPlugin('/mock/path', 'directory');
    await service.uninstallPlugin(testManifest.id);

    const uninstallEvent = events.find((e) => e.type === 'plugin:uninstalled');
    expect(uninstallEvent).toBeDefined();
    expect(uninstallEvent?.pluginId).toBe(testManifest.id);
  });
});

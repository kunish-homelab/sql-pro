import type { PluginEvent, PluginManifest } from '../../types/plugin';
/**
 * Tests for PluginRegistry service.
 *
 * Tests plugin registration, state management, and event emission.
 * Uses mocks for electron-store.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Import after mocking
import { PluginRegistry } from './PluginRegistry';

// Shared mock store data - must be a simple object that the hoisted mock can reference
const mockStoreState = {
  data: { pluginStates: {} as Record<string, unknown> },
};

// Mock electron-store - all code must be inside the factory
vi.mock('electron-store', () => ({
  default: class MockStore {
    get(key: string, defaultValue?: unknown) {
      return (
        (mockStoreState.data as Record<string, unknown>)[key] ?? defaultValue
      );
    }
    set(key: string, value: unknown) {
      (mockStoreState.data as Record<string, unknown>)[key] = value;
    }
  },
}));

describe('pluginRegistry', () => {
  let registry: PluginRegistry;

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
    // Reset mock store data
    mockStoreState.data = { pluginStates: {} };

    // Create fresh registry instance
    registry = new PluginRegistry();
    registry.initialize();
  });

  describe('initialize', () => {
    it('should clear in-memory state on initialization', () => {
      // Register a plugin first
      registry.register(testManifest, pluginPath);
      expect(registry.count()).toBe(1);

      // Reinitialize
      registry.initialize();

      expect(registry.count()).toBe(0);
    });
  });

  describe('register', () => {
    it('should register a new plugin successfully', () => {
      const result = registry.register(testManifest, pluginPath);

      expect(result.success).toBe(true);
      expect(registry.has(testManifest.id)).toBe(true);
    });

    it('should return error if plugin is already registered', () => {
      registry.register(testManifest, pluginPath);

      const result = registry.register(testManifest, pluginPath);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errorCode).toBe('PLUGIN_ALREADY_REGISTERED');
      }
    });

    it('should set plugin state to installed when not previously enabled', () => {
      registry.register(testManifest, pluginPath);

      const info = registry.get(testManifest.id);

      expect(info).not.toBeNull();
      expect(info!.state).toBe('installed');
      expect(info!.enabled).toBe(false);
    });

    it('should restore enabled state from stored data', () => {
      // Simulate stored enabled state
      mockStoreState.data.pluginStates = {
        [testManifest.id]: {
          id: testManifest.id,
          enabled: true,
          installedAt: new Date().toISOString(),
          path: pluginPath,
        },
      };

      // Create a new registry to pick up the stored state
      const newRegistry = new PluginRegistry();
      newRegistry.initialize();
      newRegistry.register(testManifest, pluginPath);

      const info = newRegistry.get(testManifest.id);

      expect(info).not.toBeNull();
      expect(info!.enabled).toBe(true);
      expect(info!.state).toBe('enabled');
    });

    it('should emit plugin:installed event on registration', () => {
      const eventHandler = vi.fn();
      registry.on('plugin:installed', eventHandler);

      registry.register(testManifest, pluginPath);

      expect(eventHandler).toHaveBeenCalledTimes(1);
      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'plugin:installed',
          pluginId: testManifest.id,
        })
      );
    });
  });

  describe('unregister', () => {
    beforeEach(() => {
      registry.register(testManifest, pluginPath);
    });

    it('should unregister a registered plugin', () => {
      const result = registry.unregister(testManifest.id);

      expect(result.success).toBe(true);
      expect(registry.has(testManifest.id)).toBe(false);
    });

    it('should return error if plugin is not registered', () => {
      const result = registry.unregister('non.existent.plugin');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errorCode).toBe('PLUGIN_NOT_REGISTERED');
      }
    });

    it('should emit plugin:uninstalled event on unregistration', () => {
      const eventHandler = vi.fn();
      registry.on('plugin:uninstalled', eventHandler);

      registry.unregister(testManifest.id);

      expect(eventHandler).toHaveBeenCalledTimes(1);
      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'plugin:uninstalled',
          pluginId: testManifest.id,
        })
      );
    });
  });

  describe('enable', () => {
    beforeEach(() => {
      registry.register(testManifest, pluginPath);
    });

    it('should enable a registered plugin', () => {
      const result = registry.enable(testManifest.id);

      expect(result.success).toBe(true);
      expect(registry.isEnabled(testManifest.id)).toBe(true);
    });

    it('should return error if plugin is not found', () => {
      const result = registry.enable('non.existent.plugin');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errorCode).toBe('PLUGIN_NOT_FOUND');
      }
    });

    it('should update plugin state to enabled', () => {
      registry.enable(testManifest.id);

      const info = registry.get(testManifest.id);

      expect(info!.state).toBe('enabled');
      expect(info!.enabled).toBe(true);
    });

    it('should emit plugin:enabled event', () => {
      const eventHandler = vi.fn();
      registry.on('plugin:enabled', eventHandler);

      registry.enable(testManifest.id);

      expect(eventHandler).toHaveBeenCalledTimes(1);
      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'plugin:enabled',
          pluginId: testManifest.id,
        })
      );
    });
  });

  describe('disable', () => {
    beforeEach(() => {
      registry.register(testManifest, pluginPath);
      registry.enable(testManifest.id);
    });

    it('should disable an enabled plugin', () => {
      const result = registry.disable(testManifest.id);

      expect(result.success).toBe(true);
      expect(registry.isEnabled(testManifest.id)).toBe(false);
    });

    it('should return error if plugin is not found', () => {
      const result = registry.disable('non.existent.plugin');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errorCode).toBe('PLUGIN_NOT_FOUND');
      }
    });

    it('should update plugin state to disabled', () => {
      registry.disable(testManifest.id);

      const info = registry.get(testManifest.id);

      expect(info!.state).toBe('disabled');
      expect(info!.enabled).toBe(false);
    });

    it('should emit plugin:disabled event', () => {
      const eventHandler = vi.fn();
      registry.on('plugin:disabled', eventHandler);

      registry.disable(testManifest.id);

      expect(eventHandler).toHaveBeenCalledTimes(1);
      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'plugin:disabled',
          pluginId: testManifest.id,
        })
      );
    });
  });

  describe('updateState', () => {
    beforeEach(() => {
      registry.register(testManifest, pluginPath);
    });

    it('should update plugin state', () => {
      const result = registry.updateState(testManifest.id, 'loading');

      expect(result.success).toBe(true);

      const info = registry.get(testManifest.id);
      expect(info!.state).toBe('loading');
    });

    it('should return error if plugin is not found', () => {
      const result = registry.updateState('non.existent.plugin', 'loading');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errorCode).toBe('PLUGIN_NOT_FOUND');
      }
    });

    it('should set error message when state is error', () => {
      registry.updateState(testManifest.id, 'error', 'Something went wrong');

      const info = registry.get(testManifest.id);
      expect(info!.state).toBe('error');
      expect(info!.error).toBe('Something went wrong');
    });

    it('should clear error message when state is not error', () => {
      registry.updateState(testManifest.id, 'error', 'Error message');
      registry.updateState(testManifest.id, 'enabled');

      const info = registry.get(testManifest.id);
      expect(info!.error).toBeUndefined();
    });

    it('should emit plugin:error event when state is error', () => {
      const eventHandler = vi.fn();
      registry.on('plugin:error', eventHandler);

      registry.updateState(testManifest.id, 'error', 'Error message');

      expect(eventHandler).toHaveBeenCalledTimes(1);
      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'plugin:error',
          pluginId: testManifest.id,
          error: 'Error message',
        })
      );
    });
  });

  describe('setLoaded / setUnloaded', () => {
    beforeEach(() => {
      registry.register(testManifest, pluginPath);
    });

    it('should mark plugin as loaded with instance ID', () => {
      const instanceId = 'instance_123';

      const result = registry.setLoaded(testManifest.id, instanceId);

      expect(result.success).toBe(true);
      expect(registry.isLoaded(testManifest.id)).toBe(true);

      const entry = registry.getEntry(testManifest.id);
      expect(entry!.instanceId).toBe(instanceId);
    });

    it('should mark plugin as unloaded', () => {
      registry.setLoaded(testManifest.id, 'instance_123');

      const result = registry.setUnloaded(testManifest.id);

      expect(result.success).toBe(true);
      expect(registry.isLoaded(testManifest.id)).toBe(false);

      const entry = registry.getEntry(testManifest.id);
      expect(entry!.instanceId).toBeUndefined();
    });

    it('should return error if plugin is not found', () => {
      const loadResult = registry.setLoaded('non.existent.plugin', 'instance');
      const unloadResult = registry.setUnloaded('non.existent.plugin');

      expect(loadResult.success).toBe(false);
      expect(unloadResult.success).toBe(false);
    });
  });

  describe('get / getEntry / has', () => {
    it('should return null for non-existent plugin', () => {
      expect(registry.get('non.existent.plugin')).toBeNull();
      expect(registry.getEntry('non.existent.plugin')).toBeNull();
    });

    it('should return plugin info for registered plugin', () => {
      registry.register(testManifest, pluginPath);

      const info = registry.get(testManifest.id);

      expect(info).not.toBeNull();
      expect(info!.manifest).toEqual(testManifest);
      expect(info!.path).toBe(pluginPath);
    });

    it('should return registry entry for registered plugin', () => {
      registry.register(testManifest, pluginPath);

      const entry = registry.getEntry(testManifest.id);

      expect(entry).not.toBeNull();
      expect(entry!.info.manifest).toEqual(testManifest);
      expect(entry!.isLoaded).toBe(false);
    });

    it('should correctly check if plugin exists', () => {
      expect(registry.has(testManifest.id)).toBe(false);

      registry.register(testManifest, pluginPath);

      expect(registry.has(testManifest.id)).toBe(true);
    });
  });

  describe('isEnabled / isLoaded', () => {
    it('should return false for non-existent plugin', () => {
      expect(registry.isEnabled('non.existent.plugin')).toBe(false);
      expect(registry.isLoaded('non.existent.plugin')).toBe(false);
    });

    it('should correctly check enabled state', () => {
      registry.register(testManifest, pluginPath);

      expect(registry.isEnabled(testManifest.id)).toBe(false);

      registry.enable(testManifest.id);

      expect(registry.isEnabled(testManifest.id)).toBe(true);
    });

    it('should correctly check loaded state', () => {
      registry.register(testManifest, pluginPath);

      expect(registry.isLoaded(testManifest.id)).toBe(false);

      registry.setLoaded(testManifest.id, 'instance_123');

      expect(registry.isLoaded(testManifest.id)).toBe(true);
    });
  });

  describe('getAll / getEnabled / getDisabled / getByState / getLoaded', () => {
    const manifest2: PluginManifest = {
      ...testManifest,
      id: 'com.example.plugin2',
      name: 'Plugin 2',
    };

    const manifest3: PluginManifest = {
      ...testManifest,
      id: 'com.example.plugin3',
      name: 'Plugin 3',
    };

    beforeEach(() => {
      registry.register(testManifest, pluginPath);
      registry.register(manifest2, '/path/to/plugin2');
      registry.register(manifest3, '/path/to/plugin3');

      registry.enable(testManifest.id);
      registry.enable(manifest2.id);
    });

    it('should return all registered plugins', () => {
      const all = registry.getAll();

      expect(all.length).toBe(3);
    });

    it('should return only enabled plugins', () => {
      const enabled = registry.getEnabled();

      expect(enabled.length).toBe(2);
      expect(enabled.every((p) => p.enabled)).toBe(true);
    });

    it('should return only disabled plugins', () => {
      const disabled = registry.getDisabled();

      expect(disabled.length).toBe(1);
      expect(disabled.every((p) => !p.enabled)).toBe(true);
    });

    it('should filter plugins by state', () => {
      registry.updateState(testManifest.id, 'loading');

      const loading = registry.getByState('loading');

      expect(loading.length).toBe(1);
      expect(loading[0].manifest.id).toBe(testManifest.id);
    });

    it('should return loaded plugins', () => {
      registry.setLoaded(testManifest.id, 'instance_1');
      registry.setLoaded(manifest2.id, 'instance_2');

      const loaded = registry.getLoaded();

      expect(loaded.length).toBe(2);
      expect(loaded.every((e) => e.isLoaded)).toBe(true);
    });
  });

  describe('count', () => {
    it('should return 0 for empty registry', () => {
      expect(registry.count()).toBe(0);
    });

    it('should return correct count of registered plugins', () => {
      registry.register(testManifest, pluginPath);
      expect(registry.count()).toBe(1);

      registry.register({ ...testManifest, id: 'plugin2' }, '/path2');
      expect(registry.count()).toBe(2);

      registry.unregister(testManifest.id);
      expect(registry.count()).toBe(1);
    });
  });

  describe('updateManifest', () => {
    beforeEach(() => {
      registry.register(testManifest, pluginPath);
    });

    it('should update plugin manifest', () => {
      const newManifest: PluginManifest = {
        ...testManifest,
        version: '2.0.0',
        description: 'Updated description',
      };

      const result = registry.updateManifest(testManifest.id, newManifest);

      expect(result.success).toBe(true);

      const info = registry.get(testManifest.id);
      expect(info!.manifest.version).toBe('2.0.0');
      expect(info!.manifest.description).toBe('Updated description');
      expect(info!.updatedAt).toBeDefined();
    });

    it('should return error if plugin is not found', () => {
      const result = registry.updateManifest(
        'non.existent.plugin',
        testManifest
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errorCode).toBe('PLUGIN_NOT_FOUND');
      }
    });

    it('should emit plugin:updated event', () => {
      const eventHandler = vi.fn();
      registry.on('plugin:updated', eventHandler);

      registry.updateManifest(testManifest.id, {
        ...testManifest,
        version: '2.0.0',
      });

      expect(eventHandler).toHaveBeenCalledTimes(1);
      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'plugin:updated',
          pluginId: testManifest.id,
        })
      );
    });
  });

  describe('clear', () => {
    it('should clear all in-memory state', () => {
      registry.register(testManifest, pluginPath);
      registry.register({ ...testManifest, id: 'plugin2' }, '/path2');

      registry.clear();

      expect(registry.count()).toBe(0);
    });
  });

  describe('event emission', () => {
    it('should emit plugin-event for all lifecycle events', () => {
      const eventHandler = vi.fn();
      registry.on('plugin-event', eventHandler);

      registry.register(testManifest, pluginPath);
      registry.enable(testManifest.id);
      registry.disable(testManifest.id);
      registry.unregister(testManifest.id);

      // Should receive 4 events: installed, enabled, disabled, uninstalled
      expect(eventHandler).toHaveBeenCalledTimes(4);
    });

    it('should include timestamp in events', () => {
      let receivedEvent: PluginEvent | null = null;
      registry.on('plugin-event', (event: PluginEvent) => {
        receivedEvent = event;
      });

      registry.register(testManifest, pluginPath);

      expect(receivedEvent).not.toBeNull();
      expect(receivedEvent!.timestamp).toBeDefined();
      expect(new Date(receivedEvent!.timestamp).getTime()).not.toBeNaN();
    });
  });
});

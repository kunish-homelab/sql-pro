import type { PluginManifest } from '@/types/plugin';
// Import mocked modules AFTER mocking
import * as fs from 'node:fs';

/**
 * Tests for PluginLoader service.
 *
 * Tests plugin loading, validation, and extraction functionality.
 * Uses mocks for filesystem and Electron APIs.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseAndValidateManifest } from '@/utils/plugins/validate-manifest';
import { PluginLoader } from './PluginLoader';

// Mock electron
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/user/data'),
    getVersion: vi.fn(() => '1.6.0'),
  },
  net: {
    request: vi.fn(),
  },
}));

// Mock node:fs using factory function with default export
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  const mockModule = {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    readdirSync: vi.fn(),
    statSync: vi.fn(),
    mkdirSync: vi.fn(),
    createWriteStream: vi.fn(),
  };
  return {
    ...mockModule,
    default: mockModule,
  };
});

// Mock node:fs/promises with default export
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  const mockModule = {
    ...actual,
    rm: vi.fn().mockResolvedValue(undefined),
    rename: vi.fn().mockResolvedValue(undefined),
  };
  return {
    ...mockModule,
    default: mockModule,
  };
});

// Mock child_process with default export
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  const mockModule = {
    ...actual,
    exec: vi.fn(),
  };
  return {
    ...mockModule,
    default: mockModule,
  };
});

// Mock validate-manifest
vi.mock('../../utils/plugins/validate-manifest', () => ({
  parseAndValidateManifest: vi.fn(),
  formatManifestErrors: vi.fn((errors: Array<{ message: string }>) =>
    errors.map((e) => e.message).join('\n')
  ),
}));

describe('pluginLoader', () => {
  let pluginLoader: PluginLoader;

  const validManifest: PluginManifest = {
    id: 'com.example.testplugin',
    name: 'Test Plugin',
    version: '1.0.0',
    description: 'A test plugin',
    author: 'Test Author',
    main: 'index.js',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    pluginLoader = new PluginLoader();
  });

  describe('getPluginsDirectory', () => {
    it('should return the plugins directory path', () => {
      const result = pluginLoader.getPluginsDirectory();
      expect(result).toBe('/mock/user/data/plugins');
    });
  });

  describe('ensurePluginsDirectory', () => {
    it('should create plugins directory if it does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = pluginLoader.ensurePluginsDirectory();

      expect(result).toBe('/mock/user/data/plugins');
      expect(fs.mkdirSync).toHaveBeenCalled();
    });

    it('should not create directory if it already exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const result = pluginLoader.ensurePluginsDirectory();

      expect(result).toBe('/mock/user/data/plugins');
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe('loadFromDirectory', () => {
    const pluginPath = '/path/to/plugin';

    it('should return error if directory does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = pluginLoader.loadFromDirectory(pluginPath);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errorCode).toBe('PLUGIN_NOT_FOUND');
      }
    });

    it('should return error if path is not a directory', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({
        isDirectory: () => false,
        size: 1000,
      } as fs.Stats);

      const result = pluginLoader.loadFromDirectory(pluginPath);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errorCode).toBe('PLUGIN_NOT_FOUND');
      }
    });

    it('should return error if manifest is not found', () => {
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        if (path === pluginPath) return true;
        if (String(path).includes('plugin.json')) return false;
        return true;
      });
      vi.mocked(fs.statSync).mockReturnValue({
        isDirectory: () => true,
        size: 1000,
      } as fs.Stats);
      vi.mocked(fs.readdirSync).mockReturnValue([]);

      const result = pluginLoader.loadFromDirectory(pluginPath);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errorCode).toBe('MANIFEST_NOT_FOUND');
      }
    });

    it('should return error if manifest is invalid', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({
        isDirectory: () => true,
        size: 1000,
      } as fs.Stats);
      vi.mocked(fs.readdirSync).mockReturnValue([]);
      vi.mocked(fs.readFileSync).mockReturnValue('{}');
      vi.mocked(parseAndValidateManifest).mockReturnValue({
        valid: false,
        errors: [{ path: 'id', message: 'Missing required field: id' }],
      });

      const result = pluginLoader.loadFromDirectory(pluginPath);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errorCode).toBe('MANIFEST_INVALID');
      }
    });

    it('should return error if app version is incompatible', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({
        isDirectory: () => true,
        size: 1000,
      } as fs.Stats);
      vi.mocked(fs.readdirSync).mockReturnValue([]);
      vi.mocked(fs.readFileSync).mockReturnValue('{}');
      vi.mocked(parseAndValidateManifest).mockReturnValue({
        valid: true,
        manifest: {
          ...validManifest,
          engines: { sqlpro: '^2.0.0' },
        },
      });

      const result = pluginLoader.loadFromDirectory(pluginPath);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errorCode).toBe('INCOMPATIBLE_VERSION');
      }
    });

    it('should return error if entry point is not found', () => {
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        if (String(path).includes('index.js')) return false;
        return true;
      });
      vi.mocked(fs.statSync).mockReturnValue({
        isDirectory: () => true,
        size: 1000,
      } as fs.Stats);
      vi.mocked(fs.readdirSync).mockReturnValue([]);
      vi.mocked(fs.readFileSync).mockReturnValue('{}');
      vi.mocked(parseAndValidateManifest).mockReturnValue({
        valid: true,
        manifest: validManifest,
      });

      const result = pluginLoader.loadFromDirectory(pluginPath);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errorCode).toBe('ENTRY_POINT_NOT_FOUND');
      }
    });

    it('should successfully load a valid plugin', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({
        isDirectory: () => true,
        size: 1000,
      } as fs.Stats);
      vi.mocked(fs.readdirSync).mockReturnValue([]);
      vi.mocked(fs.readFileSync).mockReturnValue('{}');
      vi.mocked(parseAndValidateManifest).mockReturnValue({
        valid: true,
        manifest: validManifest,
      });

      const result = pluginLoader.loadFromDirectory(pluginPath);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.manifest).toEqual(validManifest);
        expect(result.pluginPath).toBe(pluginPath);
      }
    });

    it('should accept compatible caret version range', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({
        isDirectory: () => true,
        size: 1000,
      } as fs.Stats);
      vi.mocked(fs.readdirSync).mockReturnValue([]);
      vi.mocked(fs.readFileSync).mockReturnValue('{}');
      vi.mocked(parseAndValidateManifest).mockReturnValue({
        valid: true,
        manifest: {
          ...validManifest,
          engines: { sqlpro: '^1.0.0' },
        },
      });

      const result = pluginLoader.loadFromDirectory(pluginPath);

      expect(result.success).toBe(true);
    });

    it('should accept compatible tilde version range', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({
        isDirectory: () => true,
        size: 1000,
      } as fs.Stats);
      vi.mocked(fs.readdirSync).mockReturnValue([]);
      vi.mocked(fs.readFileSync).mockReturnValue('{}');
      vi.mocked(parseAndValidateManifest).mockReturnValue({
        valid: true,
        manifest: {
          ...validManifest,
          engines: { sqlpro: '~1.6.0' },
        },
      });

      const result = pluginLoader.loadFromDirectory(pluginPath);

      expect(result.success).toBe(true);
    });
  });

  describe('validatePlugin', () => {
    const pluginPath = '/path/to/plugin';

    it('should return error if manifest file is not found', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = pluginLoader.validatePlugin(pluginPath);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errorCode).toBe('MANIFEST_NOT_FOUND');
      }
    });

    it('should return error if manifest cannot be read', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = pluginLoader.validatePlugin(pluginPath);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errorCode).toBe('IO_ERROR');
      }
    });

    it('should return validation errors for invalid manifest', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('{}');
      vi.mocked(parseAndValidateManifest).mockReturnValue({
        valid: false,
        errors: [
          { path: 'id', message: 'Missing required field: id' },
          { path: 'name', message: 'Missing required field: name' },
        ],
      });

      const result = pluginLoader.validatePlugin(pluginPath);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errorCode).toBe('MANIFEST_INVALID');
        expect(result.validationErrors).toBeDefined();
        expect(result.validationErrors!.length).toBe(2);
      }
    });

    it('should return manifest for valid plugin', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('{}');
      vi.mocked(parseAndValidateManifest).mockReturnValue({
        valid: true,
        manifest: validManifest,
      });

      const result = pluginLoader.validatePlugin(pluginPath);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.manifest).toEqual(validManifest);
      }
    });
  });

  describe('readPluginCode', () => {
    const pluginPath = '/path/to/plugin';

    it('should return plugin code when file exists', () => {
      const expectedCode = 'console.log("Hello");';
      vi.mocked(fs.readFileSync).mockReturnValue(expectedCode);

      const result = pluginLoader.readPluginCode(pluginPath, validManifest);

      expect(result).toBe(expectedCode);
    });

    it('should return null if file cannot be read', () => {
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('File not found');
      });

      const result = pluginLoader.readPluginCode(pluginPath, validManifest);

      expect(result).toBeNull();
    });
  });

  describe('listInstalledPlugins', () => {
    it('should return empty array if plugins directory does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = pluginLoader.listInstalledPlugins();

      expect(result).toEqual([]);
    });

    it('should skip temp directories', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        '_extracting_123',
        '_download_456',
      ] as unknown as ReturnType<typeof fs.readdirSync>);

      const result = pluginLoader.listInstalledPlugins();

      expect(result).toEqual([]);
    });
  });

  describe('loadPlugin', () => {
    it('should load from directory when sourceType is directory', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({
        isDirectory: () => true,
        size: 1000,
      } as fs.Stats);
      vi.mocked(fs.readdirSync).mockReturnValue([]);
      vi.mocked(fs.readFileSync).mockReturnValue('{}');
      vi.mocked(parseAndValidateManifest).mockReturnValue({
        valid: true,
        manifest: validManifest,
      });

      const result = await pluginLoader.loadPlugin(
        '/path/to/plugin',
        'directory'
      );

      expect(result.success).toBe(true);
    });

    it('should return error for unknown source type', async () => {
      const result = await pluginLoader.loadPlugin(
        '/path/to/plugin',
        'unknown' as 'directory'
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errorCode).toBe('IO_ERROR');
      }
    });
  });

  describe('extractArchive', () => {
    it('should return error if archive does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = await pluginLoader.extractArchive(
        '/path/to/plugin.sqlpro-plugin'
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errorCode).toBe('PLUGIN_NOT_FOUND');
      }
    });

    it('should return error for invalid archive format', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const result = await pluginLoader.extractArchive(
        '/path/to/plugin.tar.gz'
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errorCode).toBe('INVALID_ARCHIVE');
      }
    });

    it('should return error if archive exceeds size limit', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({
        size: 60 * 1024 * 1024,
      } as fs.Stats);

      const result = await pluginLoader.extractArchive(
        '/path/to/plugin.sqlpro-plugin'
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errorCode).toBe('PLUGIN_TOO_LARGE');
      }
    });
  });

  describe('removePlugin', () => {
    it('should return error if plugin does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = await pluginLoader.removePlugin('com.example.testplugin');

      expect(result.success).toBe(false);
    });

    it('should successfully remove existing plugin', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const result = await pluginLoader.removePlugin('com.example.testplugin');

      expect(result.success).toBe(true);
    });
  });
});

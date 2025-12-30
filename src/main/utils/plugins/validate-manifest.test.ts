import type { ManifestValidationError } from './validate-manifest';
/**
 * Tests for validate-manifest utility functions.
 *
 * Tests the plugin manifest validation logic including
 * schema validation, parsing, and error formatting.
 */
import { describe, expect, it } from 'vitest';
import {
  formatManifestErrors,
  parseAndValidateManifest,
  validateManifest,
} from './validate-manifest';

describe('validateManifest', () => {
  describe('valid manifests', () => {
    it('should validate a minimal valid manifest', () => {
      const manifest = {
        id: 'com.example.testplugin',
        name: 'Test Plugin',
        version: '1.0.0',
        description: 'A test plugin',
        author: 'Test Author',
        main: 'index.js',
      };

      const result = validateManifest(manifest);

      expect(result.valid).toBe(true);
      expect(result.manifest).toEqual(manifest);
      expect(result.errors).toBeUndefined();
    });

    it('should validate a manifest with all optional fields', () => {
      const manifest = {
        id: 'com.example.testplugin',
        name: 'Test Plugin',
        version: '1.0.0',
        description: 'A test plugin',
        author: 'Test Author',
        main: 'index.js',
        permissions: ['query:read', 'ui:command'] as const,
        engines: { sqlpro: '^1.6.0' },
        homepage: 'https://example.com',
        repository: 'https://github.com/example/plugin',
        license: 'MIT',
        keywords: ['test', 'plugin'],
        icon: 'icon.png',
        screenshots: ['screenshot1.png'],
        apiVersion: '1.0',
      };

      const result = validateManifest(manifest);

      expect(result.valid).toBe(true);
      expect(result.manifest).toEqual(manifest);
    });

    it('should validate plugin ID with various valid formats', () => {
      const validIds = [
        'com.example.plugin',
        'myPlugin',
        'my-plugin',
        'my_plugin',
        'my.plugin.v2',
        'Plugin123',
      ];

      for (const id of validIds) {
        const manifest = {
          id,
          name: 'Test',
          version: '1.0.0',
          description: 'Test',
          author: 'Test',
          main: 'index.js',
        };

        const result = validateManifest(manifest);
        expect(result.valid).toBe(true);
      }
    });

    it('should validate version with various valid formats', () => {
      const validVersions = [
        '1.0.0',
        '0.0.1',
        '10.20.30',
        '1.0.0-alpha',
        '1.0.0-beta.1',
        '1.0.0+build123',
        '1.0.0-alpha+build',
      ];

      for (const version of validVersions) {
        const manifest = {
          id: 'test',
          name: 'Test',
          version,
          description: 'Test',
          author: 'Test',
          main: 'index.js',
        };

        const result = validateManifest(manifest);
        expect(result.valid).toBe(true);
      }
    });

    it('should validate main entry point with various valid formats', () => {
      const validMains = [
        'index.js',
        'dist/main.js',
        'src/plugin.js',
        'out/bundle.js',
      ];

      for (const main of validMains) {
        const manifest = {
          id: 'test',
          name: 'Test',
          version: '1.0.0',
          description: 'Test',
          author: 'Test',
          main,
        };

        const result = validateManifest(manifest);
        expect(result.valid).toBe(true);
      }
    });
  });

  describe('invalid manifests', () => {
    it('should reject null input', () => {
      const result = validateManifest(null);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors![0].message).toContain('JSON object');
    });

    it('should reject array input', () => {
      const result = validateManifest([]);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors![0].message).toContain('JSON object');
    });

    it('should reject string input', () => {
      const result = validateManifest('not an object');

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject manifest missing required fields', () => {
      const manifest = {
        id: 'test',
      };

      const result = validateManifest(manifest);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);

      const missingFields = result.errors!.filter((e) =>
        e.message.includes('Missing required field')
      );
      expect(missingFields.length).toBeGreaterThan(0);
    });

    it('should reject invalid plugin ID format', () => {
      const invalidIds = [
        '123plugin', // starts with number
        '-plugin', // starts with hyphen
        '_plugin', // starts with underscore
        '.plugin', // starts with dot
      ];

      for (const id of invalidIds) {
        const manifest = {
          id,
          name: 'Test',
          version: '1.0.0',
          description: 'Test',
          author: 'Test',
          main: 'index.js',
        };

        const result = validateManifest(manifest);
        expect(result.valid).toBe(false);
      }
    });

    it('should reject invalid version format', () => {
      const invalidVersions = [
        '1.0', // missing patch
        'v1.0.0', // starts with v
        '1.0.0.0', // too many parts
        'invalid',
      ];

      for (const version of invalidVersions) {
        const manifest = {
          id: 'test',
          name: 'Test',
          version,
          description: 'Test',
          author: 'Test',
          main: 'index.js',
        };

        const result = validateManifest(manifest);
        expect(result.valid).toBe(false);
      }
    });

    it('should reject invalid main entry point', () => {
      const invalidMains = [
        '/index.js', // starts with /
        'index.ts', // wrong extension
        '', // empty
      ];

      for (const main of invalidMains) {
        const manifest = {
          id: 'test',
          name: 'Test',
          version: '1.0.0',
          description: 'Test',
          author: 'Test',
          main,
        };

        const result = validateManifest(manifest);
        expect(result.valid).toBe(false);
      }
    });

    it('should reject invalid permissions', () => {
      const manifest = {
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        description: 'Test',
        author: 'Test',
        main: 'index.js',
        permissions: ['invalid:permission'],
      };

      const result = validateManifest(manifest);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject invalid homepage URL', () => {
      const manifest = {
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        description: 'Test',
        author: 'Test',
        main: 'index.js',
        homepage: 'not-a-valid-url',
      };

      const result = validateManifest(manifest);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject additional unknown properties', () => {
      const manifest = {
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        description: 'Test',
        author: 'Test',
        main: 'index.js',
        unknownField: 'value',
      };

      const result = validateManifest(manifest);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(
        result.errors!.some((e) => e.message.includes('Unknown property'))
      ).toBe(true);
    });

    it('should reject name exceeding max length', () => {
      const manifest = {
        id: 'test',
        name: 'A'.repeat(101),
        version: '1.0.0',
        description: 'Test',
        author: 'Test',
        main: 'index.js',
      };

      const result = validateManifest(manifest);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject description exceeding max length', () => {
      const manifest = {
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        description: 'A'.repeat(1001),
        author: 'Test',
        main: 'index.js',
      };

      const result = validateManifest(manifest);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject too many keywords', () => {
      const manifest = {
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        description: 'Test',
        author: 'Test',
        main: 'index.js',
        keywords: Array.from({ length: 21 }, (_, i) => `keyword${i}`),
      };

      const result = validateManifest(manifest);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject duplicate permissions', () => {
      const manifest = {
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        description: 'Test',
        author: 'Test',
        main: 'index.js',
        permissions: ['query:read', 'query:read'],
      };

      const result = validateManifest(manifest);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });
});

describe('parseAndValidateManifest', () => {
  it('should parse and validate valid JSON', () => {
    const jsonString = JSON.stringify({
      id: 'com.example.plugin',
      name: 'Test Plugin',
      version: '1.0.0',
      description: 'A test plugin',
      author: 'Test',
      main: 'index.js',
    });

    const result = parseAndValidateManifest(jsonString);

    expect(result.valid).toBe(true);
    expect(result.manifest).toBeDefined();
    expect(result.manifest!.id).toBe('com.example.plugin');
  });

  it('should return error for invalid JSON', () => {
    const invalidJson = '{ invalid json }';

    const result = parseAndValidateManifest(invalidJson);

    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors![0].message).toContain(
      'Failed to parse manifest JSON'
    );
  });

  it('should return error for empty string', () => {
    const result = parseAndValidateManifest('');

    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should truncate long invalid JSON in error message', () => {
    const longInvalidJson = `{ invalid: ${'x'.repeat(200)}`;

    const result = parseAndValidateManifest(longInvalidJson);

    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors![0].value).toContain('...');
  });

  it('should validate parsed JSON against schema', () => {
    const jsonString = JSON.stringify({
      id: 'test',
      // missing required fields
    });

    const result = parseAndValidateManifest(jsonString);

    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(
      result.errors!.some((e) => e.message.includes('Missing required field'))
    ).toBe(true);
  });
});

describe('formatManifestErrors', () => {
  it('should format empty errors array', () => {
    const result = formatManifestErrors([]);

    expect(result).toBe('No validation errors');
  });

  it('should format single error', () => {
    const errors: ManifestValidationError[] = [
      { path: 'id', message: 'Invalid plugin ID' },
    ];

    const result = formatManifestErrors(errors);

    expect(result).toContain('1.');
    expect(result).toContain('Invalid plugin ID');
    expect(result).toContain('at id');
  });

  it('should format multiple errors', () => {
    const errors: ManifestValidationError[] = [
      { path: 'id', message: 'Invalid plugin ID' },
      { path: 'version', message: 'Invalid version' },
      { path: 'main', message: 'Invalid entry point' },
    ];

    const result = formatManifestErrors(errors);

    expect(result).toContain('1.');
    expect(result).toContain('2.');
    expect(result).toContain('3.');
  });

  it('should include expected value when provided', () => {
    const errors: ManifestValidationError[] = [
      {
        path: 'version',
        message: 'Invalid version format',
        expected: 'Semantic version (e.g., 1.0.0)',
      },
    ];

    const result = formatManifestErrors(errors);

    expect(result).toContain('Expected:');
    expect(result).toContain('Semantic version');
  });

  it('should handle root path errors', () => {
    const errors: ManifestValidationError[] = [
      { path: '/', message: 'Manifest must be an object' },
    ];

    const result = formatManifestErrors(errors);

    expect(result).toContain('Manifest must be an object');
    expect(result).not.toContain('at /');
  });
});

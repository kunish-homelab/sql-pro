import type { PluginManifest, PluginPermission } from '@/types/plugin';
import Ajv from 'ajv';

/**
 * Valid plugin permission values.
 */
const VALID_PERMISSIONS: PluginPermission[] = [
  'query:read',
  'query:write',
  'ui:menu',
  'ui:panel',
  'ui:command',
  'storage:read',
  'storage:write',
  'connection:info',
];

/**
 * JSON Schema definition for PluginManifest.
 * Validates all required and optional fields according to the plugin specification.
 */
const pluginManifestSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      minLength: 1,
      pattern: '^[a-zA-Z][a-zA-Z0-9._-]*$',
    },
    name: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
    },
    version: {
      type: 'string',
      pattern: '^\\d+\\.\\d+\\.\\d+(?:-[a-zA-Z0-9.]+)?(?:\\+[a-zA-Z0-9.]+)?$',
    },
    description: {
      type: 'string',
      minLength: 1,
      maxLength: 1000,
    },
    author: {
      type: 'string',
      minLength: 1,
      maxLength: 200,
    },
    main: {
      type: 'string',
      minLength: 1,
      pattern: '^[^/\\\\][^\\\\]*\\.js$',
    },
    permissions: {
      type: 'array',
      items: {
        type: 'string',
        enum: VALID_PERMISSIONS,
      },
      uniqueItems: true,
    },
    engines: {
      type: 'object',
      properties: {
        sqlpro: {
          type: 'string',
        },
      },
      additionalProperties: false,
    },
    homepage: {
      type: 'string',
      format: 'uri',
    },
    repository: {
      type: 'string',
    },
    license: {
      type: 'string',
    },
    keywords: {
      type: 'array',
      items: {
        type: 'string',
        minLength: 1,
        maxLength: 50,
      },
      maxItems: 20,
    },
    icon: {
      type: 'string',
    },
    screenshots: {
      type: 'array',
      items: {
        type: 'string',
      },
      maxItems: 10,
    },
    apiVersion: {
      type: 'string',
    },
  },
  required: ['id', 'name', 'version', 'description', 'author', 'main'],
  additionalProperties: false,
} as const;

/**
 * Result of manifest validation.
 */
export interface ManifestValidationResult {
  /** Whether the manifest is valid */
  valid: boolean;
  /** Validated manifest data (only present if valid) */
  manifest?: PluginManifest;
  /** Validation errors (only present if invalid) */
  errors?: ManifestValidationError[];
}

/**
 * Detailed validation error information.
 */
export interface ManifestValidationError {
  /** JSON path to the invalid field */
  path: string;
  /** Human-readable error message */
  message: string;
  /** The value that failed validation */
  value?: unknown;
  /** The expected value or format */
  expected?: string;
}

/**
 * Ajv error object interface for type safety.
 */
interface AjvError {
  instancePath?: string;
  schemaPath?: string;
  keyword: string;
  params: Record<string, unknown>;
  message?: string;
}

/**
 * Singleton Ajv instance for manifest validation.
 * Configured with strict mode and format validation.
 */
const ajv = new Ajv({
  allErrors: true,
  coerceTypes: false,
});

// Add format validation for 'uri'
ajv.addFormat('uri', {
  type: 'string',
  validate: (data: string) => {
    try {
      // URL constructor throws if invalid - we use it purely for validation
      void new URL(data);
      return true;
    } catch {
      return false;
    }
  },
});

/**
 * Compiled validation function for plugin manifests.
 */
const validateManifestSchema = ajv.compile(pluginManifestSchema);

/**
 * Format Ajv error objects into user-friendly validation errors.
 */
function formatValidationErrors(
  errors: AjvError[] | null | undefined,
  data: unknown
): ManifestValidationError[] {
  if (!errors) {
    return [];
  }

  return errors.map((error) => {
    const path = error.instancePath || '/';
    let message = error.message || 'Validation failed';
    let expected: string | undefined;
    let value: unknown;

    // Get the value at the error path
    if (error.instancePath && typeof data === 'object' && data !== null) {
      const pathParts = error.instancePath.split('/').filter(Boolean);
      let current: unknown = data;
      for (const part of pathParts) {
        if (
          typeof current === 'object' &&
          current !== null &&
          part in current
        ) {
          current = (current as Record<string, unknown>)[part];
        }
      }
      value = current;
    }

    // Enhance error messages based on keyword
    switch (error.keyword) {
      case 'required': {
        const missingProperty = error.params.missingProperty as string;
        message = `Missing required field: ${missingProperty}`;
        break;
      }
      case 'pattern': {
        const pattern = error.params.pattern as string;
        expected = `Pattern: ${pattern}`;
        if (path === '/id') {
          message =
            'Plugin ID must start with a letter and contain only letters, numbers, dots, hyphens, or underscores';
        } else if (path === '/version') {
          message = 'Version must follow semantic versioning (e.g., 1.0.0)';
        } else if (path === '/main') {
          message = 'Main entry point must be a .js file with a relative path';
        }
        break;
      }
      case 'minLength': {
        const limit = error.params.limit as number;
        message = `Value is too short (minimum ${limit} characters)`;
        expected = `Minimum length: ${limit}`;
        break;
      }
      case 'maxLength': {
        const limit = error.params.limit as number;
        message = `Value is too long (maximum ${limit} characters)`;
        expected = `Maximum length: ${limit}`;
        break;
      }
      case 'enum': {
        const allowedValues = error.params.allowedValues as string[];
        message = `Invalid value. Allowed values: ${allowedValues.join(', ')}`;
        expected = allowedValues.join(', ');
        break;
      }
      case 'type': {
        const expectedType = error.params.type as string;
        message = `Expected ${expectedType}`;
        expected = expectedType;
        break;
      }
      case 'format': {
        const format = error.params.format as string;
        if (format === 'uri') {
          message = 'Must be a valid URL';
          expected = 'Valid URL (e.g., https://example.com)';
        }
        break;
      }
      case 'additionalProperties': {
        const additionalProperty = error.params.additionalProperty as string;
        message = `Unknown property: ${additionalProperty}`;
        break;
      }
      case 'uniqueItems':
        message = 'Array must contain unique items';
        break;
      case 'maxItems': {
        const limit = error.params.limit as number;
        message = `Too many items (maximum ${limit})`;
        expected = `Maximum items: ${limit}`;
        break;
      }
    }

    return {
      path: path === '/' ? '/' : path.replace(/^\//, ''),
      message,
      value,
      expected,
    };
  });
}

/**
 * Validates a plugin manifest object against the schema.
 *
 * @param data - The data to validate as a plugin manifest
 * @returns Validation result with either the valid manifest or validation errors
 *
 * @example
 * ```typescript
 * const result = validateManifest({
 *   id: 'com.example.myplugin',
 *   name: 'My Plugin',
 *   version: '1.0.0',
 *   description: 'A sample plugin',
 *   author: 'Developer',
 *   main: 'index.js'
 * });
 *
 * if (result.valid) {
 *   console.log('Valid manifest:', result.manifest);
 * } else {
 *   console.error('Validation errors:', result.errors);
 * }
 * ```
 */
export function validateManifest(data: unknown): ManifestValidationResult {
  // First, check if data is an object
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return {
      valid: false,
      errors: [
        {
          path: '/',
          message: 'Manifest must be a JSON object',
          value: data,
          expected: 'object',
        },
      ],
    };
  }

  // Run schema validation
  const isValid = validateManifestSchema(data);

  if (isValid) {
    return {
      valid: true,
      manifest: data as PluginManifest,
    };
  }

  // Format validation errors
  const errors = formatValidationErrors(
    validateManifestSchema.errors as AjvError[] | null,
    data
  );

  return {
    valid: false,
    errors,
  };
}

/**
 * Parses and validates a JSON string as a plugin manifest.
 *
 * @param jsonString - JSON string to parse and validate
 * @returns Validation result or parse error
 *
 * @example
 * ```typescript
 * const jsonContent = fs.readFileSync('plugin.json', 'utf-8');
 * const result = parseAndValidateManifest(jsonContent);
 *
 * if (result.valid) {
 *   console.log('Plugin ID:', result.manifest.id);
 * }
 * ```
 */
export function parseAndValidateManifest(
  jsonString: string
): ManifestValidationResult {
  // Try to parse JSON
  let data: unknown;
  try {
    data = JSON.parse(jsonString);
  } catch (error) {
    const parseError =
      error instanceof SyntaxError ? error.message : 'Invalid JSON';
    return {
      valid: false,
      errors: [
        {
          path: '/',
          message: `Failed to parse manifest JSON: ${parseError}`,
          value:
            jsonString.substring(0, 100) +
            (jsonString.length > 100 ? '...' : ''),
          expected: 'Valid JSON',
        },
      ],
    };
  }

  return validateManifest(data);
}

/**
 * Formats validation errors into a human-readable string.
 *
 * @param errors - Array of validation errors
 * @returns Formatted error message
 */
export function formatManifestErrors(
  errors: ManifestValidationError[]
): string {
  if (errors.length === 0) {
    return 'No validation errors';
  }

  return errors
    .map((error, index) => {
      let line = `${index + 1}. ${error.message}`;
      if (error.path && error.path !== '/') {
        line += ` (at ${error.path})`;
      }
      if (error.expected) {
        line += ` - Expected: ${error.expected}`;
      }
      return line;
    })
    .join('\n');
}

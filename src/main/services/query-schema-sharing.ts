import { randomUUID } from 'node:crypto';
import { gzip, gunzip } from 'node:zlib';
import { promisify } from 'node:util';
import { z } from 'zod';
import type {
  ShareableQuery,
  ShareableSchema,
  ShareableBundle,
  ShareableMetadata,
  ShareableValidationResult,
  CompressionInfo,
} from '@shared/types';

/**
 * Query and Schema sharing service for exporting and importing queries,
 * schema definitions, and query bundles.
 *
 * This module provides functions to:
 * - Export queries with metadata and documentation
 * - Export schema definitions in JSON or SQL format
 * - Export bundles of multiple queries
 * - Import shared items with validation
 * - Automatically compress large exports (>100KB)
 *
 * FEATURES:
 * - Zod-based schema validation for imports
 * - Automatic compression for large exports
 * - Version compatibility checking
 * - Human-readable JSON exports with metadata
 */

// ============ Constants ============

/** Current export format version (semver) */
const EXPORT_SCHEMA_VERSION = '1.0.0';

/** Size threshold for automatic compression (100KB) */
const COMPRESSION_THRESHOLD = 100 * 1024;

/** Compression algorithm used */
const COMPRESSION_ALGORITHM = 'gzip';

// ============ Promisified zlib functions ============

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

// ============ Helper Functions ============

/**
 * Creates metadata for an export.
 */
function createMetadata(compressed = false): ShareableMetadata {
  return {
    version: EXPORT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: process.env.npm_package_version || '1.0.0',
    compressed,
  };
}

/**
 * Generates a unique ID for shareable items.
 */
function generateShareableId(): string {
  return randomUUID();
}

/**
 * Checks if data should be compressed based on size.
 */
function shouldCompress(data: string, forceCompress?: boolean): boolean {
  if (forceCompress === true) return true;
  if (forceCompress === false) return false;
  // Auto-compress if size exceeds threshold
  return Buffer.byteLength(data, 'utf8') >= COMPRESSION_THRESHOLD;
}

/**
 * Compresses data using gzip and returns compressed buffer with info.
 */
async function compressData(data: string): Promise<{
  compressed: Buffer;
  info: CompressionInfo;
}> {
  const originalSize = Buffer.byteLength(data, 'utf8');
  const compressed = await gzipAsync(data);
  const compressedSize = compressed.length;

  return {
    compressed,
    info: {
      compressed: true,
      algorithm: COMPRESSION_ALGORITHM,
      originalSize,
      compressedSize,
    },
  };
}

/**
 * Decompresses gzipped data.
 */
async function decompressData(data: Buffer | string): Promise<string> {
  const buffer = typeof data === 'string' ? Buffer.from(data, 'base64') : data;
  const decompressed = await gunzipAsync(buffer);
  return decompressed.toString('utf8');
}

/**
 * Detects if data is compressed by checking for gzip magic number.
 */
function isCompressed(data: string | Buffer): boolean {
  try {
    const buffer = typeof data === 'string' ? Buffer.from(data, 'base64') : data;
    // Gzip magic number: 0x1f 0x8b
    return buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
  } catch {
    return false;
  }
}

// ============ Zod Validation Schemas ============

/**
 * Zod schema for validating ShareableMetadata.
 */
const ShareableMetadataSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  exportedAt: z.string(),
  appVersion: z.string().optional(),
  author: z.string().optional(),
  compressed: z.boolean().optional(),
});

/**
 * Zod schema for validating ShareableQuery.
 */
const ShareableQuerySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  sql: z.string().min(1),
  databaseContext: z.string().optional(),
  databaseType: z.string().optional(),
  tags: z.array(z.string()).optional(),
  documentation: z.string().optional(),
  createdAt: z.string(),
  modifiedAt: z.string().optional(),
  author: z.string().optional(),
  metadata: ShareableMetadataSchema,
});

/**
 * Zod schema for validating SchemaExportOptions.
 */
const SchemaExportOptionsSchema = z.object({
  format: z.enum(['json', 'sql']),
  includeIndexes: z.boolean().optional(),
  includeTriggers: z.boolean().optional(),
  includeForeignKeys: z.boolean().optional(),
  tables: z.array(z.string()).optional(),
  includeCreateStatements: z.boolean().optional(),
  includeComments: z.boolean().optional(),
});

/**
 * Zod schema for validating ShareableSchema.
 */
const ShareableSchemaSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  databaseName: z.string().optional(),
  databaseType: z.string().optional(),
  format: z.enum(['json', 'sql']),
  schemas: z.array(z.any()).optional(), // SchemaInfo is complex, validate loosely
  sqlStatements: z.array(z.string()).optional(),
  options: SchemaExportOptionsSchema,
  documentation: z.string().optional(),
  createdAt: z.string(),
  author: z.string().optional(),
  metadata: ShareableMetadataSchema,
});

/**
 * Zod schema for validating bundle query items.
 */
const BundleQuerySchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  sql: z.string().min(1),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  order: z.number().optional(),
});

/**
 * Zod schema for validating ShareableBundle.
 */
const ShareableBundleSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  queries: z.array(BundleQuerySchema).min(1),
  databaseContext: z.string().optional(),
  databaseType: z.string().optional(),
  tags: z.array(z.string()).optional(),
  documentation: z.string().optional(),
  createdAt: z.string(),
  author: z.string().optional(),
  metadata: ShareableMetadataSchema,
});

// ============ Export Functions ============

/**
 * Exports a query with metadata to a shareable format.
 * Compression is handled by serializeShareableData function.
 *
 * Validates:
 * - Query name is non-empty and within 200 characters
 * - SQL is non-empty and contains valid characters
 * - Tags are properly formatted (if provided)
 * - Database context is valid (if provided)
 *
 * @param query - Query data (without id, metadata, or createdAt)
 * @returns ShareableQuery ready to be serialized
 * @throws Error if validation fails
 *
 * @example
 * ```typescript
 * const shareableQuery = await exportQuery({
 *   name: 'Find active users',
 *   sql: 'SELECT * FROM users WHERE active = 1',
 *   description: 'Returns all active users',
 *   tags: ['users', 'active'],
 *   databaseContext: 'production',
 *   documentation: 'Use this query to find all active users in the system'
 * });
 * ```
 */
export async function exportQuery(
  query: Omit<ShareableQuery, 'id' | 'metadata' | 'createdAt'>
): Promise<{ data: ShareableQuery; compressionInfo?: CompressionInfo }> {
  // Validate query name
  if (!query.name || query.name.trim().length === 0) {
    throw new Error('Query name cannot be empty');
  }
  if (query.name.length > 200) {
    throw new Error('Query name cannot exceed 200 characters');
  }

  // Validate SQL
  if (!query.sql || query.sql.trim().length === 0) {
    throw new Error('Query SQL cannot be empty');
  }

  // Basic SQL syntax check - ensure it contains valid SQL keywords
  // Strip SQL comments (-- and /* */) before checking
  const sqlWithoutComments = query.sql
    .replace(/--[^\n]*/g, '') // Remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
    .trim()
    .toUpperCase();

  if (sqlWithoutComments.length === 0) {
    throw new Error('Query SQL contains only comments');
  }

  const hasValidSQLKeyword =
    sqlWithoutComments.startsWith('SELECT') ||
    sqlWithoutComments.startsWith('INSERT') ||
    sqlWithoutComments.startsWith('UPDATE') ||
    sqlWithoutComments.startsWith('DELETE') ||
    sqlWithoutComments.startsWith('CREATE') ||
    sqlWithoutComments.startsWith('ALTER') ||
    sqlWithoutComments.startsWith('DROP') ||
    sqlWithoutComments.startsWith('WITH') ||
    sqlWithoutComments.startsWith('PRAGMA') ||
    sqlWithoutComments.startsWith('EXPLAIN');

  if (!hasValidSQLKeyword) {
    throw new Error(
      'Query SQL must start with a valid SQL keyword (SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, WITH, PRAGMA, or EXPLAIN)'
    );
  }

  // Validate tags (if provided)
  if (query.tags) {
    if (!Array.isArray(query.tags)) {
      throw new Error('Tags must be an array of strings');
    }
    for (const tag of query.tags) {
      if (typeof tag !== 'string' || tag.trim().length === 0) {
        throw new Error('Each tag must be a non-empty string');
      }
      if (tag.length > 50) {
        throw new Error('Tag cannot exceed 50 characters');
      }
    }
  }

  // Validate database context (if provided)
  if (query.databaseContext && query.databaseContext.length > 200) {
    throw new Error('Database context cannot exceed 200 characters');
  }

  // Validate description (if provided)
  if (query.description && query.description.length > 1000) {
    throw new Error('Description cannot exceed 1000 characters');
  }

  // Validate documentation (if provided)
  if (query.documentation && query.documentation.length > 10000) {
    throw new Error('Documentation cannot exceed 10000 characters');
  }

  // Create shareable query with generated fields
  const shareableQuery: ShareableQuery = {
    id: generateShareableId(),
    ...query,
    createdAt: new Date().toISOString(),
    // Set modifiedAt to createdAt if not provided
    modifiedAt: query.modifiedAt || new Date().toISOString(),
    metadata: createMetadata(false),
  };

  return { data: shareableQuery };
}

/**
 * Exports a schema with metadata to a shareable format.
 * Compression is handled by serializeShareableData function.
 *
 * Validates:
 * - Schema name is non-empty and within 200 characters
 * - At least one table/view is included in the export
 * - Format matches options (json requires schemas[], sql requires sqlStatements[])
 * - SQL statements are valid when format is 'sql'
 *
 * For SQL format, generates:
 * - CREATE TABLE statements with column definitions
 * - Comments explaining table purposes (from documentation)
 * - CREATE INDEX statements for indexes
 * - Foreign key relationships (inline with table definitions)
 * - CREATE TRIGGER statements for triggers
 *
 * @param schema - Schema data (without id, metadata, or createdAt)
 * @returns ShareableSchema ready to be serialized
 * @throws Error if validation fails
 *
 * @example
 * ```typescript
 * // JSON format export
 * const jsonSchema = await exportSchema({
 *   name: 'User Management Schema',
 *   format: 'json',
 *   schemas: [...],
 *   options: { format: 'json', includeIndexes: true }
 * });
 *
 * // SQL format export
 * const sqlSchema = await exportSchema({
 *   name: 'User Management Schema',
 *   format: 'sql',
 *   sqlStatements: [...],
 *   options: { format: 'sql', includeIndexes: true, includeTriggers: true }
 * });
 * ```
 */
export async function exportSchema(
  schema: Omit<ShareableSchema, 'id' | 'metadata' | 'createdAt'>
): Promise<{ data: ShareableSchema; compressionInfo?: CompressionInfo }> {
  // Validate schema name
  if (!schema.name || schema.name.trim().length === 0) {
    throw new Error('Schema name cannot be empty');
  }
  if (schema.name.length > 200) {
    throw new Error('Schema name cannot exceed 200 characters');
  }

  // Validate description (if provided)
  if (schema.description && schema.description.length > 1000) {
    throw new Error('Description cannot exceed 1000 characters');
  }

  // Validate documentation (if provided)
  if (schema.documentation && schema.documentation.length > 10000) {
    throw new Error('Documentation cannot exceed 10000 characters');
  }

  // Validate format matches data provided
  if (schema.format === 'json') {
    if (!schema.schemas || schema.schemas.length === 0) {
      throw new Error('JSON format requires at least one schema in schemas array');
    }
    // Validate at least one table or view exists
    const hasData = schema.schemas.some(
      (s) => (s.tables && s.tables.length > 0) || (s.views && s.views.length > 0)
    );
    if (!hasData) {
      throw new Error('Schema must contain at least one table or view');
    }
  } else if (schema.format === 'sql') {
    if (!schema.sqlStatements || schema.sqlStatements.length === 0) {
      throw new Error('SQL format requires at least one SQL statement');
    }
    // Validate SQL statements are non-empty
    for (let i = 0; i < schema.sqlStatements.length; i++) {
      const stmt = schema.sqlStatements[i];
      if (!stmt || stmt.trim().length === 0) {
        throw new Error(`SQL statement at index ${i} is empty`);
      }
    }
  }

  // Validate options match format
  if (schema.options.format !== schema.format) {
    throw new Error(
      `Format mismatch: schema.format is '${schema.format}' but options.format is '${schema.options.format}'`
    );
  }

  const shareableSchema: ShareableSchema = {
    id: generateShareableId(),
    ...schema,
    createdAt: new Date().toISOString(),
    metadata: createMetadata(false),
  };

  return { data: shareableSchema };
}

/**
 * Generates SQL statements from schema information.
 * Creates CREATE TABLE, CREATE INDEX, and CREATE TRIGGER statements.
 *
 * @param schemas - Array of schema information
 * @param options - Export options
 * @param documentation - Optional documentation to include as comments
 * @returns Array of SQL statements
 *
 * @example
 * ```typescript
 * const sqlStatements = generateSQLStatements(
 *   schemas,
 *   { format: 'sql', includeIndexes: true, includeTriggers: true },
 *   'User management schema exported on 2024-01-01'
 * );
 * ```
 */
export function generateSQLStatements(
  schemas: Array<{
    name: string;
    tables: Array<{
      name: string;
      sql: string;
      indexes?: Array<{ name: string; sql: string }>;
      triggers?: Array<{ name: string; sql: string }>;
    }>;
    views: Array<{
      name: string;
      sql: string;
    }>;
  }>,
  options: {
    includeIndexes?: boolean;
    includeTriggers?: boolean;
    includeComments?: boolean;
  },
  documentation?: string
): string[] {
  const statements: string[] = [];

  // Add documentation header if provided
  if (options.includeComments && documentation) {
    statements.push(
      '-- ============================================================',
      `-- ${documentation.split('\n').join('\n-- ')}`,
      '-- ============================================================',
      ''
    );
  }

  // Process each schema (database)
  for (const schema of schemas) {
    if (options.includeComments && schema.name !== 'main') {
      statements.push(
        `-- Schema: ${schema.name}`,
        '-- --------------------------------------------------------',
        ''
      );
    }

    // Process tables
    for (const table of schema.tables) {
      if (options.includeComments) {
        statements.push(
          `-- Table: ${table.name}`,
          '-- --------------------------------------------------------',
          ''
        );
      }

      // Add CREATE TABLE statement (already includes foreign keys inline)
      statements.push(table.sql + ';', '');

      // Add indexes if requested
      if (options.includeIndexes && table.indexes && table.indexes.length > 0) {
        if (options.includeComments) {
          statements.push(`-- Indexes for table: ${table.name}`, '');
        }
        for (const index of table.indexes) {
          statements.push(index.sql + ';', '');
        }
      }

      // Add triggers if requested
      if (options.includeTriggers && table.triggers && table.triggers.length > 0) {
        if (options.includeComments) {
          statements.push(`-- Triggers for table: ${table.name}`, '');
        }
        for (const trigger of table.triggers) {
          statements.push(trigger.sql + ';', '');
        }
      }
    }

    // Process views
    for (const view of schema.views) {
      if (options.includeComments) {
        statements.push(
          `-- View: ${view.name}`,
          '-- --------------------------------------------------------',
          ''
        );
      }
      statements.push(view.sql + ';', '');
    }
  }

  return statements;
}

/**
 * Exports a bundle of queries with metadata to a shareable format.
 * Compression is handled by serializeShareableData function.
 *
 * @param bundle - Bundle data (without id, metadata, or createdAt)
 * @returns ShareableBundle ready to be serialized
 *
 * @example
 * ```typescript
 * const shareableBundle = await exportBundle({
 *   name: 'User Management Queries',
 *   queries: [
 *     { id: '1', name: 'List users', sql: 'SELECT * FROM users' },
 *     { id: '2', name: 'Count users', sql: 'SELECT COUNT(*) FROM users' }
 *   ],
 *   tags: ['users', 'admin']
 * });
 * ```
 */
export async function exportBundle(
  bundle: Omit<ShareableBundle, 'id' | 'metadata' | 'createdAt'>
): Promise<{ data: ShareableBundle; compressionInfo?: CompressionInfo }> {
  const shareableBundle: ShareableBundle = {
    id: generateShareableId(),
    ...bundle,
    createdAt: new Date().toISOString(),
    metadata: createMetadata(false),
  };

  return { data: shareableBundle };
}

/**
 * Serializes shareable data to JSON string, optionally with compression.
 *
 * @param data - Shareable data (query, schema, or bundle)
 * @param compress - Whether to compress (auto-compresses if size > 100KB)
 * @param prettyPrint - Whether to format JSON with indentation (ignored if compressed)
 * @returns Serialized data (string or base64-encoded compressed buffer)
 */
export async function serializeShareableData(
  data: ShareableQuery | ShareableSchema | ShareableBundle,
  compress?: boolean,
  prettyPrint = true
): Promise<{ result: string; compressionInfo?: CompressionInfo }> {
  const jsonString = prettyPrint
    ? JSON.stringify(data, null, 2)
    : JSON.stringify(data);

  if (shouldCompress(jsonString, compress)) {
    // Update metadata to indicate compression
    const updatedData = {
      ...data,
      metadata: { ...data.metadata, compressed: true },
    };
    const compressedJson = prettyPrint
      ? JSON.stringify(updatedData, null, 2)
      : JSON.stringify(updatedData);
    const { compressed, info } = await compressData(compressedJson);
    return {
      result: compressed.toString('base64'),
      compressionInfo: info,
    };
  }

  return { result: jsonString };
}

// ============ Import Functions ============

/**
 * Parses and validates JSON import data, handling compression if present.
 *
 * @param jsonString - JSON string or base64-encoded compressed data
 * @param schema - Zod schema to validate against
 * @returns Parsed and validated data
 * @throws Error if data is invalid or doesn't match schema
 */
async function parseAndValidate<T>(
  jsonString: string,
  schema: z.ZodSchema<T>
): Promise<{ data: T; compressionInfo?: CompressionInfo }> {
  // Validate input is not empty
  if (!jsonString || jsonString.trim().length === 0) {
    throw new Error('Import data is empty');
  }

  let dataString = jsonString;
  let compressionInfo: CompressionInfo | undefined;

  // Check if data is compressed
  if (isCompressed(jsonString)) {
    try {
      dataString = await decompressData(jsonString);
      compressionInfo = {
        compressed: true,
        algorithm: COMPRESSION_ALGORITHM,
      };
    } catch (error) {
      throw new Error(
        `Failed to decompress data: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(dataString);
  } catch (error) {
    throw new Error(
      `Invalid JSON format: ${error instanceof Error ? error.message : String(error)}. Please ensure the file is a valid SQL Pro export file.`
    );
  }

  // Validate it's an object
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Import file must contain a valid JSON object');
  }

  // Validate schema
  const result = schema.safeParse(parsed);
  if (!result.success) {
    const errors = result.error.issues
      .map((err) => {
        const path = err.path.join('.');
        return `${path || 'root'}: ${err.message}`;
      })
      .join('; ');
    throw new Error(
      `Schema validation failed: ${errors}. The import file may be corrupted or from an incompatible version.`
    );
  }

  return { data: result.data, compressionInfo };
}

/**
 * Validates version compatibility between import data and current version.
 */
function validateVersionCompatibility(
  importVersion: string
): { compatible: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (!importVersion || !importVersion.match(/^\d+\.\d+\.\d+$/)) {
    return {
      compatible: false,
      warnings: [
        'Invalid or missing version in import file. Expected format: X.Y.Z (e.g., 1.0.0)',
      ],
    };
  }

  const [importMajor] = importVersion.split('.').map(Number);
  const [currentMajor] = EXPORT_SCHEMA_VERSION.split('.').map(Number);

  // Major version must match for compatibility
  if (importMajor !== currentMajor) {
    return {
      compatible: false,
      warnings: [
        `Incompatible version: import is v${importVersion}, current is v${EXPORT_SCHEMA_VERSION}. Major versions must match.`,
      ],
    };
  }

  // Minor/patch differences are acceptable but warn user
  if (importVersion !== EXPORT_SCHEMA_VERSION) {
    warnings.push(
      `Version mismatch: import is v${importVersion}, current is v${EXPORT_SCHEMA_VERSION}. Import should still work.`
    );
  }

  return { compatible: true, warnings };
}

/**
 * Validates dangerous SQL patterns that might pose security risks.
 * Returns warnings for potentially dangerous SQL operations.
 */
function validateSQLSafety(sql: string): string[] {
  const warnings: string[] = [];
  const upperSQL = sql.toUpperCase();

  // Check for potentially dangerous operations
  if (upperSQL.includes('DROP TABLE') || upperSQL.includes('DROP DATABASE')) {
    warnings.push(
      'Query contains DROP statement - use caution when executing'
    );
  }

  if (upperSQL.includes('DELETE FROM') && !upperSQL.includes('WHERE')) {
    warnings.push(
      'Query contains DELETE without WHERE clause - this will delete all rows'
    );
  }

  if (upperSQL.includes('UPDATE ') && !upperSQL.includes('WHERE')) {
    warnings.push(
      'Query contains UPDATE without WHERE clause - this will update all rows'
    );
  }

  if (upperSQL.includes('PRAGMA')) {
    warnings.push(
      'Query contains PRAGMA statement - ensure you understand the implications'
    );
  }

  return warnings;
}

/**
 * Validates the structure and content of a query for import.
 * Performs comprehensive field-level validation beyond basic schema checking.
 */
function validateQueryStructure(query: ShareableQuery): {
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate name
  if (!query.name || query.name.trim().length === 0) {
    errors.push('Query name is empty');
  } else if (query.name.length > 200) {
    warnings.push('Query name exceeds 200 characters and may be truncated');
  }

  // Validate SQL
  if (!query.sql || query.sql.trim().length === 0) {
    errors.push('Query SQL is empty');
  } else {
    // Check SQL safety
    warnings.push(...validateSQLSafety(query.sql));

    // Validate SQL has some basic structure (not just whitespace/comments)
    const sqlWithoutComments = query.sql
      .replace(/--[^\n]*/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .trim();

    if (sqlWithoutComments.length === 0) {
      errors.push('Query SQL contains only comments - no executable statements');
    }
  }

  // Validate tags (if present)
  if (query.tags && Array.isArray(query.tags)) {
    query.tags.forEach((tag, index) => {
      if (typeof tag !== 'string' || tag.trim().length === 0) {
        warnings.push(`Tag at index ${index} is empty or invalid - will be ignored`);
      } else if (tag.length > 50) {
        warnings.push(`Tag "${tag}" exceeds 50 characters and may be truncated`);
      }
    });
  }

  // Validate database context (if present)
  if (query.databaseContext && query.databaseContext.length > 200) {
    warnings.push('Database context exceeds 200 characters and may be truncated');
  }

  // Validate description (if present)
  if (query.description && query.description.length > 1000) {
    warnings.push('Description exceeds 1000 characters and may be truncated');
  }

  // Validate documentation (if present)
  if (query.documentation && query.documentation.length > 10000) {
    warnings.push('Documentation exceeds 10000 characters and may be truncated');
  }

  // Validate timestamps
  if (query.createdAt) {
    const createdDate = new Date(query.createdAt);
    if (isNaN(createdDate.getTime())) {
      warnings.push('Invalid createdAt timestamp format');
    }
  }

  if (query.modifiedAt) {
    const modifiedDate = new Date(query.modifiedAt);
    if (isNaN(modifiedDate.getTime())) {
      warnings.push('Invalid modifiedAt timestamp format');
    }
  }

  return { errors, warnings };
}

/**
 * Imports and validates a query from JSON data.
 *
 * Performs comprehensive validation including:
 * - JSON parsing and decompression (if compressed)
 * - Schema validation using Zod
 * - Version compatibility checking
 * - Field-level data structure validation
 * - SQL safety checks (dangerous patterns)
 * - Length and format validations for all fields
 *
 * @param jsonString - JSON string or compressed data
 * @returns Validated query and validation result
 *
 * @example
 * ```typescript
 * const result = await importQuery(jsonData);
 * if (result.validation.valid) {
 *   console.log('Imported query:', result.query.name);
 * } else {
 *   console.error('Validation errors:', result.validation.errors);
 * }
 * ```
 */
export async function importQuery(jsonString: string): Promise<{
  query: ShareableQuery;
  validation: ShareableValidationResult;
}> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const { data: query, compressionInfo } = await parseAndValidate(
      jsonString,
      ShareableQuerySchema
    );

    // Validate version compatibility
    const versionCheck = validateVersionCompatibility(query.metadata.version);
    if (!versionCheck.compatible) {
      errors.push(...versionCheck.warnings);
    } else {
      warnings.push(...versionCheck.warnings);
    }

    // Perform detailed structure validation
    const structureValidation = validateQueryStructure(query);
    errors.push(...structureValidation.errors);
    warnings.push(...structureValidation.warnings);

    const validation: ShareableValidationResult = {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      versionCompatible: versionCheck.compatible,
      compressionInfo,
    };

    return { query, validation };
  } catch (error) {
    const validation: ShareableValidationResult = {
      valid: false,
      errors: [
        error instanceof Error ? error.message : String(error),
        ...errors,
      ],
      warnings: warnings.length > 0 ? warnings : undefined,
      versionCompatible: false,
    };

    // Return empty query structure for failed imports
    throw new Error(
      `Failed to import query: ${validation.errors?.join('; ')}`
    );
  }
}

/**
 * Validates the structure and content of a schema for import.
 * Performs comprehensive field-level validation beyond basic schema checking.
 */
function validateSchemaStructure(schema: ShareableSchema): {
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate name
  if (!schema.name || schema.name.trim().length === 0) {
    errors.push('Schema name is empty');
  } else if (schema.name.length > 200) {
    warnings.push('Schema name exceeds 200 characters and may be truncated');
  }

  // Validate description (if present)
  if (schema.description && schema.description.length > 1000) {
    warnings.push('Description exceeds 1000 characters and may be truncated');
  }

  // Validate documentation (if present)
  if (schema.documentation && schema.documentation.length > 10000) {
    warnings.push('Documentation exceeds 10000 characters and may be truncated');
  }

  // Validate format-specific data
  if (schema.format === 'json') {
    if (!schema.schemas || schema.schemas.length === 0) {
      errors.push('JSON format schema must contain at least one schema definition');
    } else {
      // Validate each schema has tables or views
      const hasData = schema.schemas.some(
        (s) => (s.tables && s.tables.length > 0) || (s.views && s.views.length > 0)
      );
      if (!hasData) {
        errors.push('Schema must contain at least one table or view');
      }

      // Count total tables and views
      let totalTables = 0;
      let totalViews = 0;
      schema.schemas.forEach((s) => {
        if (s.tables) totalTables += s.tables.length;
        if (s.views) totalViews += s.views.length;
      });

      if (totalTables === 0 && totalViews === 0) {
        errors.push('Schema contains no tables or views to import');
      }
    }
  } else if (schema.format === 'sql') {
    if (!schema.sqlStatements || schema.sqlStatements.length === 0) {
      errors.push('SQL format schema must contain at least one SQL statement');
    } else {
      // Validate SQL statements are non-empty
      let emptyCount = 0;
      schema.sqlStatements.forEach((stmt, index) => {
        if (!stmt || stmt.trim().length === 0) {
          emptyCount++;
          warnings.push(`SQL statement at index ${index} is empty`);
        }
      });

      if (emptyCount === schema.sqlStatements.length) {
        errors.push('All SQL statements are empty');
      }
    }
  }

  // Validate options match format
  if (schema.options.format !== schema.format) {
    errors.push(
      `Format mismatch: schema.format is '${schema.format}' but options.format is '${schema.options.format}'`
    );
  }

  // Validate timestamp
  if (schema.createdAt) {
    const createdDate = new Date(schema.createdAt);
    if (isNaN(createdDate.getTime())) {
      warnings.push('Invalid createdAt timestamp format');
    }
  }

  return { errors, warnings };
}

/**
 * Imports and validates a schema from JSON data.
 *
 * Performs comprehensive validation including:
 * - JSON parsing and decompression (if compressed)
 * - Schema validation using Zod
 * - Version compatibility checking
 * - Field-level data structure validation
 * - Format-specific validations (JSON vs SQL)
 * - Data integrity checks (tables, views, statements)
 * - Length and format validations for all fields
 *
 * @param jsonString - JSON string or compressed data
 * @returns Validated schema and validation result
 *
 * @example
 * ```typescript
 * const result = await importSchema(jsonData);
 * if (result.validation.valid) {
 *   console.log('Imported schema:', result.schema.name);
 *   console.log('Format:', result.schema.format);
 * } else {
 *   console.error('Validation errors:', result.validation.errors);
 * }
 * ```
 */
export async function importSchema(jsonString: string): Promise<{
  schema: ShareableSchema;
  validation: ShareableValidationResult;
}> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const { data: schema, compressionInfo } = await parseAndValidate(
      jsonString,
      ShareableSchemaSchema
    );

    // Validate version compatibility
    const versionCheck = validateVersionCompatibility(schema.metadata.version);
    if (!versionCheck.compatible) {
      errors.push(...versionCheck.warnings);
    } else {
      warnings.push(...versionCheck.warnings);
    }

    // Perform detailed structure validation
    const structureValidation = validateSchemaStructure(schema);
    errors.push(...structureValidation.errors);
    warnings.push(...structureValidation.warnings);

    const validation: ShareableValidationResult = {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      versionCompatible: versionCheck.compatible,
      compressionInfo,
    };

    return { schema, validation };
  } catch (error) {
    const validation: ShareableValidationResult = {
      valid: false,
      errors: [
        error instanceof Error ? error.message : String(error),
        ...errors,
      ],
      warnings: warnings.length > 0 ? warnings : undefined,
      versionCompatible: false,
    };

    throw new Error(
      `Failed to import schema: ${validation.errors?.join('; ')}`
    );
  }
}

/**
 * Validates the structure and content of a bundle for import.
 * Performs comprehensive field-level validation beyond basic schema checking.
 */
function validateBundleStructure(bundle: ShareableBundle): {
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate name
  if (!bundle.name || bundle.name.trim().length === 0) {
    errors.push('Bundle name is empty');
  } else if (bundle.name.length > 200) {
    warnings.push('Bundle name exceeds 200 characters and may be truncated');
  }

  // Validate description (if present)
  if (bundle.description && bundle.description.length > 1000) {
    warnings.push('Description exceeds 1000 characters and may be truncated');
  }

  // Validate documentation (if present)
  if (bundle.documentation && bundle.documentation.length > 10000) {
    warnings.push('Documentation exceeds 10000 characters and may be truncated');
  }

  // Validate database context (if present)
  if (bundle.databaseContext && bundle.databaseContext.length > 200) {
    warnings.push('Database context exceeds 200 characters and may be truncated');
  }

  // Validate tags (if present)
  if (bundle.tags && Array.isArray(bundle.tags)) {
    bundle.tags.forEach((tag, index) => {
      if (typeof tag !== 'string' || tag.trim().length === 0) {
        warnings.push(`Bundle tag at index ${index} is empty or invalid - will be ignored`);
      } else if (tag.length > 50) {
        warnings.push(`Bundle tag "${tag}" exceeds 50 characters and may be truncated`);
      }
    });
  }

  // Validate bundle has queries
  if (!bundle.queries || bundle.queries.length === 0) {
    errors.push('Bundle contains no queries');
  } else {
    // Validate each query in the bundle
    bundle.queries.forEach((query, index) => {
      const queryNum = index + 1;
      const queryName = query.name || `Query ${queryNum}`;

      // Validate query name
      if (!query.name || query.name.trim().length === 0) {
        errors.push(`Query ${queryNum} has empty name`);
      } else if (query.name.length > 200) {
        warnings.push(`Query "${queryName}" name exceeds 200 characters and may be truncated`);
      }

      // Validate query SQL
      if (!query.sql || query.sql.trim().length === 0) {
        errors.push(`Query ${queryNum} (${queryName}) has empty SQL`);
      } else {
        // Check SQL safety for each query
        const sqlWarnings = validateSQLSafety(query.sql);
        sqlWarnings.forEach((warning) => {
          warnings.push(`Query ${queryNum} (${queryName}): ${warning}`);
        });

        // Validate SQL has executable statements
        const sqlWithoutComments = query.sql
          .replace(/--[^\n]*/g, '')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .trim();

        if (sqlWithoutComments.length === 0) {
          errors.push(`Query ${queryNum} (${queryName}) contains only comments - no executable statements`);
        }
      }

      // Validate query description (if present)
      if (query.description && query.description.length > 1000) {
        warnings.push(`Query ${queryNum} (${queryName}) description exceeds 1000 characters and may be truncated`);
      }

      // Validate query notes (if present)
      if (query.notes && query.notes.length > 5000) {
        warnings.push(`Query ${queryNum} (${queryName}) notes exceed 5000 characters and may be truncated`);
      }

      // Validate query tags (if present)
      if (query.tags && Array.isArray(query.tags)) {
        query.tags.forEach((tag, tagIndex) => {
          if (typeof tag !== 'string' || tag.trim().length === 0) {
            warnings.push(`Query ${queryNum} (${queryName}) tag at index ${tagIndex} is empty or invalid - will be ignored`);
          } else if (tag.length > 50) {
            warnings.push(`Query ${queryNum} (${queryName}) tag "${tag}" exceeds 50 characters and may be truncated`);
          }
        });
      }
    });
  }

  // Validate timestamp
  if (bundle.createdAt) {
    const createdDate = new Date(bundle.createdAt);
    if (isNaN(createdDate.getTime())) {
      warnings.push('Invalid createdAt timestamp format');
    }
  }

  return { errors, warnings };
}

/**
 * Imports and validates a bundle from JSON data.
 *
 * Performs comprehensive validation including:
 * - JSON parsing and decompression (if compressed)
 * - Schema validation using Zod
 * - Version compatibility checking
 * - Field-level data structure validation
 * - Individual query validation (name, SQL, safety)
 * - SQL safety checks for each query in the bundle
 * - Length and format validations for all fields
 *
 * @param jsonString - JSON string or compressed data
 * @returns Validated bundle and validation result
 *
 * @example
 * ```typescript
 * const result = await importBundle(jsonData);
 * if (result.validation.valid) {
 *   console.log('Imported bundle:', result.bundle.name);
 *   console.log('Queries:', result.bundle.queries.length);
 * } else {
 *   console.error('Validation errors:', result.validation.errors);
 * }
 * ```
 */
export async function importBundle(jsonString: string): Promise<{
  bundle: ShareableBundle;
  validation: ShareableValidationResult;
}> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const { data: bundle, compressionInfo } = await parseAndValidate(
      jsonString,
      ShareableBundleSchema
    );

    // Validate version compatibility
    const versionCheck = validateVersionCompatibility(bundle.metadata.version);
    if (!versionCheck.compatible) {
      errors.push(...versionCheck.warnings);
    } else {
      warnings.push(...versionCheck.warnings);
    }

    // Perform detailed structure validation
    const structureValidation = validateBundleStructure(bundle);
    errors.push(...structureValidation.errors);
    warnings.push(...structureValidation.warnings);

    const validation: ShareableValidationResult = {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      versionCompatible: versionCheck.compatible,
      compressionInfo,
    };

    return { bundle, validation };
  } catch (error) {
    const validation: ShareableValidationResult = {
      valid: false,
      errors: [
        error instanceof Error ? error.message : String(error),
        ...errors,
      ],
      warnings: warnings.length > 0 ? warnings : undefined,
      versionCompatible: false,
    };

    throw new Error(
      `Failed to import bundle: ${validation.errors?.join('; ')}`
    );
  }
}

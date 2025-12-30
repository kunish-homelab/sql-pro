/**
 * PluginLoader Service
 *
 * Responsible for loading and validating plugins from disk.
 * Handles reading plugin manifests, validating them, and loading plugin code.
 *
 * Following the service module pattern from database.ts
 */

import type { PluginInfo, PluginManifest } from '../../types/plugin';
import type { ManifestValidationResult } from '../../utils/plugins/validate-manifest';
import { Buffer } from 'node:buffer';
import { exec } from 'node:child_process';
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
} from 'node:fs';
import { rm } from 'node:fs/promises';
import { extname, join } from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { app } from 'electron';
import {
  formatManifestErrors,
  parseAndValidateManifest,
} from '../../utils/plugins/validate-manifest';

const execAsync = promisify(exec);

// ============ Constants ============

/** Maximum plugin bundle size in bytes (50MB) */
const MAX_PLUGIN_SIZE_BYTES = 50 * 1024 * 1024;

/** Plugin manifest filename */
const MANIFEST_FILENAME = 'plugin.json';

/** Plugin archive extension */
const PLUGIN_ARCHIVE_EXTENSION = '.sqlpro-plugin';

// ============ Types ============

/**
 * Result of loading a plugin from disk.
 */
export type LoadPluginResult =
  | {
      success: true;
      manifest: PluginManifest;
      pluginPath: string;
      entryPoint: string;
    }
  | {
      success: false;
      error: string;
      errorCode?: PluginLoaderErrorCode;
    };

/**
 * Result of extracting a plugin archive.
 */
export type ExtractPluginResult =
  | {
      success: true;
      extractedPath: string;
    }
  | {
      success: false;
      error: string;
      errorCode?: PluginLoaderErrorCode;
    };

/**
 * Result of validating a plugin directory.
 */
export type ValidatePluginResult =
  | {
      success: true;
      manifest: PluginManifest;
    }
  | {
      success: false;
      error: string;
      errorCode?: PluginLoaderErrorCode;
      validationErrors?: Array<{
        path: string;
        message: string;
      }>;
    };

/**
 * Plugin loader error codes for specific error handling.
 */
export type PluginLoaderErrorCode =
  | 'PLUGIN_NOT_FOUND'
  | 'MANIFEST_NOT_FOUND'
  | 'MANIFEST_INVALID'
  | 'MANIFEST_PARSE_ERROR'
  | 'ENTRY_POINT_NOT_FOUND'
  | 'PLUGIN_TOO_LARGE'
  | 'EXTRACTION_FAILED'
  | 'INCOMPATIBLE_VERSION'
  | 'INVALID_ARCHIVE'
  | 'IO_ERROR';

// ============ Helper Functions ============

/**
 * Get the plugins directory path.
 * Uses the user data directory from Electron.
 */
function getPluginsDirectory(): string {
  const userDataPath = app.getPath('userData');
  return join(userDataPath, 'plugins');
}

/**
 * Ensure the plugins directory exists.
 */
function ensurePluginsDirectory(): string {
  const pluginsDir = getPluginsDirectory();
  if (!existsSync(pluginsDir)) {
    mkdirSync(pluginsDir, { recursive: true });
  }
  return pluginsDir;
}

/**
 * Calculate the total size of a directory in bytes.
 */
function getDirectorySize(dirPath: string): number {
  let totalSize = 0;

  try {
    const entries = readdirSync(dirPath);

    for (const entry of entries) {
      const entryPath = join(dirPath, entry);
      const stats = statSync(entryPath);

      if (stats.isDirectory()) {
        totalSize += getDirectorySize(entryPath);
      } else {
        totalSize += stats.size;
      }
    }
  } catch {
    // Return 0 if we can't read the directory
    return 0;
  }

  return totalSize;
}

/**
 * Check if a version string satisfies a version range.
 * Simple implementation supporting ^, ~, and exact versions.
 */
function satisfiesVersion(version: string, range: string): boolean {
  // If no range specified, all versions are compatible
  if (!range) {
    return true;
  }

  // Extract numeric parts from version strings
  const parseVersion = (v: string): number[] => {
    const cleaned = v.replace(/^\D*/, '');
    return cleaned.split('.').map((n) => Number.parseInt(n, 10) || 0);
  };

  const [major, minor, patch] = parseVersion(version);
  const rangeClean = range.trim();

  if (rangeClean.startsWith('^')) {
    // Caret range: ^1.2.3 allows 1.x.x
    const [rMajor] = parseVersion(rangeClean.slice(1));
    return major === rMajor;
  }

  if (rangeClean.startsWith('~')) {
    // Tilde range: ~1.2.3 allows 1.2.x
    const [rMajor, rMinor] = parseVersion(rangeClean.slice(1));
    return major === rMajor && minor === rMinor;
  }

  if (rangeClean.startsWith('>=')) {
    const [rMajor, rMinor, rPatch] = parseVersion(rangeClean.slice(2));
    if (major > rMajor) return true;
    if (major === rMajor && minor > rMinor) return true;
    if (major === rMajor && minor === rMinor && patch >= rPatch) return true;
    return false;
  }

  // Exact version match
  const [rMajor, rMinor, rPatch] = parseVersion(rangeClean);
  return major === rMajor && minor === rMinor && patch === rPatch;
}

// ============ PluginLoader Class ============

/**
 * PluginLoader Service
 *
 * Handles loading and validating plugins from disk.
 * Follows the singleton service pattern from database.ts.
 */
class PluginLoader {
  private appVersion: string;

  constructor() {
    // Get app version for compatibility checking
    this.appVersion = app.getVersion();
  }

  /**
   * Get the plugins directory path.
   */
  getPluginsDirectory(): string {
    return getPluginsDirectory();
  }

  /**
   * Ensure the plugins directory exists and return its path.
   */
  ensurePluginsDirectory(): string {
    return ensurePluginsDirectory();
  }

  /**
   * Load a plugin from a directory path.
   *
   * @param pluginPath - Absolute path to the plugin directory
   * @returns Result containing manifest and entry point path, or error
   *
   * @example
   * ```typescript
   * const result = pluginLoader.loadFromDirectory('/path/to/plugin');
   * if (result.success) {
   *   console.log('Loaded plugin:', result.manifest.name);
   * } else {
   *   console.error('Failed to load:', result.error);
   * }
   * ```
   */
  loadFromDirectory(pluginPath: string): LoadPluginResult {
    // Check if the directory exists
    if (!existsSync(pluginPath)) {
      return {
        success: false,
        error: `Plugin directory not found: ${pluginPath}`,
        errorCode: 'PLUGIN_NOT_FOUND',
      };
    }

    // Check if it's actually a directory
    try {
      const stats = statSync(pluginPath);
      if (!stats.isDirectory()) {
        return {
          success: false,
          error: `Path is not a directory: ${pluginPath}`,
          errorCode: 'PLUGIN_NOT_FOUND',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to read plugin path: ${error instanceof Error ? error.message : String(error)}`,
        errorCode: 'IO_ERROR',
      };
    }

    // Check plugin size
    const pluginSize = getDirectorySize(pluginPath);
    if (pluginSize > MAX_PLUGIN_SIZE_BYTES) {
      return {
        success: false,
        error: `Plugin exceeds maximum size of ${MAX_PLUGIN_SIZE_BYTES / (1024 * 1024)}MB`,
        errorCode: 'PLUGIN_TOO_LARGE',
      };
    }

    // Validate the plugin directory and get manifest
    const validationResult = this.validatePlugin(pluginPath);
    if (!validationResult.success) {
      return {
        success: false,
        error: validationResult.error,
        errorCode: validationResult.errorCode,
      };
    }

    const { manifest } = validationResult;

    // Check version compatibility
    if (manifest.engines?.sqlpro) {
      if (!satisfiesVersion(this.appVersion, manifest.engines.sqlpro)) {
        return {
          success: false,
          error: `Plugin requires SQL Pro ${manifest.engines.sqlpro}, but current version is ${this.appVersion}`,
          errorCode: 'INCOMPATIBLE_VERSION',
        };
      }
    }

    // Verify entry point exists
    const entryPointPath = join(pluginPath, manifest.main);
    if (!existsSync(entryPointPath)) {
      return {
        success: false,
        error: `Plugin entry point not found: ${manifest.main}`,
        errorCode: 'ENTRY_POINT_NOT_FOUND',
      };
    }

    return {
      success: true,
      manifest,
      pluginPath,
      entryPoint: entryPointPath,
    };
  }

  /**
   * Validate a plugin directory without loading it.
   * Checks for manifest existence and validity.
   *
   * @param pluginPath - Path to the plugin directory
   * @returns Validation result with manifest or error details
   */
  validatePlugin(pluginPath: string): ValidatePluginResult {
    const manifestPath = join(pluginPath, MANIFEST_FILENAME);

    // Check if manifest exists
    if (!existsSync(manifestPath)) {
      return {
        success: false,
        error: `Plugin manifest not found: ${MANIFEST_FILENAME}`,
        errorCode: 'MANIFEST_NOT_FOUND',
      };
    }

    // Read and parse manifest
    let manifestContent: string;
    try {
      manifestContent = readFileSync(manifestPath, 'utf-8');
    } catch (error) {
      return {
        success: false,
        error: `Failed to read manifest: ${error instanceof Error ? error.message : String(error)}`,
        errorCode: 'IO_ERROR',
      };
    }

    // Validate manifest
    const validationResult: ManifestValidationResult =
      parseAndValidateManifest(manifestContent);

    if (!validationResult.valid) {
      const errorMessage = formatManifestErrors(validationResult.errors || []);
      return {
        success: false,
        error: `Invalid plugin manifest:\n${errorMessage}`,
        errorCode: 'MANIFEST_INVALID',
        validationErrors: validationResult.errors?.map((e) => ({
          path: e.path,
          message: e.message,
        })),
      };
    }

    return {
      success: true,
      manifest: validationResult.manifest!,
    };
  }

  /**
   * Extract a .sqlpro-plugin archive to the plugins directory.
   *
   * @param archivePath - Path to the .sqlpro-plugin archive file
   * @returns Result with extracted directory path or error
   *
   * @example
   * ```typescript
   * const result = await pluginLoader.extractArchive('/path/to/plugin.sqlpro-plugin');
   * if (result.success) {
   *   const loadResult = pluginLoader.loadFromDirectory(result.extractedPath);
   * }
   * ```
   */
  async extractArchive(archivePath: string): Promise<ExtractPluginResult> {
    // Verify archive exists
    if (!existsSync(archivePath)) {
      return {
        success: false,
        error: `Archive file not found: ${archivePath}`,
        errorCode: 'PLUGIN_NOT_FOUND',
      };
    }

    // Check file extension
    const ext = extname(archivePath).toLowerCase();
    if (ext !== PLUGIN_ARCHIVE_EXTENSION && ext !== '.zip') {
      return {
        success: false,
        error: `Invalid archive format. Expected ${PLUGIN_ARCHIVE_EXTENSION} or .zip`,
        errorCode: 'INVALID_ARCHIVE',
      };
    }

    // Check archive size
    try {
      const stats = statSync(archivePath);
      if (stats.size > MAX_PLUGIN_SIZE_BYTES) {
        return {
          success: false,
          error: `Plugin archive exceeds maximum size of ${MAX_PLUGIN_SIZE_BYTES / (1024 * 1024)}MB`,
          errorCode: 'PLUGIN_TOO_LARGE',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to read archive: ${error instanceof Error ? error.message : String(error)}`,
        errorCode: 'IO_ERROR',
      };
    }

    // Create a temporary extraction directory
    const pluginsDir = ensurePluginsDirectory();
    const tempDirName = `_extracting_${Date.now()}`;
    const tempExtractPath = join(pluginsDir, tempDirName);

    try {
      mkdirSync(tempExtractPath, { recursive: true });

      // Extract archive using unzip command (works on macOS and Linux)
      // On Windows, use PowerShell's Expand-Archive
      const isWindows = process.platform === 'win32';
      const unzipCommand = isWindows
        ? `powershell -Command "Expand-Archive -Path '${archivePath}' -DestinationPath '${tempExtractPath}' -Force"`
        : `unzip -o "${archivePath}" -d "${tempExtractPath}"`;

      await execAsync(unzipCommand);

      // Check if plugin.json is at root or in a subdirectory
      let pluginDir = tempExtractPath;
      const entries = readdirSync(tempExtractPath);

      // If there's only one directory, it might be the plugin root
      if (entries.length === 1) {
        const singleEntry = join(tempExtractPath, entries[0]);
        const entryStat = statSync(singleEntry);
        if (
          entryStat.isDirectory() &&
          existsSync(join(singleEntry, MANIFEST_FILENAME))
        ) {
          pluginDir = singleEntry;
        }
      }

      // Validate the extracted plugin
      const validationResult = this.validatePlugin(pluginDir);
      if (!validationResult.success) {
        // Clean up temp directory
        await rm(tempExtractPath, { recursive: true, force: true });
        return {
          success: false,
          error: validationResult.error,
          errorCode: validationResult.errorCode,
        };
      }

      const { manifest } = validationResult;

      // Move to final location using plugin ID
      const finalPath = join(pluginsDir, manifest.id);

      // Remove existing plugin directory if it exists
      if (existsSync(finalPath)) {
        await rm(finalPath, { recursive: true, force: true });
      }

      // Move from temp to final location
      const { rename } = await import('node:fs/promises');
      await rename(pluginDir, finalPath);

      // Clean up remaining temp directory if plugin was in subdirectory
      if (pluginDir !== tempExtractPath && existsSync(tempExtractPath)) {
        await rm(tempExtractPath, { recursive: true, force: true });
      }

      return {
        success: true,
        extractedPath: finalPath,
      };
    } catch (error) {
      // Clean up on error
      if (existsSync(tempExtractPath)) {
        try {
          await rm(tempExtractPath, { recursive: true, force: true });
        } catch {
          // Ignore cleanup errors
        }
      }

      return {
        success: false,
        error: `Failed to extract plugin archive: ${error instanceof Error ? error.message : String(error)}`,
        errorCode: 'EXTRACTION_FAILED',
      };
    }
  }

  /**
   * Load a plugin from various sources (directory, archive, or URL).
   *
   * @param source - Path or URL to the plugin
   * @param sourceType - Type of source ('directory', 'archive', or 'url')
   * @returns Result containing loaded plugin info or error
   */
  async loadPlugin(
    source: string,
    sourceType: 'directory' | 'archive' | 'url'
  ): Promise<LoadPluginResult> {
    switch (sourceType) {
      case 'directory':
        return this.loadFromDirectory(source);

      case 'archive': {
        const extractResult = await this.extractArchive(source);
        if (!extractResult.success) {
          return {
            success: false,
            error: extractResult.error,
            errorCode: extractResult.errorCode,
          };
        }
        return this.loadFromDirectory(extractResult.extractedPath);
      }

      case 'url': {
        // Download the archive first
        const downloadResult = await this.downloadPlugin(source);
        if (!downloadResult.success) {
          return {
            success: false,
            error: downloadResult.error,
            errorCode: downloadResult.errorCode,
          };
        }

        // Extract and load
        const extractResult = await this.extractArchive(
          downloadResult.downloadedPath
        );
        if (!extractResult.success) {
          // Clean up downloaded file
          try {
            await rm(downloadResult.downloadedPath, { force: true });
          } catch {
            // Ignore cleanup errors
          }
          return {
            success: false,
            error: extractResult.error,
            errorCode: extractResult.errorCode,
          };
        }

        // Clean up downloaded file after extraction
        try {
          await rm(downloadResult.downloadedPath, { force: true });
        } catch {
          // Ignore cleanup errors
        }

        return this.loadFromDirectory(extractResult.extractedPath);
      }

      default:
        return {
          success: false,
          error: `Unknown source type: ${sourceType}`,
          errorCode: 'IO_ERROR',
        };
    }
  }

  /**
   * Download a plugin from a URL.
   *
   * @param url - URL to download the plugin from
   * @returns Result with downloaded file path or error
   */
  private async downloadPlugin(
    url: string
  ): Promise<
    | { success: true; downloadedPath: string }
    | { success: false; error: string; errorCode: PluginLoaderErrorCode }
  > {
    try {
      const { net } = await import('electron');

      const pluginsDir = ensurePluginsDirectory();
      const downloadFileName = `_download_${Date.now()}${PLUGIN_ARCHIVE_EXTENSION}`;
      const downloadPath = join(pluginsDir, downloadFileName);

      return new Promise((resolve) => {
        const request = net.request(url);

        let totalBytes = 0;

        request.on('response', (response) => {
          if (response.statusCode !== 200) {
            resolve({
              success: false,
              error: `Failed to download plugin: HTTP ${response.statusCode}`,
              errorCode: 'IO_ERROR',
            });
            return;
          }

          const writeStream = createWriteStream(downloadPath);
          const chunks: Buffer[] = [];

          response.on('data', (chunk) => {
            totalBytes += chunk.length;

            // Check size limit during download
            if (totalBytes > MAX_PLUGIN_SIZE_BYTES) {
              writeStream.destroy();
              resolve({
                success: false,
                error: `Plugin download exceeds maximum size of ${MAX_PLUGIN_SIZE_BYTES / (1024 * 1024)}MB`,
                errorCode: 'PLUGIN_TOO_LARGE',
              });
              return;
            }

            chunks.push(chunk);
          });

          response.on('end', () => {
            // Write all chunks to file
            writeStream.write(Buffer.concat(chunks));
            writeStream.end();

            writeStream.on('finish', () => {
              resolve({
                success: true,
                downloadedPath: downloadPath,
              });
            });

            writeStream.on('error', (error) => {
              resolve({
                success: false,
                error: `Failed to write downloaded plugin: ${error.message}`,
                errorCode: 'IO_ERROR',
              });
            });
          });

          response.on('error', (error) => {
            writeStream.destroy();
            resolve({
              success: false,
              error: `Download failed: ${error.message}`,
              errorCode: 'IO_ERROR',
            });
          });
        });

        request.on('error', (error) => {
          resolve({
            success: false,
            error: `Failed to download plugin: ${error.message}`,
            errorCode: 'IO_ERROR',
          });
        });

        request.end();
      });
    } catch (error) {
      return {
        success: false,
        error: `Failed to download plugin: ${error instanceof Error ? error.message : String(error)}`,
        errorCode: 'IO_ERROR',
      };
    }
  }

  /**
   * Read the entry point code of a plugin.
   *
   * @param pluginPath - Path to the plugin directory
   * @param manifest - The plugin manifest
   * @returns The plugin code as a string, or null if not found
   */
  readPluginCode(pluginPath: string, manifest: PluginManifest): string | null {
    const entryPointPath = join(pluginPath, manifest.main);

    try {
      return readFileSync(entryPointPath, 'utf-8');
    } catch {
      return null;
    }
  }

  /**
   * List all installed plugins in the plugins directory.
   *
   * @returns Array of plugin info for successfully loaded plugins
   */
  listInstalledPlugins(): PluginInfo[] {
    const pluginsDir = getPluginsDirectory();

    if (!existsSync(pluginsDir)) {
      return [];
    }

    const plugins: PluginInfo[] = [];

    try {
      const entries = readdirSync(pluginsDir);

      for (const entry of entries) {
        // Skip temp directories
        if (entry.startsWith('_')) {
          continue;
        }

        const pluginPath = join(pluginsDir, entry);

        try {
          const stats = statSync(pluginPath);
          if (!stats.isDirectory()) {
            continue;
          }

          const loadResult = this.loadFromDirectory(pluginPath);
          if (loadResult.success) {
            plugins.push({
              manifest: loadResult.manifest,
              path: loadResult.pluginPath,
              state: 'installed',
              enabled: false, // Default, will be updated by PluginRegistry
              installedAt: stats.birthtime.toISOString(),
            });
          }
        } catch {
          // Skip invalid plugin directories
          continue;
        }
      }
    } catch {
      // Return empty array if we can't read the directory
      return [];
    }

    return plugins;
  }

  /**
   * Remove a plugin directory from disk.
   *
   * @param pluginId - The plugin ID to remove
   * @returns Success or error result
   */
  async removePlugin(
    pluginId: string
  ): Promise<{ success: true } | { success: false; error: string }> {
    const pluginsDir = getPluginsDirectory();
    const pluginPath = join(pluginsDir, pluginId);

    if (!existsSync(pluginPath)) {
      return {
        success: false,
        error: `Plugin not found: ${pluginId}`,
      };
    }

    try {
      await rm(pluginPath, { recursive: true, force: true });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to remove plugin: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}

// Export singleton instance following the service pattern
export const pluginLoader = new PluginLoader();

// Export class for testing purposes
export { PluginLoader };

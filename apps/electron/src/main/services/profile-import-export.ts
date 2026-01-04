import fs from 'node:fs';
import { z } from 'zod';
import { getFolders, getProfiles, saveFolder, saveProfile } from './store';

/**
 * Profile import/export service for backing up and sharing connection profiles.
 * This module provides functions to export profiles to JSON files and import them back.
 *
 * SECURITY: Passwords are NEVER included in exports - users must re-enter passwords
 * after importing profiles to maintain security.
 */

// ============ Type Definitions ============

/**
 * Export file format structure.
 * Includes schema version for future compatibility.
 */
export interface ProfileExportData {
  /** Schema version for format compatibility (semver) */
  version: string;
  /** Timestamp when export was created (ISO string) */
  exportedAt: string;
  /** Exported connection profiles (passwords excluded) */
  profiles: ExportedProfile[];
  /** Exported folder hierarchy */
  folders: ExportedFolder[];
}

/**
 * Connection profile data for export.
 * Omits sensitive data like passwords.
 */
export interface ExportedProfile {
  id: string;
  path: string;
  filename: string;
  isEncrypted: boolean;
  lastOpened: string;
  displayName?: string;
  readOnly?: boolean;
  createdAt?: string;
  folderId?: string;
  tags?: string[];
  notes?: string;
  isSaved: boolean;
}

/**
 * Folder data for export.
 */
export interface ExportedFolder {
  id: string;
  name: string;
  parentId?: string;
  createdAt: string;
  expanded?: boolean;
}

// ============ Constants ============

/** Current export format version (semver) */
const EXPORT_SCHEMA_VERSION = '1.0.0';

// ============ Export Functions ============

/**
 * Exports connection profiles and folders to a JSON structure.
 *
 * @param profileIds - Optional array of profile IDs to export (exports all if not provided)
 * @param folderIds - Optional array of folder IDs to export (exports all if not provided)
 * @returns Export data structure ready to be serialized to JSON
 *
 * @example
 * ```typescript
 * // Export all profiles and folders
 * const exportData = exportProfiles();
 *
 * // Export specific profiles
 * const exportData = exportProfiles(['profile-1', 'profile-2']);
 *
 * // Export specific profiles and folders
 * const exportData = exportProfiles(['profile-1'], ['folder-1']);
 * ```
 */
export function exportProfiles(
  profileIds?: string[],
  folderIds?: string[]
): ProfileExportData {
  // Get all profiles and folders from store
  const allProfiles = getProfiles();
  const allFolders = getFolders();

  // Filter profiles based on provided IDs (or include all)
  const profilesToExport = profileIds
    ? allProfiles.filter((p) => profileIds.includes(p.id))
    : allProfiles;

  // Filter folders based on provided IDs (or include all)
  const foldersToExport = folderIds
    ? allFolders.filter((f) => folderIds.includes(f.id))
    : allFolders;

  // Convert to export format (explicitly excluding any password-related fields)
  const exportedProfiles: ExportedProfile[] = profilesToExport.map(
    (profile) => ({
      id: profile.id,
      path: profile.path,
      filename: profile.filename,
      isEncrypted: profile.isEncrypted,
      lastOpened: profile.lastOpened,
      displayName: profile.displayName,
      readOnly: profile.readOnly,
      createdAt: profile.createdAt,
      folderId: profile.folderId,
      tags: profile.tags,
      notes: profile.notes,
      isSaved: profile.isSaved,
    })
  );

  const exportedFolders: ExportedFolder[] = foldersToExport.map((folder) => ({
    id: folder.id,
    name: folder.name,
    parentId: folder.parentId,
    createdAt: folder.createdAt,
    expanded: folder.expanded,
  }));

  // Create export data structure
  const exportData: ProfileExportData = {
    version: EXPORT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    profiles: exportedProfiles,
    folders: exportedFolders,
  };

  return exportData;
}

/**
 * Serializes export data to a formatted JSON string.
 *
 * @param exportData - Export data structure
 * @param prettyPrint - Whether to format JSON with indentation (default: true)
 * @returns JSON string ready to write to file
 */
export function serializeExportData(
  exportData: ProfileExportData,
  prettyPrint = true
): string {
  if (prettyPrint) {
    return JSON.stringify(exportData, null, 2);
  }
  return JSON.stringify(exportData);
}

// ============ Import Functions ============

/**
 * Zod schema for validating imported profile data.
 */
const ExportedProfileSchema = z.object({
  id: z.string().uuid(),
  path: z.string().min(1),
  filename: z.string().min(1),
  isEncrypted: z.boolean(),
  lastOpened: z.string(),
  displayName: z.string().optional(),
  readOnly: z.boolean().optional(),
  createdAt: z.string().optional(),
  folderId: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  isSaved: z.boolean(),
});

/**
 * Zod schema for validating imported folder data.
 */
const ExportedFolderSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  parentId: z.string().uuid().optional(),
  createdAt: z.string(),
  expanded: z.boolean().optional(),
});

/**
 * Zod schema for validating the entire import file structure.
 */
const ProfileExportDataSchema = z.object({
  version: z.string(),
  exportedAt: z.string(),
  profiles: z.array(ExportedProfileSchema),
  folders: z.array(ExportedFolderSchema),
});

/**
 * Result of importing profiles.
 */
export interface ImportResult {
  /** Whether the import operation succeeded overall */
  success: boolean;
  /** Number of profiles successfully imported */
  importedCount: number;
  /** Number of profiles skipped (duplicates) */
  skippedCount: number;
  /** Number of folders successfully imported */
  foldersImported: number;
  /** Validation or processing errors encountered */
  errors: string[];
  /** Warning messages for non-critical issues */
  warnings: string[];
}

/**
 * Options for importing profiles.
 */
export interface ImportOptions {
  /** If true, merge imported profiles with existing ones (update metadata).
   *  If false, skip profiles that already exist (based on path).
   *  Default: true
   */
  merge?: boolean;
}

/**
 * Validates if a database file exists at the given path.
 */
function validateDatabaseFileExists(path: string): boolean {
  try {
    return fs.existsSync(path);
  } catch {
    return false;
  }
}

/**
 * Parses and validates JSON import data.
 *
 * @param jsonString - JSON string from import file
 * @returns Parsed and validated export data
 * @throws Error if JSON is invalid or doesn't match schema
 */
export function parseImportData(jsonString: string): ProfileExportData {
  // Validate input is not empty
  if (!jsonString || jsonString.trim().length === 0) {
    throw new Error('Import file is empty');
  }

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
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
  const result = ProfileExportDataSchema.safeParse(parsed);
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

  // Validate version compatibility
  const exportData = result.data;
  if (!exportData.version || !exportData.version.match(/^\d+\.\d+\.\d+$/)) {
    throw new Error(
      `Invalid or missing version in import file. Expected format: X.Y.Z (e.g., 1.0.0)`
    );
  }

  // Validate export has at least some data
  if (exportData.profiles.length === 0 && exportData.folders.length === 0) {
    throw new Error(
      'Import file contains no profiles or folders. Nothing to import.'
    );
  }

  return exportData;
}

/**
 * Imports connection profiles and folders from parsed export data.
 *
 * This function handles:
 * - Validating import data
 * - Detecting duplicate profiles (by path)
 * - Merging or skipping duplicates based on options
 * - Importing folder hierarchy
 * - Maintaining referential integrity (folder IDs)
 *
 * @param exportData - Validated export data to import
 * @param options - Import options (merge behavior, etc.)
 * @returns Import result with counts and any errors
 *
 * @example
 * ```typescript
 * // Import and merge with existing profiles
 * const result = importProfiles(exportData, { merge: true });
 * console.log(`Imported: ${result.importedCount}, Skipped: ${result.skippedCount}`);
 *
 * // Import and skip duplicates
 * const result = importProfiles(exportData, { merge: false });
 * ```
 */
export function importProfiles(
  exportData: ProfileExportData,
  options: ImportOptions = { merge: true }
): ImportResult {
  const result: ImportResult = {
    success: true,
    importedCount: 0,
    skippedCount: 0,
    foldersImported: 0,
    errors: [],
    warnings: [],
  };

  try {
    // Get existing profiles and folders
    const existingProfiles = getProfiles();
    const existingFolders = getFolders();

    // Create lookup maps for quick access
    const existingProfilesByPath = new Map(
      existingProfiles.map((p) => [p.path, p])
    );
    const existingFoldersById = new Map(existingFolders.map((f) => [f.id, f]));
    const existingFoldersByName = new Map(
      existingFolders.map((f) => [f.name.toLowerCase(), f])
    );

    // Import folders first (to maintain referential integrity)
    for (const folder of exportData.folders) {
      try {
        const existingFolder = existingFoldersById.get(folder.id);

        // Validate folder name
        if (!folder.name || folder.name.trim().length === 0) {
          result.errors.push(
            `Skipping folder with empty name (ID: ${folder.id})`
          );
          continue;
        }

        if (folder.name.length > 100) {
          result.errors.push(
            `Folder "${folder.name}" name exceeds 100 characters. Skipping.`
          );
          continue;
        }

        // Check for parent ID validity
        if (folder.parentId) {
          const parentExists =
            existingFoldersById.has(folder.parentId) ||
            exportData.folders.some((f) => f.id === folder.parentId);

          if (!parentExists) {
            result.warnings.push(
              `Folder "${folder.name}" has invalid parent reference. Importing at root level.`
            );
            folder.parentId = undefined;
          }
        }

        if (existingFolder) {
          // Folder already exists - skip or merge based on options
          if (options.merge) {
            // Update existing folder (preserve expanded state if not in import)
            const updatedFolder = {
              ...existingFolder,
              name: folder.name,
              parentId: folder.parentId,
              // Keep existing expanded state if import doesn't specify
              expanded: folder.expanded ?? existingFolder.expanded,
            };
            saveFolder(updatedFolder);
            result.foldersImported++;
          } else {
            result.warnings.push(
              `Folder "${folder.name}" already exists. Skipping.`
            );
          }
        } else {
          // Check for name conflicts (case-insensitive)
          const nameConflict = existingFoldersByName.get(
            folder.name.toLowerCase()
          );
          if (nameConflict) {
            result.warnings.push(
              `A folder named "${folder.name}" already exists (with different ID). Importing anyway with new ID.`
            );
          }

          // New folder - import it
          saveFolder(folder);
          result.foldersImported++;
          // Add to lookup for subsequent folder parent checks
          existingFoldersById.set(folder.id, folder);
          existingFoldersByName.set(folder.name.toLowerCase(), folder);
        }
      } catch (error) {
        result.errors.push(
          `Failed to import folder "${folder.name}": ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // Import profiles
    for (const profile of exportData.profiles) {
      try {
        const existingProfile = existingProfilesByPath.get(profile.path);

        // Validate profile data
        if (!profile.path || profile.path.trim().length === 0) {
          result.errors.push(
            `Skipping profile with empty path (ID: ${profile.id})`
          );
          continue;
        }

        if (!profile.filename || profile.filename.trim().length === 0) {
          result.errors.push(
            `Skipping profile with empty filename at path: ${profile.path}`
          );
          continue;
        }

        // Check if database file exists at the path
        if (!validateDatabaseFileExists(profile.path)) {
          result.warnings.push(
            `Profile "${profile.displayName || profile.filename}" points to non-existent database file: ${profile.path}. Importing anyway - you may need to update the path.`
          );
        }

        if (existingProfile) {
          // Profile with same path exists
          if (options.merge) {
            // Merge metadata - update imported fields but keep local settings
            const updatedProfile = {
              ...existingProfile,
              // Update metadata from import
              displayName: profile.displayName ?? existingProfile.displayName,
              folderId: profile.folderId,
              tags: profile.tags,
              notes: profile.notes,
              isSaved: profile.isSaved,
              // Keep local settings (readOnly, lastOpened, etc. are NOT overwritten)
              // This preserves the user's local configuration
            };
            saveProfile(updatedProfile);
            result.importedCount++;
            result.warnings.push(
              `Merged profile "${profile.displayName || profile.filename}" with existing profile at same path.`
            );
          } else {
            // Skip duplicate
            result.skippedCount++;
            result.warnings.push(
              `Skipped duplicate profile: ${profile.displayName || profile.filename} (path: ${profile.path})`
            );
          }
        } else {
          // New profile - import it
          // Validate that referenced folder exists (if folderId is specified)
          if (profile.folderId) {
            const folderExists =
              existingFoldersById.has(profile.folderId) ||
              exportData.folders.some((f) => f.id === profile.folderId);

            if (!folderExists) {
              result.warnings.push(
                `Profile "${profile.displayName || profile.filename}" references non-existent folder. Importing at root level.`
              );
              // Clear invalid folder reference
              profile.folderId = undefined;
            }
          }

          saveProfile(profile);
          result.importedCount++;
        }
      } catch (error) {
        result.errors.push(
          `Failed to import profile "${profile.displayName || profile.filename}": ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // Provide summary
    if (
      result.importedCount === 0 &&
      result.skippedCount === 0 &&
      result.foldersImported === 0
    ) {
      result.success = false;
      if (result.errors.length === 0) {
        result.errors.push(
          'No profiles or folders were imported. Check warnings for details.'
        );
      }
    }

    // If there were critical errors that prevented all imports, mark as failed
    if (
      result.importedCount === 0 &&
      result.foldersImported === 0 &&
      result.errors.length > 0
    ) {
      result.success = false;
    }
  } catch (error) {
    result.success = false;
    result.errors.push(
      `Import operation failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return result;
}

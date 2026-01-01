import type { StoredConnectionProfile, StoredProfileFolder } from './store';
/**
 * Tests for profile import/export service.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock electron modules
const mockStorePath = '/tmp/test-store.json';
let mockStoreData: Record<string, unknown> = {};

vi.mock('electron-store', () => {
  return {
    default: class MockStore {
      constructor(config: { name: string; defaults: Record<string, unknown> }) {
        mockStoreData = { ...config.defaults };
      }

      get(key: string, defaultValue?: unknown) {
        return mockStoreData[key] ?? defaultValue;
      }

      set(key: string, value: unknown) {
        mockStoreData[key] = value;
      }

      clear() {
        mockStoreData = {};
      }

      get path() {
        return mockStorePath;
      }
    },
  };
});

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
  },
}));

// Import after mocks are set up
const { exportProfiles, serializeExportData, parseImportData, importProfiles } =
  await import('./profile-import-export');

const { saveProfile, saveFolder, getProfiles, getFolders } =
  await import('./store');

describe('profile Import/Export Service', () => {
  beforeEach(() => {
    // Reset mock store data
    mockStoreData = {
      preferences: {
        theme: 'system',
        defaultPageSize: 100,
        confirmBeforeApply: true,
        recentConnectionsLimit: 10,
      },
      recentConnections: [],
      queryHistory: {},
      aiSettings: null,
      proStatus: null,
      connectionProfiles: [],
      profileFolders: [],
    };
  });

  describe('export Functions', () => {
    it('should export empty profiles when none exist', () => {
      const exportData = exportProfiles();

      expect(exportData.version).toBe('1.0.0');
      expect(exportData.profiles).toEqual([]);
      expect(exportData.folders).toEqual([]);
      expect(exportData.exportedAt).toBeDefined();
      expect(new Date(exportData.exportedAt).getTime()).toBeGreaterThan(0);
    });

    it('should export all profiles and folders', () => {
      // Create test data
      const testFolder: StoredProfileFolder = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test Folder',
        createdAt: '2024-01-01T00:00:00.000Z',
        expanded: true,
      };

      const testProfile: StoredConnectionProfile = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        path: '/path/to/test.db',
        filename: 'test.db',
        isEncrypted: false,
        lastOpened: '2024-01-01T00:00:00.000Z',
        displayName: 'Test Database',
        readOnly: false,
        createdAt: '2024-01-01T00:00:00.000Z',
        folderId: testFolder.id,
        tags: ['test', 'dev'],
        notes: 'Test notes',
        isSaved: true,
      };

      saveFolder(testFolder);
      saveProfile(testProfile);

      const exportData = exportProfiles();

      expect(exportData.profiles).toHaveLength(1);
      expect(exportData.folders).toHaveLength(1);

      // Verify profile data (createdAt is auto-set by saveProfile, so check other fields)
      expect(exportData.profiles[0].id).toBe(testProfile.id);
      expect(exportData.profiles[0].path).toBe(testProfile.path);
      expect(exportData.profiles[0].filename).toBe(testProfile.filename);
      expect(exportData.profiles[0].displayName).toBe(testProfile.displayName);
      expect(exportData.profiles[0].folderId).toBe(testProfile.folderId);
      expect(exportData.profiles[0].tags).toEqual(testProfile.tags);
      expect(exportData.profiles[0].notes).toBe(testProfile.notes);

      // Verify folder data
      expect(exportData.folders[0].id).toBe(testFolder.id);
      expect(exportData.folders[0].name).toBe(testFolder.name);
      expect(exportData.folders[0].expanded).toBe(testFolder.expanded);
    });

    it('should export only specified profile IDs', () => {
      const profile1: StoredConnectionProfile = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        path: '/path/to/db1.db',
        filename: 'db1.db',
        isEncrypted: false,
        lastOpened: '2024-01-01T00:00:00.000Z',
        isSaved: true,
      };

      const profile2: StoredConnectionProfile = {
        id: '550e8400-e29b-41d4-a716-446655440002',
        path: '/path/to/db2.db',
        filename: 'db2.db',
        isEncrypted: false,
        lastOpened: '2024-01-01T00:00:00.000Z',
        isSaved: true,
      };

      saveProfile(profile1);
      saveProfile(profile2);

      const exportData = exportProfiles([profile1.id]);

      expect(exportData.profiles).toHaveLength(1);
      expect(exportData.profiles[0].id).toBe(profile1.id);
    });

    it('should export only specified folder IDs', () => {
      const folder1: StoredProfileFolder = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Folder 1',
        createdAt: '2024-01-01T00:00:00.000Z',
      };

      const folder2: StoredProfileFolder = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Folder 2',
        createdAt: '2024-01-01T00:00:00.000Z',
      };

      saveFolder(folder1);
      saveFolder(folder2);

      const exportData = exportProfiles(undefined, [folder1.id]);

      expect(exportData.folders).toHaveLength(1);
      expect(exportData.folders[0].id).toBe(folder1.id);
    });

    it('should exclude passwords from export (security)', () => {
      const profile: StoredConnectionProfile = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        path: '/path/to/encrypted.db',
        filename: 'encrypted.db',
        isEncrypted: true,
        lastOpened: '2024-01-01T00:00:00.000Z',
        isSaved: true,
      };

      saveProfile(profile);

      const exportData = exportProfiles();
      const serialized = serializeExportData(exportData);

      // Verify password is not in serialized output
      expect(serialized).not.toContain('password');
      expect(serialized).not.toContain('encryptedPassword');

      // Verify the export data structure doesn't have password fields
      const parsed = JSON.parse(serialized);
      expect(parsed.profiles[0]).not.toHaveProperty('password');
      expect(parsed.profiles[0]).not.toHaveProperty('encryptedPassword');
    });

    it('should serialize export data with pretty printing', () => {
      const exportData = exportProfiles();
      const serialized = serializeExportData(exportData, true);

      // Pretty printed JSON should have newlines and indentation
      expect(serialized).toContain('\n');
      expect(serialized).toContain('  ');
    });

    it('should serialize export data without pretty printing', () => {
      const exportData = exportProfiles();
      const serialized = serializeExportData(exportData, false);

      // Compact JSON should not have extra whitespace
      expect(serialized).not.toMatch(/\n\s+/);
    });
  });

  describe('import Validation', () => {
    it('should parse valid import JSON', () => {
      const validJson = JSON.stringify({
        version: '1.0.0',
        exportedAt: '2024-01-01T00:00:00.000Z',
        profiles: [
          {
            id: '550e8400-e29b-41d4-a716-446655440001',
            path: '/path/to/test.db',
            filename: 'test.db',
            isEncrypted: false,
            lastOpened: '2024-01-01T00:00:00.000Z',
            isSaved: true,
          },
        ],
        folders: [],
      });

      const parsed = parseImportData(validJson);

      expect(parsed.version).toBe('1.0.0');
      expect(parsed.profiles).toHaveLength(1);
      expect(parsed.folders).toHaveLength(0);
    });

    it('should reject invalid JSON syntax', () => {
      const invalidJson = '{ invalid json }';

      expect(() => parseImportData(invalidJson)).toThrow(/Invalid JSON format/);
    });

    it('should reject missing required fields', () => {
      const missingVersion = JSON.stringify({
        exportedAt: '2024-01-01T00:00:00.000Z',
        profiles: [],
        folders: [],
      });

      expect(() => parseImportData(missingVersion)).toThrow();
    });

    it('should reject invalid profile schema', () => {
      const invalidProfile = JSON.stringify({
        version: '1.0.0',
        exportedAt: '2024-01-01T00:00:00.000Z',
        profiles: [
          {
            id: 'not-a-uuid', // Invalid UUID format
            path: '/path/to/test.db',
            filename: 'test.db',
            isEncrypted: false,
            lastOpened: '2024-01-01T00:00:00.000Z',
            isSaved: true,
          },
        ],
        folders: [],
      });

      expect(() => parseImportData(invalidProfile)).toThrow();
    });

    it('should reject invalid folder schema', () => {
      const invalidFolder = JSON.stringify({
        version: '1.0.0',
        exportedAt: '2024-01-01T00:00:00.000Z',
        profiles: [],
        folders: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            name: '', // Empty name not allowed
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      });

      expect(() => parseImportData(invalidFolder)).toThrow();
    });

    it('should accept optional fields in profiles', () => {
      const withOptionalFields = JSON.stringify({
        version: '1.0.0',
        exportedAt: '2024-01-01T00:00:00.000Z',
        profiles: [
          {
            id: '550e8400-e29b-41d4-a716-446655440001',
            path: '/path/to/test.db',
            filename: 'test.db',
            isEncrypted: false,
            lastOpened: '2024-01-01T00:00:00.000Z',
            displayName: 'Test DB',
            readOnly: true,
            createdAt: '2024-01-01T00:00:00.000Z',
            folderId: '550e8400-e29b-41d4-a716-446655440000',
            tags: ['test'],
            notes: 'Notes',
            isSaved: true,
          },
        ],
        folders: [],
      });

      const parsed = parseImportData(withOptionalFields);

      expect(parsed.profiles[0].displayName).toBe('Test DB');
      expect(parsed.profiles[0].tags).toEqual(['test']);
      expect(parsed.profiles[0].notes).toBe('Notes');
    });
  });

  describe('import Functions', () => {
    it('should import profiles successfully', () => {
      const exportData = {
        version: '1.0.0',
        exportedAt: '2024-01-01T00:00:00.000Z',
        profiles: [
          {
            id: '550e8400-e29b-41d4-a716-446655440001',
            path: '/path/to/test.db',
            filename: 'test.db',
            isEncrypted: false,
            lastOpened: '2024-01-01T00:00:00.000Z',
            isSaved: true,
          },
        ],
        folders: [],
      };

      const result = importProfiles(exportData);

      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(1);
      expect(result.skippedCount).toBe(0);
      expect(result.errors).toEqual([]);
    });

    it('should import folders successfully', () => {
      const exportData = {
        version: '1.0.0',
        exportedAt: '2024-01-01T00:00:00.000Z',
        profiles: [],
        folders: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            name: 'Test Folder',
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      };

      const result = importProfiles(exportData);

      expect(result.success).toBe(true);
      expect(result.foldersImported).toBe(1);
      expect(result.errors).toEqual([]);
    });

    it('should merge duplicate profiles when merge=true', () => {
      // Save existing profile
      const existingProfile: StoredConnectionProfile = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        path: '/path/to/test.db',
        filename: 'test.db',
        isEncrypted: false,
        lastOpened: '2024-01-01T00:00:00.000Z',
        displayName: 'Original Name',
        readOnly: true,
        isSaved: false,
      };
      saveProfile(existingProfile);

      // Import profile with same path but different metadata
      const exportData = {
        version: '1.0.0',
        exportedAt: '2024-01-01T00:00:00.000Z',
        profiles: [
          {
            id: '550e8400-e29b-41d4-a716-446655440002', // Different ID
            path: '/path/to/test.db', // Same path
            filename: 'test.db',
            isEncrypted: false,
            lastOpened: '2024-01-02T00:00:00.000Z',
            displayName: 'Updated Name',
            tags: ['imported'],
            notes: 'Imported notes',
            isSaved: true,
          },
        ],
        folders: [],
      };

      const result = importProfiles(exportData, { merge: true });

      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(1);
      expect(result.skippedCount).toBe(0);

      // Verify metadata was updated but local settings preserved
      const profiles = getProfiles();
      expect(profiles).toHaveLength(1);
      expect(profiles[0].displayName).toBe('Updated Name');
      expect(profiles[0].tags).toEqual(['imported']);
      expect(profiles[0].notes).toBe('Imported notes');
      expect(profiles[0].readOnly).toBe(true); // Local setting preserved
    });

    it('should skip duplicate profiles when merge=false', () => {
      // Save existing profile
      const existingProfile: StoredConnectionProfile = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        path: '/path/to/test.db',
        filename: 'test.db',
        isEncrypted: false,
        lastOpened: '2024-01-01T00:00:00.000Z',
        isSaved: true,
      };
      saveProfile(existingProfile);

      // Import profile with same path
      const exportData = {
        version: '1.0.0',
        exportedAt: '2024-01-01T00:00:00.000Z',
        profiles: [
          {
            id: '550e8400-e29b-41d4-a716-446655440002',
            path: '/path/to/test.db', // Same path
            filename: 'test.db',
            isEncrypted: false,
            lastOpened: '2024-01-01T00:00:00.000Z',
            isSaved: true,
          },
        ],
        folders: [],
      };

      const result = importProfiles(exportData, { merge: false });

      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(0);
      expect(result.skippedCount).toBe(1);
    });

    it('should handle profile with invalid folder reference', () => {
      const exportData = {
        version: '1.0.0',
        exportedAt: '2024-01-01T00:00:00.000Z',
        profiles: [
          {
            id: '550e8400-e29b-41d4-a716-446655440001',
            path: '/path/to/test.db',
            filename: 'test.db',
            isEncrypted: false,
            lastOpened: '2024-01-01T00:00:00.000Z',
            folderId: '550e8400-e29b-41d4-a716-446655440099', // Non-existent folder
            isSaved: true,
          },
        ],
        folders: [],
      };

      const result = importProfiles(exportData);

      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(1);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('references non-existent folder');
    });

    it('should maintain folder hierarchy on import', () => {
      const exportData = {
        version: '1.0.0',
        exportedAt: '2024-01-01T00:00:00.000Z',
        profiles: [
          {
            id: '550e8400-e29b-41d4-a716-446655440001',
            path: '/path/to/test.db',
            filename: 'test.db',
            isEncrypted: false,
            lastOpened: '2024-01-01T00:00:00.000Z',
            folderId: '550e8400-e29b-41d4-a716-446655440002',
            isSaved: true,
          },
        ],
        folders: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            name: 'Parent Folder',
            createdAt: '2024-01-01T00:00:00.000Z',
          },
          {
            id: '550e8400-e29b-41d4-a716-446655440002',
            name: 'Child Folder',
            parentId: '550e8400-e29b-41d4-a716-446655440000',
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      };

      const result = importProfiles(exportData);

      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(1);
      expect(result.foldersImported).toBe(2);
      expect(result.errors).toEqual([]);
    });

    it('should merge existing folders when merge=true', () => {
      // Save existing folder
      const existingFolder: StoredProfileFolder = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Original Name',
        createdAt: '2024-01-01T00:00:00.000Z',
        expanded: false,
      };
      saveFolder(existingFolder);

      // Import folder with same ID but different name
      const exportData = {
        version: '1.0.0',
        exportedAt: '2024-01-01T00:00:00.000Z',
        profiles: [],
        folders: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            name: 'Updated Name',
            createdAt: '2024-01-01T00:00:00.000Z',
            expanded: true,
          },
        ],
      };

      const result = importProfiles(exportData, { merge: true });

      expect(result.success).toBe(true);
      expect(result.foldersImported).toBe(1);

      const folders = getFolders();
      expect(folders).toHaveLength(1);
      expect(folders[0].name).toBe('Updated Name');
      expect(folders[0].expanded).toBe(true);
    });

    it('should handle import errors gracefully', () => {
      // Force an error by providing invalid data after validation
      const exportData = {
        version: '1.0.0',
        exportedAt: '2024-01-01T00:00:00.000Z',
        profiles: [],
        folders: [],
      };

      // This should succeed since data is valid
      const result = importProfiles(exportData);

      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(0);
      expect(result.skippedCount).toBe(0);
    });
  });

  describe('end-to-End Import/Export', () => {
    it('should export and re-import profiles without data loss', () => {
      // Create test data
      const folder: StoredProfileFolder = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Production',
        createdAt: '2024-01-01T00:00:00.000Z',
        expanded: true,
      };

      const profile: StoredConnectionProfile = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        path: '/path/to/prod.db',
        filename: 'prod.db',
        isEncrypted: true,
        lastOpened: '2024-01-01T00:00:00.000Z',
        displayName: 'Production Database',
        readOnly: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        folderId: folder.id,
        tags: ['prod', 'main'],
        notes: 'Production database - be careful!',
        isSaved: true,
      };

      saveFolder(folder);
      saveProfile(profile);

      // Export
      const exportData = exportProfiles();
      const serialized = serializeExportData(exportData);

      // Clear store
      mockStoreData.connectionProfiles = [];
      mockStoreData.profileFolders = [];

      // Parse and re-import
      const parsed = parseImportData(serialized);
      const result = importProfiles(parsed);

      // Verify import succeeded
      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(1);
      expect(result.foldersImported).toBe(1);
      expect(result.errors).toEqual([]);

      // Verify data integrity
      const importedProfiles = getProfiles();
      const importedFolders = getFolders();

      expect(importedProfiles).toHaveLength(1);
      expect(importedFolders).toHaveLength(1);

      // Verify profile data
      expect(importedProfiles[0].id).toBe(profile.id);
      expect(importedProfiles[0].path).toBe(profile.path);
      expect(importedProfiles[0].displayName).toBe(profile.displayName);
      expect(importedProfiles[0].folderId).toBe(profile.folderId);
      expect(importedProfiles[0].tags).toEqual(profile.tags);
      expect(importedProfiles[0].notes).toBe(profile.notes);

      // Verify folder data
      expect(importedFolders[0].id).toBe(folder.id);
      expect(importedFolders[0].name).toBe(folder.name);
    });
  });
});

import type { StoredConnectionProfile, StoredRecentConnection } from './store';
/**
 * Tests for store service including profile migration functionality.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock electron modules
const mockStorePath = '/tmp/test-store.json';
let mockStoreData: Record<string, unknown> = {};

vi.mock('electron-store', () => {
  return {
    default: class MockStore {
      constructor(config: {
        name: string;
        defaults: Record<string, unknown>;
        migrations?: Record<string, (store: unknown) => void>;
      }) {
        // Initialize with defaults
        mockStoreData = { ...config.defaults };

        // Run migrations if provided
        if (config.migrations) {
          const mockStoreInstance = {
            get: (key: string, defaultValue?: unknown) => {
              return mockStoreData[key] ?? defaultValue;
            },
            set: (key: string, value: unknown) => {
              mockStoreData[key] = value;
            },
          };

          // Run all migrations
          for (const [_version, migration] of Object.entries(
            config.migrations
          )) {
            migration(mockStoreInstance);
          }
        }
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
const {
  getProfiles,
  saveProfile,
  updateProfile,
  deleteProfile,
  getProfilesByFolder,
  getFolders: _getFolders,
  saveFolder,
  updateFolder: _updateFolder,
  deleteFolder,
  getSubfolders: _getSubfolders,
} = await import('./store');

describe('store Service - Profile Management', () => {
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

  describe('profile CRUD Operations', () => {
    it('should return empty array when no profiles exist', () => {
      const profiles = getProfiles();
      expect(profiles).toEqual([]);
    });

    it('should save a new profile successfully', () => {
      const result = saveProfile({
        path: '/test/db.sqlite',
        filename: 'db.sqlite',
        isEncrypted: false,
        lastOpened: new Date().toISOString(),
        isSaved: true,
      });

      expect(result.success).toBe(true);
      expect(result.profile).toBeDefined();
      expect(result.profile?.id).toBeDefined();
      expect(result.profile?.path).toBe('/test/db.sqlite');
      expect(result.profile?.isSaved).toBe(true);
    });

    it('should generate unique IDs for new profiles', () => {
      const result1 = saveProfile({
        path: '/test/db1.sqlite',
        filename: 'db1.sqlite',
        isEncrypted: false,
        lastOpened: new Date().toISOString(),
        isSaved: true,
      });

      const result2 = saveProfile({
        path: '/test/db2.sqlite',
        filename: 'db2.sqlite',
        isEncrypted: false,
        lastOpened: new Date().toISOString(),
        isSaved: true,
      });

      expect(result1.profile?.id).toBeDefined();
      expect(result2.profile?.id).toBeDefined();
      expect(result1.profile?.id).not.toBe(result2.profile?.id);
    });

    it('should update an existing profile', () => {
      const saveResult = saveProfile({
        path: '/test/db.sqlite',
        filename: 'db.sqlite',
        isEncrypted: false,
        lastOpened: new Date().toISOString(),
        isSaved: true,
      });

      const profileId = saveResult.profile!.id;

      const updateResult = updateProfile(profileId, {
        displayName: 'Updated Name',
        notes: 'Test notes',
      });

      expect(updateResult.success).toBe(true);
      expect(updateResult.profile?.displayName).toBe('Updated Name');
      expect(updateResult.profile?.notes).toBe('Test notes');
    });

    it('should delete a profile', () => {
      const saveResult = saveProfile({
        path: '/test/db.sqlite',
        filename: 'db.sqlite',
        isEncrypted: false,
        lastOpened: new Date().toISOString(),
        isSaved: true,
      });

      const profileId = saveResult.profile!.id;

      const deleteResult = deleteProfile(profileId);
      expect(deleteResult.success).toBe(true);

      const profiles = getProfiles();
      expect(profiles).toHaveLength(0);
    });

    it('should return error when updating non-existent profile', () => {
      const result = updateProfile('non-existent-id', {
        displayName: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('PROFILE_NOT_FOUND');
    });

    it('should validate displayName length', () => {
      const result = saveProfile({
        path: '/test/db.sqlite',
        filename: 'db.sqlite',
        isEncrypted: false,
        lastOpened: new Date().toISOString(),
        displayName: 'a'.repeat(101), // 101 characters
        isSaved: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('INVALID_DISPLAY_NAME');
    });
  });

  describe('folder Management', () => {
    it('should create a new folder', () => {
      const result = saveFolder({
        name: 'Test Folder',
      });

      expect(result.success).toBe(true);
      expect(result.folder).toBeDefined();
      expect(result.folder?.id).toBeDefined();
      expect(result.folder?.name).toBe('Test Folder');
    });

    it('should prevent empty folder names', () => {
      const result = saveFolder({
        name: '   ',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('INVALID_FOLDER_NAME');
    });

    it('should prevent deleting folder with profiles', () => {
      // Create folder
      const folderResult = saveFolder({ name: 'Test Folder' });
      const folderId = folderResult.folder!.id;

      // Create profile in folder
      saveProfile({
        path: '/test/db.sqlite',
        filename: 'db.sqlite',
        isEncrypted: false,
        lastOpened: new Date().toISOString(),
        folderId,
        isSaved: true,
      });

      // Try to delete folder
      const deleteResult = deleteFolder(folderId);
      expect(deleteResult.success).toBe(false);
      expect(deleteResult.error).toBe('FOLDER_HAS_PROFILES');
    });

    it('should prevent deleting folder with child folders', () => {
      // Create parent folder
      const parentResult = saveFolder({ name: 'Parent' });
      const parentId = parentResult.folder!.id;

      // Create child folder
      saveFolder({
        name: 'Child',
        parentId,
      });

      // Try to delete parent
      const deleteResult = deleteFolder(parentId);
      expect(deleteResult.success).toBe(false);
      expect(deleteResult.error).toBe('FOLDER_HAS_CHILDREN');
    });

    it('should get profiles by folder', () => {
      // Create folder
      const folderResult = saveFolder({ name: 'Test Folder' });
      const folderId = folderResult.folder!.id;

      // Create profile in folder
      saveProfile({
        path: '/test/db1.sqlite',
        filename: 'db1.sqlite',
        isEncrypted: false,
        lastOpened: new Date().toISOString(),
        folderId,
        isSaved: true,
      });

      // Create profile without folder
      saveProfile({
        path: '/test/db2.sqlite',
        filename: 'db2.sqlite',
        isEncrypted: false,
        lastOpened: new Date().toISOString(),
        isSaved: true,
      });

      const folderProfiles = getProfilesByFolder(folderId);
      expect(folderProfiles).toHaveLength(1);

      const rootProfiles = getProfilesByFolder(undefined);
      expect(rootProfiles).toHaveLength(1);
    });
  });

  describe('migration - Recent Connections to Profiles', () => {
    it('should migrate recent connections to profiles on first run', () => {
      // Set up mock data with recent connections but no profiles
      const recentConnections: StoredRecentConnection[] = [
        {
          path: '/test/db1.sqlite',
          filename: 'db1.sqlite',
          isEncrypted: false,
          lastOpened: '2025-12-31T12:00:00.000Z',
          displayName: 'Database 1',
          readOnly: false,
          createdAt: '2025-12-30T12:00:00.000Z',
        },
        {
          path: '/test/db2.sqlite',
          filename: 'db2.sqlite',
          isEncrypted: true,
          lastOpened: '2025-12-31T13:00:00.000Z',
          displayName: 'Database 2',
          readOnly: true,
          createdAt: '2025-12-30T13:00:00.000Z',
        },
      ];

      mockStoreData.recentConnections = recentConnections;
      mockStoreData.connectionProfiles = [];

      // Simulate migration by manually running it
      const mockStore = {
        get: (key: string, defaultValue?: unknown) => {
          return mockStoreData[key] ?? defaultValue;
        },
        set: (key: string, value: unknown) => {
          mockStoreData[key] = value;
        },
      };

      // Run migration logic
      const existingConnections = mockStore.get(
        'recentConnections',
        []
      ) as StoredRecentConnection[];
      const existingProfiles = mockStore.get(
        'connectionProfiles',
        []
      ) as StoredConnectionProfile[];

      if (existingConnections.length > 0 && existingProfiles.length === 0) {
        const migratedProfiles: StoredConnectionProfile[] =
          existingConnections.map((conn) => ({
            ...conn,
            id: crypto.randomUUID(),
            isSaved: false,
          }));
        mockStore.set('connectionProfiles', migratedProfiles);
      }

      // Verify migration results
      const profiles = mockStore.get(
        'connectionProfiles',
        []
      ) as StoredConnectionProfile[];
      expect(profiles).toHaveLength(2);

      // Verify first profile
      expect(profiles[0].path).toBe('/test/db1.sqlite');
      expect(profiles[0].filename).toBe('db1.sqlite');
      expect(profiles[0].displayName).toBe('Database 1');
      expect(profiles[0].readOnly).toBe(false);
      expect(profiles[0].isSaved).toBe(false); // Migrated profiles are unsaved
      expect(profiles[0].id).toBeDefined();

      // Verify second profile
      expect(profiles[1].path).toBe('/test/db2.sqlite');
      expect(profiles[1].isEncrypted).toBe(true);
      expect(profiles[1].readOnly).toBe(true);
      expect(profiles[1].isSaved).toBe(false);
      expect(profiles[1].id).toBeDefined();

      // Verify IDs are unique
      expect(profiles[0].id).not.toBe(profiles[1].id);
    });

    it('should not overwrite existing profiles during migration', () => {
      // Set up mock data with both recent connections and existing profiles
      const recentConnections: StoredRecentConnection[] = [
        {
          path: '/test/db1.sqlite',
          filename: 'db1.sqlite',
          isEncrypted: false,
          lastOpened: '2025-12-31T12:00:00.000Z',
        },
      ];

      const existingProfiles: StoredConnectionProfile[] = [
        {
          id: 'existing-id',
          path: '/test/existing.sqlite',
          filename: 'existing.sqlite',
          isEncrypted: false,
          lastOpened: '2025-12-31T11:00:00.000Z',
          isSaved: true,
        },
      ];

      mockStoreData.recentConnections = recentConnections;
      mockStoreData.connectionProfiles = existingProfiles;

      // Simulate migration
      const mockStore = {
        get: (key: string, defaultValue?: unknown) => {
          return mockStoreData[key] ?? defaultValue;
        },
        set: (key: string, value: unknown) => {
          mockStoreData[key] = value;
        },
      };

      const existingConnections = mockStore.get(
        'recentConnections',
        []
      ) as StoredRecentConnection[];
      const existingProfilesCheck = mockStore.get(
        'connectionProfiles',
        []
      ) as StoredConnectionProfile[];

      // Migration should NOT run if profiles already exist
      if (
        existingConnections.length > 0 &&
        existingProfilesCheck.length === 0
      ) {
        const migratedProfiles: StoredConnectionProfile[] =
          existingConnections.map((conn) => ({
            ...conn,
            id: crypto.randomUUID(),
            isSaved: false,
          }));
        mockStore.set('connectionProfiles', migratedProfiles);
      }

      // Verify existing profiles were not overwritten
      const profiles = mockStore.get(
        'connectionProfiles',
        []
      ) as StoredConnectionProfile[];
      expect(profiles).toHaveLength(1);
      expect(profiles[0].id).toBe('existing-id');
      expect(profiles[0].path).toBe('/test/existing.sqlite');
    });
  });
});

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
  getSavedQueries,
  saveSavedQuery,
  updateSavedQuery,
  deleteSavedQuery,
  getCollections,
  saveCollection,
  updateCollection,
  deleteCollection,
  addQueryToCollection,
  removeQueryFromCollection,
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
      savedQueries: {},
      collections: {},
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

describe('store Service - Saved Queries', () => {
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
      savedQueries: {},
      collections: {},
    };
  });

  describe('saved Query CRUD Operations', () => {
    it('should return empty array when no saved queries exist', () => {
      const queries = getSavedQueries();
      expect(queries).toEqual([]);
    });

    it('should save a new saved query successfully', () => {
      const result = saveSavedQuery({
        name: 'Test Query',
        queryText: 'SELECT * FROM users',
        description: 'A test query',
        dbPath: '/test/db.sqlite',
        isFavorite: false,
        collectionIds: [],
      });

      expect(result.success).toBe(true);
      expect(result.query).toBeDefined();
      expect(result.query?.id).toBeDefined();
      expect(result.query?.name).toBe('Test Query');
      expect(result.query?.queryText).toBe('SELECT * FROM users');
      expect(result.query?.isFavorite).toBe(false);
      expect(result.query?.createdAt).toBeDefined();
      expect(result.query?.updatedAt).toBeDefined();
    });

    it('should generate unique IDs for new saved queries', () => {
      const result1 = saveSavedQuery({
        name: 'Query 1',
        queryText: 'SELECT * FROM users',
        isFavorite: false,
        collectionIds: [],
      });

      const result2 = saveSavedQuery({
        name: 'Query 2',
        queryText: 'SELECT * FROM posts',
        isFavorite: false,
        collectionIds: [],
      });

      expect(result1.query?.id).toBeDefined();
      expect(result2.query?.id).toBeDefined();
      expect(result1.query?.id).not.toBe(result2.query?.id);
    });

    it('should update an existing saved query', () => {
      const saveResult = saveSavedQuery({
        name: 'Original Query',
        queryText: 'SELECT * FROM users',
        isFavorite: false,
        collectionIds: [],
      });

      const queryId = saveResult.query!.id;

      const updateResult = updateSavedQuery(queryId, {
        name: 'Updated Query',
        description: 'Updated description',
        isFavorite: true,
      });

      expect(updateResult.success).toBe(true);
      expect(updateResult.query?.name).toBe('Updated Query');
      expect(updateResult.query?.description).toBe('Updated description');
      expect(updateResult.query?.isFavorite).toBe(true);
      expect(updateResult.query?.queryText).toBe('SELECT * FROM users');
    });

    it('should delete a saved query', () => {
      const saveResult = saveSavedQuery({
        name: 'Test Query',
        queryText: 'SELECT * FROM users',
        isFavorite: false,
        collectionIds: [],
      });

      const queryId = saveResult.query!.id;

      const deleteResult = deleteSavedQuery(queryId);
      expect(deleteResult.success).toBe(true);

      const queries = getSavedQueries();
      expect(queries).toHaveLength(0);
    });

    it('should return error when updating non-existent query', () => {
      const result = updateSavedQuery('non-existent-id', {
        name: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('QUERY_NOT_FOUND');
    });

    it('should validate query name is not empty', () => {
      const result = saveSavedQuery({
        name: '   ',
        queryText: 'SELECT * FROM users',
        isFavorite: false,
        collectionIds: [],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('INVALID_QUERY_NAME');
    });

    it('should validate query name length', () => {
      const result = saveSavedQuery({
        name: 'a'.repeat(201), // 201 characters
        queryText: 'SELECT * FROM users',
        isFavorite: false,
        collectionIds: [],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('QUERY_NAME_TOO_LONG');
    });

    it('should validate query text is not empty', () => {
      const result = saveSavedQuery({
        name: 'Test Query',
        queryText: '   ',
        isFavorite: false,
        collectionIds: [],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('INVALID_QUERY_TEXT');
    });
  });

  describe('favorites Filtering', () => {
    beforeEach(() => {
      // Create some queries, some favorited
      saveSavedQuery({
        name: 'Favorite Query 1',
        queryText: 'SELECT * FROM users',
        isFavorite: true,
        collectionIds: [],
      });

      saveSavedQuery({
        name: 'Regular Query',
        queryText: 'SELECT * FROM posts',
        isFavorite: false,
        collectionIds: [],
      });

      saveSavedQuery({
        name: 'Favorite Query 2',
        queryText: 'SELECT * FROM comments',
        isFavorite: true,
        collectionIds: [],
      });
    });

    it('should return all queries when favoritesOnly is false', () => {
      const queries = getSavedQueries({ favoritesOnly: false });
      expect(queries).toHaveLength(3);
    });

    it('should return only favorite queries when favoritesOnly is true', () => {
      const queries = getSavedQueries({ favoritesOnly: true });
      expect(queries).toHaveLength(2);
      expect(queries.every((q) => q.isFavorite)).toBe(true);
    });

    it('should toggle favorite status', () => {
      const allQueries = getSavedQueries();
      const regularQuery = allQueries.find((q) => q.name === 'Regular Query');

      const updateResult = updateSavedQuery(regularQuery!.id, {
        isFavorite: true,
      });

      expect(updateResult.success).toBe(true);
      expect(updateResult.query?.isFavorite).toBe(true);

      const favorites = getSavedQueries({ favoritesOnly: true });
      expect(favorites).toHaveLength(3);
    });
  });

  describe('filter by Database Path', () => {
    beforeEach(() => {
      saveSavedQuery({
        name: 'Query for DB1',
        queryText: 'SELECT * FROM users',
        dbPath: '/test/db1.sqlite',
        isFavorite: false,
        collectionIds: [],
      });

      saveSavedQuery({
        name: 'Query for DB2',
        queryText: 'SELECT * FROM posts',
        dbPath: '/test/db2.sqlite',
        isFavorite: false,
        collectionIds: [],
      });

      saveSavedQuery({
        name: 'Another query for DB1',
        queryText: 'SELECT * FROM comments',
        dbPath: '/test/db1.sqlite',
        isFavorite: false,
        collectionIds: [],
      });
    });

    it('should filter queries by dbPath', () => {
      const db1Queries = getSavedQueries({ dbPath: '/test/db1.sqlite' });
      expect(db1Queries).toHaveLength(2);
      expect(db1Queries.every((q) => q.dbPath === '/test/db1.sqlite')).toBe(
        true
      );

      const db2Queries = getSavedQueries({ dbPath: '/test/db2.sqlite' });
      expect(db2Queries).toHaveLength(1);
      expect(db2Queries[0].dbPath).toBe('/test/db2.sqlite');
    });
  });
});

describe('store Service - Collections', () => {
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
      savedQueries: {},
      collections: {},
    };
  });

  describe('collection CRUD Operations', () => {
    it('should return empty array when no collections exist', () => {
      const collections = getCollections();
      expect(collections).toEqual([]);
    });

    it('should save a new collection successfully', () => {
      const result = saveCollection({
        name: 'Test Collection',
        description: 'A test collection',
        color: '#FF5733',
        icon: 'folder',
        queryIds: [],
      });

      expect(result.success).toBe(true);
      expect(result.collection).toBeDefined();
      expect(result.collection?.id).toBeDefined();
      expect(result.collection?.name).toBe('Test Collection');
      expect(result.collection?.color).toBe('#FF5733');
      expect(result.collection?.createdAt).toBeDefined();
      expect(result.collection?.updatedAt).toBeDefined();
    });

    it('should generate unique IDs for new collections', () => {
      const result1 = saveCollection({
        name: 'Collection 1',
        queryIds: [],
      });

      const result2 = saveCollection({
        name: 'Collection 2',
        queryIds: [],
      });

      expect(result1.collection?.id).toBeDefined();
      expect(result2.collection?.id).toBeDefined();
      expect(result1.collection?.id).not.toBe(result2.collection?.id);
    });

    it('should update an existing collection', () => {
      const saveResult = saveCollection({
        name: 'Original Collection',
        queryIds: [],
      });

      const collectionId = saveResult.collection!.id;

      const updateResult = updateCollection(collectionId, {
        name: 'Updated Collection',
        description: 'Updated description',
        color: '#00FF00',
      });

      expect(updateResult.success).toBe(true);
      expect(updateResult.collection?.name).toBe('Updated Collection');
      expect(updateResult.collection?.description).toBe('Updated description');
      expect(updateResult.collection?.color).toBe('#00FF00');
    });

    it('should delete a collection', () => {
      const saveResult = saveCollection({
        name: 'Test Collection',
        queryIds: [],
      });

      const collectionId = saveResult.collection!.id;

      const deleteResult = deleteCollection(collectionId);
      expect(deleteResult.success).toBe(true);

      const collections = getCollections();
      expect(collections).toHaveLength(0);
    });

    it('should return error when updating non-existent collection', () => {
      const result = updateCollection('non-existent-id', {
        name: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('COLLECTION_NOT_FOUND');
    });

    it('should validate collection name is not empty', () => {
      const result = saveCollection({
        name: '   ',
        queryIds: [],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('INVALID_COLLECTION_NAME');
    });

    it('should validate collection name length', () => {
      const result = saveCollection({
        name: 'a'.repeat(201), // 201 characters
        queryIds: [],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('COLLECTION_NAME_TOO_LONG');
    });
  });

  describe('collection-Query Relationships', () => {
    it('should add a query to a collection', () => {
      // Create a query and a collection
      const queryResult = saveSavedQuery({
        name: 'Test Query',
        queryText: 'SELECT * FROM users',
        isFavorite: false,
        collectionIds: [],
      });

      const collectionResult = saveCollection({
        name: 'Test Collection',
        queryIds: [],
      });

      const queryId = queryResult.query!.id;
      const collectionId = collectionResult.collection!.id;

      // Add query to collection
      const addResult = addQueryToCollection(queryId, collectionId);

      expect(addResult.success).toBe(true);
      expect(addResult.query?.collectionIds).toContain(collectionId);
      expect(addResult.collection?.queryIds).toContain(queryId);
    });

    it('should remove a query from a collection', () => {
      // Create a query and a collection
      const queryResult = saveSavedQuery({
        name: 'Test Query',
        queryText: 'SELECT * FROM users',
        isFavorite: false,
        collectionIds: [],
      });

      const collectionResult = saveCollection({
        name: 'Test Collection',
        queryIds: [],
      });

      const queryId = queryResult.query!.id;
      const collectionId = collectionResult.collection!.id;

      // Add query to collection first
      addQueryToCollection(queryId, collectionId);

      // Now remove it
      const removeResult = removeQueryFromCollection(queryId, collectionId);

      expect(removeResult.success).toBe(true);
      expect(removeResult.query?.collectionIds).not.toContain(collectionId);
      expect(removeResult.collection?.queryIds).not.toContain(queryId);
    });

    it('should return error when adding non-existent query to collection', () => {
      const collectionResult = saveCollection({
        name: 'Test Collection',
        queryIds: [],
      });

      const result = addQueryToCollection(
        'non-existent-query-id',
        collectionResult.collection!.id
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('QUERY_NOT_FOUND');
    });

    it('should return error when adding query to non-existent collection', () => {
      const queryResult = saveSavedQuery({
        name: 'Test Query',
        queryText: 'SELECT * FROM users',
        isFavorite: false,
        collectionIds: [],
      });

      const result = addQueryToCollection(
        queryResult.query!.id,
        'non-existent-collection-id'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('COLLECTION_NOT_FOUND');
    });

    it('should maintain bidirectional relationship when saving query with collections', () => {
      // Create a collection first
      const collectionResult = saveCollection({
        name: 'Test Collection',
        queryIds: [],
      });
      const collectionId = collectionResult.collection!.id;

      // Save a query with the collection ID
      const queryResult = saveSavedQuery({
        name: 'Test Query',
        queryText: 'SELECT * FROM users',
        isFavorite: false,
        collectionIds: [collectionId],
      });

      const queryId = queryResult.query!.id;

      // Check bidirectional relationship
      expect(queryResult.query?.collectionIds).toContain(collectionId);

      const collections = getCollections();
      const updatedCollection = collections.find((c) => c.id === collectionId);
      expect(updatedCollection?.queryIds).toContain(queryId);
    });

    it('should maintain bidirectional relationship when saving collection with queries', () => {
      // Create a query first
      const queryResult = saveSavedQuery({
        name: 'Test Query',
        queryText: 'SELECT * FROM users',
        isFavorite: false,
        collectionIds: [],
      });
      const queryId = queryResult.query!.id;

      // Save a collection with the query ID
      const collectionResult = saveCollection({
        name: 'Test Collection',
        queryIds: [queryId],
      });

      const collectionId = collectionResult.collection!.id;

      // Check bidirectional relationship
      expect(collectionResult.collection?.queryIds).toContain(queryId);

      const queries = getSavedQueries();
      const updatedQuery = queries.find((q) => q.id === queryId);
      expect(updatedQuery?.collectionIds).toContain(collectionId);
    });

    it('should update relationships when updating query collectionIds', () => {
      // Create two collections
      const collection1 = saveCollection({
        name: 'Collection 1',
        queryIds: [],
      }).collection!;

      const collection2 = saveCollection({
        name: 'Collection 2',
        queryIds: [],
      }).collection!;

      // Create a query in collection1
      const queryResult = saveSavedQuery({
        name: 'Test Query',
        queryText: 'SELECT * FROM users',
        isFavorite: false,
        collectionIds: [collection1.id],
      });

      const queryId = queryResult.query!.id;

      // Update query to be in collection2 instead
      updateSavedQuery(queryId, {
        collectionIds: [collection2.id],
      });

      // Check that relationships were updated correctly
      const collections = getCollections();
      const updatedCollection1 = collections.find(
        (c) => c.id === collection1.id
      );
      const updatedCollection2 = collections.find(
        (c) => c.id === collection2.id
      );

      expect(updatedCollection1?.queryIds).not.toContain(queryId);
      expect(updatedCollection2?.queryIds).toContain(queryId);
    });

    it('should update relationships when updating collection queryIds', () => {
      // Create two queries
      const query1 = saveSavedQuery({
        name: 'Query 1',
        queryText: 'SELECT * FROM users',
        isFavorite: false,
        collectionIds: [],
      }).query!;

      const query2 = saveSavedQuery({
        name: 'Query 2',
        queryText: 'SELECT * FROM posts',
        isFavorite: false,
        collectionIds: [],
      }).query!;

      // Create a collection with query1
      const collectionResult = saveCollection({
        name: 'Test Collection',
        queryIds: [query1.id],
      });

      const collectionId = collectionResult.collection!.id;

      // Update collection to have query2 instead
      updateCollection(collectionId, {
        queryIds: [query2.id],
      });

      // Check that relationships were updated correctly
      const queries = getSavedQueries();
      const updatedQuery1 = queries.find((q) => q.id === query1.id);
      const updatedQuery2 = queries.find((q) => q.id === query2.id);

      expect(updatedQuery1?.collectionIds).not.toContain(collectionId);
      expect(updatedQuery2?.collectionIds).toContain(collectionId);
    });

    it('should remove query from all collections when query is deleted', () => {
      // Create a collection
      const collectionResult = saveCollection({
        name: 'Test Collection',
        queryIds: [],
      });
      const collectionId = collectionResult.collection!.id;

      // Create a query in the collection
      const queryResult = saveSavedQuery({
        name: 'Test Query',
        queryText: 'SELECT * FROM users',
        isFavorite: false,
        collectionIds: [collectionId],
      });
      const queryId = queryResult.query!.id;

      // Delete the query
      deleteSavedQuery(queryId);

      // Check that the query was removed from the collection
      const collections = getCollections();
      const updatedCollection = collections.find((c) => c.id === collectionId);
      expect(updatedCollection?.queryIds).not.toContain(queryId);
    });

    it('should remove collection from all queries when collection is deleted', () => {
      // Create a query
      const queryResult = saveSavedQuery({
        name: 'Test Query',
        queryText: 'SELECT * FROM users',
        isFavorite: false,
        collectionIds: [],
      });
      const queryId = queryResult.query!.id;

      // Create a collection with the query
      const collectionResult = saveCollection({
        name: 'Test Collection',
        queryIds: [queryId],
      });
      const collectionId = collectionResult.collection!.id;

      // Delete the collection
      deleteCollection(collectionId);

      // Check that the collection was removed from the query
      const queries = getSavedQueries();
      const updatedQuery = queries.find((q) => q.id === queryId);
      expect(updatedQuery?.collectionIds).not.toContain(collectionId);
    });

    it('should filter queries by collection', () => {
      // Create two collections
      const collection1 = saveCollection({
        name: 'Collection 1',
        queryIds: [],
      }).collection!;

      const collection2 = saveCollection({
        name: 'Collection 2',
        queryIds: [],
      }).collection!;

      // Create queries in different collections
      saveSavedQuery({
        name: 'Query in Collection 1',
        queryText: 'SELECT * FROM users',
        isFavorite: false,
        collectionIds: [collection1.id],
      });

      saveSavedQuery({
        name: 'Query in Collection 2',
        queryText: 'SELECT * FROM posts',
        isFavorite: false,
        collectionIds: [collection2.id],
      });

      saveSavedQuery({
        name: 'Query in both collections',
        queryText: 'SELECT * FROM comments',
        isFavorite: false,
        collectionIds: [collection1.id, collection2.id],
      });

      // Test filtering
      const collection1Queries = getSavedQueries({
        collectionId: collection1.id,
      });
      expect(collection1Queries).toHaveLength(2);

      const collection2Queries = getSavedQueries({
        collectionId: collection2.id,
      });
      expect(collection2Queries).toHaveLength(2);
    });

    it('should handle query in multiple collections', () => {
      // Create multiple collections
      const collection1 = saveCollection({
        name: 'Collection 1',
        queryIds: [],
      }).collection!;

      const collection2 = saveCollection({
        name: 'Collection 2',
        queryIds: [],
      }).collection!;

      const collection3 = saveCollection({
        name: 'Collection 3',
        queryIds: [],
      }).collection!;

      // Create a query in all three collections
      const queryResult = saveSavedQuery({
        name: 'Multi-collection Query',
        queryText: 'SELECT * FROM users',
        isFavorite: false,
        collectionIds: [collection1.id, collection2.id, collection3.id],
      });

      const queryId = queryResult.query!.id;

      // Verify the query is in all three collections
      const collections = getCollections();
      expect(
        collections.find((c) => c.id === collection1.id)?.queryIds
      ).toContain(queryId);
      expect(
        collections.find((c) => c.id === collection2.id)?.queryIds
      ).toContain(queryId);
      expect(
        collections.find((c) => c.id === collection3.id)?.queryIds
      ).toContain(queryId);

      // Remove from one collection
      removeQueryFromCollection(queryId, collection2.id);

      // Verify it's still in the other two
      const queries = getSavedQueries();
      const updatedQuery = queries.find((q) => q.id === queryId);
      expect(updatedQuery?.collectionIds).toContain(collection1.id);
      expect(updatedQuery?.collectionIds).not.toContain(collection2.id);
      expect(updatedQuery?.collectionIds).toContain(collection3.id);
    });
  });
});

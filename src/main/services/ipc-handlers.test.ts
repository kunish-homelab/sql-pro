/**
 * IPC Handlers Integration Tests
 *
 * End-to-end tests for saved query and collection IPC handlers.
 * These tests verify the integration between IPC layer and store layer.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IpcMainInvokeEvent } from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// ============ Mock electron modules ============

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

// Create handlers map in hoisted scope so it's shared
const { mockHandlers } = vi.hoisted(() => {
  const mockHandlers = new Map<string, (...args: unknown[]) => unknown>();
  return { mockHandlers };
});

vi.mock('electron', () => {
  return {
    app: {
      isPackaged: false,
      getPath: () => '/tmp',
      getVersion: () => '1.0.0',
      getName: () => 'test-app',
    },
    ipcMain: {
      handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
        mockHandlers.set(channel, handler);
      },
      removeHandler: (channel: string) => {
        mockHandlers.delete(channel);
      },
      // Expose handlers for testing
      _getHandlers: () => mockHandlers,
    },
    BrowserWindow: {
      getAllWindows: () => [],
    },
  };
});

vi.mock('electron-updater', () => ({
  autoUpdater: {
    logger: null,
    checkForUpdates: vi.fn(),
    on: vi.fn(),
  },
}));

// ============ Import after mocks ============

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@shared/types';

// Import the store functions to reset state
const {
  getSavedQueries,
  saveSavedQuery,
  getCollections,
  saveCollection,
} = await import('./store');

// Import and register handlers
const { setupIpcHandlers } = await import('./ipc-handlers');
setupIpcHandlers();

// Helper to invoke IPC handlers
async function invokeHandler<T>(
  channel: string,
  ...args: unknown[]
): Promise<T> {
  const handler = mockHandlers.get(channel);
  if (!handler) {
    throw new Error(`No handler registered for channel: ${channel}`);
  }

  const mockEvent = {} as IpcMainInvokeEvent;
  return handler(mockEvent, ...args) as Promise<T>;
}

// ============ Tests ============

describe('ipc Handlers - Saved Queries', () => {
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

  describe('saved Query CRUD', () => {
    it('should get all saved queries via IPC', async () => {
      // Pre-populate with test data
      saveSavedQuery({
        name: 'Test Query',
        queryText: 'SELECT * FROM users',
        isFavorite: false,
        collectionIds: [],
      });

      const result = await invokeHandler<{
        success: boolean;
        queries: unknown[];
      }>(IPC_CHANNELS.SAVED_QUERY_GET_ALL, {});

      expect(result.success).toBe(true);
      expect(result.queries).toHaveLength(1);
      expect((result.queries[0] as { name: string }).name).toBe('Test Query');
    });

    it('should save a new query via IPC', async () => {
      const result = await invokeHandler<{
        success: boolean;
        query?: { id: string; name: string; queryText: string };
      }>(IPC_CHANNELS.SAVED_QUERY_SAVE, {
        query: {
          name: 'New Query',
          queryText: 'SELECT * FROM posts',
          isFavorite: false,
          collectionIds: [],
        },
      });

      expect(result.success).toBe(true);
      expect(result.query).toBeDefined();
      expect(result.query?.name).toBe('New Query');
      expect(result.query?.id).toBeDefined();

      // Verify it was actually saved
      const queries = getSavedQueries();
      expect(queries).toHaveLength(1);
    });

    it('should update a query via IPC', async () => {
      const saveResult = saveSavedQuery({
        name: 'Original',
        queryText: 'SELECT * FROM users',
        isFavorite: false,
        collectionIds: [],
      });

      const result = await invokeHandler<{
        success: boolean;
        query?: { name: string; description?: string };
      }>(IPC_CHANNELS.SAVED_QUERY_UPDATE, {
        id: saveResult.query!.id,
        updates: {
          name: 'Updated',
          description: 'Updated description',
        },
      });

      expect(result.success).toBe(true);
      expect(result.query?.name).toBe('Updated');
      expect(result.query?.description).toBe('Updated description');
    });

    it('should delete a query via IPC', async () => {
      const saveResult = saveSavedQuery({
        name: 'To Delete',
        queryText: 'SELECT * FROM users',
        isFavorite: false,
        collectionIds: [],
      });

      const result = await invokeHandler<{ success: boolean }>(
        IPC_CHANNELS.SAVED_QUERY_DELETE,
        { id: saveResult.query!.id }
      );

      expect(result.success).toBe(true);

      // Verify it was deleted
      const queries = getSavedQueries();
      expect(queries).toHaveLength(0);
    });

    it('should handle save errors', async () => {
      const result = await invokeHandler<{
        success: boolean;
        error?: string;
      }>(IPC_CHANNELS.SAVED_QUERY_SAVE, {
        query: {
          name: '   ', // Invalid empty name
          queryText: 'SELECT * FROM users',
          isFavorite: false,
          collectionIds: [],
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle update errors for non-existent query', async () => {
      const result = await invokeHandler<{
        success: boolean;
        error?: string;
      }>(IPC_CHANNELS.SAVED_QUERY_UPDATE, {
        id: 'non-existent-id',
        updates: { name: 'Test' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('saved Query Filtering', () => {
    beforeEach(() => {
      // Create test data
      saveSavedQuery({
        name: 'Favorite 1',
        queryText: 'SELECT 1',
        dbPath: '/test/db1.sqlite',
        isFavorite: true,
        collectionIds: [],
      });

      saveSavedQuery({
        name: 'Regular',
        queryText: 'SELECT 2',
        dbPath: '/test/db1.sqlite',
        isFavorite: false,
        collectionIds: [],
      });

      saveSavedQuery({
        name: 'Favorite 2',
        queryText: 'SELECT 3',
        dbPath: '/test/db2.sqlite',
        isFavorite: true,
        collectionIds: [],
      });
    });

    it('should filter by favorites via IPC', async () => {
      const result = await invokeHandler<{
        success: boolean;
        queries: { isFavorite: boolean }[];
      }>(IPC_CHANNELS.SAVED_QUERY_GET_ALL, { favoritesOnly: true });

      expect(result.success).toBe(true);
      expect(result.queries).toHaveLength(2);
      expect(result.queries.every((q) => q.isFavorite)).toBe(true);
    });

    it('should filter by dbPath via IPC', async () => {
      const result = await invokeHandler<{
        success: boolean;
        queries: { dbPath?: string }[];
      }>(IPC_CHANNELS.SAVED_QUERY_GET_ALL, { dbPath: '/test/db1.sqlite' });

      expect(result.success).toBe(true);
      expect(result.queries).toHaveLength(2);
      expect(result.queries.every((q) => q.dbPath === '/test/db1.sqlite')).toBe(
        true
      );
    });

    it('should filter by collection via IPC', async () => {
      const collectionResult = saveCollection({
        name: 'Test Collection',
        queryIds: [],
      });
      const collectionId = collectionResult.collection!.id;

      // Save query with collection
      saveSavedQuery({
        name: 'In Collection',
        queryText: 'SELECT 4',
        isFavorite: false,
        collectionIds: [collectionId],
      });

      const result = await invokeHandler<{
        success: boolean;
        queries: unknown[];
      }>(IPC_CHANNELS.SAVED_QUERY_GET_ALL, { collectionId });

      expect(result.success).toBe(true);
      expect(result.queries).toHaveLength(1);
      expect((result.queries[0] as { name: string }).name).toBe(
        'In Collection'
      );
    });
  });

  describe('toggle Favorite', () => {
    it('should toggle favorite status via IPC', async () => {
      const saveResult = saveSavedQuery({
        name: 'Test',
        queryText: 'SELECT * FROM users',
        isFavorite: false,
        collectionIds: [],
      });

      const result = await invokeHandler<{
        success: boolean;
        query?: { isFavorite: boolean };
      }>(IPC_CHANNELS.SAVED_QUERY_TOGGLE_FAVORITE, {
        id: saveResult.query!.id,
        isFavorite: true,
      });

      expect(result.success).toBe(true);
      expect(result.query?.isFavorite).toBe(true);

      // Toggle back
      const result2 = await invokeHandler<{
        success: boolean;
        query?: { isFavorite: boolean };
      }>(IPC_CHANNELS.SAVED_QUERY_TOGGLE_FAVORITE, {
        id: saveResult.query!.id,
        isFavorite: false,
      });

      expect(result2.success).toBe(true);
      expect(result2.query?.isFavorite).toBe(false);
    });
  });
});

describe('ipc Handlers - Collections', () => {
  beforeEach(() => {
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

  describe('collection CRUD', () => {
    it('should get all collections via IPC', async () => {
      saveCollection({
        name: 'Test Collection',
        queryIds: [],
      });

      const result = await invokeHandler<{
        success: boolean;
        collections: unknown[];
      }>(IPC_CHANNELS.COLLECTION_GET_ALL);

      expect(result.success).toBe(true);
      expect(result.collections).toHaveLength(1);
      expect((result.collections[0] as { name: string }).name).toBe(
        'Test Collection'
      );
    });

    it('should save a new collection via IPC', async () => {
      const result = await invokeHandler<{
        success: boolean;
        collection?: { id: string; name: string };
      }>(IPC_CHANNELS.COLLECTION_SAVE, {
        collection: {
          name: 'New Collection',
          description: 'Test description',
          color: '#FF5733',
          queryIds: [],
        },
      });

      expect(result.success).toBe(true);
      expect(result.collection).toBeDefined();
      expect(result.collection?.name).toBe('New Collection');
      expect(result.collection?.id).toBeDefined();

      const collections = getCollections();
      expect(collections).toHaveLength(1);
    });

    it('should update a collection via IPC', async () => {
      const saveResult = saveCollection({
        name: 'Original',
        queryIds: [],
      });

      const result = await invokeHandler<{
        success: boolean;
        collection?: { name: string; description?: string };
      }>(IPC_CHANNELS.COLLECTION_UPDATE, {
        id: saveResult.collection!.id,
        updates: {
          name: 'Updated',
          description: 'Updated description',
        },
      });

      expect(result.success).toBe(true);
      expect(result.collection?.name).toBe('Updated');
      expect(result.collection?.description).toBe('Updated description');
    });

    it('should delete a collection via IPC', async () => {
      const saveResult = saveCollection({
        name: 'To Delete',
        queryIds: [],
      });

      const result = await invokeHandler<{ success: boolean }>(
        IPC_CHANNELS.COLLECTION_DELETE,
        { id: saveResult.collection!.id }
      );

      expect(result.success).toBe(true);

      const collections = getCollections();
      expect(collections).toHaveLength(0);
    });

    it('should handle save errors', async () => {
      const result = await invokeHandler<{
        success: boolean;
        error?: string;
      }>(IPC_CHANNELS.COLLECTION_SAVE, {
        collection: {
          name: '   ', // Invalid empty name
          queryIds: [],
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle update errors for non-existent collection', async () => {
      const result = await invokeHandler<{
        success: boolean;
        error?: string;
      }>(IPC_CHANNELS.COLLECTION_UPDATE, {
        id: 'non-existent-id',
        updates: { name: 'Test' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('collection-Query Relationships', () => {
    it('should add query to collection via IPC', async () => {
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

      const result = await invokeHandler<{
        success: boolean;
        query?: { collectionIds: string[] };
        collection?: { queryIds: string[] };
      }>(IPC_CHANNELS.COLLECTION_ADD_QUERY, {
        queryId: queryResult.query!.id,
        collectionId: collectionResult.collection!.id,
      });

      expect(result.success).toBe(true);
      expect(result.query?.collectionIds).toContain(
        collectionResult.collection!.id
      );
      expect(result.collection?.queryIds).toContain(queryResult.query!.id);
    });

    it('should remove query from collection via IPC', async () => {
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

      // Add first
      await invokeHandler(IPC_CHANNELS.COLLECTION_ADD_QUERY, {
        queryId: queryResult.query!.id,
        collectionId: collectionResult.collection!.id,
      });

      // Then remove
      const result = await invokeHandler<{
        success: boolean;
        query?: { collectionIds: string[] };
        collection?: { queryIds: string[] };
      }>(IPC_CHANNELS.COLLECTION_REMOVE_QUERY, {
        queryId: queryResult.query!.id,
        collectionId: collectionResult.collection!.id,
      });

      expect(result.success).toBe(true);
      expect(result.query?.collectionIds).not.toContain(
        collectionResult.collection!.id
      );
      expect(result.collection?.queryIds).not.toContain(queryResult.query!.id);
    });

    it('should handle errors when adding non-existent query', async () => {
      const collectionResult = saveCollection({
        name: 'Test Collection',
        queryIds: [],
      });

      const result = await invokeHandler<{
        success: boolean;
        error?: string;
      }>(IPC_CHANNELS.COLLECTION_ADD_QUERY, {
        queryId: 'non-existent-query',
        collectionId: collectionResult.collection!.id,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle errors when adding to non-existent collection', async () => {
      const queryResult = saveSavedQuery({
        name: 'Test Query',
        queryText: 'SELECT * FROM users',
        isFavorite: false,
        collectionIds: [],
      });

      const result = await invokeHandler<{
        success: boolean;
        error?: string;
      }>(IPC_CHANNELS.COLLECTION_ADD_QUERY, {
        queryId: queryResult.query!.id,
        collectionId: 'non-existent-collection',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});

describe('ipc Handlers - Export/Import', () => {
  let tempDir: string;

  beforeEach(() => {
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

    // Create temp directory for export/import tests
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ipc-test-'));
  });

  afterEach(() => {
    // Clean up temp directory
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('export Collections', () => {
    it('should export collections to file via IPC', async () => {
      // Create test data
      const queryResult = saveSavedQuery({
        name: 'Test Query',
        queryText: 'SELECT * FROM users',
        isFavorite: false,
        collectionIds: [],
      });

      const collectionResult = saveCollection({
        name: 'Test Collection',
        description: 'Test description',
        color: '#FF5733',
        queryIds: [queryResult.query!.id],
      });

      const exportPath = path.join(tempDir, 'export.json');

      const result = await invokeHandler<{
        success: boolean;
        collectionsExported?: number;
        queriesExported?: number;
      }>(IPC_CHANNELS.COLLECTION_EXPORT, {
        collectionIds: [collectionResult.collection!.id],
        filePath: exportPath,
      });

      expect(result.success).toBe(true);
      expect(result.collectionsExported).toBe(1);
      expect(result.queriesExported).toBe(1);

      // Verify file was created
      expect(fs.existsSync(exportPath)).toBe(true);

      // Verify file content
      const fileContent = JSON.parse(fs.readFileSync(exportPath, 'utf-8'));
      expect(fileContent.version).toBe('1.0');
      expect(fileContent.collections).toHaveLength(1);
      expect(fileContent.queries).toHaveLength(1);
      expect(fileContent.collections[0].name).toBe('Test Collection');
    });

    it('should export all collections when no IDs specified', async () => {
      // Create multiple collections
      saveCollection({ name: 'Collection 1', queryIds: [] });
      saveCollection({ name: 'Collection 2', queryIds: [] });

      const exportPath = path.join(tempDir, 'export-all.json');

      const result = await invokeHandler<{
        success: boolean;
        collectionsExported?: number;
      }>(IPC_CHANNELS.COLLECTION_EXPORT, {
        filePath: exportPath,
      });

      expect(result.success).toBe(true);
      expect(result.collectionsExported).toBe(2);
    });

    it('should handle export errors', async () => {
      const result = await invokeHandler<{
        success: boolean;
        error?: string;
      }>(IPC_CHANNELS.COLLECTION_EXPORT, {
        filePath: '/invalid/path/that/does/not/exist/export.json',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('import Collections', () => {
    it('should import collections from file via IPC', async () => {
      // Create export file
      const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        collections: [
          {
            id: 'old-collection-id',
            name: 'Imported Collection',
            description: 'Test',
            color: '#FF5733',
            queryIds: ['old-query-id'],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        queries: [
          {
            id: 'old-query-id',
            name: 'Imported Query',
            queryText: 'SELECT * FROM users',
            isFavorite: false,
            collectionIds: ['old-collection-id'],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      };

      const importPath = path.join(tempDir, 'import.json');
      fs.writeFileSync(importPath, JSON.stringify(exportData), 'utf-8');

      const result = await invokeHandler<{
        success: boolean;
        collectionsImported?: number;
        queriesImported?: number;
      }>(IPC_CHANNELS.COLLECTION_IMPORT, {
        filePath: importPath,
        duplicateStrategy: 'skip',
      });

      expect(result.success).toBe(true);
      expect(result.collectionsImported).toBe(1);
      expect(result.queriesImported).toBe(1);

      // Verify data was imported
      const collections = getCollections();
      const queries = getSavedQueries();

      expect(collections).toHaveLength(1);
      expect(queries).toHaveLength(1);
      expect(collections[0].name).toBe('Imported Collection');
      expect(queries[0].name).toBe('Imported Query');
    });

    it('should handle duplicate strategy: skip', async () => {
      // Pre-create a collection
      saveCollection({
        name: 'Existing Collection',
        queryIds: [],
      });

      const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        collections: [
          {
            id: 'import-id',
            name: 'Existing Collection',
            queryIds: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        queries: [],
      };

      const importPath = path.join(tempDir, 'import-skip.json');
      fs.writeFileSync(importPath, JSON.stringify(exportData), 'utf-8');

      const result = await invokeHandler<{
        success: boolean;
        collectionsImported?: number;
        skipped?: number;
      }>(IPC_CHANNELS.COLLECTION_IMPORT, {
        filePath: importPath,
        duplicateStrategy: 'skip',
      });

      expect(result.success).toBe(true);
      expect(result.collectionsImported).toBe(0);
      expect(result.skipped).toBe(1);

      // Should still have only 1 collection
      const collections = getCollections();
      expect(collections).toHaveLength(1);
    });

    it('should handle duplicate strategy: rename', async () => {
      // Pre-create a collection
      saveCollection({
        name: 'Duplicate Collection',
        queryIds: [],
      });

      const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        collections: [
          {
            id: 'import-id',
            name: 'Duplicate Collection',
            queryIds: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        queries: [],
      };

      const importPath = path.join(tempDir, 'import-rename.json');
      fs.writeFileSync(importPath, JSON.stringify(exportData), 'utf-8');

      const result = await invokeHandler<{
        success: boolean;
        collectionsImported?: number;
      }>(IPC_CHANNELS.COLLECTION_IMPORT, {
        filePath: importPath,
        duplicateStrategy: 'rename',
      });

      expect(result.success).toBe(true);
      expect(result.collectionsImported).toBe(1);

      // Should have 2 collections now
      const collections = getCollections();
      expect(collections).toHaveLength(2);

      const renamedCollection = collections.find((c) =>
        c.name.includes('(imported)')
      );
      expect(renamedCollection).toBeDefined();
    });

    it('should handle duplicate strategy: overwrite', async () => {
      // Pre-create a collection
      const existing = saveCollection({
        name: 'To Overwrite',
        description: 'Original',
        queryIds: [],
      });

      const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        collections: [
          {
            id: 'import-id',
            name: 'To Overwrite',
            description: 'Updated',
            queryIds: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        queries: [],
      };

      const importPath = path.join(tempDir, 'import-overwrite.json');
      fs.writeFileSync(importPath, JSON.stringify(exportData), 'utf-8');

      const result = await invokeHandler<{
        success: boolean;
        collectionsImported?: number;
      }>(IPC_CHANNELS.COLLECTION_IMPORT, {
        filePath: importPath,
        duplicateStrategy: 'overwrite',
      });

      expect(result.success).toBe(true);
      expect(result.collectionsImported).toBe(1);

      // Should still have 1 collection but updated
      const collections = getCollections();
      expect(collections).toHaveLength(1);
      expect(collections[0].description).toBe('Updated');
      // Note: The overwrite updates the existing collection in place
      expect(collections[0].name).toBe('To Overwrite');
    });

    it('should handle invalid import file format', async () => {
      const invalidData = { invalid: 'format' };
      const importPath = path.join(tempDir, 'invalid.json');
      fs.writeFileSync(importPath, JSON.stringify(invalidData), 'utf-8');

      const result = await invokeHandler<{
        success: boolean;
        error?: string;
      }>(IPC_CHANNELS.COLLECTION_IMPORT, {
        filePath: importPath,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid import file format');
    });

    it('should handle non-existent import file', async () => {
      const result = await invokeHandler<{
        success: boolean;
        error?: string;
      }>(IPC_CHANNELS.COLLECTION_IMPORT, {
        filePath: path.join(tempDir, 'does-not-exist.json'),
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('export/Import Round-Trip', () => {
    it('should preserve data through export and import', async () => {
      // Create test data
      const query1 = saveSavedQuery({
        name: 'Query 1',
        queryText: 'SELECT * FROM users',
        description: 'User query',
        isFavorite: true,
        collectionIds: [],
      });

      const query2 = saveSavedQuery({
        name: 'Query 2',
        queryText: 'SELECT * FROM posts',
        description: 'Post query',
        isFavorite: false,
        collectionIds: [],
      });

      const collection = saveCollection({
        name: 'My Collection',
        description: 'Test collection',
        color: '#FF5733',
        icon: 'folder',
        queryIds: [query1.query!.id, query2.query!.id],
      });

      // Export
      const exportPath = path.join(tempDir, 'roundtrip.json');
      await invokeHandler(IPC_CHANNELS.COLLECTION_EXPORT, {
        collectionIds: [collection.collection!.id],
        filePath: exportPath,
      });

      // Clear store
      mockStoreData.savedQueries = {};
      mockStoreData.collections = {};

      // Import
      const importResult = await invokeHandler<{
        success: boolean;
        collectionsImported?: number;
        queriesImported?: number;
      }>(IPC_CHANNELS.COLLECTION_IMPORT, {
        filePath: exportPath,
        duplicateStrategy: 'skip',
      });

      expect(importResult.success).toBe(true);
      expect(importResult.collectionsImported).toBe(1);
      expect(importResult.queriesImported).toBe(2);

      // Verify data integrity
      const collections = getCollections();
      const queries = getSavedQueries();

      expect(collections).toHaveLength(1);
      expect(queries).toHaveLength(2);

      const importedCollection = collections[0];
      expect(importedCollection.name).toBe('My Collection');
      expect(importedCollection.description).toBe('Test collection');
      expect(importedCollection.color).toBe('#FF5733');
      expect(importedCollection.queryIds).toHaveLength(2);

      const importedQuery1 = queries.find((q) => q.name === 'Query 1');
      const importedQuery2 = queries.find((q) => q.name === 'Query 2');

      expect(importedQuery1).toBeDefined();
      expect(importedQuery1?.description).toBe('User query');
      expect(importedQuery1?.isFavorite).toBe(true);

      expect(importedQuery2).toBeDefined();
      expect(importedQuery2?.description).toBe('Post query');
      expect(importedQuery2?.isFavorite).toBe(false);

      // Verify bidirectional relationships
      expect(importedQuery1?.collectionIds).toContain(importedCollection.id);
      expect(importedQuery2?.collectionIds).toContain(importedCollection.id);
    });
  });
});

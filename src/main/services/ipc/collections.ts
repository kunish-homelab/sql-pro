import { IPC_CHANNELS } from '@shared/types';
import { ipcMain } from 'electron';
import {
  addQueryToCollection,
  deleteCollection,
  getCollections,
  removeQueryFromCollection,
  saveCollection,
  updateCollection,
} from '../store';

export function setupCollectionsHandlers(): void {
  // Collections: Get
  ipcMain.handle(IPC_CHANNELS.COLLECTIONS_GET, async () => {
    try {
      const collections = getCollections();
      return { success: true, collections };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to get collections',
      };
    }
  });

  // Collections: Save
  ipcMain.handle(IPC_CHANNELS.COLLECTIONS_SAVE, async (_event, request) => {
    try {
      const result = saveCollection({
        name: request.name,
        description: request.description,
        queryIds: [],
      });
      return result;
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to save collection',
      };
    }
  });

  // Collections: Update
  ipcMain.handle(IPC_CHANNELS.COLLECTIONS_UPDATE, async (_event, request) => {
    try {
      const result = updateCollection(request.id, {
        name: request.name,
        description: request.description,
      });
      return result;
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update collection',
      };
    }
  });

  // Collections: Delete
  ipcMain.handle(IPC_CHANNELS.COLLECTIONS_DELETE, async (_event, request) => {
    try {
      deleteCollection(request.id);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to delete collection',
      };
    }
  });

  // Collections: Add Query
  ipcMain.handle(
    IPC_CHANNELS.COLLECTIONS_ADD_QUERY,
    async (_event, request) => {
      try {
        addQueryToCollection(request.collectionId, request.queryId);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to add query',
        };
      }
    }
  );

  // Collections: Remove Query
  ipcMain.handle(
    IPC_CHANNELS.COLLECTIONS_REMOVE_QUERY,
    async (_event, request) => {
      try {
        removeQueryFromCollection(request.collectionId, request.queryId);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Failed to remove query',
        };
      }
    }
  );
}

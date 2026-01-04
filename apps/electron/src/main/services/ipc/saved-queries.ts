import { IPC_CHANNELS } from '@shared/types';
import { ipcMain } from 'electron';
import {
  deleteSavedQuery,
  getSavedQueries,
  saveSavedQuery,
  updateSavedQuery,
} from '../store';

export function setupSavedQueriesHandlers(): void {
  // Saved Queries: Get
  ipcMain.handle(IPC_CHANNELS.SAVED_QUERIES_GET, async () => {
    try {
      const queries = getSavedQueries();
      return { success: true, queries };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get queries',
      };
    }
  });

  // Saved Queries: Save
  ipcMain.handle(IPC_CHANNELS.SAVED_QUERIES_SAVE, async (_event, request) => {
    try {
      const result = saveSavedQuery({
        name: request.name,
        queryText: request.query || request.queryText,
        dbPath: request.connectionPath || request.dbPath,
        tags: request.tags,
        description: request.description,
        collectionIds: [],
      });
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save query',
      };
    }
  });

  // Saved Queries: Update
  ipcMain.handle(IPC_CHANNELS.SAVED_QUERIES_UPDATE, async (_event, request) => {
    try {
      const result = updateSavedQuery(request.id, {
        name: request.name,
        queryText: request.query || request.queryText,
        tags: request.tags,
        description: request.description,
      });
      return result;
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to update query',
      };
    }
  });

  // Saved Queries: Delete
  ipcMain.handle(IPC_CHANNELS.SAVED_QUERIES_DELETE, async (_event, request) => {
    try {
      deleteSavedQuery(request.id);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to delete query',
      };
    }
  });
}

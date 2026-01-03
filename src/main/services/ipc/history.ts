import type {
  ClearQueryHistoryRequest,
  DeleteQueryHistoryRequest,
  GetQueryHistoryRequest,
  QueryHistoryEntry,
  SaveQueryHistoryRequest,
} from '@shared/types';
import { IPC_CHANNELS } from '@shared/types';
import { ipcMain } from 'electron';
import {
  clearQueryHistory,
  deleteQueryHistoryEntry,
  getQueryHistory,
  saveQueryHistoryEntry,
} from '../store';
import { createHandler } from './utils';

export function setupHistoryHandlers(): void {
  // Query History: Get
  ipcMain.handle(
    IPC_CHANNELS.QUERY_HISTORY_GET,
    createHandler(async (request: GetQueryHistoryRequest) => {
      const dbPath = request.dbPath || '';
      const history = getQueryHistory(dbPath);
      return { success: true, history };
    })
  );

  // Query History: Save
  ipcMain.handle(
    IPC_CHANNELS.QUERY_HISTORY_SAVE,
    createHandler(async (request: SaveQueryHistoryRequest) => {
      const entry: QueryHistoryEntry = request.entry || {
        id: crypto.randomUUID(),
        query: request.query || '',
        dbPath: request.connectionPath || '',
        timestamp: request.timestamp || new Date().toISOString(),
        description: request.description,
      };
      saveQueryHistoryEntry(entry);
      return { success: true, entry };
    })
  );

  // Query History: Delete
  ipcMain.handle(
    IPC_CHANNELS.QUERY_HISTORY_DELETE,
    createHandler(async (request: DeleteQueryHistoryRequest) => {
      const dbPath = request.dbPath || '';
      const entryId = request.id || request.entryId || '';
      deleteQueryHistoryEntry(dbPath, entryId);
      return { success: true };
    })
  );

  // Query History: Clear
  ipcMain.handle(
    IPC_CHANNELS.QUERY_HISTORY_CLEAR,
    createHandler(async (request: ClearQueryHistoryRequest) => {
      const dbPath = request.dbPath || '';
      clearQueryHistory(dbPath);
      return { success: true };
    })
  );
}

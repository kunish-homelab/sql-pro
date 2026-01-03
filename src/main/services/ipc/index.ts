import { IPC_CHANNELS } from '@shared/types';
import { ipcMain } from 'electron';
import { setupAIHandlers } from './ai';
import { setupCollectionsHandlers } from './collections';
import { setupDatabaseHandlers } from './database';
import { setupDialogHandlers } from './dialog';
import { setupExportHandlers } from './export';
import { setupFoldersHandlers } from './folders';
import { setupHistoryHandlers } from './history';
import { setupImportHandlers } from './import';
import { setupPasswordHandlers } from './password';
import { setupPreferencesHandlers } from './preferences';
import { setupProHandlers } from './pro';
import { setupProfilesHandlers } from './profiles';
import {
  cleanupRendererStoreHandlers,
  setupRendererStoreHandlers,
} from './renderer-store';
import { setupSavedQueriesHandlers } from './saved-queries';
import { setupSchemaHandlers } from './schema';
import { setupSqlLogHandlers } from './sql-log';
import { setupSystemHandlers } from './system';
import { setupUpdatesHandlers } from './updates';

export { findClaudeCodePaths } from './ai';

export function setupIpcHandlers(): void {
  setupDatabaseHandlers();
  setupDialogHandlers();
  setupExportHandlers();
  setupImportHandlers();
  setupSchemaHandlers();
  setupHistoryHandlers();
  setupSavedQueriesHandlers();
  setupCollectionsHandlers();
  setupProfilesHandlers();
  setupFoldersHandlers();
  setupPasswordHandlers();
  setupPreferencesHandlers();
  setupProHandlers();
  setupAIHandlers();
  setupSystemHandlers();
  setupUpdatesHandlers();
  setupRendererStoreHandlers();
  setupSqlLogHandlers();
}

export function cleanupIpcHandlers(): void {
  Object.values(IPC_CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
  // Also clean up renderer store channels
  cleanupRendererStoreHandlers();
}

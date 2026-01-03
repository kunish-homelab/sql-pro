import type {
  ImportBundleRequest,
  ImportQueryRequest,
  ImportSchemaRequest,
} from '@shared/types';
import { IPC_CHANNELS } from '@shared/types';
import { ipcMain } from 'electron';
import {
  importBundle,
  importQuery,
  importSchema,
} from '../query-schema-sharing';
import { createHandler } from './utils';

export function setupImportHandlers(): void {
  // Import: Bundle
  ipcMain.handle(
    IPC_CHANNELS.IMPORT_BUNDLE,
    createHandler(async (request: ImportBundleRequest) => {
      if (!request.data) {
        throw new Error('Import data is required');
      }
      const result = await importBundle(request.data);
      return result;
    })
  );

  // Import: Query
  ipcMain.handle(
    IPC_CHANNELS.IMPORT_QUERY,
    createHandler(async (request: ImportQueryRequest) => {
      if (!request.data) {
        throw new Error('Import data is required');
      }
      const result = await importQuery(request.data);
      return result;
    })
  );

  // Import: Schema
  ipcMain.handle(
    IPC_CHANNELS.IMPORT_SCHEMA,
    createHandler(async (request: ImportSchemaRequest) => {
      if (!request.data) {
        throw new Error('Import data is required');
      }
      const result = await importSchema(request.data);
      return result;
    })
  );
}

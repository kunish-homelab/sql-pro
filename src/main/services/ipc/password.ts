import type {
  GetPasswordRequest,
  HasPasswordRequest,
  RemovePasswordRequest,
  SavePasswordRequest,
} from '@shared/types';
import { IPC_CHANNELS } from '@shared/types';
import { ipcMain } from 'electron';
import { passwordStorageService } from '../password-storage';
import { createHandler } from './utils';

export function setupPasswordHandlers(): void {
  // Password: Is Available
  ipcMain.handle(IPC_CHANNELS.PASSWORD_IS_AVAILABLE, async () => {
    try {
      const available = passwordStorageService.isAvailable();
      return { success: true, available };
    } catch (error) {
      return {
        success: false,
        available: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to check password storage availability',
      };
    }
  });

  // Password: Get
  ipcMain.handle(
    IPC_CHANNELS.PASSWORD_GET,
    createHandler(async (request: GetPasswordRequest) => {
      const identifier = request.identifier || request.dbPath || '';
      const password = await passwordStorageService.getPassword(identifier);
      return { success: true, password };
    })
  );

  // Password: Has
  ipcMain.handle(
    IPC_CHANNELS.PASSWORD_HAS,
    createHandler(async (request: HasPasswordRequest) => {
      const identifier = request.identifier || request.dbPath || '';
      const hasPassword = await passwordStorageService.hasPassword(identifier);
      return { success: true, hasPassword };
    })
  );

  // Password: Save
  ipcMain.handle(
    IPC_CHANNELS.PASSWORD_SAVE,
    createHandler(async (request: SavePasswordRequest) => {
      const identifier = request.identifier || request.dbPath || '';
      await passwordStorageService.savePassword(identifier, request.password);
      return { success: true };
    })
  );

  // Password: Remove
  ipcMain.handle(
    IPC_CHANNELS.PASSWORD_REMOVE,
    createHandler(async (request: RemovePasswordRequest) => {
      const identifier = request.identifier || request.dbPath || '';
      await passwordStorageService.removePassword(identifier);
      return { success: true };
    })
  );
}

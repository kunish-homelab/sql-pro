import { IPC_CHANNELS } from '@shared/types';
import { ipcMain } from 'electron';
import {
  checkForUpdates,
  downloadUpdate,
  getUpdateStatus,
  quitAndInstall,
} from '../updater';

export function setupUpdatesHandlers(): void {
  // Updates: Check For Updates
  ipcMain.handle(IPC_CHANNELS.UPDATES_CHECK, async () => {
    try {
      await checkForUpdates();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to check for updates',
      };
    }
  });

  // Updates: Get Status
  ipcMain.handle(IPC_CHANNELS.UPDATES_GET_STATUS, async () => {
    try {
      const status = getUpdateStatus();
      return { success: true, status };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get update status',
      };
    }
  });

  // Updates: Download
  ipcMain.handle(IPC_CHANNELS.UPDATES_DOWNLOAD, async () => {
    try {
      downloadUpdate();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to download update',
      };
    }
  });

  // Updates: Quit and Install
  ipcMain.handle(IPC_CHANNELS.UPDATES_QUIT_AND_INSTALL, async () => {
    try {
      quitAndInstall();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to install update',
      };
    }
  });
}

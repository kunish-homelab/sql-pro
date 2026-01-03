import { IPC_CHANNELS } from '@shared/types';
import { ipcMain } from 'electron';
import { deleteFolder, getFolders, saveFolder, updateFolder } from '../store';

export function setupFoldersHandlers(): void {
  // Folders: Get
  ipcMain.handle(IPC_CHANNELS.FOLDERS_GET, async () => {
    try {
      const folders = getFolders();
      return { success: true, folders };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get folders',
      };
    }
  });

  // Folders: Save
  ipcMain.handle(IPC_CHANNELS.FOLDERS_SAVE, async (_event, request) => {
    try {
      const result = saveFolder({
        name: request.name || request.alias || '',
        parentId: request.parentId,
      });
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save folder',
      };
    }
  });

  // Folders: Update
  ipcMain.handle(IPC_CHANNELS.FOLDERS_UPDATE, async (_event, request) => {
    try {
      const result = updateFolder(request.id || request.path, {
        name: request.name || request.alias,
      });
      return result;
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to update folder',
      };
    }
  });

  // Folders: Delete
  ipcMain.handle(IPC_CHANNELS.FOLDERS_DELETE, async (_event, request) => {
    try {
      deleteFolder(request.id || request.path);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to delete folder',
      };
    }
  });
}

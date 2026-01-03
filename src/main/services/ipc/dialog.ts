import type {
  OpenFileDialogRequest,
  SaveFileDialogRequest,
} from '@shared/types';
import { IPC_CHANNELS } from '@shared/types';
import { dialog, ipcMain } from 'electron';

export function setupDialogHandlers(): void {
  // Dialog: Open File
  ipcMain.handle(
    IPC_CHANNELS.DIALOG_OPEN_FILE,
    async (_event, request: OpenFileDialogRequest) => {
      const result = await dialog.showOpenDialog({
        title: request.title || 'Open Database',
        filters: request.filters || [
          { name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3'] },
          { name: 'All Files', extensions: ['*'] },
        ],
        defaultPath: request.defaultPath,
        properties: ['openFile'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: true, canceled: true };
      }

      return { success: true, filePath: result.filePaths[0] };
    }
  );

  // Dialog: Save File
  ipcMain.handle(
    IPC_CHANNELS.DIALOG_SAVE_FILE,
    async (_event, request: SaveFileDialogRequest) => {
      const result = await dialog.showSaveDialog({
        title: request.title || 'Save File',
        filters: request.filters || [{ name: 'All Files', extensions: ['*'] }],
        defaultPath: request.defaultPath,
      });

      if (result.canceled || !result.filePath) {
        return { success: true, canceled: true };
      }

      return { success: true, filePath: result.filePath };
    }
  );
}

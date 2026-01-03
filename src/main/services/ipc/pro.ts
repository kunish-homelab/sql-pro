import type { ProActivateRequest } from '@shared/types';
import { IPC_CHANNELS } from '@shared/types';
import { ipcMain } from 'electron';
import { clearProStatus, getProStatus, saveProStatus } from '../store';
import { createHandler } from './utils';

export function setupProHandlers(): void {
  // Pro: Activate
  ipcMain.handle(
    IPC_CHANNELS.PRO_ACTIVATE,
    createHandler(async (request: ProActivateRequest) => {
      saveProStatus({
        isActive: true,
        activationDate: new Date().toISOString(),
        licenseKey: request.licenseKey,
      });
      return { success: true };
    })
  );

  // Pro: Get Status
  ipcMain.handle(IPC_CHANNELS.PRO_GET_STATUS, async () => {
    try {
      const status = getProStatus();
      return { success: true, status };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to get pro status',
      };
    }
  });

  // Pro: Clear Status
  ipcMain.handle(IPC_CHANNELS.PRO_CLEAR_STATUS, async () => {
    try {
      clearProStatus();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to clear pro status',
      };
    }
  });
}

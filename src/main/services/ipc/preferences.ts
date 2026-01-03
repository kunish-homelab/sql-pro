import { IPC_CHANNELS } from '@shared/types';
import { ipcMain } from 'electron';
import { getPreferences, getRecentConnections, setPreferences } from '../store';

export function setupPreferencesHandlers(): void {
  // Preferences: Get
  ipcMain.handle(IPC_CHANNELS.PREFERENCES_GET, async () => {
    try {
      const preferences = getPreferences();
      return { success: true, preferences };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to get preferences',
      };
    }
  });

  // Preferences: Set
  ipcMain.handle(IPC_CHANNELS.PREFERENCES_SET, async (_event, request) => {
    try {
      const preferences = setPreferences(request.preferences);
      return { success: true, preferences };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to set preferences',
      };
    }
  });

  // App: Get Recent Connections
  ipcMain.handle(IPC_CHANNELS.APP_GET_RECENT_CONNECTIONS, async () => {
    try {
      const connections = getRecentConnections();
      return { success: true, connections };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get recent connections',
      };
    }
  });
}

import type {
  RemoveConnectionRequest,
  UpdateConnectionRequest,
} from '@shared/types';
import { IPC_CHANNELS } from '@shared/types';
import { ipcMain } from 'electron';
import {
  deleteProfile,
  getProfiles,
  removeRecentConnection,
  saveProfile,
  updateProfile,
} from '../store';
import { createHandler } from './utils';

export function setupProfilesHandlers(): void {
  // Profiles: Get
  ipcMain.handle(IPC_CHANNELS.PROFILES_GET, async () => {
    try {
      const profiles = getProfiles();
      return { success: true, profiles };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to get profiles',
      };
    }
  });

  // Profiles: Save
  ipcMain.handle(IPC_CHANNELS.PROFILES_SAVE, async (_event, request) => {
    try {
      const result = saveProfile({
        path: request.path || '',
        filename: request.filename || request.name || '',
        displayName: request.name,
        isEncrypted: request.isEncrypted ?? false,
        lastOpened: new Date().toISOString(),
        readOnly: request.readOnly ?? false,
        isSaved: true,
        ...request.config,
      });
      return result;
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to save profile',
      };
    }
  });

  // Profiles: Update
  ipcMain.handle(IPC_CHANNELS.PROFILES_UPDATE, async (_event, request) => {
    try {
      const result = updateProfile(request.id, {
        displayName: request.name,
        ...request.config,
      });
      return result;
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to update profile',
      };
    }
  });

  // Profiles: Delete
  ipcMain.handle(IPC_CHANNELS.PROFILES_DELETE, async (_event, request) => {
    try {
      deleteProfile(request.id);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to delete profile',
      };
    }
  });

  // Connections: Update
  ipcMain.handle(
    IPC_CHANNELS.CONNECTION_UPDATE,
    createHandler(async (request: UpdateConnectionRequest) => {
      const profiles = getProfiles();
      const profile = profiles.find(
        (p) => p.path === request.path || p.id === request.connectionId
      );

      if (!profile) {
        return { success: false, error: 'Connection profile not found' };
      }

      const result = updateProfile(profile.id, {
        displayName: request.updates?.displayName || request.displayName,
        readOnly: request.updates?.readOnly ?? request.readOnly,
      });

      return result;
    })
  );

  // Connections: Remove
  ipcMain.handle(
    IPC_CHANNELS.CONNECTION_REMOVE,
    createHandler(async (request: RemoveConnectionRequest) => {
      removeRecentConnection(request.path);
      return { success: true };
    })
  );
}

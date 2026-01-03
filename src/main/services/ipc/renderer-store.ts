/**
 * IPC handlers for renderer store persistence
 */

import type {
  GetRendererStateRequest,
  GetRendererStateResponse,
  RendererStoreSchema,
  SetRendererStateRequest,
  SetRendererStateResponse,
  UpdateRendererStateRequest,
  UpdateRendererStateResponse,
} from '@shared/types/renderer-store';
import { RENDERER_STORE_CHANNELS } from '@shared/types/renderer-store';
import { ipcMain } from 'electron';
import {
  getRendererState,
  resetRendererState,
  setRendererState,
  updateRendererState,
} from '../renderer-store';

export function setupRendererStoreHandlers(): void {
  // Get state for a specific key
  ipcMain.handle(
    RENDERER_STORE_CHANNELS.GET,
    async (
      _event,
      request: GetRendererStateRequest
    ): Promise<GetRendererStateResponse> => {
      try {
        const data = getRendererState(request.key);
        return { success: true, data };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
        };
      }
    }
  );

  // Set state for a specific key (full replace)
  ipcMain.handle(
    RENDERER_STORE_CHANNELS.SET,
    async (
      _event,
      request: SetRendererStateRequest
    ): Promise<SetRendererStateResponse> => {
      try {
        setRendererState(
          request.key,
          request.value as RendererStoreSchema[typeof request.key]
        );
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
        };
      }
    }
  );

  // Update state for a specific key (partial merge)
  ipcMain.handle(
    RENDERER_STORE_CHANNELS.UPDATE,
    async (
      _event,
      request: UpdateRendererStateRequest
    ): Promise<UpdateRendererStateResponse> => {
      try {
        updateRendererState(
          request.key,
          request.updates as Partial<RendererStoreSchema[typeof request.key]>
        );
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
        };
      }
    }
  );

  // Reset state for a specific key to defaults
  ipcMain.handle(
    RENDERER_STORE_CHANNELS.RESET,
    async (
      _event,
      request: { key: keyof RendererStoreSchema }
    ): Promise<SetRendererStateResponse> => {
      try {
        resetRendererState(request.key);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
        };
      }
    }
  );
}

export function cleanupRendererStoreHandlers(): void {
  Object.values(RENDERER_STORE_CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}

import type {
  ApplyChangesRequest,
  ApplyChangesResponse,
  CloseDatabaseRequest,
  CloseDatabaseResponse,
  ExecuteQueryRequest,
  ExecuteQueryResponse,
  ExportRequest,
  ExportResponse,
  GetPasswordRequest,
  GetPasswordResponse,
  GetPreferencesResponse,
  GetRecentConnectionsResponse,
  GetSchemaRequest,
  GetSchemaResponse,
  GetTableDataRequest,
  GetTableDataResponse,
  HasPasswordRequest,
  HasPasswordResponse,
  IsPasswordStorageAvailableResponse,
  MenuAction,
  OpenDatabaseRequest,
  OpenDatabaseResponse,
  OpenFileDialogRequest,
  OpenFileDialogResponse,
  RemoveConnectionRequest,
  RemoveConnectionResponse,
  RemovePasswordRequest,
  RemovePasswordResponse,
  SaveFileDialogRequest,
  SaveFileDialogResponse,
  SavePasswordRequest,
  SavePasswordResponse,
  SetPreferencesRequest,
  SetPreferencesResponse,
  UpdateConnectionRequest,
  UpdateConnectionResponse,
  ValidateChangesRequest,
  ValidateChangesResponse,
} from '../shared/types';
import process from 'node:process';
import { electronAPI } from '@electron-toolkit/preload';
import { contextBridge, ipcRenderer, webUtils } from 'electron';
import { IPC_CHANNELS } from '../shared/types';

// Custom API for SQL Pro
const sqlProAPI = {
  // Database operations
  db: {
    open: (request: OpenDatabaseRequest): Promise<OpenDatabaseResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.DB_OPEN, request),
    close: (request: CloseDatabaseRequest): Promise<CloseDatabaseResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.DB_CLOSE, request),
    getSchema: (request: GetSchemaRequest): Promise<GetSchemaResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.DB_GET_SCHEMA, request),
    getTableData: (
      request: GetTableDataRequest
    ): Promise<GetTableDataResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.DB_GET_TABLE_DATA, request),
    executeQuery: (
      request: ExecuteQueryRequest
    ): Promise<ExecuteQueryResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.DB_EXECUTE_QUERY, request),
    validateChanges: (
      request: ValidateChangesRequest
    ): Promise<ValidateChangesResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.DB_VALIDATE_CHANGES, request),
    applyChanges: (
      request: ApplyChangesRequest
    ): Promise<ApplyChangesResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.DB_APPLY_CHANGES, request),
  },

  // Dialog operations
  dialog: {
    openFile: (
      request?: OpenFileDialogRequest
    ): Promise<OpenFileDialogResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.DIALOG_OPEN_FILE, request || {}),
    saveFile: (
      request?: SaveFileDialogRequest
    ): Promise<SaveFileDialogResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.DIALOG_SAVE_FILE, request || {}),
  },

  // Export operations
  export: {
    data: (request: ExportRequest): Promise<ExportResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.EXPORT_DATA, request),
  },

  // App operations
  app: {
    getRecentConnections: (): Promise<GetRecentConnectionsResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.APP_GET_RECENT_CONNECTIONS),
    getPreferences: (): Promise<GetPreferencesResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.APP_GET_PREFERENCES),
    setPreferences: (
      request: SetPreferencesRequest
    ): Promise<SetPreferencesResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.APP_SET_PREFERENCES, request),
  },

  // Password storage operations
  password: {
    isAvailable: (): Promise<IsPasswordStorageAvailableResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.PASSWORD_IS_AVAILABLE),
    save: (request: SavePasswordRequest): Promise<SavePasswordResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.PASSWORD_SAVE, request),
    get: (request: GetPasswordRequest): Promise<GetPasswordResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.PASSWORD_GET, request),
    has: (request: HasPasswordRequest): Promise<HasPasswordResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.PASSWORD_HAS, request),
    remove: (request: RemovePasswordRequest): Promise<RemovePasswordResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.PASSWORD_REMOVE, request),
  },

  // Connection profile operations (T010)
  connection: {
    update: (
      request: UpdateConnectionRequest
    ): Promise<UpdateConnectionResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.CONNECTION_UPDATE, request),
    remove: (
      request: RemoveConnectionRequest
    ): Promise<RemoveConnectionResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.CONNECTION_REMOVE, request),
  },

  // File utilities
  file: {
    getPathForFile: (file: File): string => webUtils.getPathForFile(file),
  },

  // Menu action listener
  menu: {
    onAction: (callback: (action: MenuAction) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, action: MenuAction) =>
        callback(action);
      ipcRenderer.on(IPC_CHANNELS.MENU_ACTION, handler);
      return () => ipcRenderer.off(IPC_CHANNELS.MENU_ACTION, handler);
    },
  },
};

// Expose APIs to renderer
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI);
    contextBridge.exposeInMainWorld('sqlPro', sqlProAPI);
  } catch (error) {
    console.error(error);
  }
} else {
  window.electron = electronAPI;
  window.sqlPro = sqlProAPI;
}

// Export types for the renderer
export type SqlProAPI = typeof sqlProAPI;

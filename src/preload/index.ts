import { contextBridge, ipcRenderer } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';
import { IPC_CHANNELS } from '../shared/types';
import type {
  OpenDatabaseRequest,
  OpenDatabaseResponse,
  CloseDatabaseRequest,
  CloseDatabaseResponse,
  GetSchemaRequest,
  GetSchemaResponse,
  GetTableDataRequest,
  GetTableDataResponse,
  ExecuteQueryRequest,
  ExecuteQueryResponse,
  ValidateChangesRequest,
  ValidateChangesResponse,
  ApplyChangesRequest,
  ApplyChangesResponse,
  OpenFileDialogRequest,
  OpenFileDialogResponse,
  SaveFileDialogRequest,
  SaveFileDialogResponse,
  ExportRequest,
  ExportResponse,
  GetRecentConnectionsResponse,
  GetPreferencesResponse,
  SetPreferencesRequest,
  SetPreferencesResponse,
} from '../shared/types';

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

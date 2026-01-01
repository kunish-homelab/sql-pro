import type {
  CheckUpdatesRequest,
  CheckUpdatesResponse,
  DisablePluginRequest,
  DisablePluginResponse,
  EnablePluginRequest,
  EnablePluginResponse,
  FetchMarketplaceRequest,
  FetchMarketplaceResponse,
  GetPluginRequest,
  GetPluginResponse,
  InstallPluginRequest,
  InstallPluginResponse,
  ListPluginsRequest,
  ListPluginsResponse,
  PluginEvent,
  UninstallPluginRequest,
  UninstallPluginResponse,
  UpdatePluginRequest,
  UpdatePluginResponse,
} from '../main/types/plugin.d';
import type {
  AIAgentMessage,
  AIAgentQueryRequest,
  AICancelStreamRequest,
  AIFetchAnthropicRequest,
  AIFetchAnthropicResponse,
  AIFetchOpenAIRequest,
  AIFetchOpenAIResponse,
  AIStreamAnthropicRequest,
  AIStreamChunk,
  AIStreamOpenAIRequest,
  AnalyzeQueryPlanRequest,
  AnalyzeQueryPlanResponse,
  ApplyChangesRequest,
  ApplyChangesResponse,
  ClearQueryHistoryRequest,
  ClearQueryHistoryResponse,
  ClearSqlLogsRequest,
  ClearSqlLogsResponse,
  CloseDatabaseRequest,
  CloseDatabaseResponse,
  CloseWindowRequest,
  CloseWindowResponse,
  CompareConnectionsRequest,
  CompareConnectionsResponse,
  CompareConnectionToSnapshotRequest,
  CompareConnectionToSnapshotResponse,
  CompareSnapshotsRequest,
  CompareSnapshotsResponse,
  CreateWindowResponse,
  DeleteQueryHistoryRequest,
  DeleteQueryHistoryResponse,
  DeleteSchemaSnapshotRequest,
  DeleteSchemaSnapshotResponse,
  ExecuteQueryRequest,
  ExecuteQueryResponse,
  ExportComparisonReportRequest,
  ExportComparisonReportResponse,
  ExportRequest,
  ExportResponse,
  GenerateMigrationSQLRequest,
  GenerateMigrationSQLResponse,
  FocusWindowRequest,
  FocusWindowResponse,
  GetAISettingsResponse,
  GetAllWindowsResponse,
  GetClaudeCodePathsResponse,
  GetCurrentWindowResponse,
  GetPasswordRequest,
  GetPasswordResponse,
  GetPreferencesResponse,
  GetQueryHistoryRequest,
  GetQueryHistoryResponse,
  GetRecentConnectionsResponse,
  GetSchemaRequest,
  GetSchemaResponse,
  GetSchemaSnapshotRequest,
  GetSchemaSnapshotResponse,
  GetSchemaSnapshotsResponse,
  GetSqlLogsRequest,
  GetSqlLogsResponse,
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
  ProActivateRequest,
  ProActivateResponse,
  ProDeactivateResponse,
  ProGetStatusResponse,
  RemoveConnectionRequest,
  RemoveConnectionResponse,
  RemovePasswordRequest,
  RemovePasswordResponse,
  SaveAISettingsRequest,
  SaveAISettingsResponse,
  SaveFileDialogRequest,
  SaveFileDialogResponse,
  SavePasswordRequest,
  SavePasswordResponse,
  SaveQueryHistoryRequest,
  SaveQueryHistoryResponse,
  SaveSchemaSnapshotRequest,
  SaveSchemaSnapshotResponse,
  SetPreferencesRequest,
  SetPreferencesResponse,
  SqlLogEntry,
  UpdateConnectionRequest,
  UpdateConnectionResponse,
  UpdateStatus,
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
    analyzeQueryPlan: (
      request: AnalyzeQueryPlanRequest
    ): Promise<AnalyzeQueryPlanResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.DB_ANALYZE_PLAN, request),
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

  // Query history operations
  history: {
    get: (request: GetQueryHistoryRequest): Promise<GetQueryHistoryResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.HISTORY_GET, request),
    save: (
      request: SaveQueryHistoryRequest
    ): Promise<SaveQueryHistoryResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.HISTORY_SAVE, request),
    delete: (
      request: DeleteQueryHistoryRequest
    ): Promise<DeleteQueryHistoryResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.HISTORY_DELETE, request),
    clear: (
      request: ClearQueryHistoryRequest
    ): Promise<ClearQueryHistoryResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.HISTORY_CLEAR, request),
  },

  // SQL log operations
  sqlLog: {
    get: (request: GetSqlLogsRequest): Promise<GetSqlLogsResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.SQL_LOG_GET, request),
    clear: (request: ClearSqlLogsRequest): Promise<ClearSqlLogsResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.SQL_LOG_CLEAR, request),
    onEntry: (callback: (entry: SqlLogEntry) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, entry: SqlLogEntry) =>
        callback(entry);
      ipcRenderer.on(IPC_CHANNELS.SQL_LOG_ENTRY, handler);
      return () => ipcRenderer.off(IPC_CHANNELS.SQL_LOG_ENTRY, handler);
    },
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

  // AI operations
  ai: {
    getSettings: (): Promise<GetAISettingsResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AI_GET_SETTINGS),
    saveSettings: (
      request: SaveAISettingsRequest
    ): Promise<SaveAISettingsResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AI_SAVE_SETTINGS, request),
    getClaudeCodePaths: (): Promise<GetClaudeCodePathsResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AI_GET_CLAUDE_CODE_PATHS),
    fetchAnthropic: (
      request: AIFetchAnthropicRequest
    ): Promise<AIFetchAnthropicResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AI_FETCH_ANTHROPIC, request),
    fetchOpenAI: (
      request: AIFetchOpenAIRequest
    ): Promise<AIFetchOpenAIResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AI_FETCH_OPENAI, request),
    // Streaming APIs
    streamAnthropic: (
      request: AIStreamAnthropicRequest
    ): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.AI_STREAM_ANTHROPIC, request),
    streamOpenAI: (
      request: AIStreamOpenAIRequest
    ): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.AI_STREAM_OPENAI, request),
    cancelStream: (
      request: AICancelStreamRequest
    ): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.AI_CANCEL_STREAM, request),
    onStreamChunk: (callback: (chunk: AIStreamChunk) => void): (() => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        chunk: AIStreamChunk
      ) => callback(chunk);
      ipcRenderer.on(IPC_CHANNELS.AI_STREAM_CHUNK, handler);
      return () => ipcRenderer.off(IPC_CHANNELS.AI_STREAM_CHUNK, handler);
    },
    // Claude Agent SDK APIs
    agentQuery: (
      request: AIAgentQueryRequest
    ): Promise<{ success: boolean; content?: string; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.AI_AGENT_QUERY, request),
    agentCancel: (request: {
      requestId: string;
    }): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.AI_AGENT_CANCEL, request),
    onAgentMessage: (
      callback: (message: AIAgentMessage) => void
    ): (() => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        message: AIAgentMessage
      ) => callback(message);
      ipcRenderer.on(IPC_CHANNELS.AI_AGENT_MESSAGE, handler);
      return () => ipcRenderer.off(IPC_CHANNELS.AI_AGENT_MESSAGE, handler);
    },
  },

  // Pro tier operations
  pro: {
    getStatus: (): Promise<ProGetStatusResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.PRO_GET_STATUS),
    activate: (request: ProActivateRequest): Promise<ProActivateResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.PRO_ACTIVATE, request),
    deactivate: (): Promise<ProDeactivateResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.PRO_DEACTIVATE),
  },

  // System operations
  system: {
    getFonts: (): Promise<{
      success: boolean;
      fonts: string[];
      error?: string;
    }> => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_GET_FONTS),
  },

  // Window operations
  window: {
    create: (): Promise<CreateWindowResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.WINDOW_CREATE),
    close: (request?: CloseWindowRequest): Promise<CloseWindowResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.WINDOW_CLOSE, request || {}),
    focus: (request: FocusWindowRequest): Promise<FocusWindowResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.WINDOW_FOCUS, request),
    getAll: (): Promise<GetAllWindowsResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.WINDOW_GET_ALL),
    getCurrent: (): Promise<GetCurrentWindowResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.WINDOW_GET_CURRENT),
  },

  // Auto-update operations
  update: {
    check: (silent = true): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.UPDATE_CHECK, silent),
    download: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.UPDATE_DOWNLOAD),
    install: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.UPDATE_INSTALL),
    getStatus: (): Promise<{
      success: boolean;
      status?: UpdateStatus;
      error?: string;
    }> => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_STATUS),
    onStatusChange: (
      callback: (status: UpdateStatus) => void
    ): (() => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        status: UpdateStatus
      ) => callback(status);
      ipcRenderer.on('update-status', handler);
      return () => ipcRenderer.off('update-status', handler);
    },
  },

  // Plugin operations
  plugin: {
    list: (request?: ListPluginsRequest): Promise<ListPluginsResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.PLUGIN_LIST, request || {}),
    get: (request: GetPluginRequest): Promise<GetPluginResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.PLUGIN_GET, request),
    install: (request: InstallPluginRequest): Promise<InstallPluginResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.PLUGIN_INSTALL, request),
    uninstall: (
      request: UninstallPluginRequest
    ): Promise<UninstallPluginResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.PLUGIN_UNINSTALL, request),
    enable: (request: EnablePluginRequest): Promise<EnablePluginResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.PLUGIN_ENABLE, request),
    disable: (request: DisablePluginRequest): Promise<DisablePluginResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.PLUGIN_DISABLE, request),
    update: (request: UpdatePluginRequest): Promise<UpdatePluginResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.PLUGIN_UPDATE, request),
    checkUpdates: (
      request?: CheckUpdatesRequest
    ): Promise<CheckUpdatesResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.PLUGIN_CHECK_UPDATES, request || {}),
    fetchMarketplace: (
      request?: FetchMarketplaceRequest
    ): Promise<FetchMarketplaceResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.PLUGIN_MARKETPLACE_FETCH, request || {}),
    onEvent: (callback: (event: PluginEvent) => void): (() => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        pluginEvent: PluginEvent
      ) => callback(pluginEvent);
      ipcRenderer.on(IPC_CHANNELS.PLUGIN_EVENT, handler);
      return () => ipcRenderer.off(IPC_CHANNELS.PLUGIN_EVENT, handler);
    },
  },

  // Schema snapshot operations
  schemaSnapshot: {
    save: (request: SaveSchemaSnapshotRequest): Promise<SaveSchemaSnapshotResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.SCHEMA_SNAPSHOT_SAVE, request),
    getAll: (): Promise<GetSchemaSnapshotsResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.SCHEMA_SNAPSHOT_GET_ALL),
    get: (request: GetSchemaSnapshotRequest): Promise<GetSchemaSnapshotResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.SCHEMA_SNAPSHOT_GET, request),
    delete: (request: DeleteSchemaSnapshotRequest): Promise<DeleteSchemaSnapshotResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.SCHEMA_SNAPSHOT_DELETE, request),
  },

  // Schema comparison operations
  schemaComparison: {
    compareConnections: (request: CompareConnectionsRequest): Promise<CompareConnectionsResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.SCHEMA_COMPARISON_COMPARE_CONNECTIONS, request),
    compareConnectionToSnapshot: (request: CompareConnectionToSnapshotRequest): Promise<CompareConnectionToSnapshotResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.SCHEMA_COMPARISON_COMPARE_CONNECTION_TO_SNAPSHOT, request),
    compareSnapshots: (request: CompareSnapshotsRequest): Promise<CompareSnapshotsResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.SCHEMA_COMPARISON_COMPARE_SNAPSHOTS, request),
    generateMigrationSQL: (request: GenerateMigrationSQLRequest): Promise<GenerateMigrationSQLResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.SCHEMA_COMPARISON_GENERATE_MIGRATION_SQL, request),
    exportReport: (request: ExportComparisonReportRequest): Promise<ExportComparisonReportResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.SCHEMA_COMPARISON_EXPORT_REPORT, request),
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

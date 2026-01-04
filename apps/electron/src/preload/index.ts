import type {
  AddQueryToCollectionRequest,
  AddQueryToCollectionResponse,
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
  CheckUnsavedChangesRequest,
  CheckUnsavedChangesResponse,
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
  CompareTablesRequest,
  CompareTablesResponse,
  CreateFolderRequest,
  CreateFolderResponse,
  CreateWindowResponse,
  DeleteCollectionRequest,
  DeleteCollectionResponse,
  DeleteFolderRequest,
  DeleteFolderResponse,
  DeleteProfileRequest,
  DeleteProfileResponse,
  DeleteQueryHistoryRequest,
  DeleteQueryHistoryResponse,
  DeleteSavedQueryRequest,
  DeleteSavedQueryResponse,
  DeleteSchemaSnapshotRequest,
  DeleteSchemaSnapshotResponse,
  ExecuteQueryRequest,
  ExecuteQueryResponse,
  ExportBundleRequest,
  ExportBundleResponse,
  ExportCollectionsRequest,
  ExportCollectionsResponse,
  ExportComparisonReportRequest,
  ExportComparisonReportResponse,
  ExportProfilesRequest,
  ExportProfilesResponse,
  ExportQueryRequest,
  ExportQueryResponse,
  ExportRequest,
  ExportResponse,
  ExportSchemaRequest,
  ExportSchemaResponse,
  FocusWindowRequest,
  FocusWindowResponse,
  GenerateMigrationSQLRequest,
  GenerateMigrationSQLResponse,
  GenerateSyncSQLRequest,
  GenerateSyncSQLResponse,
  GetAISettingsResponse,
  GetAllWindowsResponse,
  GetClaudeCodePathsResponse,
  GetCollectionsResponse,
  GetCurrentWindowResponse,
  GetFoldersRequest,
  GetFoldersResponse,
  GetPasswordRequest,
  GetPasswordResponse,
  GetPreferencesResponse,
  GetProfilesRequest,
  GetProfilesResponse,
  GetQueryHistoryRequest,
  GetQueryHistoryResponse,
  GetRecentConnectionsResponse,
  GetSavedQueriesRequest,
  GetSavedQueriesResponse,
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
  ImportBundleRequest,
  ImportBundleResponse,
  ImportCollectionsRequest,
  ImportCollectionsResponse,
  ImportProfilesRequest,
  ImportProfilesResponse,
  ImportQueryRequest,
  ImportQueryResponse,
  ImportSchemaRequest,
  ImportSchemaResponse,
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
  RemoveQueryFromCollectionRequest,
  RemoveQueryFromCollectionResponse,
  SaveAISettingsRequest,
  SaveAISettingsResponse,
  SaveCollectionRequest,
  SaveCollectionResponse,
  SaveFileDialogRequest,
  SaveFileDialogResponse,
  SavePasswordRequest,
  SavePasswordResponse,
  SaveProfileRequest,
  SaveProfileResponse,
  SaveQueryHistoryRequest,
  SaveQueryHistoryResponse,
  SaveSavedQueryRequest,
  SaveSavedQueryResponse,
  SaveSchemaSnapshotRequest,
  SaveSchemaSnapshotResponse,
  SetPreferencesRequest,
  SetPreferencesResponse,
  ShortcutsUpdatePayload,
  SqlLogEntry,
  ToggleFavoriteRequest,
  ToggleFavoriteResponse,
  UpdateCollectionRequest,
  UpdateCollectionResponse,
  UpdateConnectionRequest,
  UpdateConnectionResponse,
  UpdateFolderRequest,
  UpdateFolderResponse,
  UpdateProfileRequest,
  UpdateProfileResponse,
  UpdateSavedQueryRequest,
  UpdateSavedQueryResponse,
  ValidateChangesRequest,
  ValidateChangesResponse,
} from '@shared/types';
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
} from '@shared/types/plugin.d';
import type {
  GetRendererStateRequest,
  GetRendererStateResponse,
  RendererStoreSchema,
  SetRendererStateRequest,
  SetRendererStateResponse,
  UpdateRendererStateRequest,
  UpdateRendererStateResponse,
} from '@shared/types/renderer-store';
import { electronAPI } from '@electron-toolkit/preload';
import { IPC_CHANNELS } from '@shared/types';
import { RENDERER_STORE_CHANNELS } from '@shared/types/renderer-store';
import { contextBridge, ipcRenderer, webUtils } from 'electron';

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
    onBeforeQuit: (callback: () => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent) => callback();
      ipcRenderer.on(IPC_CHANNELS.PREVENT_QUIT, handler);
      return () => ipcRenderer.off(IPC_CHANNELS.PREVENT_QUIT, handler);
    },
    confirmQuit: (shouldQuit: boolean): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('app:confirm-quit', { shouldQuit }),
  },

  // Unsaved changes operations
  unsavedChanges: {
    check: (
      request: CheckUnsavedChangesRequest
    ): Promise<CheckUnsavedChangesResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.UNSAVED_CHANGES_CHECK, request),
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

  // Profile operations
  profile: {
    save: (request: SaveProfileRequest): Promise<SaveProfileResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.PROFILE_SAVE, request),
    update: (request: UpdateProfileRequest): Promise<UpdateProfileResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.PROFILE_UPDATE, request),
    delete: (request: DeleteProfileRequest): Promise<DeleteProfileResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.PROFILE_DELETE, request),
    getAll: (request: GetProfilesRequest): Promise<GetProfilesResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.PROFILE_GET_ALL, request),
    export: (request: ExportProfilesRequest): Promise<ExportProfilesResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.PROFILE_EXPORT, request),
    import: (request: ImportProfilesRequest): Promise<ImportProfilesResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.PROFILE_IMPORT, request),
  },

  // Folder operations
  folder: {
    create: (request: CreateFolderRequest): Promise<CreateFolderResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.FOLDER_CREATE, request),
    update: (request: UpdateFolderRequest): Promise<UpdateFolderResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.FOLDER_UPDATE, request),
    delete: (request: DeleteFolderRequest): Promise<DeleteFolderResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.FOLDER_DELETE, request),
    getAll: (request: GetFoldersRequest): Promise<GetFoldersResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.FOLDER_GET_ALL, request),
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

  // Keyboard shortcuts
  shortcuts: {
    update: (request: ShortcutsUpdatePayload): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.SHORTCUTS_UPDATE, request),
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
  },

  // Schema snapshot operations
  schemaSnapshot: {
    save: (
      request: SaveSchemaSnapshotRequest
    ): Promise<SaveSchemaSnapshotResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.SCHEMA_SNAPSHOT_SAVE, request),
    get: (
      request: GetSchemaSnapshotRequest
    ): Promise<GetSchemaSnapshotResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.SCHEMA_SNAPSHOT_GET, request),
    getAll: (): Promise<GetSchemaSnapshotsResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.SCHEMA_SNAPSHOT_GET_ALL),
    delete: (
      request: DeleteSchemaSnapshotRequest
    ): Promise<DeleteSchemaSnapshotResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.SCHEMA_SNAPSHOT_DELETE, request),
  },

  // Comparison operations
  comparison: {
    compareConnections: (
      request: CompareConnectionsRequest
    ): Promise<CompareConnectionsResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.COMPARISON_COMPARE_CONNECTIONS, request),
    compareConnectionToSnapshot: (
      request: CompareConnectionToSnapshotRequest
    ): Promise<CompareConnectionToSnapshotResponse> =>
      ipcRenderer.invoke(
        IPC_CHANNELS.COMPARISON_COMPARE_CONNECTION_TO_SNAPSHOT,
        request
      ),
    compareSnapshots: (
      request: CompareSnapshotsRequest
    ): Promise<CompareSnapshotsResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.COMPARISON_COMPARE_SNAPSHOTS, request),
    compareTables: (
      request: CompareTablesRequest
    ): Promise<CompareTablesResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.COMPARISON_COMPARE_TABLES, request),
    exportComparisonReport: (
      request: ExportComparisonReportRequest
    ): Promise<ExportComparisonReportResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.COMPARISON_EXPORT_REPORT, request),
  },

  // Migration operations
  migration: {
    generateSQL: (
      request: GenerateMigrationSQLRequest
    ): Promise<GenerateMigrationSQLResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.MIGRATION_GENERATE_SQL, request),
    generateSyncSQL: (
      request: GenerateSyncSQLRequest
    ): Promise<GenerateSyncSQLResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.MIGRATION_GENERATE_SYNC_SQL, request),
  },

  // Query operations
  query: {
    getSavedQueries: (
      request: GetSavedQueriesRequest
    ): Promise<GetSavedQueriesResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.QUERY_GET_SAVED_QUERIES, request),
    saveSavedQuery: (
      request: SaveSavedQueryRequest
    ): Promise<SaveSavedQueryResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.QUERY_SAVE_SAVED_QUERY, request),
    updateSavedQuery: (
      request: UpdateSavedQueryRequest
    ): Promise<UpdateSavedQueryResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.QUERY_UPDATE_SAVED_QUERY, request),
    deleteSavedQuery: (
      request: DeleteSavedQueryRequest
    ): Promise<DeleteSavedQueryResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.QUERY_DELETE_SAVED_QUERY, request),
    toggleFavorite: (
      request: ToggleFavoriteRequest
    ): Promise<ToggleFavoriteResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.QUERY_TOGGLE_FAVORITE, request),
    exportQuery: (request: ExportQueryRequest): Promise<ExportQueryResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.QUERY_EXPORT_QUERY, request),
    importQuery: (request: ImportQueryRequest): Promise<ImportQueryResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.QUERY_IMPORT_QUERY, request),
  },

  // Collection operations
  collection: {
    getAll: (): Promise<GetCollectionsResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.COLLECTION_GET_ALL),
    save: (request: SaveCollectionRequest): Promise<SaveCollectionResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.COLLECTION_SAVE, request),
    update: (
      request: UpdateCollectionRequest
    ): Promise<UpdateCollectionResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.COLLECTION_UPDATE, request),
    delete: (
      request: DeleteCollectionRequest
    ): Promise<DeleteCollectionResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.COLLECTION_DELETE, request),
    addQuery: (
      request: AddQueryToCollectionRequest
    ): Promise<AddQueryToCollectionResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.COLLECTION_ADD_QUERY, request),
    removeQuery: (
      request: RemoveQueryFromCollectionRequest
    ): Promise<RemoveQueryFromCollectionResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.COLLECTION_REMOVE_QUERY, request),
    export: (
      request: ExportCollectionsRequest
    ): Promise<ExportCollectionsResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.COLLECTION_EXPORT, request),
    import: (
      request: ImportCollectionsRequest
    ): Promise<ImportCollectionsResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.COLLECTION_IMPORT, request),
  },

  // Import/export bundle operations
  bundle: {
    export: (request: ExportBundleRequest): Promise<ExportBundleResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.BUNDLE_EXPORT, request),
    import: (request: ImportBundleRequest): Promise<ImportBundleResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.BUNDLE_IMPORT, request),
  },

  // Schema operations
  schema: {
    export: (request: ExportSchemaRequest): Promise<ExportSchemaResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.SCHEMA_EXPORT, request),
    import: (request: ImportSchemaRequest): Promise<ImportSchemaResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.SCHEMA_IMPORT, request),
  },

  // Plugin operations
  plugin: {
    list: (request: ListPluginsRequest): Promise<ListPluginsResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.PLUGIN_LIST, request),
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
    fetchMarketplace: (
      request: FetchMarketplaceRequest
    ): Promise<FetchMarketplaceResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.PLUGIN_FETCH_MARKETPLACE, request),
    checkUpdates: (
      request: CheckUpdatesRequest
    ): Promise<CheckUpdatesResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.PLUGIN_CHECK_UPDATES, request),
    onEvent: (callback: (event: PluginEvent) => void): (() => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        pluginEvent: PluginEvent
      ) => callback(pluginEvent);
      ipcRenderer.on(IPC_CHANNELS.PLUGIN_EVENT, handler);
      return () => ipcRenderer.off(IPC_CHANNELS.PLUGIN_EVENT, handler);
    },
  },

  // Renderer store persistence operations
  rendererStore: {
    get: <K extends keyof RendererStoreSchema>(
      request: GetRendererStateRequest
    ): Promise<GetRendererStateResponse<RendererStoreSchema[K]>> =>
      ipcRenderer.invoke(RENDERER_STORE_CHANNELS.GET, request),
    set: <K extends keyof RendererStoreSchema>(
      request: SetRendererStateRequest<RendererStoreSchema[K]>
    ): Promise<SetRendererStateResponse> =>
      ipcRenderer.invoke(RENDERER_STORE_CHANNELS.SET, request),
    update: <K extends keyof RendererStoreSchema>(
      request: UpdateRendererStateRequest<Partial<RendererStoreSchema[K]>>
    ): Promise<UpdateRendererStateResponse> =>
      ipcRenderer.invoke(RENDERER_STORE_CHANNELS.UPDATE, request),
    reset: (request: {
      key: keyof RendererStoreSchema;
    }): Promise<SetRendererStateResponse> =>
      ipcRenderer.invoke(RENDERER_STORE_CHANNELS.RESET, request),
  },
};

contextBridge.exposeInMainWorld('sqlPro', sqlProAPI);
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

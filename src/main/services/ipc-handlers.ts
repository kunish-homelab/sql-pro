import type {
  AISettings,
  AnalyzeQueryPlanRequest,
  ApplyChangesRequest,
  ClearQueryHistoryRequest,
  CloseDatabaseRequest,
  DeleteQueryHistoryRequest,
  ExecuteQueryRequest,
  ExportRequest,
  GetPasswordRequest,
  GetQueryHistoryRequest,
  GetSchemaRequest,
  GetTableDataRequest,
  HasPasswordRequest,
  OpenDatabaseRequest,
  OpenFileDialogRequest,
  QueryHistoryEntry,
  RemoveConnectionRequest,
  RemovePasswordRequest,
  SaveAISettingsRequest,
  SaveFileDialogRequest,
  SavePasswordRequest,
  SaveQueryHistoryRequest,
  UpdateConnectionRequest,
  ValidateChangesRequest,
} from '../../shared/types';
import fs from 'node:fs';
import path from 'node:path';
import { app, dialog, ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/types';
import { databaseService } from './database';
import { passwordStorageService } from './password-storage';

// Lazy-loaded paths (app.getPath only works after app ready)
let _preferencesPath: string | null = null;
let _recentConnectionsPath: string | null = null;
let _queryHistoryPath: string | null = null;
let _aiSettingsPath: string | null = null;

function getPreferencesPath(): string {
  if (!_preferencesPath) {
    _preferencesPath = path.join(app.getPath('userData'), 'preferences.json');
  }
  return _preferencesPath;
}

function getRecentConnectionsPath(): string {
  if (!_recentConnectionsPath) {
    _recentConnectionsPath = path.join(
      app.getPath('userData'),
      'recent-connections.json'
    );
  }
  return _recentConnectionsPath;
}

function getAISettingsPath(): string {
  if (!_aiSettingsPath) {
    _aiSettingsPath = path.join(app.getPath('userData'), 'ai-settings.json');
  }
  return _aiSettingsPath;
}

function getQueryHistoryPath(): string {
  if (!_queryHistoryPath) {
    _queryHistoryPath = path.join(
      app.getPath('userData'),
      'query-history.json'
    );
  }
  return _queryHistoryPath;
}

interface StoredPreferences {
  theme: 'light' | 'dark' | 'system';
  defaultPageSize: number;
  confirmBeforeApply: boolean;
  recentConnectionsLimit: number;
}

interface StoredRecentConnection {
  path: string;
  filename: string;
  isEncrypted: boolean;
  lastOpened: string;
  displayName?: string;
  readOnly?: boolean;
  createdAt?: string;
}

function loadPreferences(): StoredPreferences {
  try {
    const preferencesPath = getPreferencesPath();
    if (fs.existsSync(preferencesPath)) {
      return JSON.parse(fs.readFileSync(preferencesPath, 'utf-8'));
    }
  } catch {
    // Return defaults
  }
  return {
    theme: 'system',
    defaultPageSize: 100,
    confirmBeforeApply: true,
    recentConnectionsLimit: 10,
  };
}

function savePreferences(prefs: StoredPreferences): void {
  fs.writeFileSync(getPreferencesPath(), JSON.stringify(prefs, null, 2));
}

function loadRecentConnections(): StoredRecentConnection[] {
  try {
    const recentConnectionsPath = getRecentConnectionsPath();
    if (fs.existsSync(recentConnectionsPath)) {
      return JSON.parse(fs.readFileSync(recentConnectionsPath, 'utf-8'));
    }
  } catch {
    // Return empty
  }
  return [];
}

function saveRecentConnections(connections: StoredRecentConnection[]): void {
  fs.writeFileSync(
    getRecentConnectionsPath(),
    JSON.stringify(connections, null, 2)
  );
}

// AI settings storage
function loadAISettings(): AISettings | null {
  try {
    const settingsPath = getAISettingsPath();
    if (fs.existsSync(settingsPath)) {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    }
  } catch {
    // Return null if not configured
  }
  return null;
}

function saveAISettings(settings: AISettings): void {
  fs.writeFileSync(getAISettingsPath(), JSON.stringify(settings, null, 2));
}

// Query history storage format: { [dbPath]: QueryHistoryEntry[] }
interface StoredQueryHistory {
  [dbPath: string]: QueryHistoryEntry[];
}

/**
 * Loads all query history from storage
 */
function loadAllQueryHistory(): StoredQueryHistory {
  try {
    const historyPath = getQueryHistoryPath();
    if (fs.existsSync(historyPath)) {
      return JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
    }
  } catch {
    // Return empty if file doesn't exist or is invalid
  }
  return {};
}

/**
 * Saves all query history to storage
 */
function saveAllQueryHistory(history: StoredQueryHistory): void {
  fs.writeFileSync(getQueryHistoryPath(), JSON.stringify(history, null, 2));
}

/**
 * Loads query history for a specific database
 */
export function loadQueryHistory(dbPath: string): QueryHistoryEntry[] {
  const allHistory = loadAllQueryHistory();
  return allHistory[dbPath] || [];
}

/**
 * Saves a query history entry for a specific database
 */
export function saveQueryHistoryEntry(entry: QueryHistoryEntry): void {
  const allHistory = loadAllQueryHistory();
  const dbHistory = allHistory[entry.dbPath] || [];

  // Add new entry at the beginning (most recent first)
  dbHistory.unshift(entry);

  allHistory[entry.dbPath] = dbHistory;
  saveAllQueryHistory(allHistory);
}

/**
 * Deletes a specific query history entry
 */
export function deleteQueryHistoryEntry(
  dbPath: string,
  entryId: string
): { success: boolean; error?: string } {
  try {
    const allHistory = loadAllQueryHistory();
    const dbHistory = allHistory[dbPath] || [];

    const filtered = dbHistory.filter((entry) => entry.id !== entryId);

    if (filtered.length === dbHistory.length) {
      // Entry not found, but not an error
      return { success: true };
    }

    allHistory[dbPath] = filtered;
    saveAllQueryHistory(allHistory);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'STORAGE_ERROR',
    };
  }
}

/**
 * Clears all query history for a specific database
 */
export function clearQueryHistory(dbPath: string): {
  success: boolean;
  error?: string;
} {
  try {
    const allHistory = loadAllQueryHistory();

    // Remove history for this database
    delete allHistory[dbPath];

    saveAllQueryHistory(allHistory);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'STORAGE_ERROR',
    };
  }
}

function addRecentConnection(
  filePath: string,
  filename: string,
  isEncrypted: boolean,
  displayName?: string,
  readOnly?: boolean
): void {
  const connections = loadRecentConnections();
  const prefs = loadPreferences();

  // Check if this connection already exists
  const existing = connections.find((c) => c.path === filePath);

  // Remove existing entry for this path
  const filtered = connections.filter((c) => c.path !== filePath);

  const now = new Date().toISOString();

  // Add new entry at the beginning, preserving existing settings if not provided
  filtered.unshift({
    path: filePath,
    filename,
    isEncrypted,
    lastOpened: now,
    displayName: displayName ?? existing?.displayName ?? filename,
    readOnly: readOnly ?? existing?.readOnly ?? false,
    createdAt: existing?.createdAt ?? now,
  });

  // Limit to configured max
  const limited = filtered.slice(0, prefs.recentConnectionsLimit);

  saveRecentConnections(limited);
}

/**
 * Updates an existing connection profile's settings (T006)
 */
function updateConnection(
  filePath: string,
  updates: { displayName?: string; readOnly?: boolean }
): { success: boolean; error?: string } {
  try {
    const connections = loadRecentConnections();
    const index = connections.findIndex((c) => c.path === filePath);

    if (index === -1) {
      return { success: false, error: 'CONNECTION_NOT_FOUND' };
    }

    // Validate displayName if provided
    if (updates.displayName !== undefined) {
      if (
        updates.displayName.length === 0 ||
        updates.displayName.length > 100
      ) {
        return { success: false, error: 'INVALID_DISPLAY_NAME' };
      }
    }

    // Update the connection
    if (updates.displayName !== undefined) {
      connections[index].displayName = updates.displayName;
    }
    if (updates.readOnly !== undefined) {
      connections[index].readOnly = updates.readOnly;
    }

    saveRecentConnections(connections);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'STORAGE_ERROR',
    };
  }
}

/**
 * Removes a connection profile from the recent list (T007)
 */
function removeConnection(
  filePath: string,
  removePassword?: boolean
): { success: boolean; error?: string } {
  try {
    const connections = loadRecentConnections();
    const filtered = connections.filter((c) => c.path !== filePath);

    if (filtered.length === connections.length) {
      // Connection was not found, but this is not an error - it may have been removed already
      return { success: true };
    }

    saveRecentConnections(filtered);

    // Optionally remove the saved password
    if (removePassword) {
      try {
        passwordStorageService.removePassword(filePath);
      } catch {
        // Password removal failure shouldn't fail the entire operation
        // The connection is already removed from the list
      }
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'STORAGE_ERROR',
    };
  }
}

export function setupIpcHandlers(): void {
  // Database: Open
  ipcMain.handle(
    IPC_CHANNELS.DB_OPEN,
    async (_event, request: OpenDatabaseRequest) => {
      const result = await databaseService.open(
        request.path,
        request.password,
        request.readOnly
      );

      if (result.success) {
        addRecentConnection(
          request.path,
          result.connection.filename,
          result.connection.isEncrypted
        );
      }

      return result;
    }
  );

  // Database: Close
  ipcMain.handle(
    IPC_CHANNELS.DB_CLOSE,
    async (_event, request: CloseDatabaseRequest) => {
      return databaseService.close(request.connectionId);
    }
  );

  // Database: Get Schema
  ipcMain.handle(
    IPC_CHANNELS.DB_GET_SCHEMA,
    async (_event, request: GetSchemaRequest) => {
      return databaseService.getSchema(request.connectionId);
    }
  );

  // Database: Get Table Data
  ipcMain.handle(
    IPC_CHANNELS.DB_GET_TABLE_DATA,
    async (_event, request: GetTableDataRequest) => {
      return databaseService.getTableData(
        request.connectionId,
        request.table,
        request.page,
        request.pageSize,
        request.sortColumn,
        request.sortDirection,
        request.filters,
        request.schema
      );
    }
  );

  // Database: Execute Query
  ipcMain.handle(
    IPC_CHANNELS.DB_EXECUTE_QUERY,
    async (_event, request: ExecuteQueryRequest) => {
      return databaseService.executeQuery(request.connectionId, request.query);
    }
  );

  // Database: Validate Changes
  ipcMain.handle(
    IPC_CHANNELS.DB_VALIDATE_CHANGES,
    async (_event, request: ValidateChangesRequest) => {
      return databaseService.validateChanges(
        request.connectionId,
        request.changes
      );
    }
  );

  // Database: Apply Changes
  ipcMain.handle(
    IPC_CHANNELS.DB_APPLY_CHANGES,
    async (_event, request: ApplyChangesRequest) => {
      return databaseService.applyChanges(
        request.connectionId,
        request.changes
      );
    }
  );

  // Database: Analyze Query Plan
  ipcMain.handle(
    IPC_CHANNELS.DB_ANALYZE_PLAN,
    async (_event, request: AnalyzeQueryPlanRequest) => {
      return databaseService.analyzeQueryPlan(
        request.connectionId,
        request.query
      );
    }
  );

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

  // Export: Data
  ipcMain.handle(
    IPC_CHANNELS.EXPORT_DATA,
    async (_event, request: ExportRequest) => {
      try {
        // Get all data from table
        const dataResult = databaseService.getTableData(
          request.connectionId,
          request.table,
          1,
          1000000, // Large number to get all rows
          undefined,
          undefined,
          undefined
        );

        if (!dataResult.success) {
          return dataResult;
        }

        const { columns, rows } = dataResult;
        let content: string;

        switch (request.format) {
          case 'csv': {
            const header =
              request.includeHeaders !== false
                ? `${columns.map((c) => `"${c.name}"`).join(',')}\n`
                : '';
            const body = rows
              .map((row) =>
                columns
                  .map((c) => {
                    const val = row[c.name];
                    if (val === null) return '';
                    if (typeof val === 'string')
                      return `"${val.replace(/"/g, '""')}"`;
                    return String(val);
                  })
                  .join(',')
              )
              .join('\n');
            content = header + body;
            break;
          }
          case 'json': {
            content = JSON.stringify(rows, null, 2);
            break;
          }
          case 'sql': {
            content = rows
              .map((row) => {
                const cols = columns.map((c) => `"${c.name}"`).join(', ');
                const vals = columns
                  .map((c) => {
                    const val = row[c.name];
                    if (val === null) return 'NULL';
                    if (typeof val === 'string')
                      return `'${val.replace(/'/g, "''")}'`;
                    return String(val);
                  })
                  .join(', ');
                return `INSERT INTO "${request.table}" (${cols}) VALUES (${vals});`;
              })
              .join('\n');
            break;
          }
          default:
            return { success: false, error: 'Unsupported export format' };
        }

        fs.writeFileSync(request.filePath, content, 'utf-8');
        return { success: true, rowsExported: rows.length };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Failed to export data',
        };
      }
    }
  );

  // App: Get Recent Connections
  ipcMain.handle(IPC_CHANNELS.APP_GET_RECENT_CONNECTIONS, async () => {
    return { success: true, connections: loadRecentConnections() };
  });

  // App: Get Preferences
  ipcMain.handle(IPC_CHANNELS.APP_GET_PREFERENCES, async () => {
    return { success: true, preferences: loadPreferences() };
  });

  // App: Set Preferences
  ipcMain.handle(
    IPC_CHANNELS.APP_SET_PREFERENCES,
    async (_event, request: { preferences: Partial<StoredPreferences> }) => {
      try {
        const current = loadPreferences();
        const updated = { ...current, ...request.preferences };
        savePreferences(updated);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to save preferences',
        };
      }
    }
  );

  // Password: Check if storage is available
  ipcMain.handle(IPC_CHANNELS.PASSWORD_IS_AVAILABLE, async () => {
    return {
      success: true,
      available: passwordStorageService.isAvailable(),
    };
  });

  // Password: Save
  ipcMain.handle(
    IPC_CHANNELS.PASSWORD_SAVE,
    async (_event, request: SavePasswordRequest) => {
      try {
        const success = passwordStorageService.savePassword(
          request.dbPath,
          request.password
        );
        if (success) {
          return { success: true };
        }
        return {
          success: false,
          error: 'Password encryption is not available on this system',
        };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Failed to save password',
        };
      }
    }
  );

  // Password: Get
  ipcMain.handle(
    IPC_CHANNELS.PASSWORD_GET,
    async (_event, request: GetPasswordRequest) => {
      try {
        const password = passwordStorageService.getPassword(request.dbPath);
        if (password !== null) {
          return { success: true, password };
        }
        return { success: true, password: undefined };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to retrieve password',
        };
      }
    }
  );

  // Password: Has
  ipcMain.handle(
    IPC_CHANNELS.PASSWORD_HAS,
    async (_event, request: HasPasswordRequest) => {
      return {
        success: true,
        hasPassword: passwordStorageService.hasPassword(request.dbPath),
      };
    }
  );

  // Password: Remove
  ipcMain.handle(
    IPC_CHANNELS.PASSWORD_REMOVE,
    async (_event, request: RemovePasswordRequest) => {
      try {
        passwordStorageService.removePassword(request.dbPath);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to remove password',
        };
      }
    }
  );

  // Connection: Update (T008)
  ipcMain.handle(
    IPC_CHANNELS.CONNECTION_UPDATE,
    async (_event, request: UpdateConnectionRequest) => {
      return updateConnection(request.path, {
        displayName: request.displayName,
        readOnly: request.readOnly,
      });
    }
  );

  // Connection: Remove (T009)
  ipcMain.handle(
    IPC_CHANNELS.CONNECTION_REMOVE,
    async (_event, request: RemoveConnectionRequest) => {
      return removeConnection(request.path, request.removePassword);
    }
  );

  // History: Get query history for a database
  ipcMain.handle(
    IPC_CHANNELS.HISTORY_GET,
    async (_event, request: GetQueryHistoryRequest) => {
      try {
        const history = loadQueryHistory(request.dbPath);
        return { success: true, history };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Failed to load history',
        };
      }
    }
  );

  // History: Save a query history entry
  ipcMain.handle(
    IPC_CHANNELS.HISTORY_SAVE,
    async (_event, request: SaveQueryHistoryRequest) => {
      try {
        saveQueryHistoryEntry(request.entry);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Failed to save history',
        };
      }
    }
  );

  // History: Delete a specific history entry
  ipcMain.handle(
    IPC_CHANNELS.HISTORY_DELETE,
    async (_event, request: DeleteQueryHistoryRequest) => {
      return deleteQueryHistoryEntry(request.dbPath, request.entryId);
    }
  );

  // History: Clear all history for a database
  ipcMain.handle(
    IPC_CHANNELS.HISTORY_CLEAR,
    async (_event, request: ClearQueryHistoryRequest) => {
      return clearQueryHistory(request.dbPath);
    }
  );

  // AI: Get settings
  ipcMain.handle(IPC_CHANNELS.AI_GET_SETTINGS, async () => {
    try {
      const settings = loadAISettings();
      return { success: true, settings };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to load AI settings',
      };
    }
  });

  // AI: Save settings
  ipcMain.handle(
    IPC_CHANNELS.AI_SAVE_SETTINGS,
    async (_event, request: SaveAISettingsRequest) => {
      try {
        saveAISettings(request.settings);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to save AI settings',
        };
      }
    }
  );
}

export function cleanupIpcHandlers(): void {
  databaseService.closeAll();
}

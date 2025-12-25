import { ipcMain, dialog, app } from 'electron';
import { databaseService } from './database';
import {
  IPC_CHANNELS,
  type OpenDatabaseRequest,
  type CloseDatabaseRequest,
  type GetSchemaRequest,
  type GetTableDataRequest,
  type ExecuteQueryRequest,
  type ValidateChangesRequest,
  type ApplyChangesRequest,
  type OpenFileDialogRequest,
  type SaveFileDialogRequest,
  type ExportRequest,
} from '../../shared/types';
import fs from 'fs';
import path from 'path';

// Lazy-loaded paths (app.getPath only works after app ready)
let _preferencesPath: string | null = null;
let _recentConnectionsPath: string | null = null;

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

function addRecentConnection(
  filePath: string,
  filename: string,
  isEncrypted: boolean
): void {
  const connections = loadRecentConnections();
  const prefs = loadPreferences();

  // Remove existing entry for this path
  const filtered = connections.filter((c) => c.path !== filePath);

  // Add new entry at the beginning
  filtered.unshift({
    path: filePath,
    filename,
    isEncrypted,
    lastOpened: new Date().toISOString(),
  });

  // Limit to configured max
  const limited = filtered.slice(0, prefs.recentConnectionsLimit);

  saveRecentConnections(limited);
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
        request.filters
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
                ? columns.map((c) => `"${c.name}"`).join(',') + '\n'
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
}

export function cleanupIpcHandlers(): void {
  databaseService.closeAll();
}

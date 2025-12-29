import type {
  AIFetchAnthropicRequest,
  AIFetchOpenAIRequest,
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
  RemoveConnectionRequest,
  RemovePasswordRequest,
  SaveAISettingsRequest,
  SaveFileDialogRequest,
  SavePasswordRequest,
  SaveQueryHistoryRequest,
  UpdateConnectionRequest,
  ValidateChangesRequest,
} from '../../shared/types';
import type { StoredPreferences } from './store';
import fs from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import { dialog, ipcMain } from 'electron';
import OpenAI from 'openai';
import { IPC_CHANNELS } from '../../shared/types';
import { databaseService } from './database';
import { passwordStorageService } from './password-storage';
import {
  addRecentConnection,
  clearQueryHistory,
  deleteQueryHistoryEntry,
  getAISettings,
  getPreferences,
  getQueryHistory,
  getRecentConnections,
  removeRecentConnection,
  saveAISettings,
  saveQueryHistoryEntry,
  setPreferences,
  updateRecentConnection,
} from './store';

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
    return { success: true, connections: getRecentConnections() };
  });

  // App: Get Preferences
  ipcMain.handle(IPC_CHANNELS.APP_GET_PREFERENCES, async () => {
    return { success: true, preferences: getPreferences() };
  });

  // App: Set Preferences
  ipcMain.handle(
    IPC_CHANNELS.APP_SET_PREFERENCES,
    async (_event, request: { preferences: Partial<StoredPreferences> }) => {
      try {
        setPreferences(request.preferences);
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
      return updateRecentConnection(request.path, {
        displayName: request.displayName,
        readOnly: request.readOnly,
      });
    }
  );

  // Connection: Remove (T009)
  ipcMain.handle(
    IPC_CHANNELS.CONNECTION_REMOVE,
    async (_event, request: RemoveConnectionRequest) => {
      const result = removeRecentConnection(request.path);

      // Optionally remove the saved password
      if (result.success && request.removePassword) {
        try {
          passwordStorageService.removePassword(request.path);
        } catch {
          // Password removal failure shouldn't fail the entire operation
        }
      }

      return result;
    }
  );

  // History: Get query history for a database
  ipcMain.handle(
    IPC_CHANNELS.HISTORY_GET,
    async (_event, request: GetQueryHistoryRequest) => {
      try {
        const history = getQueryHistory(request.dbPath);
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
      const settings = getAISettings();
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

  // AI: Fetch from Anthropic-compatible API using official SDK (bypasses CORS)
  ipcMain.handle(
    IPC_CHANNELS.AI_FETCH_ANTHROPIC,
    async (_event, request: AIFetchAnthropicRequest) => {
      try {
        // Create Anthropic client with custom baseURL if provided
        const client = new Anthropic({
          apiKey: request.apiKey,
          baseURL: request.baseUrl,
        });

        // Use official SDK to make the request
        const response = await client.messages.create({
          model: request.model,
          max_tokens: request.maxTokens || 1024,
          system: request.system,
          messages: request.messages.map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
        });

        // Extract text content from response
        const textBlock = response.content.find(
          (block) => block.type === 'text'
        );
        const content =
          textBlock && 'text' in textBlock ? textBlock.text.trim() : null;

        if (!content) {
          return { success: false, error: 'No content in response' };
        }

        return { success: true, content };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Failed to fetch from AI',
        };
      }
    }
  );

  // AI: Fetch from OpenAI-compatible API using official SDK (bypasses CORS)
  ipcMain.handle(
    IPC_CHANNELS.AI_FETCH_OPENAI,
    async (_event, request: AIFetchOpenAIRequest) => {
      try {
        // Create OpenAI client with custom baseURL if provided
        const client = new OpenAI({
          apiKey: request.apiKey,
          baseURL: request.baseUrl,
        });

        // Use official SDK to make the request
        const response = await client.chat.completions.create({
          model: request.model,
          messages: request.messages.map((m) => ({
            role: m.role as 'user' | 'assistant' | 'system',
            content: m.content,
          })),
          ...(request.responseFormat && {
            response_format: request.responseFormat as { type: 'json_object' },
          }),
        });

        const content = response.choices[0]?.message?.content?.trim() || null;

        if (!content) {
          return { success: false, error: 'No content in response' };
        }

        return { success: true, content };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Failed to fetch from AI',
        };
      }
    }
  );
}

export function cleanupIpcHandlers(): void {
  databaseService.closeAll();
}

import type {
  AIFetchAnthropicRequest,
  AIFetchOpenAIRequest,
  AnalyzeQueryPlanRequest,
  ApplyChangesRequest,
  ClearQueryHistoryRequest,
  CloseDatabaseRequest,
  CloseWindowRequest,
  DeleteQueryHistoryRequest,
  ExecuteQueryRequest,
  ExportRequest,
  FocusWindowRequest,
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
import { exec } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import { promisify } from 'node:util';
import Anthropic from '@anthropic-ai/sdk';
import { BrowserWindow, dialog, ipcMain } from 'electron';
import OpenAI from 'openai';
import { IPC_CHANNELS } from '../../shared/types';
import {
  generateCSV,
  generateExcel,
  generateJSON,
  generateSQL,
} from '../lib/export-generators';
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
import {
  checkForUpdates,
  downloadUpdate,
  getUpdateStatus,
  quitAndInstall,
} from './updater';
import { windowManager } from './window-manager';

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
        let columns: {
          name: string;
          type: string;
          nullable: boolean;
          defaultValue: string | null;
          isPrimaryKey: boolean;
        }[];
        let rows: Record<string, unknown>[];

        // Check if pre-filtered rows were provided
        if (request.rows && request.rows.length > 0) {
          // Use provided rows directly (for filtered/selected data export)
          rows = request.rows;
          // Create column info from the first row's keys
          // Generators only use the 'name' property, so other fields can be defaults
          const columnNames = Object.keys(rows[0]);
          columns = columnNames.map((name) => ({
            name,
            type: 'TEXT',
            nullable: true,
            defaultValue: null,
            isPrimaryKey: false,
          }));
        } else {
          // Fetch all data from the table
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

          columns = dataResult.columns!;
          rows = dataResult.rows!;
        }

        switch (request.format) {
          case 'csv': {
            const content = generateCSV(rows, columns, {
              columns: request.columns,
              includeHeaders: request.includeHeaders,
              delimiter: request.delimiter,
            });
            fs.writeFileSync(request.filePath, content, 'utf-8');
            break;
          }
          case 'json': {
            const content = generateJSON(rows, columns, {
              columns: request.columns,
              prettyPrint: request.prettyPrint,
            });
            fs.writeFileSync(request.filePath, content, 'utf-8');
            break;
          }
          case 'sql': {
            const content = generateSQL(rows, columns, {
              columns: request.columns,
              tableName: request.table,
            });
            fs.writeFileSync(request.filePath, content, 'utf-8');
            break;
          }
          case 'xlsx': {
            const buffer = generateExcel(rows, columns, {
              columns: request.columns,
              sheetName: request.sheetName ?? request.table,
            });
            fs.writeFileSync(request.filePath, buffer);
            break;
          }
          default:
            return { success: false, error: 'Unsupported export format' };
        }

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
        // Only pass baseURL if it's a non-empty string, otherwise let SDK use default
        const client = new Anthropic({
          apiKey: request.apiKey,
          baseURL: request.baseUrl || undefined,
        });

        // Use official SDK to make the request
        // Convert system to array format for better compatibility with proxy services
        // Some proxies expect system as array [{type: "text", text: "..."}] instead of string
        const response = await client.messages.create({
          model: request.model,
          max_tokens: request.maxTokens || 1024,
          system: request.system
            ? [{ type: 'text' as const, text: request.system }]
            : undefined,
          messages: request.messages.map(
            (m: { role: string; content: string }) => ({
              role: m.role as 'user' | 'assistant',
              content: m.content,
            })
          ),
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
        // Only pass baseURL if it's a non-empty string, otherwise let SDK use default
        const client = new OpenAI({
          apiKey: request.apiKey,
          baseURL: request.baseUrl || undefined,
        });

        // Use official SDK to make the request
        const response = await client.chat.completions.create({
          model: request.model,
          messages: request.messages.map(
            (m: { role: string; content: string }) => ({
              role: m.role as 'user' | 'assistant' | 'system',
              content: m.content,
            })
          ),
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

  // Window: Create new window
  ipcMain.handle(IPC_CHANNELS.WINDOW_CREATE, async () => {
    try {
      const windowId = windowManager.createWindow();
      return { success: true, windowId };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to create window',
      };
    }
  });

  // Window: Close window
  ipcMain.handle(
    IPC_CHANNELS.WINDOW_CLOSE,
    async (event, request: CloseWindowRequest) => {
      try {
        if (request.windowId) {
          // Close specific window
          const success = windowManager.closeWindow(request.windowId);
          if (!success) {
            return { success: false, error: 'Window not found' };
          }
        } else {
          // Close the window that sent this request
          const webContents = event.sender;
          const window = BrowserWindow.fromWebContents(webContents);
          if (window) {
            window.close();
          }
        }
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Failed to close window',
        };
      }
    }
  );

  // Window: Focus window
  ipcMain.handle(
    IPC_CHANNELS.WINDOW_FOCUS,
    async (_event, request: FocusWindowRequest) => {
      try {
        const success = windowManager.focusWindow(request.windowId);
        if (!success) {
          return { success: false, error: 'Window not found' };
        }
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Failed to focus window',
        };
      }
    }
  );

  // Window: Get all windows
  ipcMain.handle(IPC_CHANNELS.WINDOW_GET_ALL, async () => {
    try {
      const windowIds = windowManager.getAllWindowIds();
      return { success: true, windowIds };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get windows',
      };
    }
  });

  // Window: Get current window ID
  ipcMain.handle(IPC_CHANNELS.WINDOW_GET_CURRENT, async (event) => {
    try {
      const webContents = event.sender;
      const window = BrowserWindow.fromWebContents(webContents);
      if (!window) {
        return { success: false, error: 'Window not found' };
      }

      // Find the window ID from our manager
      const allWindows = windowManager.getAllWindows();
      const windowIndex = allWindows.findIndex((w) => w.id === window.id);

      if (windowIndex === -1) {
        // Window exists but not registered - register it now
        const windowId = windowManager.registerWindow(window);
        return { success: true, windowId };
      }

      const windowIds = windowManager.getAllWindowIds();
      return { success: true, windowId: windowIds[windowIndex] };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get current window',
      };
    }
  });

  // System: Get Fonts
  ipcMain.handle(IPC_CHANNELS.SYSTEM_GET_FONTS, async () => {
    const execAsync = promisify(exec);
    const platform = os.platform();

    // Monospace font keywords to filter
    const monoKeywords = [
      'mono',
      'code',
      'courier',
      'console',
      'terminal',
      'menlo',
      'hack',
      'fira',
      'jetbrains',
      'source code',
      'ibm plex',
      'cascadia',
      'inconsolata',
      'sf mono',
      'monaco',
      'andale',
      'dejavu sans mono',
      'liberation mono',
      'droid sans mono',
    ];

    const isMonospaceFont = (fontName: string): boolean => {
      const lower = fontName.toLowerCase();
      return monoKeywords.some((keyword) => lower.includes(keyword));
    };

    try {
      let fonts: string[] = [];

      if (platform === 'darwin') {
        // macOS: prefer fc-list (fast, ~2s) over system_profiler (slow, ~15s)
        try {
          const { stdout: fcOutput } = await execAsync(
            'fc-list : family 2>/dev/null | sort -u',
            { timeout: 5000 }
          );
          // fc-list may return comma-separated font names, extract the last one (usually English name)
          fonts = fcOutput
            .split('\n')
            .map((line) => {
              const parts = line.split(',');
              return parts[parts.length - 1].trim();
            })
            .filter(Boolean);
        } catch {
          // Fallback: use system_profiler if fc-list is not available
          try {
            const { stdout } = await execAsync(
              'system_profiler SPFontsDataType -json 2>/dev/null || echo "{}"',
              { timeout: 20000, maxBuffer: 50 * 1024 * 1024 }
            );
            const data = JSON.parse(stdout);
            const fontData = data.SPFontsDataType || [];
            const fontSet = new Set<string>();
            for (const fontFile of fontData) {
              const typefaces = fontFile.typefaces || [];
              for (const typeface of typefaces) {
                if (typeface.family) {
                  fontSet.add(typeface.family);
                }
              }
            }
            fonts = Array.from(fontSet);
          } catch (parseError) {
            console.error(
              '[SYSTEM_GET_FONTS] Failed to get fonts on macOS:',
              parseError
            );
            fonts = [];
          }
        }
      } else if (platform === 'win32') {
        // Windows: use PowerShell
        const { stdout } = await execAsync(
          'powershell -command "[System.Reflection.Assembly]::LoadWithPartialName(\'System.Drawing\') | Out-Null; (New-Object System.Drawing.Text.InstalledFontCollection).Families | ForEach-Object { $_.Name }"',
          { timeout: 10000 }
        );
        fonts = stdout
          .split('\n')
          .map((f) => f.trim())
          .filter(Boolean);
      } else {
        // Linux: use fc-list
        const { stdout } = await execAsync('fc-list : family | sort -u', {
          timeout: 5000,
        });
        fonts = stdout
          .split('\n')
          .map((f) => f.trim())
          .filter(Boolean);
      }

      // Filter for monospace fonts and sort
      const monoFonts = fonts
        .filter(isMonospaceFont)
        .sort((a, b) => a.localeCompare(b));

      return { success: true, fonts: monoFonts };
    } catch (error) {
      console.error('[SYSTEM_GET_FONTS] Failed to get system fonts:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get fonts',
        fonts: [],
      };
    }
  });

  // ============ Auto-Update Handlers ============

  ipcMain.handle(IPC_CHANNELS.UPDATE_CHECK, async (_event, silent = true) => {
    try {
      await checkForUpdates(silent);
      return { success: true };
    } catch (error) {
      console.error('[UPDATE_CHECK] Failed to check for updates:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to check for updates',
      };
    }
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_DOWNLOAD, async () => {
    try {
      downloadUpdate();
      return { success: true };
    } catch (error) {
      console.error('[UPDATE_DOWNLOAD] Failed to download update:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to download update',
      };
    }
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_INSTALL, async () => {
    try {
      quitAndInstall();
      return { success: true };
    } catch (error) {
      console.error('[UPDATE_INSTALL] Failed to install update:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to install update',
      };
    }
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_STATUS, async () => {
    try {
      const status = getUpdateStatus();
      return { success: true, status };
    } catch (error) {
      console.error('[UPDATE_STATUS] Failed to get update status:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get update status',
      };
    }
  });
}

export function cleanupIpcHandlers(): void {
  databaseService.closeAll();
}

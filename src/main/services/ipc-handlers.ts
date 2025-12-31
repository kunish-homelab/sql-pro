import type {
  AIAgentQueryRequest,
  AICancelStreamRequest,
  AIFetchAnthropicRequest,
  AIFetchOpenAIRequest,
  AIStreamAnthropicRequest,
  AIStreamOpenAIRequest,
  AnalyzeQueryPlanRequest,
  ApplyChangesRequest,
  ClearQueryHistoryRequest,
  CloseDatabaseRequest,
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
  ProActivateRequest,
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
import { query as claudeAgentQuery } from '@anthropic-ai/claude-agent-sdk';
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
  clearProStatus,
  clearQueryHistory,
  deleteQueryHistoryEntry,
  getAISettings,
  getPreferences,
  getProStatus,
  getQueryHistory,
  getRecentConnections,
  removeRecentConnection,
  saveAISettings,
  saveProStatus,
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

const execAsync = promisify(exec);

/**
 * Common installation paths for Claude Code executable.
 */
const COMMON_CLAUDE_PATHS = [
  '/opt/homebrew/bin/claude',
  '/usr/local/bin/claude',
  '/usr/bin/claude',
  `${os.homedir()}/.local/bin/claude`,
];

/**
 * Find all available Claude Code executables.
 * Searches common paths and user's PATH environment variable.
 */
export async function findClaudeCodePaths(): Promise<string[]> {
  const foundPaths = new Set<string>();

  // Check common paths
  for (const path of COMMON_CLAUDE_PATHS) {
    const resolvedPath = path.replace('~', os.homedir());
    if (fs.existsSync(resolvedPath)) {
      foundPaths.add(resolvedPath);
    }
  }

  // Search in PATH environment variable
  try {
    const { stdout } = await execAsync('which -a claude');
    const pathsFromWhich = stdout
      .trim()
      .split('\n')
      .filter((p) => p.length > 0);
    for (const p of pathsFromWhich) {
      if (fs.existsSync(p)) {
        foundPaths.add(p);
      }
    }
  } catch {
    // 'which' command failed, ignore
  }

  return Array.from(foundPaths);
}

/**
 * Get the path to Claude Code executable.
 * Uses user-configured path or finds the first available one.
 */
function getClaudeCodePath(customPath?: string): string {
  // Use custom path if provided and exists
  if (customPath && fs.existsSync(customPath)) {
    return customPath;
  }

  // Check common paths
  for (const path of COMMON_CLAUDE_PATHS) {
    const resolvedPath = path.replace('~', os.homedir());
    if (fs.existsSync(resolvedPath)) {
      return resolvedPath;
    }
  }

  // Fallback to the most common Homebrew path
  return '/opt/homebrew/bin/claude';
}

export function cleanupIpcHandlers(): void {
  // Remove all IPC handlers when the app is shutting down
  Object.values(IPC_CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
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
      const startTime = Date.now();
      const result = databaseService.executeQuery(
        request.connectionId,
        request.query
      );
      const executionTime = Date.now() - startTime;

      // Map internal field names to API response format
      if (result.success) {
        return {
          success: true,
          columns: 'columns' in result ? result.columns : undefined,
          rows: 'rows' in result ? result.rows : undefined,
          resultSets: 'resultSets' in result ? result.resultSets : undefined,
          rowsAffected: 'changes' in result ? result.changes : undefined,
          lastInsertRowId:
            'lastInsertRowid' in result ? result.lastInsertRowid : undefined,
          executionTime,
          executedStatements:
            'executedStatements' in result
              ? result.executedStatements
              : undefined,
          totalChanges:
            'totalChanges' in result ? result.totalChanges : undefined,
        };
      }

      return {
        success: false,
        error: result.error,
        errorCode: 'errorCode' in result ? result.errorCode : undefined,
        errorPosition:
          'errorPosition' in result ? result.errorPosition : undefined,
        troubleshootingSteps:
          'troubleshootingSteps' in result
            ? result.troubleshootingSteps
            : undefined,
        documentationUrl:
          'documentationUrl' in result ? result.documentationUrl : undefined,
        executionTime,
      };
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
        const client = new Anthropic({
          apiKey: request.apiKey,
          baseURL: request.baseUrl || undefined,
        });

        const response = await client.messages.create({
          model: request.model,
          max_tokens: request.maxTokens || 4096,
          system: request.system,
          messages: request.messages as Anthropic.MessageParam[],
          temperature: request.temperature,
        });

        // Extract text content from response
        const textContent = response.content.find((c) => c.type === 'text');
        return {
          success: true,
          message: {
            role: 'assistant',
            content: textContent?.type === 'text' ? textContent.text : '',
          },
        };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to fetch from Anthropic',
        };
      }
    }
  );

  // AI: Stream from Anthropic-compatible API using official SDK
  ipcMain.handle(
    IPC_CHANNELS.AI_STREAM_ANTHROPIC,
    async (_event, request: AIStreamAnthropicRequest) => {
      try {
        const client = new Anthropic({
          apiKey: request.apiKey,
          baseURL: request.baseUrl || undefined,
        });

        const stream = client.messages.stream({
          model: request.model,
          max_tokens: request.maxTokens || 4096,
          system: request.system,
          messages: request.messages as Anthropic.MessageParam[],
          temperature: request.temperature,
        });

        return {
          success: true,
          stream,
        };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to stream from Anthropic',
        };
      }
    }
  );

  // AI: Fetch from OpenAI API
  ipcMain.handle(
    IPC_CHANNELS.AI_FETCH_OPENAI,
    async (_event, request: AIFetchOpenAIRequest) => {
      try {
        const client = new OpenAI({
          apiKey: request.apiKey,
          baseURL: request.baseUrl,
        });

        const response = await client.chat.completions.create({
          model: request.model,
          messages:
            request.messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
          temperature: request.temperature,
          max_tokens: request.maxTokens,
        });

        return {
          success: true,
          message: {
            role: 'assistant',
            content:
              response.choices[0]?.message?.content || 'No content returned',
          },
        };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to fetch from OpenAI',
        };
      }
    }
  );

  // AI: Stream from OpenAI API
  ipcMain.handle(
    IPC_CHANNELS.AI_STREAM_OPENAI,
    async (_event, request: AIStreamOpenAIRequest) => {
      try {
        const client = new OpenAI({
          apiKey: request.apiKey,
          baseURL: request.baseUrl,
        });

        const stream = await client.chat.completions.create({
          model: request.model,
          messages:
            request.messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
          temperature: request.temperature,
          max_tokens: request.maxTokens,
          stream: true,
        });

        return {
          success: true,
          stream,
        };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to stream from OpenAI',
        };
      }
    }
  );

  // AI: Agent Query using Claude Agent SDK
  ipcMain.handle(
    IPC_CHANNELS.AI_AGENT_QUERY,
    async (_event, request: AIAgentQueryRequest) => {
      try {
        // Use prompt directly or build from messages
        const prompt =
          request.prompt ||
          (request.messages || [])
            .map((m) => `${m.role}: ${m.content}`)
            .join('\n');

        const query = claudeAgentQuery({
          prompt,
          options: {
            model: request.model,
            maxThinkingTokens: request.maxTokens,
            pathToClaudeCodeExecutable: getClaudeCodePath(
              request.customClaudePath
            ),
          },
        });

        // Collect all messages from the query
        const messages: unknown[] = [];
        for await (const message of query) {
          messages.push(message);
        }

        return {
          success: true,
          message: messages,
        };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Failed to query AI agent',
        };
      }
    }
  );

  // AI: Cancel Stream
  ipcMain.handle(
    IPC_CHANNELS.AI_CANCEL_STREAM,
    async (_event, _request: AICancelStreamRequest) => {
      try {
        // Implementation for canceling stream
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Failed to cancel stream',
        };
      }
    }
  );

  // Pro: Get status
  ipcMain.handle(IPC_CHANNELS.PRO_GET_STATUS, async () => {
    try {
      const status = getProStatus();
      return { success: true, status };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to get pro status',
      };
    }
  });

  // Pro: Activate
  ipcMain.handle(
    IPC_CHANNELS.PRO_ACTIVATE,
    async (_event, request: ProActivateRequest) => {
      try {
        saveProStatus({
          isPro: true,
          licenseKey: request.licenseKey,
          activatedAt: new Date().toISOString(),
          features: request.features || [],
        });
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Failed to activate pro',
        };
      }
    }
  );

  // Pro: Deactivate
  ipcMain.handle(IPC_CHANNELS.PRO_DEACTIVATE, async () => {
    try {
      clearProStatus();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to deactivate pro',
      };
    }
  });

  // Window: Close
  ipcMain.handle(IPC_CHANNELS.WINDOW_CLOSE, async () => {
    const window = BrowserWindow.getFocusedWindow();
    if (window) {
      window.close();
    }
    return { success: true };
  });

  // Window: Focus
  ipcMain.handle(
    IPC_CHANNELS.WINDOW_FOCUS,
    async (_event, request: FocusWindowRequest) => {
      const windows = BrowserWindow.getAllWindows();
      const targetWindow = windows.find((w) => w.id === request.windowId);
      if (targetWindow) {
        targetWindow.focus();
        return { success: true };
      }
      return { success: false, error: 'Window not found' };
    }
  );

  // Updates: Check for updates
  ipcMain.handle(IPC_CHANNELS.UPDATES_CHECK, async () => {
    try {
      const hasUpdates = await checkForUpdates();
      return { success: true, hasUpdates };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to check for updates',
      };
    }
  });

  // Updates: Get status
  ipcMain.handle(IPC_CHANNELS.UPDATES_GET_STATUS, async () => {
    try {
      const status = getUpdateStatus();
      return { success: true, status };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get update status',
      };
    }
  });

  // Updates: Download update
  ipcMain.handle(IPC_CHANNELS.UPDATES_DOWNLOAD, async () => {
    try {
      await downloadUpdate();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to download update',
      };
    }
  });

  // Updates: Quit and install
  ipcMain.handle(IPC_CHANNELS.UPDATES_QUIT_AND_INSTALL, async () => {
    try {
      quitAndInstall();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to quit and install',
      };
    }
  });
}

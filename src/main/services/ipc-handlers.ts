import type {
  AIAgentMessage,
  AIAgentQueryRequest,
  AICancelStreamRequest,
  AIFetchAnthropicRequest,
  AIFetchOpenAIRequest,
  AIStreamAnthropicRequest,
  AIStreamChunk,
  AIStreamOpenAIRequest,
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
import { query as claudeAgentQuery } from '@anthropic-ai/claude-agent-sdk';
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
async function findClaudeCodePaths(): Promise<string[]> {
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

  // AI: Get available Claude Code executable paths
  ipcMain.handle(IPC_CHANNELS.AI_GET_CLAUDE_CODE_PATHS, async () => {
    try {
      const paths = await findClaudeCodePaths();
      return { success: true, paths };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to find Claude Code paths',
      };
    }
  });

  // AI: Fetch from Anthropic-compatible API using Claude Agent SDK
  ipcMain.handle(
    IPC_CHANNELS.AI_FETCH_ANTHROPIC,
    async (_event, request: AIFetchAnthropicRequest) => {
      try {
        // Get user-configured Claude Code path
        const aiSettings = getAISettings();
        const claudePath = getClaudeCodePath(aiSettings?.claudeCodePath);

        // Build the prompt with system message and user messages
        const userMessages = request.messages
          .map((m) => `${m.role}: ${m.content}`)
          .join('\n');

        const fullPrompt = request.system
          ? `${request.system}\n\n${userMessages}`
          : userMessages;

        // Use Claude Agent SDK query function
        const agentQuery = claudeAgentQuery({
          prompt: fullPrompt,
          options: {
            // Specify Claude Code executable path
            pathToClaudeCodeExecutable: claudePath,
            // Disable all tools for pure text generation
            tools: [],
            // Bypass permissions since we're not using any tools
            permissionMode: 'bypassPermissions',
            allowDangerouslySkipPermissions: true,
            maxTurns: 1,
            env: {
              ANTHROPIC_BASE_URL: request.baseUrl,
              ANTHROPIC_AUTH_TOKEN: request.apiKey,
            },
          },
        });

        let resultContent = '';

        // Process messages from the agent
        for await (const message of agentQuery) {
          if (message.type === 'assistant' && 'message' in message) {
            // Extract text content from assistant message
            const textContent = message.message.content.find(
              (block: { type: string }) => block.type === 'text'
            );
            if (textContent && 'text' in textContent) {
              resultContent = textContent.text;
            }
          } else if (message.type === 'result' && 'result' in message) {
            resultContent = message.result;
          }
        }

        if (!resultContent) {
          return { success: false, error: 'No content in response' };
        }

        return { success: true, content: resultContent.trim() };
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

  // Store active stream abort controllers
  const activeStreams = new Map<string, AbortController>();

  // AI: Stream from Anthropic API with real-time chunks using Claude Agent SDK
  ipcMain.handle(
    IPC_CHANNELS.AI_STREAM_ANTHROPIC,
    async (event, request: AIStreamAnthropicRequest) => {
      const { requestId } = request;
      const abortController = new AbortController();
      activeStreams.set(requestId, abortController);

      try {
        // Get user-configured Claude Code path
        const aiSettings = getAISettings();
        const claudePath = getClaudeCodePath(aiSettings?.claudeCodePath);

        // Get the sender window to send chunks back
        const webContents = event.sender;

        // Build the prompt with system message and user messages
        const userMessages = request.messages
          .map((m) => `${m.role}: ${m.content}`)
          .join('\n');

        const fullPrompt = request.system
          ? `${request.system}\n\n${userMessages}`
          : userMessages;

        // Use Claude Agent SDK query function with streaming
        const agentQuery = claudeAgentQuery({
          prompt: fullPrompt,
          options: {
            // Specify Claude Code executable path
            pathToClaudeCodeExecutable: claudePath,
            tools: [],
            permissionMode: 'bypassPermissions',
            allowDangerouslySkipPermissions: true,
            maxTurns: 1,
            abortController,
            includePartialMessages: true,
          },
        });

        let fullContent = '';
        let inputTokens = 0;
        let outputTokens = 0;

        // Process messages from the agent
        for await (const message of agentQuery) {
          if (abortController.signal.aborted) break;

          if (message.type === 'stream_event' && 'event' in message) {
            // Handle streaming events
            const streamEvent = message.event;
            if (
              streamEvent.type === 'content_block_delta' &&
              'delta' in streamEvent
            ) {
              const delta = streamEvent.delta;
              if (delta.type === 'text_delta' && 'text' in delta) {
                fullContent += delta.text;
                const chunk: AIStreamChunk = {
                  type: 'delta',
                  requestId,
                  content: delta.text,
                };
                webContents.send(IPC_CHANNELS.AI_STREAM_CHUNK, chunk);
              }
            }
          } else if (message.type === 'assistant' && 'message' in message) {
            // Extract text content from assistant message
            const textContent = message.message.content.find(
              (block: { type: string }) => block.type === 'text'
            );
            if (textContent && 'text' in textContent) {
              // If we haven't received streaming events, send the full content
              if (!fullContent) {
                fullContent = textContent.text;
                const chunk: AIStreamChunk = {
                  type: 'delta',
                  requestId,
                  content: textContent.text,
                };
                webContents.send(IPC_CHANNELS.AI_STREAM_CHUNK, chunk);
              }
            }
          } else if (message.type === 'result' && 'result' in message) {
            inputTokens = message.usage?.input_tokens || 0;
            outputTokens = message.usage?.output_tokens || 0;
            if (!fullContent) {
              fullContent = message.result;
            }
          }
        }

        // Clean up
        activeStreams.delete(requestId);

        // Send done message with full content and usage
        const doneChunk: AIStreamChunk = {
          type: 'done',
          requestId,
          fullContent,
          usage: {
            inputTokens,
            outputTokens,
          },
        };
        webContents.send(IPC_CHANNELS.AI_STREAM_CHUNK, doneChunk);

        return { success: true };
      } catch (error) {
        activeStreams.delete(requestId);

        // Send error chunk
        const errorChunk: AIStreamChunk = {
          type: 'error',
          requestId,
          error:
            error instanceof Error ? error.message : 'Failed to stream from AI',
        };
        event.sender.send(IPC_CHANNELS.AI_STREAM_CHUNK, errorChunk);

        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Failed to stream from AI',
        };
      }
    }
  );

  // AI: Stream from OpenAI-compatible API with real-time chunks
  ipcMain.handle(
    IPC_CHANNELS.AI_STREAM_OPENAI,
    async (event, request: AIStreamOpenAIRequest) => {
      const { requestId } = request;
      const abortController = new AbortController();
      activeStreams.set(requestId, abortController);

      try {
        const client = new OpenAI({
          apiKey: request.apiKey,
          baseURL: request.baseUrl || undefined,
        });

        const webContents = event.sender;

        // Use streaming API
        const stream = await client.chat.completions.create({
          model: request.model,
          messages: request.messages.map(
            (m: { role: string; content: string }) => ({
              role: m.role as 'user' | 'assistant' | 'system',
              content: m.content,
            })
          ),
          stream: true,
        });

        let fullContent = '';

        // Process stream
        for await (const chunk of stream) {
          if (abortController.signal.aborted) break;

          const delta = chunk.choices[0]?.delta?.content;
          if (delta) {
            fullContent += delta;
            const streamChunk: AIStreamChunk = {
              type: 'delta',
              requestId,
              content: delta,
            };
            webContents.send(IPC_CHANNELS.AI_STREAM_CHUNK, streamChunk);
          }
        }

        // Clean up
        activeStreams.delete(requestId);

        // Send done message
        const doneChunk: AIStreamChunk = {
          type: 'done',
          requestId,
          fullContent,
        };
        webContents.send(IPC_CHANNELS.AI_STREAM_CHUNK, doneChunk);

        return { success: true };
      } catch (error) {
        activeStreams.delete(requestId);

        const errorChunk: AIStreamChunk = {
          type: 'error',
          requestId,
          error:
            error instanceof Error ? error.message : 'Failed to stream from AI',
        };
        event.sender.send(IPC_CHANNELS.AI_STREAM_CHUNK, errorChunk);

        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Failed to stream from AI',
        };
      }
    }
  );

  // AI: Cancel an active stream
  ipcMain.handle(
    IPC_CHANNELS.AI_CANCEL_STREAM,
    async (_event, request: AICancelStreamRequest) => {
      const controller = activeStreams.get(request.requestId);
      if (controller) {
        controller.abort();
        activeStreams.delete(request.requestId);
        return { success: true };
      }
      return { success: false, error: 'Stream not found' };
    }
  );

  // Store active agent query abort controllers
  const activeAgentQueries = new Map<string, AbortController>();

  // AI: Query using Claude Agent SDK for advanced AI operations
  ipcMain.handle(
    IPC_CHANNELS.AI_AGENT_QUERY,
    async (event, request: AIAgentQueryRequest) => {
      const { requestId, prompt, systemPrompt, maxTurns } = request;
      const abortController = new AbortController();
      activeAgentQueries.set(requestId, abortController);

      try {
        // Get user-configured Claude Code path
        const aiSettings = getAISettings();
        const claudePath = getClaudeCodePath(aiSettings?.claudeCodePath);

        const webContents = event.sender;

        // Use Claude Agent SDK query function
        const agentQuery = claudeAgentQuery({
          prompt,
          options: {
            // Specify Claude Code executable path
            pathToClaudeCodeExecutable: claudePath,
            systemPrompt: systemPrompt || undefined,
            maxTurns: maxTurns || 3,
            abortController,
            // Disable all tools for pure text generation (SQL query generation)
            tools: [],
            // Bypass permissions since we're not using any tools
            permissionMode: 'bypassPermissions',
            allowDangerouslySkipPermissions: true,
          },
        });

        let resultContent = '';

        // Process messages from the agent
        for await (const message of agentQuery) {
          if (abortController.signal.aborted) break;

          // Send message to renderer based on type
          const agentMessage: AIAgentMessage = {
            type: message.type as AIAgentMessage['type'],
            requestId,
          };

          if (message.type === 'assistant' && 'message' in message) {
            // Extract text content from assistant message
            const textContent = message.message.content.find(
              (block: { type: string }) => block.type === 'text'
            );
            if (textContent && 'text' in textContent) {
              agentMessage.content = textContent.text;
              resultContent = textContent.text;
            }
          } else if (message.type === 'result' && 'result' in message) {
            agentMessage.result = message.result;
            agentMessage.usage = {
              inputTokens: message.usage?.input_tokens || 0,
              outputTokens: message.usage?.output_tokens || 0,
            };
            agentMessage.costUsd = message.total_cost_usd;
            resultContent = message.result;
          }

          webContents.send(IPC_CHANNELS.AI_AGENT_MESSAGE, agentMessage);
        }

        // Clean up
        activeAgentQueries.delete(requestId);

        return { success: true, content: resultContent };
      } catch (error) {
        activeAgentQueries.delete(requestId);

        // Send error message
        const errorMessage: AIAgentMessage = {
          type: 'result',
          requestId,
          error:
            error instanceof Error ? error.message : 'Failed to query AI agent',
        };
        event.sender.send(IPC_CHANNELS.AI_AGENT_MESSAGE, errorMessage);

        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Failed to query AI agent',
        };
      }
    }
  );

  // AI: Cancel an active agent query
  ipcMain.handle(
    IPC_CHANNELS.AI_AGENT_CANCEL,
    async (_event, request: { requestId: string }) => {
      const controller = activeAgentQueries.get(request.requestId);
      if (controller) {
        controller.abort();
        activeAgentQueries.delete(request.requestId);
        return { success: true };
      }
      return { success: false, error: 'Agent query not found' };
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

import type {
  AIAgentQueryRequest,
  AICancelStreamRequest,
  AIFetchAnthropicRequest,
  AIFetchOpenAIRequest,
  AIStreamAnthropicRequest,
  AIStreamOpenAIRequest,
  AnalyzeQueryPlanRequest,
  ApplyChangesRequest,
  CheckUnsavedChangesRequest,
  ClearQueryHistoryRequest,
  CloseDatabaseRequest,
  ColumnInfo,
  CompareConnectionsRequest,
  CompareConnectionToSnapshotRequest,
  CompareSnapshotsRequest,
  CompareTablesRequest,
  DeleteQueryHistoryRequest,
  DeleteSchemaSnapshotRequest,
  ExecuteQueryRequest,
  ExportBundleRequest,
  ExportComparisonReportRequest,
  ExportQueryRequest,
  ExportRequest,
  ExportSchemaRequest,
  FocusWindowRequest,
  GenerateMigrationSQLRequest,
  GenerateSyncSQLRequest,
  GetPasswordRequest,
  GetQueryHistoryRequest,
  GetSchemaRequest,
  GetSchemaSnapshotRequest,
  GetTableDataRequest,
  HasPasswordRequest,
  ImportBundleRequest,
  ImportQueryRequest,
  ImportSchemaRequest,
  OpenDatabaseRequest,
  OpenFileDialogRequest,
  ProActivateRequest,
  QueryHistoryEntry,
  RemoveConnectionRequest,
  RemovePasswordRequest,
  SaveFileDialogRequest,
  SavePasswordRequest,
  SaveQueryHistoryRequest,
  SaveSchemaSnapshotRequest,
  SchemaComparisonResult,
  SchemaSnapshot,
  UpdateConnectionRequest,
  ValidateChangesRequest,
} from '@shared/types';
import type { Buffer } from 'node:buffer';
import type { SystemFont } from '@/lib/font-constants';
import { exec } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import process from 'node:process';
import { promisify } from 'node:util';
import { query as claudeAgentQuery } from '@anthropic-ai/claude-agent-sdk';
import Anthropic from '@anthropic-ai/sdk';
import { IPC_CHANNELS } from '@shared/types';
import { BrowserWindow, dialog, ipcMain } from 'electron';
import OpenAI from 'openai';
import {
  generateHTMLReport,
  generateJSONReport,
  generateMarkdownReport,
} from '@/lib/comparison-report-generators';
import {
  generateCSV,
  generateExcel,
  generateJSON,
  generateSQL,
} from '@/lib/export-generators';
import { CATEGORY_ORDER, classifyFont } from '@/lib/font-constants';
import { dataDiffService } from './data-diff';
import { dataDiffSyncGeneratorService } from './data-diff-sync-generator';
import { databaseService } from './database';
import { migrationGeneratorService } from './migration-generator';
import { passwordStorageService } from './password-storage';
import {
  exportBundle,
  exportQuery,
  exportSchema,
  importBundle,
  importQuery,
  importSchema,
} from './query-schema-sharing';
import { schemaComparisonService } from './schema-comparison';
import { sqlLogger } from './sql-logger';
import {
  addQueryToCollection,
  addRecentConnection,
  clearProStatus,
  clearQueryHistory,
  deleteCollection,
  deleteFolder,
  deleteProfile,
  deleteQueryHistoryEntry,
  deleteSavedQuery,
  deleteSchemaSnapshot,
  getAISettings,
  getCollections,
  getFolders,
  getPreferences,
  getProfiles,
  getProStatus,
  getQueryHistory,
  getRecentConnections,
  getSavedQueries,
  getSchemaSnapshot,
  getSchemaSnapshots,
  removeQueryFromCollection,
  removeRecentConnection,
  saveAISettings,
  saveCollection,
  saveFolder,
  saveProfile,
  saveProStatus,
  saveQueryHistoryEntry,
  saveSavedQuery,
  saveSchemaSnapshot,
  setPreferences,
  updateCollection,
  updateFolder,
  updateProfile,
  updateSavedQuery,
} from './store';
import {
  checkForUpdates,
  downloadUpdate,
  getUpdateStatus,
  quitAndInstall,
} from './updater';

const execAsync = promisify(exec);

// ============ Utilities ============

/**
 * Wraps an async handler with consistent error handling
 */
function createHandler<T, R>(
  handler: (request: T) => Promise<R>
): (
  _event: any,
  request: T
) => Promise<{ success: boolean; error?: string } & R> {
  return async (_event, request) => {
    try {
      const result = await handler(request);
      return { success: true, ...result } as any;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Operation failed',
      };
    }
  };
}

/**
 * Get all system fonts with category classification.
 * Uses platform-specific commands to retrieve installed fonts.
 */
async function getSystemFonts(): Promise<SystemFont[]> {
  const platform = process.platform;
  const fontNames = new Set<string>();

  try {
    if (platform === 'darwin') {
      // macOS: Use system_profiler or fc-list
      try {
        // Try fc-list first (if fontconfig is installed)
        const { stdout } = await execAsync(
          'fc-list --format="%{family[0]}\\n" 2>/dev/null | sort -u'
        );
        const fcFonts = stdout
          .trim()
          .split('\n')
          .filter((f) => f.length > 0);
        fcFonts.forEach((f) => fontNames.add(f.trim()));
      } catch {
        // Fallback to system_profiler (slower but always available)
        try {
          const { stdout } = await execAsync(
            'system_profiler SPFontsDataType 2>/dev/null | grep "Full Name:" | cut -d: -f2'
          );
          const spFonts = stdout
            .trim()
            .split('\n')
            .filter((f) => f.length > 0);
          spFonts.forEach((f) => fontNames.add(f.trim()));
        } catch {
          // If both fail, use atsutil
          const { stdout } = await execAsync(
            'atsutil fonts -list 2>/dev/null | tail -n +2'
          );
          const atsFonts = stdout
            .trim()
            .split('\n')
            .filter((f) => f.length > 0);
          atsFonts.forEach((f) => fontNames.add(f.trim()));
        }
      }
    } else if (platform === 'linux') {
      // Linux: Use fc-list
      const { stdout } = await execAsync(
        'fc-list --format="%{family[0]}\\n" | sort -u'
      );
      const linuxFonts = stdout
        .trim()
        .split('\n')
        .filter((f) => f.length > 0);
      linuxFonts.forEach((f) => fontNames.add(f.trim()));
    } else if (platform === 'win32') {
      // Windows: Use PowerShell to get fonts
      const { stdout } = await execAsync(
        'powershell -Command "[System.Reflection.Assembly]::LoadWithPartialName(\'System.Drawing\') | Out-Null; (New-Object System.Drawing.Text.InstalledFontCollection).Families | ForEach-Object { $_.Name }"'
      );
      const winFonts = stdout
        .trim()
        .split('\n')
        .filter((f) => f.length > 0);
      winFonts.forEach((f) => fontNames.add(f.trim()));
    }
  } catch (error) {
    console.error('Failed to get system fonts:', error);
  }

  // Classify and sort fonts
  const fonts: SystemFont[] = Array.from(fontNames).map((name) => ({
    name,
    category: classifyFont(name),
  }));

  // Sort: first by category priority, then alphabetically within each category
  return fonts.sort((a, b) => {
    const catDiff = CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category];
    if (catDiff !== 0) return catDiff;
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });
}

/**
 * Common installation paths for Claude Code executable.
 */
const COMMON_CLAUDE_PATHS =
  process.platform === 'win32'
    ? [
        // Windows paths
        `${process.env.LOCALAPPDATA}\\Programs\\claude\\claude.exe`,
        `${process.env.APPDATA}\\npm\\claude.cmd`,
        `${process.env.USERPROFILE}\\.claude\\bin\\claude.exe`,
        'C:\\Program Files\\Claude\\claude.exe',
        'C:\\Program Files (x86)\\Claude\\claude.exe',
      ]
    : [
        // macOS/Linux paths
        '/opt/homebrew/bin/claude',
        '/usr/local/bin/claude',
        '/usr/bin/claude',
        `${os.homedir()}/.local/bin/claude`,
        `${os.homedir()}/.claude/bin/claude`,
        `${os.homedir()}/.npm-global/bin/claude`,
        '/snap/bin/claude',
      ];

/**
 * Find all available Claude Code executables.
 * Searches common paths and user's PATH environment variable.
 */
export async function findClaudeCodePaths(): Promise<string[]> {
  const foundPaths = new Set<string>();
  const isWindows = process.platform === 'win32';

  // Check common paths
  for (const commonPath of COMMON_CLAUDE_PATHS) {
    const resolvedPath = commonPath.replace('~', os.homedir());
    if (fs.existsSync(resolvedPath)) {
      foundPaths.add(resolvedPath);
    }
  }

  // Search in PATH environment variable
  try {
    if (isWindows) {
      // Windows: use 'where' command
      const { stdout } = await execAsync('where claude 2>nul');
      const pathsFromWhere = stdout
        .trim()
        .split('\r\n')
        .filter((p) => p.length > 0);
      for (const p of pathsFromWhere) {
        if (fs.existsSync(p)) {
          foundPaths.add(p);
        }
      }
    } else {
      // macOS/Linux: use 'which -a' command
      const { stdout } = await execAsync('which -a claude 2>/dev/null');
      const pathsFromWhich = stdout
        .trim()
        .split('\n')
        .filter((p) => p.length > 0);
      for (const p of pathsFromWhich) {
        if (fs.existsSync(p)) {
          foundPaths.add(p);
        }
      }
    }
  } catch {
    // Command failed, ignore
  }

  // Also check npm global installations
  try {
    const npmPrefix = isWindows
      ? await execAsync('npm config get prefix').then((r) => r.stdout.trim())
      : await execAsync('npm config get prefix 2>/dev/null').then((r) =>
          r.stdout.trim()
        );
    const npmClaudePath = isWindows
      ? `${npmPrefix}\\claude.cmd`
      : `${npmPrefix}/bin/claude`;
    if (fs.existsSync(npmClaudePath)) {
      foundPaths.add(npmClaudePath);
    }
  } catch {
    // npm not available or failed
  }

  return Array.from(foundPaths);
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
        let columns: ColumnInfo[] = [];
        let rows: Record<string, unknown>[] = [];

        const tableData = await databaseService.getTableData(
          request.connectionId,
          request.table,
          1,
          999999,
          undefined,
          undefined,
          undefined,
          request.schema
        );

        if (tableData.success) {
          columns = tableData.columns || [];
          rows = (tableData.rows || []) as Record<string, unknown>[];
        }

        let output: Buffer | string = '';
        if (request.format === 'csv') {
          output = generateCSV(rows, columns);
        } else if (request.format === 'json') {
          output = generateJSON(rows, columns);
        } else if (request.format === 'sql') {
          output = generateSQL(rows, columns, { tableName: request.table });
        } else if (request.format === 'xlsx') {
          output = generateExcel(rows, columns, { sheetName: request.table });
        }

        return {
          success: true,
          data: output,
          format: request.format,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Export failed',
        };
      }
    }
  );

  // Export: Bundle
  ipcMain.handle(
    IPC_CHANNELS.EXPORT_BUNDLE,
    createHandler(async (_request: ExportBundleRequest) => {
      const { data } = await exportBundle({
        name: 'bundle',
        queries: [],
        schemas: [],
      });
      return { success: true, data };
    })
  );

  // Export: Query
  ipcMain.handle(
    IPC_CHANNELS.EXPORT_QUERY,
    createHandler(async (request: ExportQueryRequest) => {
      // Export query needs a query object, not just an ID
      // This should be fetched from saved queries using request.queryId
      const savedQueries = getSavedQueries();
      const queryData = savedQueries.find((q) => q.id === request.queryId);
      if (!queryData) {
        throw new Error(`Query with ID ${request.queryId} not found`);
      }
      const { data } = await exportQuery({
        name: queryData.name,
        sql: queryData.queryText || queryData.query || '',
        databaseContext: queryData.connectionPath,
        tags: queryData.tags,
        description: queryData.description,
      });
      return { success: true, data };
    })
  );

  // Export: Schema
  ipcMain.handle(
    IPC_CHANNELS.EXPORT_SCHEMA,
    createHandler(async (request: ExportSchemaRequest) => {
      // Export schema needs a schema object
      // If snapshotId is provided, fetch the snapshot first
      if (request.snapshotId) {
        const snapshot = getSchemaSnapshot(request.snapshotId);
        if (!snapshot) {
          throw new Error(
            `Schema snapshot with ID ${request.snapshotId} not found`
          );
        }
        const { data } = await exportSchema({
          name: snapshot.name,
          description: snapshot.description,
          databaseName: snapshot.connectionPath || '',
          databaseType: 'sqlite',
          format: 'json',
          schemas: snapshot.schemas || [],
        });
        return { success: true, data };
      }
      throw new Error('snapshotId is required');
    })
  );

  // Import: Bundle
  ipcMain.handle(
    IPC_CHANNELS.IMPORT_BUNDLE,
    createHandler(async (request: ImportBundleRequest) => {
      if (!request.data) {
        throw new Error('Import data is required');
      }
      const result = await importBundle(request.data);
      return result;
    })
  );

  // Import: Query
  ipcMain.handle(
    IPC_CHANNELS.IMPORT_QUERY,
    createHandler(async (request: ImportQueryRequest) => {
      if (!request.data) {
        throw new Error('Import data is required');
      }
      const result = await importQuery(request.data);
      return result;
    })
  );

  // Import: Schema
  ipcMain.handle(
    IPC_CHANNELS.IMPORT_SCHEMA,
    createHandler(async (request: ImportSchemaRequest) => {
      if (!request.data) {
        throw new Error('Import data is required');
      }
      const result = await importSchema(request.data);
      return result;
    })
  );

  // Schema: Get Snapshots
  ipcMain.handle(
    IPC_CHANNELS.SCHEMA_GET_SNAPSHOTS,
    createHandler(async () => {
      const snapshots = getSchemaSnapshots();
      return { success: true, snapshots };
    })
  );

  // Schema: Get Snapshot
  ipcMain.handle(
    IPC_CHANNELS.SCHEMA_GET_SNAPSHOT,
    createHandler(async (request: GetSchemaSnapshotRequest) => {
      const snapshot = getSchemaSnapshot(request.snapshotId);
      return { success: true, snapshot };
    })
  );

  // Schema: Save Snapshot
  ipcMain.handle(
    IPC_CHANNELS.SCHEMA_SAVE_SNAPSHOT,
    createHandler(async (request: SaveSchemaSnapshotRequest) => {
      // Create a snapshot object with the provided data
      const snapshotData: SchemaSnapshot = {
        id: crypto.randomUUID(),
        name: request.name || 'Unnamed Snapshot',
        schemas: request.schema || [],
        connectionPath: request.connectionPath || '',
        description: request.description,
        createdAt: new Date().toISOString(),
      };
      saveSchemaSnapshot(snapshotData);
      return { success: true, snapshot: snapshotData };
    })
  );

  // Schema: Delete Snapshot
  ipcMain.handle(
    IPC_CHANNELS.SCHEMA_DELETE_SNAPSHOT,
    createHandler(async (request: DeleteSchemaSnapshotRequest) => {
      deleteSchemaSnapshot(request.snapshotId);
      return { success: true };
    })
  );

  // Schema: Compare Snapshots
  ipcMain.handle(
    IPC_CHANNELS.SCHEMA_COMPARE_SNAPSHOTS,
    createHandler(async (request: CompareSnapshotsRequest) => {
      const snapshotId1 = request.snapshotId1 || request.sourceSnapshotId || '';
      const snapshotId2 = request.snapshotId2 || request.targetSnapshotId || '';
      const snapshot1 = getSchemaSnapshot(snapshotId1);
      const snapshot2 = getSchemaSnapshot(snapshotId2);

      if (!snapshot1 || !snapshot2) {
        throw new Error('One or both snapshots not found');
      }

      const comparison = schemaComparisonService.compareSchemas(
        snapshot1.schemas || snapshot1.schema || [],
        snapshot2.schemas || snapshot2.schema || [],
        snapshot1.id,
        snapshot1.name,
        'snapshot',
        snapshot2.id,
        snapshot2.name,
        'snapshot'
      );
      return { success: true, comparison };
    })
  );

  // Schema: Compare Connections
  ipcMain.handle(
    IPC_CHANNELS.SCHEMA_COMPARE_CONNECTIONS,
    createHandler(async (request: CompareConnectionsRequest) => {
      const connectionId1 =
        request.connectionId1 || request.sourceConnectionId || '';
      const connectionId2 =
        request.connectionId2 || request.targetConnectionId || '';
      const schema1 = await databaseService.getSchema(connectionId1);
      const schema2 = await databaseService.getSchema(connectionId2);

      if (!schema1.success || !schema2.success) {
        throw new Error('Failed to fetch schemas');
      }

      const comparison = schemaComparisonService.compareSchemas(
        schema1.schemas || [],
        schema2.schemas || [],
        connectionId1,
        connectionId1,
        'connection',
        connectionId2,
        connectionId2,
        'connection'
      );
      return { success: true, comparison };
    })
  );

  // Schema: Compare Connection to Snapshot
  ipcMain.handle(
    IPC_CHANNELS.SCHEMA_COMPARE_CONNECTION_TO_SNAPSHOT,
    createHandler(async (request: CompareConnectionToSnapshotRequest) => {
      const connectionId = request.connectionId || '';
      const snapshotId = request.snapshotId || '';
      const liveSchema = await databaseService.getSchema(connectionId);
      const snapshot = getSchemaSnapshot(snapshotId);

      if (!liveSchema.success || !snapshot) {
        throw new Error('Failed to fetch schema or snapshot');
      }

      const comparison = schemaComparisonService.compareSchemas(
        liveSchema.schemas || [],
        snapshot.schemas || snapshot.schema || [],
        connectionId,
        connectionId,
        'connection',
        snapshot.id,
        snapshot.name,
        'snapshot'
      );
      return { success: true, comparison };
    })
  );

  // Table: Compare Tables
  ipcMain.handle(
    IPC_CHANNELS.TABLE_COMPARE,
    createHandler(async (request: CompareTablesRequest) => {
      const connectionId1 =
        request.connectionId1 || request.sourceConnectionId || '';
      const connectionId2 =
        request.connectionId2 || request.targetConnectionId || '';
      const table1 = request.table1 || request.sourceTable || '';
      const table2 = request.table2 || request.targetTable || '';
      const schema1 = request.schema1 || request.sourceSchema || '';
      const schema2 = request.schema2 || request.targetSchema || '';

      const comparison = await dataDiffService.compareTableData(
        connectionId1,
        table1,
        schema1,
        connectionId2,
        table2,
        schema2,
        request.primaryKeys || []
      );
      return { success: true, comparison };
    })
  );

  // Migration: Generate SQL
  ipcMain.handle(
    IPC_CHANNELS.MIGRATION_GENERATE_SQL,
    createHandler(async (request: GenerateMigrationSQLRequest) => {
      const result = migrationGeneratorService.generateMigrationSQL(request);
      return result;
    })
  );

  // Migration: Generate Sync SQL
  ipcMain.handle(
    IPC_CHANNELS.MIGRATION_GENERATE_SYNC_SQL,
    createHandler(async (request: GenerateSyncSQLRequest) => {
      const result = dataDiffSyncGeneratorService.generateSyncSQL(request);
      return result;
    })
  );

  // Export: Comparison Report
  ipcMain.handle(
    IPC_CHANNELS.EXPORT_COMPARISON_REPORT,
    createHandler(async (request: ExportComparisonReportRequest) => {
      const comparisonData = (request.comparison ||
        request.comparisonResult) as SchemaComparisonResult;
      if (!comparisonData) {
        throw new Error('Comparison data is required');
      }
      let output = '';

      if (request.format === 'markdown') {
        output = generateMarkdownReport(comparisonData);
      } else if (request.format === 'html') {
        output = generateHTMLReport(comparisonData);
      } else if (request.format === 'json') {
        output = generateJSONReport(comparisonData);
      }

      return { success: true, data: output, format: request.format };
    })
  );

  // Query History: Get
  ipcMain.handle(
    IPC_CHANNELS.QUERY_HISTORY_GET,
    createHandler(async (request: GetQueryHistoryRequest) => {
      const dbPath = request.dbPath || '';
      const history = getQueryHistory(dbPath);
      return { success: true, history };
    })
  );

  // Query History: Save
  ipcMain.handle(
    IPC_CHANNELS.QUERY_HISTORY_SAVE,
    createHandler(async (request: SaveQueryHistoryRequest) => {
      // Build entry from request
      const entry: QueryHistoryEntry = request.entry || {
        id: crypto.randomUUID(),
        query: request.query || '',
        dbPath: request.connectionPath || '',
        timestamp: request.timestamp || new Date().toISOString(),
        description: request.description,
      };
      saveQueryHistoryEntry(entry);
      return { success: true, entry };
    })
  );

  // Query History: Delete
  ipcMain.handle(
    IPC_CHANNELS.QUERY_HISTORY_DELETE,
    createHandler(async (request: DeleteQueryHistoryRequest) => {
      const dbPath = request.dbPath || '';
      const entryId = request.id || request.entryId || '';
      deleteQueryHistoryEntry(dbPath, entryId);
      return { success: true };
    })
  );

  // Query History: Clear
  ipcMain.handle(
    IPC_CHANNELS.QUERY_HISTORY_CLEAR,
    createHandler(async (request: ClearQueryHistoryRequest) => {
      const dbPath = request.dbPath || '';
      clearQueryHistory(dbPath);
      return { success: true };
    })
  );

  // Saved Queries: Get
  ipcMain.handle(IPC_CHANNELS.SAVED_QUERIES_GET, async () => {
    try {
      const queries = getSavedQueries();
      return { success: true, queries };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get queries',
      };
    }
  });

  // Saved Queries: Save
  ipcMain.handle(IPC_CHANNELS.SAVED_QUERIES_SAVE, async (_event, request) => {
    try {
      const result = saveSavedQuery({
        name: request.name,
        queryText: request.query || request.queryText,
        dbPath: request.connectionPath || request.dbPath,
        tags: request.tags,
        description: request.description,
        collectionIds: [],
      });
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save query',
      };
    }
  });

  // Saved Queries: Update
  ipcMain.handle(IPC_CHANNELS.SAVED_QUERIES_UPDATE, async (_event, request) => {
    try {
      const result = updateSavedQuery(request.id, {
        name: request.name,
        queryText: request.query || request.queryText,
        tags: request.tags,
        description: request.description,
      });
      return result;
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to update query',
      };
    }
  });

  // Saved Queries: Delete
  ipcMain.handle(IPC_CHANNELS.SAVED_QUERIES_DELETE, async (_event, request) => {
    try {
      deleteSavedQuery(request.id);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to delete query',
      };
    }
  });

  // Collections: Get
  ipcMain.handle(IPC_CHANNELS.COLLECTIONS_GET, async () => {
    try {
      const collections = getCollections();
      return { success: true, collections };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to get collections',
      };
    }
  });

  // Collections: Save
  ipcMain.handle(IPC_CHANNELS.COLLECTIONS_SAVE, async (_event, request) => {
    try {
      const result = saveCollection({
        name: request.name,
        description: request.description,
        queryIds: [],
      });
      return result;
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to save collection',
      };
    }
  });

  // Collections: Update
  ipcMain.handle(IPC_CHANNELS.COLLECTIONS_UPDATE, async (_event, request) => {
    try {
      const result = updateCollection(request.id, {
        name: request.name,
        description: request.description,
      });
      return result;
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update collection',
      };
    }
  });

  // Collections: Delete
  ipcMain.handle(IPC_CHANNELS.COLLECTIONS_DELETE, async (_event, request) => {
    try {
      deleteCollection(request.id);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to delete collection',
      };
    }
  });

  // Collections: Add Query
  ipcMain.handle(
    IPC_CHANNELS.COLLECTIONS_ADD_QUERY,
    async (_event, request) => {
      try {
        addQueryToCollection(request.collectionId, request.queryId);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to add query',
        };
      }
    }
  );

  // Collections: Remove Query
  ipcMain.handle(
    IPC_CHANNELS.COLLECTIONS_REMOVE_QUERY,
    async (_event, request) => {
      try {
        removeQueryFromCollection(request.collectionId, request.queryId);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Failed to remove query',
        };
      }
    }
  );

  // Profiles: Get
  ipcMain.handle(IPC_CHANNELS.PROFILES_GET, async () => {
    try {
      const profiles = getProfiles();
      return { success: true, profiles };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to get profiles',
      };
    }
  });

  // Profiles: Save
  ipcMain.handle(IPC_CHANNELS.PROFILES_SAVE, async (_event, request) => {
    try {
      const result = saveProfile({
        path: request.path || '',
        filename: request.filename || request.name || '',
        displayName: request.name,
        isEncrypted: request.isEncrypted ?? false,
        lastOpened: new Date().toISOString(),
        readOnly: request.readOnly ?? false,
        isSaved: true,
        ...request.config,
      });
      return result;
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to save profile',
      };
    }
  });

  // Profiles: Update
  ipcMain.handle(IPC_CHANNELS.PROFILES_UPDATE, async (_event, request) => {
    try {
      const result = updateProfile(request.id, {
        displayName: request.name,
        ...request.config,
      });
      return result;
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to update profile',
      };
    }
  });

  // Profiles: Delete
  ipcMain.handle(IPC_CHANNELS.PROFILES_DELETE, async (_event, request) => {
    try {
      deleteProfile(request.id);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to delete profile',
      };
    }
  });

  // Connections: Update
  ipcMain.handle(
    IPC_CHANNELS.CONNECTION_UPDATE,
    createHandler(async (request: UpdateConnectionRequest) => {
      // Find and update the profile by path or connection ID
      const profiles = getProfiles();
      const profile = profiles.find(
        (p) => p.path === request.path || p.id === request.connectionId
      );

      if (!profile) {
        return { success: false, error: 'Connection profile not found' };
      }

      const result = updateProfile(profile.id, {
        displayName: request.updates?.displayName || request.displayName,
        readOnly: request.updates?.readOnly ?? request.readOnly,
      });

      return result;
    })
  );

  // Connections: Remove
  ipcMain.handle(
    IPC_CHANNELS.CONNECTION_REMOVE,
    createHandler(async (request: RemoveConnectionRequest) => {
      removeRecentConnection(request.path);
      return { success: true };
    })
  );

  // Preferences: Get
  ipcMain.handle(IPC_CHANNELS.PREFERENCES_GET, async () => {
    try {
      const preferences = getPreferences();
      return { success: true, preferences };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to get preferences',
      };
    }
  });

  // Preferences: Set
  ipcMain.handle(IPC_CHANNELS.PREFERENCES_SET, async (_event, request) => {
    try {
      const preferences = setPreferences(request.preferences);
      return { success: true, preferences };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to set preferences',
      };
    }
  });

  // App: Get Recent Connections
  ipcMain.handle(IPC_CHANNELS.APP_GET_RECENT_CONNECTIONS, async () => {
    try {
      const connections = getRecentConnections();
      return { success: true, connections };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get recent connections',
      };
    }
  });

  // Folders: Get
  ipcMain.handle(IPC_CHANNELS.FOLDERS_GET, async () => {
    try {
      const folders = getFolders();
      return { success: true, folders };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get folders',
      };
    }
  });

  // Folders: Save
  ipcMain.handle(IPC_CHANNELS.FOLDERS_SAVE, async (_event, request) => {
    try {
      const result = saveFolder({
        name: request.name || request.alias || '',
        parentId: request.parentId,
      });
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save folder',
      };
    }
  });

  // Folders: Update
  ipcMain.handle(IPC_CHANNELS.FOLDERS_UPDATE, async (_event, request) => {
    try {
      const result = updateFolder(request.id || request.path, {
        name: request.name || request.alias,
      });
      return result;
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to update folder',
      };
    }
  });

  // Folders: Delete
  ipcMain.handle(IPC_CHANNELS.FOLDERS_DELETE, async (_event, request) => {
    try {
      deleteFolder(request.id || request.path);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to delete folder',
      };
    }
  });

  // Password: Is Available
  ipcMain.handle(IPC_CHANNELS.PASSWORD_IS_AVAILABLE, async () => {
    try {
      const available = passwordStorageService.isAvailable();
      return { success: true, available };
    } catch (error) {
      return {
        success: false,
        available: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to check password storage availability',
      };
    }
  });

  // Password: Get
  ipcMain.handle(
    IPC_CHANNELS.PASSWORD_GET,
    createHandler(async (request: GetPasswordRequest) => {
      const identifier = request.identifier || request.dbPath || '';
      const password = await passwordStorageService.getPassword(identifier);
      return { success: true, password };
    })
  );

  // Password: Has
  ipcMain.handle(
    IPC_CHANNELS.PASSWORD_HAS,
    createHandler(async (request: HasPasswordRequest) => {
      const identifier = request.identifier || request.dbPath || '';
      const hasPassword = await passwordStorageService.hasPassword(identifier);
      return { success: true, hasPassword };
    })
  );

  // Password: Save
  ipcMain.handle(
    IPC_CHANNELS.PASSWORD_SAVE,
    createHandler(async (request: SavePasswordRequest) => {
      const identifier = request.identifier || request.dbPath || '';
      await passwordStorageService.savePassword(identifier, request.password);
      return { success: true };
    })
  );

  // Password: Remove
  ipcMain.handle(
    IPC_CHANNELS.PASSWORD_REMOVE,
    createHandler(async (request: RemovePasswordRequest) => {
      const identifier = request.identifier || request.dbPath || '';
      await passwordStorageService.removePassword(identifier);
      return { success: true };
    })
  );

  // Pro: Activate
  ipcMain.handle(
    IPC_CHANNELS.PRO_ACTIVATE,
    createHandler(async (request: ProActivateRequest) => {
      saveProStatus({
        isActive: true,
        activationDate: new Date().toISOString(),
        licenseKey: request.licenseKey,
      });
      return { success: true };
    })
  );

  // Pro: Get Status
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

  // Pro: Clear Status
  ipcMain.handle(IPC_CHANNELS.PRO_CLEAR_STATUS, async () => {
    try {
      clearProStatus();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to clear pro status',
      };
    }
  });

  // AI: Get Settings
  ipcMain.handle(IPC_CHANNELS.AI_GET_SETTINGS, async () => {
    try {
      const settings = getAISettings();
      return { success: true, settings };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to get AI settings',
      };
    }
  });

  // AI: Save Settings
  ipcMain.handle(IPC_CHANNELS.AI_SAVE_SETTINGS, async (_event, request) => {
    try {
      const settings = saveAISettings(request.settings);
      return { success: true, settings };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to save AI settings',
      };
    }
  });

  // AI: Query
  ipcMain.handle(
    IPC_CHANNELS.AI_QUERY,
    createHandler(async (request: AIAgentQueryRequest) => {
      const settings = getAISettings();

      if (!settings) {
        throw new Error('AI settings not configured');
      }

      if (request.provider === 'anthropic') {
        const client = new Anthropic({
          apiKey: settings.anthropicApiKey,
        });

        const response = await client.messages.create({
          model: request.model || 'claude-3-5-sonnet-20241022',
          max_tokens: request.maxTokens || 2048,
          messages: (request.messages ||
            []) as Anthropic.Messages.MessageParam[],
          system: request.systemPrompt || undefined,
        });

        return {
          success: true,
          response: {
            content:
              response.content[0].type === 'text'
                ? response.content[0].text
                : '',
            stopReason: response.stop_reason,
            usage: {
              inputTokens: response.usage.input_tokens,
              outputTokens: response.usage.output_tokens,
            },
          },
        };
      } else if (request.provider === 'openai') {
        const client = new OpenAI({
          apiKey: settings.openaiApiKey,
        });

        const response = await client.chat.completions.create({
          model: request.model || 'gpt-4-turbo-preview',
          max_tokens: request.maxTokens || 2048,
          messages: (request.messages || []).map((msg) => ({
            role: msg.role as 'user' | 'assistant' | 'system',
            content: msg.content,
          })),
        });

        return {
          success: true,
          response: {
            content: response.choices[0].message.content || '',
            stopReason: response.choices[0].finish_reason,
            usage: {
              inputTokens: response.usage?.prompt_tokens || 0,
              outputTokens: response.usage?.completion_tokens || 0,
            },
          },
        };
      } else if (request.provider === 'claude-agent') {
        const response = await claudeAgentQuery({
          prompt: request.systemPrompt || '',
        });

        return {
          success: true,
          response: {
            content: String(response || ''),
            stopReason: 'stop',
            usage: {
              inputTokens: 0,
              outputTokens: 0,
            },
          },
        };
      }

      throw new Error('Unsupported provider');
    })
  );

  // AI: Stream
  ipcMain.handle(
    IPC_CHANNELS.AI_STREAM,
    async (
      _event,
      _request: AIStreamAnthropicRequest | AIStreamOpenAIRequest
    ) => {
      // Stream handlers are more complex and would need event-based communication
      // This is a placeholder for the implementation
      return { success: false, error: 'Streaming not yet implemented' };
    }
  );

  // AI: Fetch (Anthropic)
  ipcMain.handle(
    IPC_CHANNELS.AI_FETCH_ANTHROPIC,
    createHandler(async (request: AIFetchAnthropicRequest) => {
      const client = new Anthropic({
        apiKey: request.apiKey,
      });

      const response = await client.messages.create({
        model: request.model || 'claude-3-5-sonnet-20241022',
        max_tokens: request.maxTokens || 2048,
        messages: (request.messages || []) as Anthropic.Messages.MessageParam[],
      });

      return {
        success: true,
        response: {
          content:
            response.content[0].type === 'text' ? response.content[0].text : '',
          stopReason: response.stop_reason,
        },
      };
    })
  );

  // AI: Fetch (OpenAI)
  ipcMain.handle(
    IPC_CHANNELS.AI_FETCH_OPENAI,
    createHandler(async (request: AIFetchOpenAIRequest) => {
      const client = new OpenAI({
        apiKey: request.apiKey,
      });

      const response = await client.chat.completions.create({
        model: request.model || 'gpt-4-turbo-preview',
        max_tokens: request.maxTokens || 2048,
        messages: request.messages.map((msg) => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
        })),
      });

      return {
        success: true,
        response: {
          content: response.choices[0].message.content || '',
          stopReason: response.choices[0].finish_reason,
        },
      };
    })
  );

  // AI: Cancel Stream
  ipcMain.handle(
    IPC_CHANNELS.AI_CANCEL_STREAM,
    createHandler(async (_request: AICancelStreamRequest) => {
      // Stream cancellation would be handled via event-based communication
      return { success: true };
    })
  );

  // System: Focus Window
  ipcMain.handle(
    IPC_CHANNELS.SYSTEM_FOCUS_WINDOW,
    createHandler(async (request: FocusWindowRequest) => {
      const window = BrowserWindow.fromId(request.windowId);
      if (window) {
        window.focus();
      }
      return { success: true };
    })
  );

  // System: Get System Fonts
  ipcMain.handle(IPC_CHANNELS.SYSTEM_GET_FONTS, async () => {
    try {
      const fonts = await getSystemFonts();
      return { success: true, fonts };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get fonts',
      };
    }
  });

  // System: Find Claude Paths
  ipcMain.handle(IPC_CHANNELS.SYSTEM_FIND_CLAUDE_PATHS, async () => {
    try {
      const paths = await findClaudeCodePaths();
      return { success: true, paths };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to find Claude paths',
      };
    }
  });

  // Updates: Check For Updates
  ipcMain.handle(IPC_CHANNELS.UPDATES_CHECK, async () => {
    try {
      await checkForUpdates();
      return { success: true };
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

  // Updates: Get Status
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

  // Updates: Download
  ipcMain.handle(IPC_CHANNELS.UPDATES_DOWNLOAD, async () => {
    try {
      downloadUpdate();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to download update',
      };
    }
  });

  // Updates: Quit and Install
  ipcMain.handle(IPC_CHANNELS.UPDATES_QUIT_AND_INSTALL, async () => {
    try {
      quitAndInstall();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to install update',
      };
    }
  });

  // Check Unsaved Changes
  ipcMain.handle(
    IPC_CHANNELS.CHECK_UNSAVED_CHANGES,
    createHandler(async (_request: CheckUnsavedChangesRequest) => {
      // Unsaved changes tracking is handled in the renderer
      return { success: true, hasChanges: false };
    })
  );

  // SQL Logging
  ipcMain.on('sql-execute', (_event, data) => {
    sqlLogger.log(data);
  });
}

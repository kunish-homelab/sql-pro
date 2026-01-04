import type {
  AnalyzeQueryPlanRequest,
  ApplyChangesRequest,
  CloseDatabaseRequest,
  ExecuteQueryRequest,
  GetSchemaRequest,
  GetTableDataRequest,
  OpenDatabaseRequest,
  ValidateChangesRequest,
} from '@shared/types';
import { IPC_CHANNELS } from '@shared/types';
import { ipcMain } from 'electron';
import { databaseManager, databaseService } from '../database';
import { fileWatcherService } from '../file-watcher';
import { addRecentConnection } from '../store';

export function setupDatabaseHandlers(): void {
  // Database: Open
  ipcMain.handle(
    IPC_CHANNELS.DB_OPEN,
    async (_event, request: OpenDatabaseRequest) => {
      // Check if this is a new-style connection with config
      if (request.config) {
        const result = await databaseManager.open(request.config);

        if (result.success && result.connection) {
          addRecentConnection(
            result.connection.path,
            result.connection.filename,
            result.connection.isEncrypted,
            result.connection.databaseType
          );
        }

        return result;
      }

      // Legacy SQLite connection (backward compatibility)
      if (!request.path) {
        return {
          success: false,
          error: 'Database path is required',
          errorCode: 'CONNECTION_ERROR',
        };
      }

      const result = await databaseService.open(
        request.path,
        request.password,
        request.readOnly
      );

      if (result.success) {
        addRecentConnection(
          request.path,
          result.connection.filename,
          result.connection.isEncrypted,
          'sqlite'
        );

        // Start watching the database file for external changes
        fileWatcherService.watch(result.connection.id, request.path);
      }

      return result;
    }
  );

  // Database: Close
  ipcMain.handle(
    IPC_CHANNELS.DB_CLOSE,
    async (_event, request: CloseDatabaseRequest) => {
      // Stop watching the file before closing the connection
      fileWatcherService.unwatch(request.connectionId);

      // Try database manager first (for new connections)
      const managerResult = databaseManager.close(request.connectionId);
      if (managerResult.success) {
        return managerResult;
      }

      // Fall back to legacy database service
      return databaseService.close(request.connectionId);
    }
  );

  // Database: Get Schema
  ipcMain.handle(
    IPC_CHANNELS.DB_GET_SCHEMA,
    async (_event, request: GetSchemaRequest) => {
      // Check if connection is async (MySQL/PostgreSQL)
      if (databaseManager.isAsyncConnection(request.connectionId)) {
        return databaseManager.getSchemaAsync(request.connectionId);
      }

      // Try database manager for new connections
      const managerResult = databaseManager.getSchema(request.connectionId);
      if (
        managerResult.success ||
        managerResult.error !== 'Connection not found'
      ) {
        return managerResult;
      }

      // Fall back to legacy database service
      return databaseService.getSchema(request.connectionId);
    }
  );

  // Database: Get Table Data
  ipcMain.handle(
    IPC_CHANNELS.DB_GET_TABLE_DATA,
    async (_event, request: GetTableDataRequest) => {
      // Check if connection is async (MySQL/PostgreSQL)
      if (databaseManager.isAsyncConnection(request.connectionId)) {
        return databaseManager.getTableDataAsync(
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

      // Try database manager for new connections
      const conn = databaseManager.getConnection(request.connectionId);
      if (conn) {
        return databaseManager.getTableData(
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

      // Fall back to legacy database service
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
      // Check if this is a modifying query (INSERT, UPDATE, DELETE, etc.)
      const modifyingKeywords =
        /^\s*(?:INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TRUNCATE|REPLACE)/i;
      const isModifying = modifyingKeywords.test(request.query);

      // Ignore file changes during our own writes
      if (isModifying) {
        const connection = databaseService.getConnection(request.connectionId);
        if (connection) {
          fileWatcherService.ignoreChanges(connection.path);
        }
      }

      const startTime = Date.now();

      // Check if connection is async (MySQL/PostgreSQL)
      let result;
      if (databaseManager.isAsyncConnection(request.connectionId)) {
        result = await databaseManager.executeQueryAsync(
          request.connectionId,
          request.query
        );
      } else {
        // Try database manager for new connections
        const conn = databaseManager.getConnection(request.connectionId);
        if (conn) {
          result = databaseManager.executeQuery(
            request.connectionId,
            request.query
          );
        } else {
          // Fall back to legacy database service
          result = databaseService.executeQuery(
            request.connectionId,
            request.query
          );
        }
      }

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
      // Try database manager first
      const conn = databaseManager.getConnection(request.connectionId);
      if (conn) {
        return databaseManager.validateChanges(
          request.connectionId,
          request.changes
        );
      }

      // Fall back to legacy database service
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
      // Get the connection to find the database path (for file watcher)
      const connection = databaseService.getConnection(request.connectionId);
      if (connection) {
        // Ignore file changes during our own writes
        fileWatcherService.ignoreChanges(connection.path);
      }

      // Check if connection is async (MySQL/PostgreSQL)
      if (databaseManager.isAsyncConnection(request.connectionId)) {
        return databaseManager.applyChangesAsync(
          request.connectionId,
          request.changes
        );
      }

      // Try database manager first
      const conn = databaseManager.getConnection(request.connectionId);
      if (conn) {
        return databaseManager.applyChanges(
          request.connectionId,
          request.changes
        );
      }

      // Fall back to legacy database service
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
      // Check if connection is async (MySQL/PostgreSQL)
      if (databaseManager.isAsyncConnection(request.connectionId)) {
        return databaseManager.explainQueryAsync(
          request.connectionId,
          request.query
        );
      }

      // Try database manager first
      const conn = databaseManager.getConnection(request.connectionId);
      if (conn) {
        return databaseManager.explainQuery(
          request.connectionId,
          request.query
        );
      }

      // Fall back to legacy database service
      return databaseService.analyzeQueryPlan(
        request.connectionId,
        request.query
      );
    }
  );
}

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
import { databaseService } from '../database';
import { addRecentConnection } from '../store';

export function setupDatabaseHandlers(): void {
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
}

/**
 * IPC handlers for SQL logging operations
 */

import type { ClearSqlLogsRequest, GetSqlLogsRequest } from '@shared/types';
import { IPC_CHANNELS } from '@shared/types';
import { ipcMain } from 'electron';
import { sqlLogger } from '../sql-logger';

export function setupSqlLogHandlers(): void {
  // SQL Log: Get logs
  ipcMain.handle(
    IPC_CHANNELS.SQL_LOG_GET,
    async (_event, request: GetSqlLogsRequest) => {
      try {
        const logs = sqlLogger.getLogs({
          limit: request.limit,
          connectionId: request.connectionId,
          level: request.level,
        });
        return { success: true, logs };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Failed to get SQL logs',
        };
      }
    }
  );

  // SQL Log: Clear logs
  ipcMain.handle(
    IPC_CHANNELS.SQL_LOG_CLEAR,
    async (_event, request: ClearSqlLogsRequest) => {
      try {
        sqlLogger.clearLogs(request.connectionId);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Failed to clear SQL logs',
        };
      }
    }
  );
}

export function cleanupSqlLogHandlers(): void {
  ipcMain.removeHandler(IPC_CHANNELS.SQL_LOG_GET);
  ipcMain.removeHandler(IPC_CHANNELS.SQL_LOG_CLEAR);
}

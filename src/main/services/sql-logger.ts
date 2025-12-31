import type { SqlLogEntry, SqlLogLevel } from '../../shared/types';
import { BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/types';

const MAX_LOG_ENTRIES = 1000;

// Generate a unique ID for log entries
let logCounter = 0;
function generateLogId(): string {
  logCounter += 1;
  return `log_${Date.now()}_${logCounter}`;
}

class SqlLoggerService {
  private logs: SqlLogEntry[] = [];
  private enabled = true;

  /**
   * Enable or disable SQL logging
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if logging is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Log a SQL operation
   */
  log(entry: Omit<SqlLogEntry, 'id' | 'timestamp'>): SqlLogEntry {
    if (!this.enabled) {
      return {
        ...entry,
        id: '',
        timestamp: new Date().toISOString(),
      };
    }

    const fullEntry: SqlLogEntry = {
      ...entry,
      id: generateLogId(),
      timestamp: new Date().toISOString(),
    };

    // Add to in-memory log
    this.logs.unshift(fullEntry);

    // Trim if exceeds max
    if (this.logs.length > MAX_LOG_ENTRIES) {
      this.logs = this.logs.slice(0, MAX_LOG_ENTRIES);
    }

    // Broadcast to all renderer windows
    this.broadcastLog(fullEntry);

    return fullEntry;
  }

  /**
   * Log a query operation
   */
  logQuery(params: {
    connectionId: string;
    dbPath?: string;
    sql: string;
    durationMs: number;
    success: boolean;
    error?: string;
    rowCount?: number;
  }): SqlLogEntry {
    return this.log({
      connectionId: params.connectionId,
      dbPath: params.dbPath,
      operation: 'query',
      sql: params.sql,
      durationMs: params.durationMs,
      success: params.success,
      error: params.error,
      rowCount: params.rowCount,
      level: params.success ? 'info' : 'error',
    });
  }

  /**
   * Log an execute operation (INSERT/UPDATE/DELETE)
   */
  logExecute(params: {
    connectionId: string;
    dbPath?: string;
    sql: string;
    durationMs: number;
    success: boolean;
    error?: string;
    rowCount?: number;
  }): SqlLogEntry {
    return this.log({
      connectionId: params.connectionId,
      dbPath: params.dbPath,
      operation: 'execute',
      sql: params.sql,
      durationMs: params.durationMs,
      success: params.success,
      error: params.error,
      rowCount: params.rowCount,
      level: params.success ? 'info' : 'error',
    });
  }

  /**
   * Log a connection open operation
   */
  logOpen(params: {
    connectionId: string;
    dbPath: string;
    success: boolean;
    error?: string;
    durationMs?: number;
  }): SqlLogEntry {
    return this.log({
      connectionId: params.connectionId,
      dbPath: params.dbPath,
      operation: 'open',
      durationMs: params.durationMs,
      success: params.success,
      error: params.error,
      level: params.success ? 'info' : 'error',
    });
  }

  /**
   * Log a connection close operation
   */
  logClose(params: {
    connectionId: string;
    dbPath?: string;
    success: boolean;
    error?: string;
  }): SqlLogEntry {
    return this.log({
      connectionId: params.connectionId,
      dbPath: params.dbPath,
      operation: 'close',
      success: params.success,
      error: params.error,
      level: params.success ? 'info' : 'error',
    });
  }

  /**
   * Log a schema operation
   */
  logSchema(params: {
    connectionId: string;
    dbPath?: string;
    durationMs: number;
    success: boolean;
    error?: string;
  }): SqlLogEntry {
    return this.log({
      connectionId: params.connectionId,
      dbPath: params.dbPath,
      operation: 'schema',
      durationMs: params.durationMs,
      success: params.success,
      error: params.error,
      level: params.success ? 'debug' : 'error',
    });
  }

  /**
   * Get logs with optional filtering
   */
  getLogs(params?: {
    limit?: number;
    connectionId?: string;
    level?: SqlLogLevel;
  }): SqlLogEntry[] {
    let result = this.logs;

    if (params?.connectionId) {
      result = result.filter((log) => log.connectionId === params.connectionId);
    }

    if (params?.level) {
      result = result.filter((log) => log.level === params.level);
    }

    if (params?.limit) {
      result = result.slice(0, params.limit);
    }

    return result;
  }

  /**
   * Clear logs
   */
  clearLogs(connectionId?: string): void {
    if (connectionId) {
      this.logs = this.logs.filter((log) => log.connectionId !== connectionId);
    } else {
      this.logs = [];
    }
  }

  /**
   * Broadcast log entry to all renderer windows
   */
  private broadcastLog(entry: SqlLogEntry): void {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC_CHANNELS.SQL_LOG_ENTRY, entry);
      }
    }
  }
}

// Singleton instance
export const sqlLogger = new SqlLoggerService();

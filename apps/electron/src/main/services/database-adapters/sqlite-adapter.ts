/**
 * SQLite database adapter
 * Refactored from the original database.ts to implement the adapter interface
 */

import type {
  ColumnInfo,
  DatabaseConnectionConfig,
  ErrorCode,
  ErrorPosition,
  ForeignKeyInfo,
  GetTableDataResponse,
  IndexInfo,
  PendingChangeInfo,
  QueryPlanNode,
  QueryPlanStats,
  SchemaInfo,
  TableInfo,
  TriggerInfo,
  ValidationResult,
} from '@shared/types';
import type {
  AdapterConnectionInfo,
  DatabaseAdapter,
  OpenResult,
} from './types';
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import Database from 'better-sqlite3-multiple-ciphers';
import { enhanceConnectionError, enhanceQueryError } from '@/lib/error-parser';
import { sqlLogger } from '../sql-logger';

interface SQLiteConnectionInfo {
  id: string;
  db: Database.Database;
  path: string;
  filename: string;
  isEncrypted: boolean;
  isReadOnly: boolean;
}

// Simple ID generator
let idCounter = 0;
function generateId(): string {
  idCounter += 1;
  return `sqlite_${idCounter}_${Math.random().toString(36).substring(2, 9)}`;
}

// Check if file appears to be encrypted (doesn't have SQLite header)
function isFileEncrypted(path: string): boolean {
  try {
    const header = readFileSync(path, { encoding: null }).subarray(0, 16);
    // SQLite header is "SQLite format 3\0"
    const sqliteHeader = Buffer.from('SQLite format 3\0');
    return !header.equals(sqliteHeader);
  } catch {
    return false;
  }
}

// Cipher configurations to try (most common SQLCipher versions)
interface CipherConfig {
  cipher: string;
  legacy?: number;
  kdfIter?: number;
  pageSize?: number;
  hexKey?: boolean;
  rawKey?: boolean;
  plaintextHeader?: number;
}

const CIPHER_CONFIGS: CipherConfig[] = [
  { cipher: 'sqlcipher', legacy: 0 },
  { cipher: 'sqlcipher', legacy: 0, hexKey: true },
  { cipher: 'sqlcipher', legacy: 0, rawKey: true },
  { cipher: 'sqlcipher', legacy: 1 },
  { cipher: 'sqlcipher', legacy: 1, hexKey: true },
  { cipher: 'sqlcipher', legacy: 1, rawKey: true },
  { cipher: 'sqlcipher', legacy: 2 },
  { cipher: 'sqlcipher', legacy: 3 },
  { cipher: 'chacha20' },
  { cipher: 'chacha20', hexKey: true },
  { cipher: 'chacha20', rawKey: true },
  { cipher: 'aes256cbc' },
  { cipher: 'aes256cbc', hexKey: true },
  { cipher: 'aes256cbc', rawKey: true },
  { cipher: 'rc4' },
  { cipher: 'rc4', rawKey: true },
  { cipher: 'aes128cbc' },
  { cipher: 'aes128cbc', rawKey: true },
  { cipher: 'sqlcipher', legacy: 0, kdfIter: 64000 },
  { cipher: 'sqlcipher', legacy: 0, kdfIter: 4000 },
  { cipher: 'sqlcipher', legacy: 0, kdfIter: 1 },
  { cipher: 'sqlcipher', legacy: 0, plaintextHeader: 32 },
  { cipher: 'sqlcipher', legacy: 4 },
];

// Helper functions
function calculateDepth(nodes: QueryPlanNode[], currentDepth = 0): number {
  if (nodes.length === 0) return currentDepth;

  let maxDepth = currentDepth;
  for (const node of nodes) {
    const childDepth = calculateDepth(node.children || [], currentDepth + 1);
    maxDepth = Math.max(maxDepth, childDepth);
  }

  return maxDepth;
}

/**
 * SQLite database adapter implementation
 */
export class SQLiteAdapter implements DatabaseAdapter {
  readonly type = 'sqlite' as const;
  private connections: Map<string, SQLiteConnectionInfo> = new Map();

  async open(config: DatabaseConnectionConfig): Promise<OpenResult> {
    const path = config.path;
    const password = config.password;
    const readOnly = config.readOnly ?? false;

    if (!path) {
      return {
        success: false,
        error: 'SQLite database path is required',
        errorCode: 'CONNECTION_ERROR',
      };
    }

    try {
      // Check if file appears encrypted before trying to open
      const fileIsEncrypted = isFileEncrypted(path);

      // If no password provided and file appears encrypted, ask for password
      if (!password && fileIsEncrypted) {
        const encryptedError =
          'Database appears to be encrypted. Please provide a password.';
        const enhanced = enhanceConnectionError(encryptedError);
        return {
          success: false,
          error: encryptedError,
          needsPassword: true,
          errorCode: enhanced.errorCode,
          troubleshootingSteps: enhanced.troubleshootingSteps,
          documentationUrl: enhanced.documentationUrl,
        };
      }

      // If password provided, try different cipher configurations
      if (password) {
        for (const cipherConfig of CIPHER_CONFIGS) {
          let db: Database.Database | null = null;
          try {
            db = new Database(path, { readonly: readOnly });

            // Set cipher configuration
            db.pragma(`cipher = '${cipherConfig.cipher}'`);
            if (cipherConfig.legacy !== undefined) {
              db.pragma(`legacy = ${cipherConfig.legacy}`);
            }
            if (cipherConfig.kdfIter !== undefined) {
              db.pragma(`kdf_iter = ${cipherConfig.kdfIter}`);
            }
            if (cipherConfig.pageSize !== undefined) {
              db.pragma(`cipher_page_size = ${cipherConfig.pageSize}`);
            }
            if (cipherConfig.plaintextHeader !== undefined) {
              db.pragma(
                `cipher_plaintext_header_size = ${cipherConfig.plaintextHeader}`
              );
            }

            // Set the key (hex format if specified)
            if (cipherConfig.rawKey) {
              db.pragma(`key = "x'${password}'"`);
            } else if (cipherConfig.hexKey) {
              const hexKey = Buffer.from(password, 'utf8').toString('hex');
              db.pragma(`key = "x'${hexKey}'"`);
            } else {
              db.pragma(`key = '${password}'`);
            }

            // Test if we can read from the database
            db.prepare('SELECT count(*) FROM sqlite_master').get();

            // Success! Return connection
            const id = generateId();
            const filename = path.split('/').pop() || path;

            const connectionInfo: SQLiteConnectionInfo = {
              id,
              db,
              path,
              filename,
              isEncrypted: true,
              isReadOnly: readOnly,
            };

            this.connections.set(id, connectionInfo);

            // Log successful open
            sqlLogger.logOpen({
              connectionId: id,
              dbPath: path,
              success: true,
            });

            return {
              success: true,
              connection: {
                id,
                path,
                filename,
                isEncrypted: true,
                isReadOnly: readOnly,
                databaseType: 'sqlite',
              },
            };
          } catch {
            if (db) {
              try {
                db.close();
              } catch {
                // Ignore close errors
              }
            }
            continue;
          }
        }

        // All cipher configs failed
        const invalidPasswordError =
          'Invalid password or unsupported encryption format. Supported formats: SQLCipher 1-4, ChaCha20, AES-256-CBC, RC4.';
        const encryptionEnhanced = enhanceConnectionError(invalidPasswordError);
        return {
          success: false,
          error: invalidPasswordError,
          errorCode: 'ENCRYPTION_ERROR',
          troubleshootingSteps: [
            'Verify the encryption password is correct',
            'Try different cipher configurations (SQLCipher 3 vs 4)',
            'Check if the database was created with a different encryption tool',
            'Verify the file is actually an encrypted SQLite database',
            'Contact the database creator for the correct password/cipher settings',
          ],
          documentationUrl: encryptionEnhanced.documentationUrl,
        };
      }

      // No password, try opening normally
      const db = new Database(path, { readonly: readOnly });

      // Test connection
      db.prepare('SELECT 1').get();

      const id = generateId();
      const filename = path.split('/').pop() || path;

      const connectionInfo: SQLiteConnectionInfo = {
        id,
        db,
        path,
        filename,
        isEncrypted: false,
        isReadOnly: readOnly,
      };

      this.connections.set(id, connectionInfo);

      // Log successful open
      sqlLogger.logOpen({
        connectionId: id,
        dbPath: path,
        success: true,
      });

      return {
        success: true,
        connection: {
          id,
          path,
          filename,
          isEncrypted: false,
          isReadOnly: readOnly,
          databaseType: 'sqlite',
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to open database';

      // Log failed open
      sqlLogger.logOpen({
        connectionId: 'unknown',
        dbPath: path,
        success: false,
        error: errorMessage,
      });

      // Check if error suggests encryption
      if (
        errorMessage.includes('file is not a database') ||
        errorMessage.includes('encrypted')
      ) {
        const encryptedError =
          'Database appears to be encrypted. Please provide a password.';
        const enhanced = enhanceConnectionError(encryptedError);
        return {
          success: false,
          error: encryptedError,
          needsPassword: true,
          errorCode: enhanced.errorCode,
          troubleshootingSteps: enhanced.troubleshootingSteps,
          documentationUrl: enhanced.documentationUrl,
        };
      }

      // Enhance other connection errors with troubleshooting steps
      const enhanced = enhanceConnectionError(errorMessage);
      return {
        success: false,
        error: enhanced.error,
        errorCode: enhanced.errorCode,
        troubleshootingSteps: enhanced.troubleshootingSteps,
        documentationUrl: enhanced.documentationUrl,
      };
    }
  }

  close(
    connectionId: string
  ): { success: true } | { success: false; error: string } {
    const conn = this.connections.get(connectionId);
    if (!conn) {
      return { success: false, error: 'Connection not found' };
    }

    try {
      conn.db.close();
      this.connections.delete(connectionId);

      // Log successful close
      sqlLogger.logClose({
        connectionId,
        dbPath: conn.path,
        success: true,
      });

      return { success: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to close database';

      // Log failed close
      sqlLogger.logClose({
        connectionId,
        dbPath: conn.path,
        success: false,
        error: errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  getConnection(connectionId: string): AdapterConnectionInfo | null {
    const conn = this.connections.get(connectionId);
    if (!conn) {
      return null;
    }

    return {
      id: conn.id,
      path: conn.path,
      filename: conn.filename,
      isEncrypted: conn.isEncrypted,
      isReadOnly: conn.isReadOnly,
      databaseType: 'sqlite',
    };
  }

  getSchema(connectionId: string):
    | {
        success: true;
        schemas: SchemaInfo[];
        tables: TableInfo[];
        views: TableInfo[];
      }
    | { success: false; error: string } {
    const conn = this.connections.get(connectionId);
    if (!conn) {
      return { success: false, error: 'Connection not found' };
    }

    try {
      const startTime = performance.now();
      const databaseList = conn.db
        .prepare('PRAGMA database_list')
        .all() as Array<{ seq: number; name: string; file: string }>;
      const durationMs = performance.now() - startTime;

      sqlLogger.logQuery({
        connectionId,
        dbPath: conn.path,
        sql: 'PRAGMA database_list',
        durationMs,
        success: true,
        rowCount: databaseList.length,
      });

      const schemas: SchemaInfo[] = [];
      const allTables: TableInfo[] = [];
      const allViews: TableInfo[] = [];

      for (const dbInfo of databaseList) {
        const schemaName = dbInfo.name;

        const tables = this.getTablesAndViews(
          conn.db,
          'table',
          schemaName,
          connectionId,
          conn.path
        );
        const views = this.getTablesAndViews(
          conn.db,
          'view',
          schemaName,
          connectionId,
          conn.path
        );

        if (tables.length > 0 || views.length > 0 || schemaName === 'main') {
          schemas.push({
            name: schemaName,
            tables,
            views,
          });
        }

        allTables.push(...tables);
        allViews.push(...views);
      }

      return { success: true, schemas, tables: allTables, views: allViews };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get schema',
      };
    }
  }

  private getTablesAndViews(
    db: Database.Database,
    type: 'table' | 'view',
    schema: string = 'main',
    connectionId?: string,
    dbPath?: string
  ): TableInfo[] {
    const sqliteType = type === 'table' ? 'table' : 'view';
    const sql = `SELECT name, sql FROM "${schema}".sqlite_master WHERE type = ? AND name NOT LIKE 'sqlite_%' ORDER BY name`;
    const startTime = performance.now();
    const items = db.prepare(sql).all(sqliteType) as Array<{
      name: string;
      sql: string;
    }>;
    const durationMs = performance.now() - startTime;

    if (connectionId) {
      sqlLogger.logQuery({
        connectionId,
        dbPath,
        sql: sql.replace('?', `'${sqliteType}'`),
        durationMs,
        success: true,
        rowCount: items.length,
      });
    }

    return items.map((item) => {
      const columns = this.getColumns(db, item.name, schema);
      const primaryKey = columns
        .filter((c) => c.isPrimaryKey)
        .map((c) => c.name);
      const foreignKeys = this.getForeignKeys(db, item.name, schema);
      const indexes =
        type === 'table' ? this.getIndexes(db, item.name, schema) : [];
      const triggers =
        type === 'table' ? this.getTriggers(db, item.name, schema) : [];
      const rowCount =
        type === 'table' ? this.getRowCount(db, item.name, schema) : undefined;

      return {
        name: item.name,
        schema,
        type,
        columns,
        primaryKey,
        foreignKeys,
        indexes,
        triggers,
        rowCount,
        sql: item.sql || '',
      };
    });
  }

  private getColumns(
    db: Database.Database,
    tableName: string,
    schema: string = 'main'
  ): ColumnInfo[] {
    const columns = db
      .prepare(`PRAGMA "${schema}".table_info("${tableName}")`)
      .all() as Array<{
      cid: number;
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
      pk: number;
    }>;

    return columns.map((col) => ({
      name: col.name,
      type: col.type,
      nullable: col.notnull === 0,
      defaultValue: col.dflt_value,
      isPrimaryKey: col.pk > 0,
    }));
  }

  private getForeignKeys(
    db: Database.Database,
    tableName: string,
    schema: string = 'main'
  ): ForeignKeyInfo[] {
    const fks = db
      .prepare(`PRAGMA "${schema}".foreign_key_list("${tableName}")`)
      .all() as Array<{
      id: number;
      seq: number;
      table: string;
      from: string;
      to: string;
      on_update: string;
      on_delete: string;
    }>;

    return fks.map((fk) => ({
      column: fk.from,
      referencedTable: fk.table,
      referencedColumn: fk.to,
      onDelete: fk.on_delete,
      onUpdate: fk.on_update,
    }));
  }

  private getIndexes(
    db: Database.Database,
    tableName: string,
    schema: string = 'main'
  ): IndexInfo[] {
    const indexList = db
      .prepare(`PRAGMA "${schema}".index_list("${tableName}")`)
      .all() as Array<{
      seq: number;
      name: string;
      unique: number;
      origin: string;
      partial: number;
    }>;

    return indexList
      .filter((idx) => !idx.name.startsWith('sqlite_'))
      .map((idx) => {
        const indexInfo = db
          .prepare(`PRAGMA "${schema}".index_info("${idx.name}")`)
          .all() as Array<{
          seqno: number;
          cid: number;
          name: string;
        }>;

        const sqlResult = db
          .prepare(
            `SELECT sql FROM "${schema}".sqlite_master WHERE type = 'index' AND name = ?`
          )
          .get(idx.name) as { sql: string } | undefined;

        return {
          name: idx.name,
          columns: indexInfo.map((i) => i.name),
          isUnique: idx.unique === 1,
          sql: sqlResult?.sql || '',
        };
      });
  }

  private getTriggers(
    db: Database.Database,
    tableName: string,
    schema: string = 'main'
  ): TriggerInfo[] {
    const triggers = db
      .prepare(
        `SELECT name, sql FROM "${schema}".sqlite_master WHERE type = 'trigger' AND tbl_name = ? ORDER BY name`
      )
      .all(tableName) as Array<{ name: string; sql: string }>;

    return triggers.map((trigger) => {
      const sql = trigger.sql || '';
      let timing: 'BEFORE' | 'AFTER' | 'INSTEAD OF' = 'BEFORE';
      let event: 'INSERT' | 'UPDATE' | 'DELETE' = 'INSERT';

      const upperSql = sql.toUpperCase();
      if (upperSql.includes('AFTER')) {
        timing = 'AFTER';
      } else if (upperSql.includes('INSTEAD OF')) {
        timing = 'INSTEAD OF';
      }

      if (upperSql.includes('UPDATE')) {
        event = 'UPDATE';
      } else if (upperSql.includes('DELETE')) {
        event = 'DELETE';
      }

      return {
        name: trigger.name,
        tableName,
        timing,
        event,
        sql,
      };
    });
  }

  private getRowCount(
    db: Database.Database,
    tableName: string,
    schema: string = 'main'
  ): number {
    try {
      const result = db
        .prepare(`SELECT COUNT(*) as count FROM "${schema}"."${tableName}"`)
        .get() as { count: number };
      return result.count;
    } catch {
      return 0;
    }
  }

  execute(
    connectionId: string,
    sql: string,
    params?: unknown[]
  ):
    | { success: true; changes: number; lastInsertRowid: number }
    | {
        success: false;
        error: string;
        errorCode?: ErrorCode;
        errorPosition?: ErrorPosition;
        troubleshootingSteps?: string[];
        documentationUrl?: string;
      } {
    const conn = this.connections.get(connectionId);
    if (!conn) {
      return { success: false, error: 'Connection not found' };
    }

    const startTime = performance.now();
    try {
      const stmt = conn.db.prepare(sql);
      const result = stmt.run(...(params || []));
      const durationMs = performance.now() - startTime;

      sqlLogger.logExecute({
        connectionId,
        dbPath: conn.path,
        sql,
        durationMs,
        success: true,
        rowCount: result.changes,
      });

      return {
        success: true,
        changes: result.changes,
        lastInsertRowid:
          typeof result.lastInsertRowid === 'bigint'
            ? Number(result.lastInsertRowid)
            : result.lastInsertRowid,
      };
    } catch (error) {
      const durationMs = performance.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const enhanced = enhanceQueryError(errorMessage, sql);

      sqlLogger.logExecute({
        connectionId,
        dbPath: conn.path,
        sql,
        durationMs,
        success: false,
        error: enhanced.error,
      });

      return {
        success: false,
        error: enhanced.error,
        errorCode: enhanced.errorCode,
        errorPosition: enhanced.errorPosition,
        troubleshootingSteps: enhanced.troubleshootingSteps,
        documentationUrl: enhanced.documentationUrl,
      };
    }
  }

  query(
    connectionId: string,
    sql: string,
    params?: unknown[]
  ):
    | { success: true; columns: string[]; rows: unknown[][] }
    | {
        success: false;
        error: string;
        errorCode?: ErrorCode;
        errorPosition?: ErrorPosition;
        troubleshootingSteps?: string[];
        documentationUrl?: string;
      } {
    const conn = this.connections.get(connectionId);
    if (!conn) {
      return { success: false, error: 'Connection not found' };
    }

    const startTime = performance.now();
    try {
      const stmt = conn.db.prepare(sql);
      const rows = stmt.all(...(params || [])) as Array<
        Record<string, unknown>
      >;
      const durationMs = performance.now() - startTime;

      if (rows.length === 0) {
        sqlLogger.logQuery({
          connectionId,
          dbPath: conn.path,
          sql,
          durationMs,
          success: true,
          rowCount: 0,
        });

        return {
          success: true,
          columns: [],
          rows: [],
        };
      }

      const columns = Object.keys(rows[0]);
      const rowsArray = rows.map((row) => columns.map((col) => row[col]));

      sqlLogger.logQuery({
        connectionId,
        dbPath: conn.path,
        sql,
        durationMs,
        success: true,
        rowCount: rows.length,
      });

      return {
        success: true,
        columns,
        rows: rowsArray,
      };
    } catch (error) {
      const durationMs = performance.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const enhanced = enhanceQueryError(errorMessage, sql);

      sqlLogger.logQuery({
        connectionId,
        dbPath: conn.path,
        sql,
        durationMs,
        success: false,
        error: enhanced.error,
      });

      return {
        success: false,
        error: enhanced.error,
        errorCode: enhanced.errorCode,
        errorPosition: enhanced.errorPosition,
        troubleshootingSteps: enhanced.troubleshootingSteps,
        documentationUrl: enhanced.documentationUrl,
      };
    }
  }

  getTableData(
    connectionId: string,
    table: string,
    page: number,
    pageSize: number,
    sortColumn?: string,
    sortDirection?: 'asc' | 'desc',
    filters?: Array<{
      column: string;
      operator: string;
      value: string;
    }>,
    schema?: string
  ): GetTableDataResponse {
    const conn = this.connections.get(connectionId);
    if (!conn) {
      return { success: false, error: 'Connection not found' };
    }

    const schemaPrefix = schema ? `"${schema}".` : '';
    let sql = `SELECT * FROM ${schemaPrefix}"${table}"`;
    const params: unknown[] = [];

    try {
      if (filters && filters.length > 0) {
        const conditions = filters.map((f) => {
          switch (f.operator) {
            case 'eq':
              params.push(f.value);
              return `"${f.column}" = ?`;
            case 'neq':
              params.push(f.value);
              return `"${f.column}" != ?`;
            case 'gt':
              params.push(f.value);
              return `"${f.column}" > ?`;
            case 'lt':
              params.push(f.value);
              return `"${f.column}" < ?`;
            case 'gte':
              params.push(f.value);
              return `"${f.column}" >= ?`;
            case 'lte':
              params.push(f.value);
              return `"${f.column}" <= ?`;
            case 'like':
              params.push(`%${f.value}%`);
              return `"${f.column}" LIKE ?`;
            case 'isnull':
              return `"${f.column}" IS NULL`;
            case 'notnull':
              return `"${f.column}" IS NOT NULL`;
            default:
              params.push(f.value);
              return `"${f.column}" = ?`;
          }
        });
        sql += ` WHERE ${conditions.join(' AND ')}`;
      }

      if (sortColumn) {
        sql += ` ORDER BY "${sortColumn}" ${sortDirection === 'desc' ? 'DESC' : 'ASC'}`;
      }

      const countSql = sql.replace(/SELECT \*/, 'SELECT COUNT(*) as count');
      const countStartTime = performance.now();
      const countResult = conn.db.prepare(countSql).get(...params) as {
        count: number;
      };
      const countDurationMs = performance.now() - countStartTime;
      const totalRows = countResult.count;

      sqlLogger.logQuery({
        connectionId,
        dbPath: conn.path,
        sql: countSql,
        durationMs: countDurationMs,
        success: true,
        rowCount: 1,
      });

      const offset = (page - 1) * pageSize;
      sql += ` LIMIT ? OFFSET ?`;
      params.push(pageSize, offset);

      const dataStartTime = performance.now();
      const rows = conn.db.prepare(sql).all(...params) as Array<
        Record<string, unknown>
      >;
      const dataDurationMs = performance.now() - dataStartTime;

      sqlLogger.logQuery({
        connectionId,
        dbPath: conn.path,
        sql,
        durationMs: dataDurationMs,
        success: true,
        rowCount: rows.length,
      });

      const columns = this.getColumns(conn.db, table, schema || 'main');

      return {
        success: true,
        columns,
        rows,
        totalRows,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to get table data';

      sqlLogger.logQuery({
        connectionId,
        dbPath: conn.path,
        sql,
        durationMs: 0,
        success: false,
        error: errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  private splitStatements(sql: string): string[] {
    const statements: string[] = [];
    let current = '';
    let inString: string | null = null;
    let inLineComment = false;
    let inBlockComment = false;

    for (let i = 0; i < sql.length; i++) {
      const char = sql[i];
      const nextChar = sql[i + 1];

      if (!inString && !inBlockComment && char === '-' && nextChar === '-') {
        inLineComment = true;
        current += char;
        continue;
      }

      if (inLineComment && char === '\n') {
        inLineComment = false;
        current += char;
        continue;
      }

      if (!inString && !inLineComment && char === '/' && nextChar === '*') {
        inBlockComment = true;
        current += char;
        continue;
      }

      if (inBlockComment && char === '*' && nextChar === '/') {
        inBlockComment = false;
        current += char + nextChar;
        i++;
        continue;
      }

      if (!inLineComment && !inBlockComment) {
        if (!inString && (char === "'" || char === '"')) {
          inString = char;
        } else if (inString === char) {
          if (nextChar === char) {
            current += char + nextChar;
            i++;
            continue;
          }
          inString = null;
        }
      }

      if (!inString && !inLineComment && !inBlockComment && char === ';') {
        const stmt = current.trim();
        if (stmt) {
          statements.push(stmt);
        }
        current = '';
        continue;
      }

      current += char;
    }

    const lastStmt = current.trim();
    if (lastStmt) {
      statements.push(lastStmt);
    }

    return statements;
  }

  executeQuery(connectionId: string, query: string) {
    const conn = this.connections.get(connectionId);
    if (!conn) {
      return { success: false as const, error: 'Connection not found' };
    }

    const statements = this.splitStatements(query);

    if (statements.length === 0) {
      return { success: false as const, error: 'No SQL statements to execute' };
    }

    if (statements.length === 1) {
      return this.executeSingleStatement(connectionId, statements[0]);
    }

    const resultSets: Array<{
      columns: string[];
      rows: Record<string, unknown>[];
    }> = [];
    let totalChanges = 0;
    let lastInsertRowid = 0;
    let executedCount = 0;

    const hasUserTransaction = statements.some((stmt) => {
      const upper = stmt.trim().toUpperCase();
      return (
        upper.startsWith('BEGIN') ||
        upper.startsWith('COMMIT') ||
        upper.startsWith('ROLLBACK') ||
        upper.startsWith('END')
      );
    });

    const useAutoTransaction = !hasUserTransaction;

    try {
      if (useAutoTransaction) {
        conn.db.exec('BEGIN TRANSACTION');
      }

      for (const stmt of statements) {
        const result = this.executeSingleStatement(connectionId, stmt);

        if (!result.success) {
          if (useAutoTransaction) {
            try {
              conn.db.exec('ROLLBACK');
            } catch {
              // Ignore rollback errors
            }
          }
          return {
            success: false as const,
            error: `Error in statement ${executedCount + 1}: ${result.error}`,
            errorCode: 'errorCode' in result ? result.errorCode : undefined,
            errorPosition:
              'errorPosition' in result ? result.errorPosition : undefined,
            troubleshootingSteps:
              'troubleshootingSteps' in result
                ? result.troubleshootingSteps
                : undefined,
            documentationUrl:
              'documentationUrl' in result
                ? result.documentationUrl
                : undefined,
          };
        }

        executedCount++;

        if ('rows' in result && result.success) {
          resultSets.push({
            columns: result.columns,
            rows: result.rows,
          });
        } else if ('changes' in result && result.success) {
          totalChanges += result.changes;
          lastInsertRowid = result.lastInsertRowid;
        }
      }

      if (useAutoTransaction) {
        conn.db.exec('COMMIT');
      }

      if (resultSets.length > 0) {
        if (resultSets.length === 1) {
          return {
            success: true as const,
            columns: resultSets[0].columns,
            rows: resultSets[0].rows,
            executedStatements: executedCount,
            totalChanges,
          };
        }

        return {
          success: true as const,
          resultSets,
          executedStatements: executedCount,
          totalChanges,
        };
      }

      return {
        success: true as const,
        changes: totalChanges,
        lastInsertRowid,
        executedStatements: executedCount,
      };
    } catch (error) {
      if (useAutoTransaction) {
        try {
          conn.db.exec('ROLLBACK');
        } catch {
          // Ignore rollback errors
        }
      }
      return {
        success: false as const,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private executeSingleStatement(
    connectionId: string,
    query: string
  ):
    | {
        success: true;
        columns: string[];
        rows: Record<string, unknown>[];
      }
    | {
        success: true;
        changes: number;
        lastInsertRowid: number;
      }
    | {
        success: false;
        error: string;
        errorCode?: ErrorCode;
        errorPosition?: ErrorPosition;
        troubleshootingSteps?: string[];
        documentationUrl?: string;
      } {
    const trimmed = query.trim().toUpperCase();
    if (
      trimmed.startsWith('SELECT') ||
      trimmed.startsWith('PRAGMA') ||
      trimmed.startsWith('EXPLAIN') ||
      trimmed.startsWith('WITH')
    ) {
      const result = this.query(connectionId, query);
      if (result.success) {
        const rows = result.rows.map((row) => {
          const record: Record<string, unknown> = {};
          result.columns.forEach((col, i) => {
            record[col] = (row as unknown[])[i];
          });
          return record;
        });
        return {
          success: true as const,
          columns: result.columns,
          rows,
        };
      }
      return result;
    } else {
      return this.execute(connectionId, query);
    }
  }

  validateQuery(connectionId: string, sql: string): ValidationResult {
    const conn = this.connections.get(connectionId);
    if (!conn) {
      return { isValid: false, error: 'Connection not found' };
    }

    try {
      conn.db.prepare(sql);
      return { isValid: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return {
        isValid: false,
        error: errorMessage,
      };
    }
  }

  explainQuery(
    connectionId: string,
    sql: string
  ):
    | { success: true; plan: QueryPlanNode; stats: QueryPlanStats }
    | { success: false; error: string } {
    const conn = this.connections.get(connectionId);
    if (!conn) {
      return { success: false, error: 'Connection not found' };
    }

    try {
      const planRows = conn.db
        .prepare(`EXPLAIN QUERY PLAN ${sql}`)
        .all() as Array<{
        id: number;
        parent: number;
        notused: number;
        detail: string;
      }>;

      const planMap = new Map<number, QueryPlanNode>();
      const roots: QueryPlanNode[] = [];

      for (const row of planRows) {
        const node: QueryPlanNode = {
          id: row.id,
          parent: row.parent,
          notUsed: row.notused,
          detail: row.detail,
          children: [] as QueryPlanNode[],
        };

        planMap.set(row.id, node);

        if (row.parent === 0) {
          roots.push(node);
        } else {
          const parent = planMap.get(row.parent);
          if (parent && parent.children) {
            parent.children.push(node);
          }
        }
      }

      const stats: QueryPlanStats = {
        totalNodes: planRows.length,
        depth: calculateDepth(roots),
        hasScan: planRows.some((r) => r.detail.includes('SCAN')),
        hasSort: planRows.some((r) => r.detail.includes('SORT')),
        hasIndex: planRows.some((r) => r.detail.includes('INDEX')),
      };

      return {
        success: true,
        plan: roots[0] || {
          id: 0,
          parent: 0,
          notUsed: 0,
          detail: 'UNKNOWN',
          children: [],
        },
        stats,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to explain query',
      };
    }
  }

  validateChanges(connectionId: string, changes: PendingChangeInfo[]) {
    const conn = this.connections.get(connectionId);
    if (!conn) {
      return { success: false as const, error: 'Connection not found' };
    }

    const results: ValidationResult[] = [];
    for (const change of changes) {
      results.push({ changeId: change.id, isValid: true });
    }
    return { success: true as const, results };
  }

  applyChanges(connectionId: string, changes: PendingChangeInfo[]) {
    const conn = this.connections.get(connectionId);
    if (!conn) {
      return { success: false as const, error: 'Connection not found' };
    }

    try {
      let appliedCount = 0;
      const schemaPrefix = (s?: string) => (s ? `"${s}".` : '');

      for (const change of changes) {
        const prefix = schemaPrefix(change.schema);

        if (change.type === 'insert' && change.newValues) {
          const columns = Object.keys(change.newValues);
          const values = Object.values(change.newValues);
          const placeholders = columns.map(() => '?').join(', ');
          const sql = `INSERT INTO ${prefix}"${change.table}" ("${columns.join('", "')}") VALUES (${placeholders})`;
          conn.db.prepare(sql).run(...values);
          appliedCount++;
        } else if (
          change.type === 'update' &&
          change.newValues &&
          change.primaryKeyColumn
        ) {
          const columns = Object.keys(change.newValues);
          const setClause = columns.map((col) => `"${col}" = ?`).join(', ');
          const values = [...Object.values(change.newValues), change.rowId];
          const sql = `UPDATE ${prefix}"${change.table}" SET ${setClause} WHERE "${change.primaryKeyColumn}" = ?`;
          conn.db.prepare(sql).run(...values);
          appliedCount++;
        } else if (change.type === 'delete' && change.primaryKeyColumn) {
          const sql = `DELETE FROM ${prefix}"${change.table}" WHERE "${change.primaryKeyColumn}" = ?`;
          conn.db.prepare(sql).run(change.rowId);
          appliedCount++;
        }
      }

      return { success: true as const, appliedCount };
    } catch (error) {
      return {
        success: false as const,
        error:
          error instanceof Error ? error.message : 'Failed to apply changes',
      };
    }
  }

  closeAll() {
    for (const [id] of this.connections) {
      this.close(id);
    }
  }

  getTableStructure(
    connectionId: string,
    tableName: string,
    schema: string = 'main'
  ):
    | { success: true; structure: TableInfo }
    | { success: false; error: string } {
    const conn = this.connections.get(connectionId);
    if (!conn) {
      return { success: false, error: 'Connection not found' };
    }

    try {
      const tables = this.getTablesAndViews(conn.db, 'table', schema);
      const table = tables.find((t) => t.name === tableName);

      if (!table) {
        return { success: false, error: `Table "${tableName}" not found` };
      }

      return { success: true, structure: table };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get table structure',
      };
    }
  }

  getPendingChanges(
    connectionId: string
  ):
    | { success: true; changes: PendingChangeInfo[] }
    | { success: false; error: string } {
    const conn = this.connections.get(connectionId);
    if (!conn) {
      return { success: false, error: 'Connection not found' };
    }

    try {
      return { success: true, changes: [] };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get pending changes',
      };
    }
  }
}

// Export singleton instance
export const sqliteAdapter = new SQLiteAdapter();

import Database from 'better-sqlite3-multiple-ciphers';
import { readFileSync } from 'fs';
import type {
  ColumnInfo,
  TableInfo,
  IndexInfo,
  ForeignKeyInfo,
  PendingChangeInfo,
  ValidationResult,
} from '../../shared/types';

interface ConnectionInfo {
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
  return `conn_${idCounter}_${Math.random().toString(36).substring(2, 9)}`;
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
  hexKey?: boolean; // If true, wrap key as x'...'
  rawKey?: boolean; // If true, treat password as already being hex
  plaintextHeader?: number;
}

const CIPHER_CONFIGS: CipherConfig[] = [
  // SQLCipher 4 (default, most common)
  { cipher: 'sqlcipher', legacy: 0 },
  // SQLCipher 4 with hex key
  { cipher: 'sqlcipher', legacy: 0, hexKey: true },
  // SQLCipher 4 treating password as raw hex key
  { cipher: 'sqlcipher', legacy: 0, rawKey: true },
  // SQLCipher 3 (older databases)
  { cipher: 'sqlcipher', legacy: 1 },
  // SQLCipher 3 with hex key
  { cipher: 'sqlcipher', legacy: 1, hexKey: true },
  // SQLCipher 3 treating password as raw hex key
  { cipher: 'sqlcipher', legacy: 1, rawKey: true },
  // SQLCipher 2
  { cipher: 'sqlcipher', legacy: 2 },
  // SQLCipher 1
  { cipher: 'sqlcipher', legacy: 3 },
  // ChaCha20 (used by some apps like Signal)
  { cipher: 'chacha20' },
  { cipher: 'chacha20', hexKey: true },
  { cipher: 'chacha20', rawKey: true },
  // AES-256-CBC
  { cipher: 'aes256cbc' },
  { cipher: 'aes256cbc', hexKey: true },
  { cipher: 'aes256cbc', rawKey: true },
  // RC4 (legacy)
  { cipher: 'rc4' },
  { cipher: 'rc4', rawKey: true },
  // wxSQLite3 AES-128
  { cipher: 'aes128cbc' },
  { cipher: 'aes128cbc', rawKey: true },
  // SQLCipher with different KDF iterations (some apps use lower values)
  { cipher: 'sqlcipher', legacy: 0, kdfIter: 64000 },
  { cipher: 'sqlcipher', legacy: 0, kdfIter: 4000 },
  { cipher: 'sqlcipher', legacy: 0, kdfIter: 1 },
  // SQLCipher with plaintext header (some apps use this)
  { cipher: 'sqlcipher', legacy: 0, plaintextHeader: 32 },
  // Also try SQLCipher 4 with HMAC disabled (some implementations)
  { cipher: 'sqlcipher', legacy: 4 },
];

class DatabaseService {
  private connections: Map<string, ConnectionInfo> = new Map();

  async open(
    path: string,
    password?: string,
    readOnly = false
  ): Promise<
    | { success: true; connection: Omit<ConnectionInfo, 'db'> }
    | { success: false; error: string; needsPassword?: boolean }
  > {
    try {
      // Check if file appears encrypted before trying to open
      const fileIsEncrypted = isFileEncrypted(path);

      // If no password provided and file appears encrypted, ask for password
      if (!password && fileIsEncrypted) {
        return {
          success: false,
          error: 'Database appears to be encrypted. Please provide a password.',
          needsPassword: true,
        };
      }

      // If password provided, try different cipher configurations
      if (password) {
        for (const config of CIPHER_CONFIGS) {
          let db: Database.Database | null = null;
          try {
            db = new Database(path, { readonly: readOnly });

            // Set cipher configuration
            db.pragma(`cipher = '${config.cipher}'`);
            if (config.legacy !== undefined) {
              db.pragma(`legacy = ${config.legacy}`);
            }
            if (config.kdfIter !== undefined) {
              db.pragma(`kdf_iter = ${config.kdfIter}`);
            }
            if (config.pageSize !== undefined) {
              db.pragma(`cipher_page_size = ${config.pageSize}`);
            }
            if (config.plaintextHeader !== undefined) {
              db.pragma(
                `cipher_plaintext_header_size = ${config.plaintextHeader}`
              );
            }

            // Set the key (hex format if specified)
            if (config.rawKey) {
              // Treat password as already being a hex key
              db.pragma(`key = "x'${password}'"`);
            } else if (config.hexKey) {
              // Convert password to hex string
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

            const connectionInfo: ConnectionInfo = {
              id,
              db,
              path,
              filename,
              isEncrypted: true,
              isReadOnly: readOnly,
            };

            this.connections.set(id, connectionInfo);

            return {
              success: true,
              connection: {
                id,
                path,
                filename,
                isEncrypted: true,
                isReadOnly: readOnly,
              },
            };
          } catch {
            // This cipher config didn't work, close and try the next one
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
        return {
          success: false,
          error:
            'Invalid password or unsupported encryption format. Supported formats: SQLCipher 1-4, ChaCha20, AES-256-CBC, RC4.',
        };
      }

      // No password, try opening normally
      const db = new Database(path, { readonly: readOnly });

      // Test connection
      db.prepare('SELECT 1').get();

      const id = generateId();
      const filename = path.split('/').pop() || path;

      const connectionInfo: ConnectionInfo = {
        id,
        db,
        path,
        filename,
        isEncrypted: false,
        isReadOnly: readOnly,
      };

      this.connections.set(id, connectionInfo);

      return {
        success: true,
        connection: {
          id,
          path,
          filename,
          isEncrypted: false,
          isReadOnly: readOnly,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to open database';

      // Check if error suggests encryption
      if (
        errorMessage.includes('file is not a database') ||
        errorMessage.includes('encrypted')
      ) {
        return {
          success: false,
          error: 'Database appears to be encrypted. Please provide a password.',
          needsPassword: true,
        };
      }

      return {
        success: false,
        error: errorMessage,
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
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to close database',
      };
    }
  }

  getSchema(
    connectionId: string
  ):
    | { success: true; tables: TableInfo[]; views: TableInfo[] }
    | { success: false; error: string } {
    const conn = this.connections.get(connectionId);
    if (!conn) {
      return { success: false, error: 'Connection not found' };
    }

    try {
      const tables = this.getTablesAndViews(conn.db, 'table');
      const views = this.getTablesAndViews(conn.db, 'view');
      return { success: true, tables, views };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get schema',
      };
    }
  }

  private getTablesAndViews(
    db: Database.Database,
    type: 'table' | 'view'
  ): TableInfo[] {
    const sqliteType = type === 'table' ? 'table' : 'view';
    const items = db
      .prepare(
        `SELECT name, sql FROM sqlite_master WHERE type = ? AND name NOT LIKE 'sqlite_%' ORDER BY name`
      )
      .all(sqliteType) as Array<{ name: string; sql: string }>;

    return items.map((item) => {
      const columns = this.getColumns(db, item.name);
      const primaryKey = columns
        .filter((c) => c.isPrimaryKey)
        .map((c) => c.name);
      const foreignKeys = this.getForeignKeys(db, item.name);
      const indexes = type === 'table' ? this.getIndexes(db, item.name) : [];
      const rowCount =
        type === 'table' ? this.getRowCount(db, item.name) : undefined;

      return {
        name: item.name,
        type,
        columns,
        primaryKey,
        foreignKeys,
        indexes,
        rowCount,
        sql: item.sql || '',
      };
    });
  }

  private getColumns(db: Database.Database, tableName: string): ColumnInfo[] {
    const columns = db
      .prepare(`PRAGMA table_info("${tableName}")`)
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
    tableName: string
  ): ForeignKeyInfo[] {
    const fks = db
      .prepare(`PRAGMA foreign_key_list("${tableName}")`)
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

  private getIndexes(db: Database.Database, tableName: string): IndexInfo[] {
    const indexList = db
      .prepare(`PRAGMA index_list("${tableName}")`)
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
          .prepare(`PRAGMA index_info("${idx.name}")`)
          .all() as Array<{
          seqno: number;
          cid: number;
          name: string;
        }>;

        const sqlResult = db
          .prepare(
            `SELECT sql FROM sqlite_master WHERE type = 'index' AND name = ?`
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

  private getRowCount(db: Database.Database, tableName: string): number {
    const result = db
      .prepare(`SELECT COUNT(*) as count FROM "${tableName}"`)
      .get() as { count: number };
    return result.count;
  }

  getTableData(
    connectionId: string,
    table: string,
    page: number,
    pageSize: number,
    sortColumn?: string,
    sortDirection?: 'asc' | 'desc',
    filters?: Array<{ column: string; operator: string; value: string }>
  ):
    | {
        success: true;
        columns: ColumnInfo[];
        rows: Record<string, unknown>[];
        totalRows: number;
      }
    | { success: false; error: string } {
    const conn = this.connections.get(connectionId);
    if (!conn) {
      return { success: false, error: 'Connection not found' };
    }

    try {
      const columns = this.getColumns(conn.db, table);

      // Build WHERE clause from filters
      let whereClause = '';
      const params: unknown[] = [];

      if (filters && filters.length > 0) {
        const conditions = filters
          .map((f) => {
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
                return null;
            }
          })
          .filter(Boolean);

        if (conditions.length > 0) {
          whereClause = `WHERE ${conditions.join(' AND ')}`;
        }
      }

      // Get total count
      const countResult = conn.db
        .prepare(`SELECT COUNT(*) as count FROM "${table}" ${whereClause}`)
        .get(...params) as { count: number };
      const totalRows = countResult.count;

      // Build ORDER BY
      let orderBy = '';
      if (sortColumn) {
        orderBy = `ORDER BY "${sortColumn}" ${sortDirection === 'desc' ? 'DESC' : 'ASC'}`;
      }

      // Get paginated data
      const offset = (page - 1) * pageSize;
      const rows = conn.db
        .prepare(
          `SELECT * FROM "${table}" ${whereClause} ${orderBy} LIMIT ? OFFSET ?`
        )
        .all(...params, pageSize, offset) as Record<string, unknown>[];

      return { success: true, columns, rows, totalRows };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to get table data',
      };
    }
  }

  executeQuery(
    connectionId: string,
    query: string
  ):
    | {
        success: true;
        columns: string[];
        rows: Record<string, unknown>[];
        rowsAffected: number;
        lastInsertRowId?: number;
        executionTime: number;
      }
    | { success: false; error: string } {
    const conn = this.connections.get(connectionId);
    if (!conn) {
      return { success: false, error: 'Connection not found' };
    }

    try {
      const startTime = performance.now();
      const trimmedQuery = query.trim().toLowerCase();

      if (
        trimmedQuery.startsWith('select') ||
        trimmedQuery.startsWith('pragma') ||
        trimmedQuery.startsWith('explain')
      ) {
        const rows = conn.db.prepare(query).all() as Record<string, unknown>[];
        const executionTime = performance.now() - startTime;
        const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

        return {
          success: true,
          columns,
          rows,
          rowsAffected: rows.length,
          executionTime,
        };
      } else {
        const result = conn.db.prepare(query).run();
        const executionTime = performance.now() - startTime;

        return {
          success: true,
          columns: [],
          rows: [],
          rowsAffected: result.changes,
          lastInsertRowId: result.lastInsertRowid as number | undefined,
          executionTime,
        };
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to execute query',
      };
    }
  }

  validateChanges(
    connectionId: string,
    changes: PendingChangeInfo[]
  ):
    | { success: true; results: ValidationResult[] }
    | { success: false; error: string } {
    const conn = this.connections.get(connectionId);
    if (!conn) {
      return { success: false, error: 'Connection not found' };
    }

    const results: ValidationResult[] = changes.map((change) => {
      try {
        // Basic validation - check if table exists
        const tableExists = conn.db
          .prepare(
            `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
          )
          .get(change.table);

        if (!tableExists) {
          return {
            changeId: change.id,
            isValid: false,
            error: `Table "${change.table}" does not exist`,
          };
        }

        // Check if values match column types (basic check)
        if (change.type === 'insert' || change.type === 'update') {
          const columns = this.getColumns(conn.db, change.table);
          const values = change.newValues || {};

          for (const col of columns) {
            if (
              !col.nullable &&
              !col.isPrimaryKey &&
              values[col.name] === null
            ) {
              return {
                changeId: change.id,
                isValid: false,
                error: `Column "${col.name}" cannot be null`,
              };
            }
          }
        }

        return { changeId: change.id, isValid: true };
      } catch (error) {
        return {
          changeId: change.id,
          isValid: false,
          error: error instanceof Error ? error.message : 'Validation failed',
        };
      }
    });

    return { success: true, results };
  }

  applyChanges(
    connectionId: string,
    changes: PendingChangeInfo[]
  ):
    | { success: true; appliedCount: number }
    | { success: false; error: string } {
    const conn = this.connections.get(connectionId);
    if (!conn) {
      return { success: false, error: 'Connection not found' };
    }

    if (conn.isReadOnly) {
      return { success: false, error: 'Database is opened in read-only mode' };
    }

    const applyAll = conn.db.transaction(
      (changesToApply: PendingChangeInfo[]) => {
        let appliedCount = 0;
        for (const change of changesToApply) {
          this.applyChange(conn.db, change);
          appliedCount++;
        }
        return appliedCount;
      }
    );

    try {
      const appliedCount = applyAll(changes);
      return { success: true, appliedCount };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to apply changes',
      };
    }
  }

  private applyChange(db: Database.Database, change: PendingChangeInfo): void {
    switch (change.type) {
      case 'insert': {
        const values = change.newValues!;
        const columns = Object.keys(values);
        const placeholders = columns.map(() => '?').join(', ');
        const sql = `INSERT INTO "${change.table}" ("${columns.join('", "')}") VALUES (${placeholders})`;
        db.prepare(sql).run(...Object.values(values));
        break;
      }
      case 'update': {
        const values = change.newValues!;
        const setClause = Object.keys(values)
          .map((col) => `"${col}" = ?`)
          .join(', ');
        const sql = `UPDATE "${change.table}" SET ${setClause} WHERE rowid = ?`;
        db.prepare(sql).run(...Object.values(values), change.rowId);
        break;
      }
      case 'delete': {
        const sql = `DELETE FROM "${change.table}" WHERE rowid = ?`;
        db.prepare(sql).run(change.rowId);
        break;
      }
    }
  }

  closeAll(): void {
    for (const conn of this.connections.values()) {
      try {
        conn.db.close();
      } catch {
        // Ignore errors during cleanup
      }
    }
    this.connections.clear();
  }
}

export const databaseService = new DatabaseService();

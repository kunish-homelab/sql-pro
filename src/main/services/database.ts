import Database from 'better-sqlite3';
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

class DatabaseService {
  private connections: Map<string, ConnectionInfo> = new Map();

  async open(
    path: string,
    password?: string,
    readOnly = false
  ): Promise<
    | { success: true; connection: Omit<ConnectionInfo, 'db'> }
    | { success: false; error: string }
  > {
    try {
      const db = new Database(path, { readonly: readOnly });

      // If password provided, try to decrypt
      if (password) {
        try {
          db.pragma(`key = '${password}'`);
          // Test if we can read from the database
          db.prepare('SELECT count(*) FROM sqlite_master').get();
        } catch {
          db.close();
          return {
            success: false,
            error: 'Invalid password or database is not encrypted',
          };
        }
      }

      // Test connection
      db.prepare('SELECT 1').get();

      const id = generateId();
      const filename = path.split('/').pop() || path;

      const connectionInfo: ConnectionInfo = {
        id,
        db,
        path,
        filename,
        isEncrypted: !!password,
        isReadOnly: readOnly,
      };

      this.connections.set(id, connectionInfo);

      return {
        success: true,
        connection: {
          id,
          path,
          filename,
          isEncrypted: !!password,
          isReadOnly: readOnly,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to open database',
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

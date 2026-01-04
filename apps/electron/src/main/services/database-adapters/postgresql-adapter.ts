/**
 * PostgreSQL database adapter
 * Uses pg (node-postgres) for PostgreSQL connections
 * Also supports Supabase which uses PostgreSQL
 */

import type {
  ColumnInfo,
  DatabaseConnectionConfig,
  DatabaseType,
  ErrorCode,
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
import { sqlLogger } from '../sql-logger';

// PostgreSQL types - we'll use dynamic import to avoid issues if not installed
interface PGClient {
  query: (
    sql: string,
    params?: unknown[]
  ) => Promise<{
    rows: unknown[];
    rowCount: number | null;
    fields?: Array<{ name: string }>;
  }>;
  end: () => Promise<void>;
  connect: () => Promise<void>;
}

interface PostgreSQLConnectionInfo {
  id: string;
  client: PGClient;
  config: DatabaseConnectionConfig;
  filename: string;
  isReadOnly: boolean;
  databaseType: DatabaseType;
}

// Simple ID generator
let idCounter = 0;
function generateId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${idCounter}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * PostgreSQL database adapter implementation
 * Also handles Supabase connections since Supabase uses PostgreSQL
 */
export class PostgreSQLAdapter implements DatabaseAdapter {
  readonly type: DatabaseType = 'postgresql';
  private connections: Map<string, PostgreSQLConnectionInfo> = new Map();
  private pg: typeof import('pg') | null = null;

  constructor(adapterType: DatabaseType = 'postgresql') {
    this.type = adapterType;
  }

  private async getPG() {
    if (!this.pg) {
      try {
        this.pg = await import('pg');
      } catch {
        throw new Error(
          'PostgreSQL driver not installed. Please install pg package: npm install pg'
        );
      }
    }
    return this.pg;
  }

  async open(config: DatabaseConnectionConfig): Promise<OpenResult> {
    // For Supabase, extract connection info from URL
    let host = config.host;
    let port = config.port || 5432;
    let database = config.database;
    let username = config.username;
    let password = config.password;

    if (config.type === 'supabase' && config.supabaseUrl) {
      // Supabase connection: extract host from URL
      // Format: https://project-ref.supabase.co -> db.project-ref.supabase.co
      try {
        const url = new URL(config.supabaseUrl);
        host = `db.${url.hostname}`;
        port = 5432;
        database = 'postgres';
        // For Supabase, username is usually 'postgres'
        username = username || 'postgres';
        // Supabase uses the project's database password or service role key
        password = config.supabaseKey || password;
      } catch {
        return {
          success: false,
          error: 'Invalid Supabase URL format',
          errorCode: 'CONNECTION_ERROR',
        };
      }
    }

    if (!host) {
      return {
        success: false,
        error: 'PostgreSQL host is required',
        errorCode: 'CONNECTION_ERROR',
      };
    }

    try {
      const pg = await this.getPG();

      const connectionConfig: import('pg').ClientConfig = {
        host,
        port,
        user: username,
        password,
        database: database || 'postgres',
      };

      // SSL configuration
      if (config.ssl || config.type === 'supabase') {
        // Supabase always requires SSL
        if (typeof config.ssl === 'boolean' || config.type === 'supabase') {
          connectionConfig.ssl = { rejectUnauthorized: false };
        } else if (config.ssl) {
          connectionConfig.ssl = {
            rejectUnauthorized: config.ssl.rejectUnauthorized ?? false,
            ca: config.ssl.ca,
            cert: config.ssl.cert,
            key: config.ssl.key,
          };
        }
      }

      const client = new pg.Client(connectionConfig);
      await client.connect();

      const id = generateId(config.type === 'supabase' ? 'supabase' : 'pg');
      const filename =
        config.name || `${host}:${port}/${database || 'postgres'}`;

      const connectionInfo: PostgreSQLConnectionInfo = {
        id,
        client: client as unknown as PGClient,
        config,
        filename,
        isReadOnly: config.readOnly ?? false,
        databaseType: config.type || 'postgresql',
      };

      this.connections.set(id, connectionInfo);

      // Log successful open
      sqlLogger.logOpen({
        connectionId: id,
        dbPath: filename,
        success: true,
      });

      return {
        success: true,
        connection: {
          id,
          path: filename,
          filename,
          isEncrypted: !!(config.ssl || config.type === 'supabase'),
          isReadOnly: config.readOnly ?? false,
          databaseType: config.type || 'postgresql',
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to connect to PostgreSQL';

      sqlLogger.logOpen({
        connectionId: 'unknown',
        dbPath: `${host}:${port}`,
        success: false,
        error: errorMessage,
      });

      const troubleshootingSteps =
        config.type === 'supabase'
          ? [
              'Verify the Supabase project URL is correct',
              'Check that the database password is correct (found in Project Settings > Database)',
              'Ensure the Supabase project is running',
              'Check if you need to add your IP to the allowed list',
            ]
          : [
              'Verify the PostgreSQL server is running and accessible',
              'Check that the host and port are correct',
              'Verify the username and password are correct',
              'Ensure the database exists and the user has access',
              'Check pg_hba.conf if you have authentication issues',
            ];

      return {
        success: false,
        error: errorMessage,
        errorCode: 'CONNECTION_ERROR',
        troubleshootingSteps,
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
      void conn.client.end();
      this.connections.delete(connectionId);

      sqlLogger.logClose({
        connectionId,
        dbPath: conn.filename,
        success: true,
      });

      return { success: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to close connection';

      sqlLogger.logClose({
        connectionId,
        dbPath: conn.filename,
        success: false,
        error: errorMessage,
      });

      return { success: false, error: errorMessage };
    }
  }

  getConnection(connectionId: string): AdapterConnectionInfo | null {
    const conn = this.connections.get(connectionId);
    if (!conn) {
      return null;
    }

    return {
      id: conn.id,
      path: conn.filename,
      filename: conn.filename,
      isEncrypted: !!(conn.config.ssl || conn.config.type === 'supabase'),
      isReadOnly: conn.isReadOnly,
      databaseType: conn.databaseType,
    };
  }

  async getSchemaAsync(connectionId: string): Promise<
    | {
        success: true;
        schemas: SchemaInfo[];
        tables: TableInfo[];
        views: TableInfo[];
      }
    | { success: false; error: string }
  > {
    const conn = this.connections.get(connectionId);
    if (!conn) {
      return { success: false, error: 'Connection not found' };
    }

    try {
      // Get all schemas (excluding system schemas)
      const schemasResult = await conn.client.query(
        `SELECT schema_name 
         FROM information_schema.schemata 
         WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
         ORDER BY schema_name`
      );

      const schemas: SchemaInfo[] = [];
      const allTables: TableInfo[] = [];
      const allViews: TableInfo[] = [];

      for (const schemaRow of schemasResult.rows as Array<{
        schema_name: string;
      }>) {
        const schemaName = schemaRow.schema_name;

        // Get tables and views for this schema
        const tablesResult = await conn.client.query(
          `SELECT table_name, table_type 
           FROM information_schema.tables 
           WHERE table_schema = $1
           ORDER BY table_name`,
          [schemaName]
        );

        const tables: TableInfo[] = [];
        const views: TableInfo[] = [];

        for (const row of tablesResult.rows as Array<{
          table_name: string;
          table_type: string;
        }>) {
          const tableInfo = await this.getTableInfoAsync(
            conn,
            schemaName,
            row.table_name
          );
          if (row.table_type === 'VIEW') {
            views.push({ ...tableInfo, type: 'view' });
          } else {
            tables.push({ ...tableInfo, type: 'table' });
          }
        }

        schemas.push({
          name: schemaName,
          tables,
          views,
        });

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

  getSchema(_connectionId: string):
    | {
        success: true;
        schemas: SchemaInfo[];
        tables: TableInfo[];
        views: TableInfo[];
      }
    | { success: false; error: string } {
    return {
      success: false,
      error: 'Use getSchemaAsync for PostgreSQL connections',
    };
  }

  private async getTableInfoAsync(
    conn: PostgreSQLConnectionInfo,
    schema: string,
    tableName: string
  ): Promise<TableInfo> {
    // Get columns
    const columnsResult = await conn.client.query(
      `SELECT column_name, data_type, is_nullable, column_default,
              (SELECT COUNT(*) > 0 FROM information_schema.key_column_usage kcu
               JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
               WHERE kcu.table_schema = c.table_schema 
                 AND kcu.table_name = c.table_name 
                 AND kcu.column_name = c.column_name
                 AND tc.constraint_type = 'PRIMARY KEY') as is_primary_key
       FROM information_schema.columns c
       WHERE table_schema = $1 AND table_name = $2
       ORDER BY ordinal_position`,
      [schema, tableName]
    );

    const columns: ColumnInfo[] = (
      columnsResult.rows as Array<{
        column_name: string;
        data_type: string;
        is_nullable: string;
        column_default: string | null;
        is_primary_key: boolean;
      }>
    ).map((col) => ({
      name: col.column_name,
      type: col.data_type,
      nullable: col.is_nullable === 'YES',
      defaultValue: col.column_default,
      isPrimaryKey: col.is_primary_key,
    }));

    const primaryKey = columns.filter((c) => c.isPrimaryKey).map((c) => c.name);

    // Get foreign keys
    const fkResult = await conn.client.query(
      `SELECT
         kcu.column_name,
         ccu.table_name AS referenced_table_name,
         ccu.column_name AS referenced_column_name,
         rc.delete_rule,
         rc.update_rule
       FROM information_schema.key_column_usage kcu
       JOIN information_schema.table_constraints tc 
         ON kcu.constraint_name = tc.constraint_name
         AND kcu.constraint_schema = tc.constraint_schema
       JOIN information_schema.constraint_column_usage ccu
         ON tc.constraint_name = ccu.constraint_name
         AND tc.constraint_schema = ccu.constraint_schema
       JOIN information_schema.referential_constraints rc
         ON tc.constraint_name = rc.constraint_name
         AND tc.constraint_schema = rc.constraint_schema
       WHERE tc.constraint_type = 'FOREIGN KEY'
         AND kcu.table_schema = $1
         AND kcu.table_name = $2`,
      [schema, tableName]
    );

    const foreignKeys: ForeignKeyInfo[] = (
      fkResult.rows as Array<{
        column_name: string;
        referenced_table_name: string;
        referenced_column_name: string;
        delete_rule: string;
        update_rule: string;
      }>
    ).map((fk) => ({
      column: fk.column_name,
      referencedTable: fk.referenced_table_name,
      referencedColumn: fk.referenced_column_name,
      onDelete: fk.delete_rule,
      onUpdate: fk.update_rule,
    }));

    // Get indexes
    const indexResult = await conn.client.query(
      `SELECT
         i.relname AS index_name,
         a.attname AS column_name,
         ix.indisunique AS is_unique,
         pg_get_indexdef(ix.indexrelid) AS index_def
       FROM pg_index ix
       JOIN pg_class i ON ix.indexrelid = i.oid
       JOIN pg_class t ON ix.indrelid = t.oid
       JOIN pg_namespace n ON t.relnamespace = n.oid
       JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
       WHERE n.nspname = $1 AND t.relname = $2
       ORDER BY i.relname, a.attnum`,
      [schema, tableName]
    );

    const indexMap = new Map<
      string,
      { columns: string[]; isUnique: boolean; sql: string }
    >();
    for (const idx of indexResult.rows as Array<{
      index_name: string;
      column_name: string;
      is_unique: boolean;
      index_def: string;
    }>) {
      if (!indexMap.has(idx.index_name)) {
        indexMap.set(idx.index_name, {
          columns: [],
          isUnique: idx.is_unique,
          sql: idx.index_def,
        });
      }
      indexMap.get(idx.index_name)!.columns.push(idx.column_name);
    }

    const indexes: IndexInfo[] = Array.from(indexMap.entries()).map(
      ([name, info]) => ({
        name,
        columns: info.columns,
        isUnique: info.isUnique,
        sql: info.sql,
      })
    );

    // Get triggers
    const triggerResult = await conn.client.query(
      `SELECT
         t.tgname AS trigger_name,
         CASE
           WHEN t.tgtype & 2 = 2 THEN 'BEFORE'
           WHEN t.tgtype & 64 = 64 THEN 'INSTEAD OF'
           ELSE 'AFTER'
         END AS timing,
         CASE
           WHEN t.tgtype & 4 = 4 THEN 'INSERT'
           WHEN t.tgtype & 8 = 8 THEN 'DELETE'
           WHEN t.tgtype & 16 = 16 THEN 'UPDATE'
           ELSE 'INSERT'
         END AS event,
         pg_get_triggerdef(t.oid) AS trigger_def
       FROM pg_trigger t
       JOIN pg_class c ON t.tgrelid = c.oid
       JOIN pg_namespace n ON c.relnamespace = n.oid
       WHERE n.nspname = $1 AND c.relname = $2
         AND NOT t.tgisinternal`,
      [schema, tableName]
    );

    const triggers: TriggerInfo[] = (
      triggerResult.rows as Array<{
        trigger_name: string;
        timing: string;
        event: string;
        trigger_def: string;
      }>
    ).map((t) => ({
      name: t.trigger_name,
      tableName,
      timing: t.timing as 'BEFORE' | 'AFTER' | 'INSTEAD OF',
      event: t.event as 'INSERT' | 'UPDATE' | 'DELETE',
      sql: t.trigger_def,
    }));

    // Get row count
    const countResult = await conn.client.query(
      `SELECT COUNT(*) as count FROM "${schema}"."${tableName}"`
    );
    const rowCount = Number((countResult.rows[0] as { count: string }).count);

    return {
      name: tableName,
      schema,
      type: 'table',
      columns,
      primaryKey,
      foreignKeys,
      indexes,
      triggers,
      rowCount,
      sql: '', // Would need to reconstruct CREATE TABLE
    };
  }

  execute(
    _connectionId: string,
    _sql: string,
    _params?: unknown[]
  ):
    | { success: true; changes: number; lastInsertRowid: number }
    | { success: false; error: string; errorCode?: ErrorCode } {
    return {
      success: false,
      error: 'Use executeAsync for PostgreSQL connections',
    };
  }

  async executeAsync(
    connectionId: string,
    sql: string,
    params?: unknown[]
  ): Promise<
    | { success: true; changes: number; lastInsertRowid: number }
    | { success: false; error: string; errorCode?: ErrorCode }
  > {
    const conn = this.connections.get(connectionId);
    if (!conn) {
      return { success: false, error: 'Connection not found' };
    }

    const startTime = performance.now();
    try {
      const result = await conn.client.query(sql, params);
      const durationMs = performance.now() - startTime;

      sqlLogger.logExecute({
        connectionId,
        dbPath: conn.filename,
        sql,
        durationMs,
        success: true,
        rowCount: result.rowCount ?? 0,
      });

      return {
        success: true,
        changes: result.rowCount ?? 0,
        lastInsertRowid: 0, // PostgreSQL uses RETURNING instead
      };
    } catch (error) {
      const durationMs = performance.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      sqlLogger.logExecute({
        connectionId,
        dbPath: conn.filename,
        sql,
        durationMs,
        success: false,
        error: errorMessage,
      });

      return { success: false, error: errorMessage };
    }
  }

  query(
    _connectionId: string,
    _sql: string,
    _params?: unknown[]
  ):
    | { success: true; columns: string[]; rows: unknown[][] }
    | { success: false; error: string } {
    return {
      success: false,
      error: 'Use queryAsync for PostgreSQL connections',
    };
  }

  async queryAsync(
    connectionId: string,
    sql: string,
    params?: unknown[]
  ): Promise<
    | { success: true; columns: string[]; rows: unknown[][] }
    | { success: false; error: string }
  > {
    const conn = this.connections.get(connectionId);
    if (!conn) {
      return { success: false, error: 'Connection not found' };
    }

    const startTime = performance.now();
    try {
      const result = await conn.client.query(sql, params);
      const durationMs = performance.now() - startTime;

      const rows = result.rows as Array<Record<string, unknown>>;
      if (!rows || rows.length === 0) {
        sqlLogger.logQuery({
          connectionId,
          dbPath: conn.filename,
          sql,
          durationMs,
          success: true,
          rowCount: 0,
        });
        return { success: true, columns: [], rows: [] };
      }

      const columns = result.fields?.map((f) => f.name) || Object.keys(rows[0]);
      const rowsArray = rows.map((row) => columns.map((col) => row[col]));

      sqlLogger.logQuery({
        connectionId,
        dbPath: conn.filename,
        sql,
        durationMs,
        success: true,
        rowCount: rows.length,
      });

      return { success: true, columns, rows: rowsArray };
    } catch (error) {
      const durationMs = performance.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      sqlLogger.logQuery({
        connectionId,
        dbPath: conn.filename,
        sql,
        durationMs,
        success: false,
        error: errorMessage,
      });

      return { success: false, error: errorMessage };
    }
  }

  getTableData(
    _connectionId: string,
    _table: string,
    _page: number,
    _pageSize: number,
    _sortColumn?: string,
    _sortDirection?: 'asc' | 'desc',
    _filters?: Array<{ column: string; operator: string; value: string }>,
    _schema?: string
  ): GetTableDataResponse {
    return {
      success: false,
      error: 'Use getTableDataAsync for PostgreSQL connections',
    };
  }

  async getTableDataAsync(
    connectionId: string,
    table: string,
    page: number,
    pageSize: number,
    sortColumn?: string,
    sortDirection?: 'asc' | 'desc',
    filters?: Array<{ column: string; operator: string; value: string }>,
    schema?: string
  ): Promise<GetTableDataResponse> {
    const conn = this.connections.get(connectionId);
    if (!conn) {
      return { success: false, error: 'Connection not found' };
    }

    const schemaName = schema || 'public';
    let sql = `SELECT * FROM "${schemaName}"."${table}"`;
    const params: unknown[] = [];
    let paramIndex = 1;

    try {
      if (filters && filters.length > 0) {
        const conditions = filters.map((f) => {
          switch (f.operator) {
            case 'eq':
              params.push(f.value);
              return `"${f.column}" = $${paramIndex++}`;
            case 'neq':
              params.push(f.value);
              return `"${f.column}" != $${paramIndex++}`;
            case 'gt':
              params.push(f.value);
              return `"${f.column}" > $${paramIndex++}`;
            case 'lt':
              params.push(f.value);
              return `"${f.column}" < $${paramIndex++}`;
            case 'gte':
              params.push(f.value);
              return `"${f.column}" >= $${paramIndex++}`;
            case 'lte':
              params.push(f.value);
              return `"${f.column}" <= $${paramIndex++}`;
            case 'like':
              params.push(`%${f.value}%`);
              return `"${f.column}" ILIKE $${paramIndex++}`;
            case 'isnull':
              return `"${f.column}" IS NULL`;
            case 'notnull':
              return `"${f.column}" IS NOT NULL`;
            default:
              params.push(f.value);
              return `"${f.column}" = $${paramIndex++}`;
          }
        });
        sql += ` WHERE ${conditions.join(' AND ')}`;
      }

      if (sortColumn) {
        sql += ` ORDER BY "${sortColumn}" ${sortDirection === 'desc' ? 'DESC' : 'ASC'}`;
      }

      // Get count
      const countSql = sql.replace(/SELECT \*/, 'SELECT COUNT(*)');
      const countResult = await conn.client.query(countSql, params);
      const totalRows = Number(
        (countResult.rows[0] as { count: string }).count
      );

      // Get data with pagination
      const offset = (page - 1) * pageSize;
      params.push(pageSize, offset);
      sql += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;

      const result = await conn.client.query(sql, params);

      // Get column info
      const tableInfo = await this.getTableInfoAsync(conn, schemaName, table);

      return {
        success: true,
        columns: tableInfo.columns,
        rows: result.rows as Record<string, unknown>[],
        totalRows,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to get table data',
      };
    }
  }

  executeQuery(_connectionId: string, _query: string) {
    return {
      success: false as const,
      error: 'Use executeQueryAsync for PostgreSQL connections',
    };
  }

  async executeQueryAsync(
    connectionId: string,
    query: string
  ): Promise<
    | {
        success: true;
        columns?: string[];
        rows?: Record<string, unknown>[];
        changes?: number;
        lastInsertRowid?: number;
      }
    | { success: false; error: string }
  > {
    const conn = this.connections.get(connectionId);
    if (!conn) {
      return { success: false, error: 'Connection not found' };
    }

    const trimmed = query.trim().toUpperCase();
    const isSelect = trimmed.startsWith('SELECT') || trimmed.startsWith('WITH');

    try {
      const result = await conn.client.query(query);

      if (isSelect) {
        const rows = result.rows as Array<Record<string, unknown>>;
        if (!rows || rows.length === 0) {
          return { success: true, columns: [], rows: [] };
        }
        return {
          success: true,
          columns: result.fields?.map((f) => f.name) || Object.keys(rows[0]),
          rows,
        };
      } else {
        return {
          success: true,
          changes: result.rowCount ?? 0,
          lastInsertRowid: 0,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  validateQuery(_connectionId: string, _sql: string): ValidationResult {
    return { isValid: true };
  }

  explainQuery(
    _connectionId: string,
    _sql: string
  ):
    | { success: true; plan: QueryPlanNode; stats: QueryPlanStats }
    | { success: false; error: string } {
    return {
      success: false,
      error: 'Use explainQueryAsync for PostgreSQL connections',
    };
  }

  async explainQueryAsync(
    connectionId: string,
    sql: string
  ): Promise<
    | { success: true; plan: QueryPlanNode; stats: QueryPlanStats }
    | { success: false; error: string }
  > {
    const conn = this.connections.get(connectionId);
    if (!conn) {
      return { success: false, error: 'Connection not found' };
    }

    try {
      const result = await conn.client.query(`EXPLAIN (FORMAT JSON) ${sql}`);
      const planJson = (result.rows[0] as { 'QUERY PLAN': unknown })[
        'QUERY PLAN'
      ];

      const plan: QueryPlanNode = {
        id: 1,
        parent: 0,
        notUsed: 0,
        detail: JSON.stringify(planJson),
        children: [],
      };

      const stats: QueryPlanStats = {
        totalNodes: 1,
        depth: 1,
        hasScan: JSON.stringify(planJson).includes('Seq Scan'),
        hasSort: JSON.stringify(planJson).includes('Sort'),
        hasIndex: JSON.stringify(planJson).includes('Index'),
      };

      return { success: true, plan, stats };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to explain query',
      };
    }
  }

  validateChanges(_connectionId: string, changes: PendingChangeInfo[]) {
    const results: ValidationResult[] = changes.map((c) => ({
      changeId: c.id,
      isValid: true,
    }));
    return { success: true as const, results };
  }

  applyChanges(_connectionId: string, _changes: PendingChangeInfo[]) {
    return {
      success: false as const,
      error: 'Use applyChangesAsync for PostgreSQL connections',
    };
  }

  async applyChangesAsync(
    connectionId: string,
    changes: PendingChangeInfo[]
  ): Promise<
    { success: true; appliedCount: number } | { success: false; error: string }
  > {
    const conn = this.connections.get(connectionId);
    if (!conn) {
      return { success: false, error: 'Connection not found' };
    }

    try {
      let appliedCount = 0;

      for (const change of changes) {
        const schema = change.schema || 'public';

        if (change.type === 'insert' && change.newValues) {
          const columns = Object.keys(change.newValues);
          const values = Object.values(change.newValues);
          const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
          const sql = `INSERT INTO "${schema}"."${change.table}" ("${columns.join('", "')}") VALUES (${placeholders})`;
          await conn.client.query(sql, values);
          appliedCount++;
        } else if (
          change.type === 'update' &&
          change.newValues &&
          change.primaryKeyColumn
        ) {
          const columns = Object.keys(change.newValues);
          const values = Object.values(change.newValues);
          const setClause = columns
            .map((col, i) => `"${col}" = $${i + 1}`)
            .join(', ');
          values.push(change.rowId);
          const sql = `UPDATE "${schema}"."${change.table}" SET ${setClause} WHERE "${change.primaryKeyColumn}" = $${values.length}`;
          await conn.client.query(sql, values);
          appliedCount++;
        } else if (change.type === 'delete' && change.primaryKeyColumn) {
          const sql = `DELETE FROM "${schema}"."${change.table}" WHERE "${change.primaryKeyColumn}" = $1`;
          await conn.client.query(sql, [change.rowId]);
          appliedCount++;
        }
      }

      return { success: true, appliedCount };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to apply changes',
      };
    }
  }

  closeAll(): void {
    for (const [id] of this.connections) {
      this.close(id);
    }
  }

  getTableStructure(
    _connectionId: string,
    _tableName: string,
    _schema?: string
  ):
    | { success: true; structure: TableInfo }
    | { success: false; error: string } {
    return {
      success: false,
      error: 'Use getTableStructureAsync for PostgreSQL connections',
    };
  }

  async getTableStructureAsync(
    connectionId: string,
    tableName: string,
    schema?: string
  ): Promise<
    { success: true; structure: TableInfo } | { success: false; error: string }
  > {
    const conn = this.connections.get(connectionId);
    if (!conn) {
      return { success: false, error: 'Connection not found' };
    }

    const schemaName = schema || 'public';

    try {
      const structure = await this.getTableInfoAsync(
        conn,
        schemaName,
        tableName
      );
      return { success: true, structure };
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

  getPendingChanges(_connectionId: string) {
    return { success: true as const, changes: [] as PendingChangeInfo[] };
  }
}

// Export singleton instances
export const postgresqlAdapter = new PostgreSQLAdapter('postgresql');
export const supabaseAdapter = new PostgreSQLAdapter('supabase');

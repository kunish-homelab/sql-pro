/**
 * Database adapters index
 * Exports all available database adapters
 */

export { databaseManager } from './database-manager';
export { MySQLAdapter, mysqlAdapter } from './mysql-adapter';
export {
  PostgreSQLAdapter,
  postgresqlAdapter,
  supabaseAdapter,
} from './postgresql-adapter';
export { SQLiteAdapter, sqliteAdapter } from './sqlite-adapter';
export * from './types';

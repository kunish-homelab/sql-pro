import type { PendingChange } from './collections';

/**
 * Escape a SQL identifier (table name, column name) with double quotes.
 */
function escapeIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

/**
 * Format a value for SQL, properly escaping strings and handling nulls.
 */
function formatSqlValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }
  if (typeof value === 'string') {
    // Escape single quotes by doubling them
    return `'${value.replace(/'/g, "''")}'`;
  }
  if (value instanceof Date) {
    return `'${value.toISOString()}'`;
  }
  // For other types (arrays, objects), convert to JSON string
  return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
}

/**
 * Try to infer the primary key column from a change.
 * Falls back to common primary key column names if primaryKeyColumn is not set.
 */
function inferPrimaryKeyColumn(change: PendingChange): string | null {
  // If primaryKeyColumn is explicitly set, use it
  if (change.primaryKeyColumn) {
    return change.primaryKeyColumn;
  }

  // Try to infer from oldValues or newValues
  const values = change.oldValues || change.newValues || {};
  const keys = Object.keys(values).filter((k) => !k.startsWith('__'));

  // Common primary key column names to check
  const commonPkNames = ['id', 'ID', 'Id', '_id', 'rowid', 'ROWID'];
  for (const pkName of commonPkNames) {
    if (keys.includes(pkName)) {
      return pkName;
    }
  }

  // If rowId matches a column value, use that column as the primary key
  for (const key of keys) {
    if (values[key] === change.rowId) {
      return key;
    }
  }

  return null;
}

/**
 * Generate an INSERT SQL statement from a pending change.
 */
function generateInsertSQL(change: PendingChange): string {
  if (!change.newValues) {
    return '-- INSERT: No new values provided';
  }

  const schema = change.schema || 'main';
  const schemaPrefix = schema !== 'main' ? `${escapeIdentifier(schema)}.` : '';
  const tableName = escapeIdentifier(change.table);

  // Filter out internal fields starting with __
  const columns = Object.keys(change.newValues).filter(
    (key) => !key.startsWith('__')
  );
  const values = columns.map((col) => formatSqlValue(change.newValues![col]));

  const columnList = columns.map(escapeIdentifier).join(', ');
  const valueList = values.join(', ');

  return `INSERT INTO ${schemaPrefix}${tableName} (${columnList}) VALUES (${valueList});`;
}

/**
 * Generate an UPDATE SQL statement from a pending change.
 */
function generateUpdateSQL(change: PendingChange): string {
  if (!change.newValues) {
    return '-- UPDATE: No new values provided';
  }

  const pkColumn = inferPrimaryKeyColumn(change);
  if (!pkColumn) {
    // Fallback: generate UPDATE without WHERE clause (commented out for safety)
    const schema = change.schema || 'main';
    const schemaPrefix =
      schema !== 'main' ? `${escapeIdentifier(schema)}.` : '';
    const tableName = escapeIdentifier(change.table);

    const columns = Object.keys(change.newValues).filter(
      (key) => !key.startsWith('__')
    );
    const setClause = columns
      .map(
        (col) =>
          `${escapeIdentifier(col)} = ${formatSqlValue(change.newValues![col])}`
      )
      .join(', ');

    return `-- UPDATE ${schemaPrefix}${tableName} SET ${setClause} WHERE rowid = ${formatSqlValue(change.rowId)};`;
  }

  const schema = change.schema || 'main';
  const schemaPrefix = schema !== 'main' ? `${escapeIdentifier(schema)}.` : '';
  const tableName = escapeIdentifier(change.table);

  // Filter out internal fields and build SET clause
  const columns = Object.keys(change.newValues).filter(
    (key) => !key.startsWith('__')
  );
  const setClause = columns
    .map(
      (col) =>
        `${escapeIdentifier(col)} = ${formatSqlValue(change.newValues![col])}`
    )
    .join(', ');

  const pkColumnEscaped = escapeIdentifier(pkColumn);
  const pkValue = formatSqlValue(change.rowId);

  return `UPDATE ${schemaPrefix}${tableName} SET ${setClause} WHERE ${pkColumnEscaped} = ${pkValue};`;
}

/**
 * Generate a DELETE SQL statement from a pending change.
 */
function generateDeleteSQL(change: PendingChange): string {
  const pkColumn = inferPrimaryKeyColumn(change);

  const schema = change.schema || 'main';
  const schemaPrefix = schema !== 'main' ? `${escapeIdentifier(schema)}.` : '';
  const tableName = escapeIdentifier(change.table);

  if (!pkColumn) {
    // Fallback: use rowid
    return `DELETE FROM ${schemaPrefix}${tableName} WHERE rowid = ${formatSqlValue(change.rowId)};`;
  }

  const pkColumnEscaped = escapeIdentifier(pkColumn);
  const pkValue = formatSqlValue(change.rowId);

  return `DELETE FROM ${schemaPrefix}${tableName} WHERE ${pkColumnEscaped} = ${pkValue};`;
}

/**
 * Generate SQL for a single pending change.
 */
export function generateSQLForChange(change: PendingChange): string {
  switch (change.type) {
    case 'insert':
      return generateInsertSQL(change);
    case 'update':
      return generateUpdateSQL(change);
    case 'delete':
      return generateDeleteSQL(change);
    default:
      return `-- Unknown change type: ${(change as PendingChange).type}`;
  }
}

/**
 * Generate SQL for all pending changes.
 * Returns an array of SQL statements, one per change.
 */
export function generateSQLForChanges(changes: PendingChange[]): string[] {
  return changes.map(generateSQLForChange);
}

/**
 * Generate a combined SQL script for all pending changes.
 * Groups by table and adds comments for clarity.
 */
export function generateSQLScript(changes: PendingChange[]): string {
  if (changes.length === 0) {
    return '-- No pending changes';
  }

  // Group changes by table
  const groupedByTable = new Map<string, PendingChange[]>();
  for (const change of changes) {
    const key = `${change.schema || 'main'}.${change.table}`;
    if (!groupedByTable.has(key)) {
      groupedByTable.set(key, []);
    }
    groupedByTable.get(key)!.push(change);
  }

  const lines: string[] = [
    '-- Pending Changes SQL Preview',
    `-- Generated at: ${new Date().toISOString()}`,
    `-- Total changes: ${changes.length}`,
    '',
    'BEGIN TRANSACTION;',
    '',
  ];

  for (const [tableKey, tableChanges] of groupedByTable) {
    lines.push(`-- Table: ${tableKey}`);

    for (const change of tableChanges) {
      lines.push(generateSQLForChange(change));
    }

    lines.push('');
  }

  lines.push('COMMIT;');

  return lines.join('\n');
}

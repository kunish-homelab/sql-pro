import type * as Monaco from 'monaco-editor';
import type { DatabaseSchema, TableSchema } from '@/types/database';

/**
 * Represents a table reference extracted from SQL query.
 * Maps alias (or table name if no alias) to the actual table name.
 */
export interface TableReferenceResult {
  tableName: string;
  alias: string | null;
  schema?: string;
}

/**
 * SQL context types for context-aware completions.
 * Determines what kind of suggestions are most appropriate.
 */
type SqlContext =
  | 'SELECT_COLUMNS' // After SELECT, before FROM
  | 'FROM_TABLE' // After FROM, expect table names
  | 'JOIN_TABLE' // After JOIN keyword
  | 'JOIN_CONDITION' // After ON in JOIN
  | 'WHERE_CONDITION' // In WHERE clause
  | 'ORDER_BY' // After ORDER BY
  | 'GROUP_BY' // After GROUP BY
  | 'HAVING' // In HAVING clause
  | 'INSERT_TABLE' // After INSERT INTO
  | 'INSERT_COLUMNS' // Inside INSERT (columns)
  | 'INSERT_VALUES' // After VALUES
  | 'UPDATE_TABLE' // After UPDATE
  | 'UPDATE_SET' // In SET clause
  | 'DELETE_TABLE' // After DELETE FROM
  | 'CREATE_TABLE' // In CREATE TABLE
  | 'FUNCTION_ARGS' // Inside function parentheses
  | 'SUBQUERY' // Inside a subquery
  | 'GENERAL'; // Default/unknown context

/**
 * Result of analyzing the SQL context at cursor position.
 */
interface SqlContextResult {
  context: SqlContext;
  /** Tables referenced in the current query */
  tableRefs: TableReference[];
  /** If cursor is after a dot, the prefix before the dot */
  dotPrefix: string | null;
  /** The word being typed (for filtering) */
  currentWord: string;
  /** Depth of parentheses at cursor position */
  parenDepth: number;
  /** Whether we're inside a string literal */
  inString: boolean;
  /** Whether we're inside a comment */
  inComment: boolean;
  /** Previous meaningful token before cursor */
  previousToken: string | null;
  /** The current clause we're in (SELECT, FROM, WHERE, etc.) */
  currentClause: string | null;
}

/**
 * SQL function definition for autocomplete with documentation.
 */
interface SqlFunction {
  name: string;
  signature: string;
  description: string;
  category:
    | 'aggregate'
    | 'string'
    | 'numeric'
    | 'datetime'
    | 'conditional'
    | 'sqlite';
}

/**
 * SQL snippet definition for common patterns.
 */
interface SqlSnippet {
  label: string;
  insertText: string;
  description: string;
  category: string;
}

/**
 * Parses SQL text to extract table references from FROM and JOIN clauses.
 * Handles patterns like:
 * - FROM users
 * - FROM users u
 * - FROM users AS u
 * - JOIN orders o ON ...
 */
export function parseTableReferences(sql: string): TableReferenceResult[] {
  const references: TableReferenceResult[] = [];
  const normalizedSql = sql.replace(/\s+/g, ' ').trim();

  // Match FROM table [AS] [alias] and JOIN table [AS] [alias]
  const tablePattern = /(?:FROM|JOIN)\s+(\w+)(?:\s+(?:AS\s+)?(\w+))?/gi;

  let match = tablePattern.exec(normalizedSql);
  while (match !== null) {
    const tableName = match[1];
    const alias = match[2] || null;

    // Skip if the "alias" is actually a SQL keyword
    const keywords = [
      'ON',
      'WHERE',
      'AND',
      'OR',
      'LEFT',
      'RIGHT',
      'INNER',
      'OUTER',
      'CROSS',
      'JOIN',
      'ORDER',
      'GROUP',
      'HAVING',
      'LIMIT',
      'UNION',
      'SET',
      'VALUES',
    ];
    if (alias && keywords.includes(alias.toUpperCase())) {
      references.push({ tableName, alias: null });
    } else {
      references.push({ tableName, alias });
    }
    match = tablePattern.exec(normalizedSql);
  }

  return references;
}

/**
 * Resolves a prefix (table name or alias) to the actual table info.
 */
function resolveTableFromPrefix(
  prefix: string,
  tableRefs: TableReference[],
  schema: DatabaseSchema
): TableSchema | null {
  const lowerPrefix = prefix.toLowerCase();

  // First check if it matches an alias
  for (const ref of tableRefs) {
    if (ref.alias?.toLowerCase() === lowerPrefix) {
      return (
        schema.tables.find(
          (t) => t.name.toLowerCase() === ref.tableName.toLowerCase()
        ) || null
      );
    }
  }

  // Then check if it matches a table name directly
  return (
    schema.tables.find((t) => t.name.toLowerCase() === lowerPrefix) || null
  );
}

/**
 * Gets tables that are in scope (referenced in the current query).
 */
function getTablesInScope(
  tableRefs: TableReference[],
  schema: DatabaseSchema
): TableSchema[] {
  const inScope: TableSchema[] = [];

  for (const ref of tableRefs) {
    const table = schema.tables.find(
      (t) => t.name.toLowerCase() === ref.tableName.toLowerCase()
    );
    if (table && !inScope.includes(table)) {
      inScope.push(table);
    }
  }

  return inScope;
}

/**
 * Keywords that trigger a new line before them during formatting.
 */
const NEWLINE_BEFORE_KEYWORDS = new Set([
  'SELECT',
  'FROM',
  'WHERE',
  'ORDER BY',
  'GROUP BY',
  'HAVING',
  'LIMIT',
  'OFFSET',
  'UNION',
  'UNION ALL',
  'EXCEPT',
  'INTERSECT',
  'INSERT INTO',
  'UPDATE',
  'DELETE FROM',
  'CREATE TABLE',
  'DROP TABLE',
  'ALTER TABLE',
  'SET',
  'VALUES',
]);

/**
 * Keywords that trigger indentation (JOIN clauses).
 */
const INDENT_KEYWORDS = new Set([
  'JOIN',
  'LEFT JOIN',
  'RIGHT JOIN',
  'INNER JOIN',
  'OUTER JOIN',
  'CROSS JOIN',
  'LEFT OUTER JOIN',
  'RIGHT OUTER JOIN',
  'FULL OUTER JOIN',
]);

/**
 * Token types for SQL tokenization.
 */
type SqlTokenType =
  | 'keyword'
  | 'identifier'
  | 'string'
  | 'number'
  | 'operator'
  | 'comment'
  | 'whitespace'
  | 'punctuation';

interface SqlToken {
  type: SqlTokenType;
  value: string;
  original: string; // Original value before transformation
}

// SQL Keywords for autocomplete (US1)
// Defined early since tokenizeSql uses SQL_KEYWORDS_SET
const SQL_KEYWORDS = [
  'SELECT',
  'FROM',
  'WHERE',
  'AND',
  'OR',
  'NOT',
  'IN',
  'LIKE',
  'ORDER BY',
  'GROUP BY',
  'HAVING',
  'LIMIT',
  'OFFSET',
  'INSERT INTO',
  'VALUES',
  'UPDATE',
  'SET',
  'DELETE FROM',
  'CREATE TABLE',
  'DROP TABLE',
  'ALTER TABLE',
  'JOIN',
  'LEFT JOIN',
  'RIGHT JOIN',
  'INNER JOIN',
  'OUTER JOIN',
  'CROSS JOIN',
  'ON',
  'AS',
  'DISTINCT',
  'COUNT',
  'SUM',
  'AVG',
  'MIN',
  'MAX',
  'NULL',
  'IS NULL',
  'IS NOT NULL',
  'BETWEEN',
  'CASE',
  'WHEN',
  'THEN',
  'ELSE',
  'END',
  'EXISTS',
  'UNION',
  'UNION ALL',
  'EXCEPT',
  'INTERSECT',
  'PRIMARY KEY',
  'FOREIGN KEY',
  'REFERENCES',
  'INDEX',
  'UNIQUE',
  'DEFAULT',
  'CHECK',
  'CONSTRAINT',
  'CASCADE',
  'PRAGMA',
  'EXPLAIN',
  'VACUUM',
  'ATTACH',
  'DETACH',
  'BEGIN',
  'COMMIT',
  'ROLLBACK',
  'TRANSACTION',
  'SAVEPOINT',
  'RELEASE',
];

/**
 * SQL functions catalog with signatures and documentation.
 * Used for intelligent function completion.
 */
const SQL_FUNCTIONS: SqlFunction[] = [
  // Aggregate Functions
  {
    name: 'COUNT',
    signature: 'COUNT(expression)',
    description: 'Returns the number of rows',
    category: 'aggregate',
  },
  {
    name: 'SUM',
    signature: 'SUM(expression)',
    description: 'Returns the sum of values',
    category: 'aggregate',
  },
  {
    name: 'AVG',
    signature: 'AVG(expression)',
    description: 'Returns the average value',
    category: 'aggregate',
  },
  {
    name: 'MIN',
    signature: 'MIN(expression)',
    description: 'Returns the minimum value',
    category: 'aggregate',
  },
  {
    name: 'MAX',
    signature: 'MAX(expression)',
    description: 'Returns the maximum value',
    category: 'aggregate',
  },
  {
    name: 'GROUP_CONCAT',
    signature: 'GROUP_CONCAT(expression, separator)',
    description: 'Concatenates values from a group',
    category: 'aggregate',
  },
  {
    name: 'TOTAL',
    signature: 'TOTAL(expression)',
    description: 'Returns the sum as a floating point',
    category: 'aggregate',
  },

  // String Functions
  {
    name: 'LENGTH',
    signature: 'LENGTH(string)',
    description: 'Returns the length of a string',
    category: 'string',
  },
  {
    name: 'UPPER',
    signature: 'UPPER(string)',
    description: 'Converts string to uppercase',
    category: 'string',
  },
  {
    name: 'LOWER',
    signature: 'LOWER(string)',
    description: 'Converts string to lowercase',
    category: 'string',
  },
  {
    name: 'SUBSTR',
    signature: 'SUBSTR(string, start, length)',
    description: 'Extracts a substring',
    category: 'string',
  },
  {
    name: 'TRIM',
    signature: 'TRIM(string)',
    description: 'Removes leading and trailing whitespace',
    category: 'string',
  },
  {
    name: 'LTRIM',
    signature: 'LTRIM(string)',
    description: 'Removes leading whitespace',
    category: 'string',
  },
  {
    name: 'RTRIM',
    signature: 'RTRIM(string)',
    description: 'Removes trailing whitespace',
    category: 'string',
  },
  {
    name: 'REPLACE',
    signature: 'REPLACE(string, from, to)',
    description: 'Replaces occurrences of a substring',
    category: 'string',
  },
  {
    name: 'INSTR',
    signature: 'INSTR(string, substring)',
    description: 'Returns position of substring',
    category: 'string',
  },
  {
    name: 'PRINTF',
    signature: 'PRINTF(format, ...args)',
    description: 'Formats a string using printf-style format',
    category: 'string',
  },
  {
    name: 'CHAR',
    signature: 'CHAR(code, ...)',
    description: 'Returns character from Unicode code point',
    category: 'string',
  },
  {
    name: 'UNICODE',
    signature: 'UNICODE(string)',
    description: 'Returns Unicode code point of first character',
    category: 'string',
  },
  {
    name: 'HEX',
    signature: 'HEX(value)',
    description: 'Returns hexadecimal representation',
    category: 'string',
  },
  {
    name: 'QUOTE',
    signature: 'QUOTE(value)',
    description: 'Returns SQL literal representation',
    category: 'string',
  },
  {
    name: 'ZEROBLOB',
    signature: 'ZEROBLOB(n)',
    description: 'Returns a blob of N zero bytes',
    category: 'string',
  },

  // Numeric Functions
  {
    name: 'ABS',
    signature: 'ABS(number)',
    description: 'Returns absolute value',
    category: 'numeric',
  },
  {
    name: 'ROUND',
    signature: 'ROUND(number, digits)',
    description: 'Rounds to specified decimal places',
    category: 'numeric',
  },
  {
    name: 'RANDOM',
    signature: 'RANDOM()',
    description: 'Returns a random integer',
    category: 'numeric',
  },
  {
    name: 'MAX',
    signature: 'MAX(a, b, ...)',
    description: 'Returns the maximum value',
    category: 'numeric',
  },
  {
    name: 'MIN',
    signature: 'MIN(a, b, ...)',
    description: 'Returns the minimum value',
    category: 'numeric',
  },

  // Date/Time Functions
  {
    name: 'DATE',
    signature: 'DATE(timestring, modifier, ...)',
    description: 'Returns date in YYYY-MM-DD format',
    category: 'datetime',
  },
  {
    name: 'TIME',
    signature: 'TIME(timestring, modifier, ...)',
    description: 'Returns time in HH:MM:SS format',
    category: 'datetime',
  },
  {
    name: 'DATETIME',
    signature: 'DATETIME(timestring, modifier, ...)',
    description: 'Returns datetime in YYYY-MM-DD HH:MM:SS format',
    category: 'datetime',
  },
  {
    name: 'JULIANDAY',
    signature: 'JULIANDAY(timestring, modifier, ...)',
    description: 'Returns Julian day number',
    category: 'datetime',
  },
  {
    name: 'UNIXEPOCH',
    signature: 'UNIXEPOCH(timestring, modifier, ...)',
    description: 'Returns Unix timestamp',
    category: 'datetime',
  },
  {
    name: 'STRFTIME',
    signature: 'STRFTIME(format, timestring, modifier, ...)',
    description: 'Returns formatted date/time string',
    category: 'datetime',
  },

  // Conditional Functions
  {
    name: 'COALESCE',
    signature: 'COALESCE(value1, value2, ...)',
    description: 'Returns first non-NULL value',
    category: 'conditional',
  },
  {
    name: 'NULLIF',
    signature: 'NULLIF(value1, value2)',
    description: 'Returns NULL if values are equal',
    category: 'conditional',
  },
  {
    name: 'IFNULL',
    signature: 'IFNULL(value, default)',
    description: 'Returns default if value is NULL',
    category: 'conditional',
  },
  {
    name: 'IIF',
    signature: 'IIF(condition, true_value, false_value)',
    description: 'Inline if-then-else',
    category: 'conditional',
  },
  {
    name: 'TYPEOF',
    signature: 'TYPEOF(value)',
    description: 'Returns the data type of value',
    category: 'conditional',
  },

  // SQLite Specific
  {
    name: 'GLOB',
    signature: 'GLOB(pattern, string)',
    description: 'Pattern matching with glob syntax',
    category: 'sqlite',
  },
  {
    name: 'LIKE',
    signature: 'LIKE(pattern, string, escape)',
    description: 'Pattern matching with LIKE syntax',
    category: 'sqlite',
  },
  {
    name: 'LIKELIHOOD',
    signature: 'LIKELIHOOD(value, probability)',
    description: 'Provides hint about probability',
    category: 'sqlite',
  },
  {
    name: 'LIKELY',
    signature: 'LIKELY(value)',
    description: 'Hints that value is probably true',
    category: 'sqlite',
  },
  {
    name: 'UNLIKELY',
    signature: 'UNLIKELY(value)',
    description: 'Hints that value is probably false',
    category: 'sqlite',
  },
  {
    name: 'LAST_INSERT_ROWID',
    signature: 'LAST_INSERT_ROWID()',
    description: 'Returns last inserted rowid',
    category: 'sqlite',
  },
  {
    name: 'CHANGES',
    signature: 'CHANGES()',
    description: 'Returns number of rows changed',
    category: 'sqlite',
  },
  {
    name: 'TOTAL_CHANGES',
    signature: 'TOTAL_CHANGES()',
    description: 'Returns total rows changed since connection',
    category: 'sqlite',
  },
  {
    name: 'SQLITE_VERSION',
    signature: 'SQLITE_VERSION()',
    description: 'Returns SQLite version string',
    category: 'sqlite',
  },
];

/**
 * SQL snippets for common query patterns.
 * Note: The ${n:placeholder} syntax is Monaco Editor snippet syntax, not template literals.
 */
/* eslint-disable no-template-curly-in-string */
const SQL_SNIPPETS: SqlSnippet[] = [
  {
    label: 'SELECT * FROM',
    insertText: 'SELECT * FROM ${1:table_name}',
    description: 'Select all columns from a table',
    category: 'query',
  },
  {
    label: 'SELECT columns FROM',
    insertText: 'SELECT ${1:column1}, ${2:column2}\nFROM ${3:table_name}',
    description: 'Select specific columns from a table',
    category: 'query',
  },
  {
    label: 'SELECT with WHERE',
    insertText: 'SELECT ${1:*}\nFROM ${2:table_name}\nWHERE ${3:condition}',
    description: 'Select with a WHERE condition',
    category: 'query',
  },
  {
    label: 'SELECT with JOIN',
    insertText:
      'SELECT ${1:t1.*}, ${2:t2.*}\nFROM ${3:table1} t1\nJOIN ${4:table2} t2 ON t1.${5:id} = t2.${6:foreign_id}',
    description: 'Select with table join',
    category: 'query',
  },
  {
    label: 'SELECT with GROUP BY',
    insertText:
      'SELECT ${1:column}, COUNT(*) as count\nFROM ${2:table_name}\nGROUP BY ${1:column}',
    description: 'Select with grouping and count',
    category: 'query',
  },
  {
    label: 'INSERT INTO',
    insertText:
      'INSERT INTO ${1:table_name} (${2:column1}, ${3:column2})\nVALUES (${4:value1}, ${5:value2})',
    description: 'Insert a new row',
    category: 'dml',
  },
  {
    label: 'UPDATE SET',
    insertText:
      'UPDATE ${1:table_name}\nSET ${2:column} = ${3:value}\nWHERE ${4:condition}',
    description: 'Update existing rows',
    category: 'dml',
  },
  {
    label: 'DELETE FROM',
    insertText: 'DELETE FROM ${1:table_name}\nWHERE ${2:condition}',
    description: 'Delete rows from a table',
    category: 'dml',
  },
  {
    label: 'CREATE TABLE',
    insertText:
      'CREATE TABLE ${1:table_name} (\n  ${2:id} INTEGER PRIMARY KEY,\n  ${3:column} ${4:TEXT}\n)',
    description: 'Create a new table',
    category: 'ddl',
  },
  {
    label: 'CREATE INDEX',
    insertText: 'CREATE INDEX ${1:idx_name} ON ${2:table_name} (${3:column})',
    description: 'Create an index on a column',
    category: 'ddl',
  },
  {
    label: 'CASE WHEN',
    insertText:
      'CASE\n  WHEN ${1:condition} THEN ${2:result}\n  ELSE ${3:default}\nEND',
    description: 'Conditional expression',
    category: 'expression',
  },
  {
    label: 'EXISTS subquery',
    insertText:
      'EXISTS (\n  SELECT 1 FROM ${1:table_name}\n  WHERE ${2:condition}\n)',
    description: 'Check if subquery returns rows',
    category: 'expression',
  },
  {
    label: 'COALESCE',
    insertText: 'COALESCE(${1:value}, ${2:default})',
    description: 'Return first non-NULL value',
    category: 'expression',
  },
];
/* eslint-enable no-template-curly-in-string */

/**
 * Keywords that should be suggested after specific contexts.
 */
const CONTEXT_KEYWORDS: Record<SqlContext, string[]> = {
  SELECT_COLUMNS: [
    'DISTINCT',
    'COUNT',
    'SUM',
    'AVG',
    'MIN',
    'MAX',
    'CASE',
    'COALESCE',
    'AS',
    '*',
  ],
  FROM_TABLE: ['AS'],
  JOIN_TABLE: ['ON', 'AS'],
  JOIN_CONDITION: ['AND', 'OR', 'ON'],
  WHERE_CONDITION: [
    'AND',
    'OR',
    'NOT',
    'IN',
    'LIKE',
    'BETWEEN',
    'IS NULL',
    'IS NOT NULL',
    'EXISTS',
    'CASE',
  ],
  ORDER_BY: ['ASC', 'DESC', 'NULLS FIRST', 'NULLS LAST'],
  GROUP_BY: ['HAVING'],
  HAVING: ['AND', 'OR', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX'],
  INSERT_TABLE: [],
  INSERT_COLUMNS: [],
  INSERT_VALUES: ['NULL', 'DEFAULT'],
  UPDATE_TABLE: ['SET'],
  UPDATE_SET: ['WHERE'],
  DELETE_TABLE: ['WHERE'],
  CREATE_TABLE: [
    'PRIMARY KEY',
    'NOT NULL',
    'UNIQUE',
    'DEFAULT',
    'CHECK',
    'REFERENCES',
    'FOREIGN KEY',
  ],
  FUNCTION_ARGS: [],
  SUBQUERY: ['SELECT'],
  GENERAL: [
    'SELECT',
    'INSERT INTO',
    'UPDATE',
    'DELETE FROM',
    'CREATE TABLE',
    'DROP TABLE',
    'ALTER TABLE',
    'PRAGMA',
    'EXPLAIN',
    'BEGIN',
    'COMMIT',
    'ROLLBACK',
  ],
};

/**
 * Analyzes the SQL text up to the cursor position to determine context.
 */
function analyzeSqlContext(
  model: Monaco.editor.ITextModel,
  position: Monaco.Position
): SqlContextResult {
  const fullText = model.getValue();
  const offset = model.getOffsetAt(position);
  const textBeforeCursor = fullText.substring(0, offset);

  // Get current word being typed
  const word = model.getWordUntilPosition(position);
  const currentWord = word.word.toUpperCase();

  // Check for dot prefix (table.column pattern)
  const lineContent = model.getLineContent(position.lineNumber);
  const textBeforeOnLine = lineContent.substring(0, position.column - 1);
  const dotMatch = textBeforeOnLine.match(/(\w+)\.\s*$/);
  const dotPrefix = dotMatch ? dotMatch[1] : null;

  // Parse state
  let inString = false;
  let stringChar = '';
  let inComment = false;
  let inBlockComment = false;
  let parenDepth = 0;

  // Token tracking
  const tokens: string[] = [];
  let currentToken = '';

  for (let i = 0; i < textBeforeCursor.length; i++) {
    const char = textBeforeCursor[i];
    const nextChar = textBeforeCursor[i + 1];

    // Handle block comment start
    if (!inString && !inComment && char === '/' && nextChar === '*') {
      inBlockComment = true;
      i++;
      continue;
    }

    // Handle block comment end
    if (inBlockComment && char === '*' && nextChar === '/') {
      inBlockComment = false;
      i++;
      continue;
    }

    if (inBlockComment) continue;

    // Handle line comment
    if (!inString && char === '-' && nextChar === '-') {
      inComment = true;
      continue;
    }

    if (inComment && char === '\n') {
      inComment = false;
      continue;
    }

    if (inComment) continue;

    // Handle strings
    if ((char === "'" || char === '"') && !inString) {
      inString = true;
      stringChar = char;
      continue;
    }

    if (inString && char === stringChar) {
      if (nextChar === stringChar) {
        i++; // Skip escaped quote
        continue;
      }
      inString = false;
      continue;
    }

    if (inString) continue;

    // Track parentheses
    if (char === '(') parenDepth++;
    if (char === ')') parenDepth = Math.max(0, parenDepth - 1);

    // Build tokens
    if (/\s/.test(char) || /[(),;.=<>!]/.test(char)) {
      if (currentToken) {
        tokens.push(currentToken.toUpperCase());
        currentToken = '';
      }
    } else {
      currentToken += char;
    }
  }

  if (currentToken) {
    tokens.push(currentToken.toUpperCase());
  }

  // Determine context from tokens
  const context = determineContext(tokens, parenDepth);
  const previousToken = tokens.length > 0 ? tokens[tokens.length - 1] : null;
  const currentClause = findCurrentClause(tokens);

  // Parse table references
  const tableRefs = parseTableReferences(fullText);

  return {
    context,
    tableRefs,
    dotPrefix,
    currentWord,
    parenDepth,
    inString,
    inComment: inComment || inBlockComment,
    previousToken,
    currentClause,
  };
}

/**
 * Determines the SQL context based on token history.
 */
function determineContext(tokens: string[], parenDepth: number): SqlContext {
  if (tokens.length === 0) return 'GENERAL';

  const lastToken = tokens[tokens.length - 1];
  const lastTwoTokens = tokens.slice(-2).join(' ');

  // Check for specific patterns from most specific to least

  // Subquery detection
  if (parenDepth > 0 && tokens.includes('(')) {
    const lastParenIndex = tokens.lastIndexOf('(');
    const tokensAfterParen = tokens.slice(lastParenIndex + 1);
    if (tokensAfterParen.length === 0 || tokensAfterParen[0] === 'SELECT') {
      return 'SUBQUERY';
    }
  }

  // INSERT patterns
  if (lastTwoTokens === 'INSERT INTO') return 'INSERT_TABLE';
  if (lastToken === 'VALUES') return 'INSERT_VALUES';

  // UPDATE patterns
  if (lastToken === 'UPDATE') return 'UPDATE_TABLE';
  if (lastToken === 'SET' && tokens.includes('UPDATE')) return 'UPDATE_SET';

  // DELETE patterns
  if (lastTwoTokens === 'DELETE FROM') return 'DELETE_TABLE';

  // CREATE patterns
  if (lastTwoTokens === 'CREATE TABLE') return 'CREATE_TABLE';

  // JOIN patterns
  if (
    lastToken === 'JOIN' ||
    lastTwoTokens === 'LEFT JOIN' ||
    lastTwoTokens === 'RIGHT JOIN' ||
    lastTwoTokens === 'INNER JOIN' ||
    lastTwoTokens === 'OUTER JOIN' ||
    lastTwoTokens === 'CROSS JOIN'
  ) {
    return 'JOIN_TABLE';
  }

  if (lastToken === 'ON') return 'JOIN_CONDITION';

  // SELECT patterns
  if (lastToken === 'SELECT' || lastToken === 'DISTINCT')
    return 'SELECT_COLUMNS';

  // FROM pattern
  if (lastToken === 'FROM') return 'FROM_TABLE';

  // WHERE pattern
  if (
    lastToken === 'WHERE' ||
    (tokens.includes('WHERE') &&
      !tokens.includes('ORDER') &&
      !tokens.includes('GROUP'))
  ) {
    return 'WHERE_CONDITION';
  }

  // ORDER BY pattern
  if (
    lastTwoTokens === 'ORDER BY' ||
    (lastToken === 'BY' && tokens.includes('ORDER'))
  ) {
    return 'ORDER_BY';
  }

  // GROUP BY pattern
  if (lastTwoTokens === 'GROUP BY') return 'GROUP_BY';

  // HAVING pattern
  if (lastToken === 'HAVING') return 'HAVING';

  // Check if we're in a SELECT clause (after SELECT, before FROM)
  if (tokens.includes('SELECT') && !tokens.includes('FROM')) {
    return 'SELECT_COLUMNS';
  }

  // Check if we're after FROM but before WHERE
  if (tokens.includes('FROM') && !tokens.includes('WHERE')) {
    return 'FROM_TABLE';
  }

  return 'GENERAL';
}

/**
 * Finds the current clause we're in based on token history.
 */
function findCurrentClause(tokens: string[]): string | null {
  const clauses = [
    'SELECT',
    'FROM',
    'WHERE',
    'ORDER',
    'GROUP',
    'HAVING',
    'LIMIT',
    'INSERT',
    'UPDATE',
    'DELETE',
    'SET',
    'VALUES',
  ];

  for (let i = tokens.length - 1; i >= 0; i--) {
    if (clauses.includes(tokens[i])) {
      return tokens[i];
    }
  }

  return null;
}

/**
 * Set of valid SQL keywords for quick lookup.
 */
const SQL_KEYWORDS_SET = new Set(SQL_KEYWORDS.map((k) => k.toUpperCase()));

/**
 * Tokenizes SQL string, preserving string literals and comments.
 */
function tokenizeSql(sql: string): SqlToken[] {
  const tokens: SqlToken[] = [];
  let i = 0;

  while (i < sql.length) {
    const char = sql[i];
    const nextChar = sql[i + 1];

    // Skip whitespace
    if (/\s/.test(char)) {
      let ws = '';
      while (i < sql.length && /\s/.test(sql[i])) {
        ws += sql[i];
        i++;
      }
      tokens.push({ type: 'whitespace', value: ' ', original: ws });
      continue;
    }

    // Line comment --
    if (char === '-' && nextChar === '-') {
      let comment = '';
      while (i < sql.length && sql[i] !== '\n') {
        comment += sql[i];
        i++;
      }
      tokens.push({ type: 'comment', value: comment, original: comment });
      continue;
    }

    // Block comment /* */
    if (char === '/' && nextChar === '*') {
      let comment = '/*';
      i += 2;
      while (i < sql.length) {
        if (sql[i] === '*' && sql[i + 1] === '/') {
          comment += '*/';
          i += 2;
          break;
        }
        comment += sql[i];
        i++;
      }
      tokens.push({ type: 'comment', value: comment, original: comment });
      continue;
    }

    // Single-quoted string
    if (char === "'") {
      let str = "'";
      i++;
      while (i < sql.length) {
        if (sql[i] === "'" && sql[i + 1] === "'") {
          str += "''";
          i += 2;
          continue;
        }
        if (sql[i] === "'") {
          str += "'";
          i++;
          break;
        }
        str += sql[i];
        i++;
      }
      tokens.push({ type: 'string', value: str, original: str });
      continue;
    }

    // Double-quoted identifier
    if (char === '"') {
      let str = '"';
      i++;
      while (i < sql.length) {
        if (sql[i] === '"' && sql[i + 1] === '"') {
          str += '""';
          i += 2;
          continue;
        }
        if (sql[i] === '"') {
          str += '"';
          i++;
          break;
        }
        str += sql[i];
        i++;
      }
      tokens.push({ type: 'identifier', value: str, original: str });
      continue;
    }

    // Backtick identifier (MySQL style, but common)
    if (char === '`') {
      let str = '`';
      i++;
      while (i < sql.length && sql[i] !== '`') {
        str += sql[i];
        i++;
      }
      if (i < sql.length) {
        str += '`';
        i++;
      }
      tokens.push({ type: 'identifier', value: str, original: str });
      continue;
    }

    // Numbers
    if (/\d/.test(char)) {
      let num = '';
      while (i < sql.length && /[\d.]/.test(sql[i])) {
        num += sql[i];
        i++;
      }
      tokens.push({ type: 'number', value: num, original: num });
      continue;
    }

    // Operators and punctuation
    if (/[(),;*=<>!+\-/%]/.test(char)) {
      // Multi-character operators
      const twoChar = char + nextChar;
      if (['<=', '>=', '<>', '!=', '||', '<<', '>>'].includes(twoChar)) {
        tokens.push({ type: 'operator', value: twoChar, original: twoChar });
        i += 2;
        continue;
      }
      const type = ['(', ')', ',', ';'].includes(char)
        ? 'punctuation'
        : 'operator';
      tokens.push({ type, value: char, original: char });
      i++;
      continue;
    }

    // Identifiers and keywords
    if (/[a-z_]/i.test(char)) {
      let word = '';
      while (i < sql.length && /\w/.test(sql[i])) {
        word += sql[i];
        i++;
      }
      const upperWord = word.toUpperCase();
      // Check if it's a keyword
      if (SQL_KEYWORDS_SET.has(upperWord)) {
        tokens.push({ type: 'keyword', value: upperWord, original: word });
      } else {
        tokens.push({ type: 'identifier', value: word, original: word });
      }
      continue;
    }

    // Dot for qualified names
    if (char === '.') {
      tokens.push({ type: 'punctuation', value: '.', original: '.' });
      i++;
      continue;
    }

    // Any other character
    tokens.push({ type: 'punctuation', value: char, original: char });
    i++;
  }

  return tokens;
}

/**
 * Formats SQL code with proper indentation and keyword capitalization.
 *
 * Features:
 * - Uppercases SQL keywords (SELECT, FROM, WHERE, etc.)
 * - Adds line breaks after major clauses
 * - Indents JOIN clauses
 * - Handles multi-statement queries (separated by semicolons)
 * - Preserves string literals and comments
 * - Adds proper spacing around operators
 *
 * @param sql - The SQL string to format
 * @returns The formatted SQL string
 */
export function formatSql(sql: string): string {
  if (!sql || !sql.trim()) {
    return sql;
  }

  const tokens = tokenizeSql(sql);
  const result: string[] = [];
  let indentLevel = 0;
  const indent = '  '; // 2 spaces
  let parenDepth = 0;
  let isFirstToken = true;
  let prevNonWhitespaceToken: SqlToken | null = null;

  /**
   * Checks if a sequence of tokens forms a compound keyword.
   */
  function checkCompoundKeyword(
    startIndex: number
  ): { keyword: string; length: number } | null {
    const compounds = [
      ['ORDER', 'BY'],
      ['GROUP', 'BY'],
      ['INSERT', 'INTO'],
      ['DELETE', 'FROM'],
      ['CREATE', 'TABLE'],
      ['DROP', 'TABLE'],
      ['ALTER', 'TABLE'],
      ['LEFT', 'JOIN'],
      ['RIGHT', 'JOIN'],
      ['INNER', 'JOIN'],
      ['OUTER', 'JOIN'],
      ['CROSS', 'JOIN'],
      ['LEFT', 'OUTER', 'JOIN'],
      ['RIGHT', 'OUTER', 'JOIN'],
      ['FULL', 'OUTER', 'JOIN'],
      ['IS', 'NOT', 'NULL'],
      ['IS', 'NULL'],
      ['NOT', 'NULL'],
      ['UNION', 'ALL'],
      ['PRIMARY', 'KEY'],
      ['FOREIGN', 'KEY'],
    ];

    for (const compound of compounds) {
      let match = true;
      let tokenIndex = startIndex;
      for (let j = 0; j < compound.length; j++) {
        // Skip whitespace tokens
        while (
          tokenIndex < tokens.length &&
          tokens[tokenIndex].type === 'whitespace'
        ) {
          tokenIndex++;
        }
        if (tokenIndex >= tokens.length) {
          match = false;
          break;
        }
        if (
          tokens[tokenIndex].type !== 'keyword' ||
          tokens[tokenIndex].value !== compound[j]
        ) {
          match = false;
          break;
        }
        tokenIndex++;
      }
      if (match) {
        return { keyword: compound.join(' '), length: tokenIndex - startIndex };
      }
    }
    return null;
  }

  function addNewLine(): void {
    // Remove trailing whitespace
    while (result.length > 0 && result[result.length - 1] === ' ') {
      result.pop();
    }
    result.push('\n');
    result.push(indent.repeat(indentLevel));
  }

  function addSpace(): void {
    if (
      result.length > 0 &&
      result[result.length - 1] !== ' ' &&
      result[result.length - 1] !== '\n' &&
      !/^\s+$/.test(result[result.length - 1] || '')
    ) {
      result.push(' ');
    }
  }

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];

    // Skip whitespace - we control spacing ourselves
    if (token.type === 'whitespace') {
      i++;
      continue;
    }

    // Handle comments - preserve them with spacing
    if (token.type === 'comment') {
      if (!isFirstToken) {
        addSpace();
      }
      result.push(token.value);

      if (token.value.startsWith('--')) {
        addNewLine();
      }

      prevNonWhitespaceToken = token;
      i++;
      isFirstToken = false;
      continue;
    }

    // Check for compound keywords
    if (token.type === 'keyword') {
      const compound = checkCompoundKeyword(i);
      if (compound) {
        const upperKeyword = compound.keyword;

        // Handle newline before certain keywords
        if (!isFirstToken && NEWLINE_BEFORE_KEYWORDS.has(upperKeyword)) {
          // Reset indent for major clauses
          if (parenDepth === 0) {
            indentLevel = 0;
          }
          addNewLine();
        } else if (!isFirstToken && INDENT_KEYWORDS.has(upperKeyword)) {
          // JOIN clauses get their own line with indent
          if (parenDepth === 0) {
            indentLevel = 1;
          }
          addNewLine();
        } else if (!isFirstToken) {
          addSpace();
        }

        result.push(upperKeyword);

        // Skip the tokens that make up the compound keyword
        i += compound.length;

        prevNonWhitespaceToken = token;
        isFirstToken = false;
        continue;
      }

      // Single keyword handling
      const upperKeyword = token.value;

      if (!isFirstToken && NEWLINE_BEFORE_KEYWORDS.has(upperKeyword)) {
        if (parenDepth === 0) {
          indentLevel = 0;
        }
        addNewLine();
      } else if (!isFirstToken && INDENT_KEYWORDS.has(upperKeyword)) {
        if (parenDepth === 0) {
          indentLevel = 1;
        }
        addNewLine();
      } else if (!isFirstToken) {
        addSpace();
      }

      result.push(upperKeyword);

      prevNonWhitespaceToken = token;
      i++;
      isFirstToken = false;
      continue;
    }

    // Handle punctuation
    if (token.type === 'punctuation') {
      if (token.value === '(') {
        parenDepth++;
        if (
          prevNonWhitespaceToken?.type === 'keyword' &&
          [
            'COUNT',
            'SUM',
            'AVG',
            'MIN',
            'MAX',
            'COALESCE',
            'IFNULL',
            'NULLIF',
            'CAST',
            'SUBSTR',
            'SUBSTRING',
            'LENGTH',
            'UPPER',
            'LOWER',
            'TRIM',
            'REPLACE',
            'INSTR',
            'ROUND',
            'ABS',
            'RANDOM',
            'DATE',
            'TIME',
            'DATETIME',
            'STRFTIME',
            'PRINTF',
            'TYPEOF',
            'EXISTS',
          ].includes(prevNonWhitespaceToken.value)
        ) {
          // No space before ( for function calls
        } else {
          addSpace();
        }
        result.push('(');
      } else if (token.value === ')') {
        parenDepth = Math.max(0, parenDepth - 1);
        result.push(')');
      } else if (token.value === ',') {
        result.push(',');
      } else if (token.value === ';') {
        result.push(';');

        // Add newline after semicolon for multi-statement queries
        if (i < tokens.length - 1) {
          addNewLine();
          addNewLine(); // Extra blank line between statements
        }
      } else if (token.value === '.') {
        // No space around dots (table.column)
        result.push('.');
      } else {
        if (!isFirstToken) {
          addSpace();
        }
        result.push(token.value);
      }

      prevNonWhitespaceToken = token;
      i++;
      isFirstToken = false;
      continue;
    }

    // Handle operators - add spaces around them
    if (token.type === 'operator') {
      addSpace();
      result.push(token.value);

      addSpace();

      prevNonWhitespaceToken = token;
      i++;
      isFirstToken = false;
      continue;
    }

    // Handle identifiers, strings, numbers
    if (
      !isFirstToken &&
      prevNonWhitespaceToken?.value !== '.' &&
      prevNonWhitespaceToken?.value !== '(' &&
      prevNonWhitespaceToken?.type !== 'operator'
    ) {
      // No space after dot or opening paren or operator
      addSpace();
    }
    result.push(token.value);

    prevNonWhitespaceToken = token;
    i++;
    isFirstToken = false;
  }

  return result.join('').trim();
}

/**
 * Represents a SQL validation error in Monaco marker format.
 */
export interface SqlValidationError {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

/**
 * Common SQL keyword typos and their corrections.
 * Maps typo to correct keyword.
 */
const SQL_TYPOS: Record<string, string> = {
  SELEC: 'SELECT',
  SLECT: 'SELECT',
  SELET: 'SELECT',
  SECELT: 'SELECT',
  SELCT: 'SELECT',
  FRON: 'FROM',
  FORM: 'FROM',
  FRMO: 'FROM',
  WHER: 'WHERE',
  WHRE: 'WHERE',
  WEHRE: 'WHERE',
  ORDERY: 'ORDER',
  ODER: 'ORDER',
  GRUOP: 'GROUP',
  GROPU: 'GROUP',
  JION: 'JOIN',
  JOIIN: 'JOIN',
  INSRT: 'INSERT',
  INSET: 'INSERT',
  UDPATE: 'UPDATE',
  UPADTE: 'UPDATE',
  DELTE: 'DELETE',
  DELEET: 'DELETE',
  CRAETE: 'CREATE',
  CRATE: 'CREATE',
  TABL: 'TABLE',
  TABEL: 'TABLE',
  VALUS: 'VALUES',
  VLAUES: 'VALUES',
  DISINCT: 'DISTINCT',
  DISTINT: 'DISTINCT',
  LIMTI: 'LIMIT',
  LIMT: 'LIMIT',
  OFSET: 'OFFSET',
  HAVIGN: 'HAVING',
  HAIVNG: 'HAVING',
};

/**
 * Documentation entry for SQL keywords and functions.
 */
export interface SqlDocEntry {
  syntax: string;
  description: string;
  example?: string;
}

/**
 * Documentation for SQL keywords and functions used by the hover provider.
 * Includes standard SQL keywords, aggregate functions, and SQLite-specific commands.
 */
export const SQL_DOCS: Record<string, SqlDocEntry> = {
  // Query Keywords
  SELECT: {
    syntax: 'SELECT [DISTINCT] column1, column2, ... FROM table',
    description:
      'Retrieves data from one or more tables. Use DISTINCT to return only unique rows.',
    example: 'SELECT name, age FROM users WHERE age > 18',
  },
  FROM: {
    syntax: 'FROM table_name [alias]',
    description:
      'Specifies the table(s) to query data from. Can include table aliases for readability.',
    example: 'SELECT * FROM users u',
  },
  WHERE: {
    syntax: 'WHERE condition',
    description:
      'Filters rows based on a specified condition. Only rows where the condition is true are returned.',
    example: "SELECT * FROM users WHERE status = 'active'",
  },
  AND: {
    syntax: 'condition1 AND condition2',
    description:
      'Combines multiple conditions. All conditions must be true for the row to be included.',
    example: "WHERE age > 18 AND status = 'active'",
  },
  OR: {
    syntax: 'condition1 OR condition2',
    description:
      'Combines multiple conditions. At least one condition must be true for the row to be included.',
    example: "WHERE status = 'active' OR status = 'pending'",
  },
  NOT: {
    syntax: 'NOT condition',
    description: 'Negates a condition. Returns true if the condition is false.',
    example: "WHERE NOT status = 'inactive'",
  },
  IN: {
    syntax: 'column IN (value1, value2, ...)',
    description: 'Checks if a value matches any value in a list or subquery.',
    example: "WHERE status IN ('active', 'pending')",
  },
  LIKE: {
    syntax: 'column LIKE pattern',
    description:
      'Pattern matching with wildcards. Use % for any sequence, _ for single character.',
    example: "WHERE name LIKE 'John%'",
  },
  BETWEEN: {
    syntax: 'column BETWEEN value1 AND value2',
    description: 'Selects values within a given inclusive range.',
    example: 'WHERE age BETWEEN 18 AND 65',
  },
  AS: {
    syntax: 'expression AS alias',
    description:
      'Creates an alias for a column or table to make results more readable.',
    example: 'SELECT name AS user_name FROM users AS u',
  },
  DISTINCT: {
    syntax: 'SELECT DISTINCT column1, column2, ...',
    description:
      'Returns only unique rows, removing duplicates from the result set.',
    example: 'SELECT DISTINCT status FROM users',
  },

  // JOIN Keywords
  JOIN: {
    syntax: 'table1 JOIN table2 ON condition',
    description:
      'Combines rows from two tables based on a related column. Same as INNER JOIN.',
    example: 'SELECT * FROM users JOIN orders ON users.id = orders.user_id',
  },
  'INNER JOIN': {
    syntax: 'table1 INNER JOIN table2 ON condition',
    description: 'Returns rows that have matching values in both tables.',
    example:
      'SELECT * FROM users INNER JOIN orders ON users.id = orders.user_id',
  },
  'LEFT JOIN': {
    syntax: 'table1 LEFT JOIN table2 ON condition',
    description:
      'Returns all rows from the left table, and matching rows from the right table. NULL for non-matches.',
    example:
      'SELECT * FROM users LEFT JOIN orders ON users.id = orders.user_id',
  },
  'RIGHT JOIN': {
    syntax: 'table1 RIGHT JOIN table2 ON condition',
    description:
      'Returns all rows from the right table, and matching rows from the left table. NULL for non-matches.',
    example:
      'SELECT * FROM orders RIGHT JOIN users ON users.id = orders.user_id',
  },
  'OUTER JOIN': {
    syntax: 'table1 OUTER JOIN table2 ON condition',
    description: 'Returns all rows when there is a match in either table.',
    example:
      'SELECT * FROM users FULL OUTER JOIN orders ON users.id = orders.user_id',
  },
  'CROSS JOIN': {
    syntax: 'table1 CROSS JOIN table2',
    description:
      'Returns the Cartesian product of both tables (all possible combinations).',
    example: 'SELECT * FROM colors CROSS JOIN sizes',
  },
  ON: {
    syntax: 'JOIN table ON condition',
    description: 'Specifies the join condition between tables.',
    example: 'JOIN orders ON users.id = orders.user_id',
  },

  // Grouping and Ordering
  'ORDER BY': {
    syntax: 'ORDER BY column1 [ASC|DESC], column2 [ASC|DESC], ...',
    description:
      'Sorts the result set by one or more columns. ASC for ascending (default), DESC for descending.',
    example: 'SELECT * FROM users ORDER BY name ASC, age DESC',
  },
  'GROUP BY': {
    syntax: 'GROUP BY column1, column2, ...',
    description:
      'Groups rows with the same values. Often used with aggregate functions.',
    example: 'SELECT status, COUNT(*) FROM users GROUP BY status',
  },
  HAVING: {
    syntax: 'HAVING condition',
    description:
      'Filters groups based on aggregate conditions. Used after GROUP BY.',
    example:
      'SELECT status, COUNT(*) FROM users GROUP BY status HAVING COUNT(*) > 5',
  },
  LIMIT: {
    syntax: 'LIMIT count [OFFSET offset]',
    description: 'Restricts the number of rows returned by the query.',
    example: 'SELECT * FROM users LIMIT 10',
  },
  OFFSET: {
    syntax: 'OFFSET number',
    description:
      'Skips the specified number of rows before returning results. Used with LIMIT for pagination.',
    example: 'SELECT * FROM users LIMIT 10 OFFSET 20',
  },

  // Aggregate Functions
  COUNT: {
    syntax: 'COUNT(expression) or COUNT(*)',
    description:
      'Returns the number of rows. COUNT(*) counts all rows, COUNT(column) counts non-NULL values.',
    example: 'SELECT COUNT(*) FROM users',
  },
  SUM: {
    syntax: 'SUM(expression)',
    description:
      'Returns the sum of all values in a numeric column. NULL values are ignored.',
    example: 'SELECT SUM(amount) FROM orders',
  },
  AVG: {
    syntax: 'AVG(expression)',
    description:
      'Returns the average value of a numeric column. NULL values are ignored.',
    example: 'SELECT AVG(price) FROM products',
  },
  MIN: {
    syntax: 'MIN(expression)',
    description:
      'Returns the minimum value in a column. Works with numbers, strings, and dates.',
    example: 'SELECT MIN(price) FROM products',
  },
  MAX: {
    syntax: 'MAX(expression)',
    description:
      'Returns the maximum value in a column. Works with numbers, strings, and dates.',
    example: 'SELECT MAX(created_at) FROM orders',
  },

  // Set Operations
  UNION: {
    syntax: 'query1 UNION query2',
    description:
      'Combines results of two queries, removing duplicates. Both queries must have the same columns.',
    example: 'SELECT name FROM customers UNION SELECT name FROM employees',
  },
  'UNION ALL': {
    syntax: 'query1 UNION ALL query2',
    description: 'Combines results of two queries, keeping all duplicates.',
    example: 'SELECT name FROM customers UNION ALL SELECT name FROM employees',
  },
  EXCEPT: {
    syntax: 'query1 EXCEPT query2',
    description:
      'Returns rows from the first query that are not in the second query.',
    example: 'SELECT name FROM all_users EXCEPT SELECT name FROM banned_users',
  },
  INTERSECT: {
    syntax: 'query1 INTERSECT query2',
    description: 'Returns only rows that appear in both queries.',
    example:
      'SELECT name FROM customers INTERSECT SELECT name FROM newsletter_subscribers',
  },

  // Data Modification
  'INSERT INTO': {
    syntax: 'INSERT INTO table (col1, col2, ...) VALUES (val1, val2, ...)',
    description: 'Inserts new rows into a table.',
    example:
      "INSERT INTO users (name, email) VALUES ('John', 'john@example.com')",
  },
  VALUES: {
    syntax: 'VALUES (value1, value2, ...)',
    description: 'Specifies the values to insert into a table.',
    example: "INSERT INTO users (name) VALUES ('John'), ('Jane')",
  },
  UPDATE: {
    syntax: 'UPDATE table SET col1 = val1, col2 = val2, ... [WHERE condition]',
    description:
      'Modifies existing rows in a table. Use WHERE to specify which rows to update.',
    example: "UPDATE users SET status = 'active' WHERE id = 1",
  },
  SET: {
    syntax: 'SET column1 = value1, column2 = value2, ...',
    description: 'Specifies the columns and values to update.',
    example: "UPDATE users SET name = 'John', age = 30 WHERE id = 1",
  },
  'DELETE FROM': {
    syntax: 'DELETE FROM table [WHERE condition]',
    description:
      'Removes rows from a table. Use WHERE to specify which rows to delete.',
    example: "DELETE FROM users WHERE status = 'inactive'",
  },

  // Table Operations
  'CREATE TABLE': {
    syntax: 'CREATE TABLE table_name (column1 type1, column2 type2, ...)',
    description:
      'Creates a new table with the specified columns and data types.',
    example: 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL)',
  },
  'DROP TABLE': {
    syntax: 'DROP TABLE [IF EXISTS] table_name',
    description: 'Removes a table and all its data from the database.',
    example: 'DROP TABLE IF EXISTS temp_users',
  },
  'ALTER TABLE': {
    syntax: 'ALTER TABLE table_name action',
    description:
      'Modifies an existing table structure (add/drop columns, rename, etc.).',
    example: 'ALTER TABLE users ADD COLUMN email TEXT',
  },

  // Constraints
  'PRIMARY KEY': {
    syntax: 'column_name type PRIMARY KEY',
    description:
      'Uniquely identifies each row in a table. Cannot contain NULL values.',
    example: 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)',
  },
  'FOREIGN KEY': {
    syntax: 'FOREIGN KEY (column) REFERENCES other_table(column)',
    description:
      'Creates a link between tables by referencing a primary key in another table.',
    example: 'FOREIGN KEY (user_id) REFERENCES users(id)',
  },
  UNIQUE: {
    syntax: 'column_name type UNIQUE',
    description: 'Ensures all values in a column are different.',
    example: 'CREATE TABLE users (id INTEGER, email TEXT UNIQUE)',
  },
  DEFAULT: {
    syntax: 'column_name type DEFAULT value',
    description:
      'Sets a default value for a column when no value is specified.',
    example: "CREATE TABLE users (status TEXT DEFAULT 'active')",
  },
  CHECK: {
    syntax: 'CHECK (condition)',
    description: 'Ensures all values in a column satisfy a specific condition.',
    example: 'CREATE TABLE users (age INTEGER CHECK(age >= 0))',
  },
  CONSTRAINT: {
    syntax: 'CONSTRAINT name constraint_definition',
    description: 'Defines a named constraint on one or more columns.',
    example: 'CONSTRAINT pk_user PRIMARY KEY (id)',
  },
  REFERENCES: {
    syntax: 'REFERENCES table_name(column_name)',
    description:
      'Specifies the table and column that a foreign key references.',
    example: 'user_id INTEGER REFERENCES users(id)',
  },
  CASCADE: {
    syntax: 'ON DELETE CASCADE / ON UPDATE CASCADE',
    description:
      'Automatically propagates changes from parent to child tables.',
    example: 'FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE',
  },
  INDEX: {
    syntax: 'CREATE INDEX index_name ON table(column)',
    description:
      'Creates an index to speed up queries on the specified column(s).',
    example: 'CREATE INDEX idx_user_email ON users(email)',
  },

  // Conditional Expressions
  CASE: {
    syntax: 'CASE WHEN condition THEN result [ELSE default] END',
    description:
      'Conditional expression that returns different values based on conditions.',
    example:
      "SELECT CASE WHEN age < 18 THEN 'minor' ELSE 'adult' END FROM users",
  },
  WHEN: {
    syntax: 'WHEN condition THEN result',
    description: 'Specifies a condition and result within a CASE expression.',
    example:
      "CASE WHEN status = 'A' THEN 'Active' WHEN status = 'I' THEN 'Inactive' END",
  },
  THEN: {
    syntax: 'WHEN condition THEN result',
    description:
      'Specifies the value to return when the preceding WHEN condition is true.',
    example: "CASE WHEN age >= 18 THEN 'adult' END",
  },
  ELSE: {
    syntax: 'ELSE default_value',
    description:
      'Specifies the default value in a CASE expression when no WHEN condition matches.',
    example: "CASE WHEN status = 'A' THEN 'Active' ELSE 'Unknown' END",
  },
  END: {
    syntax: 'CASE ... END',
    description: 'Marks the end of a CASE expression.',
    example: "SELECT CASE WHEN x > 0 THEN 'positive' END FROM numbers",
  },
  EXISTS: {
    syntax: 'EXISTS (subquery)',
    description:
      'Tests whether a subquery returns any rows. Returns true if at least one row exists.',
    example:
      'SELECT * FROM users WHERE EXISTS (SELECT 1 FROM orders WHERE orders.user_id = users.id)',
  },
  NULL: {
    syntax: 'NULL',
    description:
      'Represents a missing or unknown value. Use IS NULL or IS NOT NULL to check.',
    example: 'SELECT * FROM users WHERE email IS NULL',
  },
  'IS NULL': {
    syntax: 'column IS NULL',
    description:
      'Tests if a value is NULL. Regular = comparison does not work with NULL.',
    example: 'SELECT * FROM users WHERE deleted_at IS NULL',
  },
  'IS NOT NULL': {
    syntax: 'column IS NOT NULL',
    description: 'Tests if a value is not NULL.',
    example: 'SELECT * FROM users WHERE email IS NOT NULL',
  },

  // Transaction Control
  BEGIN: {
    syntax: 'BEGIN [TRANSACTION]',
    description:
      'Starts a new transaction. Changes are not committed until COMMIT.',
    example: 'BEGIN TRANSACTION',
  },
  COMMIT: {
    syntax: 'COMMIT',
    description: 'Saves all changes made during the current transaction.',
    example: 'COMMIT',
  },
  ROLLBACK: {
    syntax: 'ROLLBACK [TO SAVEPOINT savepoint_name]',
    description: 'Reverts all changes made during the current transaction.',
    example: 'ROLLBACK',
  },
  TRANSACTION: {
    syntax: 'BEGIN TRANSACTION / END TRANSACTION',
    description:
      'A sequence of operations performed as a single logical unit of work.',
    example:
      'BEGIN TRANSACTION; UPDATE accounts SET balance = balance - 100; COMMIT;',
  },
  SAVEPOINT: {
    syntax: 'SAVEPOINT savepoint_name',
    description:
      'Creates a point within a transaction to which you can later roll back.',
    example: 'SAVEPOINT my_savepoint',
  },
  RELEASE: {
    syntax: 'RELEASE SAVEPOINT savepoint_name',
    description:
      'Removes a savepoint, making it no longer available for rollback.',
    example: 'RELEASE SAVEPOINT my_savepoint',
  },

  // SQLite-specific Commands
  PRAGMA: {
    syntax: 'PRAGMA pragma_name [= value]',
    description:
      'SQLite-specific command to query or modify database settings and metadata.',
    example: 'PRAGMA table_info(users)',
  },
  VACUUM: {
    syntax: 'VACUUM',
    description:
      'Rebuilds the database file, reclaiming unused space and defragmenting.',
    example: 'VACUUM',
  },
  ATTACH: {
    syntax: 'ATTACH DATABASE filename AS schema_name',
    description: 'Attaches another database file to the current connection.',
    example: "ATTACH DATABASE 'archive.db' AS archive",
  },
  DETACH: {
    syntax: 'DETACH DATABASE schema_name',
    description:
      'Detaches a previously attached database from the current connection.',
    example: 'DETACH DATABASE archive',
  },
  EXPLAIN: {
    syntax: 'EXPLAIN [QUERY PLAN] statement',
    description:
      'Shows how SQLite will execute a query. QUERY PLAN shows the high-level strategy.',
    example: 'EXPLAIN QUERY PLAN SELECT * FROM users WHERE id = 1',
  },
};

/**
 * Validates SQL syntax and returns array of validation errors.
 * This is a lightweight validation for common issues, not a full SQL parser.
 *
 * Checks for:
 * - Empty/whitespace-only input (no errors)
 * - Unclosed parentheses
 * - Unclosed string quotes (single and double)
 * - Common SQL keyword typos
 *
 * @param sql - The SQL string to validate
 * @returns Array of validation errors in Monaco marker format
 */
export function validateSql(sql: string): SqlValidationError[] {
  const errors: SqlValidationError[] = [];

  // Return empty array for empty/whitespace-only input
  if (!sql || !sql.trim()) {
    return errors;
  }

  const lines = sql.split('\n');

  // Track parentheses and quotes state
  let parenDepth = 0;
  const openParenLocations: Array<{ line: number; col: number }> = [];
  let inSingleQuote = false;
  let singleQuoteStart: { line: number; col: number } | null = null;
  let inDoubleQuote = false;
  let doubleQuoteStart: { line: number; col: number } | null = null;
  let inLineComment = false;
  let inBlockComment = false;

  // Process character by character
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const lineNumber = lineIdx + 1; // Monaco uses 1-based line numbers
    inLineComment = false; // Reset at start of each line

    for (let colIdx = 0; colIdx < line.length; colIdx++) {
      const char = line[colIdx];
      const nextChar = line[colIdx + 1];
      const column = colIdx + 1; // Monaco uses 1-based column numbers

      // Handle block comment start
      if (
        !inSingleQuote &&
        !inDoubleQuote &&
        !inLineComment &&
        char === '/' &&
        nextChar === '*'
      ) {
        inBlockComment = true;
        colIdx++; // Skip the *
        continue;
      }

      // Handle block comment end
      if (inBlockComment && char === '*' && nextChar === '/') {
        inBlockComment = false;
        colIdx++; // Skip the /
        continue;
      }

      // Skip if in block comment
      if (inBlockComment) {
        continue;
      }

      // Handle line comment start
      if (
        !inSingleQuote &&
        !inDoubleQuote &&
        char === '-' &&
        nextChar === '-'
      ) {
        inLineComment = true;
        break; // Rest of line is comment
      }

      // Skip if in line comment
      if (inLineComment) {
        continue;
      }

      // Handle single quotes
      if (char === "'" && !inDoubleQuote) {
        // Check for escaped quote ('')
        if (inSingleQuote && nextChar === "'") {
          colIdx++; // Skip escaped quote
          continue;
        }
        if (inSingleQuote) {
          inSingleQuote = false;
          singleQuoteStart = null;
        } else {
          inSingleQuote = true;
          singleQuoteStart = { line: lineNumber, col: column };
        }
        continue;
      }

      // Handle double quotes
      if (char === '"' && !inSingleQuote) {
        // Check for escaped quote ("")
        if (inDoubleQuote && nextChar === '"') {
          colIdx++; // Skip escaped quote
          continue;
        }
        if (inDoubleQuote) {
          inDoubleQuote = false;
          doubleQuoteStart = null;
        } else {
          inDoubleQuote = true;
          doubleQuoteStart = { line: lineNumber, col: column };
        }
        continue;
      }

      // Skip parenthesis tracking if in string
      if (inSingleQuote || inDoubleQuote) {
        continue;
      }

      // Handle parentheses
      if (char === '(') {
        parenDepth++;
        openParenLocations.push({ line: lineNumber, col: column });
      } else if (char === ')') {
        if (parenDepth > 0) {
          parenDepth--;
          openParenLocations.pop();
        } else {
          // Unexpected closing parenthesis
          errors.push({
            startLineNumber: lineNumber,
            startColumn: column,
            endLineNumber: lineNumber,
            endColumn: column + 1,
            message: 'Unexpected closing parenthesis',
            severity: 'error',
          });
        }
      }
    }
  }

  // Check for unclosed quotes
  if (inSingleQuote && singleQuoteStart) {
    errors.push({
      startLineNumber: singleQuoteStart.line,
      startColumn: singleQuoteStart.col,
      endLineNumber: singleQuoteStart.line,
      endColumn: singleQuoteStart.col + 1,
      message: 'Unclosed string literal (single quote)',
      severity: 'error',
    });
  }

  if (inDoubleQuote && doubleQuoteStart) {
    errors.push({
      startLineNumber: doubleQuoteStart.line,
      startColumn: doubleQuoteStart.col,
      endLineNumber: doubleQuoteStart.line,
      endColumn: doubleQuoteStart.col + 1,
      message: 'Unclosed string literal (double quote)',
      severity: 'error',
    });
  }

  // Check for unclosed block comment
  if (inBlockComment) {
    errors.push({
      startLineNumber: lines.length,
      startColumn: 1,
      endLineNumber: lines.length,
      endColumn: (lines[lines.length - 1]?.length || 0) + 1,
      message: 'Unclosed block comment',
      severity: 'error',
    });
  }

  // Check for unclosed parentheses
  for (const loc of openParenLocations) {
    errors.push({
      startLineNumber: loc.line,
      startColumn: loc.col,
      endLineNumber: loc.line,
      endColumn: loc.col + 1,
      message: 'Unclosed parenthesis',
      severity: 'error',
    });
  }

  // Check for keyword typos (only if not in string or comment context)
  const wordPattern = /\b([A-Z_]\w*)\b/gi;
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const lineNumber = lineIdx + 1;

    // Remove comments and strings for typo detection
    let cleanLine = line;

    // Remove line comments
    const lineCommentIdx = cleanLine.indexOf('--');
    if (lineCommentIdx !== -1) {
      cleanLine = cleanLine.substring(0, lineCommentIdx);
    }

    // Simple approach: find words and check for typos
    let match: RegExpExecArray | null = wordPattern.exec(cleanLine);
    while (match) {
      const word = match[1].toUpperCase();
      const correction = SQL_TYPOS[word];

      if (correction) {
        const column = match.index + 1;
        errors.push({
          startLineNumber: lineNumber,
          startColumn: column,
          endLineNumber: lineNumber,
          endColumn: column + match[1].length,
          message: `Did you mean '${correction}'?`,
          severity: 'warning',
        });
      }
      match = wordPattern.exec(cleanLine);
    }
  }

  return errors;
}

/**
 * Creates a SQL hover provider that shows documentation for SQL keywords and functions.
 * When hovering over a keyword, displays syntax, description, and example from SQL_DOCS.
 *
 * Features:
 * - Case-insensitive keyword matching
 * - Supports compound keywords (e.g., "LEFT JOIN", "ORDER BY", "IS NOT NULL")
 * - Formatted markdown output with syntax highlighting
 */
export function createSqlHoverProvider(
  _monaco: typeof Monaco
): Monaco.languages.HoverProvider {
  return {
    provideHover: (model, position) => {
      const word = model.getWordAtPosition(position);
      if (!word) {
        return null;
      }

      const lineContent = model.getLineContent(position.lineNumber);
      const wordStart = word.startColumn - 1;
      const wordEnd = word.endColumn - 1;
      const upperWord = word.word.toUpperCase();

      // Try to match compound keywords by looking at surrounding words
      // Check for compound keywords that start with this word
      const compoundKeywords = [
        'ORDER BY',
        'GROUP BY',
        'INSERT INTO',
        'DELETE FROM',
        'CREATE TABLE',
        'DROP TABLE',
        'ALTER TABLE',
        'LEFT JOIN',
        'RIGHT JOIN',
        'INNER JOIN',
        'OUTER JOIN',
        'CROSS JOIN',
        'LEFT OUTER JOIN',
        'RIGHT OUTER JOIN',
        'FULL OUTER JOIN',
        'UNION ALL',
        'IS NULL',
        'IS NOT NULL',
        'PRIMARY KEY',
        'FOREIGN KEY',
      ];

      // Get text after the word to check for compound keywords
      const textAfterWord = lineContent.substring(wordEnd).trim();
      let matchedKeyword: string | null = null;
      let matchEndColumn = word.endColumn;

      // Check if current word starts a compound keyword
      for (const compound of compoundKeywords) {
        const parts = compound.split(' ');
        if (parts[0] === upperWord) {
          // Check if the following words match
          const remainingParts = parts.slice(1).join(' ');
          const regex = new RegExp(
            `^\\s*(${remainingParts.replace(/\s+/g, '\\s+')})`,
            'i'
          );
          const match = textAfterWord.match(regex);
          if (match) {
            // Found a compound keyword
            matchedKeyword = compound;
            matchEndColumn = word.endColumn + match[0].length;
            break;
          }
        }
      }

      // Also check if current word is the second part of a compound keyword
      if (!matchedKeyword) {
        const textBeforeWord = lineContent.substring(0, wordStart).trimEnd();
        for (const compound of compoundKeywords) {
          const parts = compound.split(' ');
          const lastPart = parts[parts.length - 1];
          if (lastPart === upperWord && parts.length >= 2) {
            // Check if preceding words match
            const precedingParts = parts.slice(0, -1);
            const precedingText = precedingParts.join('\\s+');
            const regex = new RegExp(`(${precedingText})\\s*$`, 'i');
            const match = textBeforeWord.match(regex);
            if (match) {
              matchedKeyword = compound;
              // Adjust the range to include the preceding words
              const startOffset = textBeforeWord.length - match[0].length;
              // We'll use a range that covers the full compound keyword
              return {
                contents: [formatHoverContent(compound)],
                range: {
                  startLineNumber: position.lineNumber,
                  startColumn: startOffset + 1,
                  endLineNumber: position.lineNumber,
                  endColumn: word.endColumn,
                },
              };
            }
          }
        }
      }

      // If we found a compound keyword, use it
      const lookupKey = matchedKeyword || upperWord;
      const docEntry = SQL_DOCS[lookupKey];

      if (!docEntry) {
        return null;
      }

      return {
        contents: [formatHoverContent(lookupKey)],
        range: {
          startLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endLineNumber: position.lineNumber,
          endColumn: matchedKeyword ? matchEndColumn : word.endColumn,
        },
      };
    },
  };
}

/**
 * Formats the hover content for a SQL keyword with markdown.
 */
function formatHoverContent(keyword: string): Monaco.IMarkdownString {
  const doc = SQL_DOCS[keyword];
  if (!doc) {
    return { value: '' };
  }

  const lines: string[] = [];

  // Keyword as header
  lines.push(`**${keyword}**`);
  lines.push('');

  // Syntax block
  lines.push('```sql');
  lines.push(doc.syntax);
  lines.push('```');
  lines.push('');

  // Description
  lines.push(doc.description);

  // Example if available
  if (doc.example) {
    lines.push('');
    lines.push('**Example:**');
    lines.push('```sql');
    lines.push(doc.example);
    lines.push('```');
  }

  return { value: lines.join('\n') };
}

/**
 * Creates a SQL validator that updates Monaco markers with debouncing.
 * This prevents excessive validation during active typing (300ms delay).
 *
 * Usage:
 * 1. Create validator: const validator = createSqlValidator(monaco)
 * 2. Call validate on model changes: validator.validate(model)
 * 3. Dispose when done: validator.dispose()
 *
 * @param monaco - The Monaco editor instance
 * @returns Object with validate and dispose methods
 */
export function createSqlValidator(monaco: typeof Monaco): {
  validate: (model: Monaco.editor.ITextModel) => void;
  dispose: () => void;
} {
  let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
  const DEBOUNCE_MS = 300;
  let lastModel: Monaco.editor.ITextModel | null = null;

  /**
   * Converts SqlValidationError severity to Monaco MarkerSeverity.
   */
  function toMarkerSeverity(
    severity: SqlValidationError['severity']
  ): Monaco.MarkerSeverity {
    switch (severity) {
      case 'error':
        return monaco.MarkerSeverity.Error;
      case 'warning':
        return monaco.MarkerSeverity.Warning;
      case 'info':
        return monaco.MarkerSeverity.Info;
      default:
        return monaco.MarkerSeverity.Error;
    }
  }

  /**
   * Performs the actual validation and sets markers.
   */
  function doValidate(model: Monaco.editor.ITextModel): void {
    const sql = model.getValue();
    const errors = validateSql(sql);

    // Convert to Monaco marker format
    const markers: Monaco.editor.IMarkerData[] = errors.map((error) => ({
      startLineNumber: error.startLineNumber,
      startColumn: error.startColumn,
      endLineNumber: error.endLineNumber,
      endColumn: error.endColumn,
      message: error.message,
      severity: toMarkerSeverity(error.severity),
    }));

    // Set markers on the model
    monaco.editor.setModelMarkers(model, 'sql-validation', markers);
  }

  /**
   * Validates the model with debouncing.
   */
  function validate(model: Monaco.editor.ITextModel): void {
    lastModel = model;

    // Clear any pending timeout
    if (debounceTimeout !== null) {
      clearTimeout(debounceTimeout);
    }

    // Schedule new validation
    debounceTimeout = setTimeout(() => {
      doValidate(model);
      debounceTimeout = null;
    }, DEBOUNCE_MS);
  }

  /**
   * Disposes the validator, clearing timeout and markers.
   */
  function dispose(): void {
    // Clear pending timeout
    if (debounceTimeout !== null) {
      clearTimeout(debounceTimeout);
      debounceTimeout = null;
    }

    // Clear markers from last model
    if (lastModel) {
      monaco.editor.setModelMarkers(lastModel, 'sql-validation', []);
      lastModel = null;
    }
  }

  return { validate, dispose };
}

/**
 * Creates a SQL completion provider that suggests SQL keywords, table names, and column names
 * from the connected database schema. (US1: Intelligent Autocomplete)
 *
 * Context-aware features:
 * - After typing "table." or "alias.", only suggests columns from that table
 * - After FROM/JOIN, suggests table names with higher priority
 * - In WHERE/SELECT with tables in scope, prioritizes in-scope columns
 * - Suggests appropriate keywords based on SQL context (SELECT, FROM, WHERE, etc.)
 * - Provides SQL functions with signatures and documentation
 * - Includes code snippets for common SQL patterns
 */
export function createSqlCompletionProvider(
  monaco: typeof Monaco,
  schema: DatabaseSchema | null
): Monaco.languages.CompletionItemProvider {
  return {
    triggerCharacters: ['.', ' '], // Trigger on dot and space
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      // Analyze SQL context
      const ctx = analyzeSqlContext(model, position);

      // Don't provide suggestions inside strings or comments
      if (ctx.inString || ctx.inComment) {
        return { suggestions: [] };
      }

      const suggestions: Monaco.languages.CompletionItem[] = [];

      // Case 1: Typing after "table." or "alias." - only show that table's columns
      if (ctx.dotPrefix && schema) {
        const targetTable = resolveTableFromPrefix(
          ctx.dotPrefix,
          ctx.tableRefs,
          schema
        );
        if (targetTable) {
          addTableColumnSuggestions(
            monaco,
            suggestions,
            targetTable,
            range,
            true
          );
          return { suggestions };
        }
      }

      // Case 2: Context-aware suggestions
      const contextKeywords = CONTEXT_KEYWORDS[ctx.context] || [];

      // Add context-specific keywords with highest priority
      contextKeywords.forEach((keyword, index) => {
        suggestions.push({
          label: keyword,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: keyword,
          filterText: keyword.toLowerCase(),
          range,
          sortText: `00_${String(index).padStart(3, '0')}_${keyword}`,
          detail: 'keyword',
        });
      });

      // Add SQL functions in appropriate contexts
      if (shouldSuggestFunctions(ctx.context)) {
        addFunctionSuggestions(monaco, suggestions, range, ctx.context);
      }

      // Add table names in FROM/JOIN contexts
      if (schema && shouldSuggestTables(ctx.context)) {
        addTableSuggestions(monaco, suggestions, schema, range, ctx.context);
      }

      // Add column suggestions based on context
      if (schema && shouldSuggestColumns(ctx.context)) {
        addColumnSuggestions(monaco, suggestions, schema, range, ctx);
      }

      // Add general SQL keywords
      addKeywordSuggestions(monaco, suggestions, range, ctx);

      // Add snippets in GENERAL context or at start of line
      if (ctx.context === 'GENERAL' || ctx.previousToken === null) {
        addSnippetSuggestions(monaco, suggestions, range);
      }

      return { suggestions };
    },
  };
}

/**
 * Determines if functions should be suggested in the current context.
 */
function shouldSuggestFunctions(context: SqlContext): boolean {
  return [
    'SELECT_COLUMNS',
    'WHERE_CONDITION',
    'HAVING',
    'ORDER_BY',
    'UPDATE_SET',
    'INSERT_VALUES',
    'GENERAL',
  ].includes(context);
}

/**
 * Determines if table names should be suggested in the current context.
 */
function shouldSuggestTables(context: SqlContext): boolean {
  return [
    'FROM_TABLE',
    'JOIN_TABLE',
    'INSERT_TABLE',
    'UPDATE_TABLE',
    'DELETE_TABLE',
    'GENERAL',
  ].includes(context);
}

/**
 * Determines if column names should be suggested in the current context.
 */
function shouldSuggestColumns(context: SqlContext): boolean {
  return [
    'SELECT_COLUMNS',
    'WHERE_CONDITION',
    'JOIN_CONDITION',
    'ORDER_BY',
    'GROUP_BY',
    'HAVING',
    'UPDATE_SET',
    'GENERAL',
  ].includes(context);
}

/**
 * Adds function suggestions with documentation.
 */
function addFunctionSuggestions(
  monaco: typeof Monaco,
  suggestions: Monaco.languages.CompletionItem[],
  range: Monaco.IRange,
  context: SqlContext
): void {
  // Prioritize aggregate functions in GROUP BY/HAVING context
  const isAggregateContext =
    context === 'HAVING' || context === 'SELECT_COLUMNS';

  SQL_FUNCTIONS.forEach((func) => {
    const isAggregate = func.category === 'aggregate';
    const priority = isAggregateContext && isAggregate ? '01' : '05';

    suggestions.push({
      label: func.name,
      kind: monaco.languages.CompletionItemKind.Function,
      insertText: `${func.name}($1)`,
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      detail: func.signature,
      documentation: {
        value: `**${func.name}**\n\n\`\`\`sql\n${func.signature}\n\`\`\`\n\n${func.description}\n\n*Category: ${func.category}*`,
      },
      filterText: func.name.toLowerCase(),
      range,
      sortText: `${priority}_${func.name}`,
    });
  });
}

/**
 * Adds table name suggestions with metadata.
 */
function addTableSuggestions(
  monaco: typeof Monaco,
  suggestions: Monaco.languages.CompletionItem[],
  schema: DatabaseSchema,
  range: Monaco.IRange,
  context: SqlContext
): void {
  const isTableContext = [
    'FROM_TABLE',
    'JOIN_TABLE',
    'INSERT_TABLE',
    'UPDATE_TABLE',
    'DELETE_TABLE',
  ].includes(context);
  const priority = isTableContext ? '01' : '03';

  schema.tables.forEach((table) => {
    const columnList = table.columns.map((c) => c.name).join(', ');
    const pkColumns = table.columns
      .filter((c) => c.isPrimaryKey)
      .map((c) => c.name);

    suggestions.push({
      label: table.name,
      kind: monaco.languages.CompletionItemKind.Class,
      insertText: table.name,
      detail: `Table (${table.columns.length} columns)`,
      documentation: {
        value: [
          `**${table.name}**`,
          '',
          `*Schema:* ${table.schema}`,
          '',
          `**Columns:** ${columnList}`,
          '',
          pkColumns.length > 0
            ? `**Primary Key:** ${pkColumns.join(', ')}`
            : '',
          '',
          table.rowCount !== undefined ? `*Row count:* ~${table.rowCount}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      },
      filterText: table.name.toLowerCase(),
      range,
      sortText: `${priority}_${table.name}`,
    });
  });

  // Add views
  schema.views.forEach((view) => {
    suggestions.push({
      label: view.name,
      kind: monaco.languages.CompletionItemKind.Interface,
      insertText: view.name,
      detail: 'View',
      documentation: {
        value: [
          `**${view.name}** (View)`,
          '',
          `*Schema:* ${view.schema}`,
          '',
          view.sql
            ? `\`\`\`sql\n${view.sql.substring(0, 200)}${view.sql.length > 200 ? '...' : ''}\n\`\`\``
            : '',
        ]
          .filter(Boolean)
          .join('\n'),
      },
      filterText: view.name.toLowerCase(),
      range,
      sortText: `${priority}_${view.name}`,
    });
  });
}

/**
 * Adds column suggestions based on context and scope.
 */
function addColumnSuggestions(
  monaco: typeof Monaco,
  suggestions: Monaco.languages.CompletionItem[],
  schema: DatabaseSchema,
  range: Monaco.IRange,
  ctx: SqlContextResult
): void {
  const tablesInScope = getTablesInScope(ctx.tableRefs, schema);
  const inScopeTableNames = new Set(
    tablesInScope.map((t) => t.name.toLowerCase())
  );
  const hasTablesInScope = tablesInScope.length > 0;

  // If we have tables in scope, prioritize their columns
  if (hasTablesInScope) {
    tablesInScope.forEach((table) => {
      addTableColumnSuggestions(monaco, suggestions, table, range, false, '01');
    });
  }

  // Add all table columns (lower priority if we have in-scope tables)
  schema.tables.forEach((table) => {
    const isInScope = inScopeTableNames.has(table.name.toLowerCase());
    if (!isInScope) {
      addTableColumnSuggestions(monaco, suggestions, table, range, false, '04');
    }
  });
}

/**
 * Adds column suggestions for a specific table.
 */
function addTableColumnSuggestions(
  monaco: typeof Monaco,
  suggestions: Monaco.languages.CompletionItem[],
  table: TableSchema,
  range: Monaco.IRange,
  unqualifiedOnly: boolean,
  priority: string = '01'
): void {
  table.columns.forEach((column, index) => {
    const typeInfo = column.type.toUpperCase();
    const nullableInfo = column.nullable ? 'NULL' : 'NOT NULL';
    const pkInfo = column.isPrimaryKey ? ' PRIMARY KEY' : '';
    const defaultInfo =
      column.defaultValue !== null ? ` DEFAULT ${column.defaultValue}` : '';

    // Unqualified column name
    suggestions.push({
      label: column.name,
      kind: monaco.languages.CompletionItemKind.Field,
      insertText: column.name,
      detail: `${table.name}.${typeInfo}`,
      documentation: {
        value: [
          `**${column.name}**`,
          '',
          `*Table:* ${table.name}`,
          `*Type:* ${typeInfo}`,
          `*Constraints:* ${nullableInfo}${pkInfo}${defaultInfo}`,
        ].join('\n'),
      },
      filterText: column.name.toLowerCase(),
      range,
      sortText: `${priority}_${String(index).padStart(3, '0')}_${column.name}`,
    });

    // Qualified column name (table.column) - skip if unqualifiedOnly
    if (!unqualifiedOnly) {
      const qualifiedName = `${table.name}.${column.name}`;
      suggestions.push({
        label: qualifiedName,
        kind: monaco.languages.CompletionItemKind.Field,
        insertText: qualifiedName,
        detail: typeInfo,
        documentation: {
          value: [
            `**${qualifiedName}**`,
            '',
            `*Type:* ${typeInfo}`,
            `*Constraints:* ${nullableInfo}${pkInfo}${defaultInfo}`,
          ].join('\n'),
        },
        filterText: qualifiedName.toLowerCase(),
        range,
        sortText: `${priority}_${String(index).padStart(3, '0')}_${qualifiedName}`,
      });
    }
  });
}

/**
 * Adds SQL keyword suggestions based on context.
 */
function addKeywordSuggestions(
  monaco: typeof Monaco,
  suggestions: Monaco.languages.CompletionItem[],
  range: Monaco.IRange,
  _ctx: SqlContextResult
): void {
  // Get context-specific keywords that haven't been added yet
  const addedLabels = new Set(
    suggestions.map((s) =>
      typeof s.label === 'string' ? s.label : s.label.label
    )
  );

  SQL_KEYWORDS.forEach((keyword) => {
    if (!addedLabels.has(keyword)) {
      suggestions.push({
        label: keyword,
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: keyword,
        filterText: keyword.toLowerCase(),
        range,
        sortText: `06_${keyword}`,
      });
    }
  });
}

/**
 * Adds SQL snippet suggestions.
 */
function addSnippetSuggestions(
  monaco: typeof Monaco,
  suggestions: Monaco.languages.CompletionItem[],
  range: Monaco.IRange
): void {
  SQL_SNIPPETS.forEach((snippet) => {
    suggestions.push({
      label: snippet.label,
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: snippet.insertText,
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      detail: `Snippet: ${snippet.category}`,
      documentation: {
        value: [
          `**${snippet.label}**`,
          '',
          snippet.description,
          '',
          '```sql',
          snippet.insertText.replace(/\$\{?\d+:?([^}]*)\}?/g, '$1'),
          '```',
        ].join('\n'),
      },
      range,
      sortText: `07_${snippet.label}`,
    });
  });
}

/**
 * Defines custom themes for Monaco Editor that match the application's light/dark theme.
 * (US2: Theme-Aware Editor, US3: SQL Syntax Highlighting)
 */
export function defineCustomThemes(monaco: typeof Monaco): void {
  // Light theme matching app colors
  monaco.editor.defineTheme('sql-pro-light', {
    base: 'vs',
    inherit: true,
    rules: [
      // SQL syntax highlighting (US3)
      { token: 'keyword', foreground: '0000FF', fontStyle: 'bold' },
      { token: 'keyword.sql', foreground: '0000FF', fontStyle: 'bold' },
      { token: 'string', foreground: 'A31515' },
      { token: 'string.sql', foreground: 'A31515' },
      { token: 'number', foreground: '098658' },
      { token: 'number.sql', foreground: '098658' },
      { token: 'comment', foreground: '008000', fontStyle: 'italic' },
      { token: 'comment.sql', foreground: '008000', fontStyle: 'italic' },
      { token: 'operator', foreground: '000000' },
      { token: 'operator.sql', foreground: '000000' },
      { token: 'identifier', foreground: '001080' },
    ],
    colors: {
      'editor.background': '#FFFFFF',
      'editor.foreground': '#000000',
      'editorLineNumber.foreground': '#6E7781',
      'editorLineNumber.activeForeground': '#000000',
      'editor.selectionBackground': '#ADD6FF',
      'editor.lineHighlightBackground': '#F5F5F5',
      'editorCursor.foreground': '#000000',
      'editor.inactiveSelectionBackground': '#E5EBF1',
      'editorSuggestWidget.background': '#FFFFFF',
      'editorSuggestWidget.border': '#E0E0E0',
      'editorSuggestWidget.selectedBackground': '#E8E8E8',
    },
  });

  // Dark theme matching app colors
  monaco.editor.defineTheme('sql-pro-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      // SQL syntax highlighting (US3)
      { token: 'keyword', foreground: '569CD6', fontStyle: 'bold' },
      { token: 'keyword.sql', foreground: '569CD6', fontStyle: 'bold' },
      { token: 'string', foreground: 'CE9178' },
      { token: 'string.sql', foreground: 'CE9178' },
      { token: 'number', foreground: 'B5CEA8' },
      { token: 'number.sql', foreground: 'B5CEA8' },
      { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
      { token: 'comment.sql', foreground: '6A9955', fontStyle: 'italic' },
      { token: 'operator', foreground: 'D4D4D4' },
      { token: 'operator.sql', foreground: 'D4D4D4' },
      { token: 'identifier', foreground: '9CDCFE' },
    ],
    colors: {
      'editor.background': '#1E1E1E',
      'editor.foreground': '#D4D4D4',
      'editorLineNumber.foreground': '#858585',
      'editorLineNumber.activeForeground': '#C6C6C6',
      'editor.selectionBackground': '#264F78',
      'editor.lineHighlightBackground': '#2A2A2A',
      'editorCursor.foreground': '#FFFFFF',
      'editor.inactiveSelectionBackground': '#3A3D41',
      'editorSuggestWidget.background': '#252526',
      'editorSuggestWidget.border': '#454545',
      'editorSuggestWidget.selectedBackground': '#04395E',
    },
  });
}

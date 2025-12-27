import type * as Monaco from 'monaco-editor';
import type { DatabaseSchema, TableSchema } from '@/types/database';

/**
 * Represents a table reference extracted from SQL query.
 * Maps alias (or table name if no alias) to the actual table name.
 */
interface TableReference {
  tableName: string;
  alias: string | null;
}

/**
 * Parses SQL text to extract table references from FROM and JOIN clauses.
 * Handles patterns like:
 * - FROM users
 * - FROM users u
 * - FROM users AS u
 * - JOIN orders o ON ...
 */
function parseTableReferences(sql: string): TableReference[] {
  const references: TableReference[] = [];
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
 * Gets the text before the cursor, checking for dot notation (table. or alias.)
 * Returns the prefix before the dot if found.
 */
function getDotPrefix(
  model: Monaco.editor.ITextModel,
  position: Monaco.Position
): string | null {
  const lineContent = model.getLineContent(position.lineNumber);
  const textBeforeCursor = lineContent.substring(0, position.column - 1);

  // Check for pattern: identifier. (cursor right after the dot)
  const dotMatch = textBeforeCursor.match(/(\w+)\.\s*$/);
  return dotMatch ? dotMatch[1] : null;
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
type SqlTokenType = 'keyword' | 'identifier' | 'string' | 'number' | 'operator' | 'comment' | 'whitespace' | 'punctuation';

interface SqlToken {
  type: SqlTokenType;
  value: string;
  original: string; // Original value before transformation
}

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
      const type = ['(', ')', ',', ';'].includes(char) ? 'punctuation' : 'operator';
      tokens.push({ type, value: char, original: char });
      i++;
      continue;
    }

    // Identifiers and keywords
    if (/[a-zA-Z_]/.test(char)) {
      let word = '';
      while (i < sql.length && /[a-zA-Z0-9_]/.test(sql[i])) {
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
  let currentLineLength = 0;
  const indent = '  '; // 2 spaces
  let parenDepth = 0;
  let isFirstToken = true;
  let prevToken: SqlToken | null = null;
  let prevNonWhitespaceToken: SqlToken | null = null;

  /**
   * Checks if a sequence of tokens forms a compound keyword.
   */
  function checkCompoundKeyword(startIndex: number): { keyword: string; length: number } | null {
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
        while (tokenIndex < tokens.length && tokens[tokenIndex].type === 'whitespace') {
          tokenIndex++;
        }
        if (tokenIndex >= tokens.length) {
          match = false;
          break;
        }
        if (tokens[tokenIndex].type !== 'keyword' || tokens[tokenIndex].value !== compound[j]) {
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
    currentLineLength = indentLevel * indent.length;
  }

  function addSpace(): void {
    if (result.length > 0 && result[result.length - 1] !== ' ' && result[result.length - 1] !== '\n' && !/^\s+$/.test(result[result.length - 1] || '')) {
      result.push(' ');
      currentLineLength++;
    }
  }

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];

    // Skip whitespace - we control spacing ourselves
    if (token.type === 'whitespace') {
      prevToken = token;
      i++;
      continue;
    }

    // Handle comments - preserve them with spacing
    if (token.type === 'comment') {
      if (!isFirstToken) {
        addSpace();
      }
      result.push(token.value);
      currentLineLength += token.value.length;
      if (token.value.startsWith('--')) {
        addNewLine();
      }
      prevToken = token;
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
        currentLineLength += upperKeyword.length;

        // Skip the tokens that make up the compound keyword
        i += compound.length;
        prevToken = token;
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
      currentLineLength += upperKeyword.length;
      prevToken = token;
      prevNonWhitespaceToken = token;
      i++;
      isFirstToken = false;
      continue;
    }

    // Handle punctuation
    if (token.type === 'punctuation') {
      if (token.value === '(') {
        parenDepth++;
        if (prevNonWhitespaceToken?.type === 'keyword' && ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COALESCE', 'IFNULL', 'NULLIF', 'CAST', 'SUBSTR', 'SUBSTRING', 'LENGTH', 'UPPER', 'LOWER', 'TRIM', 'REPLACE', 'INSTR', 'ROUND', 'ABS', 'RANDOM', 'DATE', 'TIME', 'DATETIME', 'STRFTIME', 'PRINTF', 'TYPEOF', 'EXISTS'].includes(prevNonWhitespaceToken.value)) {
          // No space before ( for function calls
        } else {
          addSpace();
        }
        result.push('(');
        currentLineLength++;
      } else if (token.value === ')') {
        parenDepth = Math.max(0, parenDepth - 1);
        result.push(')');
        currentLineLength++;
      } else if (token.value === ',') {
        result.push(',');
        currentLineLength++;
      } else if (token.value === ';') {
        result.push(';');
        currentLineLength++;
        // Add newline after semicolon for multi-statement queries
        if (i < tokens.length - 1) {
          addNewLine();
          addNewLine(); // Extra blank line between statements
        }
      } else if (token.value === '.') {
        // No space around dots (table.column)
        result.push('.');
        currentLineLength++;
      } else {
        if (!isFirstToken) {
          addSpace();
        }
        result.push(token.value);
        currentLineLength += token.value.length;
      }
      prevToken = token;
      prevNonWhitespaceToken = token;
      i++;
      isFirstToken = false;
      continue;
    }

    // Handle operators - add spaces around them
    if (token.type === 'operator') {
      addSpace();
      result.push(token.value);
      currentLineLength += token.value.length;
      addSpace();
      prevToken = token;
      prevNonWhitespaceToken = token;
      i++;
      isFirstToken = false;
      continue;
    }

    // Handle identifiers, strings, numbers
    if (!isFirstToken && prevNonWhitespaceToken?.value !== '.' && prevNonWhitespaceToken?.value !== '(' && prevNonWhitespaceToken?.type !== 'operator') {
      // No space after dot or opening paren or operator
      addSpace();
    }
    result.push(token.value);
    currentLineLength += token.value.length;
    prevToken = token;
    prevNonWhitespaceToken = token;
    i++;
    isFirstToken = false;
  }

  return result.join('').trim();
}

// SQL Keywords for autocomplete (US1)
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
 * Set of valid SQL keywords for quick lookup.
 */
const SQL_KEYWORDS_SET = new Set(SQL_KEYWORDS.map((k) => k.toUpperCase()));

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
    description: 'Retrieves data from one or more tables. Use DISTINCT to return only unique rows.',
    example: 'SELECT name, age FROM users WHERE age > 18',
  },
  FROM: {
    syntax: 'FROM table_name [alias]',
    description: 'Specifies the table(s) to query data from. Can include table aliases for readability.',
    example: 'SELECT * FROM users u',
  },
  WHERE: {
    syntax: 'WHERE condition',
    description: 'Filters rows based on a specified condition. Only rows where the condition is true are returned.',
    example: 'SELECT * FROM users WHERE status = \'active\'',
  },
  AND: {
    syntax: 'condition1 AND condition2',
    description: 'Combines multiple conditions. All conditions must be true for the row to be included.',
    example: 'WHERE age > 18 AND status = \'active\'',
  },
  OR: {
    syntax: 'condition1 OR condition2',
    description: 'Combines multiple conditions. At least one condition must be true for the row to be included.',
    example: 'WHERE status = \'active\' OR status = \'pending\'',
  },
  NOT: {
    syntax: 'NOT condition',
    description: 'Negates a condition. Returns true if the condition is false.',
    example: 'WHERE NOT status = \'inactive\'',
  },
  IN: {
    syntax: 'column IN (value1, value2, ...)',
    description: 'Checks if a value matches any value in a list or subquery.',
    example: 'WHERE status IN (\'active\', \'pending\')',
  },
  LIKE: {
    syntax: 'column LIKE pattern',
    description: 'Pattern matching with wildcards. Use % for any sequence, _ for single character.',
    example: 'WHERE name LIKE \'John%\'',
  },
  BETWEEN: {
    syntax: 'column BETWEEN value1 AND value2',
    description: 'Selects values within a given inclusive range.',
    example: 'WHERE age BETWEEN 18 AND 65',
  },
  AS: {
    syntax: 'expression AS alias',
    description: 'Creates an alias for a column or table to make results more readable.',
    example: 'SELECT name AS user_name FROM users AS u',
  },
  DISTINCT: {
    syntax: 'SELECT DISTINCT column1, column2, ...',
    description: 'Returns only unique rows, removing duplicates from the result set.',
    example: 'SELECT DISTINCT status FROM users',
  },

  // JOIN Keywords
  JOIN: {
    syntax: 'table1 JOIN table2 ON condition',
    description: 'Combines rows from two tables based on a related column. Same as INNER JOIN.',
    example: 'SELECT * FROM users JOIN orders ON users.id = orders.user_id',
  },
  'INNER JOIN': {
    syntax: 'table1 INNER JOIN table2 ON condition',
    description: 'Returns rows that have matching values in both tables.',
    example: 'SELECT * FROM users INNER JOIN orders ON users.id = orders.user_id',
  },
  'LEFT JOIN': {
    syntax: 'table1 LEFT JOIN table2 ON condition',
    description: 'Returns all rows from the left table, and matching rows from the right table. NULL for non-matches.',
    example: 'SELECT * FROM users LEFT JOIN orders ON users.id = orders.user_id',
  },
  'RIGHT JOIN': {
    syntax: 'table1 RIGHT JOIN table2 ON condition',
    description: 'Returns all rows from the right table, and matching rows from the left table. NULL for non-matches.',
    example: 'SELECT * FROM orders RIGHT JOIN users ON users.id = orders.user_id',
  },
  'OUTER JOIN': {
    syntax: 'table1 OUTER JOIN table2 ON condition',
    description: 'Returns all rows when there is a match in either table.',
    example: 'SELECT * FROM users FULL OUTER JOIN orders ON users.id = orders.user_id',
  },
  'CROSS JOIN': {
    syntax: 'table1 CROSS JOIN table2',
    description: 'Returns the Cartesian product of both tables (all possible combinations).',
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
    description: 'Sorts the result set by one or more columns. ASC for ascending (default), DESC for descending.',
    example: 'SELECT * FROM users ORDER BY name ASC, age DESC',
  },
  'GROUP BY': {
    syntax: 'GROUP BY column1, column2, ...',
    description: 'Groups rows with the same values. Often used with aggregate functions.',
    example: 'SELECT status, COUNT(*) FROM users GROUP BY status',
  },
  HAVING: {
    syntax: 'HAVING condition',
    description: 'Filters groups based on aggregate conditions. Used after GROUP BY.',
    example: 'SELECT status, COUNT(*) FROM users GROUP BY status HAVING COUNT(*) > 5',
  },
  LIMIT: {
    syntax: 'LIMIT count [OFFSET offset]',
    description: 'Restricts the number of rows returned by the query.',
    example: 'SELECT * FROM users LIMIT 10',
  },
  OFFSET: {
    syntax: 'OFFSET number',
    description: 'Skips the specified number of rows before returning results. Used with LIMIT for pagination.',
    example: 'SELECT * FROM users LIMIT 10 OFFSET 20',
  },

  // Aggregate Functions
  COUNT: {
    syntax: 'COUNT(expression) or COUNT(*)',
    description: 'Returns the number of rows. COUNT(*) counts all rows, COUNT(column) counts non-NULL values.',
    example: 'SELECT COUNT(*) FROM users',
  },
  SUM: {
    syntax: 'SUM(expression)',
    description: 'Returns the sum of all values in a numeric column. NULL values are ignored.',
    example: 'SELECT SUM(amount) FROM orders',
  },
  AVG: {
    syntax: 'AVG(expression)',
    description: 'Returns the average value of a numeric column. NULL values are ignored.',
    example: 'SELECT AVG(price) FROM products',
  },
  MIN: {
    syntax: 'MIN(expression)',
    description: 'Returns the minimum value in a column. Works with numbers, strings, and dates.',
    example: 'SELECT MIN(price) FROM products',
  },
  MAX: {
    syntax: 'MAX(expression)',
    description: 'Returns the maximum value in a column. Works with numbers, strings, and dates.',
    example: 'SELECT MAX(created_at) FROM orders',
  },

  // Set Operations
  UNION: {
    syntax: 'query1 UNION query2',
    description: 'Combines results of two queries, removing duplicates. Both queries must have the same columns.',
    example: 'SELECT name FROM customers UNION SELECT name FROM employees',
  },
  'UNION ALL': {
    syntax: 'query1 UNION ALL query2',
    description: 'Combines results of two queries, keeping all duplicates.',
    example: 'SELECT name FROM customers UNION ALL SELECT name FROM employees',
  },
  EXCEPT: {
    syntax: 'query1 EXCEPT query2',
    description: 'Returns rows from the first query that are not in the second query.',
    example: 'SELECT name FROM all_users EXCEPT SELECT name FROM banned_users',
  },
  INTERSECT: {
    syntax: 'query1 INTERSECT query2',
    description: 'Returns only rows that appear in both queries.',
    example: 'SELECT name FROM customers INTERSECT SELECT name FROM newsletter_subscribers',
  },

  // Data Modification
  'INSERT INTO': {
    syntax: 'INSERT INTO table (col1, col2, ...) VALUES (val1, val2, ...)',
    description: 'Inserts new rows into a table.',
    example: 'INSERT INTO users (name, email) VALUES (\'John\', \'john@example.com\')',
  },
  VALUES: {
    syntax: 'VALUES (value1, value2, ...)',
    description: 'Specifies the values to insert into a table.',
    example: 'INSERT INTO users (name) VALUES (\'John\'), (\'Jane\')',
  },
  UPDATE: {
    syntax: 'UPDATE table SET col1 = val1, col2 = val2, ... [WHERE condition]',
    description: 'Modifies existing rows in a table. Use WHERE to specify which rows to update.',
    example: 'UPDATE users SET status = \'active\' WHERE id = 1',
  },
  SET: {
    syntax: 'SET column1 = value1, column2 = value2, ...',
    description: 'Specifies the columns and values to update.',
    example: 'UPDATE users SET name = \'John\', age = 30 WHERE id = 1',
  },
  'DELETE FROM': {
    syntax: 'DELETE FROM table [WHERE condition]',
    description: 'Removes rows from a table. Use WHERE to specify which rows to delete.',
    example: 'DELETE FROM users WHERE status = \'inactive\'',
  },

  // Table Operations
  'CREATE TABLE': {
    syntax: 'CREATE TABLE table_name (column1 type1, column2 type2, ...)',
    description: 'Creates a new table with the specified columns and data types.',
    example: 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL)',
  },
  'DROP TABLE': {
    syntax: 'DROP TABLE [IF EXISTS] table_name',
    description: 'Removes a table and all its data from the database.',
    example: 'DROP TABLE IF EXISTS temp_users',
  },
  'ALTER TABLE': {
    syntax: 'ALTER TABLE table_name action',
    description: 'Modifies an existing table structure (add/drop columns, rename, etc.).',
    example: 'ALTER TABLE users ADD COLUMN email TEXT',
  },

  // Constraints
  'PRIMARY KEY': {
    syntax: 'column_name type PRIMARY KEY',
    description: 'Uniquely identifies each row in a table. Cannot contain NULL values.',
    example: 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)',
  },
  'FOREIGN KEY': {
    syntax: 'FOREIGN KEY (column) REFERENCES other_table(column)',
    description: 'Creates a link between tables by referencing a primary key in another table.',
    example: 'FOREIGN KEY (user_id) REFERENCES users(id)',
  },
  UNIQUE: {
    syntax: 'column_name type UNIQUE',
    description: 'Ensures all values in a column are different.',
    example: 'CREATE TABLE users (id INTEGER, email TEXT UNIQUE)',
  },
  DEFAULT: {
    syntax: 'column_name type DEFAULT value',
    description: 'Sets a default value for a column when no value is specified.',
    example: 'CREATE TABLE users (status TEXT DEFAULT \'active\')',
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
    description: 'Specifies the table and column that a foreign key references.',
    example: 'user_id INTEGER REFERENCES users(id)',
  },
  CASCADE: {
    syntax: 'ON DELETE CASCADE / ON UPDATE CASCADE',
    description: 'Automatically propagates changes from parent to child tables.',
    example: 'FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE',
  },
  INDEX: {
    syntax: 'CREATE INDEX index_name ON table(column)',
    description: 'Creates an index to speed up queries on the specified column(s).',
    example: 'CREATE INDEX idx_user_email ON users(email)',
  },

  // Conditional Expressions
  CASE: {
    syntax: 'CASE WHEN condition THEN result [ELSE default] END',
    description: 'Conditional expression that returns different values based on conditions.',
    example: 'SELECT CASE WHEN age < 18 THEN \'minor\' ELSE \'adult\' END FROM users',
  },
  WHEN: {
    syntax: 'WHEN condition THEN result',
    description: 'Specifies a condition and result within a CASE expression.',
    example: 'CASE WHEN status = \'A\' THEN \'Active\' WHEN status = \'I\' THEN \'Inactive\' END',
  },
  THEN: {
    syntax: 'WHEN condition THEN result',
    description: 'Specifies the value to return when the preceding WHEN condition is true.',
    example: 'CASE WHEN age >= 18 THEN \'adult\' END',
  },
  ELSE: {
    syntax: 'ELSE default_value',
    description: 'Specifies the default value in a CASE expression when no WHEN condition matches.',
    example: 'CASE WHEN status = \'A\' THEN \'Active\' ELSE \'Unknown\' END',
  },
  END: {
    syntax: 'CASE ... END',
    description: 'Marks the end of a CASE expression.',
    example: 'SELECT CASE WHEN x > 0 THEN \'positive\' END FROM numbers',
  },
  EXISTS: {
    syntax: 'EXISTS (subquery)',
    description: 'Tests whether a subquery returns any rows. Returns true if at least one row exists.',
    example: 'SELECT * FROM users WHERE EXISTS (SELECT 1 FROM orders WHERE orders.user_id = users.id)',
  },
  NULL: {
    syntax: 'NULL',
    description: 'Represents a missing or unknown value. Use IS NULL or IS NOT NULL to check.',
    example: 'SELECT * FROM users WHERE email IS NULL',
  },
  'IS NULL': {
    syntax: 'column IS NULL',
    description: 'Tests if a value is NULL. Regular = comparison does not work with NULL.',
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
    description: 'Starts a new transaction. Changes are not committed until COMMIT.',
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
    description: 'A sequence of operations performed as a single logical unit of work.',
    example: 'BEGIN TRANSACTION; UPDATE accounts SET balance = balance - 100; COMMIT;',
  },
  SAVEPOINT: {
    syntax: 'SAVEPOINT savepoint_name',
    description: 'Creates a point within a transaction to which you can later roll back.',
    example: 'SAVEPOINT my_savepoint',
  },
  RELEASE: {
    syntax: 'RELEASE SAVEPOINT savepoint_name',
    description: 'Removes a savepoint, making it no longer available for rollback.',
    example: 'RELEASE SAVEPOINT my_savepoint',
  },

  // SQLite-specific Commands
  PRAGMA: {
    syntax: 'PRAGMA pragma_name [= value]',
    description: 'SQLite-specific command to query or modify database settings and metadata.',
    example: 'PRAGMA table_info(users)',
  },
  VACUUM: {
    syntax: 'VACUUM',
    description: 'Rebuilds the database file, reclaiming unused space and defragmenting.',
    example: 'VACUUM',
  },
  ATTACH: {
    syntax: 'ATTACH DATABASE filename AS schema_name',
    description: 'Attaches another database file to the current connection.',
    example: 'ATTACH DATABASE \'archive.db\' AS archive',
  },
  DETACH: {
    syntax: 'DETACH DATABASE schema_name',
    description: 'Detaches a previously attached database from the current connection.',
    example: 'DETACH DATABASE archive',
  },
  EXPLAIN: {
    syntax: 'EXPLAIN [QUERY PLAN] statement',
    description: 'Shows how SQLite will execute a query. QUERY PLAN shows the high-level strategy.',
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
  let openParenLocations: Array<{ line: number; col: number }> = [];
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
      if (!inSingleQuote && !inDoubleQuote && !inLineComment && char === '/' && nextChar === '*') {
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
      if (!inSingleQuote && !inDoubleQuote && char === '-' && nextChar === '-') {
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
  const wordPattern = /\b([A-Za-z_][A-Za-z0-9_]*)\b/g;
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
    let match: RegExpExecArray | null;
    while ((match = wordPattern.exec(cleanLine)) !== null) {
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
  monaco: typeof Monaco
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
          const regex = new RegExp(`^\\s*(${remainingParts.replace(/\s+/g, '\\s+')})`, 'i');
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
 * - After FROM/JOIN, suggests table names
 * - In WHERE/SELECT with tables in scope, prioritizes in-scope columns
 */
export function createSqlCompletionProvider(
  monaco: typeof Monaco,
  schema: DatabaseSchema | null
): Monaco.languages.CompletionItemProvider {
  return {
    triggerCharacters: ['.'], // Trigger on dot for table.column
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const suggestions: Monaco.languages.CompletionItem[] = [];
      const fullText = model.getValue();
      const tableRefs = parseTableReferences(fullText);
      const dotPrefix = getDotPrefix(model, position);

      // Case 1: Typing after "table." or "alias." - only show that table's columns
      if (dotPrefix && schema) {
        const targetTable = resolveTableFromPrefix(
          dotPrefix,
          tableRefs,
          schema
        );
        if (targetTable) {
          targetTable.columns.forEach((column) => {
            suggestions.push({
              label: column.name,
              kind: monaco.languages.CompletionItemKind.Field,
              detail: column.type,
              documentation: `${column.nullable ? 'NULL' : 'NOT NULL'}${column.isPrimaryKey ? ' PRIMARY KEY' : ''}`,
              insertText: column.name,
              filterText: column.name.toLowerCase(),
              range,
              sortText: `0_${column.name}`, // Highest priority
            });
          });
          return { suggestions };
        }
      }

      // Case 2: Normal suggestions with context awareness

      // SQL Keywords (always available)
      SQL_KEYWORDS.forEach((keyword) => {
        suggestions.push({
          label: keyword,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: keyword,
          filterText: keyword.toLowerCase(),
          range,
          sortText: `2_${keyword}`,
        });
      });

      if (schema) {
        const tablesInScope = getTablesInScope(tableRefs, schema);
        const inScopeTableNames = new Set(
          tablesInScope.map((t) => t.name.toLowerCase())
        );

        // Table names
        schema.tables.forEach((table) => {
          suggestions.push({
            label: table.name,
            kind: monaco.languages.CompletionItemKind.Class,
            detail: `Table (${table.columns.length} columns)`,
            documentation: `Columns: ${table.columns.map((c) => c.name).join(', ')}`,
            insertText: table.name,
            filterText: table.name.toLowerCase(),
            range,
            sortText: `3_${table.name}`,
          });
        });

        // Column suggestions - prioritize in-scope tables (context-aware)
        schema.tables.forEach((table) => {
          const isInScope = inScopeTableNames.has(table.name.toLowerCase());
          const priority = isInScope ? '0_' : '4_'; // In-scope columns at the very top

          table.columns.forEach((column) => {
            // Unqualified column name (prioritized for in-scope tables)
            suggestions.push({
              label: column.name,
              kind: monaco.languages.CompletionItemKind.Field,
              detail: `${table.name}.${column.type}`,
              documentation: `From table: ${table.name}${isInScope ? ' (in scope)' : ''}`,
              insertText: column.name,
              filterText: column.name.toLowerCase(),
              range,
              sortText: priority + column.name,
            });

            // Qualified column name (table.column)
            const qualifiedName = `${table.name}.${column.name}`;
            suggestions.push({
              label: qualifiedName,
              kind: monaco.languages.CompletionItemKind.Field,
              detail: column.type,
              documentation: `${column.nullable ? 'NULL' : 'NOT NULL'}${column.isPrimaryKey ? ' PRIMARY KEY' : ''}`,
              insertText: qualifiedName,
              filterText: qualifiedName.toLowerCase(),
              range,
              sortText: priority + qualifiedName,
            });
          });
        });

        // View names
        schema.views.forEach((view) => {
          suggestions.push({
            label: view.name,
            kind: monaco.languages.CompletionItemKind.Interface,
            detail: 'View',
            documentation: view.sql
              ? `SQL: ${view.sql.substring(0, 100)}...`
              : undefined,
            insertText: view.name,
            filterText: view.name.toLowerCase(),
            range,
            sortText: `3_${view.name}`,
          });
        });
      }

      return { suggestions };
    },
  };
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

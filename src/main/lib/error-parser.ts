/**
 * Error parsing and enhancement utilities for SQLite error messages.
 * Parses error messages from better-sqlite3 and enhances them with:
 * - Error codes for categorization
 * - Position information (line/column) for syntax errors
 * - Actionable suggestions for common issues
 * - Documentation URLs for complex errors
 * - Troubleshooting steps for connection errors
 */

import type {
  EnhancedErrorInfo,
  ErrorCode,
  ErrorPosition,
} from '../../shared/types';

/**
 * Documentation URLs for different error categories.
 */
const ERROR_DOCUMENTATION: Record<ErrorCode, string> = {
  SQL_SYNTAX_ERROR: 'https://www.sqlite.org/lang.html',
  SQL_CONSTRAINT_ERROR:
    'https://www.sqlite.org/lang_createtable.html#constraints',
  TABLE_NOT_FOUND: 'https://www.sqlite.org/lang_select.html',
  COLUMN_NOT_FOUND: 'https://www.sqlite.org/lang_select.html',
  CONSTRAINT_VIOLATION:
    'https://www.sqlite.org/lang_createtable.html#constraints',
  TYPE_MISMATCH: 'https://www.sqlite.org/datatype3.html',
  CONNECTION_ERROR: 'https://www.sqlite.org/c3ref/open.html',
  ENCRYPTION_ERROR: 'https://www.zetetic.net/sqlcipher/sqlcipher-api/',
  PERMISSION_ERROR: 'https://www.sqlite.org/c3ref/open.html',
  FILE_NOT_FOUND: 'https://www.sqlite.org/c3ref/open.html',
  QUERY_EXECUTION_ERROR: 'https://www.sqlite.org/lang.html',
  UNKNOWN_ERROR: 'https://www.sqlite.org/rescode.html',
};

/**
 * Patterns to detect different types of SQLite errors.
 */
interface ErrorPattern {
  pattern: RegExp;
  code: ErrorCode;
  getSuggestions: (match: RegExpMatchArray, errorMessage: string) => string[];
}

const ERROR_PATTERNS: ErrorPattern[] = [
  // Syntax errors with position information
  {
    pattern: /near "([^"]+)": syntax error/i,
    code: 'SQL_SYNTAX_ERROR',
    getSuggestions: (match) => {
      const nearToken = match[1];
      return [
        `Check the syntax near "${nearToken}"`,
        'Verify all keywords are spelled correctly',
        'Ensure proper use of quotes and parentheses',
      ];
    },
  },
  // Incomplete input
  {
    pattern: /incomplete input/i,
    code: 'SQL_SYNTAX_ERROR',
    getSuggestions: () => [
      'Check for missing closing parentheses or quotes',
      'Ensure the statement ends with a semicolon',
      'Verify all clauses are complete',
    ],
  },
  // Unrecognized token
  {
    pattern: /unrecognized token: "([^"]+)"/i,
    code: 'SQL_SYNTAX_ERROR',
    getSuggestions: (match) => {
      const token = match[1];
      return [
        `Remove or fix the unrecognized token "${token}"`,
        'Check for special characters that need escaping',
        'Verify string literals use single quotes, not double quotes',
      ];
    },
  },
  // No such table
  {
    pattern: /no such table: (\S+)/i,
    code: 'SQL_SYNTAX_ERROR',
    getSuggestions: (match) => {
      const tableName = match[1];
      return [
        `Verify the table "${tableName}" exists`,
        'Check for typos in the table name',
        'Ensure you are connected to the correct database',
      ];
    },
  },
  // No such column
  {
    pattern: /no such column: (\S+)/i,
    code: 'SQL_SYNTAX_ERROR',
    getSuggestions: (match) => {
      const columnName = match[1];
      return [
        `Verify the column "${columnName}" exists in the table`,
        'Check for typos in the column name',
        'Use the schema view to check available columns',
      ];
    },
  },
  // Ambiguous column name
  {
    pattern: /ambiguous column name: (\S+)/i,
    code: 'SQL_SYNTAX_ERROR',
    getSuggestions: (match) => {
      const columnName = match[1];
      return [
        `Prefix "${columnName}" with the table name (e.g., table.${columnName})`,
        'Use table aliases to disambiguate columns',
        'Check if the column exists in multiple joined tables',
      ];
    },
  },
  // UNIQUE constraint failed
  {
    pattern: /UNIQUE constraint failed: (\S+)/i,
    code: 'SQL_CONSTRAINT_ERROR',
    getSuggestions: (match) => {
      const constraint = match[1];
      return [
        `A row with this value already exists for "${constraint}"`,
        'Use INSERT OR REPLACE to update existing rows',
        'Use INSERT OR IGNORE to skip duplicate entries',
      ];
    },
  },
  // NOT NULL constraint failed
  {
    pattern: /NOT NULL constraint failed: (\S+)/i,
    code: 'SQL_CONSTRAINT_ERROR',
    getSuggestions: (match) => {
      const column = match[1];
      return [
        `Provide a value for the required column "${column}"`,
        'Check if a default value should be set for this column',
        'Verify all required fields are included in your INSERT/UPDATE',
      ];
    },
  },
  // FOREIGN KEY constraint failed
  {
    pattern: /FOREIGN KEY constraint failed/i,
    code: 'SQL_CONSTRAINT_ERROR',
    getSuggestions: () => [
      'Ensure the referenced record exists in the parent table',
      'Check that foreign key values match parent primary key values',
      'Consider using ON DELETE CASCADE if appropriate',
    ],
  },
  // CHECK constraint failed
  {
    pattern: /CHECK constraint failed: (\S+)/i,
    code: 'SQL_CONSTRAINT_ERROR',
    getSuggestions: (match) => {
      const constraint = match[1];
      return [
        `The value violates the CHECK constraint "${constraint}"`,
        'Review the constraint definition in the table schema',
        'Ensure the value meets all validation requirements',
      ];
    },
  },
  // PRIMARY KEY constraint
  {
    pattern: /PRIMARY KEY constraint failed/i,
    code: 'SQL_CONSTRAINT_ERROR',
    getSuggestions: () => [
      'The primary key value already exists',
      'Use a unique value for the primary key column',
      'Consider using an auto-increment primary key',
    ],
  },
  // File not found / cannot open
  {
    pattern: /unable to open database file/i,
    code: 'FILE_NOT_FOUND',
    getSuggestions: () => [
      'Verify the file path is correct',
      'Check if the file exists at the specified location',
      'Ensure the directory exists and is accessible',
    ],
  },
  // Permission denied
  {
    pattern:
      /(?:permission denied|readonly database|attempt to write a readonly database)/i,
    code: 'PERMISSION_ERROR',
    getSuggestions: () => [
      'Check file permissions for the database file',
      'Ensure the application has write access to the directory',
      'Try opening the database in read-only mode',
    ],
  },
  // Encryption errors
  {
    pattern: /file is not a database/i,
    code: 'ENCRYPTION_ERROR',
    getSuggestions: () => [
      'The database may be encrypted - provide a password',
      'Verify the encryption key is correct',
      'Check if the file is a valid SQLite database',
    ],
  },
  // Database is locked
  {
    pattern: /database is locked/i,
    code: 'CONNECTION_ERROR',
    getSuggestions: () => [
      'Another process may be using the database',
      'Close other applications that might be accessing this file',
      'Wait a moment and try again',
    ],
  },
  // Disk I/O error
  {
    pattern: /disk I\/O error/i,
    code: 'CONNECTION_ERROR',
    getSuggestions: () => [
      'Check if the disk has sufficient free space',
      'Verify the disk is not failing or corrupted',
      'Try copying the database to a different location',
    ],
  },
  // Database is corrupt
  {
    pattern: /database disk image is malformed/i,
    code: 'CONNECTION_ERROR',
    getSuggestions: () => [
      'The database file may be corrupted',
      'Try running PRAGMA integrity_check',
      'Restore from a backup if available',
    ],
  },
  // Table already exists
  {
    pattern: /table (\S+) already exists/i,
    code: 'SQL_SYNTAX_ERROR',
    getSuggestions: (match) => {
      const tableName = match[1];
      return [
        `Table "${tableName}" already exists`,
        'Use CREATE TABLE IF NOT EXISTS to avoid this error',
        'Drop the existing table first if you want to recreate it',
      ];
    },
  },
  // Misuse of aggregate function
  {
    pattern: /misuse of aggregate:? (\S+)?/i,
    code: 'SQL_SYNTAX_ERROR',
    getSuggestions: (match) => {
      const func = match[1] || 'aggregate';
      return [
        `Aggregate function "${func}" used incorrectly`,
        'Add a GROUP BY clause when using aggregate functions with other columns',
        'Ensure all non-aggregate columns are in the GROUP BY clause',
      ];
    },
  },
  // Result with too many rows
  {
    pattern: /more than one row returned by a subquery/i,
    code: 'QUERY_EXECUTION_ERROR',
    getSuggestions: () => [
      'The subquery returned multiple rows where only one was expected',
      'Add LIMIT 1 to the subquery if only one row is needed',
      'Use IN or EXISTS instead of = for multi-row comparisons',
    ],
  },
];

/**
 * Troubleshooting steps for different error categories.
 */
const TROUBLESHOOTING_STEPS: Partial<Record<ErrorCode, string[]>> = {
  FILE_NOT_FOUND: [
    'Verify the database file path is correct',
    'Check if the file was moved or renamed',
    'Ensure the file extension is correct (.db, .sqlite, .sqlite3)',
    'Try browsing to select the file using the file picker',
  ],
  PERMISSION_ERROR: [
    'Check file permissions (read/write access)',
    'Ensure the parent directory is writable',
    'Try running the application with elevated permissions',
    'Check if the file is locked by another application',
    'Try opening in read-only mode if write access is not needed',
  ],
  ENCRYPTION_ERROR: [
    'Verify the encryption password is correct',
    'Try different cipher configurations (SQLCipher 3 vs 4)',
    'Check if the database was created with a different encryption tool',
    'Verify the file is actually an encrypted SQLite database',
    'Contact the database creator for the correct password/cipher settings',
  ],
  CONNECTION_ERROR: [
    'Close other applications that might be using the database',
    'Check if the disk has sufficient free space',
    'Verify the database file is not corrupted',
    'Try restarting the application',
    'Check system resources (memory, file handles)',
  ],
};

/**
 * Parses a SQLite error message and extracts position information.
 * SQLite error messages sometimes include position like "at position N" or line info.
 */
export function parseErrorPosition(
  errorMessage: string,
  query?: string
): ErrorPosition | undefined {
  // Pattern: "at position N" or "at offset N"
  const positionMatch = errorMessage.match(/at (?:position|offset) (\d+)/i);
  if (positionMatch && query) {
    const offset = Number.parseInt(positionMatch[1], 10);
    return offsetToLineColumn(query, offset);
  }

  // Pattern: "near line N column M" or "line N, column M"
  const lineColMatch = errorMessage.match(
    /(?:near )?line\s*(\d+)[\s,]+column\s*(\d+)/i
  );
  if (lineColMatch) {
    return {
      line: Number.parseInt(lineColMatch[1], 10),
      column: Number.parseInt(lineColMatch[2], 10),
    };
  }

  // For "near X" errors, try to find the position of X in the query
  const nearMatch = errorMessage.match(/near "([^"]+)"/i);
  if (nearMatch && query) {
    const token = nearMatch[1];
    const tokenIndex = query.toUpperCase().indexOf(token.toUpperCase());
    if (tokenIndex !== -1) {
      return offsetToLineColumn(query, tokenIndex);
    }
  }

  return undefined;
}

/**
 * Converts a character offset to line/column position in a query string.
 */
export function offsetToLineColumn(
  query: string,
  offset: number
): ErrorPosition {
  let line = 1;
  let column = 1;

  for (let i = 0; i < Math.min(offset, query.length); i++) {
    if (query[i] === '\n') {
      line++;
      column = 1;
    } else {
      column++;
    }
  }

  return { line, column };
}

/**
 * Determines the error code from a SQLite error message.
 */
export function getErrorCode(errorMessage: string): ErrorCode {
  for (const errorPattern of ERROR_PATTERNS) {
    if (errorPattern.pattern.test(errorMessage)) {
      return errorPattern.code;
    }
  }
  return 'UNKNOWN_ERROR';
}

/**
 * Gets suggestions for fixing an error based on the error message.
 */
export function getSuggestions(errorMessage: string): string[] {
  for (const errorPattern of ERROR_PATTERNS) {
    const match = errorMessage.match(errorPattern.pattern);
    if (match) {
      return errorPattern.getSuggestions(match, errorMessage);
    }
  }

  // Default suggestions for unknown errors
  return [
    'Review the SQL syntax carefully',
    'Check the SQLite documentation for correct usage',
    'Verify all table and column names are correct',
  ];
}

/**
 * Gets the documentation URL for an error code.
 */
export function getDocumentationUrl(errorCode: ErrorCode): string {
  return ERROR_DOCUMENTATION[errorCode] || ERROR_DOCUMENTATION.UNKNOWN_ERROR;
}

/**
 * Gets troubleshooting steps for connection-related errors.
 */
export function getTroubleshootingSteps(
  errorCode: ErrorCode
): string[] | undefined {
  return TROUBLESHOOTING_STEPS[errorCode];
}

/**
 * Parses and enhances an error message with additional context.
 * This is the main entry point for error enhancement.
 *
 * @param errorMessage - The original error message from SQLite
 * @param query - Optional SQL query that caused the error (for position detection)
 * @returns Enhanced error information with code, suggestions, and documentation
 */
export function parseAndEnhanceError(
  errorMessage: string,
  query?: string
): EnhancedErrorInfo {
  const errorCode = getErrorCode(errorMessage);
  const suggestions = getSuggestions(errorMessage);
  const documentationUrl = getDocumentationUrl(errorCode);
  const troubleshootingSteps = getTroubleshootingSteps(errorCode);
  const errorPosition = parseErrorPosition(errorMessage, query);

  return {
    error: errorMessage,
    errorCode,
    errorPosition,
    suggestions,
    documentationUrl,
    troubleshootingSteps,
  };
}

/**
 * Enhances a query execution error with position and suggestions.
 * Specifically designed for errors that occur during query execution.
 */
export function enhanceQueryError(
  errorMessage: string,
  query: string
): EnhancedErrorInfo {
  return parseAndEnhanceError(errorMessage, query);
}

/**
 * Enhances a connection error with troubleshooting steps.
 * Specifically designed for errors that occur during database connection.
 */
export function enhanceConnectionError(
  errorMessage: string
): EnhancedErrorInfo {
  const enhanced = parseAndEnhanceError(errorMessage);

  // For connection errors, ensure we have troubleshooting steps
  if (!enhanced.troubleshootingSteps) {
    enhanced.troubleshootingSteps = [
      'Verify the database file path is correct',
      'Check file permissions and accessibility',
      'Ensure no other process is locking the file',
    ];
  }

  return enhanced;
}

/**
 * Determines if an error message suggests the database needs a password.
 */
export function needsPassword(errorMessage: string): boolean {
  const encryptionPatterns = [
    /file is not a database/i,
    /encrypted/i,
    /not a database or encrypted/i,
  ];

  return encryptionPatterns.some((pattern) => pattern.test(errorMessage));
}

/**
 * Truncates an error message to a maximum length while preserving context.
 * Adds ellipsis if truncated.
 */
export function truncateErrorMessage(
  message: string,
  maxLength: number = 200
): string {
  if (message.length <= maxLength) {
    return message;
  }

  // Truncate and add ellipsis
  const truncated = message.slice(0, maxLength - 3);
  return `${truncated}...`;
}

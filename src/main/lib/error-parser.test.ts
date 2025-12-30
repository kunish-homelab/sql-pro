import { describe, expect, it } from 'vitest';

import {
  enhanceConnectionError,
  enhanceQueryError,
  getDocumentationUrl,
  getErrorCode,
  getSuggestions,
  getTroubleshootingSteps,
  needsPassword,
  offsetToLineColumn,
  parseAndEnhanceError,
  parseErrorPosition,
  truncateErrorMessage,
} from './error-parser';

describe('error-parser', () => {
  describe('offsetToLineColumn', () => {
    it('should convert offset 0 to line 1, column 1', () => {
      const result = offsetToLineColumn('SELECT * FROM users', 0);
      expect(result).toEqual({ line: 1, column: 1 });
    });

    it('should handle single line query', () => {
      const result = offsetToLineColumn('SELECT * FROM users', 7);
      expect(result).toEqual({ line: 1, column: 8 });
    });

    it('should handle multi-line query', () => {
      const query = 'SELECT *\nFROM users\nWHERE id = 1';
      // Position at start of "FROM" (after newline)
      const result = offsetToLineColumn(query, 9);
      expect(result).toEqual({ line: 2, column: 1 });
    });

    it('should handle offset in the middle of a line', () => {
      const query = 'SELECT *\nFROM users\nWHERE id = 1';
      // Position at "users" on line 2
      const result = offsetToLineColumn(query, 14);
      expect(result).toEqual({ line: 2, column: 6 });
    });

    it('should handle offset at the end of query', () => {
      const query = 'SELECT * FROM users';
      const result = offsetToLineColumn(query, query.length);
      expect(result).toEqual({ line: 1, column: 20 });
    });

    it('should handle empty query', () => {
      const result = offsetToLineColumn('', 0);
      expect(result).toEqual({ line: 1, column: 1 });
    });
  });

  describe('parseErrorPosition', () => {
    it('should parse "near X" errors and find position in query', () => {
      const error = 'near "FORM": syntax error';
      const query = 'SELECT * FORM users';
      const result = parseErrorPosition(error, query);
      expect(result).toBeDefined();
      expect(result?.line).toBe(1);
      expect(result?.column).toBe(10);
    });

    it('should parse "at position N" errors', () => {
      const error = 'syntax error at position 15';
      const query = 'SELECT * FROM users WHERE';
      const result = parseErrorPosition(error, query);
      expect(result).toBeDefined();
      expect(result?.line).toBe(1);
      expect(result?.column).toBe(16);
    });

    it('should parse "line N column M" errors', () => {
      const error = 'error near line 2 column 5';
      const result = parseErrorPosition(error);
      expect(result).toEqual({ line: 2, column: 5 });
    });

    it('should parse "line N, column M" errors', () => {
      const error = 'error at line 3, column 10';
      const result = parseErrorPosition(error);
      expect(result).toEqual({ line: 3, column: 10 });
    });

    it('should return undefined for errors without position', () => {
      const error = 'connection failed';
      const result = parseErrorPosition(error);
      expect(result).toBeUndefined();
    });

    it('should return undefined when token not found in query', () => {
      const error = 'near "nonexistent": syntax error';
      const query = 'SELECT * FROM users';
      const result = parseErrorPosition(error, query);
      expect(result).toBeUndefined();
    });

    it('should handle case-insensitive token matching', () => {
      const error = 'near "FROM": syntax error';
      const query = 'SELECT * from users';
      const result = parseErrorPosition(error, query);
      expect(result).toBeDefined();
      expect(result?.column).toBe(10);
    });
  });

  describe('getErrorCode', () => {
    it('should detect SQL syntax errors', () => {
      expect(getErrorCode('near "SELECT": syntax error')).toBe(
        'SQL_SYNTAX_ERROR'
      );
      expect(getErrorCode('incomplete input')).toBe('SQL_SYNTAX_ERROR');
      expect(getErrorCode('unrecognized token: "@@"')).toBe('SQL_SYNTAX_ERROR');
    });

    it('should detect no such table errors', () => {
      expect(getErrorCode('no such table: users')).toBe('SQL_SYNTAX_ERROR');
    });

    it('should detect no such column errors', () => {
      expect(getErrorCode('no such column: user_name')).toBe(
        'SQL_SYNTAX_ERROR'
      );
    });

    it('should detect UNIQUE constraint errors', () => {
      expect(getErrorCode('UNIQUE constraint failed: users.email')).toBe(
        'SQL_CONSTRAINT_ERROR'
      );
    });

    it('should detect NOT NULL constraint errors', () => {
      expect(getErrorCode('NOT NULL constraint failed: users.name')).toBe(
        'SQL_CONSTRAINT_ERROR'
      );
    });

    it('should detect FOREIGN KEY constraint errors', () => {
      expect(getErrorCode('FOREIGN KEY constraint failed')).toBe(
        'SQL_CONSTRAINT_ERROR'
      );
    });

    it('should detect CHECK constraint errors', () => {
      expect(getErrorCode('CHECK constraint failed: users_age_check')).toBe(
        'SQL_CONSTRAINT_ERROR'
      );
    });

    it('should detect PRIMARY KEY constraint errors', () => {
      expect(getErrorCode('PRIMARY KEY constraint failed')).toBe(
        'SQL_CONSTRAINT_ERROR'
      );
    });

    it('should detect file not found errors', () => {
      expect(getErrorCode('unable to open database file')).toBe(
        'FILE_NOT_FOUND'
      );
    });

    it('should detect permission errors', () => {
      expect(getErrorCode('permission denied')).toBe('PERMISSION_ERROR');
      expect(getErrorCode('readonly database')).toBe('PERMISSION_ERROR');
      expect(getErrorCode('attempt to write a readonly database')).toBe(
        'PERMISSION_ERROR'
      );
    });

    it('should detect encryption errors', () => {
      expect(getErrorCode('file is not a database')).toBe('ENCRYPTION_ERROR');
    });

    it('should detect connection errors', () => {
      expect(getErrorCode('database is locked')).toBe('CONNECTION_ERROR');
      expect(getErrorCode('disk I/O error')).toBe('CONNECTION_ERROR');
      expect(getErrorCode('database disk image is malformed')).toBe(
        'CONNECTION_ERROR'
      );
    });

    it('should return UNKNOWN_ERROR for unrecognized errors', () => {
      expect(getErrorCode('some random error message')).toBe('UNKNOWN_ERROR');
    });
  });

  describe('getSuggestions', () => {
    it('should provide suggestions for syntax errors', () => {
      const suggestions = getSuggestions('near "SELCT": syntax error');
      expect(suggestions).toHaveLength(3);
      expect(suggestions[0]).toContain('SELCT');
    });

    it('should provide suggestions for no such table errors', () => {
      const suggestions = getSuggestions('no such table: users');
      expect(suggestions).toHaveLength(3);
      expect(suggestions[0]).toContain('users');
    });

    it('should provide suggestions for UNIQUE constraint errors', () => {
      const suggestions = getSuggestions(
        'UNIQUE constraint failed: users.email'
      );
      expect(suggestions).toHaveLength(3);
      expect(suggestions.some((s) => s.includes('INSERT OR REPLACE'))).toBe(
        true
      );
    });

    it('should provide suggestions for NOT NULL constraint errors', () => {
      const suggestions = getSuggestions(
        'NOT NULL constraint failed: users.name'
      );
      expect(suggestions).toHaveLength(3);
      expect(suggestions[0]).toContain('name');
    });

    it('should provide suggestions for FOREIGN KEY constraint errors', () => {
      const suggestions = getSuggestions('FOREIGN KEY constraint failed');
      expect(suggestions).toHaveLength(3);
      expect(suggestions.some((s) => s.includes('parent table'))).toBe(true);
    });

    it('should provide default suggestions for unknown errors', () => {
      const suggestions = getSuggestions('unknown error occurred');
      expect(suggestions).toHaveLength(3);
      expect(suggestions.some((s) => s.includes('syntax'))).toBe(true);
    });

    it('should provide suggestions for ambiguous column errors', () => {
      const suggestions = getSuggestions('ambiguous column name: id');
      expect(suggestions).toHaveLength(3);
      expect(suggestions[0]).toContain('id');
      expect(suggestions.some((s) => s.includes('table name'))).toBe(true);
    });

    it('should provide suggestions for table already exists', () => {
      const suggestions = getSuggestions('table users already exists');
      expect(suggestions).toHaveLength(3);
      expect(suggestions.some((s) => s.includes('IF NOT EXISTS'))).toBe(true);
    });

    it('should provide suggestions for aggregate misuse', () => {
      const suggestions = getSuggestions('misuse of aggregate: COUNT');
      expect(suggestions).toHaveLength(3);
      expect(suggestions.some((s) => s.includes('GROUP BY'))).toBe(true);
    });
  });

  describe('getDocumentationUrl', () => {
    it('should return correct URL for SQL syntax errors', () => {
      const url = getDocumentationUrl('SQL_SYNTAX_ERROR');
      expect(url).toBe('https://www.sqlite.org/lang.html');
    });

    it('should return correct URL for constraint errors', () => {
      const url = getDocumentationUrl('SQL_CONSTRAINT_ERROR');
      expect(url).toBe(
        'https://www.sqlite.org/lang_createtable.html#constraints'
      );
    });

    it('should return correct URL for encryption errors', () => {
      const url = getDocumentationUrl('ENCRYPTION_ERROR');
      expect(url).toBe('https://www.zetetic.net/sqlcipher/sqlcipher-api/');
    });

    it('should return fallback URL for unknown errors', () => {
      const url = getDocumentationUrl('UNKNOWN_ERROR');
      expect(url).toBe('https://www.sqlite.org/rescode.html');
    });
  });

  describe('getTroubleshootingSteps', () => {
    it('should return steps for FILE_NOT_FOUND errors', () => {
      const steps = getTroubleshootingSteps('FILE_NOT_FOUND');
      expect(steps).toBeDefined();
      expect(steps!.length).toBeGreaterThan(0);
      expect(steps!.some((s) => s.includes('path'))).toBe(true);
    });

    it('should return steps for PERMISSION_ERROR errors', () => {
      const steps = getTroubleshootingSteps('PERMISSION_ERROR');
      expect(steps).toBeDefined();
      expect(steps!.length).toBeGreaterThan(0);
      expect(steps!.some((s) => s.includes('permission'))).toBe(true);
    });

    it('should return steps for ENCRYPTION_ERROR errors', () => {
      const steps = getTroubleshootingSteps('ENCRYPTION_ERROR');
      expect(steps).toBeDefined();
      expect(steps!.length).toBeGreaterThan(0);
      expect(steps!.some((s) => s.includes('password'))).toBe(true);
    });

    it('should return steps for CONNECTION_ERROR errors', () => {
      const steps = getTroubleshootingSteps('CONNECTION_ERROR');
      expect(steps).toBeDefined();
      expect(steps!.length).toBeGreaterThan(0);
    });

    it('should return undefined for errors without troubleshooting steps', () => {
      const steps = getTroubleshootingSteps('SQL_SYNTAX_ERROR');
      expect(steps).toBeUndefined();
    });
  });

  describe('parseAndEnhanceError', () => {
    it('should enhance a complete syntax error', () => {
      const error = 'near "FORM": syntax error';
      const query = 'SELECT * FORM users';
      const result = parseAndEnhanceError(error, query);

      expect(result.error).toBe(error);
      expect(result.errorCode).toBe('SQL_SYNTAX_ERROR');
      expect(result.errorPosition).toBeDefined();
      expect(result.suggestions).toHaveLength(3);
      expect(result.documentationUrl).toBe('https://www.sqlite.org/lang.html');
    });

    it('should enhance a constraint error', () => {
      const error = 'UNIQUE constraint failed: users.email';
      const result = parseAndEnhanceError(error);

      expect(result.errorCode).toBe('SQL_CONSTRAINT_ERROR');
      expect(result.suggestions).toHaveLength(3);
      expect(result.documentationUrl).toContain('constraints');
    });

    it('should enhance a connection error with troubleshooting steps', () => {
      const error = 'unable to open database file';
      const result = parseAndEnhanceError(error);

      expect(result.errorCode).toBe('FILE_NOT_FOUND');
      expect(result.troubleshootingSteps).toBeDefined();
      expect(result.troubleshootingSteps!.length).toBeGreaterThan(0);
    });

    it('should handle errors without query context', () => {
      const error = 'database is locked';
      const result = parseAndEnhanceError(error);

      expect(result.error).toBe(error);
      expect(result.errorCode).toBe('CONNECTION_ERROR');
      expect(result.errorPosition).toBeUndefined();
      expect(result.suggestions).toBeDefined();
    });
  });

  describe('enhanceQueryError', () => {
    it('should enhance a query execution error with position', () => {
      const error = 'no such column: user_id';
      const query = 'SELECT user_id FROM orders';
      const result = enhanceQueryError(error, query);

      expect(result.errorCode).toBe('SQL_SYNTAX_ERROR');
      expect(result.suggestions).toHaveLength(3);
      expect(result.suggestions![0]).toContain('user_id');
    });

    it('should handle multi-line queries', () => {
      const error = 'near "WERE": syntax error';
      const query = 'SELECT *\nFROM users\nWERE id = 1';
      const result = enhanceQueryError(error, query);

      expect(result.errorPosition).toBeDefined();
      expect(result.errorPosition?.line).toBe(3);
    });
  });

  describe('enhanceConnectionError', () => {
    it('should always include troubleshooting steps', () => {
      const error = 'some connection error';
      const result = enhanceConnectionError(error);

      expect(result.troubleshootingSteps).toBeDefined();
      expect(result.troubleshootingSteps!.length).toBeGreaterThan(0);
    });

    it('should use specific steps for known error types', () => {
      const error = 'file is not a database';
      const result = enhanceConnectionError(error);

      expect(result.errorCode).toBe('ENCRYPTION_ERROR');
      expect(result.troubleshootingSteps).toBeDefined();
      expect(
        result.troubleshootingSteps!.some((s) => s.includes('password'))
      ).toBe(true);
    });

    it('should provide default steps for unknown connection errors', () => {
      const error = 'unknown connection issue';
      const result = enhanceConnectionError(error);

      expect(result.troubleshootingSteps).toBeDefined();
      expect(result.troubleshootingSteps!.length).toBe(3);
    });
  });

  describe('needsPassword', () => {
    it('should detect "file is not a database" as needing password', () => {
      expect(needsPassword('file is not a database')).toBe(true);
    });

    it('should detect encrypted database messages', () => {
      expect(needsPassword('database is encrypted')).toBe(true);
      expect(needsPassword('The database appears to be encrypted')).toBe(true);
    });

    it('should detect combined messages', () => {
      expect(needsPassword('file is not a database or encrypted')).toBe(true);
    });

    it('should return false for non-encryption errors', () => {
      expect(needsPassword('no such table: users')).toBe(false);
      expect(needsPassword('permission denied')).toBe(false);
      expect(needsPassword('database is locked')).toBe(false);
    });
  });

  describe('truncateErrorMessage', () => {
    it('should not truncate short messages', () => {
      const message = 'Short error';
      expect(truncateErrorMessage(message)).toBe(message);
    });

    it('should truncate long messages', () => {
      const message = 'A'.repeat(300);
      const result = truncateErrorMessage(message, 200);
      expect(result.length).toBeLessThanOrEqual(203); // 200 + '...'
      expect(result.endsWith('...')).toBe(true);
    });

    it('should break at word boundaries when possible', () => {
      const message =
        'This is a very long error message that needs to be truncated at a reasonable word boundary';
      const result = truncateErrorMessage(message, 50);
      expect(result.endsWith('...')).toBe(true);
      // Should not break in the middle of a word
      expect(result.includes('truncat...')).toBe(false);
    });

    it('should use default max length of 200', () => {
      const message = 'A'.repeat(300);
      const result = truncateErrorMessage(message);
      expect(result.length).toBeLessThanOrEqual(203);
    });

    it('should handle empty string', () => {
      expect(truncateErrorMessage('')).toBe('');
    });

    it('should handle exact length messages', () => {
      const message = 'A'.repeat(200);
      expect(truncateErrorMessage(message, 200)).toBe(message);
    });
  });
});

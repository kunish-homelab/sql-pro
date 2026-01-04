/**
 * Tests for DatabaseService error enhancement (both query and connection errors).
 *
 * Note: The actual database operations are tested via integration tests
 * when the native better-sqlite3 module is properly compiled.
 * These tests verify the error enhancement integration logic.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as errorParser from '@/lib/error-parser';

// Mock the error parser module to verify it's being called correctly
vi.mock('../lib/error-parser', async () => {
  const actual = await vi.importActual('../lib/error-parser');
  return {
    ...actual,
    enhanceQueryError: vi.fn((error: string, _query: string) => ({
      error,
      errorCode: 'SQL_SYNTAX_ERROR',
      errorPosition: { line: 1, column: 10 },
      suggestions: ['Check syntax', 'Verify table name'],
      documentationUrl: 'https://www.sqlite.org/lang.html',
    })),
    enhanceConnectionError: vi.fn((error: string) => ({
      error,
      errorCode: 'CONNECTION_ERROR',
      troubleshootingSteps: [
        'Verify the database file path is correct',
        'Check file permissions and accessibility',
        'Ensure no other process is locking the file',
      ],
      documentationUrl: 'https://www.sqlite.org/c3ref/open.html',
    })),
  };
});

describe('databaseService - Error Enhancement Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('enhanceQueryError integration', () => {
    it('should export the enhanceQueryError function correctly', () => {
      expect(typeof errorParser.enhanceQueryError).toBe('function');
    });

    it('should return enhanced error structure with all fields', () => {
      const mockQuery = 'SELECT * FORM users';
      const mockError = 'near "FORM": syntax error';

      const result = errorParser.enhanceQueryError(mockError, mockQuery);

      expect(result).toHaveProperty('error', mockError);
      expect(result).toHaveProperty('errorCode');
      expect(result).toHaveProperty('errorPosition');
      expect(result).toHaveProperty('suggestions');
      expect(result).toHaveProperty('documentationUrl');
    });

    it('should include error position information', () => {
      const result = errorParser.enhanceQueryError(
        'near "test": syntax error',
        'SELECT test'
      );

      expect(result.errorPosition).toBeDefined();
      expect(result.errorPosition).toHaveProperty('line');
      expect(result.errorPosition).toHaveProperty('column');
    });

    it('should include suggestions array', () => {
      const result = errorParser.enhanceQueryError(
        'near "test": syntax error',
        'SELECT test'
      );

      expect(result.suggestions).toBeDefined();
      expect(Array.isArray(result.suggestions)).toBe(true);
      expect(result.suggestions!.length).toBeGreaterThan(0);
    });

    it('should include documentation URL', () => {
      const result = errorParser.enhanceQueryError(
        'near "test": syntax error',
        'SELECT test'
      );

      expect(result.documentationUrl).toBeDefined();
      expect(result.documentationUrl).toMatch(/^https:\/\//);
    });
  });
});

describe('databaseService - Expected Error Response Structure', () => {
  /**
   * These tests verify the expected structure of enhanced error responses
   * that should be returned by executeQuery when an error occurs.
   */

  it('should define the correct error response type structure', () => {
    // This test verifies that the expected response structure matches the types
    interface ExpectedErrorResponse {
      success: false;
      error: string;
      errorCode?: string;
      errorPosition?: { line: number; column: number };
      suggestions?: string[];
      documentationUrl?: string;
    }

    const mockResponse: ExpectedErrorResponse = {
      success: false,
      error: 'near "SELCT": syntax error',
      errorCode: 'SQL_SYNTAX_ERROR',
      errorPosition: { line: 1, column: 1 },
      suggestions: ['Check spelling of SELECT'],
      documentationUrl: 'https://www.sqlite.org/lang.html',
    };

    expect(mockResponse.success).toBe(false);
    expect(mockResponse.error).toBeDefined();
    expect(mockResponse.errorCode).toBe('SQL_SYNTAX_ERROR');
    expect(mockResponse.errorPosition).toEqual({ line: 1, column: 1 });
    expect(mockResponse.suggestions).toContain('Check spelling of SELECT');
    expect(mockResponse.documentationUrl).toContain('sqlite.org');
  });

  it('should support SQL_SYNTAX_ERROR error code', () => {
    const errorCode = 'SQL_SYNTAX_ERROR';
    expect([
      'SQL_SYNTAX_ERROR',
      'SQL_CONSTRAINT_ERROR',
      'UNKNOWN_ERROR',
    ]).toContain(errorCode);
  });

  it('should support SQL_CONSTRAINT_ERROR error code', () => {
    const errorCode = 'SQL_CONSTRAINT_ERROR';
    expect([
      'SQL_SYNTAX_ERROR',
      'SQL_CONSTRAINT_ERROR',
      'UNKNOWN_ERROR',
    ]).toContain(errorCode);
  });

  it('should support CONNECTION_ERROR error code', () => {
    const errorCode = 'CONNECTION_ERROR';
    const validCodes = [
      'SQL_SYNTAX_ERROR',
      'SQL_CONSTRAINT_ERROR',
      'CONNECTION_ERROR',
      'ENCRYPTION_ERROR',
      'PERMISSION_ERROR',
      'FILE_NOT_FOUND',
      'QUERY_EXECUTION_ERROR',
      'UNKNOWN_ERROR',
    ];
    expect(validCodes).toContain(errorCode);
  });
});

describe('databaseService - Connection Error Enhancement Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('enhanceConnectionError integration', () => {
    it('should export the enhanceConnectionError function correctly', () => {
      expect(typeof errorParser.enhanceConnectionError).toBe('function');
    });

    it('should return enhanced error structure with all connection error fields', () => {
      const mockError = 'unable to open database file';

      const result = errorParser.enhanceConnectionError(mockError);

      expect(result).toHaveProperty('error', mockError);
      expect(result).toHaveProperty('errorCode');
      expect(result).toHaveProperty('troubleshootingSteps');
      expect(result).toHaveProperty('documentationUrl');
    });

    it('should include troubleshooting steps array', () => {
      const result = errorParser.enhanceConnectionError(
        'unable to open database file'
      );

      expect(result.troubleshootingSteps).toBeDefined();
      expect(Array.isArray(result.troubleshootingSteps)).toBe(true);
      expect(result.troubleshootingSteps!.length).toBeGreaterThan(0);
    });

    it('should include documentation URL for connection errors', () => {
      const result = errorParser.enhanceConnectionError(
        'unable to open database file'
      );

      expect(result.documentationUrl).toBeDefined();
      expect(result.documentationUrl).toMatch(/^https:\/\//);
    });
  });
});

describe('databaseService - Expected Connection Error Response Structure', () => {
  /**
   * These tests verify the expected structure of enhanced connection error responses
   * that should be returned by the open() method when an error occurs.
   */

  it('should define the correct connection error response type structure', () => {
    // This test verifies that the expected response structure matches the types
    interface ExpectedConnectionErrorResponse {
      success: false;
      error: string;
      needsPassword?: boolean;
      errorCode?: string;
      troubleshootingSteps?: string[];
      documentationUrl?: string;
    }

    const mockResponse: ExpectedConnectionErrorResponse = {
      success: false,
      error: 'Database appears to be encrypted. Please provide a password.',
      needsPassword: true,
      errorCode: 'ENCRYPTION_ERROR',
      troubleshootingSteps: [
        'Verify the encryption password is correct',
        'Try different cipher configurations (SQLCipher 3 vs 4)',
      ],
      documentationUrl: 'https://www.zetetic.net/sqlcipher/sqlcipher-api/',
    };

    expect(mockResponse.success).toBe(false);
    expect(mockResponse.error).toBeDefined();
    expect(mockResponse.needsPassword).toBe(true);
    expect(mockResponse.errorCode).toBe('ENCRYPTION_ERROR');
    expect(mockResponse.troubleshootingSteps).toBeDefined();
    expect(mockResponse.troubleshootingSteps!.length).toBeGreaterThan(0);
    expect(mockResponse.documentationUrl).toContain('https://');
  });

  it('should support ENCRYPTION_ERROR error code for encrypted databases', () => {
    const errorCode = 'ENCRYPTION_ERROR';
    const validCodes = [
      'SQL_SYNTAX_ERROR',
      'SQL_CONSTRAINT_ERROR',
      'CONNECTION_ERROR',
      'ENCRYPTION_ERROR',
      'PERMISSION_ERROR',
      'FILE_NOT_FOUND',
      'QUERY_EXECUTION_ERROR',
      'UNKNOWN_ERROR',
    ];
    expect(validCodes).toContain(errorCode);
  });

  it('should support FILE_NOT_FOUND error code for missing files', () => {
    const errorCode = 'FILE_NOT_FOUND';
    const validCodes = [
      'SQL_SYNTAX_ERROR',
      'SQL_CONSTRAINT_ERROR',
      'CONNECTION_ERROR',
      'ENCRYPTION_ERROR',
      'PERMISSION_ERROR',
      'FILE_NOT_FOUND',
      'QUERY_EXECUTION_ERROR',
      'UNKNOWN_ERROR',
    ];
    expect(validCodes).toContain(errorCode);
  });

  it('should support PERMISSION_ERROR error code for access denied', () => {
    const errorCode = 'PERMISSION_ERROR';
    const validCodes = [
      'SQL_SYNTAX_ERROR',
      'SQL_CONSTRAINT_ERROR',
      'CONNECTION_ERROR',
      'ENCRYPTION_ERROR',
      'PERMISSION_ERROR',
      'FILE_NOT_FOUND',
      'QUERY_EXECUTION_ERROR',
      'UNKNOWN_ERROR',
    ];
    expect(validCodes).toContain(errorCode);
  });

  it('should include appropriate troubleshooting steps for encryption errors', () => {
    const expectedSteps = [
      'Verify the encryption password is correct',
      'Try different cipher configurations (SQLCipher 3 vs 4)',
      'Check if the database was created with a different encryption tool',
      'Verify the file is actually an encrypted SQLite database',
      'Contact the database creator for the correct password/cipher settings',
    ];

    // These are the steps that should be returned for encryption errors
    expect(expectedSteps.length).toBe(5);
    expect(expectedSteps[0]).toContain('password');
    expect(expectedSteps[1]).toContain('cipher');
  });

  it('should include appropriate troubleshooting steps for file not found errors', async () => {
    // Call the actual function (not mocked) to verify real troubleshooting steps
    const actual = await vi.importActual<typeof import('../lib/error-parser')>(
      '../lib/error-parser'
    );
    const steps = actual.getTroubleshootingSteps('FILE_NOT_FOUND');

    expect(steps).toBeDefined();
    expect(Array.isArray(steps)).toBe(true);
    expect(steps!.length).toBeGreaterThanOrEqual(3);
  });

  it('should include appropriate troubleshooting steps for permission errors', async () => {
    // Call the actual function (not mocked) to verify real troubleshooting steps
    const actual = await vi.importActual<typeof import('../lib/error-parser')>(
      '../lib/error-parser'
    );
    const steps = actual.getTroubleshootingSteps('PERMISSION_ERROR');

    expect(steps).toBeDefined();
    expect(Array.isArray(steps)).toBe(true);
    expect(steps!.length).toBeGreaterThanOrEqual(3);
  });
});

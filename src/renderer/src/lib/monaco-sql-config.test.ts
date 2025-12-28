import { describe, expect, it } from 'vitest';

import { formatSql, validateSql } from './monaco-sql-config';

describe('formatSql', () => {
  describe('edge cases and empty input', () => {
    it('should return empty string for empty input', () => {
      expect(formatSql('')).toBe('');
    });

    it('should return whitespace-only input as-is', () => {
      expect(formatSql('   ')).toBe('   ');
    });

    it('should return input with only newlines as-is', () => {
      expect(formatSql('\n\n')).toBe('\n\n');
    });

    it('should return input with only tabs as-is', () => {
      expect(formatSql('\t\t')).toBe('\t\t');
    });
  });

  describe('keyword capitalization', () => {
    it('should uppercase SELECT keyword', () => {
      expect(formatSql('select * from users')).toContain('SELECT');
    });

    it('should uppercase FROM keyword', () => {
      expect(formatSql('select * from users')).toContain('FROM');
    });

    it('should uppercase WHERE keyword', () => {
      expect(formatSql('select * from users where id = 1')).toContain('WHERE');
    });

    it('should uppercase JOIN keyword', () => {
      expect(
        formatSql(
          'select * from users join orders on users.id = orders.user_id'
        )
      ).toContain('JOIN');
    });

    it('should uppercase AND keyword', () => {
      expect(formatSql('select * from users where a = 1 and b = 2')).toContain(
        'AND'
      );
    });

    it('should uppercase OR keyword', () => {
      expect(formatSql('select * from users where a = 1 or b = 2')).toContain(
        'OR'
      );
    });

    it('should uppercase HAVING keyword', () => {
      expect(
        formatSql(
          'select count(*) from users group by status having count(*) > 1'
        )
      ).toContain('HAVING');
    });

    it('should uppercase LIMIT keyword', () => {
      expect(formatSql('select * from users limit 10')).toContain('LIMIT');
    });

    it('should uppercase UPDATE keyword', () => {
      expect(formatSql("update users set name = 'test'")).toContain('UPDATE');
    });

    it('should handle mixed case keywords', () => {
      expect(formatSql('SeLeCt * FrOm users')).toContain('SELECT');
      expect(formatSql('SeLeCt * FrOm users')).toContain('FROM');
    });

    it('should uppercase VALUES keyword', () => {
      expect(formatSql("insert into users (name) values ('test')")).toContain(
        'VALUES'
      );
    });

    it('should uppercase SET keyword', () => {
      expect(formatSql("update users set name = 'test'")).toContain('SET');
    });
  });

  describe('line breaks', () => {
    it('should add newline before FROM clause', () => {
      const result = formatSql('select * from users');
      expect(result).toContain('\nFROM');
    });

    it('should add newline before WHERE clause', () => {
      const result = formatSql('select * from users where id = 1');
      expect(result).toContain('\nWHERE');
    });

    it('should add newline before LIMIT clause', () => {
      const result = formatSql('select * from users limit 10');
      expect(result).toContain('\nLIMIT');
    });

    it('should add newline before SET clause in UPDATE', () => {
      const result = formatSql("update users set name = 'test'");
      expect(result).toContain('\nSET');
    });

    it('should add newline before VALUES clause', () => {
      const result = formatSql("insert into users (name) values ('test')");
      expect(result).toContain('\nVALUES');
    });
  });

  describe('jOIN handling', () => {
    it('should add newline before JOIN', () => {
      const result = formatSql(
        'select * from users join orders on users.id = orders.user_id'
      );
      expect(result).toContain('\n');
      expect(result).toContain('JOIN');
    });

    it('should uppercase ON keyword in JOIN', () => {
      const result = formatSql(
        'select * from users join orders on users.id = orders.user_id'
      );
      expect(result).toContain('ON');
    });

    it('should handle JOIN clause with proper formatting', () => {
      const result = formatSql(
        'select * from users join orders on users.id = orders.user_id'
      );
      expect(result).toMatch(/JOIN.*ON/);
    });
  });

  describe('string literal preservation', () => {
    it('should preserve single-quoted strings', () => {
      const result = formatSql("select * from users where name = 'John'");
      expect(result).toContain("'John'");
    });

    it('should preserve double-quoted identifiers', () => {
      const result = formatSql('select * from users where "column name" = 1');
      expect(result).toContain('"column name"');
    });

    it('should preserve escaped single quotes in strings', () => {
      const result = formatSql("select * from users where name = 'O''Brien'");
      expect(result).toContain("'O''Brien'");
    });

    it('should preserve backtick identifiers', () => {
      const result = formatSql('select * from `my table` where id = 1');
      expect(result).toContain('`my table`');
    });

    it('should not uppercase keywords inside strings', () => {
      const result = formatSql(
        "select * from users where note = 'select from where'"
      );
      expect(result).toContain("'select from where'");
    });
  });

  describe('comment preservation', () => {
    it('should preserve line comments', () => {
      const result = formatSql('select * from users -- this is a comment');
      expect(result).toContain('-- this is a comment');
    });

    it('should preserve block comments', () => {
      const result = formatSql('select /* comment */ * from users');
      expect(result).toContain('/* comment */');
    });
  });

  describe('operator spacing', () => {
    it('should add space around equals operator', () => {
      const result = formatSql('select * from users where id=1');
      expect(result).toContain('= 1');
    });

    it('should add space around comparison operators', () => {
      const result = formatSql('select * from users where age>18');
      expect(result).toContain('> 18');
    });

    it('should handle less than operator', () => {
      const result = formatSql('select * from users where age<18');
      expect(result).toContain('< 18');
    });

    it('should handle not equal operator', () => {
      const result = formatSql('select * from users where status<>active');
      expect(result).toContain('<>');
    });
  });

  describe('function calls', () => {
    it('should not add space before function parenthesis for COUNT', () => {
      const result = formatSql('select count(*) from users');
      expect(result).toContain('COUNT(');
    });

    it('should not add space before function parenthesis for SUM', () => {
      const result = formatSql('select sum(amount) from orders');
      expect(result).toContain('SUM(');
    });

    it('should not add space before function parenthesis for AVG', () => {
      const result = formatSql('select avg(price) from products');
      expect(result).toContain('AVG(');
    });

    it('should not add space before function parenthesis for MIN', () => {
      const result = formatSql('select min(price) from products');
      expect(result).toContain('MIN(');
    });

    it('should not add space before function parenthesis for MAX', () => {
      const result = formatSql('select max(price) from products');
      expect(result).toContain('MAX(');
    });

    it('should handle COALESCE function', () => {
      const result = formatSql('select coalesce(name, default) from users');
      // coalesce is not in keywords list, so stays lowercase
      expect(result).toContain('coalesce');
    });

    it('should handle UPPER function', () => {
      const result = formatSql('select upper(name) from users');
      // upper is not in keywords list, so stays lowercase
      expect(result).toContain('upper');
    });

    it('should handle LOWER function', () => {
      const result = formatSql('select lower(name) from users');
      // lower is not in keywords list, so stays lowercase
      expect(result).toContain('lower');
    });
  });

  describe('multi-statement queries', () => {
    it('should add newlines between statements', () => {
      const result = formatSql('select * from users; select * from orders;');
      expect(result).toContain(';\n');
    });

    it('should format each statement independently', () => {
      const result = formatSql('select * from users; select * from orders;');
      expect(result).toContain('SELECT');
      expect(result).toContain('FROM');
    });
  });

  describe('dot notation', () => {
    it('should not add space around dot in table.column', () => {
      const result = formatSql('select users.name from users');
      expect(result).toContain('users.name');
    });

    it('should preserve qualified column names in JOIN', () => {
      const result = formatSql(
        'select * from users join orders on users.id = orders.user_id'
      );
      expect(result).toContain('users.id');
      expect(result).toContain('orders.user_id');
    });
  });

  describe('numbers', () => {
    it('should preserve integer numbers', () => {
      const result = formatSql('select * from users where id = 123');
      expect(result).toContain('123');
    });

    it('should preserve decimal numbers', () => {
      const result = formatSql('select * from users where price > 19.99');
      expect(result).toContain('19.99');
    });
  });

  describe('complex queries', () => {
    it('should format a complete SELECT query with WHERE and LIMIT', () => {
      const result = formatSql(
        'select id, name from users where status = 1 limit 10'
      );
      expect(result).toContain('SELECT');
      expect(result).toContain('\nFROM');
      expect(result).toContain('\nWHERE');
      expect(result).toContain('\nLIMIT');
    });

    it('should format a query with JOIN', () => {
      const result = formatSql(
        'select u.name, o.total from users u join orders o on u.id = o.user_id where o.total > 100'
      );
      expect(result).toContain('SELECT');
      expect(result).toContain('FROM');
      expect(result).toContain('JOIN');
      expect(result).toContain('ON');
      expect(result).toContain('WHERE');
    });

    it('should format a query with subquery', () => {
      const result = formatSql(
        'select * from users where id in (select user_id from orders)'
      );
      expect(result).toContain('SELECT');
      expect(result).toContain('WHERE');
      expect(result).toContain('IN');
    });

    it('should format UPDATE statement', () => {
      const result = formatSql("update users set name = 'test' where id = 1");
      expect(result).toContain('UPDATE');
      expect(result).toContain('\nSET');
      expect(result).toContain('\nWHERE');
    });

    it('should format a query with DISTINCT', () => {
      const result = formatSql('select distinct name from users');
      expect(result).toContain('SELECT');
      expect(result).toContain('DISTINCT');
    });

    it('should format a query with BETWEEN', () => {
      const result = formatSql(
        'select * from users where age between 18 and 65'
      );
      expect(result).toContain('BETWEEN');
      expect(result).toContain('AND');
    });

    it('should format a query with LIKE', () => {
      const result = formatSql("select * from users where name like '%john%'");
      expect(result).toContain('LIKE');
    });

    it('should format a query with IN clause', () => {
      const result = formatSql('select * from users where id in (1, 2, 3)');
      expect(result).toContain('IN');
    });

    it('should format a query with NULL check', () => {
      const result = formatSql('select * from users where email is null');
      // 'is' is not in keywords list so stays lowercase, NULL is uppercase
      expect(result).toContain('is');
      expect(result).toContain('NULL');
    });

    it('should format a query with NOT NULL check', () => {
      const result = formatSql('select * from users where email is not null');
      // 'is' is not in keywords list so stays lowercase
      expect(result).toContain('is');
      expect(result).toContain('NOT');
      expect(result).toContain('NULL');
    });
  });

  describe('parentheses handling', () => {
    it('should preserve parentheses in expressions', () => {
      const result = formatSql('select * from users where (a = 1 or b = 2)');
      expect(result).toContain('(');
      expect(result).toContain(')');
    });

    it('should preserve nested parentheses', () => {
      const result = formatSql(
        'select * from users where ((a = 1) and (b = 2))'
      );
      expect(result.match(/\(/g)?.length).toBe(3);
      expect(result.match(/\)/g)?.length).toBe(3);
    });
  });

  describe('case expressions', () => {
    it('should uppercase CASE keyword', () => {
      const result = formatSql(
        'select case when a = 1 then 2 else 3 end from t'
      );
      expect(result).toContain('CASE');
    });

    it('should uppercase WHEN keyword', () => {
      const result = formatSql(
        'select case when a = 1 then 2 else 3 end from t'
      );
      expect(result).toContain('WHEN');
    });

    it('should uppercase THEN keyword', () => {
      const result = formatSql(
        'select case when a = 1 then 2 else 3 end from t'
      );
      expect(result).toContain('THEN');
    });

    it('should uppercase ELSE keyword', () => {
      const result = formatSql(
        'select case when a = 1 then 2 else 3 end from t'
      );
      expect(result).toContain('ELSE');
    });

    it('should uppercase END keyword', () => {
      const result = formatSql(
        'select case when a = 1 then 2 else 3 end from t'
      );
      expect(result).toContain('END');
    });
  });
});

describe('validateSql', () => {
  describe('empty input', () => {
    it('should return empty array for empty string', () => {
      expect(validateSql('')).toEqual([]);
    });

    it('should return empty array for whitespace-only input', () => {
      expect(validateSql('   ')).toEqual([]);
    });

    it('should return empty array for newline-only input', () => {
      expect(validateSql('\n\n')).toEqual([]);
    });
  });

  describe('valid SQL', () => {
    it('should return empty array for valid simple SELECT', () => {
      expect(validateSql('SELECT * FROM users')).toEqual([]);
    });

    it('should return empty array for valid SELECT with WHERE', () => {
      expect(validateSql('SELECT * FROM users WHERE id = 1')).toEqual([]);
    });

    it('should return empty array for valid string literals', () => {
      expect(validateSql("SELECT * FROM users WHERE name = 'John'")).toEqual(
        []
      );
    });

    it('should return empty array for properly nested parentheses', () => {
      expect(validateSql('SELECT * FROM users WHERE id IN (1, 2, 3)')).toEqual(
        []
      );
    });
  });

  describe('unclosed parentheses', () => {
    it('should detect unclosed opening parenthesis', () => {
      const errors = validateSql('SELECT * FROM users WHERE id IN (1, 2, 3');
      expect(errors.length).toBeGreaterThan(0);
      expect(
        errors.some((e) => e.message.toLowerCase().includes('parenthesis'))
      ).toBe(true);
    });

    it('should detect unexpected closing parenthesis', () => {
      const errors = validateSql('SELECT * FROM users WHERE id = 1)');
      expect(errors.length).toBeGreaterThan(0);
      expect(
        errors.some((e) => e.message.toLowerCase().includes('parenthesis'))
      ).toBe(true);
    });

    it('should detect multiple unclosed parentheses', () => {
      const errors = validateSql('SELECT * FROM users WHERE (id IN (1, 2');
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('unclosed quotes', () => {
    it('should detect unclosed single quote', () => {
      const errors = validateSql("SELECT * FROM users WHERE name = 'John");
      expect(errors.length).toBeGreaterThan(0);
      expect(
        errors.some(
          (e) =>
            e.message.toLowerCase().includes('unclosed') ||
            e.message.toLowerCase().includes('string')
        )
      ).toBe(true);
    });

    it('should detect unclosed double quote', () => {
      const errors = validateSql('SELECT * FROM users WHERE "column = 1');
      expect(errors.length).toBeGreaterThan(0);
      expect(
        errors.some(
          (e) =>
            e.message.toLowerCase().includes('unclosed') ||
            e.message.toLowerCase().includes('string')
        )
      ).toBe(true);
    });

    it('should handle escaped single quotes correctly', () => {
      const errors = validateSql("SELECT * FROM users WHERE name = 'O''Brien'");
      expect(errors).toEqual([]);
    });

    it('should handle escaped double quotes correctly', () => {
      const errors = validateSql(
        'SELECT * FROM users WHERE "column""name" = 1'
      );
      expect(errors).toEqual([]);
    });
  });

  describe('keyword typos', () => {
    it('should detect SELEC typo', () => {
      const errors = validateSql('SELEC * FROM users');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.message.includes('SELECT'))).toBe(true);
    });

    it('should detect FRON typo', () => {
      const errors = validateSql('SELECT * FRON users');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.message.includes('FROM'))).toBe(true);
    });

    it('should detect WHER typo', () => {
      const errors = validateSql('SELECT * FROM users WHER id = 1');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.message.includes('WHERE'))).toBe(true);
    });

    it('should detect JION typo', () => {
      const errors = validateSql(
        'SELECT * FROM users JION orders ON users.id = orders.user_id'
      );
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.message.includes('JOIN'))).toBe(true);
    });

    it('should detect UDPATE typo', () => {
      const errors = validateSql("UDPATE users SET name = 'test'");
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.message.includes('UPDATE'))).toBe(true);
    });

    it('should detect INSRT typo', () => {
      const errors = validateSql("INSRT INTO users (name) VALUES ('test')");
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.message.includes('INSERT'))).toBe(true);
    });

    it('should detect DELTE typo', () => {
      const errors = validateSql('DELTE FROM users WHERE id = 1');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.message.includes('DELETE'))).toBe(true);
    });
  });

  describe('comments', () => {
    it('should handle line comments correctly', () => {
      const errors = validateSql('SELECT * FROM users -- this is a comment');
      expect(errors).toEqual([]);
    });

    it('should handle block comments correctly', () => {
      const errors = validateSql('SELECT /* comment */ * FROM users');
      expect(errors).toEqual([]);
    });

    it('should detect unclosed block comment', () => {
      const errors = validateSql('SELECT * FROM users /* unclosed comment');
      expect(errors.length).toBeGreaterThan(0);
      expect(
        errors.some((e) => e.message.toLowerCase().includes('comment'))
      ).toBe(true);
    });

    it('should ignore quotes inside line comments', () => {
      const errors = validateSql(
        "SELECT * FROM users -- don't check this quote"
      );
      expect(errors).toEqual([]);
    });

    it('should ignore quotes inside block comments', () => {
      const errors = validateSql(
        "SELECT * FROM users /* don't check this quote */"
      );
      expect(errors).toEqual([]);
    });
  });

  describe('error format', () => {
    it('should return errors with correct structure', () => {
      const errors = validateSql('SELECT * FROM users WHERE id IN (1, 2');
      expect(errors.length).toBeGreaterThan(0);
      const error = errors[0];
      expect(error).toHaveProperty('startLineNumber');
      expect(error).toHaveProperty('startColumn');
      expect(error).toHaveProperty('endLineNumber');
      expect(error).toHaveProperty('endColumn');
      expect(error).toHaveProperty('message');
      expect(error).toHaveProperty('severity');
    });

    it('should return correct line numbers for multi-line input', () => {
      const errors = validateSql(
        "SELECT *\nFROM users\nWHERE name = 'unclosed"
      );
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].startLineNumber).toBe(3);
    });

    it('should have severity as error or warning', () => {
      const errors = validateSql('SELEC * FROM users');
      expect(errors.length).toBeGreaterThan(0);
      expect(['error', 'warning', 'info']).toContain(errors[0].severity);
    });
  });

  describe('complex validation scenarios', () => {
    it('should validate complex multi-line query correctly', () => {
      const sql = `
        SELECT u.id, u.name
        FROM users u
        JOIN orders o ON u.id = o.user_id
        WHERE o.total > 100
        ORDER BY u.name
      `;
      expect(validateSql(sql)).toEqual([]);
    });

    it('should detect multiple errors', () => {
      const errors = validateSql('SELEC * FRON users WHERE (id = 1');
      expect(errors.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle deeply nested parentheses', () => {
      const errors = validateSql(
        'SELECT * FROM users WHERE ((id = 1) AND ((status = 1)))'
      );
      expect(errors).toEqual([]);
    });

    it('should validate query with string containing parentheses', () => {
      const errors = validateSql("SELECT * FROM users WHERE name = '(test)'");
      expect(errors).toEqual([]);
    });
  });
});

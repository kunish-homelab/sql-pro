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

  describe('additional keyword typos', () => {
    it('should detect SLECT typo', () => {
      const errors = validateSql('SLECT * FROM users');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.message.includes('SELECT'))).toBe(true);
    });

    it('should detect SELET typo', () => {
      const errors = validateSql('SELET * FROM users');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.message.includes('SELECT'))).toBe(true);
    });

    it('should detect SELCT typo', () => {
      const errors = validateSql('SELCT * FROM users');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.message.includes('SELECT'))).toBe(true);
    });

    it('should detect FORM typo', () => {
      const errors = validateSql('SELECT * FORM users');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.message.includes('FROM'))).toBe(true);
    });

    it('should detect FRMO typo', () => {
      const errors = validateSql('SELECT * FRMO users');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.message.includes('FROM'))).toBe(true);
    });

    it('should detect WHRE typo', () => {
      const errors = validateSql('SELECT * FROM users WHRE id = 1');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.message.includes('WHERE'))).toBe(true);
    });

    it('should detect WEHRE typo', () => {
      const errors = validateSql('SELECT * FROM users WEHRE id = 1');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.message.includes('WHERE'))).toBe(true);
    });

    it('should detect GRUOP typo', () => {
      const errors = validateSql('SELECT status FROM users GRUOP BY status');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.message.includes('GROUP'))).toBe(true);
    });

    it('should detect GROPU typo', () => {
      const errors = validateSql('SELECT status FROM users GROPU BY status');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.message.includes('GROUP'))).toBe(true);
    });

    it('should detect ODER typo', () => {
      const errors = validateSql('SELECT * FROM users ODER BY id');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.message.includes('ORDER'))).toBe(true);
    });

    it('should detect ORDERY typo', () => {
      const errors = validateSql('SELECT * FROM users ORDERY BY id');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.message.includes('ORDER'))).toBe(true);
    });

    it('should detect JOIIN typo', () => {
      const errors = validateSql(
        'SELECT * FROM users JOIIN orders ON users.id = orders.user_id'
      );
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.message.includes('JOIN'))).toBe(true);
    });

    it('should detect INSET typo', () => {
      const errors = validateSql("INSET INTO users (name) VALUES ('test')");
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.message.includes('INSERT'))).toBe(true);
    });

    it('should detect UPADTE typo', () => {
      const errors = validateSql("UPADTE users SET name = 'test'");
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.message.includes('UPDATE'))).toBe(true);
    });

    it('should detect DELEET typo', () => {
      const errors = validateSql('DELEET FROM users WHERE id = 1');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.message.includes('DELETE'))).toBe(true);
    });

    it('should detect CRAETE typo', () => {
      const errors = validateSql('CRAETE TABLE test (id INTEGER)');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.message.includes('CREATE'))).toBe(true);
    });

    it('should detect CRATE typo', () => {
      const errors = validateSql('CRATE TABLE test (id INTEGER)');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.message.includes('CREATE'))).toBe(true);
    });

    it('should detect TABL typo', () => {
      const errors = validateSql('CREATE TABL test (id INTEGER)');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.message.includes('TABLE'))).toBe(true);
    });

    it('should detect TABEL typo', () => {
      const errors = validateSql('CREATE TABEL test (id INTEGER)');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.message.includes('TABLE'))).toBe(true);
    });

    it('should detect VALUS typo', () => {
      const errors = validateSql("INSERT INTO users (name) VALUS ('test')");
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.message.includes('VALUES'))).toBe(true);
    });

    it('should detect VLAUES typo', () => {
      const errors = validateSql("INSERT INTO users (name) VLAUES ('test')");
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.message.includes('VALUES'))).toBe(true);
    });

    it('should detect LIMTI typo', () => {
      const errors = validateSql('SELECT * FROM users LIMTI 10');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.message.includes('LIMIT'))).toBe(true);
    });

    it('should detect LIMT typo', () => {
      const errors = validateSql('SELECT * FROM users LIMT 10');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.message.includes('LIMIT'))).toBe(true);
    });

    it('should detect OFSET typo', () => {
      const errors = validateSql('SELECT * FROM users LIMIT 10 OFSET 5');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.message.includes('OFFSET'))).toBe(true);
    });

    it('should detect HAVIGN typo', () => {
      const errors = validateSql(
        'SELECT status, COUNT(*) FROM users GROUP BY status HAVIGN COUNT(*) > 1'
      );
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.message.includes('HAVING'))).toBe(true);
    });

    it('should detect HAIVNG typo', () => {
      const errors = validateSql(
        'SELECT status, COUNT(*) FROM users GROUP BY status HAIVNG COUNT(*) > 1'
      );
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.message.includes('HAVING'))).toBe(true);
    });

    it('should detect DISINCT typo', () => {
      const errors = validateSql('SELECT DISINCT name FROM users');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.message.includes('DISTINCT'))).toBe(true);
    });

    it('should detect DISTINT typo', () => {
      const errors = validateSql('SELECT DISTINT name FROM users');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.message.includes('DISTINCT'))).toBe(true);
    });
  });

  describe('severity levels', () => {
    it('should report typos as warnings', () => {
      const errors = validateSql('SELEC * FROM users');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.severity === 'warning')).toBe(true);
    });

    it('should report unclosed parentheses as errors', () => {
      const errors = validateSql('SELECT * FROM users WHERE (id = 1');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.severity === 'error')).toBe(true);
    });

    it('should report unclosed quotes as errors', () => {
      const errors = validateSql("SELECT * FROM users WHERE name = 'test");
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.severity === 'error')).toBe(true);
    });

    it('should report unexpected closing parenthesis as error', () => {
      const errors = validateSql('SELECT * FROM users WHERE id = 1)');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.severity === 'error')).toBe(true);
    });

    it('should report unclosed block comment as error', () => {
      const errors = validateSql('SELECT * /* comment without close');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.severity === 'error')).toBe(true);
    });
  });

  describe('column position accuracy', () => {
    it('should report correct column for typo at start of line', () => {
      const errors = validateSql('SELEC * FROM users');
      expect(errors.length).toBeGreaterThan(0);
      const typoError = errors.find((e) => e.message.includes('SELECT'));
      expect(typoError?.startColumn).toBe(1);
      expect(typoError?.endColumn).toBe(6); // 'SELEC' is 5 characters, end is exclusive
    });

    it('should report correct column for typo in middle of line', () => {
      const errors = validateSql('SELECT * FRON users');
      expect(errors.length).toBeGreaterThan(0);
      const typoError = errors.find((e) => e.message.includes('FROM'));
      expect(typoError?.startColumn).toBe(10);
      expect(typoError?.endColumn).toBe(14); // 'FRON' is 4 characters
    });

    it('should report correct column for unclosed parenthesis', () => {
      const errors = validateSql('SELECT * FROM users WHERE (id = 1');
      expect(errors.length).toBeGreaterThan(0);
      const parenError = errors.find((e) =>
        e.message.toLowerCase().includes('parenthesis')
      );
      expect(parenError?.startColumn).toBe(27); // Position of '('
    });

    it('should report correct column for unclosed quote', () => {
      const errors = validateSql("SELECT * FROM users WHERE name = 'test");
      expect(errors.length).toBeGreaterThan(0);
      const quoteError = errors.find((e) =>
        e.message.toLowerCase().includes('quote')
      );
      expect(quoteError?.startColumn).toBe(34); // Position of opening quote
    });
  });

  describe('typos inside strings and comments', () => {
    // Note: The current implementation has a limitation where typos inside
    // single-quoted strings and double-quoted identifiers are still detected.
    // This is because the typo detection uses a simple regex approach after
    // only removing line comments. These tests document the actual behavior.

    it('should detect typos even inside single-quoted strings (current limitation)', () => {
      const errors = validateSql("SELECT * FROM users WHERE name = 'SELEC'");
      // Current implementation detects typos inside strings
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.message.includes('SELECT'))).toBe(true);
    });

    it('should detect typos even inside double-quoted identifiers (current limitation)', () => {
      const errors = validateSql('SELECT * FROM users WHERE "FRON" = 1');
      // Current implementation detects typos inside double-quoted identifiers
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.message.includes('FROM'))).toBe(true);
    });

    it('should not detect typos inside line comments', () => {
      const errors = validateSql('SELECT * FROM users -- SELEC typo here');
      expect(errors).toEqual([]);
    });

    it('should detect typos inside block comments (current limitation)', () => {
      // Current implementation does not filter out block comments for typo detection
      const errors = validateSql('SELECT * FROM users /* FRON is a typo */');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.message.includes('FROM'))).toBe(true);
    });
  });

  describe('edge cases with quotes', () => {
    it('should handle string with escaped quote followed by unescaped quote', () => {
      const errors = validateSql("SELECT * FROM users WHERE name = 'O''Brien'");
      expect(errors).toEqual([]);
    });

    it('should handle multiple strings in same query', () => {
      const errors = validateSql(
        "SELECT * FROM users WHERE name = 'John' AND city = 'NYC'"
      );
      expect(errors).toEqual([]);
    });

    it('should handle mixed single and double quotes', () => {
      const errors = validateSql(
        'SELECT * FROM users WHERE name = \'John\' AND "column" = 1'
      );
      expect(errors).toEqual([]);
    });

    it('should detect unclosed quote after closed quote', () => {
      const errors = validateSql(
        "SELECT * FROM users WHERE name = 'John' AND city = 'NYC"
      );
      expect(errors.length).toBeGreaterThan(0);
      expect(
        errors.some((e) => e.message.toLowerCase().includes('unclosed'))
      ).toBe(true);
    });

    it('should handle empty strings', () => {
      const errors = validateSql("SELECT * FROM users WHERE name = ''");
      expect(errors).toEqual([]);
    });

    it('should handle string with only escaped quote', () => {
      const errors = validateSql("SELECT * FROM users WHERE val = ''''");
      expect(errors).toEqual([]);
    });
  });

  describe('edge cases with parentheses', () => {
    it('should handle empty parentheses', () => {
      const errors = validateSql('SELECT COUNT() FROM users');
      expect(errors).toEqual([]);
    });

    it('should handle parentheses in function call', () => {
      const errors = validateSql('SELECT COALESCE(name, email) FROM users');
      expect(errors).toEqual([]);
    });

    it('should handle nested subqueries', () => {
      const errors = validateSql(
        'SELECT * FROM users WHERE id IN (SELECT user_id FROM orders WHERE total > (SELECT AVG(total) FROM orders))'
      );
      expect(errors).toEqual([]);
    });

    it('should handle parentheses inside single-quoted strings', () => {
      const errors = validateSql(
        "SELECT * FROM users WHERE name = '(unclosed'"
      );
      expect(errors).toEqual([]);
    });

    it('should handle parentheses inside double-quoted identifiers', () => {
      const errors = validateSql('SELECT * FROM users WHERE "(col)" = 1');
      expect(errors).toEqual([]);
    });

    it('should report all unclosed parentheses', () => {
      const errors = validateSql('SELECT * FROM users WHERE ((id = 1');
      const parenErrors = errors.filter((e) =>
        e.message.toLowerCase().includes('parenthesis')
      );
      expect(parenErrors.length).toBe(2);
    });
  });

  describe('multi-line validation', () => {
    it('should handle query split across multiple lines', () => {
      const sql = `SELECT *
FROM users
WHERE id = 1`;
      expect(validateSql(sql)).toEqual([]);
    });

    it('should report error on correct line for multi-line query', () => {
      const sql = `SELECT *
FROM users
WHERE name = 'unclosed`;
      const errors = validateSql(sql);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].startLineNumber).toBe(3);
    });

    it('should handle comment at end of line in multi-line query', () => {
      const sql = `SELECT * -- get all columns
FROM users -- from users table
WHERE id = 1`;
      expect(validateSql(sql)).toEqual([]);
    });

    it('should handle block comment spanning multiple lines', () => {
      const sql = `SELECT * /* This is
a multi-line
comment */ FROM users`;
      expect(validateSql(sql)).toEqual([]);
    });

    it('should detect unclosed block comment in multi-line query', () => {
      const sql = `SELECT *
/* This comment
is never closed
FROM users`;
      const errors = validateSql(sql);
      expect(errors.length).toBeGreaterThan(0);
      expect(
        errors.some((e) => e.message.toLowerCase().includes('comment'))
      ).toBe(true);
    });
  });

  describe('lowercase and mixed case typos', () => {
    it('should detect lowercase typos', () => {
      const errors = validateSql('selec * from users');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.message.includes('SELECT'))).toBe(true);
    });

    it('should detect mixed case typos', () => {
      const errors = validateSql('SeLec * FrOm users');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.message.includes('SELECT'))).toBe(true);
    });
  });

  describe('special SQL patterns', () => {
    it('should validate CASE expressions correctly', () => {
      const sql = `SELECT CASE WHEN status = 1 THEN 'active' ELSE 'inactive' END FROM users`;
      expect(validateSql(sql)).toEqual([]);
    });

    it('should validate UNION queries', () => {
      const sql = 'SELECT id FROM users UNION SELECT id FROM admins';
      expect(validateSql(sql)).toEqual([]);
    });

    it('should validate INSERT with multiple rows', () => {
      const sql = "INSERT INTO users (name) VALUES ('John'), ('Jane'), ('Bob')";
      expect(validateSql(sql)).toEqual([]);
    });

    it('should validate CREATE TABLE with constraints', () => {
      const sql =
        'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE)';
      expect(validateSql(sql)).toEqual([]);
    });
  });
});

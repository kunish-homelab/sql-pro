import type { UIFilterState, UIOperator } from './filter-utils';

import { describe, expect, it } from 'vitest';
import {
  convertUIFiltersToAPIFilters,
  convertUIFilterToAPIFilters,
  createFiltersFromUIOperator,
  detectColumnTypeCategory,
  generateCompactFilterLabel,
  generateFilterId,
  generateFilterLabel,
  getColumnTypeCategory,
  getOperatorLabel,
  getOperatorsForColumnType,
  getOperatorSymbol,
  mapOperatorToFilterState,
  NUMERIC_OPERATORS,
  TEXT_OPERATORS,
  validateFilterValue,
} from './filter-utils';

describe('detectColumnTypeCategory', () => {
  describe('numeric types', () => {
    it('should detect INTEGER type as numeric', () => {
      expect(detectColumnTypeCategory('INTEGER')).toBe('numeric');
    });

    it('should detect integer (lowercase) as numeric', () => {
      expect(detectColumnTypeCategory('integer')).toBe('numeric');
    });

    it('should detect INT type as numeric', () => {
      expect(detectColumnTypeCategory('INT')).toBe('numeric');
    });

    it('should detect TINYINT as numeric', () => {
      expect(detectColumnTypeCategory('TINYINT')).toBe('numeric');
    });

    it('should detect SMALLINT as numeric', () => {
      expect(detectColumnTypeCategory('SMALLINT')).toBe('numeric');
    });

    it('should detect MEDIUMINT as numeric', () => {
      expect(detectColumnTypeCategory('MEDIUMINT')).toBe('numeric');
    });

    it('should detect BIGINT as numeric', () => {
      expect(detectColumnTypeCategory('BIGINT')).toBe('numeric');
    });

    it('should detect UNSIGNED BIG INT as numeric', () => {
      expect(detectColumnTypeCategory('UNSIGNED BIG INT')).toBe('numeric');
    });

    it('should detect INT2 as numeric', () => {
      expect(detectColumnTypeCategory('INT2')).toBe('numeric');
    });

    it('should detect INT8 as numeric', () => {
      expect(detectColumnTypeCategory('INT8')).toBe('numeric');
    });

    it('should detect REAL as numeric', () => {
      expect(detectColumnTypeCategory('REAL')).toBe('numeric');
    });

    it('should detect DOUBLE as numeric', () => {
      expect(detectColumnTypeCategory('DOUBLE')).toBe('numeric');
    });

    it('should detect DOUBLE PRECISION as numeric', () => {
      expect(detectColumnTypeCategory('DOUBLE PRECISION')).toBe('numeric');
    });

    it('should detect FLOAT as numeric', () => {
      expect(detectColumnTypeCategory('FLOAT')).toBe('numeric');
    });

    it('should detect NUMERIC as numeric', () => {
      expect(detectColumnTypeCategory('NUMERIC')).toBe('numeric');
    });

    it('should detect DECIMAL as numeric', () => {
      expect(detectColumnTypeCategory('DECIMAL')).toBe('numeric');
    });

    it('should detect NUMBER as numeric', () => {
      expect(detectColumnTypeCategory('NUMBER')).toBe('numeric');
    });

    it('should detect DECIMAL(10,2) as numeric', () => {
      expect(detectColumnTypeCategory('DECIMAL(10,2)')).toBe('numeric');
    });

    it('should detect INTEGER PRIMARY KEY as numeric', () => {
      expect(detectColumnTypeCategory('INTEGER PRIMARY KEY')).toBe('numeric');
    });
  });

  describe('date types', () => {
    it('should detect DATE as date', () => {
      expect(detectColumnTypeCategory('DATE')).toBe('date');
    });

    it('should detect DATETIME as date', () => {
      expect(detectColumnTypeCategory('DATETIME')).toBe('date');
    });

    it('should detect TIMESTAMP as date', () => {
      expect(detectColumnTypeCategory('TIMESTAMP')).toBe('date');
    });

    it('should detect TIME as date', () => {
      expect(detectColumnTypeCategory('TIME')).toBe('date');
    });

    it('should detect date (lowercase) as date', () => {
      expect(detectColumnTypeCategory('date')).toBe('date');
    });
  });

  describe('boolean types', () => {
    it('should detect BOOL as boolean', () => {
      expect(detectColumnTypeCategory('BOOL')).toBe('boolean');
    });

    it('should detect BOOLEAN as boolean', () => {
      expect(detectColumnTypeCategory('BOOLEAN')).toBe('boolean');
    });

    it('should detect bool (lowercase) as boolean', () => {
      expect(detectColumnTypeCategory('bool')).toBe('boolean');
    });
  });

  describe('text types', () => {
    it('should detect TEXT as text', () => {
      expect(detectColumnTypeCategory('TEXT')).toBe('text');
    });

    it('should detect CHAR as text', () => {
      expect(detectColumnTypeCategory('CHAR')).toBe('text');
    });

    it('should detect VARCHAR as text', () => {
      expect(detectColumnTypeCategory('VARCHAR')).toBe('text');
    });

    it('should detect VARCHAR(255) as text', () => {
      expect(detectColumnTypeCategory('VARCHAR(255)')).toBe('text');
    });

    it('should detect NCHAR as text', () => {
      expect(detectColumnTypeCategory('NCHAR')).toBe('text');
    });

    it('should detect NVARCHAR as text', () => {
      expect(detectColumnTypeCategory('NVARCHAR')).toBe('text');
    });

    it('should detect CLOB as text', () => {
      expect(detectColumnTypeCategory('CLOB')).toBe('text');
    });

    it('should detect STRING as text', () => {
      expect(detectColumnTypeCategory('STRING')).toBe('text');
    });

    it('should detect text (lowercase) as text', () => {
      expect(detectColumnTypeCategory('text')).toBe('text');
    });
  });

  describe('unknown and edge cases', () => {
    it('should return unknown for empty string', () => {
      expect(detectColumnTypeCategory('')).toBe('unknown');
    });

    it('should return unknown for whitespace-only string', () => {
      expect(detectColumnTypeCategory('   ')).toBe('unknown');
    });

    it('should default to text for BLOB type', () => {
      expect(detectColumnTypeCategory('BLOB')).toBe('text');
    });

    it('should default to text for unknown types', () => {
      expect(detectColumnTypeCategory('CUSTOM_TYPE')).toBe('text');
    });

    it('should handle types with leading/trailing whitespace', () => {
      expect(detectColumnTypeCategory('  INTEGER  ')).toBe('numeric');
    });
  });
});

describe('getColumnTypeCategory', () => {
  it('should return the correct category for a ColumnSchema', () => {
    const column = {
      name: 'id',
      type: 'INTEGER',
      nullable: false,
      primaryKey: true,
    };
    expect(getColumnTypeCategory(column)).toBe('numeric');
  });

  it('should return text for VARCHAR column', () => {
    const column = {
      name: 'name',
      type: 'VARCHAR(255)',
      nullable: true,
      primaryKey: false,
    };
    expect(getColumnTypeCategory(column)).toBe('text');
  });

  it('should return date for DATETIME column', () => {
    const column = {
      name: 'created_at',
      type: 'DATETIME',
      nullable: true,
      primaryKey: false,
    };
    expect(getColumnTypeCategory(column)).toBe('date');
  });
});

describe('getOperatorsForColumnType', () => {
  describe('numeric column operators', () => {
    it('should return numeric operators for numeric type', () => {
      const operators = getOperatorsForColumnType('numeric');
      expect(operators).toBe(NUMERIC_OPERATORS);
    });

    it('should include equals operator', () => {
      const operators = getOperatorsForColumnType('numeric');
      expect(operators.find((op) => op.value === 'equals')).toBeDefined();
    });

    it('should include greater_than operator', () => {
      const operators = getOperatorsForColumnType('numeric');
      expect(operators.find((op) => op.value === 'greater_than')).toBeDefined();
    });

    it('should include between operator with requiresSecondValue', () => {
      const operators = getOperatorsForColumnType('numeric');
      const betweenOp = operators.find((op) => op.value === 'between');
      expect(betweenOp).toBeDefined();
      expect(betweenOp?.requiresSecondValue).toBe(true);
    });
  });

  describe('date column operators', () => {
    it('should return numeric operators for date type', () => {
      const operators = getOperatorsForColumnType('date');
      expect(operators).toBe(NUMERIC_OPERATORS);
    });
  });

  describe('boolean column operators', () => {
    it('should return limited operators for boolean type', () => {
      const operators = getOperatorsForColumnType('boolean');
      expect(operators).toHaveLength(4);
    });

    it('should include equals operator for boolean', () => {
      const operators = getOperatorsForColumnType('boolean');
      expect(operators.find((op) => op.value === 'equals')).toBeDefined();
    });

    it('should include not_equals operator for boolean', () => {
      const operators = getOperatorsForColumnType('boolean');
      expect(operators.find((op) => op.value === 'not_equals')).toBeDefined();
    });

    it('should include is_null operator for boolean', () => {
      const operators = getOperatorsForColumnType('boolean');
      expect(operators.find((op) => op.value === 'is_null')).toBeDefined();
    });

    it('should include is_not_null operator for boolean', () => {
      const operators = getOperatorsForColumnType('boolean');
      expect(operators.find((op) => op.value === 'is_not_null')).toBeDefined();
    });

    it('should not include greater_than operator for boolean', () => {
      const operators = getOperatorsForColumnType('boolean');
      expect(
        operators.find((op) => op.value === 'greater_than')
      ).toBeUndefined();
    });
  });

  describe('text column operators', () => {
    it('should return text operators for text type', () => {
      const operators = getOperatorsForColumnType('text');
      expect(operators).toBe(TEXT_OPERATORS);
    });

    it('should include contains operator', () => {
      const operators = getOperatorsForColumnType('text');
      expect(operators.find((op) => op.value === 'contains')).toBeDefined();
    });

    it('should include starts_with operator', () => {
      const operators = getOperatorsForColumnType('text');
      expect(operators.find((op) => op.value === 'starts_with')).toBeDefined();
    });

    it('should include ends_with operator', () => {
      const operators = getOperatorsForColumnType('text');
      expect(operators.find((op) => op.value === 'ends_with')).toBeDefined();
    });
  });

  describe('unknown column operators', () => {
    it('should return text operators for unknown type', () => {
      const operators = getOperatorsForColumnType('unknown');
      expect(operators).toBe(TEXT_OPERATORS);
    });
  });
});

describe('mapOperatorToFilterState', () => {
  describe('equality operators', () => {
    it('should map equals to eq operator', () => {
      const result = mapOperatorToFilterState('equals', 'test');
      expect(result).toEqual([{ operator: 'eq', value: 'test' }]);
    });

    it('should map not_equals to neq operator', () => {
      const result = mapOperatorToFilterState('not_equals', 'test');
      expect(result).toEqual([{ operator: 'neq', value: 'test' }]);
    });
  });

  describe('text operators', () => {
    it('should map contains to like with wildcard wrappers', () => {
      const result = mapOperatorToFilterState('contains', 'search');
      expect(result).toEqual([{ operator: 'like', value: '%search%' }]);
    });

    it('should map starts_with to like with suffix wildcard', () => {
      const result = mapOperatorToFilterState('starts_with', 'prefix');
      expect(result).toEqual([{ operator: 'like', value: 'prefix%' }]);
    });

    it('should map ends_with to like with prefix wildcard', () => {
      const result = mapOperatorToFilterState('ends_with', 'suffix');
      expect(result).toEqual([{ operator: 'like', value: '%suffix' }]);
    });
  });

  describe('null operators', () => {
    it('should map is_null to isnull operator with empty value', () => {
      const result = mapOperatorToFilterState('is_null', '');
      expect(result).toEqual([{ operator: 'isnull', value: '' }]);
    });

    it('should map is_not_null to notnull operator with empty value', () => {
      const result = mapOperatorToFilterState('is_not_null', '');
      expect(result).toEqual([{ operator: 'notnull', value: '' }]);
    });
  });

  describe('comparison operators', () => {
    it('should map greater_than to gt operator', () => {
      const result = mapOperatorToFilterState('greater_than', '10');
      expect(result).toEqual([{ operator: 'gt', value: '10' }]);
    });

    it('should map less_than to lt operator', () => {
      const result = mapOperatorToFilterState('less_than', '10');
      expect(result).toEqual([{ operator: 'lt', value: '10' }]);
    });

    it('should map greater_than_or_equal to gte operator', () => {
      const result = mapOperatorToFilterState('greater_than_or_equal', '10');
      expect(result).toEqual([{ operator: 'gte', value: '10' }]);
    });

    it('should map less_than_or_equal to lte operator', () => {
      const result = mapOperatorToFilterState('less_than_or_equal', '10');
      expect(result).toEqual([{ operator: 'lte', value: '10' }]);
    });
  });

  describe('between operator', () => {
    it('should map between to two filters (gte and lte)', () => {
      const result = mapOperatorToFilterState('between', '10', '20');
      expect(result).toEqual([
        { operator: 'gte', value: '10' },
        { operator: 'lte', value: '20' },
      ]);
    });

    it('should handle missing second value in between', () => {
      const result = mapOperatorToFilterState('between', '10');
      expect(result).toEqual([
        { operator: 'gte', value: '10' },
        { operator: 'lte', value: '' },
      ]);
    });

    it('should handle undefined second value in between', () => {
      const result = mapOperatorToFilterState('between', '5', undefined);
      expect(result).toEqual([
        { operator: 'gte', value: '5' },
        { operator: 'lte', value: '' },
      ]);
    });
  });

  describe('default fallback', () => {
    it('should fallback to eq operator for unknown operators', () => {
      const result = mapOperatorToFilterState(
        'unknown_operator' as UIOperator,
        'test_value'
      );
      expect(result).toEqual([{ operator: 'eq', value: 'test_value' }]);
    });
  });

  describe('edge cases', () => {
    it('should handle empty value for equals operator', () => {
      const result = mapOperatorToFilterState('equals', '');
      expect(result).toEqual([{ operator: 'eq', value: '' }]);
    });

    it('should handle value with special characters', () => {
      const result = mapOperatorToFilterState('contains', "test's value");
      expect(result).toEqual([{ operator: 'like', value: "%test's value%" }]);
    });

    it('should handle value with percent sign for contains', () => {
      const result = mapOperatorToFilterState('contains', '50%');
      expect(result).toEqual([{ operator: 'like', value: '%50%%' }]);
    });

    it('should preserve whitespace in values', () => {
      const result = mapOperatorToFilterState('equals', '  spaced  ');
      expect(result).toEqual([{ operator: 'eq', value: '  spaced  ' }]);
    });
  });
});

describe('createFiltersFromUIOperator', () => {
  describe('equality operators', () => {
    it('should create FilterState with column name for equals', () => {
      const result = createFiltersFromUIOperator('age', 'equals', '25');
      expect(result).toEqual([{ column: 'age', operator: 'eq', value: '25' }]);
    });

    it('should create FilterState for not_equals', () => {
      const result = createFiltersFromUIOperator(
        'status',
        'not_equals',
        'active'
      );
      expect(result).toEqual([
        { column: 'status', operator: 'neq', value: 'active' },
      ]);
    });
  });

  describe('text operators', () => {
    it('should create FilterState with contains pattern', () => {
      const result = createFiltersFromUIOperator('name', 'contains', 'john');
      expect(result).toEqual([
        { column: 'name', operator: 'like', value: '%john%' },
      ]);
    });

    it('should create FilterState for starts_with', () => {
      const result = createFiltersFromUIOperator(
        'email',
        'starts_with',
        'admin'
      );
      expect(result).toEqual([
        { column: 'email', operator: 'like', value: 'admin%' },
      ]);
    });

    it('should create FilterState for ends_with', () => {
      const result = createFiltersFromUIOperator('email', 'ends_with', '.com');
      expect(result).toEqual([
        { column: 'email', operator: 'like', value: '%.com' },
      ]);
    });
  });

  describe('null operators', () => {
    it('should create FilterState for is_null', () => {
      const result = createFiltersFromUIOperator('deleted_at', 'is_null', '');
      expect(result).toEqual([
        { column: 'deleted_at', operator: 'isnull', value: '' },
      ]);
    });

    it('should create FilterState for is_not_null', () => {
      const result = createFiltersFromUIOperator('email', 'is_not_null', '');
      expect(result).toEqual([
        { column: 'email', operator: 'notnull', value: '' },
      ]);
    });
  });

  describe('comparison operators', () => {
    it('should create FilterState for greater_than', () => {
      const result = createFiltersFromUIOperator(
        'price',
        'greater_than',
        '100'
      );
      expect(result).toEqual([
        { column: 'price', operator: 'gt', value: '100' },
      ]);
    });

    it('should create FilterState for less_than', () => {
      const result = createFiltersFromUIOperator('quantity', 'less_than', '10');
      expect(result).toEqual([
        { column: 'quantity', operator: 'lt', value: '10' },
      ]);
    });

    it('should create FilterState for greater_than_or_equal', () => {
      const result = createFiltersFromUIOperator(
        'rating',
        'greater_than_or_equal',
        '4'
      );
      expect(result).toEqual([
        { column: 'rating', operator: 'gte', value: '4' },
      ]);
    });

    it('should create FilterState for less_than_or_equal', () => {
      const result = createFiltersFromUIOperator(
        'age',
        'less_than_or_equal',
        '65'
      );
      expect(result).toEqual([{ column: 'age', operator: 'lte', value: '65' }]);
    });
  });

  describe('between operator', () => {
    it('should create two FilterStates for between', () => {
      const result = createFiltersFromUIOperator(
        'price',
        'between',
        '10',
        '100'
      );
      expect(result).toEqual([
        { column: 'price', operator: 'gte', value: '10' },
        { column: 'price', operator: 'lte', value: '100' },
      ]);
    });

    it('should handle between with missing second value', () => {
      const result = createFiltersFromUIOperator('age', 'between', '18');
      expect(result).toEqual([
        { column: 'age', operator: 'gte', value: '18' },
        { column: 'age', operator: 'lte', value: '' },
      ]);
    });

    it('should handle between with undefined second value', () => {
      const result = createFiltersFromUIOperator(
        'score',
        'between',
        '0',
        undefined
      );
      expect(result).toEqual([
        { column: 'score', operator: 'gte', value: '0' },
        { column: 'score', operator: 'lte', value: '' },
      ]);
    });
  });

  describe('edge cases', () => {
    it('should handle column names with special characters', () => {
      const result = createFiltersFromUIOperator('user_name', 'equals', 'test');
      expect(result).toEqual([
        { column: 'user_name', operator: 'eq', value: 'test' },
      ]);
    });

    it('should handle empty column name', () => {
      const result = createFiltersFromUIOperator('', 'equals', 'value');
      expect(result).toEqual([{ column: '', operator: 'eq', value: 'value' }]);
    });

    it('should preserve all filter properties from mapping', () => {
      const result = createFiltersFromUIOperator('id', 'between', '1', '100');
      expect(result).toHaveLength(2);
      result.forEach((filter) => {
        expect(filter).toHaveProperty('column');
        expect(filter).toHaveProperty('operator');
        expect(filter).toHaveProperty('value');
      });
    });
  });
});

describe('getOperatorLabel', () => {
  it('should return label for equals operator', () => {
    expect(getOperatorLabel('equals')).toBe('Equals');
  });

  it('should return label for not_equals operator', () => {
    expect(getOperatorLabel('not_equals')).toBe('Not equals');
  });

  it('should return label for contains operator', () => {
    expect(getOperatorLabel('contains')).toBe('Contains');
  });

  it('should return label for between operator', () => {
    expect(getOperatorLabel('between')).toBe('Between');
  });

  it('should return label for is_null operator', () => {
    expect(getOperatorLabel('is_null')).toBe('Is null');
  });

  it('should return operator value as fallback for unknown operator', () => {
    expect(getOperatorLabel('unknown_op' as UIOperator)).toBe('unknown_op');
  });
});

describe('getOperatorSymbol', () => {
  it('should return = for equals', () => {
    expect(getOperatorSymbol('equals')).toBe('=');
  });

  it('should return ≠ for not_equals', () => {
    expect(getOperatorSymbol('not_equals')).toBe('≠');
  });

  it('should return ~ for contains', () => {
    expect(getOperatorSymbol('contains')).toBe('~');
  });

  it('should return ^ for starts_with', () => {
    expect(getOperatorSymbol('starts_with')).toBe('^');
  });

  it('should return $ for ends_with', () => {
    expect(getOperatorSymbol('ends_with')).toBe('$');
  });

  it('should return > for greater_than', () => {
    expect(getOperatorSymbol('greater_than')).toBe('>');
  });

  it('should return < for less_than', () => {
    expect(getOperatorSymbol('less_than')).toBe('<');
  });

  it('should return ≥ for greater_than_or_equal', () => {
    expect(getOperatorSymbol('greater_than_or_equal')).toBe('≥');
  });

  it('should return ≤ for less_than_or_equal', () => {
    expect(getOperatorSymbol('less_than_or_equal')).toBe('≤');
  });

  it('should return ↔ for between', () => {
    expect(getOperatorSymbol('between')).toBe('↔');
  });

  it('should return "is null" for is_null', () => {
    expect(getOperatorSymbol('is_null')).toBe('is null');
  });

  it('should return "is not null" for is_not_null', () => {
    expect(getOperatorSymbol('is_not_null')).toBe('is not null');
  });
});

describe('generateFilterLabel', () => {
  it('should generate label for equals filter', () => {
    expect(generateFilterLabel('name', 'equals', 'John')).toBe('name = John');
  });

  it('should generate label for contains filter', () => {
    expect(generateFilterLabel('name', 'contains', 'john')).toBe('name ~ john');
  });

  it('should generate label for is_null filter', () => {
    expect(generateFilterLabel('email', 'is_null', '')).toBe('email is null');
  });

  it('should generate label for is_not_null filter', () => {
    expect(generateFilterLabel('email', 'is_not_null', '')).toBe(
      'email is not null'
    );
  });

  it('should generate label for between filter', () => {
    expect(generateFilterLabel('price', 'between', '10', '100')).toBe(
      'price 10 ↔ 100'
    );
  });

  it('should truncate long values in label', () => {
    const longValue = 'a'.repeat(30);
    const expected = `name = ${'a'.repeat(20)}...`;
    expect(generateFilterLabel('name', 'equals', longValue)).toBe(expected);
  });

  it('should truncate long second value in between filter', () => {
    const longValue = 'a'.repeat(30);
    const expected = `price 10 ↔ ${'a'.repeat(20)}...`;
    expect(generateFilterLabel('price', 'between', '10', longValue)).toBe(
      expected
    );
  });
});

describe('generateCompactFilterLabel', () => {
  it('should generate compact label for is_null', () => {
    expect(generateCompactFilterLabel('email', 'is_null', '')).toBe(
      'email: NULL'
    );
  });

  it('should generate compact label for is_not_null', () => {
    expect(generateCompactFilterLabel('email', 'is_not_null', '')).toBe(
      'email: NOT NULL'
    );
  });

  it('should generate compact label for between', () => {
    expect(generateCompactFilterLabel('price', 'between', '10', '100')).toBe(
      'price: 10–100'
    );
  });

  it('should generate compact label for contains with wildcards', () => {
    expect(generateCompactFilterLabel('name', 'contains', 'john')).toBe(
      'name: *john*'
    );
  });

  it('should generate compact label for starts_with with suffix wildcard', () => {
    expect(generateCompactFilterLabel('name', 'starts_with', 'prefix')).toBe(
      'name: prefix*'
    );
  });

  it('should generate compact label for ends_with with prefix wildcard', () => {
    expect(generateCompactFilterLabel('name', 'ends_with', 'suffix')).toBe(
      'name: *suffix'
    );
  });

  it('should generate compact label for equals with symbol', () => {
    expect(generateCompactFilterLabel('age', 'equals', '25')).toBe('age: = 25');
  });
});

describe('validateFilterValue', () => {
  describe('null operators', () => {
    it('should validate is_null without requiring value', () => {
      const result = validateFilterValue('is_null', '', undefined, 'text');
      expect(result.isValid).toBe(true);
    });

    it('should validate is_not_null without requiring value', () => {
      const result = validateFilterValue('is_not_null', '', undefined, 'text');
      expect(result.isValid).toBe(true);
    });
  });

  describe('required values', () => {
    it('should fail when value is required but empty', () => {
      const result = validateFilterValue('equals', '', undefined, 'text');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Value is required');
      expect(result.errorField).toBe('value');
    });

    it('should fail when value is only whitespace', () => {
      const result = validateFilterValue('equals', '   ', undefined, 'text');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Value is required');
    });

    it('should pass when value is provided', () => {
      const result = validateFilterValue('equals', 'test', undefined, 'text');
      expect(result.isValid).toBe(true);
    });
  });

  describe('between operator validation', () => {
    it('should fail when second value is missing for between', () => {
      const result = validateFilterValue('between', '10', undefined, 'numeric');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Second value is required for range filter');
      expect(result.errorField).toBe('secondValue');
    });

    it('should fail when second value is empty string for between', () => {
      const result = validateFilterValue('between', '10', '', 'numeric');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Second value is required for range filter');
    });

    it('should pass when both values provided for between (text)', () => {
      const result = validateFilterValue('between', 'A', 'Z', 'text');
      expect(result.isValid).toBe(true);
    });
  });

  describe('numeric validation for between', () => {
    it('should fail when first value is not a number', () => {
      const result = validateFilterValue('between', 'abc', '20', 'numeric');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('First value must be a valid number');
      expect(result.errorField).toBe('value');
    });

    it('should fail when second value is not a number', () => {
      const result = validateFilterValue('between', '10', 'abc', 'numeric');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Second value must be a valid number');
      expect(result.errorField).toBe('secondValue');
    });

    it('should fail when first value is greater than or equal to second', () => {
      const result = validateFilterValue('between', '20', '10', 'numeric');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('From value must be less than To value');
      expect(result.errorField).toBe('both');
    });

    it('should fail when values are equal', () => {
      const result = validateFilterValue('between', '10', '10', 'numeric');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('From value must be less than To value');
    });

    it('should pass when first value is less than second', () => {
      const result = validateFilterValue('between', '10', '20', 'numeric');
      expect(result.isValid).toBe(true);
    });
  });

  describe('numeric validation for comparison operators', () => {
    it('should fail when value is not numeric for equals on numeric column', () => {
      const result = validateFilterValue(
        'equals',
        'not-a-number',
        undefined,
        'numeric'
      );
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Value must be a valid number');
      expect(result.errorField).toBe('value');
    });

    it('should pass when value is numeric for equals on numeric column', () => {
      const result = validateFilterValue('equals', '42', undefined, 'numeric');
      expect(result.isValid).toBe(true);
    });

    it('should pass with decimal values for numeric column', () => {
      const result = validateFilterValue(
        'greater_than',
        '3.14',
        undefined,
        'numeric'
      );
      expect(result.isValid).toBe(true);
    });

    it('should pass with negative values for numeric column', () => {
      const result = validateFilterValue(
        'less_than',
        '-10',
        undefined,
        'numeric'
      );
      expect(result.isValid).toBe(true);
    });

    it('should validate greater_than operator on numeric column', () => {
      const result = validateFilterValue(
        'greater_than',
        'abc',
        undefined,
        'numeric'
      );
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Value must be a valid number');
    });

    it('should validate less_than operator on numeric column', () => {
      const result = validateFilterValue(
        'less_than',
        'xyz',
        undefined,
        'numeric'
      );
      expect(result.isValid).toBe(false);
    });

    it('should validate greater_than_or_equal on numeric column', () => {
      const result = validateFilterValue(
        'greater_than_or_equal',
        'foo',
        undefined,
        'numeric'
      );
      expect(result.isValid).toBe(false);
    });

    it('should validate less_than_or_equal on numeric column', () => {
      const result = validateFilterValue(
        'less_than_or_equal',
        'bar',
        undefined,
        'numeric'
      );
      expect(result.isValid).toBe(false);
    });
  });

  describe('text column validation', () => {
    it('should allow any string value for text column', () => {
      const result = validateFilterValue(
        'contains',
        'search text',
        undefined,
        'text'
      );
      expect(result.isValid).toBe(true);
    });

    it('should allow special characters in text filters', () => {
      const result = validateFilterValue(
        'equals',
        'test@example.com',
        undefined,
        'text'
      );
      expect(result.isValid).toBe(true);
    });
  });
});

describe('generateFilterId', () => {
  it('should generate unique IDs', () => {
    const id1 = generateFilterId();
    const id2 = generateFilterId();
    expect(id1).not.toBe(id2);
  });

  it('should generate IDs with filter- prefix', () => {
    const id = generateFilterId();
    expect(id.startsWith('filter-')).toBe(true);
  });

  it('should generate IDs with expected format', () => {
    const id = generateFilterId();
    expect(id).toMatch(/^filter-\d+-[a-z0-9]+$/);
  });
});

describe('convertUIFilterToAPIFilters', () => {
  it('should convert UIFilterState to FilterState array', () => {
    const uiFilter: UIFilterState = {
      id: 'filter-1',
      column: 'name',
      columnType: 'text',
      uiOperator: 'contains',
      value: 'john',
    };
    const result = convertUIFilterToAPIFilters(uiFilter);
    expect(result).toEqual([
      { column: 'name', operator: 'like', value: '%john%' },
    ]);
  });

  it('should handle between operator creating two filters', () => {
    const uiFilter: UIFilterState = {
      id: 'filter-1',
      column: 'price',
      columnType: 'numeric',
      uiOperator: 'between',
      value: '10',
      secondValue: '100',
    };
    const result = convertUIFilterToAPIFilters(uiFilter);
    expect(result).toEqual([
      { column: 'price', operator: 'gte', value: '10' },
      { column: 'price', operator: 'lte', value: '100' },
    ]);
  });
});

describe('convertUIFiltersToAPIFilters', () => {
  it('should convert multiple UIFilters to flat FilterState array', () => {
    const uiFilters: UIFilterState[] = [
      {
        id: 'filter-1',
        column: 'name',
        columnType: 'text',
        uiOperator: 'equals',
        value: 'John',
      },
      {
        id: 'filter-2',
        column: 'age',
        columnType: 'numeric',
        uiOperator: 'greater_than',
        value: '21',
      },
    ];
    const result = convertUIFiltersToAPIFilters(uiFilters);
    expect(result).toEqual([
      { column: 'name', operator: 'eq', value: 'John' },
      { column: 'age', operator: 'gt', value: '21' },
    ]);
  });

  it('should flatten between operator into multiple filters', () => {
    const uiFilters: UIFilterState[] = [
      {
        id: 'filter-1',
        column: 'price',
        columnType: 'numeric',
        uiOperator: 'between',
        value: '10',
        secondValue: '100',
      },
    ];
    const result = convertUIFiltersToAPIFilters(uiFilters);
    expect(result).toHaveLength(2);
    expect(result).toEqual([
      { column: 'price', operator: 'gte', value: '10' },
      { column: 'price', operator: 'lte', value: '100' },
    ]);
  });

  it('should return empty array for empty input', () => {
    const result = convertUIFiltersToAPIFilters([]);
    expect(result).toEqual([]);
  });
});

describe('operator definitions', () => {
  describe('tEXT_OPERATORS', () => {
    it('should have correct number of operators', () => {
      expect(TEXT_OPERATORS).toHaveLength(7);
    });

    it('should have is_null and is_not_null not requiring values', () => {
      const isNull = TEXT_OPERATORS.find((op) => op.value === 'is_null');
      const isNotNull = TEXT_OPERATORS.find((op) => op.value === 'is_not_null');
      expect(isNull?.requiresValue).toBe(false);
      expect(isNotNull?.requiresValue).toBe(false);
    });

    it('should have text operators requiring values', () => {
      const requiresValueOps = TEXT_OPERATORS.filter(
        (op) => op.value !== 'is_null' && op.value !== 'is_not_null'
      );
      expect(requiresValueOps.every((op) => op.requiresValue)).toBe(true);
    });
  });

  describe('nUMERIC_OPERATORS', () => {
    it('should have correct number of operators', () => {
      expect(NUMERIC_OPERATORS).toHaveLength(9);
    });

    it('should have between operator requiring second value', () => {
      const between = NUMERIC_OPERATORS.find((op) => op.value === 'between');
      expect(between?.requiresSecondValue).toBe(true);
    });

    it('should have comparison operators', () => {
      const comparisonOps = [
        'greater_than',
        'less_than',
        'greater_than_or_equal',
        'less_than_or_equal',
      ];
      comparisonOps.forEach((opValue) => {
        expect(
          NUMERIC_OPERATORS.find((op) => op.value === opValue)
        ).toBeDefined();
      });
    });
  });
});

import type { ColumnSchema, FilterState } from '../types/database';

// ============================================================================
// UI Operator Types
// ============================================================================

/**
 * UI-friendly operator names for text columns
 */
export type TextOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'starts_with'
  | 'ends_with'
  | 'is_null'
  | 'is_not_null';

/**
 * UI-friendly operator names for numeric columns
 */
export type NumericOperator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'between'
  | 'is_null'
  | 'is_not_null';

/**
 * All possible UI operator types
 */
export type UIOperator = TextOperator | NumericOperator;

/**
 * Column type categories for determining which operators to show
 */
export type ColumnTypeCategory =
  | 'text'
  | 'numeric'
  | 'date'
  | 'boolean'
  | 'unknown';

// ============================================================================
// Operator Definitions
// ============================================================================

export interface OperatorDefinition {
  value: UIOperator;
  label: string;
  requiresValue: boolean;
  /** For 'between' operator, requires two values */
  requiresSecondValue?: boolean;
}

/**
 * Text column operators with display labels
 */
export const TEXT_OPERATORS: OperatorDefinition[] = [
  { value: 'equals', label: 'Equals', requiresValue: true },
  { value: 'not_equals', label: 'Not equals', requiresValue: true },
  { value: 'contains', label: 'Contains', requiresValue: true },
  { value: 'starts_with', label: 'Starts with', requiresValue: true },
  { value: 'ends_with', label: 'Ends with', requiresValue: true },
  { value: 'is_null', label: 'Is null', requiresValue: false },
  { value: 'is_not_null', label: 'Is not null', requiresValue: false },
];

/**
 * Numeric column operators with display labels
 */
export const NUMERIC_OPERATORS: OperatorDefinition[] = [
  { value: 'equals', label: 'Equals', requiresValue: true },
  { value: 'not_equals', label: 'Not equals', requiresValue: true },
  { value: 'greater_than', label: 'Greater than', requiresValue: true },
  { value: 'less_than', label: 'Less than', requiresValue: true },
  {
    value: 'greater_than_or_equal',
    label: 'Greater than or equal',
    requiresValue: true,
  },
  {
    value: 'less_than_or_equal',
    label: 'Less than or equal',
    requiresValue: true,
  },
  {
    value: 'between',
    label: 'Between',
    requiresValue: true,
    requiresSecondValue: true,
  },
  { value: 'is_null', label: 'Is null', requiresValue: false },
  { value: 'is_not_null', label: 'Is not null', requiresValue: false },
];

// ============================================================================
// Column Type Detection
// ============================================================================

/**
 * SQLite type affinity patterns
 * Based on SQLite documentation: https://www.sqlite.org/datatype3.html
 */
const NUMERIC_TYPE_PATTERNS = [
  /^int/i,
  /^integer/i,
  /^tinyint/i,
  /^smallint/i,
  /^mediumint/i,
  /^bigint/i,
  /^unsigned big int/i,
  /^int2/i,
  /^int8/i,
  /^real/i,
  /^double/i,
  /^double precision/i,
  /^float/i,
  /^numeric/i,
  /^decimal/i,
  /^number/i,
];

const DATE_TYPE_PATTERNS = [
  /^date$/i,
  /^datetime$/i,
  /^timestamp$/i,
  /^time$/i,
];

const BOOLEAN_TYPE_PATTERNS = [/^bool$/i, /^boolean$/i];

const TEXT_TYPE_PATTERNS = [
  /^text/i,
  /^char/i,
  /^varchar/i,
  /^nchar/i,
  /^nvarchar/i,
  /^clob/i,
  /^string/i,
];

/**
 * Detect the column type category from SQLite column type string
 */
export function detectColumnTypeCategory(
  columnType: string
): ColumnTypeCategory {
  const type = columnType.trim();

  // Check for empty type - SQLite allows columns without explicit type
  if (!type) {
    return 'unknown';
  }

  // Check numeric types first (most specific)
  for (const pattern of NUMERIC_TYPE_PATTERNS) {
    if (pattern.test(type)) {
      return 'numeric';
    }
  }

  // Check date types
  for (const pattern of DATE_TYPE_PATTERNS) {
    if (pattern.test(type)) {
      return 'date';
    }
  }

  // Check boolean types
  for (const pattern of BOOLEAN_TYPE_PATTERNS) {
    if (pattern.test(type)) {
      return 'boolean';
    }
  }

  // Check text types
  for (const pattern of TEXT_TYPE_PATTERNS) {
    if (pattern.test(type)) {
      return 'text';
    }
  }

  // Default to text for unknown types (most flexible)
  return 'text';
}

/**
 * Get column type category from ColumnSchema
 */
export function getColumnTypeCategory(
  column: ColumnSchema
): ColumnTypeCategory {
  return detectColumnTypeCategory(column.type);
}

/**
 * Get appropriate operators for a column type
 */
export function getOperatorsForColumnType(
  typeCategory: ColumnTypeCategory
): OperatorDefinition[] {
  switch (typeCategory) {
    case 'numeric':
    case 'date':
      return NUMERIC_OPERATORS;
    case 'boolean':
      // Boolean columns typically use equals/not equals and null checks
      return [
        { value: 'equals', label: 'Equals', requiresValue: true },
        { value: 'not_equals', label: 'Not equals', requiresValue: true },
        { value: 'is_null', label: 'Is null', requiresValue: false },
        { value: 'is_not_null', label: 'Is not null', requiresValue: false },
      ];
    case 'text':
    case 'unknown':
    default:
      return TEXT_OPERATORS;
  }
}

// ============================================================================
// Operator Mapping: UI -> FilterState
// ============================================================================

/**
 * Map a UI operator to FilterState operator(s)
 *
 * Some UI operators map directly to FilterState operators,
 * while others (like 'contains') require value transformation,
 * and 'between' requires creating two separate filters.
 */
export interface MappedFilter {
  operator: FilterState['operator'];
  value: string;
}

/**
 * Map a UI operator and value(s) to one or more FilterState-compatible filters
 *
 * @param uiOperator - The UI-friendly operator
 * @param value - The primary filter value
 * @param secondValue - The second value (for 'between' operator)
 * @returns Array of mapped filters (usually one, but two for 'between')
 */
export function mapOperatorToFilterState(
  uiOperator: UIOperator,
  value: string,
  secondValue?: string
): MappedFilter[] {
  switch (uiOperator) {
    case 'equals':
      return [{ operator: 'eq', value }];

    case 'not_equals':
      return [{ operator: 'neq', value }];

    case 'contains':
      return [{ operator: 'like', value: `%${value}%` }];

    case 'starts_with':
      return [{ operator: 'like', value: `${value}%` }];

    case 'ends_with':
      return [{ operator: 'like', value: `%${value}` }];

    case 'is_null':
      return [{ operator: 'isnull', value: '' }];

    case 'is_not_null':
      return [{ operator: 'notnull', value: '' }];

    case 'greater_than':
      return [{ operator: 'gt', value }];

    case 'less_than':
      return [{ operator: 'lt', value }];

    case 'greater_than_or_equal':
      return [{ operator: 'gte', value }];

    case 'less_than_or_equal':
      return [{ operator: 'lte', value }];

    case 'between':
      // 'between' creates two filters: >= min AND <= max
      return [
        { operator: 'gte', value },
        { operator: 'lte', value: secondValue || '' },
      ];

    default:
      // Fallback for any unhandled operator
      return [{ operator: 'eq', value }];
  }
}

/**
 * Create FilterState objects from UI operator and value(s)
 *
 * @param column - The column name to filter
 * @param uiOperator - The UI-friendly operator
 * @param value - The primary filter value
 * @param secondValue - The second value (for 'between' operator)
 * @returns Array of FilterState objects ready for API
 */
export function createFiltersFromUIOperator(
  column: string,
  uiOperator: UIOperator,
  value: string,
  secondValue?: string
): FilterState[] {
  const mappedFilters = mapOperatorToFilterState(
    uiOperator,
    value,
    secondValue
  );
  return mappedFilters.map((mapped) => ({
    column,
    operator: mapped.operator,
    value: mapped.value,
  }));
}

// ============================================================================
// Filter Label Generation
// ============================================================================

/**
 * Operator symbol mapping for compact display
 */
const OPERATOR_SYMBOLS: Record<UIOperator, string> = {
  equals: '=',
  not_equals: '≠',
  contains: '~',
  starts_with: '^',
  ends_with: '$',
  is_null: 'is null',
  is_not_null: 'is not null',
  greater_than: '>',
  less_than: '<',
  greater_than_or_equal: '≥',
  less_than_or_equal: '≤',
  between: '↔',
};

/**
 * Get operator label by value
 */
export function getOperatorLabel(uiOperator: UIOperator): string {
  const allOperators = [...TEXT_OPERATORS, ...NUMERIC_OPERATORS];
  const found = allOperators.find((op) => op.value === uiOperator);
  return found?.label || uiOperator;
}

/**
 * Get compact operator symbol for display in filter chips
 */
export function getOperatorSymbol(uiOperator: UIOperator): string {
  return OPERATOR_SYMBOLS[uiOperator] || uiOperator;
}

/**
 * Generate a human-readable filter label for display in chips
 *
 * @param columnName - The column being filtered
 * @param uiOperator - The UI operator
 * @param value - The primary filter value
 * @param secondValue - The second value (for 'between' operator)
 * @returns Human-readable filter description
 */
export function generateFilterLabel(
  columnName: string,
  uiOperator: UIOperator,
  value: string,
  secondValue?: string
): string {
  const symbol = getOperatorSymbol(uiOperator);

  // Truncate long values for display
  const maxValueLength = 20;
  const displayValue =
    value.length > maxValueLength
      ? `${value.substring(0, maxValueLength)}...`
      : value;

  switch (uiOperator) {
    case 'is_null':
    case 'is_not_null':
      return `${columnName} ${symbol}`;

    case 'between': {
      const displaySecond =
        secondValue && secondValue.length > maxValueLength
          ? `${secondValue.substring(0, maxValueLength)}...`
          : secondValue || '';
      return `${columnName} ${displayValue} ${symbol} ${displaySecond}`;
    }

    default:
      return `${columnName} ${symbol} ${displayValue}`;
  }
}

/**
 * Generate a compact filter label (column: value format)
 */
export function generateCompactFilterLabel(
  columnName: string,
  uiOperator: UIOperator,
  value: string,
  secondValue?: string
): string {
  switch (uiOperator) {
    case 'is_null':
      return `${columnName}: NULL`;
    case 'is_not_null':
      return `${columnName}: NOT NULL`;
    case 'between':
      return `${columnName}: ${value}–${secondValue || ''}`;
    case 'contains':
      return `${columnName}: *${value}*`;
    case 'starts_with':
      return `${columnName}: ${value}*`;
    case 'ends_with':
      return `${columnName}: *${value}`;
    default:
      return `${columnName}: ${getOperatorSymbol(uiOperator)} ${value}`;
  }
}

// ============================================================================
// Filter Validation
// ============================================================================

/**
 * Indicates which input field has an error
 */
export type FilterErrorField = 'value' | 'secondValue' | 'both' | null;

export interface FilterValidationResult {
  isValid: boolean;
  error?: string;
  /** Which input field has the error (for highlighting specific inputs) */
  errorField?: FilterErrorField;
}

/**
 * Validate filter value based on operator and column type
 *
 * Validates:
 * - Non-null operators require values
 * - Numeric columns require valid numeric input
 * - Between operator requires both values, and min < max for numeric columns
 */
export function validateFilterValue(
  uiOperator: UIOperator,
  value: string,
  secondValue: string | undefined,
  columnTypeCategory: ColumnTypeCategory
): FilterValidationResult {
  // Null checks don't require values
  if (uiOperator === 'is_null' || uiOperator === 'is_not_null') {
    return { isValid: true };
  }

  // All other operators require a value
  if (!value.trim()) {
    return { isValid: false, error: 'Value is required', errorField: 'value' };
  }

  // Between operator requires second value
  if (uiOperator === 'between') {
    if (!secondValue?.trim()) {
      return {
        isValid: false,
        error: 'Second value is required for range filter',
        errorField: 'secondValue',
      };
    }

    // For numeric columns, validate both values are numbers and min < max
    if (columnTypeCategory === 'numeric') {
      const numValue = Number.parseFloat(value);
      const numSecondValue = Number.parseFloat(secondValue);

      if (Number.isNaN(numValue)) {
        return {
          isValid: false,
          error: 'First value must be a valid number',
          errorField: 'value',
        };
      }
      if (Number.isNaN(numSecondValue)) {
        return {
          isValid: false,
          error: 'Second value must be a valid number',
          errorField: 'secondValue',
        };
      }
      if (numValue >= numSecondValue) {
        return {
          isValid: false,
          error: 'From value must be less than To value',
          errorField: 'both',
        };
      }
    }
  }

  // Validate numeric input for numeric operators on numeric columns
  if (columnTypeCategory === 'numeric') {
    const numericOperators: UIOperator[] = [
      'equals',
      'not_equals',
      'greater_than',
      'less_than',
      'greater_than_or_equal',
      'less_than_or_equal',
    ];

    if (numericOperators.includes(uiOperator)) {
      const numValue = Number.parseFloat(value);
      if (Number.isNaN(numValue)) {
        return {
          isValid: false,
          error: 'Value must be a valid number',
          errorField: 'value',
        };
      }
    }
  }

  return { isValid: true };
}

// ============================================================================
// Extended Filter State (for UI tracking)
// ============================================================================

/**
 * Extended filter state that includes UI-specific information
 * This is used internally by the filter UI to track the original operator
 * and values before conversion to FilterState for the API
 */
export interface UIFilterState {
  id: string;
  column: string;
  columnType: ColumnTypeCategory;
  uiOperator: UIOperator;
  value: string;
  secondValue?: string;
}

/**
 * Generate a unique ID for a filter
 */
export function generateFilterId(): string {
  return `filter-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Convert UIFilterState to FilterState array for API
 */
export function convertUIFilterToAPIFilters(
  uiFilter: UIFilterState
): FilterState[] {
  return createFiltersFromUIOperator(
    uiFilter.column,
    uiFilter.uiOperator,
    uiFilter.value,
    uiFilter.secondValue
  );
}

/**
 * Convert an array of UIFilterStates to FilterState array for API
 */
export function convertUIFiltersToAPIFilters(
  uiFilters: UIFilterState[]
): FilterState[] {
  return uiFilters.flatMap(convertUIFilterToAPIFilters);
}

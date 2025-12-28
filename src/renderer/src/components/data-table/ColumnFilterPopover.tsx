import type {
  ColumnTypeCategory,
  FilterErrorField,
  OperatorDefinition,
  UIFilterState,
  UIOperator,
} from '@/lib/filter-utils';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  generateFilterId,
  getOperatorsForColumnType,
  validateFilterValue,
} from '@/lib/filter-utils';
import { cn } from '@/lib/utils';

interface ColumnFilterPopoverProps {
  /** Column name to filter */
  columnName: string;
  /** Column type category for determining available operators */
  columnType: ColumnTypeCategory;
  /** Existing filter for this column (if any) */
  existingFilter?: UIFilterState;
  /** Callback when filter is applied */
  onApply: (filter: UIFilterState) => void;
  /** Callback when filter is cleared */
  onClear: () => void;
  /** Whether the popover is open (controlled) */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Trigger element */
  children: React.ReactNode;
}

/**
 * A popover component for configuring column filters.
 * Displays operator selector, value input(s), and apply/clear buttons.
 * Handles special cases like 'is null' (no value input) and 'between' (two inputs).
 */
export function ColumnFilterPopover({
  columnName,
  columnType,
  existingFilter,
  onApply,
  onClear,
  open,
  onOpenChange,
  children,
}: ColumnFilterPopoverProps) {
  const operators = getOperatorsForColumnType(columnType);
  const defaultOperator = operators[0]?.value || 'equals';

  // Local state for filter configuration
  const [selectedOperator, setSelectedOperator] = useState<UIOperator>(
    existingFilter?.uiOperator || defaultOperator
  );
  const [value, setValue] = useState(existingFilter?.value || '');
  const [secondValue, setSecondValue] = useState(
    existingFilter?.secondValue || ''
  );
  const [error, setError] = useState<string | undefined>();
  const [errorField, setErrorField] = useState<FilterErrorField>(null);

  // Get current operator definition
  const currentOperator = operators.find(
    (op) => op.value === selectedOperator
  ) as OperatorDefinition | undefined;

  // Reset state when popover opens or existing filter changes
  useEffect(() => {
    /* eslint-disable react-hooks-extra/no-direct-set-state-in-use-effect -- Intentionally sync state with props */
    if (existingFilter) {
      setSelectedOperator(existingFilter.uiOperator);
      setValue(existingFilter.value);
      setSecondValue(existingFilter.secondValue || '');
    } else {
      setSelectedOperator(defaultOperator);
      setValue('');
      setSecondValue('');
    }
    setError(undefined);
    setErrorField(null);
    /* eslint-enable react-hooks-extra/no-direct-set-state-in-use-effect */
  }, [existingFilter, defaultOperator, open]);

  // Clear values when operator changes if the new operator doesn't require values
  const handleOperatorChange = useCallback(
    (newOperator: string) => {
      setSelectedOperator(newOperator as UIOperator);
      setError(undefined);
      setErrorField(null);

      const newOpDef = operators.find((op) => op.value === newOperator);
      if (!newOpDef?.requiresValue) {
        setValue('');
        setSecondValue('');
      } else if (!newOpDef?.requiresSecondValue) {
        setSecondValue('');
      }
    },
    [operators]
  );

  // Handle apply button click
  const handleApply = useCallback(() => {
    // Validate the filter
    const validation = validateFilterValue(
      selectedOperator,
      value,
      secondValue,
      columnType
    );

    if (!validation.isValid) {
      setError(validation.error);
      setErrorField(validation.errorField || null);
      return;
    }

    // Create the filter
    const filter: UIFilterState = {
      id: existingFilter?.id || generateFilterId(),
      column: columnName,
      columnType,
      uiOperator: selectedOperator,
      value: value.trim(),
      secondValue: currentOperator?.requiresSecondValue
        ? secondValue.trim()
        : undefined,
    };

    onApply(filter);
    onOpenChange?.(false);
  }, [
    selectedOperator,
    value,
    secondValue,
    columnType,
    columnName,
    existingFilter,
    currentOperator,
    onApply,
    onOpenChange,
  ]);

  // Handle clear button click
  const handleClear = useCallback(() => {
    setValue('');
    setSecondValue('');
    setSelectedOperator(defaultOperator);
    setError(undefined);
    setErrorField(null);
    onClear();
    onOpenChange?.(false);
  }, [defaultOperator, onClear, onOpenChange]);

  // Handle Enter key in input
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleApply();
      }
    },
    [handleApply]
  );

  const showValueInput = currentOperator?.requiresValue ?? true;
  const showSecondValueInput = currentOperator?.requiresSecondValue ?? false;

  // Determine which inputs should show error styling
  const hasValueError = errorField === 'value' || errorField === 'both';
  const hasSecondValueError =
    errorField === 'secondValue' || errorField === 'both';

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-72 p-3"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-3">
          {/* Header */}
          <div className="text-sm font-medium">
            Filter: <span className="text-muted-foreground">{columnName}</span>
          </div>

          {/* Operator selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-muted-foreground text-xs">Operator</label>
            <Select
              value={selectedOperator}
              onValueChange={handleOperatorChange}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select operator" />
              </SelectTrigger>
              <SelectContent>
                {operators.map((op) => (
                  <SelectItem key={op.value} value={op.value}>
                    {op.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Value input(s) */}
          {showValueInput && (
            <div className="flex flex-col gap-1.5">
              <label className="text-muted-foreground text-xs">
                {showSecondValueInput ? 'From' : 'Value'}
              </label>
              <Input
                className={cn('h-9', hasValueError && 'border-destructive')}
                type={columnType === 'numeric' ? 'number' : 'text'}
                placeholder={
                  columnType === 'numeric'
                    ? 'Enter number...'
                    : 'Enter value...'
                }
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setError(undefined);
                  setErrorField(null);
                }}
                onKeyDown={handleKeyDown}
                autoFocus
              />
            </div>
          )}

          {/* Second value input for 'between' */}
          {showSecondValueInput && (
            <div className="flex flex-col gap-1.5">
              <label className="text-muted-foreground text-xs">To</label>
              <Input
                className={cn(
                  'h-9',
                  hasSecondValueError && 'border-destructive'
                )}
                type={columnType === 'numeric' ? 'number' : 'text'}
                placeholder={
                  columnType === 'numeric'
                    ? 'Enter number...'
                    : 'Enter value...'
                }
                value={secondValue}
                onChange={(e) => {
                  setSecondValue(e.target.value);
                  setError(undefined);
                  setErrorField(null);
                }}
                onKeyDown={handleKeyDown}
              />
            </div>
          )}

          {/* Validation error */}
          {error && <div className="text-destructive text-xs">{error}</div>}

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-1">
            <Button
              variant="default"
              size="sm"
              className="flex-1"
              onClick={handleApply}
            >
              Apply
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handleClear}
              disabled={!existingFilter && !value && !secondValue}
            >
              Clear
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

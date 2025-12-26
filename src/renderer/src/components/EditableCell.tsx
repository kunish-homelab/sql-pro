import type { ColumnSchema } from '@/types/database';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface EditableCellProps {
  value: unknown;
  column?: ColumnSchema;
  /** @deprecated Use column.type instead */
  type: string;
  isEditing: boolean;
  hasChange: boolean;
  oldValue?: unknown;
  onEdit: () => void;
  onSave: (value: unknown) => void;
  onCancel: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export function EditableCell({
  value,
  column,
  type,
  isEditing,
  hasChange,
  oldValue,
  onEdit,
  onSave,
  onCancel,
  onKeyDown,
}: EditableCellProps) {
  const [editValue, setEditValue] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Use column.type if available, otherwise fall back to type prop
  const columnType = column?.type ?? type;

  useEffect(() => {
    if (isEditing) {
      // Initialize edit value when entering edit mode - this is intentional
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
      setEditValue(value === null ? '' : String(value));
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
      setValidationError(null);
      const timeoutId = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(timeoutId);
    }
  }, [isEditing, value]);

  const validateValue = (val: string): string | null => {
    // Check NOT NULL constraint
    if (column && !column.nullable) {
      if (val === '' || val.toLowerCase() === 'null') {
        return 'This field cannot be empty';
      }
    }

    // Type validation for numeric types
    if (columnType.toLowerCase().includes('int')) {
      if (val !== '' && val.toLowerCase() !== 'null') {
        const parsed = Number.parseInt(val, 10);
        if (Number.isNaN(parsed)) {
          return 'Must be a valid integer';
        }
      }
    } else if (
      columnType.toLowerCase().includes('real') ||
      columnType.toLowerCase().includes('float') ||
      columnType.toLowerCase().includes('double')
    ) {
      if (val !== '' && val.toLowerCase() !== 'null') {
        const parsed = Number.parseFloat(val);
        if (Number.isNaN(parsed)) {
          return 'Must be a valid number';
        }
      }
    }

    return null;
  };

  const handleSave = () => {
    // Validate before saving
    const error = validateValue(editValue);
    if (error) {
      setValidationError(error);
      return;
    }

    let newValue: unknown = editValue;

    // Convert to appropriate type
    if (editValue === '' || editValue.toLowerCase() === 'null') {
      newValue = null;
    } else if (columnType.toLowerCase().includes('int')) {
      newValue = Number.parseInt(editValue, 10);
      if (Number.isNaN(newValue as number)) newValue = editValue;
    } else if (
      columnType.toLowerCase().includes('real') ||
      columnType.toLowerCase().includes('float') ||
      columnType.toLowerCase().includes('double')
    ) {
      newValue = Number.parseFloat(editValue);
      if (Number.isNaN(newValue as number)) newValue = editValue;
    }

    setValidationError(null);
    onSave(newValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      // Save current value before navigating
      handleSave();
      // Forward Tab to parent for navigation
      onKeyDown?.(e);
    } else if (e.key === 'Enter') {
      handleSave();
      // Forward Enter to parent for navigation
      onKeyDown?.(e);
    } else if (e.key === 'Escape') {
      setValidationError(null);
      onCancel();
      onKeyDown?.(e);
    }
  };

  if (isEditing) {
    return (
      <div className="relative w-full">
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => {
            setEditValue(e.target.value);
            // Clear error when user types
            if (validationError) {
              setValidationError(null);
            }
          }}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className={cn(
            'bg-background w-full px-1 py-0.5 text-sm ring-2 outline-none',
            validationError ? 'ring-destructive' : 'ring-ring'
          )}
          aria-invalid={!!validationError}
          aria-describedby={validationError ? 'cell-error' : undefined}
        />
        {validationError && (
          <div
            id="cell-error"
            className="bg-destructive text-destructive-foreground absolute -top-6 left-0 z-50 rounded px-1.5 py-0.5 text-xs whitespace-nowrap shadow-sm"
          >
            {validationError}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onDoubleClick={onEdit}
      className={cn(
        'flex h-full w-full cursor-pointer items-center overflow-hidden',
        hasChange && 'bg-amber-500/20'
      )}
      title={
        hasChange && oldValue !== undefined
          ? `Original: ${oldValue}`
          : undefined
      }
    >
      <CellDisplay value={value} type={columnType} />
    </div>
  );
}

function CellDisplay({ value, type }: { value: unknown; type: string }) {
  if (value === null) {
    return <span className="text-muted-foreground text-sm italic">NULL</span>;
  }

  if (typeof value === 'boolean') {
    return <span className="text-sm">{value ? 'true' : 'false'}</span>;
  }

  if (typeof value === 'number') {
    return <span className="font-mono text-sm tabular-nums">{value}</span>;
  }

  if (type.toLowerCase().includes('blob')) {
    return <span className="text-muted-foreground text-sm italic">[BLOB]</span>;
  }

  const strValue = String(value);
  return (
    <span className="text-sm whitespace-nowrap" title={strValue}>
      {strValue}
    </span>
  );
}

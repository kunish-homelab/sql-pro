import type { Cell } from '@tanstack/react-table';
import type { ReactNode } from 'react';
import type { TableRowData } from './hooks/useTableCore';
import type { ColumnSchema } from '@/types/database';
import { flexRender } from '@tanstack/react-table';
import { memo, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface TableCellProps {
  cell: Cell<TableRowData, unknown>;
  isFocused: boolean;
  isEditing: boolean;
  hasChange: boolean;
  oldValue?: unknown;
  onEdit: () => void;
  onSave: (value: unknown) => void;
  onCancel: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onClick?: () => void;
  /** Whether this column is pinned */
  isPinned?: boolean;
  /** Offset for pinned columns */
  pinnedOffset?: number;
  /** Whether this is the last pinned column */
  isLastPinned?: boolean;
}

export const TableCell = memo(
  ({
    cell,
    isFocused,
    isEditing,
    hasChange,
    oldValue,
    onEdit,
    onSave,
    onCancel,
    onKeyDown,
    onClick,
    isPinned,
    pinnedOffset,
    isLastPinned,
  }: TableCellProps) => {
    const [editValue, setEditValue] = useState('');
    const [validationError, setValidationError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const value = cell.getValue();
    const columnMeta = cell.column.columnDef.meta as
      | { schema?: ColumnSchema; type?: string }
      | undefined;
    const columnSchema = columnMeta?.schema;
    const columnType = columnSchema?.type ?? columnMeta?.type ?? 'text';

    // Initialize edit value when entering edit mode
    useEffect(() => {
      if (isEditing) {
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
      if (columnSchema && !columnSchema.nullable) {
        if (val === '' || val.toLowerCase() === 'null') {
          return 'This field cannot be empty';
        }
      }

      // Type validation for numeric types
      const type = columnType.toLowerCase();
      if (type.includes('int')) {
        if (val !== '' && val.toLowerCase() !== 'null') {
          const parsed = Number.parseInt(val, 10);
          if (Number.isNaN(parsed)) {
            return 'Must be a valid integer';
          }
        }
      } else if (
        type.includes('real') ||
        type.includes('float') ||
        type.includes('double')
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
      const error = validateValue(editValue);
      if (error) {
        setValidationError(error);
        return;
      }

      let newValue: unknown = editValue;
      const type = columnType.toLowerCase();

      // Convert to appropriate type
      if (editValue === '' || editValue.toLowerCase() === 'null') {
        newValue = null;
      } else if (type.includes('int')) {
        newValue = Number.parseInt(editValue, 10);
        if (Number.isNaN(newValue as number)) newValue = editValue;
      } else if (
        type.includes('real') ||
        type.includes('float') ||
        type.includes('double')
      ) {
        newValue = Number.parseFloat(editValue);
        if (Number.isNaN(newValue as number)) newValue = editValue;
      }

      setValidationError(null);
      onSave(newValue);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Tab') {
        handleSave();
        onKeyDown?.(e);
      } else if (e.key === 'Enter') {
        handleSave();
        onKeyDown?.(e);
      } else if (e.key === 'Escape') {
        setValidationError(null);
        onCancel();
        onKeyDown?.(e);
      }
    };

    // Calculate pinned styles
    const pinnedStyles: React.CSSProperties = {};
    if (isPinned) {
      pinnedStyles.position = 'sticky';
      pinnedStyles.left = pinnedOffset ?? 0;
      pinnedStyles.zIndex = 1;
    }

    const pinnedClassName = cn(
      isPinned && 'bg-background',
      isLastPinned &&
        'after:bg-border after:absolute after:top-0 after:right-0 after:bottom-0 after:w-px after:shadow-[2px_0_4px_rgba(0,0,0,0.1)]'
    );

    // For grouped cells, show the aggregated value
    if (cell.getIsAggregated()) {
      const renderedValue =
        flexRender(cell.column.columnDef.aggregatedCell, cell.getContext()) ??
        (cell.renderValue() as ReactNode);
      return (
        <td
          className={cn(
            'text-muted-foreground border-border border-r border-b px-2 py-1 text-sm whitespace-nowrap',
            pinnedClassName
          )}
          style={pinnedStyles}
        >
          {renderedValue}
        </td>
      );
    }

    // For placeholder cells in grouped rows
    if (cell.getIsPlaceholder()) {
      return (
        <td
          className={cn('border-border border-r border-b', pinnedClassName)}
          style={pinnedStyles}
        />
      );
    }

    // Edit mode
    if (isEditing) {
      return (
        <td
          className={cn(
            'border-border relative border-r border-b p-0',
            pinnedClassName
          )}
          style={pinnedStyles}
        >
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => {
              setEditValue(e.target.value);
              if (validationError) {
                setValidationError(null);
              }
            }}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className={cn(
              'bg-background h-full w-full px-2 py-1 text-sm ring-2 outline-none ring-inset',
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
        </td>
      );
    }

    // Display mode
    return (
      <td
        onClick={onClick}
        onDoubleClick={onEdit}
        className={cn(
          'border-border cursor-pointer border-r border-b px-2 py-1 whitespace-nowrap',
          isFocused && 'ring-ring ring-2 ring-inset',
          hasChange && 'bg-amber-500/20',
          pinnedClassName
        )}
        style={pinnedStyles}
        title={
          hasChange && oldValue !== undefined
            ? `Original: ${oldValue}`
            : undefined
        }
      >
        <CellDisplay value={value} type={columnType} />
      </td>
    );
  }
);

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

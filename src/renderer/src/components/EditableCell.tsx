import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface EditableCellProps {
  value: unknown;
  type: string;
  isEditing: boolean;
  hasChange: boolean;
  oldValue?: unknown;
  onEdit: () => void;
  onSave: (value: unknown) => void;
  onCancel: () => void;
}

export function EditableCell({
  value,
  type,
  isEditing,
  hasChange,
  oldValue,
  onEdit,
  onSave,
  onCancel,
}: EditableCellProps) {
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      setEditValue(value === null ? '' : String(value));
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isEditing, value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  const handleSave = () => {
    let newValue: unknown = editValue;

    // Convert to appropriate type
    if (editValue === '' || editValue.toLowerCase() === 'null') {
      newValue = null;
    } else if (type.toLowerCase().includes('int')) {
      newValue = parseInt(editValue, 10);
      if (isNaN(newValue as number)) newValue = editValue;
    } else if (
      type.toLowerCase().includes('real') ||
      type.toLowerCase().includes('float') ||
      type.toLowerCase().includes('double')
    ) {
      newValue = parseFloat(editValue);
      if (isNaN(newValue as number)) newValue = editValue;
    }

    onSave(newValue);
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className="w-full bg-background px-1 py-0.5 text-sm outline-none ring-2 ring-ring"
      />
    );
  }

  return (
    <div
      onDoubleClick={onEdit}
      className={cn(
        'flex h-full w-full cursor-pointer items-center truncate',
        hasChange && 'bg-amber-500/20'
      )}
      title={
        hasChange && oldValue !== undefined
          ? `Original: ${oldValue}`
          : undefined
      }
    >
      <CellDisplay value={value} type={type} />
    </div>
  );
}

function CellDisplay({ value, type }: { value: unknown; type: string }) {
  if (value === null) {
    return <span className="text-sm italic text-muted-foreground">NULL</span>;
  }

  if (typeof value === 'boolean') {
    return <span className="text-sm">{value ? 'true' : 'false'}</span>;
  }

  if (typeof value === 'number') {
    return <span className="font-mono text-sm tabular-nums">{value}</span>;
  }

  if (type.toLowerCase().includes('blob')) {
    return <span className="text-sm italic text-muted-foreground">[BLOB]</span>;
  }

  const strValue = String(value);
  if (strValue.length > 100) {
    return (
      <span className="truncate text-sm" title={strValue}>
        {strValue.substring(0, 100)}...
      </span>
    );
  }

  return <span className="truncate text-sm">{strValue}</span>;
}

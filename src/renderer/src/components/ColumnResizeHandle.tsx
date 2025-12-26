import { cn } from '@/lib/utils';

interface ColumnResizeHandleProps {
  onMouseDown: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
  isResizing?: boolean;
}

/**
 * A draggable handle for resizing table columns.
 * - Drag to resize the column width
 * - Double-click to auto-fit to content
 */
export function ColumnResizeHandle({
  onMouseDown,
  onDoubleClick,
  isResizing = false,
}: ColumnResizeHandleProps) {
  return (
    <div
      className={cn(
        'absolute right-0 top-0 z-20 h-full w-1 cursor-col-resize',
        'hover:bg-primary/50 active:bg-primary',
        'transition-colors duration-75',
        isResizing && 'bg-primary'
      )}
      onMouseDown={onMouseDown}
      onDoubleClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDoubleClick();
      }}
      title="Drag to resize, double-click to auto-fit"
    />
  );
}

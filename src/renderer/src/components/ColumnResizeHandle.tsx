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
        // Visual bar is 2px wide, but the hit area extends 4px on each side
        'absolute top-0 -right-1 z-20 h-full w-2 cursor-col-resize',
        // Use pseudo-element for larger hit area
        'before:absolute before:inset-y-0 before:-right-2 before:-left-2 before:content-[""]',
        // Visual indicator
        'hover:bg-primary/50 active:bg-primary bg-transparent',
        'transition-colors duration-75',
        isResizing && 'bg-primary'
      )}
      onMouseDown={onMouseDown}
      onDoubleClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDoubleClick();
      }}
      title="Drag to resize, double-click to reset"
    />
  );
}

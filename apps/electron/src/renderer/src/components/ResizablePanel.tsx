import { useCallback, useEffect, useRef } from 'react';
import { usePanelWidth } from '@/lib/panel-width';
import { cn } from '@/lib/utils';

interface ResizablePanelProps {
  children: React.ReactNode;
  defaultWidth: number;
  minWidth?: number;
  maxWidth?: number;
  side: 'left' | 'right';
  className?: string;
  storageKey?: string;
}

export function ResizablePanel({
  children,
  defaultWidth,
  minWidth = 150,
  maxWidth = 600,
  side,
  className,
  storageKey,
}: ResizablePanelProps) {
  // Use persistent panel width hook
  const [width, setWidth] = usePanelWidth(
    storageKey || 'default',
    defaultWidth,
    minWidth,
    maxWidth
  );

  const isResizingRef = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isResizingRef.current = true;
      startXRef.current = e.clientX;
      startWidthRef.current = width;
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';

      const handleMouseMove = (e: MouseEvent) => {
        if (!isResizingRef.current) return;

        const delta =
          side === 'left'
            ? e.clientX - startXRef.current
            : startXRef.current - e.clientX;

        const newWidth = Math.min(
          Math.max(startWidthRef.current + delta, minWidth),
          maxWidth
        );
        setWidth(newWidth);
      };

      const handleMouseUp = () => {
        isResizingRef.current = false;
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [width, side, minWidth, maxWidth, setWidth]
  );

  const handleDoubleClick = useCallback(() => {
    setWidth(defaultWidth);
  }, [defaultWidth, setWidth]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, []);

  return (
    <div
      ref={panelRef}
      className={cn('relative flex shrink-0 overflow-hidden', className)}
      style={{ width }}
    >
      {/* Resize handle */}
      <div
        className={cn(
          'hover:bg-primary/50 absolute top-0 z-10 h-full w-1 cursor-col-resize transition-colors',
          side === 'left' ? 'right-0' : 'left-0'
        )}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
      />

      {/* Panel content - children handle their own scrolling */}
      <div className="h-full min-h-0 w-full min-w-0">{children}</div>
    </div>
  );
}

import type { DragCancelEvent, DragEndEvent } from '@dnd-kit/core';
import type { DatabaseConnection } from '@/types/database';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlertCircle, CheckCircle, Circle, Palette, X } from 'lucide-react';
import { memo } from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useConnectionStore } from '@/stores';

// Preset colors for connection tabs
const PRESET_COLORS = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Green', value: '#10b981' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Lime', value: '#84cc16' },
  { name: 'Amber', value: '#f59e0b' },
];

/**
 * Validates if a string is a valid hex color code
 * Supports both 3-digit (#RGB) and 6-digit (#RRGGBB) formats
 */
const isValidHexColor = (color: string): boolean => {
  // Check for valid hex color format: #RGB or #RRGGBB
  const hexColorRegex = /^#(?:[A-F0-9]{6}|[A-F0-9]{3})$/i;
  return hexColorRegex.test(color);
};

interface ConnectionTabBarProps {
  className?: string;
}

interface ConnectionTabProps {
  connection: DatabaseConnection;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
}

const ConnectionTab = memo(
  ({ connection, isActive, onSelect, onClose }: ConnectionTabProps) => {
    const { getConnectionColor, setConnectionColor } = useConnectionStore();
    const connectionColor = getConnectionColor(connection.id) || '#3b82f6'; // default blue

    // Set up drag and drop for this tab
    const { attributes, listeners, setNodeRef, transform, transition } =
      useSortable({ id: connection.id });

    // Status icon based on connection status
    const StatusIcon =
      connection.status === 'connected'
        ? CheckCircle
        : connection.status === 'error'
          ? AlertCircle
          : Circle;

    const statusColorClass =
      connection.status === 'connected'
        ? 'text-green-500'
        : connection.status === 'error'
          ? 'text-red-500'
          : 'text-muted-foreground';

    const handleCloseClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      onClose();
    };

    const handleColorSelect = (color: string) => {
      // Validate color before setting it
      if (isValidHexColor(color)) {
        setConnectionColor(connection.id, color);
      }
    };

    return (
      <ContextMenu>
        <ContextMenuTrigger>
          <TooltipProvider delay={300}>
            <Tooltip>
              <TooltipTrigger>
                <div
                  ref={setNodeRef}
                  aria-selected={isActive}
                  className={cn(
                    'group relative flex h-8 max-w-45 min-w-25 cursor-pointer items-center gap-1.5 border-r px-2 text-sm transition-colors',
                    isActive
                      ? 'bg-background text-foreground'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                  style={{
                    transform: CSS.Transform.toString(transform),
                    transition,
                    borderBottomWidth: '2px',
                    borderBottomStyle: 'solid',
                    borderBottomColor: isActive
                      ? connectionColor
                      : 'transparent',
                  }}
                  onClick={onSelect}
                  {...attributes}
                  {...listeners}
                >
                  <StatusIcon
                    className={cn('h-3.5 w-3.5 shrink-0', statusColorClass)}
                  />
                  <span className="flex-1 truncate">{connection.filename}</span>
                  <Tooltip>
                    <TooltipTrigger>
                      <button
                        onClick={handleCloseClick}
                        className={cn(
                          'hover:bg-accent shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100',
                          isActive && 'opacity-60'
                        )}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      Close connection
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                <div className="flex flex-col gap-1">
                  <div className="font-medium">{connection.filename}</div>
                  <div className="text-muted-foreground text-xs">
                    {connection.path}
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <Palette className="mr-2 h-4 w-4" />
              Set Color
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <div className="grid grid-cols-3 gap-1 p-1">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => handleColorSelect(color.value)}
                    className={cn(
                      'group relative flex h-10 w-16 items-center justify-center rounded border-2 transition-all hover:scale-105',
                      connectionColor === color.value
                        ? 'border-foreground ring-foreground/20 ring-2'
                        : 'border-border hover:border-foreground/50'
                    )}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  >
                    {connectionColor === color.value && (
                      <CheckCircle className="h-4 w-4 text-white drop-shadow-md" />
                    )}
                  </button>
                ))}
              </div>
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={onClose}>Close</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  }
);

ConnectionTab.displayName = 'ConnectionTab';

export const ConnectionTabBar = memo(({ className }: ConnectionTabBarProps) => {
  const {
    activeConnectionId,
    connectionTabOrder,
    getAllConnections,
    setActiveConnection,
    removeConnection,
    reorderConnections,
  } = useConnectionStore();

  const allConnections = getAllConnections();

  // Sort connections by tab order
  const orderedConnections = connectionTabOrder
    .map((id) => allConnections.find((conn) => conn.id === id))
    .filter((conn): conn is DatabaseConnection => conn !== undefined);

  // Add any connections not in the tab order (shouldn't happen normally)
  const unorderedConnections = allConnections.filter(
    (conn) => !connectionTabOrder.includes(conn.id)
  );
  const connections = [...orderedConnections, ...unorderedConnections];

  // Set up sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end to update tab order in store
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = connections.findIndex((conn) => conn.id === active.id);
      const newIndex = connections.findIndex((conn) => conn.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        reorderConnections(oldIndex, newIndex);
      }
    }
  };

  // Handle drag cancel - called when drag is cancelled (e.g., dragged outside droppable area)
  const handleDragCancel = (_event: DragCancelEvent) => {
    // No action needed - tab will return to original position automatically
    // This handler ensures the drag operation is properly cancelled
  };

  if (connections.length === 0) {
    return null;
  }

  return (
    <DndContext
      sensors={sensors}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div
        className={cn('bg-muted/30 flex h-8 items-center border-b', className)}
        role="tablist"
      >
        <SortableContext
          items={connections.map((conn) => conn.id)}
          strategy={horizontalListSortingStrategy}
        >
          <div className="scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent hover:scrollbar-thumb-muted-foreground/40 flex flex-1 items-center overflow-x-auto">
            {connections.map((connection) => (
              <ConnectionTab
                key={connection.id}
                connection={connection}
                isActive={connection.id === activeConnectionId}
                onSelect={() => setActiveConnection(connection.id)}
                onClose={() => removeConnection(connection.id)}
              />
            ))}
          </div>
        </SortableContext>
      </div>
    </DndContext>
  );
});

ConnectionTabBar.displayName = 'ConnectionTabBar';

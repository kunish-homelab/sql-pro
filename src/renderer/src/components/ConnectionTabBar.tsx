import type { DatabaseConnection } from '@/types/database';
import { AlertCircle, CheckCircle, Circle, X } from 'lucide-react';
import { memo } from 'react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useConnectionStore } from '@/stores';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { DragEndEvent } from '@dnd-kit/core';

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
    const { getConnectionColor } = useConnectionStore();
    const connectionColor = getConnectionColor(connection.id) || '#3b82f6'; // default blue

    // Set up drag and drop for this tab
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
    } = useSortable({ id: connection.id });

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

    return (
      <TooltipProvider delay={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              ref={setNodeRef}
              role="tab"
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
                borderBottomColor: isActive ? connectionColor : 'transparent',
              }}
              onClick={onSelect}
              {...attributes}
              {...listeners}
            >
              <StatusIcon className={cn('h-3.5 w-3.5 shrink-0', statusColorClass)} />
              <span className="flex-1 truncate">{connection.filename}</span>
              <Tooltip>
                <TooltipTrigger asChild>
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
              <div className="text-muted-foreground text-xs">{connection.path}</div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
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

  if (connections.length === 0) {
    return null;
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div
        className={cn('bg-muted/30 flex h-8 items-center border-b', className)}
        role="tablist"
      >
        <SortableContext
          items={connections.map((conn) => conn.id)}
          strategy={horizontalListSortingStrategy}
        >
          <div className="flex flex-1 items-center overflow-x-auto">
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

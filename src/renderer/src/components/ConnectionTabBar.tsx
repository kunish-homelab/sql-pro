import type { DatabaseConnection } from '@/types/database';
import { memo } from 'react';
import { cn } from '@/lib/utils';
import { useConnectionStore } from '@/stores';

interface ConnectionTabBarProps {
  className?: string;
}

interface ConnectionTabProps {
  connection: DatabaseConnection;
  isActive: boolean;
  onSelect: () => void;
}

const ConnectionTab = memo(
  ({ connection, isActive, onSelect }: ConnectionTabProps) => {
    return (
      <div
        role="tab"
        aria-selected={isActive}
        className={cn(
          'group relative flex h-8 max-w-45 min-w-25 cursor-pointer items-center gap-1 border-r px-2 text-sm transition-colors',
          isActive
            ? 'bg-background text-foreground'
            : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
        )}
        onClick={onSelect}
      >
        <span className="flex-1 truncate">{connection.filename}</span>
      </div>
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

  if (connections.length === 0) {
    return null;
  }

  return (
    <div
      className={cn('bg-muted/30 flex h-8 items-center border-b', className)}
      role="tablist"
    >
      <div className="flex flex-1 items-center overflow-x-auto">
        {connections.map((connection) => (
          <ConnectionTab
            key={connection.id}
            connection={connection}
            isActive={connection.id === activeConnectionId}
            onSelect={() => setActiveConnection(connection.id)}
          />
        ))}
      </div>
    </div>
  );
});

ConnectionTabBar.displayName = 'ConnectionTabBar';

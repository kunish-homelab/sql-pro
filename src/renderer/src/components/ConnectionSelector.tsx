import type { RecentConnection } from '@shared/types';
import type { DatabaseConnection } from '@/types/database';
import {
  AlertCircle,
  Check,
  ChevronDown,
  Clock,
  Database,
  Plus,
  X,
} from 'lucide-react';
import { useCallback, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useChangesStore, useConnectionStore } from '@/stores';

interface ConnectionSelectorProps {
  onOpenDatabase?: () => void;
  onOpenRecentConnection?: (
    path: string,
    isEncrypted: boolean,
    readOnly?: boolean
  ) => void;
  className?: string;
}

export function ConnectionSelector({
  onOpenDatabase,
  onOpenRecentConnection,
  className,
}: ConnectionSelectorProps) {
  const {
    connections,
    activeConnectionId,
    setActiveConnection,
    removeConnection,
    getAllConnections,
    recentConnections,
  } = useConnectionStore();

  const { changes, clearChanges } = useChangesStore();
  const [isOpen, setIsOpen] = useState(false);
  const [pendingSwitchId, setPendingSwitchId] = useState<string | null>(null);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

  const allConnections = getAllConnections();
  const activeConnection = activeConnectionId
    ? connections.get(activeConnectionId)
    : null;

  // Filter recent connections to exclude currently open ones
  const openPaths = new Set(allConnections.map((c) => c.path));
  const filteredRecentConnections = recentConnections.filter(
    (rc) => !openPaths.has(rc.path)
  );

  // Check if there are unsaved changes for the current connection
  const hasUnsavedChanges = changes.length > 0;

  const handleConnectionSelect = useCallback(
    (connectionId: string) => {
      if (connectionId === activeConnectionId) {
        setIsOpen(false);
        return;
      }

      if (hasUnsavedChanges) {
        setPendingSwitchId(connectionId);
        setShowUnsavedDialog(true);
        return;
      }

      setActiveConnection(connectionId);
      setIsOpen(false);
    },
    [activeConnectionId, hasUnsavedChanges, setActiveConnection]
  );

  const handleConfirmSwitch = useCallback(() => {
    if (pendingSwitchId) {
      clearChanges();
      setActiveConnection(pendingSwitchId);
      setPendingSwitchId(null);
    }
    setShowUnsavedDialog(false);
    setIsOpen(false);
  }, [pendingSwitchId, clearChanges, setActiveConnection]);

  const handleCancelSwitch = useCallback(() => {
    setPendingSwitchId(null);
    setShowUnsavedDialog(false);
  }, []);

  const handleCloseConnection = useCallback(
    (e: React.MouseEvent, connectionId: string) => {
      e.stopPropagation();
      // TODO: Check for unsaved changes before closing
      removeConnection(connectionId);
    },
    [removeConnection]
  );

  const handleOpenDatabase = useCallback(() => {
    setIsOpen(false);
    onOpenDatabase?.();
  }, [onOpenDatabase]);

  const handleRecentClick = useCallback(
    (conn: RecentConnection) => {
      setIsOpen(false);
      onOpenRecentConnection?.(conn.path, conn.isEncrypted, conn.readOnly);
    },
    [onOpenRecentConnection]
  );

  // Get connection status indicator color
  const getStatusColor = (connection: DatabaseConnection) => {
    switch (connection.status) {
      case 'connected':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  };

  // If no connections, show just the "Open Database" button
  if (allConnections.length === 0) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={onOpenDatabase}
        className={cn('w-full justify-start gap-2', className)}
      >
        <Plus className="h-4 w-4" />
        <span>Open Database...</span>
      </Button>
    );
  }

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'w-full justify-between gap-2 font-normal',
              className
            )}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={cn(
                  'h-2 w-2 shrink-0 rounded-full',
                  activeConnection
                    ? getStatusColor(activeConnection)
                    : 'bg-gray-400'
                )}
              />
              <Database className="text-muted-foreground h-4 w-4 shrink-0" />
              <span className="truncate">
                {activeConnection?.filename || 'No connection'}
              </span>
              {hasUnsavedChanges && (
                <Tooltip>
                  <TooltipTrigger>
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                  </TooltipTrigger>
                  <TooltipContent>Unsaved changes</TooltipContent>
                </Tooltip>
              )}
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          className="min-w-(--radix-dropdown-menu-trigger-width)"
        >
          {/* Open connections */}
          {allConnections.length > 0 && (
            <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
              Open Connections
            </DropdownMenuLabel>
          )}
          {allConnections.map((conn) => (
            <DropdownMenuItem
              key={conn.id}
              className="group flex cursor-pointer items-center justify-between gap-2 pr-2"
              onClick={() => handleConnectionSelect(conn.id)}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    'h-2 w-2 shrink-0 rounded-full',
                    getStatusColor(conn)
                  )}
                />
                <span className="truncate">{conn.filename}</span>
                {conn.isReadOnly && (
                  <span className="bg-muted text-muted-foreground shrink-0 rounded px-1 py-0.5 text-[10px]">
                    R/O
                  </span>
                )}
                {conn.isEncrypted && (
                  <span className="bg-muted text-muted-foreground shrink-0 rounded px-1 py-0.5 text-[10px]">
                    🔒
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {conn.id === activeConnectionId && (
                  <Check className="text-primary h-4 w-4" />
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100"
                  onClick={(e) => handleCloseConnection(e, conn.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </DropdownMenuItem>
          ))}

          {/* Recent connections */}
          {filteredRecentConnections.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-muted-foreground flex items-center gap-1.5 text-xs font-normal">
                <Clock className="h-3 w-3" />
                Recent
              </DropdownMenuLabel>
              {filteredRecentConnections.slice(0, 5).map((conn) => (
                <DropdownMenuItem
                  key={conn.path}
                  className="cursor-pointer gap-2"
                  onClick={() => handleRecentClick(conn)}
                >
                  <Database className="text-muted-foreground h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {conn.displayName || conn.filename}
                  </span>
                  {conn.readOnly && (
                    <span className="bg-muted text-muted-foreground shrink-0 rounded px-1 py-0.5 text-[10px]">
                      R/O
                    </span>
                  )}
                  {conn.isEncrypted && (
                    <span className="bg-muted text-muted-foreground shrink-0 rounded px-1 py-0.5 text-[10px]">
                      🔒
                    </span>
                  )}
                </DropdownMenuItem>
              ))}
            </>
          )}

          <DropdownMenuSeparator />

          {/* Open new database */}
          <DropdownMenuItem
            className="cursor-pointer gap-2"
            onClick={handleOpenDatabase}
          >
            <Plus className="h-4 w-4" />
            <span>Open Database...</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Unsaved Changes Dialog */}
      <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes in the current connection. If you switch
              to another connection, your changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelSwitch}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSwitch}>
              Discard & Switch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

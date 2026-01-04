import type { PendingChangeInfo, RecentConnection } from '@shared/types';
import type { DatabaseConnection } from '@/types/database';
import { Button } from '@sqlpro/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@sqlpro/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@sqlpro/ui/tooltip';
import { Check, ChevronDown, Clock, Database, Plus, X } from 'lucide-react';
import { useCallback, useState } from 'react';
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog';
import { cn } from '@/lib/utils';
import { useChangesStore, useConnectionStore, useTableFont } from '@/stores';

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

  const {
    hasChangesForConnection,
    getChangesForConnection,
    clearChangesForConnection,
  } = useChangesStore();
  const tableFont = useTableFont();
  const [isOpen, setIsOpen] = useState(false);
  const [pendingSwitchId, setPendingSwitchId] = useState<string | null>(null);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingCloseId, setPendingCloseId] = useState<string | null>(null);
  const [showCloseDialog, setShowCloseDialog] = useState(false);

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
  const hasUnsavedChanges =
    activeConnectionId !== null && hasChangesForConnection(activeConnectionId);
  const currentChanges = activeConnectionId
    ? getChangesForConnection(activeConnectionId)
    : [];

  // Get changes for the connection being closed
  const pendingCloseChanges = pendingCloseId
    ? getChangesForConnection(pendingCloseId)
    : [];

  const handleConnectionSelect = useCallback(
    (connectionId: string) => {
      if (connectionId === activeConnectionId) {
        setIsOpen(false);
        return;
      }

      // Guard: prevent showing multiple dialogs on rapid actions
      if (showUnsavedDialog) return;

      if (hasUnsavedChanges) {
        setPendingSwitchId(connectionId);
        setShowUnsavedDialog(true);
        return;
      }

      setActiveConnection(connectionId);
      setIsOpen(false);
    },
    [
      activeConnectionId,
      hasUnsavedChanges,
      setActiveConnection,
      showUnsavedDialog,
    ]
  );

  const handleSaveAndSwitch = useCallback(async () => {
    if (!activeConnectionId || !activeConnection || !pendingSwitchId) return;

    const changes = getChangesForConnection(activeConnectionId);

    // Convert PendingChange[] to PendingChangeInfo[]
    const changeInfos: PendingChangeInfo[] = changes.map((change) => ({
      id: change.id,
      table: change.table,
      schema: change.schema,
      rowId: change.rowId,
      type: change.type,
      oldValues: change.oldValues,
      newValues: change.newValues,
      primaryKeyColumn: change.primaryKeyColumn,
    }));

    const response = await window.sqlPro.db.applyChanges({
      connectionId: activeConnection.id,
      changes: changeInfos,
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to apply changes');
    }

    // Clear changes and switch connection
    clearChangesForConnection(activeConnectionId);
    setActiveConnection(pendingSwitchId);
    setPendingSwitchId(null);
    setIsOpen(false);
  }, [
    activeConnectionId,
    activeConnection,
    pendingSwitchId,
    getChangesForConnection,
    clearChangesForConnection,
    setActiveConnection,
  ]);

  const handleDiscardAndSwitch = useCallback(() => {
    if (activeConnectionId && pendingSwitchId) {
      clearChangesForConnection(activeConnectionId);
      setActiveConnection(pendingSwitchId);
      setPendingSwitchId(null);
    }
    setShowUnsavedDialog(false);
    setIsOpen(false);
  }, [
    activeConnectionId,
    pendingSwitchId,
    clearChangesForConnection,
    setActiveConnection,
  ]);

  const handleCancelSwitch = useCallback(() => {
    setPendingSwitchId(null);
    // Dialog stays open, do not switch
  }, []);

  const handleSaveAndClose = useCallback(async () => {
    if (!pendingCloseId) return;

    const connection = connections.get(pendingCloseId);
    if (!connection) return;

    const changes = getChangesForConnection(pendingCloseId);

    // Convert PendingChange[] to PendingChangeInfo[]
    const changeInfos: PendingChangeInfo[] = changes.map((change) => ({
      id: change.id,
      table: change.table,
      schema: change.schema,
      rowId: change.rowId,
      type: change.type,
      oldValues: change.oldValues,
      newValues: change.newValues,
      primaryKeyColumn: change.primaryKeyColumn,
    }));

    const response = await window.sqlPro.db.applyChanges({
      connectionId: connection.id,
      changes: changeInfos,
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to apply changes');
    }

    // Clear changes and close connection
    clearChangesForConnection(pendingCloseId);
    removeConnection(pendingCloseId);
    setPendingCloseId(null);
  }, [
    pendingCloseId,
    connections,
    getChangesForConnection,
    clearChangesForConnection,
    removeConnection,
  ]);

  const handleDiscardAndClose = useCallback(() => {
    if (pendingCloseId) {
      clearChangesForConnection(pendingCloseId);
      removeConnection(pendingCloseId);
      setPendingCloseId(null);
    }
    setShowCloseDialog(false);
  }, [pendingCloseId, clearChangesForConnection, removeConnection]);

  const handleCancelClose = useCallback(() => {
    setPendingCloseId(null);
  }, []);

  const handleCloseConnection = useCallback(
    (e: React.MouseEvent, connectionId: string) => {
      e.stopPropagation();

      // Guard: prevent showing multiple dialogs on rapid clicks
      if (showCloseDialog) return;

      // Check if connection has unsaved changes
      if (hasChangesForConnection(connectionId)) {
        setPendingCloseId(connectionId);
        setShowCloseDialog(true);
        return;
      }

      // No unsaved changes, proceed with closing
      removeConnection(connectionId);
    },
    [hasChangesForConnection, removeConnection, showCloseDialog]
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
            style={{
              fontFamily: tableFont.family || undefined,
              fontSize: tableFont.size ? `${tableFont.size}px` : undefined,
            }}
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
              {hasUnsavedChanges && (
                <Tooltip>
                  <TooltipTrigger>
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                  </TooltipTrigger>
                  <TooltipContent>Unsaved changes</TooltipContent>
                </Tooltip>
              )}
              <Database className="text-muted-foreground h-4 w-4 shrink-0" />
              <span className="truncate">
                {activeConnection?.filename || 'No connection'}
              </span>
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          className="min-w-(--radix-dropdown-menu-trigger-width)"
          style={{
            fontFamily: tableFont.family || undefined,
            fontSize: tableFont.size ? `${tableFont.size}px` : undefined,
          }}
        >
          {/* Open connections */}
          {allConnections.length > 0 && (
            <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
              Open Connections
            </DropdownMenuLabel>
          )}
          {allConnections.map((conn) => {
            const connectionHasUnsavedChanges = hasChangesForConnection(
              conn.id
            );
            return (
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
                  {connectionHasUnsavedChanges && (
                    <Tooltip>
                      <TooltipTrigger>
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                      </TooltipTrigger>
                      <TooltipContent>Unsaved changes</TooltipContent>
                    </Tooltip>
                  )}
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
            );
          })}

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

      {/* Unsaved Changes Dialog for connection switching */}
      {activeConnectionId && (
        <UnsavedChangesDialog
          open={showUnsavedDialog}
          onOpenChange={setShowUnsavedDialog}
          changes={currentChanges}
          connectionId={activeConnectionId}
          onSave={handleSaveAndSwitch}
          onDiscard={handleDiscardAndSwitch}
          onCancel={handleCancelSwitch}
        />
      )}

      {/* Unsaved Changes Dialog for connection closing */}
      {pendingCloseId && (
        <UnsavedChangesDialog
          open={showCloseDialog}
          onOpenChange={setShowCloseDialog}
          changes={pendingCloseChanges}
          connectionId={pendingCloseId}
          onSave={handleSaveAndClose}
          onDiscard={handleDiscardAndClose}
          onCancel={handleCancelClose}
        />
      )}
    </>
  );
}

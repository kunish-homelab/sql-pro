import type { PendingChangeInfo } from '@shared/types';
import type { PendingChange } from '@/types/database';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { AppQuitDialog } from '@/components/AppQuitDialog';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SqlLogPanel } from '@/components/SqlLogPanel';
import { TooltipProvider } from '@/components/ui/tooltip';
import { sqlPro } from '@/lib/api';
import { initMockMode, isMockMode } from '@/lib/mock-api';
import { queryClient } from '@/lib/query-client';
import { router } from '@/routes';
import {
  useAIStore,
  useConnectionStore,
  useProStore,
  useQueryTabsStore,
  useTableDataStore,
  useThemeStore,
} from '@/stores';
import { useChangesStore } from '@/stores/changes-store';

function App(): React.JSX.Element {
  const {
    setRecentConnections,
    addConnection,
    setSchema,
    activeConnectionId,
    getAllConnections,
  } = useConnectionStore();
  const { setActiveConnectionId: setTabsActiveConnection } =
    useQueryTabsStore();
  const { setActiveConnectionId: setTableDataActiveConnection } =
    useTableDataStore();
  const { loadTheme } = useThemeStore();
  const { loadSettings: loadAISettings } = useAIStore();
  const { loadStatus: loadProStatus } = useProStore();
  const {
    getChangesForConnection,
    hasChangesForConnection,
    clearChangesForConnection,
  } = useChangesStore();

  // App quit dialog state
  const [showQuitDialog, setShowQuitDialog] = useState(false);
  const [connectionsWithChanges, setConnectionsWithChanges] = useState<
    Array<{
      connectionId: string;
      dbPath: string;
      changes: PendingChange[];
      inserts: number;
      updates: number;
      deletes: number;
    }>
  >([]);

  // Load theme and AI settings from main process on mount
  useEffect(() => {
    loadTheme();
    loadAISettings();
  }, [loadTheme, loadAISettings]);

  // Load Pro status on mount
  useEffect(() => {
    loadProStatus();
  }, [loadProStatus]);

  // Sync active connection across stores
  useEffect(() => {
    if (activeConnectionId) {
      setTabsActiveConnection(activeConnectionId);
      setTableDataActiveConnection(activeConnectionId);
    }
  }, [
    activeConnectionId,
    setTabsActiveConnection,
    setTableDataActiveConnection,
  ]);

  // Load recent connections on mount
  useEffect(() => {
    const loadRecentConnections = async () => {
      // Initialize mock mode if enabled
      if (isMockMode()) {
        // Check if we should skip auto-connect (for screenshot purposes)
        const hashParams = new URLSearchParams(
          window.location.hash.split('?')[1] || ''
        );
        const skipAutoConnect = hashParams.get('skipAutoConnect') === 'true';

        if (!skipAutoConnect) {
          const mockData = await initMockMode();
          if (mockData) {
            addConnection(mockData.connection);
            if (mockData.schema) {
              setSchema(mockData.connection.id, mockData.schema);
            }
            // Navigate to database view after mock connection is set
            router.navigate({ to: '/database' });
            return;
          }
        }
      }

      const result = await sqlPro.app.getRecentConnections();
      if (result.success && result.connections) {
        setRecentConnections(result.connections);
      }
    };
    loadRecentConnections();
  }, [setRecentConnections, addConnection, setSchema]);

  // Listen for quit prevention event from main process
  useEffect(() => {
    const cleanup = sqlPro.app.onBeforeQuit(() => {
      // Guard: prevent showing multiple dialogs on rapid quit attempts
      if (showQuitDialog) return;

      // Check all connections for unsaved changes
      const allConnections = getAllConnections();
      const connectionsWithUnsavedChanges = allConnections
        .filter((conn) => hasChangesForConnection(conn.id))
        .map((conn) => {
          const changes = getChangesForConnection(conn.id);
          const inserts = changes.filter((c) => c.type === 'insert').length;
          const updates = changes.filter((c) => c.type === 'update').length;
          const deletes = changes.filter((c) => c.type === 'delete').length;

          return {
            connectionId: conn.id,
            dbPath: conn.path || conn.id,
            changes,
            inserts,
            updates,
            deletes,
          };
        });

      if (connectionsWithUnsavedChanges.length > 0) {
        // Show dialog to user
        setConnectionsWithChanges(connectionsWithUnsavedChanges);
        setShowQuitDialog(true);
      } else {
        // No unsaved changes, allow quit
        sqlPro.app.confirmQuit(true);
      }
    });

    return cleanup;
  }, [
    getAllConnections,
    hasChangesForConnection,
    getChangesForConnection,
    showQuitDialog,
  ]);

  // Handle save all changes and quit
  const handleSaveAndQuit = async () => {
    // Apply changes for all connections with unsaved changes
    for (const conn of connectionsWithChanges) {
      // Convert PendingChange[] to PendingChangeInfo[]
      const changeInfos: PendingChangeInfo[] = conn.changes.map((change) => ({
        id: change.id,
        table: change.table,
        schema: change.schema,
        rowId: change.rowId,
        type: change.type,
        oldValues: change.oldValues,
        newValues: change.newValues,
        primaryKeyColumn: change.primaryKeyColumn,
      }));

      const result = await sqlPro.db.applyChanges({
        connectionId: conn.connectionId,
        changes: changeInfos,
      });

      if (!result.success) {
        throw new Error(
          result.error || `Failed to apply changes for ${conn.dbPath}`
        );
      }

      // Clear changes after successful apply
      clearChangesForConnection(conn.connectionId);
    }

    // All changes saved successfully, allow quit
    await sqlPro.app.confirmQuit(true);
  };

  // Handle discard all changes and quit
  const handleDiscardAndQuit = () => {
    // Clear all changes for connections with unsaved changes
    connectionsWithChanges.forEach((conn) => {
      clearChangesForConnection(conn.connectionId);
    });

    // Allow quit
    sqlPro.app.confirmQuit(true);
  };

  // Handle cancel quit
  const handleCancelQuit = () => {
    // Do not quit, just close the dialog
    sqlPro.app.confirmQuit(false);
  };

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <RouterProvider router={router} />
          <SqlLogPanel />
          <AppQuitDialog
            open={showQuitDialog}
            onOpenChange={setShowQuitDialog}
            connectionsWithChanges={connectionsWithChanges}
            onSave={handleSaveAndQuit}
            onDiscard={handleDiscardAndQuit}
            onCancel={handleCancelQuit}
          />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;

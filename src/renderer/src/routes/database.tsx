import type { ConnectionSettings } from '@/components/ConnectionSettingsDialog';
import { useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';
import { ConnectionSettingsDialog } from '@/components/ConnectionSettingsDialog';
import { DatabaseView } from '@/components/DatabaseView';
import { PasswordDialog } from '@/components/PasswordDialog';
import { sqlPro } from '@/lib/api';
import {
  useChangesStore,
  useConnectionStore,
  useQueryTabsStore,
  useTableDataStore,
} from '@/stores';

/**
 * Database page route component.
 * Displays the database view and handles navigation when disconnected.
 * Now supports multiple database connections.
 *
 * Navigation:
 * - Data Browser, SQL Query, ER Diagram, Schema Compare, and Data Diff tabs
 *   are managed in DatabaseView component (not as separate routes)
 */
export function DatabasePage() {
  const navigate = useNavigate();
  const {
    connection,
    activeConnectionId,
    addConnection,
    setSchema,
    // setActiveConnection is available but not used currently
    setIsConnecting,
    setIsLoadingSchema,
    setError,
    setRecentConnections,
  } = useConnectionStore();

  const { setActiveConnectionId: setTabsActiveConnection } =
    useQueryTabsStore();
  const { setActiveConnectionId: setTableDataActiveConnection } =
    useTableDataStore();
  // clearChangesForConnection available for future use
  useChangesStore();

  // Dialog states
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [pendingFilename, setPendingFilename] = useState<string>('');
  const [pendingIsEncrypted, setPendingIsEncrypted] = useState(false);
  const [pendingSettings, setPendingSettings] =
    useState<ConnectionSettings | null>(null);

  // Navigate back to welcome when no connections
  useEffect(() => {
    if (!connection && !activeConnectionId) {
      navigate({ to: '/' });
    }
  }, [connection, activeConnectionId, navigate]);

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

  // Connect to a database
  const connectToDatabase = useCallback(
    async (
      path: string,
      password?: string,
      readOnly?: boolean,
      settings?: ConnectionSettings
    ) => {
      setIsConnecting(true);
      setError(null);

      try {
        const result = await sqlPro.db.open({ path, password, readOnly });

        if (!result.success) {
          if (result.needsPassword) {
            // Try saved password first
            const savedPasswordResult = await sqlPro.password.get({
              dbPath: path,
            });
            if (savedPasswordResult.success && savedPasswordResult.password) {
              setIsConnecting(false);
              await connectToDatabase(path, savedPasswordResult.password);
              return;
            }

            // Show password dialog
            setPendingPath(path);
            setPasswordDialogOpen(true);
            setIsConnecting(false);
            return;
          }
          setError(result.error || 'Failed to open database');
          setIsConnecting(false);
          return;
        }

        if (result.connection) {
          // Save connection settings if provided
          if (settings) {
            await sqlPro.connection.update({
              path: result.connection.path,
              displayName: settings.displayName,
              readOnly: settings.readOnly,
            });
          }

          // Add connection to store (this will also set it as active)
          addConnection({
            id: result.connection.id,
            path: result.connection.path,
            filename: result.connection.filename,
            isEncrypted: result.connection.isEncrypted,
            isReadOnly: result.connection.isReadOnly,
            status: 'connected',
          });

          // Load schema for this connection
          setIsLoadingSchema(true);
          const schemaResult = await sqlPro.db.getSchema({
            connectionId: result.connection.id,
          });

          if (schemaResult.success) {
            setSchema(result.connection.id, {
              schemas: schemaResult.schemas || [],
              tables: schemaResult.tables || [],
              views: schemaResult.views || [],
            });
          }
          setIsLoadingSchema(false);

          // Refresh recent connections
          const connectionsResult = await sqlPro.app.getRecentConnections();
          if (connectionsResult.success && connectionsResult.connections) {
            setRecentConnections(connectionsResult.connections);
          }

          // Clear pending state
          setPendingPath(null);
          setPendingSettings(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsConnecting(false);
      }
    },
    [
      addConnection,
      setSchema,
      setIsConnecting,
      setIsLoadingSchema,
      setError,
      setRecentConnections,
    ]
  );

  // Open database file dialog
  const handleOpenDatabase = useCallback(async () => {
    const result = await sqlPro.dialog.openFile();
    if (result.success && result.filePath && !result.canceled) {
      const filePath = result.filePath;
      const filename = filePath.split('/').pop() || filePath;

      // Check if encrypted
      setIsConnecting(true);
      const probeResult = await sqlPro.db.open({ path: filePath });
      setIsConnecting(false);

      const isEncrypted = probeResult.needsPassword === true;

      // Show settings dialog for new connections
      setPendingPath(filePath);
      setPendingFilename(filename);
      setPendingIsEncrypted(isEncrypted);
      setSettingsDialogOpen(true);
    }
  }, [setIsConnecting]);

  // Open a recent connection directly (skip file picker and settings dialog)
  const handleOpenRecentConnection = useCallback(
    async (path: string, isEncrypted: boolean, readOnly?: boolean) => {
      const filename = path.split('/').pop() || path;
      setPendingPath(path);
      setPendingFilename(filename);
      setPendingIsEncrypted(isEncrypted);
      setPendingSettings(
        readOnly
          ? { displayName: filename, readOnly, rememberPassword: false }
          : null
      );

      if (isEncrypted) {
        // Check for saved password
        const savedPasswordResult = await sqlPro.password.get({ dbPath: path });
        if (savedPasswordResult.success && savedPasswordResult.password) {
          await connectToDatabase(path, savedPasswordResult.password, readOnly);
        } else {
          setPasswordDialogOpen(true);
        }
      } else {
        await connectToDatabase(path, undefined, readOnly);
      }
    },
    [connectToDatabase]
  );

  // Handle settings dialog submit
  const handleSettingsSubmit = useCallback(
    async (settings: ConnectionSettings) => {
      if (!pendingPath) return;

      setSettingsDialogOpen(false);
      setPendingSettings(settings);

      if (pendingIsEncrypted) {
        // Check for saved password
        const savedPasswordResult = await sqlPro.password.get({
          dbPath: pendingPath,
        });
        if (savedPasswordResult.success && savedPasswordResult.password) {
          await connectToDatabase(
            pendingPath,
            savedPasswordResult.password,
            settings.readOnly,
            settings
          );
        } else {
          setPasswordDialogOpen(true);
        }
      } else {
        await connectToDatabase(
          pendingPath,
          undefined,
          settings.readOnly,
          settings
        );
      }
    },
    [pendingPath, pendingIsEncrypted, connectToDatabase]
  );

  // Handle password dialog submit
  const handlePasswordSubmit = useCallback(
    async (password: string, remember: boolean) => {
      if (!pendingPath) return;

      setPasswordDialogOpen(false);

      const shouldRemember =
        remember || pendingSettings?.rememberPassword || false;

      if (shouldRemember) {
        await sqlPro.password.save({ dbPath: pendingPath, password });
      }

      await connectToDatabase(
        pendingPath,
        password,
        pendingSettings?.readOnly,
        pendingSettings ?? undefined
      );
    },
    [pendingPath, pendingSettings, connectToDatabase]
  );

  if (!connection) {
    return null;
  }

  return (
    <>
      <DatabaseView
        onOpenDatabase={handleOpenDatabase}
        onOpenRecentConnection={handleOpenRecentConnection}
      />

      {/* Connection Settings Dialog */}
      <ConnectionSettingsDialog
        open={settingsDialogOpen}
        onOpenChange={setSettingsDialogOpen}
        filename={pendingFilename}
        dbPath={pendingPath || ''}
        isEncrypted={pendingIsEncrypted}
        onSubmit={handleSettingsSubmit}
      />

      {/* Password Dialog */}
      <PasswordDialog
        open={passwordDialogOpen}
        onOpenChange={setPasswordDialogOpen}
        filename={pendingFilename}
        dbPath={pendingPath || ''}
        onSubmit={handlePasswordSubmit}
      />
    </>
  );
}

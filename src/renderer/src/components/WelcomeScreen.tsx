import type { DragEvent } from 'react';
import type { RecentConnection } from '../../../shared/types';
import type { ConnectionSettings } from './ConnectionSettingsDialog';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  AlertCircle,
  Clock,
  Database,
  Eye,
  FolderOpen,
  KeyRound,
  Monitor,
  Moon,
  MoreVertical,
  Settings,
  Sun,
  Trash2,
  Upload,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { sqlPro } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useConnectionStore, useThemeStore } from '@/stores';
import { ConnectionSettingsDialog } from './ConnectionSettingsDialog';
import { PasswordDialog } from './PasswordDialog';

// Supported database file extensions
const DB_EXTENSIONS = ['.db', '.sqlite', '.sqlite3', '.db3', '.s3db', '.sl3'];

function isDatabaseFile(filename: string): boolean {
  const lowerName = filename.toLowerCase();
  return DB_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
}

// Check if a database has a saved password - moved to top level
function HasSavedPasswordIndicator({ path }: { path: string }) {
  const [hasSaved, setHasSaved] = useState(false);

  // Check on mount
  useEffect(() => {
    sqlPro.password.has({ dbPath: path }).then((result) => {
      setHasSaved(result.hasPassword);
    });
  }, [path]);

  if (!hasSaved) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <KeyRound className="h-3 w-3 text-green-500" />
      </TooltipTrigger>
      <TooltipContent>Password saved</TooltipContent>
    </Tooltip>
  );
}

export function WelcomeScreen() {
  const {
    recentConnections,
    isConnecting,
    error,
    setConnection,
    setSchema,
    setIsConnecting,
    setIsLoadingSchema,
    setError,
    setRecentConnections,
  } = useConnectionStore();
  const { theme, setTheme } = useThemeStore();

  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [pendingFilename, setPendingFilename] = useState<string>('');
  const [pendingIsEncrypted, setPendingIsEncrypted] = useState(false);
  const [pendingSettings, setPendingSettings] =
    useState<ConnectionSettings | null>(null);

  // Edit mode state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingConnection, setEditingConnection] =
    useState<RecentConnection | null>(null);

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);

  const connectToDatabase = async (
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
        // Check if database needs a password (using explicit flag from backend)
        if (result.needsPassword) {
          // Try to use saved password first
          const savedPasswordResult = await sqlPro.password.get({
            dbPath: path,
          });
          if (savedPasswordResult.success && savedPasswordResult.password) {
            // Automatically try with saved password
            setIsConnecting(false);
            await connectToDatabase(path, savedPasswordResult.password);
            return;
          }

          // No saved password, show dialog
          setPendingPath(path);
          setPasswordDialogOpen(true);
          setIsConnecting(false);
          return;
        }
        // Show error message (won't trigger password dialog loop)
        setError(result.error || 'Failed to open database');
        setIsConnecting(false);
        return;
      }

      if (result.connection) {
        // Save connection settings if provided (new connection flow)
        if (settings) {
          await sqlPro.connection.update({
            path: result.connection.path,
            displayName: settings.displayName,
            readOnly: settings.readOnly,
          });
        }

        setConnection({
          id: result.connection.id,
          path: result.connection.path,
          filename: result.connection.filename,
          isEncrypted: result.connection.isEncrypted,
          isReadOnly: result.connection.isReadOnly,
          status: 'connected',
        });

        // Load schema
        setIsLoadingSchema(true);
        const schemaResult = await sqlPro.db.getSchema({
          connectionId: result.connection.id,
        });

        if (schemaResult.success) {
          setSchema({
            schemas: schemaResult.schemas || [],
            tables: schemaResult.tables || [],
            views: schemaResult.views || [],
          });
        }
        setIsLoadingSchema(false);

        // Clear pending state
        setPendingPath(null);
        setPendingSettings(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsConnecting(false);
    }
  };

  // Shared function to open a database file (used by both dialog and drag-drop)
  const openDatabaseFile = useCallback(
    async (filePath: string) => {
      const filename = filePath.split('/').pop() || filePath;

      // Check if this is an encrypted database by attempting to open it
      setIsConnecting(true);
      const probeResult = await sqlPro.db.open({ path: filePath });
      setIsConnecting(false);

      const isEncrypted = probeResult.needsPassword === true;

      // Store pending info and show settings dialog
      setPendingPath(filePath);
      setPendingFilename(filename);
      setPendingIsEncrypted(isEncrypted);
      setSettingsDialogOpen(true);
    },
    [setIsConnecting]
  );

  const handleOpenDatabase = async () => {
    const result = await sqlPro.dialog.openFile();
    if (result.success && !result.canceled && result.filePath) {
      await openDatabaseFile(result.filePath);
    }
  };

  // Drag and drop handlers
  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    // Check if dragging files
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    // Only set dragging to false if leaving the drop zone entirely
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;

      // Find the first database file
      const dbFile = files.find((file) => isDatabaseFile(file.name));

      if (dbFile) {
        // Use Electron's webUtils to get the file path
        const filePath = sqlPro.file.getPathForFile(dbFile);
        if (filePath) {
          await openDatabaseFile(filePath);
        } else {
          setError('Unable to access file path');
        }
      } else {
        setError(`Please drop a database file (${DB_EXTENSIONS.join(', ')})`);
      }
    },
    [openDatabaseFile, setError]
  );

  const handleSettingsSubmit = async (settings: ConnectionSettings) => {
    setSettingsDialogOpen(false);
    setPendingSettings(settings);

    if (!pendingPath) return;

    if (pendingIsEncrypted) {
      // Check if we have a saved password
      const savedPasswordResult = await sqlPro.password.get({
        dbPath: pendingPath,
      });
      if (savedPasswordResult.success && savedPasswordResult.password) {
        // Connect with saved password and settings
        await connectToDatabase(
          pendingPath,
          savedPasswordResult.password,
          settings.readOnly,
          settings
        );
      } else {
        // Need password - show password dialog
        setPasswordDialogOpen(true);
      }
    } else {
      // Non-encrypted database - connect directly with settings
      await connectToDatabase(
        pendingPath,
        undefined,
        settings.readOnly,
        settings
      );
    }
  };

  const handlePasswordSubmit = async (
    password: string,
    rememberPassword: boolean
  ) => {
    setPasswordDialogOpen(false);
    if (pendingPath) {
      // Use rememberPassword from settings dialog if available, otherwise from password dialog
      const shouldRemember =
        pendingSettings?.rememberPassword ?? rememberPassword;

      // Save password if requested
      if (shouldRemember) {
        await sqlPro.password.save({
          dbPath: pendingPath,
          password,
        });
      }

      // Connect with settings if available
      await connectToDatabase(
        pendingPath,
        password,
        pendingSettings?.readOnly,
        pendingSettings ?? undefined
      );
    }
  };

  const handleRecentClick = async (
    path: string,
    isEncrypted: boolean,
    readOnly?: boolean
  ) => {
    if (isEncrypted) {
      // Check if we have a saved password
      const savedPasswordResult = await sqlPro.password.get({
        dbPath: path,
      });
      if (savedPasswordResult.success && savedPasswordResult.password) {
        // Try to connect with saved password and readOnly setting
        await connectToDatabase(path, savedPasswordResult.password, readOnly);
      } else {
        // No saved password, show dialog - store readOnly for later use
        setPendingPath(path);
        setPendingSettings(
          readOnly !== undefined
            ? { displayName: '', readOnly, rememberPassword: false }
            : null
        );
        setPasswordDialogOpen(true);
      }
    } else {
      await connectToDatabase(path, undefined, readOnly);
    }
  };

  // Edit connection settings (T031, T033)
  const handleEditConnection = (conn: RecentConnection) => {
    setEditingConnection(conn);
    setEditDialogOpen(true);
  };

  const handleEditSubmit = async (settings: ConnectionSettings) => {
    if (!editingConnection) return;

    const result = await sqlPro.connection.update({
      path: editingConnection.path,
      displayName: settings.displayName,
      readOnly: settings.readOnly,
    });

    if (result.success) {
      // Refresh recent connections to show updated settings (T034)
      const connectionsResult = await sqlPro.app.getRecentConnections();
      if (connectionsResult.success && connectionsResult.connections) {
        setRecentConnections(connectionsResult.connections);
      }
    }

    setEditDialogOpen(false);
    setEditingConnection(null);
  };

  // Remove connection from list (T045-T049 - implementing here for context menu)
  const handleRemoveConnection = async (conn: RecentConnection) => {
    const result = await sqlPro.connection.remove({
      path: conn.path,
      removePassword: true, // Also remove saved password
    });

    if (result.success) {
      // Refresh recent connections
      const connectionsResult = await sqlPro.app.getRecentConnections();
      if (connectionsResult.success && connectionsResult.connections) {
        setRecentConnections(connectionsResult.connections);
      }
    }
  };

  const cycleTheme = () => {
    const themes: Array<'light' | 'dark' | 'system'> = [
      'light',
      'dark',
      'system',
    ];
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  const getThemeIcon = () => {
    switch (theme) {
      case 'light':
        return <Sun className="h-4 w-4" />;
      case 'dark':
        return <Moon className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  const getThemeLabel = () => {
    switch (theme) {
      case 'light':
        return 'Light mode';
      case 'dark':
        return 'Dark mode';
      default:
        return 'System theme';
    }
  };

  return (
    <div
      className="bg-grid-dot relative flex h-full items-center justify-center"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="bg-primary/5 border-primary pointer-events-none absolute inset-4 z-50 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed">
          <Upload className="text-primary mb-4 h-12 w-12" />
          <p className="text-primary text-lg font-medium">
            Drop database file here
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            {DB_EXTENSIONS.join(', ')}
          </p>
        </div>
      )}

      {/* Theme Toggle - Top Right */}
      <div className="absolute top-4 right-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={cycleTheme}>
              {getThemeIcon()}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{getThemeLabel()}</TooltipContent>
        </Tooltip>
      </div>

      <div
        className={cn(
          'w-full max-w-md space-y-8 px-4',
          isDragging && 'opacity-30'
        )}
      >
        {/* Logo & Title */}
        <div className="text-center">
          <div className="bg-primary/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl">
            <Database className="text-primary h-8 w-8" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">SQL Pro</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Professional SQLite Database Manager
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="border-destructive/50 bg-destructive/10 text-destructive flex items-center gap-2 rounded-lg border p-3 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Open Database Button */}
        <div className="space-y-2">
          <Button
            className="w-full"
            size="lg"
            onClick={handleOpenDatabase}
            disabled={isConnecting}
          >
            <FolderOpen className="mr-2 h-4 w-4" />
            {isConnecting ? 'Opening...' : 'Open Database'}
          </Button>
          <p className="text-muted-foreground text-center text-xs">
            or drag and drop a database file
          </p>
        </div>

        {/* Recent Connections */}
        {recentConnections.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Recent Connections</label>
              <Clock className="text-muted-foreground h-4 w-4" />
            </div>
            <div className="space-y-1">
              {recentConnections.map((conn) => (
                <div key={conn.path} className="group flex items-center gap-2">
                  <Button
                    variant="ghost"
                    className="flex-1 justify-start text-left"
                    onClick={() =>
                      handleRecentClick(
                        conn.path,
                        conn.isEncrypted,
                        conn.readOnly
                      )
                    }
                    disabled={isConnecting}
                  >
                    <Database className="text-muted-foreground mr-2 h-4 w-4" />
                    <div className="flex-1 overflow-hidden">
                      <div className="truncate text-sm">
                        {conn.displayName || conn.filename}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {conn.path}
                      </div>
                    </div>
                    <div className="ml-2 flex items-center gap-1">
                      {conn.readOnly && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Eye className="text-muted-foreground h-3 w-3" />
                          </TooltipTrigger>
                          <TooltipContent>Read-only</TooltipContent>
                        </Tooltip>
                      )}
                      <HasSavedPasswordIndicator path={conn.path} />
                    </div>
                  </Button>
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground opacity-0 group-hover:opacity-100"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Content align="end">
                      <DropdownMenu.Item
                        onClick={() => handleEditConnection(conn)}
                      >
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Edit</span>
                      </DropdownMenu.Item>
                      <DropdownMenu.Separator />
                      <DropdownMenu.Item
                        onClick={() => handleRemoveConnection(conn)}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        <span>Remove</span>
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Root>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <ConnectionSettingsDialog
        open={settingsDialogOpen}
        onOpenChange={setSettingsDialogOpen}
        onSubmit={handleSettingsSubmit}
        filename={pendingFilename}
        dbPath={pendingPath || ''}
        isEncrypted={pendingIsEncrypted}
        mode="new"
      />

      <ConnectionSettingsDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSubmit={handleEditSubmit}
        filename={editingConnection?.filename || ''}
        dbPath={editingConnection?.path || ''}
        isEncrypted={editingConnection?.isEncrypted || false}
        mode="edit"
        initialValues={{
          displayName: editingConnection?.displayName,
          readOnly: editingConnection?.readOnly,
        }}
      />

      <PasswordDialog
        open={passwordDialogOpen}
        onOpenChange={setPasswordDialogOpen}
        onSubmit={handlePasswordSubmit}
        filename={pendingFilename}
        dbPath={pendingPath || ''}
      />
    </div>
  );
}

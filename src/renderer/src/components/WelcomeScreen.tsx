import { useState } from 'react';
import {
  Database,
  FolderOpen,
  Clock,
  Lock,
  AlertCircle,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useConnectionStore, useThemeStore } from '@/stores';
import { PasswordDialog } from './PasswordDialog';

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
  } = useConnectionStore();
  const { theme, setTheme } = useThemeStore();

  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  const handleOpenDatabase = async () => {
    const result = await window.sqlPro.dialog.openFile();
    if (result.success && !result.canceled && result.filePath) {
      await connectToDatabase(result.filePath);
    }
  };

  const connectToDatabase = async (path: string, password?: string) => {
    setIsConnecting(true);
    setError(null);

    try {
      const result = await window.sqlPro.db.open({ path, password });

      if (!result.success) {
        // Check if database needs a password (using explicit flag from backend)
        if (result.needsPassword) {
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
        const schemaResult = await window.sqlPro.db.getSchema({
          connectionId: result.connection.id,
        });

        if (schemaResult.success) {
          setSchema({
            tables: schemaResult.tables || [],
            views: schemaResult.views || [],
          });
        }
        setIsLoadingSchema(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsConnecting(false);
    }
  };

  const handlePasswordSubmit = async (password: string) => {
    setPasswordDialogOpen(false);
    if (pendingPath) {
      await connectToDatabase(pendingPath, password);
      setPendingPath(null);
    }
  };

  const handleRecentClick = async (path: string, isEncrypted: boolean) => {
    if (isEncrypted) {
      setPendingPath(path);
      setPasswordDialogOpen(true);
    } else {
      await connectToDatabase(path);
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
    <div className="relative flex h-full items-center justify-center">
      {/* Theme Toggle - Top Right */}
      <div className="absolute right-4 top-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={cycleTheme}>
              {getThemeIcon()}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{getThemeLabel()}</TooltipContent>
        </Tooltip>
      </div>

      <div className="w-full max-w-md space-y-8 px-4">
        {/* Logo & Title */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Database className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">SQL Pro</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Professional SQLite Database Manager
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Open Database Button */}
        <Button
          className="w-full"
          size="lg"
          onClick={handleOpenDatabase}
          disabled={isConnecting}
        >
          <FolderOpen className="mr-2 h-4 w-4" />
          {isConnecting ? 'Opening...' : 'Open Database'}
        </Button>

        {/* Recent Connections */}
        {recentConnections.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Recent Databases</span>
            </div>
            <div className="space-y-1">
              {recentConnections.slice(0, 5).map((conn) => (
                <button
                  key={conn.path}
                  onClick={() => handleRecentClick(conn.path, conn.isEncrypted)}
                  disabled={isConnecting}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent disabled:opacity-50"
                >
                  <Database className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">
                        {conn.filename}
                      </span>
                      {conn.isEncrypted && (
                        <Lock className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                    <span className="truncate text-xs text-muted-foreground">
                      {conn.path}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Password Dialog */}
      <PasswordDialog
        open={passwordDialogOpen}
        onOpenChange={setPasswordDialogOpen}
        onSubmit={handlePasswordSubmit}
        filename={pendingPath?.split('/').pop() || ''}
      />
    </div>
  );
}

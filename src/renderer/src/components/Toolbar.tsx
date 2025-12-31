import {
  Database,
  FileText,
  Lock,
  Monitor,
  Moon,
  RefreshCw,
  Sun,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { sqlPro } from '@/lib/api';
import {
  useChangesStore,
  useConnectionStore,
  useTableDataStore,
  useThemeStore,
} from '@/stores';

interface ToolbarProps {
  onOpenChanges?: () => void;
}

export function Toolbar({ onOpenChanges }: ToolbarProps) {
  const {
    connection,
    activeConnectionId,
    removeConnection,
    setSchema,
    setSelectedTable,
    isLoadingSchema,
    setIsLoadingSchema,
  } = useConnectionStore();
  const { hasChanges, clearChangesForConnection, changes } = useChangesStore();
  const { resetConnection } = useTableDataStore();
  const { theme, setTheme } = useThemeStore();

  const handleDisconnect = async () => {
    if (connection && activeConnectionId) {
      await sqlPro.db.close({ connectionId: connection.id });
      removeConnection(activeConnectionId);
      setSelectedTable(null);
      clearChangesForConnection(activeConnectionId);
      resetConnection(activeConnectionId);
    }
  };

  const handleRefreshSchema = async () => {
    if (!connection) return;

    setIsLoadingSchema(true);
    const result = await sqlPro.db.getSchema({
      connectionId: connection.id,
    });

    if (result.success && activeConnectionId) {
      setSchema(activeConnectionId, {
        schemas: result.schemas || [],
        tables: result.tables || [],
        views: result.views || [],
      });
    }
    setIsLoadingSchema(false);
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

  if (!connection) return null;

  return (
    <div className="flex h-12 items-center gap-2 border-b px-3">
      {/* Database Info */}
      <div className="flex items-center gap-2">
        <Database className="text-muted-foreground h-4 w-4" />
        <span className="font-medium">{connection.filename}</span>
        {connection.isEncrypted && (
          <Lock className="text-muted-foreground h-3 w-3" />
        )}
        {connection.isReadOnly && (
          <span className="bg-secondary text-muted-foreground rounded px-1.5 py-0.5 text-xs">
            Read-only
          </span>
        )}
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Actions */}
      <Tooltip>
        <TooltipTrigger>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefreshSchema}
            disabled={isLoadingSchema}
          >
            <RefreshCw
              className={`h-4 w-4 ${isLoadingSchema ? 'animate-spin' : ''}`}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <span>Refresh Schema</span>
          <kbd className="bg-muted text-muted-foreground ml-2 rounded px-1 py-0.5 font-mono text-xs">
            ⇧⌘R
          </kbd>
        </TooltipContent>
      </Tooltip>

      <div className="flex-1" />

      {/* Pending Changes Indicator - Clickable */}
      {hasChanges() && (
        <button
          onClick={onOpenChanges}
          className="flex items-center gap-2 rounded-md bg-amber-500/10 px-3 py-1 text-sm text-amber-600 transition-colors hover:bg-amber-500/20 dark:text-amber-400"
        >
          <FileText className="h-4 w-4" />
          <span>
            {changes.length} unsaved change{changes.length !== 1 ? 's' : ''}
          </span>
        </button>
      )}

      {/* Theme Toggle */}
      <Tooltip>
        <TooltipTrigger>
          <Button variant="ghost" size="icon" onClick={cycleTheme}>
            {getThemeIcon()}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{getThemeLabel()}</TooltipContent>
      </Tooltip>

      {/* Command Palette Hint */}
      <Tooltip>
        <TooltipTrigger>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              // Trigger command palette via keyboard event
              window.dispatchEvent(
                new KeyboardEvent('keydown', {
                  key: 'k',
                  metaKey: true,
                  bubbles: true,
                })
              );
            }}
            className="text-muted-foreground gap-1.5 text-xs"
          >
            <span>Commands</span>
            <kbd className="bg-muted text-muted-foreground rounded px-1 py-0.5 font-mono text-[10px]">
              ⌘K
            </kbd>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Open command palette</TooltipContent>
      </Tooltip>

      {/* Disconnect */}
      <Tooltip>
        <TooltipTrigger>
          <Button variant="ghost" size="icon" onClick={handleDisconnect}>
            <X className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Close Database</TooltipContent>
      </Tooltip>
    </div>
  );
}

import { Database, X, Lock, FileText, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  useConnectionStore,
  useChangesStore,
  useTableDataStore,
} from '@/stores';

export function Toolbar() {
  const {
    connection,
    setConnection,
    setSchema,
    setSelectedTable,
    isLoadingSchema,
    setIsLoadingSchema,
  } = useConnectionStore();
  const { hasChanges, clearChanges } = useChangesStore();
  const { reset: resetTableData } = useTableDataStore();

  const handleDisconnect = async () => {
    if (connection) {
      await window.sqlPro.db.close({ connectionId: connection.id });
      setConnection(null);
      setSchema(null);
      setSelectedTable(null);
      clearChanges();
      resetTableData();
    }
  };

  const handleRefreshSchema = async () => {
    if (!connection) return;

    setIsLoadingSchema(true);
    const result = await window.sqlPro.db.getSchema({
      connectionId: connection.id,
    });

    if (result.success) {
      setSchema({
        tables: result.tables || [],
        views: result.views || [],
      });
    }
    setIsLoadingSchema(false);
  };

  if (!connection) return null;

  return (
    <div className="flex h-12 items-center gap-2 border-b px-3">
      {/* Database Info */}
      <div className="flex items-center gap-2">
        <Database className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{connection.filename}</span>
        {connection.isEncrypted && (
          <Lock className="h-3 w-3 text-muted-foreground" />
        )}
        {connection.isReadOnly && (
          <span className="rounded bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">
            Read-only
          </span>
        )}
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Actions */}
      <Tooltip>
        <TooltipTrigger asChild>
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
        <TooltipContent>Refresh Schema</TooltipContent>
      </Tooltip>

      <div className="flex-1" />

      {/* Pending Changes Indicator */}
      {hasChanges() && (
        <div className="flex items-center gap-2 rounded-md bg-amber-500/10 px-3 py-1 text-sm text-amber-600 dark:text-amber-400">
          <FileText className="h-4 w-4" />
          <span>Unsaved changes</span>
        </div>
      )}

      {/* Disconnect */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={handleDisconnect}>
            <X className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Close Database</TooltipContent>
      </Tooltip>
    </div>
  );
}

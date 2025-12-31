import type { SqlLogEntry, SqlLogLevel } from '@/types/sql-log';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Database,
  Filter,
  Pause,
  Play,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  cleanupSqlLogListener,
  initSqlLogListener,
  useSqlLogStore,
} from '@/stores/sql-log-store';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet';

const LOG_LEVEL_COLORS: Record<SqlLogLevel, string> = {
  info: 'bg-blue-500/10 text-blue-500',
  warn: 'bg-yellow-500/10 text-yellow-500',
  error: 'bg-red-500/10 text-red-500',
  debug: 'bg-gray-500/10 text-gray-500',
};

interface SqlLogItemProps {
  entry: SqlLogEntry;
}

function SqlLogItem({ entry }: SqlLogItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const timestamp = new Date(entry.timestamp).toLocaleTimeString();

  return (
    <div
      className={cn(
        'hover:bg-muted/50 cursor-pointer border-b p-2 transition-colors',
        !entry.success && 'bg-red-500/5'
      )}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="flex items-start gap-2">
        {/* Status icon */}
        <div className="mt-0.5">
          {entry.success ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-500" />
          )}
        </div>

        {/* Main content */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {/* Operation badge */}
            <Badge variant="outline" className="font-mono text-xs">
              {entry.operation.toUpperCase()}
            </Badge>

            {/* Level badge */}
            <Badge
              variant="secondary"
              className={cn('text-xs', LOG_LEVEL_COLORS[entry.level])}
            >
              {entry.level}
            </Badge>

            {/* Duration */}
            {entry.durationMs !== undefined && (
              <span className="text-muted-foreground flex items-center gap-1 text-xs">
                <Clock className="h-3 w-3" />
                {entry.durationMs.toFixed(2)}ms
              </span>
            )}

            {/* Row count */}
            {entry.rowCount !== undefined && (
              <span className="text-muted-foreground text-xs">
                {entry.rowCount} row{entry.rowCount !== 1 ? 's' : ''}
              </span>
            )}

            {/* Timestamp */}
            <span className="text-muted-foreground ml-auto text-xs">
              {timestamp}
            </span>
          </div>

          {/* SQL preview */}
          {entry.sql && (
            <div
              className={cn(
                'text-muted-foreground mt-1 truncate font-mono text-xs',
                isExpanded && 'break-all whitespace-pre-wrap'
              )}
            >
              {isExpanded ? entry.sql : entry.sql.slice(0, 100)}
              {!isExpanded && entry.sql.length > 100 && '...'}
            </div>
          )}

          {/* Error message */}
          {entry.error && (
            <div className="mt-1 text-xs text-red-500">
              {isExpanded ? entry.error : entry.error.slice(0, 100)}
              {!isExpanded && entry.error.length > 100 && '...'}
            </div>
          )}

          {/* Expanded details */}
          {isExpanded && (
            <div className="text-muted-foreground mt-2 space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <Database className="h-3 w-3" />
                <span>Connection: {entry.connectionId}</span>
              </div>
              {entry.dbPath && (
                <div className="truncate">Path: {entry.dbPath}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function SqlLogPanel() {
  const {
    logs,
    isLoading,
    filter,
    isVisible,
    isPaused,
    loadLogs,
    clearLogs,
    setFilter,
    setVisible,
    togglePaused,
    getFilteredLogs,
  } = useSqlLogStore();

  const [searchText, setSearchText] = useState('');

  // Initialize listener on mount
  useEffect(() => {
    initSqlLogListener();
    loadLogs();
    return () => {
      cleanupSqlLogListener();
    };
  }, [loadLogs]);

  // Update filter when search text changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilter({ searchText: searchText || undefined });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText, setFilter]);

  const filteredLogs = useMemo(
    () => getFilteredLogs(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [logs, filter]
  );

  const handleClearLogs = async () => {
    await clearLogs();
  };

  return (
    <Sheet open={isVisible} onOpenChange={setVisible}>
      <SheetContent
        side="bottom"
        className="!h-[400px] p-0"
        showCloseButton={false}
      >
        <div className="flex h-full flex-col overflow-hidden">
          {/* Header */}
          <SheetHeader className="shrink-0 border-b px-4 py-2">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                SQL Log
                <Badge variant="secondary" className="ml-2">
                  {filteredLogs.length}
                </Badge>
              </SheetTitle>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setVisible(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </SheetHeader>

          {/* Toolbar */}
          <div className="flex shrink-0 items-center gap-2 border-b px-4 py-2">
            {/* Search */}
            <div className="relative max-w-xs flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="Search SQL..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="h-8 pl-8"
              />
            </div>

            {/* Level filter */}
            <Select
              value={filter.level || 'all'}
              onValueChange={(value) =>
                setFilter({
                  level: value === 'all' ? undefined : (value as SqlLogLevel),
                })
              }
            >
              <SelectTrigger className="h-8 w-30">
                <Filter className="mr-1 h-3 w-3" />
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warn">Warn</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="debug">Debug</SelectItem>
              </SelectContent>
            </Select>

            {/* Pause/Resume button */}
            <Button
              variant="outline"
              size="sm"
              onClick={togglePaused}
              className="h-8"
            >
              {isPaused ? (
                <>
                  <Play className="mr-1 h-4 w-4" />
                  Resume
                </>
              ) : (
                <>
                  <Pause className="mr-1 h-4 w-4" />
                  Pause
                </>
              )}
            </Button>

            {/* Clear button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearLogs}
              className="h-8"
            >
              <Trash2 className="mr-1 h-4 w-4" />
              Clear
            </Button>
          </div>

          {/* Log list */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="text-muted-foreground flex h-full items-center justify-center">
                Loading...
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-muted-foreground flex h-full items-center justify-center">
                No logs
              </div>
            ) : (
              <div className="divide-y">
                {filteredLogs.map((entry) => (
                  <SqlLogItem key={entry.id} entry={entry} />
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

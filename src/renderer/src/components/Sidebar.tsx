import type { TableSchema } from '@/types/database';
import {
  ChevronDown,
  ChevronRight,
  Eye,
  Search,
  Settings,
  Table,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useVimKeyHandler } from '@/hooks/useVimKeyHandler';
import { sqlPro } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  useConnectionStore,
  useSettingsStore,
  useTableDataStore,
} from '@/stores';
import { SettingsDialog } from './SettingsDialog';

export function Sidebar() {
  const {
    schema,
    selectedTable,
    setSelectedTable,
    connection,
    isLoadingSchema,
  } = useConnectionStore();
  const { setTableData, setIsLoading, setError, reset } = useTableDataStore();

  const [tablesExpanded, setTablesExpanded] = useState(true);
  const [viewsExpanded, setViewsExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Vim navigation state
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const appVimMode = useSettingsStore((s) => s.appVimMode);
  const { handleKey: handleVimKey, resetSequence } = useVimKeyHandler();
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Global keyboard shortcut for settings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        setSettingsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSelectTable = useCallback(
    async (table: TableSchema) => {
      if (!connection) return;

      setSelectedTable(table);
      reset();
      setIsLoading(true);

      try {
        const result = await sqlPro.db.getTableData({
          connectionId: connection.id,
          table: table.name,
          page: 1,
          pageSize: 100,
        });

        if (result.success) {
          setTableData(
            table.name,
            result.columns || [],
            result.rows || [],
            result.totalRows || 0
          );
        } else {
          setError(result.error || 'Failed to load table data');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    },
    [connection, setSelectedTable, reset, setIsLoading, setTableData, setError]
  );

  const filteredTables = useMemo(
    () =>
      schema?.tables.filter((t) =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase())
      ) || [],
    [schema?.tables, searchQuery]
  );

  const filteredViews = useMemo(
    () =>
      schema?.views.filter((v) =>
        v.name.toLowerCase().includes(searchQuery.toLowerCase())
      ) || [],
    [schema?.views, searchQuery]
  );

  // Combined list of navigable items for vim navigation
  const navigableItems = useMemo(() => {
    const items: Array<{ type: 'table' | 'view'; item: TableSchema }> = [];
    if (tablesExpanded) {
      filteredTables.forEach((t) => items.push({ type: 'table', item: t }));
    }
    if (viewsExpanded) {
      filteredViews.forEach((v) => items.push({ type: 'view', item: v }));
    }
    return items;
  }, [filteredTables, filteredViews, tablesExpanded, viewsExpanded]);

  // Handle vim keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Don't handle keys when search input is focused (except Escape)
      if (isSearchFocused && e.key !== 'Escape') return;

      if (!appVimMode) return;

      const { command, handled } = handleVimKey(e.key, e.shiftKey);

      if (handled) {
        e.preventDefault();

        switch (command) {
          case 'move-down': {
            if (navigableItems.length > 0) {
              setFocusedIndex((prev) =>
                prev < navigableItems.length - 1 ? prev + 1 : prev
              );
            }
            break;
          }
          case 'move-up': {
            if (navigableItems.length > 0) {
              setFocusedIndex((prev) => (prev > 0 ? prev - 1 : 0));
            }
            break;
          }
          case 'jump-top': {
            if (navigableItems.length > 0) {
              setFocusedIndex(0);
            }
            break;
          }
          case 'jump-bottom': {
            if (navigableItems.length > 0) {
              setFocusedIndex(navigableItems.length - 1);
            }
            break;
          }
          case 'select':
          case 'enter-edit': {
            if (focusedIndex >= 0 && focusedIndex < navigableItems.length) {
              const { item } = navigableItems[focusedIndex];
              handleSelectTable(item);
            }
            break;
          }
          case 'toggle-expand': {
            // Toggle expand for the section containing the focused item
            if (focusedIndex >= 0 && focusedIndex < navigableItems.length) {
              const { type } = navigableItems[focusedIndex];
              if (type === 'table') {
                setTablesExpanded((prev) => !prev);
              } else {
                setViewsExpanded((prev) => !prev);
              }
            } else {
              // No item focused, toggle tables by default
              setTablesExpanded((prev) => !prev);
            }
            break;
          }
          case 'search': {
            searchInputRef.current?.focus();
            break;
          }
          case 'exit-mode': {
            // Clear search and unfocus
            if (isSearchFocused) {
              setSearchQuery('');
              searchInputRef.current?.blur();
              containerRef.current?.focus();
            }
            setFocusedIndex(-1);
            resetSequence();
            break;
          }
        }
      }
    },
    [
      appVimMode,
      isSearchFocused,
      handleVimKey,
      navigableItems,
      focusedIndex,
      handleSelectTable,
      resetSequence,
    ]
  );

  // Sync focused index with selected table when selection changes externally
  useEffect(() => {
    if (selectedTable) {
      const idx = navigableItems.findIndex(
        (n) => n.item.name === selectedTable.name
      );
      if (idx !== -1) {
        // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- Intentionally sync state with props
        setFocusedIndex(idx);
      }
    }
  }, [selectedTable, navigableItems]);

  return (
    <div
      ref={containerRef}
      className="bg-muted/30 flex h-full w-full flex-col overflow-hidden border-r outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Search */}
      <div className="p-2">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder={
              appVimMode ? 'Search tables (/ to focus)' : 'Search tables...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            className="border-input bg-background placeholder:text-muted-foreground focus:ring-ring w-full rounded-md border py-1.5 pr-3 pl-8 text-sm focus:ring-2 focus:outline-none"
          />
        </div>
      </div>

      {/* Schema Tree */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {isLoadingSchema ? (
            <div className="text-muted-foreground flex items-center justify-center py-8 text-sm">
              Loading schema...
            </div>
          ) : (
            <>
              {/* Tables Section */}
              {filteredTables.length > 0 && (
                <div className="mb-2">
                  <button
                    onClick={() => setTablesExpanded(!tablesExpanded)}
                    className="text-muted-foreground hover:bg-accent flex w-full items-center gap-1 rounded px-2 py-1 text-sm font-medium"
                  >
                    {tablesExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    Tables ({filteredTables.length})
                  </button>
                  {tablesExpanded && (
                    <div className="mt-1 space-y-0.5">
                      {filteredTables.map((table, idx) => (
                        <TableItem
                          key={table.name}
                          table={table}
                          isSelected={selectedTable?.name === table.name}
                          isFocused={appVimMode && focusedIndex === idx}
                          onClick={() => handleSelectTable(table)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Views Section */}
              {filteredViews.length > 0 && (
                <div>
                  <button
                    onClick={() => setViewsExpanded(!viewsExpanded)}
                    className="text-muted-foreground hover:bg-accent flex w-full items-center gap-1 rounded px-2 py-1 text-sm font-medium"
                  >
                    {viewsExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    Views ({filteredViews.length})
                  </button>
                  {viewsExpanded && (
                    <div className="mt-1 space-y-0.5">
                      {filteredViews.map((view, idx) => {
                        // Views come after tables in the navigableItems array
                        const viewIndex = tablesExpanded
                          ? filteredTables.length + idx
                          : idx;
                        return (
                          <TableItem
                            key={view.name}
                            table={view}
                            isSelected={selectedTable?.name === view.name}
                            isFocused={appVimMode && focusedIndex === viewIndex}
                            onClick={() => handleSelectTable(view)}
                            isView
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Empty State */}
              {filteredTables.length === 0 && filteredViews.length === 0 && (
                <div className="text-muted-foreground py-8 text-center text-sm">
                  {searchQuery
                    ? 'No tables match your search'
                    : 'No tables found'}
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>

      {/* Footer with Settings */}
      <div className="border-t p-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSettingsOpen(true)}
              className="w-full justify-start"
            >
              <Settings className="mr-2 h-4 w-4" />
              Settings
              <kbd className="bg-muted text-muted-foreground ml-auto rounded px-1 py-0.5 font-mono text-[10px]">
                ⌘,
              </kbd>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Open settings (⌘,)</TooltipContent>
        </Tooltip>
      </div>

      {/* Settings Dialog */}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}

interface TableItemProps {
  table: TableSchema;
  isSelected: boolean;
  isFocused?: boolean;
  onClick: () => void;
  isView?: boolean;
}

function TableItem({
  table,
  isSelected,
  isFocused,
  onClick,
  isView,
}: TableItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors',
        isSelected
          ? 'bg-accent text-accent-foreground'
          : 'hover:bg-accent/50 text-foreground',
        isFocused && !isSelected && 'ring-primary/50 ring-2 ring-inset'
      )}
    >
      {isView ? (
        <Eye className="text-muted-foreground h-4 w-4 shrink-0" />
      ) : (
        <Table className="text-muted-foreground h-4 w-4 shrink-0" />
      )}
      <span className="truncate">{table.name}</span>
      {table.rowCount !== undefined && (
        <span className="text-muted-foreground ml-auto text-xs">
          {table.rowCount.toLocaleString()}
        </span>
      )}
    </button>
  );
}

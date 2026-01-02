import type { SchemaInfo, TableSchema, TriggerSchema } from '@/types/database';
import {
  ArrowDownAZ,
  ArrowUpAZ,
  Check,
  ChevronDown,
  ChevronRight,
  Code,
  Copy,
  Database,
  Eye,
  FileSearch,
  Filter,
  Pin,
  PinOff,
  Search,
  Settings,
  SortAsc,
  Table,
  Tag,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { ShortcutKbd } from '@/components/ui/kbd';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
  useDataTabsStore,
  useQueryTabsStore,
  useSettingsStore,
  useTableDataStore,
  useTableFont,
  useTableOrganizationStore,
} from '@/stores';
import { ConnectionSelector } from './ConnectionSelector';
import { SettingsDialog } from './SettingsDialog';

interface SidebarProps {
  onOpenDatabase?: () => void;
  onOpenRecentConnection?: (
    path: string,
    isEncrypted: boolean,
    readOnly?: boolean
  ) => void;
  onSwitchToQuery?: () => void;
}

export function Sidebar({
  onOpenDatabase,
  onOpenRecentConnection,
  onSwitchToQuery,
}: SidebarProps) {
  const {
    schema,
    selectedTable,
    setSelectedTable,
    connection,
    activeConnectionId,
    isLoadingSchema,
    setSchema,
  } = useConnectionStore();
  const { setTableData, setIsLoading, setError, resetConnection } =
    useTableDataStore();
  const { openTable } = useDataTabsStore();
  const { createTab } = useQueryTabsStore();

  // Table organization store
  const {
    sortOption,
    setSortOption,
    availableTags,
    addTag,
    removeTag,
    activeTagFilter,
    setActiveTagFilter,
    addTableTag,
    removeTableTag,
    setTablePinned,
    getTableKey,
    getTableMetadata,
  } = useTableOrganizationStore();

  // Expansion state for schemas (key is schema name)
  const [expandedSchemas, setExpandedSchemas] = useState<
    Record<string, boolean>
  >({ main: true });
  // Expansion state for tables/views within schemas (key is "schemaName:tables" or "schemaName:views" or "schemaName:triggers")
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    'main:tables': true,
    'main:views': true,
    'main:triggers': true,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Confirmation dialogs state
  const [tableToTruncate, setTableToTruncate] = useState<TableSchema | null>(
    null
  );
  const [tableToDrop, setTableToDrop] = useState<TableSchema | null>(null);

  // Font settings for sidebar
  const tableFont = useTableFont();

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

  // Determine if we have multiple schemas (to show/hide schema-level grouping)
  const hasMultipleSchemas = useMemo(() => {
    if (!schema?.schemas) return false;
    // Filter out empty schemas
    const nonEmptySchemas = schema.schemas.filter(
      (s) => s.tables.length > 0 || s.views.length > 0
    );
    return nonEmptySchemas.length > 1;
  }, [schema?.schemas]);

  // Toggle schema expansion
  const toggleSchema = useCallback((schemaName: string) => {
    setExpandedSchemas((prev) => ({
      ...prev,
      [schemaName]: !prev[schemaName],
    }));
  }, []);

  // Toggle section (tables/views) expansion
  const toggleSection = useCallback((key: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  // Initialize expansion state for new schemas
  useEffect(() => {
    if (schema?.schemas) {
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- Intentionally sync state with props
      setExpandedSchemas((prev) => {
        const next = { ...prev };
        for (const s of schema.schemas) {
          if (next[s.name] === undefined) {
            next[s.name] = true; // Expand by default
          }
        }
        return next;
      });
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- Intentionally sync state with props
      setExpandedSections((prev) => {
        const next = { ...prev };
        for (const s of schema.schemas) {
          const tablesKey = `${s.name}:tables`;
          const viewsKey = `${s.name}:views`;
          const triggersKey = `${s.name}:triggers`;
          if (next[tablesKey] === undefined) {
            next[tablesKey] = true;
          }
          if (next[viewsKey] === undefined) {
            next[viewsKey] = true;
          }
          if (next[triggersKey] === undefined) {
            next[triggersKey] = true;
          }
        }
        return next;
      });
    }
  }, [schema?.schemas]);

  const handleSelectTable = useCallback(
    async (table: TableSchema) => {
      if (!connection || !activeConnectionId) return;

      setSelectedTable(table);
      // Open the table in a data tab (or switch to existing tab)
      openTable(activeConnectionId, table);
      resetConnection(activeConnectionId);
      setIsLoading(activeConnectionId, true);

      try {
        const result = await sqlPro.db.getTableData({
          connectionId: connection.id,
          schema: table.schema,
          table: table.name,
          page: 1,
          pageSize: 100,
        });

        if (result.success) {
          setTableData(
            activeConnectionId,
            table.name,
            result.columns || [],
            result.rows || [],
            result.totalRows || 0
          );
        } else {
          setError(
            activeConnectionId,
            result.error || 'Failed to load table data'
          );
        }
      } catch (err) {
        setError(
          activeConnectionId,
          err instanceof Error ? err.message : 'Unknown error'
        );
      } finally {
        setIsLoading(activeConnectionId, false);
      }
    },
    [
      connection,
      activeConnectionId,
      setSelectedTable,
      openTable,
      resetConnection,
      setIsLoading,
      setTableData,
      setError,
    ]
  );

  // Table context menu handlers
  const handleCopyTableName = useCallback((table: TableSchema) => {
    navigator.clipboard.writeText(table.name);
  }, []);

  const handleCopyCreateStatement = useCallback((table: TableSchema) => {
    if (table.sql) {
      navigator.clipboard.writeText(table.sql);
    }
  }, []);

  const handleOpenInQueryEditor = useCallback(
    (table: TableSchema) => {
      if (!activeConnectionId) return;
      const schemaPrefix =
        table.schema && table.schema !== 'main' ? `"${table.schema}".` : '';
      const query = `SELECT * FROM ${schemaPrefix}"${table.name}" LIMIT 100;`;
      createTab(activeConnectionId, `SELECT ${table.name}`, query);
      // Switch to SQL Query tab
      onSwitchToQuery?.();
    },
    [activeConnectionId, createTab, onSwitchToQuery]
  );

  // Show truncate confirmation dialog
  const handleTruncateTableRequest = useCallback((table: TableSchema) => {
    setTableToTruncate(table);
  }, []);

  // Execute truncate operation
  const handleConfirmTruncate = useCallback(async () => {
    const table = tableToTruncate;
    if (!table || !connection || !activeConnectionId) return;
    const schemaPrefix =
      table.schema && table.schema !== 'main' ? `"${table.schema}".` : '';
    const query = `DELETE FROM ${schemaPrefix}"${table.name}";`;
    try {
      await sqlPro.db.executeQuery({
        connectionId: connection.id,
        query,
      });
      // Refresh the table data if it's currently selected
      if (selectedTable?.name === table.name) {
        handleSelectTable(table);
      }
    } catch (err) {
      console.error('Failed to truncate table:', err);
    } finally {
      setTableToTruncate(null);
    }
  }, [
    tableToTruncate,
    connection,
    activeConnectionId,
    selectedTable,
    handleSelectTable,
  ]);

  // Show drop confirmation dialog
  const handleDropTableRequest = useCallback((table: TableSchema) => {
    setTableToDrop(table);
  }, []);

  // Execute drop operation
  const handleConfirmDrop = useCallback(async () => {
    const table = tableToDrop;
    if (!table || !connection || !activeConnectionId) return;
    const schemaPrefix =
      table.schema && table.schema !== 'main' ? `"${table.schema}".` : '';
    const objectType = table.type === 'view' ? 'VIEW' : 'TABLE';
    const query = `DROP ${objectType} ${schemaPrefix}"${table.name}";`;
    try {
      await sqlPro.db.executeQuery({
        connectionId: connection.id,
        query,
      });
      // Refresh schema after dropping
      const schemaResult = await sqlPro.db.getSchema({
        connectionId: connection.id,
      });
      if (schemaResult.success && schemaResult.schema) {
        setSchema(activeConnectionId, {
          schemas: schemaResult.schema,
          tables: schemaResult.schema.flatMap((s: SchemaInfo) => s.tables),
          views: schemaResult.schema.flatMap((s: SchemaInfo) => s.views),
        });
      }
    } catch (err) {
      console.error('Failed to drop table:', err);
    } finally {
      setTableToDrop(null);
    }
  }, [tableToDrop, connection, activeConnectionId, setSchema]);

  // Filter schemas based on search query
  const filteredSchemas = useMemo(() => {
    if (!schema?.schemas) return [];

    // Helper function to sort tables based on current sort option
    const sortTables = (tables: TableSchema[]): TableSchema[] => {
      const sorted = [...tables];

      // First, separate pinned and non-pinned tables
      const pinned: TableSchema[] = [];
      const unpinned: TableSchema[] = [];

      for (const table of sorted) {
        const key = getTableKey(
          connection?.path || '',
          table.schema,
          table.name
        );
        const metadata = getTableMetadata(key);
        if (metadata.pinned) {
          pinned.push(table);
        } else {
          unpinned.push(table);
        }
      }

      // Sort unpinned tables based on sort option
      const sortFn = (a: TableSchema, b: TableSchema): number => {
        switch (sortOption) {
          case 'name-asc':
            return a.name.localeCompare(b.name);
          case 'name-desc':
            return b.name.localeCompare(a.name);
          case 'row-count-asc':
            return (a.rowCount ?? 0) - (b.rowCount ?? 0);
          case 'row-count-desc':
            return (b.rowCount ?? 0) - (a.rowCount ?? 0);
          case 'custom': {
            const keyA = getTableKey(connection?.path || '', a.schema, a.name);
            const keyB = getTableKey(connection?.path || '', b.schema, b.name);
            const orderA = getTableMetadata(keyA).sortOrder ?? Infinity;
            const orderB = getTableMetadata(keyB).sortOrder ?? Infinity;
            return orderA - orderB;
          }
          default:
            return a.name.localeCompare(b.name);
        }
      };

      pinned.sort(sortFn);
      unpinned.sort(sortFn);

      return [...pinned, ...unpinned];
    };

    // Helper function to filter by active tag
    const filterByTag = (tables: TableSchema[]): TableSchema[] => {
      if (!activeTagFilter) return tables;
      return tables.filter((table) => {
        const key = getTableKey(
          connection?.path || '',
          table.schema,
          table.name
        );
        const metadata = getTableMetadata(key);
        return metadata.tags.includes(activeTagFilter);
      });
    };

    return schema.schemas
      .map((s) => {
        // Aggregate all triggers from all tables in this schema
        const allTriggers: TriggerSchema[] = s.tables.flatMap(
          (t) => t.triggers || []
        );

        // Filter by search query
        let tables = s.tables.filter((t) =>
          t.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
        let views = s.views.filter((v) =>
          v.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
        const triggers = allTriggers.filter((tr) =>
          tr.name.toLowerCase().includes(searchQuery.toLowerCase())
        );

        // Filter by active tag
        tables = filterByTag(tables);
        views = filterByTag(views);

        // Sort tables and views
        tables = sortTables(tables);
        views = sortTables(views);

        return {
          ...s,
          tables,
          views,
          triggers,
        };
      })
      .filter(
        (s) =>
          s.tables.length > 0 ||
          s.views.length > 0 ||
          s.triggers.length > 0 ||
          !searchQuery
      );
  }, [
    schema?.schemas,
    searchQuery,
    sortOption,
    activeTagFilter,
    connection?.path,
    getTableKey,
    getTableMetadata,
  ]);

  // Combined list of navigable items for vim navigation
  const navigableItems = useMemo(() => {
    const items: Array<{ type: 'table' | 'view'; item: TableSchema }> = [];

    for (const schemaInfo of filteredSchemas) {
      const isSchemaExpanded = hasMultipleSchemas
        ? expandedSchemas[schemaInfo.name] !== false
        : true;
      if (!isSchemaExpanded) continue;

      const tablesKey = `${schemaInfo.name}:tables`;
      const viewsKey = `${schemaInfo.name}:views`;

      if (expandedSections[tablesKey] !== false) {
        schemaInfo.tables.forEach((t) =>
          items.push({ type: 'table', item: t })
        );
      }
      if (expandedSections[viewsKey] !== false) {
        schemaInfo.views.forEach((v) => items.push({ type: 'view', item: v }));
      }
    }

    return items;
  }, [filteredSchemas, hasMultipleSchemas, expandedSchemas, expandedSections]);

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
              const { item } = navigableItems[focusedIndex];
              const sectionKey = `${item.schema}:${item.type === 'table' ? 'tables' : 'views'}`;
              toggleSection(sectionKey);
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
      toggleSection,
      resetSequence,
    ]
  );

  // Sync focused index with selected table when selection changes externally
  useEffect(() => {
    if (selectedTable) {
      const idx = navigableItems.findIndex(
        (n) =>
          n.item.name === selectedTable.name &&
          n.item.schema === selectedTable.schema
      );
      if (idx !== -1) {
        // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- Intentionally sync state with props
        setFocusedIndex(idx);
      }
    }
  }, [selectedTable, navigableItems]);

  // Helper to get the index for vim focus within navigable items
  const getItemIndex = useCallback(
    (schemaName: string, type: 'table' | 'view', itemIndex: number) => {
      let count = 0;
      for (const s of filteredSchemas) {
        const isSchemaExpanded = hasMultipleSchemas
          ? expandedSchemas[s.name] !== false
          : true;
        if (!isSchemaExpanded) continue;

        if (s.name === schemaName) {
          if (type === 'table') {
            return count + itemIndex;
          } else {
            const tablesKey = `${s.name}:tables`;
            if (expandedSections[tablesKey] !== false) {
              count += s.tables.length;
            }
            return count + itemIndex;
          }
        }

        const tablesKey = `${s.name}:tables`;
        const viewsKey = `${s.name}:views`;
        if (expandedSections[tablesKey] !== false) {
          count += s.tables.length;
        }
        if (expandedSections[viewsKey] !== false) {
          count += s.views.length;
        }
      }
      return -1;
    },
    [filteredSchemas, hasMultipleSchemas, expandedSchemas, expandedSections]
  );

  return (
    <div
      ref={containerRef}
      className="bg-muted/30 bg-grid-dot flex h-full w-full flex-col overflow-hidden border-r outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Connection Selector */}
      <div className="border-b p-2">
        <ConnectionSelector
          onOpenDatabase={onOpenDatabase}
          onOpenRecentConnection={onOpenRecentConnection}
        />
      </div>

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

      {/* Sort and Filter Controls */}
      <div className="flex min-w-0 flex-wrap items-center gap-1 border-b px-2 pb-2">
        {/* Sort Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 gap-1 px-2"
            >
              <SortAsc className="h-3.5 w-3.5 shrink-0" />
              <span className="text-xs">
                {sortOption === 'name-asc' && 'A-Z'}
                {sortOption === 'name-desc' && 'Z-A'}
                {sortOption === 'row-count-asc' && 'Rows ↑'}
                {sortOption === 'row-count-desc' && 'Rows ↓'}
                {sortOption === 'custom' && 'Custom'}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setSortOption('name-asc')}>
              <ArrowDownAZ className="mr-2 h-4 w-4" />
              Name (A-Z)
              {sortOption === 'name-asc' && (
                <Check className="ml-auto h-4 w-4" />
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortOption('name-desc')}>
              <ArrowUpAZ className="mr-2 h-4 w-4" />
              Name (Z-A)
              {sortOption === 'name-desc' && (
                <Check className="ml-auto h-4 w-4" />
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setSortOption('row-count-asc')}>
              Row Count (Low to High)
              {sortOption === 'row-count-asc' && (
                <Check className="ml-auto h-4 w-4" />
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortOption('row-count-desc')}>
              Row Count (High to Low)
              {sortOption === 'row-count-desc' && (
                <Check className="ml-auto h-4 w-4" />
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Tag Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={activeTagFilter ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 shrink-0 gap-1 px-2"
            >
              <Filter className="h-3.5 w-3.5 shrink-0" />
              {activeTagFilter ? (
                <Badge
                  variant="secondary"
                  className="h-5 max-w-[60px] truncate px-1 text-xs"
                >
                  {activeTagFilter}
                </Badge>
              ) : (
                <span className="text-xs">Filter</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-48 p-2">
            <div className="space-y-2">
              <div className="text-sm font-medium">Filter by Tag</div>
              {availableTags.length === 0 ? (
                <div className="text-muted-foreground text-xs">
                  No tags created yet.
                  <br />
                  Right-click a table to add tags.
                </div>
              ) : (
                <div className="space-y-1">
                  {activeTagFilter && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-full justify-start gap-2 px-2 text-xs"
                      onClick={() => setActiveTagFilter(null)}
                    >
                      <X className="h-3 w-3" />
                      Clear filter
                    </Button>
                  )}
                  {availableTags.map((tag) => (
                    <Button
                      key={tag}
                      variant={activeTagFilter === tag ? 'secondary' : 'ghost'}
                      size="sm"
                      className="h-7 w-full justify-start gap-2 px-2 text-xs"
                      onClick={() =>
                        setActiveTagFilter(activeTagFilter === tag ? null : tag)
                      }
                    >
                      <Tag className="h-3 w-3" />
                      {tag}
                      {activeTagFilter === tag && (
                        <Check className="ml-auto h-3 w-3" />
                      )}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Tag Manager */}
        <TagManager
          availableTags={availableTags}
          onAddTag={addTag}
          onRemoveTag={removeTag}
        />
      </div>

      {/* Schema Tree */}
      <ScrollArea className="min-h-0 min-w-0 flex-1">
        <div
          className="min-w-0 overflow-hidden p-2"
          style={{
            fontFamily: tableFont.family || undefined,
            fontSize: tableFont.size ? `${tableFont.size}px` : undefined,
          }}
        >
          {isLoadingSchema ? (
            <div className="text-muted-foreground flex items-center justify-center py-8">
              Loading schema...
            </div>
          ) : (
            <>
              {filteredSchemas.map((schemaInfo) => (
                <SchemaSection
                  key={schemaInfo.name}
                  schemaInfo={schemaInfo}
                  showSchemaHeader={hasMultipleSchemas}
                  isSchemaExpanded={expandedSchemas[schemaInfo.name] !== false}
                  onToggleSchema={() => toggleSchema(schemaInfo.name)}
                  expandedSections={expandedSections}
                  onToggleSection={toggleSection}
                  selectedTable={selectedTable}
                  focusedIndex={focusedIndex}
                  appVimMode={appVimMode}
                  getItemIndex={getItemIndex}
                  onSelectTable={handleSelectTable}
                  onCopyTableName={handleCopyTableName}
                  onCopyCreateStatement={handleCopyCreateStatement}
                  onOpenInQueryEditor={handleOpenInQueryEditor}
                  onTruncateTable={handleTruncateTableRequest}
                  onDropTable={handleDropTableRequest}
                  connectionPath={connection?.path || ''}
                  availableTags={availableTags}
                  getTableMetadata={getTableMetadata}
                  getTableKey={getTableKey}
                  onAddTableTag={addTableTag}
                  onRemoveTableTag={removeTableTag}
                  onTogglePinned={setTablePinned}
                />
              ))}

              {/* Empty State */}
              {filteredSchemas.length === 0 && (
                <div className="text-muted-foreground py-8 text-center">
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
          <TooltipTrigger>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSettingsOpen(true)}
              className="flex w-full justify-start"
              data-action="open-settings"
            >
              <Settings className="mr-2 h-4 w-4" />
              Settings
              <ShortcutKbd action="settings.open" className="ml-auto" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            Open settings (<ShortcutKbd action="settings.open" />)
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Settings Dialog */}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

      {/* Truncate Table Confirmation Dialog */}
      <AlertDialog
        open={!!tableToTruncate}
        onOpenChange={(open) => !open && setTableToTruncate(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Truncate Table</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete all rows from{' '}
              <span className="font-semibold">{tableToTruncate?.name}</span>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmTruncate}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Truncate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Drop Table/View Confirmation Dialog */}
      <AlertDialog
        open={!!tableToDrop}
        onOpenChange={(open) => !open && setTableToDrop(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Drop {tableToDrop?.type === 'view' ? 'View' : 'Table'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to drop{' '}
              <span className="font-semibold">{tableToDrop?.name}</span>? This
              will permanently delete the{' '}
              {tableToDrop?.type === 'view' ? 'view' : 'table'} and cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDrop}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Drop
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface SchemaSectionProps {
  schemaInfo: SchemaInfo & { triggers: TriggerSchema[] };
  showSchemaHeader: boolean;
  isSchemaExpanded: boolean;
  onToggleSchema: () => void;
  expandedSections: Record<string, boolean>;
  onToggleSection: (key: string) => void;
  selectedTable: TableSchema | null;
  focusedIndex: number;
  appVimMode: boolean;
  getItemIndex: (
    schemaName: string,
    type: 'table' | 'view',
    itemIndex: number
  ) => number;
  onSelectTable: (table: TableSchema) => void;
  onCopyTableName: (table: TableSchema) => void;
  onCopyCreateStatement: (table: TableSchema) => void;
  onOpenInQueryEditor: (table: TableSchema) => void;
  onTruncateTable: (table: TableSchema) => void;
  onDropTable: (table: TableSchema) => void;
  // Tag and organization props
  connectionPath: string;
  availableTags: string[];
  getTableMetadata: (tableKey: string) => { tags: string[]; pinned?: boolean };
  getTableKey: (
    connectionPath: string,
    schemaName: string,
    tableName: string
  ) => string;
  onAddTableTag: (tableKey: string, tag: string) => void;
  onRemoveTableTag: (tableKey: string, tag: string) => void;
  onTogglePinned: (tableKey: string, pinned: boolean) => void;
}

function SchemaSection({
  schemaInfo,
  showSchemaHeader,
  isSchemaExpanded,
  onToggleSchema,
  expandedSections,
  onToggleSection,
  selectedTable,
  focusedIndex,
  appVimMode,
  getItemIndex,
  onSelectTable,
  onCopyTableName,
  onCopyCreateStatement,
  onOpenInQueryEditor,
  onTruncateTable,
  onDropTable,
  connectionPath,
  availableTags,
  getTableMetadata,
  getTableKey,
  onAddTableTag,
  onRemoveTableTag,
  onTogglePinned,
}: SchemaSectionProps) {
  const tablesKey = `${schemaInfo.name}:tables`;
  const viewsKey = `${schemaInfo.name}:views`;
  const triggersKey = `${schemaInfo.name}:triggers`;
  const tablesExpanded = expandedSections[tablesKey] !== false;
  const viewsExpanded = expandedSections[viewsKey] !== false;
  const triggersExpanded = expandedSections[triggersKey] !== false;

  return (
    <div className="mb-2 min-w-0 overflow-hidden">
      {/* Schema Header (only shown when multiple schemas) */}
      {showSchemaHeader && (
        <button
          onClick={onToggleSchema}
          className="text-muted-foreground hover:bg-accent flex w-full items-center gap-1 rounded px-2 py-1 font-medium"
        >
          {isSchemaExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <Database className="h-3.5 w-3.5" />
          <span className="ml-1">{schemaInfo.name}</span>
        </button>
      )}

      {/* Schema Content */}
      {isSchemaExpanded && (
        <div className={showSchemaHeader ? 'ml-4' : ''}>
          {/* Tables Section */}
          {schemaInfo.tables.length > 0 && (
            <div className="mb-1">
              <button
                onClick={() => onToggleSection(tablesKey)}
                className="text-muted-foreground hover:bg-accent flex w-full items-center gap-1 rounded px-2 py-1 font-medium"
              >
                {tablesExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                Tables ({schemaInfo.tables.length})
              </button>
              {tablesExpanded && (
                <div className="mt-1 min-w-0 space-y-0.5 overflow-hidden">
                  {schemaInfo.tables.map((table, idx) => {
                    const itemIdx = getItemIndex(schemaInfo.name, 'table', idx);
                    const tableKey = getTableKey(
                      connectionPath,
                      table.schema,
                      table.name
                    );
                    const metadata = getTableMetadata(tableKey);
                    return (
                      <TableItem
                        key={`${table.schema}:${table.name}`}
                        table={table}
                        isSelected={
                          selectedTable?.name === table.name &&
                          selectedTable?.schema === table.schema
                        }
                        isFocused={appVimMode && focusedIndex === itemIdx}
                        onClick={() => onSelectTable(table)}
                        onCopyTableName={() => onCopyTableName(table)}
                        onCopyCreateStatement={() =>
                          onCopyCreateStatement(table)
                        }
                        onOpenInQueryEditor={() => onOpenInQueryEditor(table)}
                        onTruncateTable={() => onTruncateTable(table)}
                        onDropTable={() => onDropTable(table)}
                        tableKey={tableKey}
                        tags={metadata.tags}
                        isPinned={metadata.pinned}
                        availableTags={availableTags}
                        onAddTag={(tag) => onAddTableTag(tableKey, tag)}
                        onRemoveTag={(tag) => onRemoveTableTag(tableKey, tag)}
                        onTogglePinned={() =>
                          onTogglePinned(tableKey, !metadata.pinned)
                        }
                      />
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Views Section */}
          {schemaInfo.views.length > 0 && (
            <div className="mb-1">
              <button
                onClick={() => onToggleSection(viewsKey)}
                className="text-muted-foreground hover:bg-accent flex w-full items-center gap-1 rounded px-2 py-1 font-medium"
              >
                {viewsExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                Views ({schemaInfo.views.length})
              </button>
              {viewsExpanded && (
                <div className="mt-1 space-y-0.5">
                  {schemaInfo.views.map((view, idx) => {
                    const itemIdx = getItemIndex(schemaInfo.name, 'view', idx);
                    const tableKey = getTableKey(
                      connectionPath,
                      view.schema,
                      view.name
                    );
                    const metadata = getTableMetadata(tableKey);
                    return (
                      <TableItem
                        key={`${view.schema}:${view.name}`}
                        table={view}
                        isSelected={
                          selectedTable?.name === view.name &&
                          selectedTable?.schema === view.schema
                        }
                        isFocused={appVimMode && focusedIndex === itemIdx}
                        onClick={() => onSelectTable(view)}
                        onCopyTableName={() => onCopyTableName(view)}
                        onCopyCreateStatement={() =>
                          onCopyCreateStatement(view)
                        }
                        onOpenInQueryEditor={() => onOpenInQueryEditor(view)}
                        onTruncateTable={() => onTruncateTable(view)}
                        onDropTable={() => onDropTable(view)}
                        isView
                        tableKey={tableKey}
                        tags={metadata.tags}
                        isPinned={metadata.pinned}
                        availableTags={availableTags}
                        onAddTag={(tag) => onAddTableTag(tableKey, tag)}
                        onRemoveTag={(tag) => onRemoveTableTag(tableKey, tag)}
                        onTogglePinned={() =>
                          onTogglePinned(tableKey, !metadata.pinned)
                        }
                      />
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Triggers Section */}
          {schemaInfo.triggers.length > 0 && (
            <div>
              <button
                onClick={() => onToggleSection(triggersKey)}
                className="text-muted-foreground hover:bg-accent flex w-full items-center gap-1 rounded px-2 py-1 font-medium"
              >
                {triggersExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                Triggers ({schemaInfo.triggers.length})
              </button>
              {triggersExpanded && (
                <div className="mt-1 space-y-0.5">
                  {schemaInfo.triggers.map((trigger) => (
                    <TriggerItem
                      key={`${schemaInfo.name}:${trigger.name}`}
                      trigger={trigger}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface TableItemProps {
  table: TableSchema;
  isSelected: boolean;
  isFocused?: boolean;
  onClick: () => void;
  onCopyTableName: () => void;
  onCopyCreateStatement: () => void;
  onOpenInQueryEditor: () => void;
  onTruncateTable: () => void;
  onDropTable: () => void;
  isView?: boolean;
  // Tag and organization props
  tableKey: string;
  tags: string[];
  isPinned?: boolean;
  availableTags: string[];
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  onTogglePinned: () => void;
}

function TableItem({
  table,
  isSelected,
  isFocused,
  onClick,
  onCopyTableName,
  onCopyCreateStatement,
  onOpenInQueryEditor,
  onTruncateTable,
  onDropTable,
  isView,
  tags,
  isPinned,
  availableTags,
  onAddTag,
  onRemoveTag,
  onTogglePinned,
}: TableItemProps) {
  const [newTagInput, setNewTagInput] = useState('');

  const handleAddNewTag = () => {
    if (newTagInput.trim()) {
      onAddTag(newTagInput.trim());
      setNewTagInput('');
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <button
          onClick={onClick}
          className={cn(
            'flex w-full items-center gap-2 overflow-hidden rounded px-2 py-1.5 transition-colors',
            isSelected
              ? 'bg-accent text-accent-foreground'
              : 'hover:bg-accent/50 text-foreground',
            isFocused && !isSelected && 'ring-primary/50 ring-2 ring-inset'
          )}
        >
          {isPinned && <Pin className="text-primary h-3 w-3 shrink-0" />}
          {isView ? (
            <Eye className="text-muted-foreground h-4 w-4 shrink-0" />
          ) : (
            <Table className="text-muted-foreground h-4 w-4 shrink-0" />
          )}
          <span className="min-w-0 flex-1 truncate text-left">
            {table.name}
          </span>
          {tags.length > 0 && (
            <div className="flex shrink-0 gap-0.5">
              {tags.slice(0, 2).map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="h-4 px-1 text-[10px]"
                >
                  {tag}
                </Badge>
              ))}
              {tags.length > 2 && (
                <Badge variant="outline" className="h-4 px-1 text-[10px]">
                  +{tags.length - 2}
                </Badge>
              )}
            </div>
          )}
          {table.rowCount !== undefined && (
            <span className="text-muted-foreground shrink-0 tabular-nums">
              {table.rowCount.toLocaleString()}
            </span>
          )}
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={onOpenInQueryEditor}>
          <FileSearch className="size-4" />
          Open in Query Editor
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onTogglePinned}>
          {isPinned ? (
            <>
              <PinOff className="size-4" />
              Unpin
            </>
          ) : (
            <>
              <Pin className="size-4" />
              Pin to Top
            </>
          )}
        </ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Tag className="size-4" />
            Tags
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            {/* Current tags */}
            {tags.length > 0 && (
              <>
                <div className="text-muted-foreground px-2 py-1 text-xs font-medium">
                  Current Tags
                </div>
                {tags.map((tag) => (
                  <ContextMenuItem key={tag} onClick={() => onRemoveTag(tag)}>
                    <X className="text-destructive size-4" />
                    {tag}
                  </ContextMenuItem>
                ))}
                <ContextMenuSeparator />
              </>
            )}
            {/* Available tags to add */}
            {availableTags.filter((t) => !tags.includes(t)).length > 0 && (
              <>
                <div className="text-muted-foreground px-2 py-1 text-xs font-medium">
                  Add Tag
                </div>
                {availableTags
                  .filter((t) => !tags.includes(t))
                  .map((tag) => (
                    <ContextMenuItem key={tag} onClick={() => onAddTag(tag)}>
                      <Tag className="size-4" />
                      {tag}
                    </ContextMenuItem>
                  ))}
                <ContextMenuSeparator />
              </>
            )}
            {/* Create new tag */}
            <div className="p-2">
              <div className="flex gap-1">
                <Input
                  placeholder="New tag..."
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddNewTag();
                    }
                  }}
                  className="h-7 text-xs"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  onClick={handleAddNewTag}
                  disabled={!newTagInput.trim()}
                >
                  <Check className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onCopyTableName}>
          <Copy className="size-4" />
          Copy Name
        </ContextMenuItem>
        <ContextMenuItem onClick={onCopyCreateStatement} disabled={!table.sql}>
          <Code className="size-4" />
          Copy CREATE Statement
        </ContextMenuItem>
        <ContextMenuSeparator />
        {!isView && (
          <ContextMenuItem onClick={onTruncateTable}>
            <Trash2 className="size-4" />
            Truncate Table
          </ContextMenuItem>
        )}
        <ContextMenuItem variant="destructive" onClick={onDropTable}>
          <Trash2 className="size-4" />
          Drop {isView ? 'View' : 'Table'}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

interface TriggerItemProps {
  trigger: TriggerSchema;
}

function TriggerItem({ trigger }: TriggerItemProps) {
  return (
    <div className="text-foreground hover:bg-accent/50 flex w-full items-center gap-2 rounded px-2 py-1.5 transition-colors">
      <Zap className="text-muted-foreground h-4 w-4 shrink-0" />
      <span className="truncate">{trigger.name}</span>
      <span className="text-muted-foreground ml-auto">
        {trigger.timing} {trigger.event}
      </span>
    </div>
  );
}

// Tag Manager Component
interface TagManagerProps {
  availableTags: string[];
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
}

function TagManager({ availableTags, onAddTag, onRemoveTag }: TagManagerProps) {
  const [newTagInput, setNewTagInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const handleAddTag = () => {
    if (newTagInput.trim()) {
      onAddTag(newTagInput.trim());
      setNewTagInput('');
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 shrink-0 gap-1 px-2">
          <Tag className="h-3.5 w-3.5 shrink-0" />
          <span className="text-xs">Tags</span>
          {availableTags.length > 0 && (
            <Badge variant="secondary" className="h-4 px-1 text-[10px]">
              {availableTags.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-2">
        <div className="space-y-2">
          <div className="text-sm font-medium">Manage Tags</div>

          {/* Add new tag */}
          <div className="flex gap-1">
            <Input
              placeholder="New tag name..."
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
              className="h-7 text-xs"
            />
            <Button
              size="sm"
              variant="secondary"
              className="h-7 px-2"
              onClick={handleAddTag}
              disabled={!newTagInput.trim()}
            >
              <Check className="h-3 w-3" />
            </Button>
          </div>

          {/* Existing tags */}
          {availableTags.length > 0 ? (
            <div className="space-y-1">
              <div className="text-muted-foreground text-xs">
                Existing tags:
              </div>
              <div className="max-h-32 space-y-0.5 overflow-y-auto">
                {availableTags.map((tag) => (
                  <div
                    key={tag}
                    className="hover:bg-destructive/10 group flex items-center justify-between rounded px-2 py-1"
                  >
                    <div className="flex items-center gap-2">
                      <Tag className="text-muted-foreground h-3 w-3" />
                      <span className="text-sm">{tag}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive h-5 w-5 p-0 opacity-0 group-hover:opacity-100"
                      onClick={() => onRemoveTag(tag)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground text-xs">
              No tags yet. Create one above or right-click a table to add tags.
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

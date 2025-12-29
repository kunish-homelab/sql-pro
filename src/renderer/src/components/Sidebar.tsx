import type { SchemaInfo, TableSchema, TriggerSchema } from '@/types/database';
import {
  ChevronDown,
  ChevronRight,
  Database,
  Eye,
  Search,
  Settings,
  Table,
  Zap,
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
      if (!connection) return;

      setSelectedTable(table);
      reset();
      setIsLoading(true);

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

  // Filter schemas based on search query
  const filteredSchemas = useMemo(() => {
    if (!schema?.schemas) return [];

    return schema.schemas
      .map((s) => {
        // Aggregate all triggers from all tables in this schema
        const allTriggers: TriggerSchema[] = s.tables.flatMap(
          (t) => t.triggers || []
        );

        return {
          ...s,
          tables: s.tables.filter((t) =>
            t.name.toLowerCase().includes(searchQuery.toLowerCase())
          ),
          views: s.views.filter((v) =>
            v.name.toLowerCase().includes(searchQuery.toLowerCase())
          ),
          triggers: allTriggers.filter((tr) =>
            tr.name.toLowerCase().includes(searchQuery.toLowerCase())
          ),
        };
      })
      .filter(
        (s) =>
          s.tables.length > 0 ||
          s.views.length > 0 ||
          s.triggers.length > 0 ||
          !searchQuery
      );
  }, [schema?.schemas, searchQuery]);

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
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-2">
          {isLoadingSchema ? (
            <div className="text-muted-foreground flex items-center justify-center py-8 text-sm">
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
                />
              ))}

              {/* Empty State */}
              {filteredSchemas.length === 0 && (
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
}: SchemaSectionProps) {
  const tablesKey = `${schemaInfo.name}:tables`;
  const viewsKey = `${schemaInfo.name}:views`;
  const triggersKey = `${schemaInfo.name}:triggers`;
  const tablesExpanded = expandedSections[tablesKey] !== false;
  const viewsExpanded = expandedSections[viewsKey] !== false;
  const triggersExpanded = expandedSections[triggersKey] !== false;

  return (
    <div className="mb-2">
      {/* Schema Header (only shown when multiple schemas) */}
      {showSchemaHeader && (
        <button
          onClick={onToggleSchema}
          className="text-muted-foreground hover:bg-accent flex w-full items-center gap-1 rounded px-2 py-1 text-sm font-medium"
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
                className="text-muted-foreground hover:bg-accent flex w-full items-center gap-1 rounded px-2 py-1 text-sm font-medium"
              >
                {tablesExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                Tables ({schemaInfo.tables.length})
              </button>
              {tablesExpanded && (
                <div className="mt-1 space-y-0.5">
                  {schemaInfo.tables.map((table, idx) => {
                    const itemIdx = getItemIndex(schemaInfo.name, 'table', idx);
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
                className="text-muted-foreground hover:bg-accent flex w-full items-center gap-1 rounded px-2 py-1 text-sm font-medium"
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
                        isView
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
                className="text-muted-foreground hover:bg-accent flex w-full items-center gap-1 rounded px-2 py-1 text-sm font-medium"
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

interface TriggerItemProps {
  trigger: TriggerSchema;
}

function TriggerItem({ trigger }: TriggerItemProps) {
  return (
    <div className="text-foreground hover:bg-accent/50 flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors">
      <Zap className="text-muted-foreground h-4 w-4 shrink-0" />
      <span className="truncate">{trigger.name}</span>
      <span className="text-muted-foreground ml-auto text-xs">
        {trigger.timing} {trigger.event}
      </span>
    </div>
  );
}

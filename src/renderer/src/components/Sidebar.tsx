import type { TableSchema } from '@/types/database';
import { ChevronDown, ChevronRight, Eye, Search, Table } from 'lucide-react';
import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { sqlPro } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useConnectionStore, useTableDataStore } from '@/stores';

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

  const handleSelectTable = async (table: TableSchema) => {
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
  };

  const filteredTables =
    schema?.tables.filter((t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

  const filteredViews =
    schema?.views.filter((v) =>
      v.name.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

  return (
    <div className="bg-muted/30 flex h-full w-full flex-col overflow-hidden border-r">
      {/* Search */}
      <div className="p-2">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search tables..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
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
                      {filteredTables.map((table) => (
                        <TableItem
                          key={table.name}
                          table={table}
                          isSelected={selectedTable?.name === table.name}
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
                      {filteredViews.map((view) => (
                        <TableItem
                          key={view.name}
                          table={view}
                          isSelected={selectedTable?.name === view.name}
                          onClick={() => handleSelectTable(view)}
                          isView
                        />
                      ))}
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
    </div>
  );
}

interface TableItemProps {
  table: TableSchema;
  isSelected: boolean;
  onClick: () => void;
  isView?: boolean;
}

function TableItem({ table, isSelected, onClick, isView }: TableItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors',
        isSelected
          ? 'bg-accent text-accent-foreground'
          : 'hover:bg-accent/50 text-foreground'
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

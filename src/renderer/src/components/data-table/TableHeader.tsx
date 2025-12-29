import type { Header, Table } from '@tanstack/react-table';
import type { TableRowData } from './hooks/useTableCore';
import type { ColumnTypeCategory, UIFilterState } from '@/lib/filter-utils';
import type { ColumnSchema } from '@/types/database';
import { flexRender } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, Filter, Key, Layers } from 'lucide-react';
import { memo, useRef, useState } from 'react';
import { getColumnTypeCategory } from '@/lib/filter-utils';
import { cn } from '@/lib/utils';
import { ColumnFilterPopover } from './ColumnFilterPopover';
import { TypeBadge } from './TypeBadge';

interface HeaderCellProps {
  header: Header<TableRowData, unknown>;
  onToggleGrouping?: (columnId: string) => void;
  onResetColumnSize?: (columnId: string) => void;
  isGrouped: boolean;
  /** Current sort direction for this column */
  sortDirection: 'asc' | 'desc' | false;
  /** Current column size */
  columnSize: number;
  /** Existing filter for this column (if any) */
  existingFilter?: UIFilterState;
  /** Callback when a filter is applied */
  onFilterAdd?: (filter: UIFilterState) => void;
  /** Callback when a filter is cleared/removed */
  onFilterRemove?: (columnId: string) => void;
}

const HeaderCell = memo(
  ({
    header,
    onToggleGrouping,
    onResetColumnSize,
    isGrouped,
    sortDirection,
    existingFilter,
    onFilterAdd,
    onFilterRemove,
  }: HeaderCellProps) => {
    // State for filter popover
    const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
    // Track if resize handle was recently interacted with to prevent sort
    const resizeHandleClickedRef = useRef<boolean>(false);

    if (header.isPlaceholder) {
      return <th className="h-9" />;
    }

    const canSort = header.column.getCanSort();
    const canGroup = header.column.getCanGroup?.() ?? true;
    const isResizing = header.column.getIsResizing();

    const columnMeta = header.column.columnDef.meta as
      | { schema?: ColumnSchema; isPrimaryKey?: boolean }
      | undefined;
    const isPrimaryKey = columnMeta?.isPrimaryKey ?? false;

    const handleClick = () => {
      // Skip sorting if resize handle was just clicked
      if (resizeHandleClickedRef.current) {
        resizeHandleClickedRef.current = false;
        return;
      }
      if (canSort) {
        // Get current sort state
        const currentSort = header.column.getIsSorted();

        // Cycle: none -> asc -> desc -> none
        if (currentSort === false) {
          // Not sorted, go to ascending
          header.column.toggleSorting(false, false); // asc, not multi-sort
        } else if (currentSort === 'asc') {
          // Ascending, go to descending
          header.column.toggleSorting(true, false); // desc, not multi-sort
        } else {
          // Descending, clear sort
          header.column.clearSorting();
        }
      }
    };

    const handleGroupClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (canGroup && onToggleGrouping) {
        onToggleGrouping(header.column.id);
      }
    };

    // Determine column type for filter operators
    const columnSchema = columnMeta?.schema;
    const columnTypeCategory: ColumnTypeCategory = columnSchema
      ? getColumnTypeCategory(columnSchema)
      : 'text';

    // Filter handlers
    const handleFilterApply = (filter: UIFilterState) => {
      onFilterAdd?.(filter);
    };

    const handleFilterClear = () => {
      onFilterRemove?.(header.column.id);
    };

    const hasActiveFilter = Boolean(existingFilter);

    return (
      <th
        className={cn(
          'group border-border relative border-r last:border-r-0',
          'bg-muted/30 whitespace-nowrap select-none',
          canSort && 'hover:bg-muted/50 cursor-pointer',
          columnSchema ? 'min-h-14' : 'h-9'
        )}
        style={{
          width: header.getSize(),
        }}
        onClick={handleClick}
      >
        <div className="flex items-center px-2 py-1">
          {/* Column content */}
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            {/* Column name row */}
            <div className="flex min-w-0 items-center gap-1.5">
              {/* Primary key indicator */}
              {isPrimaryKey && (
                <Key className="h-3 w-3 shrink-0 text-amber-500" />
              )}

              {/* Grouping indicator */}
              {isGrouped && (
                <Layers className="text-primary h-3 w-3 shrink-0" />
              )}

              {/* Column name */}
              <span className="truncate text-sm font-medium">
                {flexRender(
                  header.column.columnDef.header,
                  header.getContext()
                )}
              </span>

              {/* Sort indicator */}
              {sortDirection && (
                <span className="shrink-0">
                  {sortDirection === 'asc' ? (
                    <ArrowUp className="h-3 w-3" />
                  ) : (
                    <ArrowDown className="h-3 w-3" />
                  )}
                </span>
              )}
            </div>

            {/* Type badge row */}
            {columnSchema && (
              <TypeBadge
                type={columnSchema.type}
                typeCategory={columnTypeCategory}
                className="self-start"
              />
            )}
          </div>

          {/* Group toggle button (visible on hover) */}
          {canGroup && onToggleGrouping && (
            <button
              className={cn(
                'mr-1 flex h-5 w-5 items-center justify-center rounded opacity-0',
                'transition-opacity group-hover:opacity-100',
                'hover:bg-accent',
                isGrouped && 'text-primary opacity-100'
              )}
              onClick={handleGroupClick}
              title={isGrouped ? 'Remove grouping' : 'Group by this column'}
            >
              <Layers className="h-3 w-3" />
            </button>
          )}

          {/* Filter button with popover (visible on hover or when filter active) */}
          {onFilterAdd && (
            <ColumnFilterPopover
              columnName={header.column.id}
              columnType={columnTypeCategory}
              existingFilter={existingFilter}
              onApply={handleFilterApply}
              onClear={handleFilterClear}
              open={filterPopoverOpen}
              onOpenChange={setFilterPopoverOpen}
            >
              <button
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded opacity-0',
                  'transition-opacity group-hover:opacity-100',
                  'hover:bg-accent',
                  hasActiveFilter && 'text-primary opacity-100'
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  setFilterPopoverOpen(true);
                }}
                title={hasActiveFilter ? 'Edit filter' : 'Filter this column'}
              >
                <Filter className="h-3 w-3" />
              </button>
            </ColumnFilterPopover>
          )}
        </div>

        {/* Resize handle - placed directly under th for proper absolute positioning */}
        {header.column.getCanResize() && (
          <div
            className={cn(
              'absolute top-0 right-0 z-20 h-full w-1 cursor-col-resize select-none',
              'hover:bg-primary/50 active:bg-primary/70',
              'transition-colors duration-75',
              isResizing && 'bg-primary/70'
            )}
            style={{
              touchAction: 'none',
            }}
            onMouseDown={(e) => {
              resizeHandleClickedRef.current = true;
              header.getResizeHandler()(e.nativeEvent);
            }}
            onTouchStart={(e) => {
              resizeHandleClickedRef.current = true;
              header.getResizeHandler()(e.nativeEvent);
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onResetColumnSize?.(header.column.id);
            }}
            onClick={(e) => {
              e.stopPropagation();
            }}
            title="Drag to resize, double-click to reset"
          />
        )}
      </th>
    );
  }
);

interface TableHeaderProps {
  table: Table<TableRowData>;
  onToggleGrouping?: (columnId: string) => void;
  onResetColumnSize?: (columnId: string) => void;
  grouping?: string[];
  /** Sorting state - used to trigger re-render when sorting changes */
  sorting?: { column: string; direction: 'asc' | 'desc' } | null;
  /** Column sizing info - used to trigger re-render during resize */
  columnSizingInfo?: { isResizingColumn: string | false };
  /** Active filters indexed by column name */
  filters?: UIFilterState[];
  /** Callback when a filter is applied */
  onFilterAdd?: (filter: UIFilterState) => void;
  /** Callback when a filter is removed from a column */
  onFilterRemove?: (columnId: string) => void;
}

export const TableHeader = memo(
  ({
    table,
    onToggleGrouping,
    onResetColumnSize,
    grouping = [],
    sorting: _sorting, // Used to trigger re-render when sorting changes
    columnSizingInfo: _columnSizingInfo, // Used to trigger re-render during resize
    filters = [],
    onFilterAdd,
    onFilterRemove,
  }: TableHeaderProps) => {
    // Create a map of column id to existing filter for quick lookup
    const filtersByColumn = filters.reduce<Record<string, UIFilterState>>(
      (acc, filter) => {
        acc[filter.column] = filter;
        return acc;
      },
      {}
    );

    return (
      <thead className="bg-background sticky top-0 z-10">
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id} className="border-border border-b">
            {headerGroup.headers.map((header) => (
              <HeaderCell
                key={header.id}
                header={header}
                onToggleGrouping={onToggleGrouping}
                onResetColumnSize={onResetColumnSize}
                isGrouped={grouping.includes(header.column.id)}
                sortDirection={header.column.getIsSorted()}
                columnSize={header.getSize()}
                existingFilter={filtersByColumn[header.column.id]}
                onFilterAdd={onFilterAdd}
                onFilterRemove={onFilterRemove}
              />
            ))}
          </tr>
        ))}
      </thead>
    );
  }
);

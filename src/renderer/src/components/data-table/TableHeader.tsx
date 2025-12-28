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
  onResetColumnSize?: (columnId: string) => void;
  onToggleGrouping?: (columnId: string) => void;
  isGrouped: boolean;
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
    onResetColumnSize,
    onToggleGrouping,
    isGrouped,
    existingFilter,
    onFilterAdd,
    onFilterRemove,
  }: HeaderCellProps) => {
    // Track clicks for double-click detection on resize handle
    const lastClickTimeRef = useRef<number>(0);
    // State for filter popover
    const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);

    if (header.isPlaceholder) {
      return (
        <div
          className="h-9"
          style={{ width: `var(--col-${header.column.id}-size)` }}
        />
      );
    }

    const canSort = header.column.getCanSort();
    const sortDirection = header.column.getIsSorted();
    const canGroup = header.column.getCanGroup?.() ?? true;
    const isResizing = header.column.getIsResizing();

    const columnMeta = header.column.columnDef.meta as
      | { schema?: ColumnSchema; isPrimaryKey?: boolean }
      | undefined;
    const isPrimaryKey = columnMeta?.isPrimaryKey ?? false;

    const handleClick = () => {
      if (canSort) {
        header.column.toggleSorting();
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
      <div
        className={cn(
          'group border-border relative flex items-center border-r last:border-r-0',
          'bg-muted/30 select-none',
          canSort && 'hover:bg-muted/50 cursor-pointer',
          columnSchema ? 'min-h-14' : 'h-9'
        )}
        style={{ width: `var(--col-${header.column.id}-size)` }}
        onClick={handleClick}
      >
        {/* Column content */}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 px-2 py-1">
          {/* Column name row */}
          <div className="flex min-w-0 items-center gap-1.5">
            {/* Primary key indicator */}
            {isPrimaryKey && (
              <Key className="h-3 w-3 shrink-0 text-amber-500" />
            )}

            {/* Grouping indicator */}
            {isGrouped && <Layers className="text-primary h-3 w-3 shrink-0" />}

            {/* Column name */}
            <span className="truncate text-sm font-medium">
              {flexRender(header.column.columnDef.header, header.getContext())}
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
                'mr-1 flex h-5 w-5 items-center justify-center rounded opacity-0',
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

        {/* Resize handle */}
        {header.column.getCanResize() && (
          <div
            className={cn(
              'absolute top-0 right-0 z-20 h-full w-1 cursor-col-resize',
              'hover:bg-primary/50 active:bg-primary',
              'transition-colors duration-75',
              isResizing && 'bg-primary'
            )}
            onMouseDown={(e) => {
              e.stopPropagation(); // Prevent sorting on click

              const now = Date.now();
              const timeSinceLastClick = now - lastClickTimeRef.current;
              lastClickTimeRef.current = now;

              // Detect double-click (within 300ms)
              if (timeSinceLastClick < 300) {
                e.preventDefault();
                onResetColumnSize?.(header.column.id);
                return;
              }

              // Otherwise, start resize
              header.getResizeHandler()(e);
            }}
            onClick={(e) => e.stopPropagation()} // Prevent sorting on click
            onTouchStart={header.getResizeHandler()}
            title="Drag to resize, double-click to auto-fit"
          />
        )}
      </div>
    );
  }
);

interface TableHeaderProps {
  table: Table<TableRowData>;
  onResetColumnSize?: (columnId: string) => void;
  onToggleGrouping?: (columnId: string) => void;
  grouping?: string[];
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
    onResetColumnSize,
    onToggleGrouping,
    grouping = [],
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
      <div className="bg-background sticky top-0 z-10">
        {table.getHeaderGroups().map((headerGroup) => (
          <div key={headerGroup.id} className="border-border flex border-b">
            {headerGroup.headers.map((header) => (
              <HeaderCell
                key={header.id}
                header={header}
                onResetColumnSize={onResetColumnSize}
                onToggleGrouping={onToggleGrouping}
                isGrouped={grouping.includes(header.column.id)}
                existingFilter={filtersByColumn[header.column.id]}
                onFilterAdd={onFilterAdd}
                onFilterRemove={onFilterRemove}
              />
            ))}
          </div>
        ))}
      </div>
    );
  }
);

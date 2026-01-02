import type { Header, Table } from '@tanstack/react-table';
import type { TableRowData } from './hooks/useTableCore';
import type { ColumnTypeCategory, UIFilterState } from '@/lib/filter-utils';
import type { ColumnSchema } from '@/types/database';
import { flexRender } from '@tanstack/react-table';
import {
  ArrowDown,
  ArrowUp,
  Filter,
  Key,
  Layers,
  Pin,
  PinOff,
} from 'lucide-react';
import { memo, useRef, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { getColumnTypeCategory } from '@/lib/filter-utils';
import { cn } from '@/lib/utils';
import { ColumnFilterPopover } from './ColumnFilterPopover';
import { TypeBadge } from './TypeBadge';

interface HeaderCellProps {
  header: Header<TableRowData, unknown>;
  onToggleGrouping?: (columnId: string) => void;
  onResetColumnSize?: (columnId: string) => void;
  onTogglePin?: (columnId: string) => void;
  isGrouped: boolean;
  /** Number of groups for this column (only when grouped) */
  groupCount?: number;
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
  /** Whether this column is pinned to the left */
  isPinned: boolean;
  /** Left offset for pinned columns */
  pinnedOffset?: number;
  /** Whether this is the last pinned column */
  isLastPinned?: boolean;
}

const HeaderCell = memo(
  ({
    header,
    onToggleGrouping,
    onResetColumnSize,
    onTogglePin,
    isGrouped,
    groupCount,
    sortDirection,
    existingFilter,
    onFilterAdd,
    onFilterRemove,
    isPinned,
    pinnedOffset,
    isLastPinned,
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

    const handlePinClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      onTogglePin?.(header.column.id);
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

    // Calculate pinned styles
    const pinnedStyles: React.CSSProperties = {
      width: header.getSize(),
    };

    if (isPinned) {
      pinnedStyles.position = 'sticky';
      pinnedStyles.left = pinnedOffset ?? 0;
      pinnedStyles.zIndex = 20;
    }

    return (
      <th
        className={cn(
          'group border-border relative border-r border-b',
          'bg-background whitespace-nowrap select-none',
          canSort && 'hover:bg-muted cursor-pointer',
          columnSchema ? 'min-h-14' : 'h-9',
          // Pinned column styles
          isPinned && 'z-20',
          isLastPinned &&
            'after:bg-border after:absolute after:top-0 after:right-0 after:bottom-0 after:w-px after:shadow-[2px_0_4px_rgba(0,0,0,0.1)]'
        )}
        style={pinnedStyles}
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

              {/* Grouping indicator with count */}
              {isGrouped && (
                <span className="text-primary flex shrink-0 items-center gap-0.5">
                  <Layers className="h-3 w-3" />
                  {groupCount !== undefined && (
                    <span className="text-xs">({groupCount})</span>
                  )}
                </span>
              )}

              {/* Column name */}
              <span className="truncate font-medium">
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

          {/* Pin toggle button (visible on hover) */}
          {onTogglePin && (
            <button
              className={cn(
                'mr-1 flex h-5 w-5 items-center justify-center rounded opacity-0',
                'transition-opacity group-hover:opacity-100',
                'hover:bg-accent',
                isPinned && 'text-primary opacity-100'
              )}
              onClick={handlePinClick}
              title={isPinned ? 'Unpin column' : 'Pin column'}
            >
              {isPinned ? (
                <PinOff className="h-3 w-3" />
              ) : (
                <Pin className="h-3 w-3" />
              )}
            </button>
          )}

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
              // Visual bar is 2px wide, but the hit area extends 4px on each side
              'absolute top-0 -right-1 z-20 h-full w-1 cursor-col-resize select-none',
              // Use pseudo-element for larger hit area
              'before:absolute before:inset-y-0 before:-right-2 before:-left-2 before:content-[""]',
              // Visual indicator
              'hover:bg-primary/50 active:bg-primary/70 bg-transparent',
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
  onTogglePin?: (columnId: string) => void;
  grouping?: string[];
  /** Number of grouped rows - used to trigger re-render when grouping changes */
  groupCount?: number;
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
  /** Pinned column IDs (left only) */
  pinnedColumns?: string[];
  /** Enable row selection */
  enableSelection?: boolean;
}

export const TableHeader = memo(
  ({
    table,
    onToggleGrouping,
    onResetColumnSize,
    onTogglePin,
    grouping = [],
    groupCount: _groupCount, // Used to trigger re-render when grouping changes
    sorting: _sorting, // Used to trigger re-render when sorting changes
    columnSizingInfo: _columnSizingInfo, // Used to trigger re-render during resize
    filters = [],
    onFilterAdd,
    onFilterRemove,
    pinnedColumns = [],
    enableSelection = false,
  }: TableHeaderProps) => {
    // Create a map of column id to existing filter for quick lookup
    const filtersByColumn = filters.reduce<Record<string, UIFilterState>>(
      (acc, filter) => {
        acc[filter.column] = filter;
        return acc;
      },
      {}
    );

    // Calculate pinned offsets
    // Selection column width: checkbox (16px) + padding (12px * 2) + border (1px) ≈ 41px
    const SELECTION_COLUMN_WIDTH = 41;
    const pinnedOffsets: Record<string, number> = {};
    let offset = enableSelection ? SELECTION_COLUMN_WIDTH : 0; // Account for selection column
    for (const colId of pinnedColumns) {
      pinnedOffsets[colId] = offset;
      const col = table.getColumn(colId);
      if (col) {
        offset += col.getSize();
      }
    }

    // Calculate group count for the first grouped column
    // Count top-level grouped rows (depth 0)
    const groupCount =
      grouping.length > 0
        ? table
            .getRowModel()
            .rows.filter((row) => row.getIsGrouped() && row.depth === 0).length
        : 0;

    return (
      <thead className="bg-background after:bg-border sticky top-0 z-20 after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px">
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {/* Selection column header */}
            {enableSelection && (
              <th className="bg-background sticky left-0 z-10 h-9 border-r px-3">
                <Checkbox
                  checked={table.getIsAllPageRowsSelected()}
                  indeterminate={
                    table.getIsSomePageRowsSelected() &&
                    !table.getIsAllPageRowsSelected()
                  }
                  onCheckedChange={(checked) =>
                    table.toggleAllPageRowsSelected(!!checked)
                  }
                  aria-label="Select all"
                />
              </th>
            )}
            {headerGroup.headers.map((header) => {
              const isPinned = pinnedColumns.includes(header.column.id);
              const isLastPinned =
                isPinned &&
                pinnedColumns[pinnedColumns.length - 1] === header.column.id;
              const isGrouped = grouping.includes(header.column.id);
              // Only show group count for the first grouped column
              const isFirstGroupedColumn =
                isGrouped && grouping[0] === header.column.id;

              return (
                <HeaderCell
                  key={header.id}
                  header={header}
                  onToggleGrouping={onToggleGrouping}
                  onResetColumnSize={onResetColumnSize}
                  onTogglePin={onTogglePin}
                  isGrouped={isGrouped}
                  groupCount={isFirstGroupedColumn ? groupCount : undefined}
                  sortDirection={header.column.getIsSorted()}
                  columnSize={header.getSize()}
                  existingFilter={filtersByColumn[header.column.id]}
                  onFilterAdd={onFilterAdd}
                  onFilterRemove={onFilterRemove}
                  isPinned={isPinned}
                  pinnedOffset={
                    isPinned ? pinnedOffsets[header.column.id] : undefined
                  }
                  isLastPinned={isLastPinned}
                />
              );
            })}
          </tr>
        ))}
      </thead>
    );
  }
);

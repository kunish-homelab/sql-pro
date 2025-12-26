import type { Header, Table } from '@tanstack/react-table';
import type { TableRowData } from './hooks/useTableCore';
import type { ColumnSchema } from '@/types/database';
import { flexRender } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, Key, Layers } from 'lucide-react';
import { memo, useRef } from 'react';
import { cn } from '@/lib/utils';

interface HeaderCellProps {
  header: Header<TableRowData, unknown>;
  onResetColumnSize?: (columnId: string) => void;
  onToggleGrouping?: (columnId: string) => void;
  isGrouped: boolean;
}

const HeaderCell = memo(
  ({
    header,
    onResetColumnSize,
    onToggleGrouping,
    isGrouped,
  }: HeaderCellProps) => {
    // Track clicks for double-click detection on resize handle
    const lastClickTimeRef = useRef<number>(0);

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

    return (
      <div
        className={cn(
          'group border-border relative flex h-9 items-center border-r last:border-r-0',
          'bg-muted/30 select-none',
          canSort && 'hover:bg-muted/50 cursor-pointer'
        )}
        style={{ width: `var(--col-${header.column.id}-size)` }}
        onClick={handleClick}
      >
        {/* Column content */}
        <div className="flex min-w-0 flex-1 items-center gap-1.5 px-2">
          {/* Primary key indicator */}
          {isPrimaryKey && <Key className="h-3 w-3 shrink-0 text-amber-500" />}

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
}

export const TableHeader = memo(
  ({
    table,
    onResetColumnSize,
    onToggleGrouping,
    grouping = [],
  }: TableHeaderProps) => {
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
              />
            ))}
          </div>
        ))}
      </div>
    );
  }
);

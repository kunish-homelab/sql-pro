import type { Row } from '@tanstack/react-table';
import type { VirtualItem } from '@tanstack/react-virtual';
import type { TableRowData } from './hooks/useTableCore';
import type { PendingChange } from '@/types/database';
import { Checkbox } from '@sqlpro/ui/checkbox';
import { memo, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { GroupRow } from './GroupRow';
import { TableCell } from './TableCell';

interface DataRowProps {
  row: Row<TableRowData>;
  rowIndex: number;
  isDeleted: boolean;
  isNewRow: boolean;
  change?: PendingChange;
  editable?: boolean;
  onCellClick?: (rowId: string, columnId: string) => void;
  onCellDoubleClick?: (rowId: string, columnId: string) => void;
  onCellSave?: (newValue: unknown) => void;
  stopEditing?: () => void;
  isCellFocused?: (rowId: string, columnId: string) => boolean;
  isCellEditing?: (rowId: string, columnId: string) => boolean;
  /** Pinned column IDs (left only) */
  pinnedColumns?: string[];
  /** Pinned column offsets */
  pinnedOffsets?: Record<string, number>;
  /** Enable row selection */
  enableSelection?: boolean;
}

const DataRow = memo(
  ({
    row,
    rowIndex,
    isDeleted,
    isNewRow,
    change,
    editable,
    onCellClick,
    onCellDoubleClick,
    onCellSave,
    stopEditing,
    isCellFocused,
    isCellEditing,
    pinnedColumns = [],
    pinnedOffsets = {},
    enableSelection = false,
  }: DataRowProps) => {
    const isEven = rowIndex % 2 === 0;
    const isSelected = row.getIsSelected();

    return (
      <tr
        className={cn(
          'border-border h-8 border-b',
          isEven ? 'bg-background' : 'bg-muted/20',
          isDeleted && 'bg-destructive/10 line-through opacity-50',
          isNewRow && 'bg-green-500/10',
          isSelected && 'bg-primary/10'
        )}
        data-row-id={row.id}
        data-row-index={rowIndex}
      >
        {/* Selection cell */}
        {enableSelection && (
          <td
            className="bg-background sticky left-0 z-10 border-r px-3"
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked) => row.toggleSelected(!!checked)}
              aria-label="Select row"
            />
          </td>
        )}
        {row.getVisibleCells().map((cell) => {
          const columnId = cell.column.id;
          const isFocused = isCellFocused?.(row.id, columnId) ?? false;
          const isEditing = isCellEditing?.(row.id, columnId) ?? false;

          // Check if this specific cell has a change
          const hasChange =
            change?.type === 'update' &&
            change.newValues &&
            change.oldValues &&
            columnId in change.newValues &&
            change.newValues[columnId] !== change.oldValues[columnId];

          const oldValue = change?.oldValues?.[columnId];

          // Pinning info
          const isPinned = pinnedColumns.includes(columnId);
          const isLastPinned =
            isPinned && pinnedColumns[pinnedColumns.length - 1] === columnId;

          return (
            <TableCell
              key={cell.id}
              cell={cell}
              isFocused={isFocused}
              isEditing={isEditing && !!editable && !isDeleted}
              hasChange={hasChange ?? false}
              oldValue={oldValue}
              onEdit={() => {
                if (editable && !isDeleted) {
                  onCellDoubleClick?.(row.id, columnId);
                }
              }}
              onSave={(value) => {
                onCellSave?.(value);
              }}
              onCancel={() => {
                stopEditing?.();
              }}
              onClick={() => {
                onCellClick?.(row.id, columnId);
              }}
              isPinned={isPinned}
              pinnedOffset={isPinned ? pinnedOffsets[columnId] : undefined}
              isLastPinned={isLastPinned}
            />
          );
        })}
      </tr>
    );
  }
);

interface TableBodyProps {
  rows: Row<TableRowData>[];
  // Virtualization props
  virtualItems: VirtualItem[];
  totalSize: number;
  // Editing props
  editable?: boolean;
  onCellClick?: (rowId: string, columnId: string) => void;
  onCellDoubleClick?: (rowId: string, columnId: string) => void;
  onCellSave?: (newValue: unknown) => void;
  stopEditing?: () => void;
  isCellFocused?: (rowId: string, columnId: string) => boolean;
  isCellEditing?: (rowId: string, columnId: string) => boolean;
  // Change tracking
  changes?: Map<string | number, PendingChange>;
  // Column pinning (left only)
  pinnedColumns?: string[];
  /** Get column size by id */
  getColumnSize?: (columnId: string) => number;
  /** Enable row selection */
  enableSelection?: boolean;
}

export const TableBody = memo(
  ({
    rows,
    virtualItems,
    totalSize,
    editable = false,
    onCellClick,
    onCellDoubleClick,
    onCellSave,
    stopEditing,
    isCellFocused,
    isCellEditing,
    changes,
    pinnedColumns = [],
    getColumnSize,
    enableSelection = false,
  }: TableBodyProps) => {
    // Calculate pinned offsets
    // Selection column width: checkbox (16px) + padding (12px * 2) + border (1px) ≈ 41px
    const SELECTION_COLUMN_WIDTH = 41;
    const pinnedOffsets = useMemo(() => {
      const offsets: Record<string, number> = {};
      let offset = enableSelection ? SELECTION_COLUMN_WIDTH : 0; // Account for selection column
      for (const colId of pinnedColumns) {
        offsets[colId] = offset;
        offset += getColumnSize?.(colId) ?? 150;
      }
      return offsets;
    }, [pinnedColumns, getColumnSize, enableSelection]);

    return (
      <tbody>
        {/* Padding row for virtualization - top spacer */}
        {virtualItems.length > 0 && virtualItems[0].start > 0 && (
          <tr style={{ height: virtualItems[0].start }} />
        )}

        {/* Render only visible rows */}
        {virtualItems.map((virtualItem) => {
          const row = rows[virtualItem.index];
          if (!row) return null;

          const isGroupRow = row.getIsGrouped?.() ?? false;
          const rowData = row.original as TableRowData;
          const rowId = rowData.__rowId ?? row.id;
          const isDeleted = rowData.__deleted ?? false;
          const isNewRow = rowData.__isNew ?? false;

          // Get change for this row
          const change = changes?.get(rowId);

          if (isGroupRow) {
            return <GroupRow key={row.id} row={row} />;
          }

          return (
            <DataRow
              key={row.id}
              row={row}
              rowIndex={virtualItem.index}
              isDeleted={isDeleted}
              isNewRow={isNewRow}
              change={change}
              editable={editable}
              onCellClick={onCellClick}
              onCellDoubleClick={onCellDoubleClick}
              onCellSave={onCellSave}
              stopEditing={stopEditing}
              isCellFocused={isCellFocused}
              isCellEditing={isCellEditing}
              pinnedColumns={pinnedColumns}
              pinnedOffsets={pinnedOffsets}
              enableSelection={enableSelection}
            />
          );
        })}

        {/* Padding row for virtualization - bottom spacer */}
        {virtualItems.length > 0 &&
          totalSize - virtualItems[virtualItems.length - 1].end > 0 && (
            <tr
              style={{
                height: totalSize - virtualItems[virtualItems.length - 1].end,
              }}
            />
          )}
      </tbody>
    );
  }
);

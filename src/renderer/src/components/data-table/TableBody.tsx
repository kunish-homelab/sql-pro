import { memo } from 'react';
import { Row } from '@tanstack/react-table';
import { VirtualItem } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';
import { TableCell } from './TableCell';
import { GroupRow } from './GroupRow';
import type { TableRowData } from './hooks/useTableCore';
import type { PendingChange } from '@/types/database';

interface TableBodyProps {
  virtualRows: VirtualItem[];
  rows: Row<TableRowData>[];
  totalHeight: number;
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
}

export const TableBody = memo(function TableBody({
  virtualRows,
  rows,
  totalHeight,
  editable = false,
  onCellClick,
  onCellDoubleClick,
  onCellSave,
  stopEditing,
  isCellFocused,
  isCellEditing,
  changes,
}: TableBodyProps) {
  return (
    <div
      className="relative"
      style={{ height: `${totalHeight}px` }}
    >
      {virtualRows.map((virtualRow) => {
        const row = rows[virtualRow.index];
        if (!row) return null;

        const isGroupRow = row.getIsGrouped?.() ?? false;
        const rowData = row.original as TableRowData;
        const rowId = rowData.__rowId ?? row.id;
        const isDeleted = rowData.__deleted ?? false;
        const isNewRow = rowData.__isNew ?? false;

        // Get change for this row
        const change = changes?.get(rowId);

        if (isGroupRow) {
          return (
            <GroupRow
              key={row.id}
              row={row}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            />
          );
        }

        return (
          <DataRow
            key={row.id}
            row={row}
            virtualRow={virtualRow}
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
          />
        );
      })}
    </div>
  );
});

interface DataRowProps {
  row: Row<TableRowData>;
  virtualRow: VirtualItem;
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
}

const DataRow = memo(function DataRow({
  row,
  virtualRow,
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
}: DataRowProps) {
  const isEven = virtualRow.index % 2 === 0;

  return (
    <div
      className={cn(
        'absolute left-0 top-0 flex w-full items-center border-b border-border',
        isEven ? 'bg-background' : 'bg-muted/20',
        isDeleted && 'bg-destructive/10 line-through opacity-50',
        isNewRow && 'bg-green-500/10'
      )}
      style={{
        height: `${virtualRow.size}px`,
        transform: `translateY(${virtualRow.start}px)`,
      }}
      data-row-id={row.id}
    >
      {row.getVisibleCells().map((cell) => {
        const columnId = cell.column.id;
        const isFocused = isCellFocused?.(row.id, columnId) ?? false;
        const isEditing = isCellEditing?.(row.id, columnId) ?? false;

        // Check if this specific cell has a change
        const hasChange = change?.type === 'update' &&
          change.newValues &&
          change.oldValues &&
          columnId in change.newValues &&
          change.newValues[columnId] !== change.oldValues[columnId];

        const oldValue = change?.oldValues?.[columnId];

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
          />
        );
      })}
    </div>
  );
});

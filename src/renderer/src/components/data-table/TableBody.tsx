import type { Row } from '@tanstack/react-table';
import type { TableRowData } from './hooks/useTableCore';
import type { PendingChange } from '@/types/database';
import { memo } from 'react';
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
  }: DataRowProps) => {
    const isEven = rowIndex % 2 === 0;

    return (
      <tr
        className={cn(
          'border-border border-b',
          isEven ? 'bg-background' : 'bg-muted/20',
          isDeleted && 'bg-destructive/10 line-through opacity-50',
          isNewRow && 'bg-green-500/10'
        )}
        data-row-id={row.id}
        data-row-index={rowIndex}
      >
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
      </tr>
    );
  }
);

interface TableBodyProps {
  rows: Row<TableRowData>[];
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

export const TableBody = memo(
  ({
    rows,
    editable = false,
    onCellClick,
    onCellDoubleClick,
    onCellSave,
    stopEditing,
    isCellFocused,
    isCellEditing,
    changes,
  }: TableBodyProps) => {
    return (
      <tbody>
        {rows.map((row, index) => {
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
              rowIndex={index}
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
      </tbody>
    );
  }
);

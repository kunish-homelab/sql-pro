import { useState, useMemo, useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowUp, ArrowDown, Key, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EditableCell } from './EditableCell';
import { useChangesStore } from '@/stores';
import type { ColumnSchema, SortState, PendingChange } from '@/types/database';

interface EditableDataGridProps {
  tableName: string;
  columns: ColumnSchema[];
  rows: Record<string, unknown>[];
  sort: SortState | null;
  onSort: (column: string) => void;
  primaryKeyColumn?: string;
  readOnly?: boolean;
}

export function EditableDataGrid({
  tableName,
  columns,
  rows,
  sort,
  onSort,
  primaryKeyColumn,
  readOnly = false,
}: EditableDataGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const { changes, addChange, getChangeForRow } = useChangesStore();
  const [editingCell, setEditingCell] = useState<{
    rowIndex: number;
    column: string;
  } | null>(null);

  // Get the row ID for a given row
  const getRowId = useCallback(
    (row: Record<string, unknown>, index: number): string | number => {
      if (primaryKeyColumn && row[primaryKeyColumn] !== undefined) {
        return row[primaryKeyColumn] as string | number;
      }
      // Fall back to rowid if available
      if (row.rowid !== undefined) {
        return row.rowid as number;
      }
      // Last resort: use index (not ideal for edits)
      return index;
    },
    [primaryKeyColumn]
  );

  // Merge original rows with pending changes
  const displayRows = useMemo(() => {
    return rows.map((row, index) => {
      const rowId = getRowId(row, index);
      const change = getChangeForRow(tableName, rowId);

      if (change?.type === 'delete') {
        return { ...row, __deleted: true, __rowId: rowId };
      }

      if (change?.type === 'update' && change.newValues) {
        return {
          ...row,
          ...change.newValues,
          __rowId: rowId,
          __change: change,
        };
      }

      return { ...row, __rowId: rowId };
    });
  }, [rows, changes, tableName, getRowId, getChangeForRow]);

  // Get changes for a specific cell
  const getCellChange = useCallback(
    (rowId: string | number, column: string): PendingChange | undefined => {
      const change = getChangeForRow(tableName, rowId);
      if (
        change?.type === 'update' &&
        change.newValues?.[column] !== undefined
      ) {
        return change;
      }
      return undefined;
    },
    [tableName, getChangeForRow]
  );

  const rowVirtualizer = useVirtualizer({
    count: displayRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 10,
  });

  // Calculate column widths
  const columnWidths = useMemo(() => {
    const widths = columns.map((col) => {
      const headerWidth = col.name.length * 8 + 40;
      const maxContentWidth = rows.slice(0, 100).reduce((max, row) => {
        const value = row[col.name];
        const strValue = value === null ? 'NULL' : String(value);
        return Math.max(max, strValue.length * 7);
      }, 0);
      return Math.min(Math.max(headerWidth, maxContentWidth, 80), 400);
    });
    // Add width for actions column
    return [...widths, 50];
  }, [columns, rows]);

  const totalWidth = columnWidths.reduce((sum, w) => sum + w, 0);

  const handleCellEdit = (rowIndex: number, column: string) => {
    if (readOnly) return;
    setEditingCell({ rowIndex, column });
  };

  const handleCellSave = (
    rowIndex: number,
    column: string,
    newValue: unknown
  ) => {
    const row = displayRows[rowIndex];
    const rowId = row.__rowId as string | number;
    const originalRow = rows[rowIndex];
    const oldValue = originalRow[column];

    // Only create change if value actually changed
    if (newValue !== oldValue) {
      addChange({
        table: tableName,
        rowId,
        type: 'update',
        oldValues: originalRow,
        newValues: { [column]: newValue },
      });
    }

    setEditingCell(null);
  };

  const handleDeleteRow = (rowIndex: number) => {
    if (readOnly) return;
    const row = displayRows[rowIndex];
    const rowId = row.__rowId as string | number;
    const originalRow = rows[rowIndex];

    addChange({
      table: tableName,
      rowId,
      type: 'delete',
      oldValues: originalRow,
      newValues: null,
    });
  };

  if (columns.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        No data to display
      </div>
    );
  }

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div style={{ minWidth: totalWidth }}>
        {/* Header */}
        <div className="sticky top-0 z-10 flex border-b bg-muted/50 backdrop-blur-sm">
          {columns.map((col, idx) => (
            <div
              key={col.name}
              className="flex items-center gap-1 border-r px-3 py-2"
              style={{ width: columnWidths[idx], minWidth: columnWidths[idx] }}
            >
              <button
                onClick={() => onSort(col.name)}
                className="flex flex-1 items-center gap-1 text-left text-sm font-medium hover:text-foreground"
              >
                {col.isPrimaryKey && <Key className="h-3 w-3 text-amber-500" />}
                <span className="truncate">{col.name}</span>
                {sort?.column === col.name &&
                  (sort.direction === 'asc' ? (
                    <ArrowUp className="h-3 w-3 flex-shrink-0" />
                  ) : (
                    <ArrowDown className="h-3 w-3 flex-shrink-0" />
                  ))}
              </button>
            </div>
          ))}
          {/* Actions header */}
          <div
            className="flex items-center justify-center px-2 py-2"
            style={{
              width: columnWidths[columnWidths.length - 1],
              minWidth: columnWidths[columnWidths.length - 1],
            }}
          />
        </div>

        {/* Body */}
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = displayRows[virtualRow.index];
            const isDeleted = row.__deleted;
            const rowId = row.__rowId as string | number;

            return (
              <div
                key={virtualRow.index}
                className={cn(
                  'absolute left-0 flex w-full border-b',
                  virtualRow.index % 2 === 0 ? 'bg-background' : 'bg-muted/20',
                  isDeleted && 'bg-red-500/10 line-through opacity-50'
                )}
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {columns.map((col, idx) => {
                  const value = row[col.name];
                  const cellChange = getCellChange(rowId, col.name);
                  const originalValue = rows[virtualRow.index]?.[col.name];
                  const isEditing =
                    editingCell?.rowIndex === virtualRow.index &&
                    editingCell?.column === col.name;

                  return (
                    <div
                      key={col.name}
                      className="flex items-center border-r px-2"
                      style={{
                        width: columnWidths[idx],
                        minWidth: columnWidths[idx],
                      }}
                    >
                      <EditableCell
                        value={value}
                        type={col.type}
                        isEditing={isEditing && !readOnly && !isDeleted}
                        hasChange={!!cellChange}
                        oldValue={originalValue}
                        onEdit={() =>
                          handleCellEdit(virtualRow.index, col.name)
                        }
                        onSave={(newValue) =>
                          handleCellSave(virtualRow.index, col.name, newValue)
                        }
                        onCancel={() => setEditingCell(null)}
                      />
                    </div>
                  );
                })}
                {/* Actions */}
                <div
                  className="flex items-center justify-center"
                  style={{
                    width: columnWidths[columnWidths.length - 1],
                    minWidth: columnWidths[columnWidths.length - 1],
                  }}
                >
                  {!readOnly && !isDeleted && (
                    <button
                      onClick={() => handleDeleteRow(virtualRow.index)}
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title="Delete row"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

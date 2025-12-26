import type { ColumnSchema, PendingChange, SortState } from '@/types/database';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowDown, ArrowUp, Key, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useResizableColumns } from '@/hooks/useResizableColumns';
import { cn } from '@/lib/utils';
import { useChangesStore } from '@/stores';
import { ColumnResizeHandle } from './ColumnResizeHandle';
import { EditableCell } from './EditableCell';

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
  const [focusedCell, setFocusedCell] = useState<{
    rowIndex: number;
    colIndex: number;
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

  // Merge original rows with pending changes, including new inserts
  const displayRows = useMemo(() => {
    // Get pending inserts for this table (prepend to existing rows)
    const insertedRows = changes
      .filter((c) => c.table === tableName && c.type === 'insert')
      .map((c) => ({
        ...c.newValues,
        __rowId: c.rowId,
        __isNew: true,
        __change: c,
      }));

    // Map existing rows with updates/deletes
    const existingRows = rows.map((row, index) => {
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

    // Inserts appear at the top
    return [...insertedRows, ...existingRows];
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

  // Resizable columns
  const {
    columnWidths: dataColumnWidths,
    totalWidth: dataTotalWidth,
    handleResizeStart,
    handleResizeDoubleClick,
    isResizing,
    resizingColumn,
  } = useResizableColumns({
    columns,
    rows,
    minWidth: 50,
  });

  // Add width for actions column
  const columnWidths = [...dataColumnWidths, 50];
  const totalWidth = dataTotalWidth + 50;

  const handleCellEdit = useCallback(
    (rowIndex: number, column: string) => {
      if (readOnly) return;
      setEditingCell({ rowIndex, column });
    },
    [readOnly]
  );

  const handleCellSave = useCallback(
    (rowIndex: number, column: string, newValue: unknown) => {
      const row = displayRows[rowIndex];
      const rowId = row.__rowId as string | number;
      const isNew = '__isNew' in row && row.__isNew;

      if (isNew) {
        // For new rows, update the existing insert change
        const existingChange = getChangeForRow(tableName, rowId);
        if (existingChange) {
          addChange({
            table: tableName,
            rowId,
            type: 'insert',
            oldValues: null,
            newValues: { ...existingChange.newValues, [column]: newValue },
          });
        }
      } else {
        // For existing rows, create/merge update change
        // Find the actual row index in the original rows array
        const insertCount = changes.filter(
          (c) => c.table === tableName && c.type === 'insert'
        ).length;
        const originalRowIndex = rowIndex - insertCount;
        const originalRow = rows[originalRowIndex];
        const oldValue = originalRow?.[column];

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
      }

      setEditingCell(null);
    },
    [displayRows, tableName, getChangeForRow, addChange, changes, rows]
  );

  const handleDeleteRow = useCallback(
    (rowIndex: number) => {
      if (readOnly) return;
      const row = displayRows[rowIndex];
      const rowId = row.__rowId as string | number;
      const isNew = '__isNew' in row && row.__isNew;

      if (isNew) {
        // For new rows, removing the insert will be handled by addChange
        addChange({
          table: tableName,
          rowId,
          type: 'delete',
          oldValues: null,
          newValues: null,
        });
      } else {
        // For existing rows, find the actual row in original rows array
        const insertCount = changes.filter(
          (c) => c.table === tableName && c.type === 'insert'
        ).length;
        const originalRowIndex = rowIndex - insertCount;
        const originalRow = rows[originalRowIndex];

        addChange({
          table: tableName,
          rowId,
          type: 'delete',
          oldValues: originalRow,
          newValues: null,
        });
      }
    },
    [readOnly, displayRows, tableName, addChange, changes, rows]
  );

  // Calculate next/previous cell for keyboard navigation
  const getNextCell = useCallback(
    (
      rowIdx: number,
      colIdx: number,
      reverse: boolean
    ): { rowIndex: number; colIndex: number } | null => {
      const totalCols = columns.length;
      const totalRows = displayRows.length;

      if (reverse) {
        // Shift+Tab: go left, then up
        if (colIdx > 0) return { rowIndex: rowIdx, colIndex: colIdx - 1 };
        if (rowIdx > 0)
          return { rowIndex: rowIdx - 1, colIndex: totalCols - 1 };
        return null; // At start of grid
      } else {
        // Tab: go right, then down
        if (colIdx < totalCols - 1)
          return { rowIndex: rowIdx, colIndex: colIdx + 1 };
        if (rowIdx < totalRows - 1)
          return { rowIndex: rowIdx + 1, colIndex: 0 };
        return null; // At end of grid
      }
    },
    [columns.length, displayRows.length]
  );

  // Handle keyboard navigation from cells
  const handleCellKeyDown = useCallback(
    (e: React.KeyboardEvent, rowIdx: number, colIdx: number) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const next = getNextCell(rowIdx, colIdx, e.shiftKey);
        if (next) {
          setFocusedCell(next);
          setEditingCell({
            rowIndex: next.rowIndex,
            column: columns[next.colIndex].name,
          });
        }
      } else if (e.key === 'Enter' && !e.shiftKey) {
        // Enter confirms and moves down
        e.preventDefault();

        const currentRow = displayRows[rowIdx];
        const isNew = '__isNew' in currentRow && currentRow.__isNew === true;
        const isLastRow = rowIdx === displayRows.length - 1;
        const isLastColumn = colIdx === columns.length - 1;

        // If on last cell of a new row, create another new row
        if (isNew && isLastRow && isLastColumn) {
          // Create a new row
          const tempId = -Date.now();
          const newRow: Record<string, unknown> = {};
          columns.forEach((col) => {
            newRow[col.name] = col.defaultValue ?? null;
          });

          addChange({
            table: tableName,
            rowId: tempId,
            type: 'insert',
            oldValues: null,
            newValues: newRow,
          });

          // Move focus to first cell of new row (which will be at index 0 after insert)
          setTimeout(() => {
            setFocusedCell({ rowIndex: 0, colIndex: 0 });
            setEditingCell({ rowIndex: 0, column: columns[0].name });
          }, 0);
        } else if (rowIdx < displayRows.length - 1) {
          const next = { rowIndex: rowIdx + 1, colIndex: colIdx };
          setFocusedCell(next);
          setEditingCell({
            rowIndex: next.rowIndex,
            column: columns[next.colIndex].name,
          });
        } else {
          setEditingCell(null);
        }
      } else if (e.key === 'Escape') {
        setEditingCell(null);
        setFocusedCell(null);
      }
    },
    [getNextCell, columns, displayRows, tableName, addChange]
  );

  // Handle arrow key navigation when not editing (grid-level navigation)
  const handleGridKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Only handle arrow keys when we have a focused cell but not editing
      if (!focusedCell || editingCell) return;

      const { rowIndex, colIndex } = focusedCell;
      let next: { rowIndex: number; colIndex: number } | null = null;

      switch (e.key) {
        case 'ArrowUp':
          if (rowIndex > 0) {
            next = { rowIndex: rowIndex - 1, colIndex };
          }
          break;
        case 'ArrowDown':
          if (rowIndex < displayRows.length - 1) {
            next = { rowIndex: rowIndex + 1, colIndex };
          }
          break;
        case 'ArrowLeft':
          if (colIndex > 0) {
            next = { rowIndex, colIndex: colIndex - 1 };
          }
          break;
        case 'ArrowRight':
          if (colIndex < columns.length - 1) {
            next = { rowIndex, colIndex: colIndex + 1 };
          }
          break;
        case 'Enter':
          // Enter on focused cell starts editing
          e.preventDefault();
          setEditingCell({
            rowIndex,
            column: columns[colIndex].name,
          });
          return;
      }

      if (next) {
        e.preventDefault();
        setFocusedCell(next);
      }
    },
    [focusedCell, editingCell, displayRows.length, columns]
  );

  // Handle cell click to set focus
  const handleCellClick = useCallback((rowIndex: number, colIndex: number) => {
    setFocusedCell({ rowIndex, colIndex });
  }, []);

  // Handle copy (Ctrl+C) - copy focused cell value
  const handleCopy = useCallback(async () => {
    if (!focusedCell) return;

    const row = displayRows[focusedCell.rowIndex];
    const col = columns[focusedCell.colIndex];
    const value = (row as Record<string, unknown>)[col.name];

    const text = value === null ? '' : String(value);
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  }, [focusedCell, displayRows, columns]);

  // Handle paste (Ctrl+V) - paste into focused cell
  const handlePaste = useCallback(async () => {
    if (!focusedCell || readOnly) return;

    const row = displayRows[focusedCell.rowIndex];
    const isDeleted = '__deleted' in row && row.__deleted === true;
    if (isDeleted) return;

    try {
      const text = await navigator.clipboard.readText();
      const col = columns[focusedCell.colIndex];
      handleCellSave(focusedCell.rowIndex, col.name, text);
    } catch (err) {
      console.error('Failed to read from clipboard:', err);
    }
  }, [focusedCell, readOnly, displayRows, columns, handleCellSave]);

  // Handle global keyboard shortcuts (copy/paste)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Only handle when grid is focused and not editing
      if (editingCell) return;
      if (!parentRef.current?.contains(document.activeElement)) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        handleCopy();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        handlePaste();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [editingCell, handleCopy, handlePaste]);

  if (columns.length === 0) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center">
        No data to display
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className={cn(
        'h-full w-full overflow-auto outline-none',
        isResizing && 'select-none'
      )}
      tabIndex={0}
      onKeyDown={handleGridKeyDown}
    >
      <div style={{ minWidth: totalWidth }}>
        {/* Header */}
        <div className="bg-muted/50 sticky top-0 z-10 flex border-b backdrop-blur-sm">
          {columns.map((col, idx) => (
            <div
              key={col.name}
              className="relative flex items-center gap-1 border-r px-3 py-2"
              style={{ width: columnWidths[idx], minWidth: columnWidths[idx] }}
            >
              <button
                onClick={() => onSort(col.name)}
                className="hover:text-foreground flex flex-1 items-center gap-1 text-left text-sm font-medium"
              >
                {col.isPrimaryKey && <Key className="h-3 w-3 text-amber-500" />}
                <span className="truncate">{col.name}</span>
                {sort?.column === col.name &&
                  (sort.direction === 'asc' ? (
                    <ArrowUp className="h-3 w-3 shrink-0" />
                  ) : (
                    <ArrowDown className="h-3 w-3 shrink-0" />
                  ))}
              </button>
              <ColumnResizeHandle
                onMouseDown={(e) => handleResizeStart(idx, e)}
                onDoubleClick={() => handleResizeDoubleClick(idx)}
                isResizing={resizingColumn === idx}
              />
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
            const isDeleted = '__deleted' in row && row.__deleted === true;
            const isNew = '__isNew' in row && row.__isNew === true;
            const rowId = row.__rowId as string | number;

            return (
              <div
                key={virtualRow.index}
                className={cn(
                  'absolute left-0 flex w-full border-b',
                  virtualRow.index % 2 === 0 ? 'bg-background' : 'bg-muted/20',
                  isDeleted && 'bg-red-500/10 line-through opacity-50',
                  isNew && 'border-l-2 border-l-green-500 bg-green-500/10'
                )}
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {columns.map((col, idx) => {
                  const value = (row as Record<string, unknown>)[col.name];
                  const cellChange = getCellChange(rowId, col.name);
                  const originalValue = rows[virtualRow.index]?.[col.name];
                  const isEditing =
                    editingCell?.rowIndex === virtualRow.index &&
                    editingCell?.column === col.name;
                  const isFocused =
                    focusedCell?.rowIndex === virtualRow.index &&
                    focusedCell?.colIndex === idx;

                  return (
                    <div
                      key={col.name}
                      className={cn(
                        'flex items-center border-r px-2',
                        isFocused &&
                          !isEditing &&
                          'ring-primary ring-2 ring-inset'
                      )}
                      style={{
                        width: columnWidths[idx],
                        minWidth: columnWidths[idx],
                      }}
                      onClick={() => handleCellClick(virtualRow.index, idx)}
                    >
                      {/* NEW badge for first column of new rows */}
                      {isNew && idx === 0 && (
                        <span className="mr-1 rounded bg-green-500 px-1 py-0.5 text-[10px] font-medium text-white">
                          NEW
                        </span>
                      )}
                      <EditableCell
                        value={value}
                        column={col}
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
                        onKeyDown={(e) =>
                          handleCellKeyDown(e, virtualRow.index, idx)
                        }
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
                      className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded p-1"
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

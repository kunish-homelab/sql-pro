import type { Table } from '@tanstack/react-table';
import type { RefObject } from 'react';
import type { TableRowData } from './useTableCore';
import type { ColumnSchema } from '@/types/database';
import { useCallback, useEffect, useState } from 'react';
import { useVimKeyHandler } from '@/hooks/useVimKeyHandler';
import { useSettingsStore } from '@/stores';

interface CellPosition {
  rowId: string;
  columnId: string;
}

interface UseTableEditingOptions {
  table: Table<TableRowData>;
  containerRef: RefObject<HTMLDivElement | null>;
  editable?: boolean;
  onCellChange?: (
    rowId: string | number,
    columnId: string,
    newValue: unknown,
    oldValue: unknown
  ) => void;
  onRowDelete?: (rowId: string | number) => void;
  onRowInsert?: (values: Record<string, unknown>) => void;
}

interface UseTableEditingReturn {
  focusedCell: CellPosition | null;
  editingCell: CellPosition | null;
  setFocusedCell: (cell: CellPosition | null) => void;
  startEditing: (rowId: string, columnId: string) => void;
  stopEditing: () => void;
  handleCellClick: (rowId: string, columnId: string) => void;
  handleCellDoubleClick: (rowId: string, columnId: string) => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  handleCellSave: (newValue: unknown) => void;
  validateValue: (value: string, column: ColumnSchema) => string | null;
  isCellFocused: (rowId: string, columnId: string) => boolean;
  isCellEditing: (rowId: string, columnId: string) => boolean;
}

export function useTableEditing({
  table,
  containerRef,
  editable = true,
  onCellChange,
  onRowDelete,
  // onRowInsert is reserved for future use
  onRowInsert: _onRowInsert,
}: UseTableEditingOptions): UseTableEditingReturn {
  const [focusedCell, setFocusedCell] = useState<CellPosition | null>(null);
  const [editingCell, setEditingCell] = useState<CellPosition | null>(null);

  // Vim mode support
  const appVimMode = useSettingsStore((s) => s.appVimMode);
  const { handleKey: handleVimKey, resetSequence } = useVimKeyHandler();

  // Start editing a cell
  const startEditing = useCallback(
    (rowId: string, columnId: string) => {
      if (!editable) return;

      // Check if the row is a group row (not editable)
      const rows = table.getRowModel().rows;
      const row = rows.find((r) => r.id === rowId);
      if (row?.getIsGrouped?.()) return;

      // Check if the row is deleted
      const rowData = row?.original as TableRowData | undefined;
      if (rowData?.__deleted) return;

      setEditingCell({ rowId, columnId });
      setFocusedCell({ rowId, columnId });
    },
    [editable, table]
  );

  // Stop editing
  const stopEditing = useCallback(() => {
    setEditingCell(null);
  }, []);

  // Handle cell click
  const handleCellClick = useCallback((rowId: string, columnId: string) => {
    setFocusedCell({ rowId, columnId });
  }, []);

  // Handle cell double click
  const handleCellDoubleClick = useCallback(
    (rowId: string, columnId: string) => {
      startEditing(rowId, columnId);
    },
    [startEditing]
  );

  // Get the next/previous cell for navigation
  const getAdjacentCell = useCallback(
    (
      direction: 'up' | 'down' | 'left' | 'right' | 'next' | 'prev'
    ): CellPosition | null => {
      if (!focusedCell) return null;

      const rows = table.getRowModel().rows;
      const columns = table.getVisibleLeafColumns();

      const currentRowIndex = rows.findIndex((r) => r.id === focusedCell.rowId);
      const currentColIndex = columns.findIndex(
        (c) => c.id === focusedCell.columnId
      );

      if (currentRowIndex === -1 || currentColIndex === -1) return null;

      let newRowIndex = currentRowIndex;
      let newColIndex = currentColIndex;

      switch (direction) {
        case 'up':
          newRowIndex = Math.max(0, currentRowIndex - 1);
          break;
        case 'down':
          newRowIndex = Math.min(rows.length - 1, currentRowIndex + 1);
          break;
        case 'left':
          newColIndex = Math.max(0, currentColIndex - 1);
          break;
        case 'right':
          newColIndex = Math.min(columns.length - 1, currentColIndex + 1);
          break;
        case 'next': // Tab
          if (currentColIndex < columns.length - 1) {
            newColIndex = currentColIndex + 1;
          } else if (currentRowIndex < rows.length - 1) {
            newRowIndex = currentRowIndex + 1;
            newColIndex = 0;
          }
          break;
        case 'prev': // Shift+Tab
          if (currentColIndex > 0) {
            newColIndex = currentColIndex - 1;
          } else if (currentRowIndex > 0) {
            newRowIndex = currentRowIndex - 1;
            newColIndex = columns.length - 1;
          }
          break;
      }

      // Skip group rows when navigating
      const newRow = rows[newRowIndex];
      if (newRow?.getIsGrouped?.()) {
        // Try to find next non-group row
        if (direction === 'down' || direction === 'next') {
          for (let i = newRowIndex + 1; i < rows.length; i++) {
            if (!rows[i].getIsGrouped?.()) {
              newRowIndex = i;
              break;
            }
          }
        } else if (direction === 'up' || direction === 'prev') {
          for (let i = newRowIndex - 1; i >= 0; i--) {
            if (!rows[i].getIsGrouped?.()) {
              newRowIndex = i;
              break;
            }
          }
        }
      }

      const targetRow = rows[newRowIndex];
      const targetCol = columns[newColIndex];

      if (!targetRow || !targetCol) return null;

      return { rowId: targetRow.id, columnId: targetCol.id };
    },
    [focusedCell, table]
  );

  // Jump to specific positions (for vim gg, G, 0, $)
  const jumpToPosition = useCallback(
    (position: 'top' | 'bottom' | 'start' | 'end'): CellPosition | null => {
      const rows = table.getRowModel().rows;
      const columns = table.getVisibleLeafColumns();

      if (rows.length === 0 || columns.length === 0) return null;

      // Find first/last non-group row
      const findNonGroupRow = (fromStart: boolean): number => {
        if (fromStart) {
          for (let i = 0; i < rows.length; i++) {
            if (!rows[i].getIsGrouped?.()) return i;
          }
        } else {
          for (let i = rows.length - 1; i >= 0; i--) {
            if (!rows[i].getIsGrouped?.()) return i;
          }
        }
        return -1;
      };

      const currentColIndex = focusedCell
        ? columns.findIndex((c) => c.id === focusedCell.columnId)
        : 0;
      const currentRowIndex = focusedCell
        ? rows.findIndex((r) => r.id === focusedCell.rowId)
        : 0;

      let targetRowIndex = currentRowIndex;
      let targetColIndex = currentColIndex >= 0 ? currentColIndex : 0;

      switch (position) {
        case 'top':
          targetRowIndex = findNonGroupRow(true);
          break;
        case 'bottom':
          targetRowIndex = findNonGroupRow(false);
          break;
        case 'start':
          targetColIndex = 0;
          break;
        case 'end':
          targetColIndex = columns.length - 1;
          break;
      }

      if (targetRowIndex === -1) return null;

      const targetRow = rows[targetRowIndex];
      const targetCol = columns[targetColIndex];

      if (!targetRow || !targetCol) return null;

      return { rowId: targetRow.id, columnId: targetCol.id };
    },
    [focusedCell, table]
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!focusedCell) return;

      // If editing, let the cell handle most keys
      if (editingCell) {
        if (e.key === 'Escape') {
          e.preventDefault();
          stopEditing();
          resetSequence();
        }
        // Tab and Enter are handled by cell editor
        return;
      }

      // Handle vim keys when appVimMode is enabled
      if (appVimMode) {
        const { command, handled } = handleVimKey(e.key, e.shiftKey);

        if (handled) {
          e.preventDefault();

          switch (command) {
            case 'move-down': {
              const downCell = getAdjacentCell('down');
              if (downCell) setFocusedCell(downCell);
              break;
            }
            case 'move-up': {
              const upCell = getAdjacentCell('up');
              if (upCell) setFocusedCell(upCell);
              break;
            }
            case 'move-left': {
              const leftCell = getAdjacentCell('left');
              if (leftCell) setFocusedCell(leftCell);
              break;
            }
            case 'move-right': {
              const rightCell = getAdjacentCell('right');
              if (rightCell) setFocusedCell(rightCell);
              break;
            }
            case 'jump-top': {
              const topCell = jumpToPosition('top');
              if (topCell) setFocusedCell(topCell);
              break;
            }
            case 'jump-bottom': {
              const bottomCell = jumpToPosition('bottom');
              if (bottomCell) setFocusedCell(bottomCell);
              break;
            }
            case 'jump-start': {
              const startCell = jumpToPosition('start');
              if (startCell) setFocusedCell(startCell);
              break;
            }
            case 'jump-end': {
              const endCell = jumpToPosition('end');
              if (endCell) setFocusedCell(endCell);
              break;
            }
            case 'enter-edit': {
              if (editable) {
                startEditing(focusedCell.rowId, focusedCell.columnId);
              }
              break;
            }
            case 'exit-mode': {
              resetSequence();
              break;
            }
            // 'select' is same as enter-edit for table
            case 'select': {
              if (editable) {
                startEditing(focusedCell.rowId, focusedCell.columnId);
              }
              break;
            }
          }
          return;
        }
      }

      // Standard keyboard navigation (always active)
      switch (e.key) {
        case 'ArrowUp': {
          e.preventDefault();
          const upCell = getAdjacentCell('up');
          if (upCell) setFocusedCell(upCell);
          break;
        }

        case 'ArrowDown': {
          e.preventDefault();
          const downCell = getAdjacentCell('down');
          if (downCell) setFocusedCell(downCell);
          break;
        }

        case 'ArrowLeft': {
          e.preventDefault();
          const leftCell = getAdjacentCell('left');
          if (leftCell) setFocusedCell(leftCell);
          break;
        }

        case 'ArrowRight': {
          e.preventDefault();
          const rightCell = getAdjacentCell('right');
          if (rightCell) setFocusedCell(rightCell);
          break;
        }

        case 'Tab': {
          e.preventDefault();
          const tabCell = getAdjacentCell(e.shiftKey ? 'prev' : 'next');
          if (tabCell) {
            setFocusedCell(tabCell);
            if (editable) {
              startEditing(tabCell.rowId, tabCell.columnId);
            }
          }
          break;
        }

        case 'Enter':
          e.preventDefault();
          if (editable) {
            startEditing(focusedCell.rowId, focusedCell.columnId);
          }
          break;

        case 'Delete':
        case 'Backspace': {
          if (e.key === 'Delete' && onRowDelete && focusedCell) {
            const row = table
              .getRowModel()
              .rows.find((r) => r.id === focusedCell.rowId);
            if (row && !row.getIsGrouped?.()) {
              const rowData = row.original as TableRowData;
              const rowId = rowData.__rowId ?? row.id;
              onRowDelete(rowId);
            }
          }
          break;
        }
      }
    },
    [
      focusedCell,
      editingCell,
      editable,
      appVimMode,
      getAdjacentCell,
      jumpToPosition,
      handleVimKey,
      resetSequence,
      startEditing,
      stopEditing,
      onRowDelete,
      table,
    ]
  );

  // Handle cell save
  const handleCellSave = useCallback(
    (newValue: unknown) => {
      if (!editingCell || !onCellChange) return;

      const row = table
        .getRowModel()
        .rows.find((r) => r.id === editingCell.rowId);
      if (!row) return;

      const rowData = row.original as TableRowData;
      const rowId = rowData.__rowId ?? row.id;
      const oldValue = rowData[editingCell.columnId];

      if (newValue !== oldValue) {
        onCellChange(rowId, editingCell.columnId, newValue, oldValue);
      }

      stopEditing();
    },
    [editingCell, onCellChange, stopEditing, table]
  );

  // Validate cell value
  const validateValue = useCallback(
    (value: string, column: ColumnSchema): string | null => {
      // Check NOT NULL constraint
      if (!column.nullable) {
        if (value === '' || value.toLowerCase() === 'null') {
          return 'This field cannot be empty';
        }
      }

      // Type validation for numeric types
      const type = column.type.toLowerCase();
      if (type.includes('int')) {
        if (value !== '' && value.toLowerCase() !== 'null') {
          const parsed = Number.parseInt(value, 10);
          if (Number.isNaN(parsed)) {
            return 'Must be a valid integer';
          }
        }
      } else if (
        type.includes('real') ||
        type.includes('float') ||
        type.includes('double')
      ) {
        if (value !== '' && value.toLowerCase() !== 'null') {
          const parsed = Number.parseFloat(value);
          if (Number.isNaN(parsed)) {
            return 'Must be a valid number';
          }
        }
      }

      return null;
    },
    []
  );

  // Check if a cell is focused
  const isCellFocused = useCallback(
    (rowId: string, columnId: string): boolean => {
      return focusedCell?.rowId === rowId && focusedCell?.columnId === columnId;
    },
    [focusedCell]
  );

  // Check if a cell is being edited
  const isCellEditing = useCallback(
    (rowId: string, columnId: string): boolean => {
      return editingCell?.rowId === rowId && editingCell?.columnId === columnId;
    },
    [editingCell]
  );

  // Handle clipboard copy
  useEffect(() => {
    if (!containerRef.current) return;

    const handleCopy = async (_e: ClipboardEvent) => {
      if (!focusedCell || editingCell) return;

      const row = table
        .getRowModel()
        .rows.find((r) => r.id === focusedCell.rowId);
      if (!row) return;

      const value = row.original[focusedCell.columnId];
      const text = value === null ? '' : String(value);

      try {
        await navigator.clipboard.writeText(text);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    };

    const handlePaste = async (_e: ClipboardEvent) => {
      if (!focusedCell || !editable || editingCell) return;

      try {
        const text = await navigator.clipboard.readText();
        handleCellSave(text);
      } catch (err) {
        console.error('Failed to paste:', err);
      }
    };

    const container = containerRef.current;
    container.addEventListener('copy', handleCopy);
    container.addEventListener('paste', handlePaste);

    return () => {
      container.removeEventListener('copy', handleCopy);
      container.removeEventListener('paste', handlePaste);
    };
  }, [focusedCell, editingCell, editable, table, handleCellSave, containerRef]);

  return {
    focusedCell,
    editingCell,
    setFocusedCell,
    startEditing,
    stopEditing,
    handleCellClick,
    handleCellDoubleClick,
    handleKeyDown,
    handleCellSave,
    validateValue,
    isCellFocused,
    isCellEditing,
  };
}

import type { ColumnSchema } from '@/types/database';
import { Edit3, X } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface BulkEditField {
  column: string;
  value: unknown;
}

interface BulkEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: ColumnSchema[];
  selectedRowCount: number;
  onApply: (fields: BulkEditField[]) => void;
}

export function BulkEditDialog({
  open,
  onOpenChange,
  columns,
  selectedRowCount,
  onApply,
}: BulkEditDialogProps) {
  const [editFields, setEditFields] = useState<BulkEditField[]>([]);
  const [selectedColumn, setSelectedColumn] = useState<string>('');

  // Get columns that haven't been added yet
  const availableColumns = columns.filter(
    (col) => !col.isPrimaryKey && !editFields.some((f) => f.column === col.name)
  );

  const handleAddField = useCallback(() => {
    if (!selectedColumn) return;

    setEditFields((prev) => [...prev, { column: selectedColumn, value: '' }]);
    setSelectedColumn('');
  }, [selectedColumn]);

  const handleRemoveField = useCallback((column: string) => {
    setEditFields((prev) => prev.filter((f) => f.column !== column));
  }, []);

  const handleFieldValueChange = useCallback(
    (column: string, value: unknown) => {
      setEditFields((prev) =>
        prev.map((f) => (f.column === column ? { ...f, value } : f))
      );
    },
    []
  );

  const handleApply = useCallback(() => {
    if (editFields.length === 0) return;
    onApply(editFields);
    setEditFields([]);
    onOpenChange(false);
  }, [editFields, onApply, onOpenChange]);

  const handleClose = useCallback(() => {
    setEditFields([]);
    setSelectedColumn('');
    onOpenChange(false);
  }, [onOpenChange]);

  // Get column info for a field
  const getColumnInfo = (columnName: string) => {
    return columns.find((c) => c.name === columnName);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit3 className="h-5 w-5" />
            Bulk Edit
          </DialogTitle>
          <DialogDescription>
            Edit {selectedRowCount} selected row
            {selectedRowCount > 1 ? 's' : ''}. Changes will be added to pending
            changes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Add field selector */}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label htmlFor="column-select" className="text-xs">
                Add field to edit
              </Label>
              <Select
                value={selectedColumn}
                onValueChange={(value) => setSelectedColumn(value || '')}
                disabled={availableColumns.length === 0}
              >
                <SelectTrigger id="column-select">
                  <SelectValue placeholder="Select a column..." />
                </SelectTrigger>
                <SelectContent>
                  {availableColumns.map((col) => (
                    <SelectItem key={col.name} value={col.name}>
                      <div className="flex items-center gap-2">
                        <span>{col.name}</span>
                        <span className="text-muted-foreground text-xs">
                          ({col.type})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddField}
              disabled={!selectedColumn}
            >
              Add
            </Button>
          </div>

          {/* Edit fields list */}
          {editFields.length > 0 ? (
            <div className="space-y-3">
              {editFields.map((field) => {
                const colInfo = getColumnInfo(field.column);
                return (
                  <div
                    key={field.column}
                    className="bg-muted/30 flex items-start gap-3 rounded-lg border p-3"
                  >
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{field.column}</span>
                        {colInfo && (
                          <Badge variant="secondary" className="text-xs">
                            {colInfo.type}
                          </Badge>
                        )}
                        {colInfo?.nullable && (
                          <Badge variant="outline" className="text-xs">
                            nullable
                          </Badge>
                        )}
                      </div>
                      <Input
                        value={field.value === null ? '' : String(field.value)}
                        onChange={(e) =>
                          handleFieldValueChange(field.column, e.target.value)
                        }
                        placeholder={
                          colInfo?.nullable
                            ? 'Enter value or leave empty for NULL'
                            : 'Enter new value'
                        }
                        className="h-8"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => handleRemoveField(field.column)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-muted-foreground rounded-lg border border-dashed py-8 text-center text-sm">
              Select a column above to start editing
            </div>
          )}

          {/* Summary */}
          {editFields.length > 0 && (
            <div className="bg-primary/5 border-primary/20 rounded-lg border p-3 text-sm">
              <p>
                <span className="font-medium">{editFields.length}</span> field
                {editFields.length > 1 ? 's' : ''} will be updated on{' '}
                <span className="font-medium">{selectedRowCount}</span> row
                {selectedRowCount > 1 ? 's' : ''}.
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                This will create {selectedRowCount} pending update
                {selectedRowCount > 1 ? 's' : ''}.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button
            onClick={handleApply}
            disabled={editFields.length === 0}
            className={cn(
              editFields.length > 0 &&
                'bg-amber-600 hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-700'
            )}
          >
            <Edit3 className="mr-1.5 h-4 w-4" />
            Apply to {selectedRowCount} row{selectedRowCount > 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

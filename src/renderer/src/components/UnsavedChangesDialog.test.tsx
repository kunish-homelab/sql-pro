import type { PendingChange } from '@/types/database';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnsavedChangesDialog } from './UnsavedChangesDialog';

// Helper function to create mock PendingChange
function createMockChange(
  overrides: Partial<PendingChange> = {}
): PendingChange {
  return {
    id: `change-${Math.random()}`,
    connectionId: 'test-conn',
    table: 'users',
    rowId: 1,
    type: 'update',
    newValues: { name: 'New Value' },
    oldValues: { name: 'Old Value' },
    timestamp: new Date(),
    isValid: true,
    ...overrides,
  };
}

describe('unsavedChangesDialog', () => {
  const mockOnSave = vi.fn();
  const mockOnDiscard = vi.fn();
  const mockOnCancel = vi.fn();
  const mockOnOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render dialog with all three buttons', () => {
      const changes = [createMockChange()];

      render(
        <UnsavedChangesDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          changes={changes}
          connectionId="test-conn"
          onSave={mockOnSave}
          onDiscard={mockOnDiscard}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('Unsaved Changes')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('Discard Changes')).toBeInTheDocument();
      expect(screen.getByText('Save Changes')).toBeInTheDocument();
    });

    it('should display correct change count in description', () => {
      const changes = [
        createMockChange({ rowId: 1 }),
        createMockChange({ rowId: 2 }),
        createMockChange({ rowId: 3 }),
      ];

      render(
        <UnsavedChangesDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          changes={changes}
          connectionId="test-conn"
          onSave={mockOnSave}
          onDiscard={mockOnDiscard}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText(/3 unsaved changes/i)).toBeInTheDocument();
    });

    it('should use singular "change" when there is only one change', () => {
      const changes = [createMockChange()];

      render(
        <UnsavedChangesDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          changes={changes}
          connectionId="test-conn"
          onSave={mockOnSave}
          onDiscard={mockOnDiscard}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText(/1 unsaved change/i)).toBeInTheDocument();
    });
  });

  describe('change summary display', () => {
    it('should display inserts correctly', () => {
      const changes = [
        createMockChange({ rowId: 1, type: 'insert' }),
        createMockChange({ rowId: 2, type: 'insert' }),
      ];

      render(
        <UnsavedChangesDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          changes={changes}
          connectionId="test-conn"
          onSave={mockOnSave}
          onDiscard={mockOnDiscard}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText(/2 inserts/i)).toBeInTheDocument();
    });

    it('should display updates correctly', () => {
      const changes = [
        createMockChange({ rowId: 1, type: 'update' }),
        createMockChange({ rowId: 2, type: 'update' }),
        createMockChange({ rowId: 3, type: 'update' }),
      ];

      render(
        <UnsavedChangesDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          changes={changes}
          connectionId="test-conn"
          onSave={mockOnSave}
          onDiscard={mockOnDiscard}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText(/3 updates/i)).toBeInTheDocument();
    });

    it('should display deletes correctly', () => {
      const changes = [createMockChange({ rowId: 1, type: 'delete' })];

      render(
        <UnsavedChangesDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          changes={changes}
          connectionId="test-conn"
          onSave={mockOnSave}
          onDiscard={mockOnDiscard}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText(/1 delete$/i)).toBeInTheDocument();
    });

    it('should use singular forms for single changes', () => {
      const changes = [
        createMockChange({ rowId: 1, type: 'insert', table: 'users' }),
        createMockChange({ rowId: 2, type: 'update', table: 'users' }),
        createMockChange({ rowId: 3, type: 'delete', table: 'users' }),
      ];

      render(
        <UnsavedChangesDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          changes={changes}
          connectionId="test-conn"
          onSave={mockOnSave}
          onDiscard={mockOnDiscard}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText(/1 insert$/i)).toBeInTheDocument();
      expect(screen.getByText(/1 update$/i)).toBeInTheDocument();
      expect(screen.getByText(/1 delete$/i)).toBeInTheDocument();
    });

    it('should group changes by table', () => {
      const changes = [
        createMockChange({ rowId: 1, table: 'users', type: 'insert' }),
        createMockChange({ rowId: 2, table: 'users', type: 'update' }),
        createMockChange({ rowId: 3, table: 'orders', type: 'delete' }),
      ];

      render(
        <UnsavedChangesDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          changes={changes}
          connectionId="test-conn"
          onSave={mockOnSave}
          onDiscard={mockOnDiscard}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('users')).toBeInTheDocument();
      expect(screen.getByText('orders')).toBeInTheDocument();
    });

    it('should display mixed change types for same table', () => {
      const changes = [
        createMockChange({ rowId: 1, type: 'insert' }),
        createMockChange({ rowId: 2, type: 'update' }),
        createMockChange({ rowId: 3, type: 'update' }),
        createMockChange({ rowId: 4, type: 'delete' }),
      ];

      render(
        <UnsavedChangesDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          changes={changes}
          connectionId="test-conn"
          onSave={mockOnSave}
          onDiscard={mockOnDiscard}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText(/1 insert$/i)).toBeInTheDocument();
      expect(screen.getByText(/2 updates/i)).toBeInTheDocument();
      expect(screen.getByText(/1 delete$/i)).toBeInTheDocument();
    });

    it('should only show change types that exist', () => {
      const changes = [
        createMockChange({ rowId: 1, type: 'insert' }),
        createMockChange({ rowId: 2, type: 'insert' }),
      ];

      render(
        <UnsavedChangesDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          changes={changes}
          connectionId="test-conn"
          onSave={mockOnSave}
          onDiscard={mockOnDiscard}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText(/2 inserts/i)).toBeInTheDocument();
      expect(screen.queryByText(/update/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/delete/i)).not.toBeInTheDocument();
    });
  });

  describe('button interactions', () => {
    it('should call onSave and onOpenChange when Save Changes is clicked', async () => {
      const user = userEvent.setup();
      mockOnSave.mockResolvedValueOnce(undefined);

      const changes = [createMockChange()];

      render(
        <UnsavedChangesDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          changes={changes}
          connectionId="test-conn"
          onSave={mockOnSave}
          onDiscard={mockOnDiscard}
          onCancel={mockOnCancel}
        />
      );

      const saveButton = screen.getByText('Save Changes');
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledTimes(1);
        expect(mockOnOpenChange).toHaveBeenCalledWith(false);
      });
    });

    it('should call onDiscard and onOpenChange when Discard Changes is clicked', async () => {
      const user = userEvent.setup();
      const changes = [createMockChange()];

      render(
        <UnsavedChangesDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          changes={changes}
          connectionId="test-conn"
          onSave={mockOnSave}
          onDiscard={mockOnDiscard}
          onCancel={mockOnCancel}
        />
      );

      const discardButton = screen.getByText('Discard Changes');
      await user.click(discardButton);

      expect(mockOnDiscard).toHaveBeenCalledTimes(1);
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });

    it('should call onCancel and onOpenChange when Cancel is clicked', async () => {
      const user = userEvent.setup();
      const changes = [createMockChange()];

      render(
        <UnsavedChangesDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          changes={changes}
          connectionId="test-conn"
          onSave={mockOnSave}
          onDiscard={mockOnDiscard}
          onCancel={mockOnCancel}
        />
      );

      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });

    it('should not call other handlers when Save is clicked', async () => {
      const user = userEvent.setup();
      mockOnSave.mockResolvedValueOnce(undefined);

      const changes = [createMockChange()];

      render(
        <UnsavedChangesDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          changes={changes}
          connectionId="test-conn"
          onSave={mockOnSave}
          onDiscard={mockOnDiscard}
          onCancel={mockOnCancel}
        />
      );

      const saveButton = screen.getByText('Save Changes');
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledTimes(1);
      });

      expect(mockOnDiscard).not.toHaveBeenCalled();
      expect(mockOnCancel).not.toHaveBeenCalled();
    });
  });

  describe('loading state', () => {
    it('should show loading text when save is in progress', async () => {
      const user = userEvent.setup();
      let resolveSave: () => void;
      const savePromise = new Promise<void>((resolve) => {
        resolveSave = resolve;
      });
      mockOnSave.mockReturnValueOnce(savePromise);

      const changes = [createMockChange()];

      render(
        <UnsavedChangesDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          changes={changes}
          connectionId="test-conn"
          onSave={mockOnSave}
          onDiscard={mockOnDiscard}
          onCancel={mockOnCancel}
        />
      );

      const saveButton = screen.getByText('Save Changes');
      await user.click(saveButton);

      // Should show loading state
      expect(screen.getByText('Saving...')).toBeInTheDocument();

      // Resolve the save
      resolveSave!();
      await waitFor(() => {
        expect(screen.queryByText('Saving...')).not.toBeInTheDocument();
      });
    });

    it('should disable all buttons during save', async () => {
      const user = userEvent.setup();
      let resolveSave: () => void;
      const savePromise = new Promise<void>((resolve) => {
        resolveSave = resolve;
      });
      mockOnSave.mockReturnValueOnce(savePromise);

      const changes = [createMockChange()];

      render(
        <UnsavedChangesDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          changes={changes}
          connectionId="test-conn"
          onSave={mockOnSave}
          onDiscard={mockOnDiscard}
          onCancel={mockOnCancel}
        />
      );

      const saveButton = screen.getByText('Save Changes');
      await user.click(saveButton);

      // All buttons should be disabled
      expect(screen.getByText('Cancel')).toBeDisabled();
      expect(screen.getByText('Discard Changes')).toBeDisabled();
      expect(screen.getByText('Saving...')).toBeDisabled();

      // Resolve the save
      resolveSave!();
    });

    it('should re-enable buttons after save completes', async () => {
      const user = userEvent.setup();
      mockOnSave.mockResolvedValueOnce(undefined);

      const changes = [createMockChange()];

      const { rerender } = render(
        <UnsavedChangesDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          changes={changes}
          connectionId="test-conn"
          onSave={mockOnSave}
          onDiscard={mockOnDiscard}
          onCancel={mockOnCancel}
        />
      );

      const saveButton = screen.getByText('Save Changes');
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnOpenChange).toHaveBeenCalledWith(false);
      });

      // Reopen dialog to check buttons are re-enabled
      rerender(
        <UnsavedChangesDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          changes={changes}
          connectionId="test-conn"
          onSave={mockOnSave}
          onDiscard={mockOnDiscard}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('Cancel')).not.toBeDisabled();
      expect(screen.getByText('Discard Changes')).not.toBeDisabled();
      expect(screen.getByText('Save Changes')).not.toBeDisabled();
    });
  });

  describe('error handling', () => {
    it('should display error message when save fails', async () => {
      const user = userEvent.setup();
      const errorMessage = 'Failed to apply changes to database';
      mockOnSave.mockRejectedValueOnce(new Error(errorMessage));

      const changes = [createMockChange()];

      render(
        <UnsavedChangesDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          changes={changes}
          connectionId="test-conn"
          onSave={mockOnSave}
          onDiscard={mockOnDiscard}
          onCancel={mockOnCancel}
        />
      );

      const saveButton = screen.getByText('Save Changes');
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
    });

    it('should keep dialog open when save fails', async () => {
      const user = userEvent.setup();
      mockOnSave.mockRejectedValueOnce(new Error('Save failed'));

      const changes = [createMockChange()];

      render(
        <UnsavedChangesDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          changes={changes}
          connectionId="test-conn"
          onSave={mockOnSave}
          onDiscard={mockOnDiscard}
          onCancel={mockOnCancel}
        />
      );

      const saveButton = screen.getByText('Save Changes');
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Save failed')).toBeInTheDocument();
      });

      // Dialog should still be open (onOpenChange not called with false)
      expect(mockOnOpenChange).not.toHaveBeenCalledWith(false);
      expect(screen.getByText('Unsaved Changes')).toBeInTheDocument();
    });

    it('should allow retry after save fails', async () => {
      const user = userEvent.setup();
      mockOnSave
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValueOnce(undefined);

      const changes = [createMockChange()];

      render(
        <UnsavedChangesDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          changes={changes}
          connectionId="test-conn"
          onSave={mockOnSave}
          onDiscard={mockOnDiscard}
          onCancel={mockOnCancel}
        />
      );

      const saveButton = screen.getByText('Save Changes');

      // First attempt fails
      await user.click(saveButton);
      await waitFor(() => {
        expect(screen.getByText('First attempt failed')).toBeInTheDocument();
      });

      // Retry
      await user.click(screen.getByText('Save Changes'));
      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledTimes(2);
        expect(mockOnOpenChange).toHaveBeenCalledWith(false);
      });
    });

    it('should handle non-Error objects in catch block', async () => {
      const user = userEvent.setup();
      mockOnSave.mockRejectedValueOnce('string error');

      const changes = [createMockChange()];

      render(
        <UnsavedChangesDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          changes={changes}
          connectionId="test-conn"
          onSave={mockOnSave}
          onDiscard={mockOnDiscard}
          onCancel={mockOnCancel}
        />
      );

      const saveButton = screen.getByText('Save Changes');
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to save changes')).toBeInTheDocument();
      });
    });

    it('should clear error when discard is clicked', async () => {
      const user = userEvent.setup();
      mockOnSave.mockRejectedValueOnce(new Error('Save failed'));

      const changes = [createMockChange()];

      render(
        <UnsavedChangesDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          changes={changes}
          connectionId="test-conn"
          onSave={mockOnSave}
          onDiscard={mockOnDiscard}
          onCancel={mockOnCancel}
        />
      );

      // Trigger error
      const saveButton = screen.getByText('Save Changes');
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Save failed')).toBeInTheDocument();
      });

      // Click discard
      const discardButton = screen.getByText('Discard Changes');
      await user.click(discardButton);

      expect(mockOnDiscard).toHaveBeenCalled();
    });

    it('should clear error when cancel is clicked', async () => {
      const user = userEvent.setup();
      mockOnSave.mockRejectedValueOnce(new Error('Save failed'));

      const changes = [createMockChange()];

      render(
        <UnsavedChangesDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          changes={changes}
          connectionId="test-conn"
          onSave={mockOnSave}
          onDiscard={mockOnDiscard}
          onCancel={mockOnCancel}
        />
      );

      // Trigger error
      const saveButton = screen.getByText('Save Changes');
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Save failed')).toBeInTheDocument();
      });

      // Click cancel
      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should auto-close when changes become empty after opening', async () => {
      const changes = [createMockChange()];

      const { rerender } = render(
        <UnsavedChangesDialog
          open={false}
          onOpenChange={mockOnOpenChange}
          changes={changes}
          connectionId="test-conn"
          onSave={mockOnSave}
          onDiscard={mockOnDiscard}
          onCancel={mockOnCancel}
        />
      );

      // Open with empty changes
      rerender(
        <UnsavedChangesDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          changes={[]}
          connectionId="test-conn"
          onSave={mockOnSave}
          onDiscard={mockOnDiscard}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        expect(mockOnDiscard).toHaveBeenCalled();
        expect(mockOnOpenChange).toHaveBeenCalledWith(false);
      });
    });

    it('should handle multiple tables with different change types', () => {
      const changes = [
        createMockChange({ table: 'users', type: 'insert', rowId: 1 }),
        createMockChange({ table: 'users', type: 'update', rowId: 2 }),
        createMockChange({ table: 'orders', type: 'delete', rowId: 3 }),
        createMockChange({ table: 'orders', type: 'insert', rowId: 4 }),
        createMockChange({ table: 'products', type: 'update', rowId: 5 }),
      ];

      render(
        <UnsavedChangesDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          changes={changes}
          connectionId="test-conn"
          onSave={mockOnSave}
          onDiscard={mockOnDiscard}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('users')).toBeInTheDocument();
      expect(screen.getByText('orders')).toBeInTheDocument();
      expect(screen.getByText('products')).toBeInTheDocument();
    });

    it('should handle large number of changes', () => {
      const changes = Array.from({ length: 100 }, (_, i) =>
        createMockChange({ rowId: i })
      );

      render(
        <UnsavedChangesDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          changes={changes}
          connectionId="test-conn"
          onSave={mockOnSave}
          onDiscard={mockOnDiscard}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText(/100 unsaved changes/i)).toBeInTheDocument();
    });

    it('should not call handlers when dialog is closed', () => {
      const changes = [createMockChange()];

      render(
        <UnsavedChangesDialog
          open={false}
          onOpenChange={mockOnOpenChange}
          changes={changes}
          connectionId="test-conn"
          onSave={mockOnSave}
          onDiscard={mockOnDiscard}
          onCancel={mockOnCancel}
        />
      );

      // Handlers should not be called when dialog is not visible
      expect(mockOnSave).not.toHaveBeenCalled();
      expect(mockOnDiscard).not.toHaveBeenCalled();
      expect(mockOnCancel).not.toHaveBeenCalled();
    });
  });
});

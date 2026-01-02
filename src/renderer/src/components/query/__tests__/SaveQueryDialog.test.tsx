import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCollectionsStore } from '@/stores/collections-store';
import { useSavedQueriesStore } from '@/stores/saved-queries-store';
import { SaveQueryDialog } from '../SaveQueryDialog';

// Mock the stores
vi.mock('@/stores/collections-store');
vi.mock('@/stores/saved-queries-store');

describe('saveQueryDialog', () => {
  const mockOnOpenChange = vi.fn();
  const mockSaveSavedQuery = vi.fn();
  const mockSaveCollection = vi.fn();
  const mockLoadCollections = vi.fn();

  const mockCollections = [
    {
      id: 'col-1',
      name: 'Work Queries',
      description: 'Queries for work',
      color: '#3b82f6',
      icon: 'folder',
      queryIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'col-2',
      name: 'Personal',
      description: 'Personal queries',
      color: '#10b981',
      icon: 'folder',
      queryIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock collections store
    vi.mocked(useCollectionsStore).mockReturnValue({
      collections: mockCollections,
      isLoading: false,
      selectedCollectionId: null,
      loadCollections: mockLoadCollections,
      saveCollection: mockSaveCollection,
      updateCollection: vi.fn(),
      deleteCollection: vi.fn(),
      addQueryToCollection: vi.fn(),
      removeQueryFromCollection: vi.fn(),
      setSelectedCollection: vi.fn(),
    });

    // Mock saved queries store
    vi.mocked(useSavedQueriesStore).mockReturnValue({
      savedQueries: [],
      isLoading: false,
      favoritesOnly: false,
      selectedCollectionId: null,
      loadSavedQueries: vi.fn(),
      saveSavedQuery: mockSaveSavedQuery,
      updateSavedQuery: vi.fn(),
      deleteSavedQuery: vi.fn(),
      toggleFavorite: vi.fn(),
      setFavoritesOnly: vi.fn(),
    });
  });

  describe('rendering', () => {
    it('should render dialog when open', () => {
      render(
        <SaveQueryDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          queryText="SELECT * FROM users"
        />
      );

      expect(screen.getByText('Save Query')).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText('e.g., User Statistics Query')
      ).toBeInTheDocument();
    });

    it('should not render dialog when closed', () => {
      render(
        <SaveQueryDialog
          open={false}
          onOpenChange={mockOnOpenChange}
          queryText="SELECT * FROM users"
        />
      );

      expect(screen.queryByText('Save Query')).not.toBeInTheDocument();
    });

    it('should display database path when provided', () => {
      render(
        <SaveQueryDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          queryText="SELECT * FROM users"
          dbPath="/path/to/database.db"
        />
      );

      expect(screen.getByText(/database.db/)).toBeInTheDocument();
    });

    it('should load collections on open', () => {
      render(
        <SaveQueryDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          queryText="SELECT * FROM users"
        />
      );

      expect(mockLoadCollections).toHaveBeenCalled();
    });
  });

  describe('form fields', () => {
    it('should populate name from initialData', () => {
      render(
        <SaveQueryDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          queryText="SELECT * FROM users"
          initialData={{ name: 'Test Query' }}
        />
      );

      const nameInput = screen.getByPlaceholderText(
        'e.g., User Statistics Query'
      );
      expect(nameInput).toHaveValue('Test Query');
    });

    it('should populate description from initialData', () => {
      render(
        <SaveQueryDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          queryText="SELECT * FROM users"
          initialData={{ description: 'Test description' }}
        />
      );

      const descriptionInput = screen.getByPlaceholderText(
        'What does this query do?'
      );
      expect(descriptionInput).toHaveValue('Test description');
    });

    it('should set favorite from initialData', () => {
      render(
        <SaveQueryDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          queryText="SELECT * FROM users"
          initialData={{ isFavorite: true }}
        />
      );

      const favoriteCheckbox = screen.getByRole('checkbox');
      expect(favoriteCheckbox).toBeChecked();
    });

    it('should allow typing in name field', async () => {
      const user = userEvent.setup();
      render(
        <SaveQueryDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          queryText="SELECT * FROM users"
        />
      );

      const nameInput = screen.getByPlaceholderText(
        'e.g., User Statistics Query'
      );
      await user.type(nameInput, 'My Query');

      expect(nameInput).toHaveValue('My Query');
    });

    it('should allow typing in description field', async () => {
      const user = userEvent.setup();
      render(
        <SaveQueryDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          queryText="SELECT * FROM users"
        />
      );

      const descriptionInput = screen.getByPlaceholderText(
        'What does this query do?'
      );
      await user.type(descriptionInput, 'Test description');

      expect(descriptionInput).toHaveValue('Test description');
    });

    it('should toggle favorite checkbox', async () => {
      const user = userEvent.setup();
      render(
        <SaveQueryDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          queryText="SELECT * FROM users"
        />
      );

      const favoriteCheckbox = screen.getByRole('checkbox');
      expect(favoriteCheckbox).not.toBeChecked();

      await user.click(favoriteCheckbox);
      expect(favoriteCheckbox).toBeChecked();
    });
  });

  describe('validation', () => {
    it('should disable save button when name is empty', () => {
      render(
        <SaveQueryDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          queryText="SELECT * FROM users"
        />
      );

      const saveButton = screen.getByRole('button', { name: /Save Query/i });
      expect(saveButton).toBeDisabled();
    });

    it('should enable save button when name is provided', async () => {
      const user = userEvent.setup();
      render(
        <SaveQueryDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          queryText="SELECT * FROM users"
        />
      );

      const nameInput = screen.getByPlaceholderText(
        'e.g., User Statistics Query'
      );
      await user.type(nameInput, 'My Query');

      const saveButton = screen.getByRole('button', { name: /Save Query/i });
      expect(saveButton).toBeEnabled();
    });

    it('should show validation error when submitting with empty name', async () => {
      const user = userEvent.setup();
      render(
        <SaveQueryDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          queryText="SELECT * FROM users"
          initialData={{ name: 'Test' }}
        />
      );

      // Clear the name field
      const nameInput = screen.getByPlaceholderText(
        'e.g., User Statistics Query'
      );
      await user.clear(nameInput);

      const saveButton = screen.getByRole('button', { name: /Save Query/i });
      expect(saveButton).toBeDisabled();
    });
  });

  describe('save functionality', () => {
    it('should save query with basic information', async () => {
      const user = userEvent.setup();
      mockSaveSavedQuery.mockResolvedValue(undefined);

      render(
        <SaveQueryDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          queryText="SELECT * FROM users"
          dbPath="/path/to/db.db"
        />
      );

      const nameInput = screen.getByPlaceholderText(
        'e.g., User Statistics Query'
      );
      await user.type(nameInput, 'My Query');

      const saveButton = screen.getByRole('button', { name: /Save Query/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockSaveSavedQuery).toHaveBeenCalledWith({
          name: 'My Query',
          queryText: 'SELECT * FROM users',
          description: undefined,
          dbPath: '/path/to/db.db',
          isFavorite: false,
          collectionIds: [],
        });
      });
    });

    it('should save query with description', async () => {
      const user = userEvent.setup();
      mockSaveSavedQuery.mockResolvedValue(undefined);

      render(
        <SaveQueryDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          queryText="SELECT * FROM users"
        />
      );

      const nameInput = screen.getByPlaceholderText(
        'e.g., User Statistics Query'
      );
      await user.type(nameInput, 'My Query');

      const descriptionInput = screen.getByPlaceholderText(
        'What does this query do?'
      );
      await user.type(descriptionInput, 'Test description');

      const saveButton = screen.getByRole('button', { name: /Save Query/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockSaveSavedQuery).toHaveBeenCalledWith(
          expect.objectContaining({
            description: 'Test description',
          })
        );
      });
    });

    it('should save query as favorite when checkbox is checked', async () => {
      const user = userEvent.setup();
      mockSaveSavedQuery.mockResolvedValue(undefined);

      render(
        <SaveQueryDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          queryText="SELECT * FROM users"
        />
      );

      const nameInput = screen.getByPlaceholderText(
        'e.g., User Statistics Query'
      );
      await user.type(nameInput, 'My Query');

      const favoriteCheckbox = screen.getByRole('checkbox');
      await user.click(favoriteCheckbox);

      const saveButton = screen.getByRole('button', { name: /Save Query/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockSaveSavedQuery).toHaveBeenCalledWith(
          expect.objectContaining({
            isFavorite: true,
          })
        );
      });
    });

    it('should close dialog after successful save', async () => {
      const user = userEvent.setup();
      mockSaveSavedQuery.mockResolvedValue(undefined);

      render(
        <SaveQueryDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          queryText="SELECT * FROM users"
        />
      );

      const nameInput = screen.getByPlaceholderText(
        'e.g., User Statistics Query'
      );
      await user.type(nameInput, 'My Query');

      const saveButton = screen.getByRole('button', { name: /Save Query/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnOpenChange).toHaveBeenCalledWith(false);
      });
    });

    it('should show loading state while saving', async () => {
      const user = userEvent.setup();
      // Delay the resolution to capture loading state
      mockSaveSavedQuery.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(
        <SaveQueryDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          queryText="SELECT * FROM users"
        />
      );

      const nameInput = screen.getByPlaceholderText(
        'e.g., User Statistics Query'
      );
      await user.type(nameInput, 'My Query');

      const saveButton = screen.getByRole('button', { name: /Save Query/i });
      await user.click(saveButton);

      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });
  });

  describe('new collection creation', () => {
    it('should show new collection form when button clicked', async () => {
      const user = userEvent.setup();
      render(
        <SaveQueryDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          queryText="SELECT * FROM users"
        />
      );

      const newCollectionButton = screen.getByRole('button', {
        name: /New Collection/i,
      });
      await user.click(newCollectionButton);

      expect(screen.getByPlaceholderText('e.g., Reports')).toBeInTheDocument();
    });

    it('should create new collection and reload collections', async () => {
      const user = userEvent.setup();
      mockSaveCollection.mockResolvedValue(undefined);
      mockLoadCollections.mockResolvedValue(undefined);

      render(
        <SaveQueryDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          queryText="SELECT * FROM users"
        />
      );

      const newCollectionButton = screen.getByRole('button', {
        name: /New Collection/i,
      });
      await user.click(newCollectionButton);

      const collectionNameInput = screen.getByPlaceholderText('e.g., Reports');
      await user.type(collectionNameInput, 'New Collection');

      const createButton = screen.getByRole('button', { name: /^Create$/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(mockSaveCollection).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'New Collection',
          })
        );
      });
    });

    it('should hide new collection form when cancelled', async () => {
      const user = userEvent.setup();
      render(
        <SaveQueryDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          queryText="SELECT * FROM users"
        />
      );

      const newCollectionButton = screen.getByRole('button', {
        name: /New Collection/i,
      });
      await user.click(newCollectionButton);

      // Use getAllByRole and select the first Cancel button (for the new collection form)
      const cancelButtons = screen.getAllByRole('button', { name: /Cancel/i });
      await user.click(cancelButtons[0]);

      expect(
        screen.queryByPlaceholderText('e.g., Reports')
      ).not.toBeInTheDocument();
    });
  });

  describe('cancel functionality', () => {
    it('should close dialog when cancel button clicked', async () => {
      const user = userEvent.setup();
      render(
        <SaveQueryDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          queryText="SELECT * FROM users"
        />
      );

      // Get the main dialog's Cancel button (not in the new collection form)
      const cancelButtons = screen.getAllByRole('button', { name: /Cancel/i });
      // When new collection form is NOT shown, there's only one Cancel button
      await user.click(cancelButtons[cancelButtons.length - 1]);

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });
});

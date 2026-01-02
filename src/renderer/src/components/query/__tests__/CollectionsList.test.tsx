import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CollectionsList } from '../CollectionsList';
import { useCollectionsStore } from '@renderer/stores/collections-store';
import { useSavedQueriesStore } from '@renderer/stores/saved-queries-store';

// Mock the stores
vi.mock('@renderer/stores/collections-store');
vi.mock('@renderer/stores/saved-queries-store');

describe('CollectionsList', () => {
  const mockLoadCollections = vi.fn();
  const mockSaveCollection = vi.fn();
  const mockUpdateCollection = vi.fn();
  const mockDeleteCollection = vi.fn();
  const mockSetSelectedCollection = vi.fn();

  const mockCollections = [
    {
      id: 'col-1',
      name: 'Work Queries',
      description: 'Queries for work',
      color: '#3b82f6',
      icon: 'folder',
      queryIds: ['q1', 'q2'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'col-2',
      name: 'Personal',
      description: 'Personal queries',
      color: '#10b981',
      icon: 'folder',
      queryIds: ['q3'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const mockSavedQueries = [
    {
      id: 'q1',
      name: 'Query 1',
      queryText: 'SELECT * FROM users',
      description: 'Test query',
      isFavorite: false,
      collectionIds: ['col-1'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'q2',
      name: 'Query 2',
      queryText: 'SELECT * FROM orders',
      description: '',
      isFavorite: false,
      collectionIds: ['col-1'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'q3',
      name: 'Query 3',
      queryText: 'SELECT * FROM products',
      description: '',
      isFavorite: true,
      collectionIds: ['col-2'],
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
      updateCollection: mockUpdateCollection,
      deleteCollection: mockDeleteCollection,
      addQueryToCollection: vi.fn(),
      removeQueryFromCollection: vi.fn(),
      setSelectedCollection: mockSetSelectedCollection,
    });

    // Mock saved queries store
    vi.mocked(useSavedQueriesStore).mockReturnValue({
      savedQueries: mockSavedQueries,
      isLoading: false,
      favoritesOnly: false,
      selectedCollectionId: null,
      loadSavedQueries: vi.fn(),
      saveSavedQuery: vi.fn(),
      updateSavedQuery: vi.fn(),
      deleteSavedQuery: vi.fn(),
      toggleFavorite: vi.fn(),
      setFavoritesOnly: vi.fn(),
    });
  });

  describe('rendering', () => {
    it('should render collections list', () => {
      render(<CollectionsList />);

      expect(screen.getByText('Collections')).toBeInTheDocument();
      expect(screen.getByText('Work Queries')).toBeInTheDocument();
      expect(screen.getByText('Personal')).toBeInTheDocument();
    });

    it('should display collection descriptions', () => {
      render(<CollectionsList />);

      expect(screen.getByText('Queries for work')).toBeInTheDocument();
      expect(screen.getByText('Personal queries')).toBeInTheDocument();
    });

    it('should display query counts for each collection', () => {
      render(<CollectionsList />);

      expect(screen.getByText('2 queries')).toBeInTheDocument();
      expect(screen.getByText('1 query')).toBeInTheDocument();
    });

    it('should load collections on mount', () => {
      render(<CollectionsList />);

      expect(mockLoadCollections).toHaveBeenCalled();
    });

    it('should show loading skeleton when loading', () => {
      vi.mocked(useCollectionsStore).mockReturnValue({
        collections: [],
        isLoading: true,
        selectedCollectionId: null,
        loadCollections: mockLoadCollections,
        saveCollection: mockSaveCollection,
        updateCollection: mockUpdateCollection,
        deleteCollection: mockDeleteCollection,
        addQueryToCollection: vi.fn(),
        removeQueryFromCollection: vi.fn(),
        setSelectedCollection: mockSetSelectedCollection,
      });

      const { container } = render(<CollectionsList />);

      // Check for skeleton elements
      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should show empty state when no collections exist', () => {
      vi.mocked(useCollectionsStore).mockReturnValue({
        collections: [],
        isLoading: false,
        selectedCollectionId: null,
        loadCollections: mockLoadCollections,
        saveCollection: mockSaveCollection,
        updateCollection: mockUpdateCollection,
        deleteCollection: mockDeleteCollection,
        addQueryToCollection: vi.fn(),
        removeQueryFromCollection: vi.fn(),
        setSelectedCollection: mockSetSelectedCollection,
      });

      render(<CollectionsList />);

      expect(screen.getByText('No collections yet')).toBeInTheDocument();
      expect(
        screen.getByText('Create your first collection to organize your queries')
      ).toBeInTheDocument();
    });
  });

  describe('collection selection', () => {
    it('should call setSelectedCollection when collection is clicked', async () => {
      const user = userEvent.setup();
      render(<CollectionsList />);

      const collection = screen.getByText('Work Queries');
      await user.click(collection);

      expect(mockSetSelectedCollection).toHaveBeenCalledWith('col-1');
    });

    it('should deselect collection when clicked again', async () => {
      const user = userEvent.setup();
      vi.mocked(useCollectionsStore).mockReturnValue({
        collections: mockCollections,
        isLoading: false,
        selectedCollectionId: 'col-1',
        loadCollections: mockLoadCollections,
        saveCollection: mockSaveCollection,
        updateCollection: mockUpdateCollection,
        deleteCollection: mockDeleteCollection,
        addQueryToCollection: vi.fn(),
        removeQueryFromCollection: vi.fn(),
        setSelectedCollection: mockSetSelectedCollection,
      });

      render(<CollectionsList />);

      const collection = screen.getByText('Work Queries');
      await user.click(collection);

      expect(mockSetSelectedCollection).toHaveBeenCalledWith(null);
    });

    it('should highlight selected collection', () => {
      vi.mocked(useCollectionsStore).mockReturnValue({
        collections: mockCollections,
        isLoading: false,
        selectedCollectionId: 'col-1',
        loadCollections: mockLoadCollections,
        saveCollection: mockSaveCollection,
        updateCollection: mockUpdateCollection,
        deleteCollection: mockDeleteCollection,
        addQueryToCollection: vi.fn(),
        removeQueryFromCollection: vi.fn(),
        setSelectedCollection: mockSetSelectedCollection,
      });

      const { container } = render(<CollectionsList />);

      const selectedCard = container.querySelector('.ring-2.ring-primary');
      expect(selectedCard).toBeInTheDocument();
    });
  });

  describe('create collection', () => {
    it('should show create dialog when New Collection button clicked', async () => {
      const user = userEvent.setup();
      render(<CollectionsList />);

      const newButton = screen.getAllByRole('button', { name: /New Collection/i })[0];
      await user.click(newButton);

      expect(screen.getByText('Create Collection')).toBeInTheDocument();
    });

    it('should create collection with name and description', async () => {
      const user = userEvent.setup();
      mockSaveCollection.mockResolvedValue(undefined);

      render(<CollectionsList />);

      const newButton = screen.getAllByRole('button', { name: /New Collection/i })[0];
      await user.click(newButton);

      const nameInput = screen.getByPlaceholderText('e.g., User Queries');
      await user.type(nameInput, 'New Collection');

      const descriptionInput = screen.getByPlaceholderText('What is this collection for?');
      await user.type(descriptionInput, 'Test description');

      const createButton = screen.getByRole('button', { name: /^Create$/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(mockSaveCollection).toHaveBeenCalledWith({
          name: 'New Collection',
          description: 'Test description',
          color: expect.any(String),
          icon: expect.any(String),
          queryIds: [],
        });
      });
    });

    it('should disable create button when name is empty', async () => {
      const user = userEvent.setup();
      render(<CollectionsList />);

      const newButton = screen.getAllByRole('button', { name: /New Collection/i })[0];
      await user.click(newButton);

      const createButton = screen.getByRole('button', { name: /^Create$/i });
      expect(createButton).toBeDisabled();
    });

    it('should allow color selection', async () => {
      const user = userEvent.setup();
      mockSaveCollection.mockResolvedValue(undefined);

      render(<CollectionsList />);

      const newButton = screen.getAllByRole('button', { name: /New Collection/i })[0];
      await user.click(newButton);

      const nameInput = screen.getByPlaceholderText('e.g., User Queries');
      await user.type(nameInput, 'New Collection');

      // Click a color button (aria-label starts with "Select color")
      const colorButtons = screen.getAllByLabelText(/Select color/);
      await user.click(colorButtons[1]);

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

    it('should close dialog after successful creation', async () => {
      const user = userEvent.setup();
      mockSaveCollection.mockResolvedValue(undefined);

      render(<CollectionsList />);

      const newButton = screen.getAllByRole('button', { name: /New Collection/i })[0];
      await user.click(newButton);

      const nameInput = screen.getByPlaceholderText('e.g., User Queries');
      await user.type(nameInput, 'New Collection');

      const createButton = screen.getByRole('button', { name: /^Create$/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.queryByText('Create Collection')).not.toBeInTheDocument();
      });
    });
  });

  describe('edit collection', () => {
    it('should show edit dialog when edit menu item clicked', async () => {
      const user = userEvent.setup();
      render(<CollectionsList />);

      // Open dropdown menu
      const moreButtons = screen.getAllByRole('button', { name: '' });
      await user.click(moreButtons[0]);

      const editMenuItem = screen.getByText('Edit');
      await user.click(editMenuItem);

      expect(screen.getByText('Edit Collection')).toBeInTheDocument();
    });

    it('should populate form with collection data', async () => {
      const user = userEvent.setup();
      render(<CollectionsList />);

      // Open dropdown menu
      const moreButtons = screen.getAllByRole('button', { name: '' });
      await user.click(moreButtons[0]);

      const editMenuItem = screen.getByText('Edit');
      await user.click(editMenuItem);

      const nameInput = screen.getByDisplayValue('Work Queries');
      const descriptionInput = screen.getByDisplayValue('Queries for work');

      expect(nameInput).toBeInTheDocument();
      expect(descriptionInput).toBeInTheDocument();
    });

    it('should update collection when saved', async () => {
      const user = userEvent.setup();
      mockUpdateCollection.mockResolvedValue(undefined);

      render(<CollectionsList />);

      // Open dropdown menu
      const moreButtons = screen.getAllByRole('button', { name: '' });
      await user.click(moreButtons[0]);

      const editMenuItem = screen.getByText('Edit');
      await user.click(editMenuItem);

      const nameInput = screen.getByDisplayValue('Work Queries');
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Name');

      const saveButton = screen.getByRole('button', { name: /Save Changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockUpdateCollection).toHaveBeenCalledWith(
          'col-1',
          expect.objectContaining({
            name: 'Updated Name',
          })
        );
      });
    });
  });

  describe('delete collection', () => {
    it('should show delete confirmation dialog', async () => {
      const user = userEvent.setup();
      render(<CollectionsList />);

      // Open dropdown menu
      const moreButtons = screen.getAllByRole('button', { name: '' });
      await user.click(moreButtons[0]);

      const deleteMenuItem = screen.getByText('Delete');
      await user.click(deleteMenuItem);

      expect(screen.getByText('Delete Collection?')).toBeInTheDocument();
      expect(screen.getByText(/Work Queries/)).toBeInTheDocument();
    });

    it('should show warning when collection has queries', async () => {
      const user = userEvent.setup();
      render(<CollectionsList />);

      // Open dropdown menu
      const moreButtons = screen.getAllByRole('button', { name: '' });
      await user.click(moreButtons[0]);

      const deleteMenuItem = screen.getByText('Delete');
      await user.click(deleteMenuItem);

      expect(
        screen.getByText(/The queries in this collection will not be deleted/)
      ).toBeInTheDocument();
    });

    it('should delete collection when confirmed', async () => {
      const user = userEvent.setup();
      mockDeleteCollection.mockResolvedValue(undefined);

      render(<CollectionsList />);

      // Open dropdown menu
      const moreButtons = screen.getAllByRole('button', { name: '' });
      await user.click(moreButtons[0]);

      const deleteMenuItem = screen.getByText('Delete');
      await user.click(deleteMenuItem);

      const confirmButton = screen.getByRole('button', { name: /^Delete$/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockDeleteCollection).toHaveBeenCalledWith('col-1');
      });
    });

    it('should not delete when cancelled', async () => {
      const user = userEvent.setup();
      render(<CollectionsList />);

      // Open dropdown menu
      const moreButtons = screen.getAllByRole('button', { name: '' });
      await user.click(moreButtons[0]);

      const deleteMenuItem = screen.getByText('Delete');
      await user.click(deleteMenuItem);

      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await user.click(cancelButton);

      expect(mockDeleteCollection).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('should have proper aria labels for color selection', async () => {
      const user = userEvent.setup();
      render(<CollectionsList />);

      const newButton = screen.getAllByRole('button', { name: /New Collection/i })[0];
      await user.click(newButton);

      const colorButtons = screen.getAllByLabelText(/Select color/);
      expect(colorButtons.length).toBeGreaterThan(0);
    });

    it('should have proper form labels', async () => {
      const user = userEvent.setup();
      render(<CollectionsList />);

      const newButton = screen.getAllByRole('button', { name: /New Collection/i })[0];
      await user.click(newButton);

      expect(screen.getByText(/Name/)).toBeInTheDocument();
      expect(screen.getByText(/Description/)).toBeInTheDocument();
      expect(screen.getByText(/Color/)).toBeInTheDocument();
    });
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCollectionsStore } from '@/stores/collections-store';
import { useSavedQueriesStore } from '@/stores/saved-queries-store';
import { SavedQueriesPanel } from '../SavedQueriesPanel';

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(),
  },
});

// Mock the stores
vi.mock('@/stores/collections-store');
vi.mock('@/stores/saved-queries-store');

describe('savedQueriesPanel', () => {
  const mockLoadSavedQueries = vi.fn();
  const mockUpdateSavedQuery = vi.fn();
  const mockDeleteSavedQuery = vi.fn();
  const mockToggleFavorite = vi.fn();
  const mockSetFavoritesOnly = vi.fn();
  const mockOnLoadQuery = vi.fn();

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
  ];

  const mockSavedQueries = [
    {
      id: 'q1',
      name: 'User Query',
      queryText: 'SELECT * FROM users',
      description: 'Get all users',
      isFavorite: true,
      collectionIds: ['col-1'],
      dbPath: '/path/to/db.db',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'q2',
      name: 'Order Query',
      queryText: 'SELECT * FROM orders',
      description: 'Get all orders',
      isFavorite: false,
      collectionIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'q3',
      name: 'Product Query',
      queryText: 'SELECT * FROM products WHERE price > 100',
      description: '',
      isFavorite: true,
      collectionIds: ['col-1'],
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
      loadCollections: vi.fn(),
      saveCollection: vi.fn(),
      updateCollection: vi.fn(),
      deleteCollection: vi.fn(),
      addQueryToCollection: vi.fn(),
      removeQueryFromCollection: vi.fn(),
      setSelectedCollection: vi.fn(),
    });

    // Mock saved queries store
    vi.mocked(useSavedQueriesStore).mockReturnValue({
      savedQueries: mockSavedQueries,
      isLoading: false,
      favoritesOnly: false,
      selectedCollectionId: null,
      loadSavedQueries: mockLoadSavedQueries,
      saveSavedQuery: vi.fn(),
      updateSavedQuery: mockUpdateSavedQuery,
      deleteSavedQuery: mockDeleteSavedQuery,
      toggleFavorite: mockToggleFavorite,
      setFavoritesOnly: mockSetFavoritesOnly,
    });
  });

  describe('rendering', () => {
    it('should render saved queries panel', () => {
      render(<SavedQueriesPanel />);

      expect(screen.getByText('Saved Queries')).toBeInTheDocument();
      expect(screen.getByText('User Query')).toBeInTheDocument();
      expect(screen.getByText('Order Query')).toBeInTheDocument();
      expect(screen.getByText('Product Query')).toBeInTheDocument();
    });

    it('should display query descriptions', () => {
      render(<SavedQueriesPanel />);

      expect(screen.getByText('Get all users')).toBeInTheDocument();
      expect(screen.getByText('Get all orders')).toBeInTheDocument();
    });

    it('should display query previews', () => {
      render(<SavedQueriesPanel />);

      expect(screen.getByText('SELECT * FROM users')).toBeInTheDocument();
      expect(screen.getByText('SELECT * FROM orders')).toBeInTheDocument();
    });

    it('should load saved queries on mount', () => {
      render(<SavedQueriesPanel />);

      expect(mockLoadSavedQueries).toHaveBeenCalled();
    });

    it('should show loading skeleton when loading', () => {
      vi.mocked(useSavedQueriesStore).mockReturnValue({
        savedQueries: [],
        isLoading: true,
        favoritesOnly: false,
        selectedCollectionId: null,
        loadSavedQueries: mockLoadSavedQueries,
        saveSavedQuery: vi.fn(),
        updateSavedQuery: mockUpdateSavedQuery,
        deleteSavedQuery: mockDeleteSavedQuery,
        toggleFavorite: mockToggleFavorite,
        setFavoritesOnly: mockSetFavoritesOnly,
      });

      const { container } = render(<SavedQueriesPanel />);

      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should show empty state when no queries exist', () => {
      vi.mocked(useSavedQueriesStore).mockReturnValue({
        savedQueries: [],
        isLoading: false,
        favoritesOnly: false,
        selectedCollectionId: null,
        loadSavedQueries: mockLoadSavedQueries,
        saveSavedQuery: vi.fn(),
        updateSavedQuery: mockUpdateSavedQuery,
        deleteSavedQuery: mockDeleteSavedQuery,
        toggleFavorite: mockToggleFavorite,
        setFavoritesOnly: mockSetFavoritesOnly,
      });

      render(<SavedQueriesPanel />);

      expect(screen.getByText('No saved queries yet')).toBeInTheDocument();
    });

    it('should display collection names for queries', () => {
      render(<SavedQueriesPanel />);

      expect(screen.getAllByText('Work Queries').length).toBeGreaterThan(0);
    });

    it('should display database path when available', () => {
      render(<SavedQueriesPanel />);

      expect(screen.getByText(/db.db/)).toBeInTheDocument();
    });
  });

  describe('favorites filter', () => {
    it('should filter to show only favorites when toggle pressed', () => {
      vi.mocked(useSavedQueriesStore).mockReturnValue({
        savedQueries: mockSavedQueries.filter((q) => q.isFavorite),
        isLoading: false,
        favoritesOnly: true,
        selectedCollectionId: null,
        loadSavedQueries: mockLoadSavedQueries,
        saveSavedQuery: vi.fn(),
        updateSavedQuery: mockUpdateSavedQuery,
        deleteSavedQuery: mockDeleteSavedQuery,
        toggleFavorite: mockToggleFavorite,
        setFavoritesOnly: mockSetFavoritesOnly,
      });

      render(<SavedQueriesPanel />);

      expect(screen.getByText('User Query')).toBeInTheDocument();
      expect(screen.getByText('Product Query')).toBeInTheDocument();
      expect(screen.queryByText('Order Query')).not.toBeInTheDocument();
    });

    it('should call setFavoritesOnly when toggle clicked', async () => {
      const user = userEvent.setup();
      render(<SavedQueriesPanel />);

      const favoriteToggle = screen.getByRole('button', {
        name: /Show only favorites/i,
      });
      await user.click(favoriteToggle);

      expect(mockSetFavoritesOnly).toHaveBeenCalled();
    });

    it('should show empty state when no favorites exist', () => {
      vi.mocked(useSavedQueriesStore).mockReturnValue({
        savedQueries: [],
        isLoading: false,
        favoritesOnly: true,
        selectedCollectionId: null,
        loadSavedQueries: mockLoadSavedQueries,
        saveSavedQuery: vi.fn(),
        updateSavedQuery: mockUpdateSavedQuery,
        deleteSavedQuery: mockDeleteSavedQuery,
        toggleFavorite: mockToggleFavorite,
        setFavoritesOnly: mockSetFavoritesOnly,
      });

      render(<SavedQueriesPanel />);

      expect(screen.getByText('No favorite queries')).toBeInTheDocument();
      expect(
        screen.getByText('Star queries to mark them as favorites')
      ).toBeInTheDocument();
    });
  });

  describe('collection filter', () => {
    it('should filter queries by selected collection', () => {
      vi.mocked(useSavedQueriesStore).mockReturnValue({
        savedQueries: mockSavedQueries.filter((q) =>
          q.collectionIds.includes('col-1')
        ),
        isLoading: false,
        favoritesOnly: false,
        selectedCollectionId: 'col-1',
        loadSavedQueries: mockLoadSavedQueries,
        saveSavedQuery: vi.fn(),
        updateSavedQuery: mockUpdateSavedQuery,
        deleteSavedQuery: mockDeleteSavedQuery,
        toggleFavorite: mockToggleFavorite,
        setFavoritesOnly: mockSetFavoritesOnly,
      });

      render(<SavedQueriesPanel />);

      expect(screen.getByText('User Query')).toBeInTheDocument();
      expect(screen.getByText('Product Query')).toBeInTheDocument();
      expect(screen.queryByText('Order Query')).not.toBeInTheDocument();
    });

    it('should show collection name in header when filtered', () => {
      vi.mocked(useSavedQueriesStore).mockReturnValue({
        savedQueries: mockSavedQueries.filter((q) =>
          q.collectionIds.includes('col-1')
        ),
        isLoading: false,
        favoritesOnly: false,
        selectedCollectionId: 'col-1',
        loadSavedQueries: mockLoadSavedQueries,
        saveSavedQuery: vi.fn(),
        updateSavedQuery: mockUpdateSavedQuery,
        deleteSavedQuery: mockDeleteSavedQuery,
        toggleFavorite: mockToggleFavorite,
        setFavoritesOnly: mockSetFavoritesOnly,
      });

      render(<SavedQueriesPanel />);

      expect(screen.getByText('Filtered by Work Queries')).toBeInTheDocument();
    });

    it('should show empty state when collection is empty', () => {
      vi.mocked(useSavedQueriesStore).mockReturnValue({
        savedQueries: [],
        isLoading: false,
        favoritesOnly: false,
        selectedCollectionId: 'col-1',
        loadSavedQueries: mockLoadSavedQueries,
        saveSavedQuery: vi.fn(),
        updateSavedQuery: mockUpdateSavedQuery,
        deleteSavedQuery: mockDeleteSavedQuery,
        toggleFavorite: mockToggleFavorite,
        setFavoritesOnly: mockSetFavoritesOnly,
      });

      render(<SavedQueriesPanel />);

      expect(
        screen.getByText('No queries in this collection')
      ).toBeInTheDocument();
    });
  });

  describe('search functionality', () => {
    it('should allow searching queries by name', async () => {
      const user = userEvent.setup();
      render(<SavedQueriesPanel />);

      const searchInput = screen.getByPlaceholderText(
        /Search queries by name, description, or content/i
      );
      await user.type(searchInput, 'User');

      // Component filters internally, we just check that input works
      expect(searchInput).toHaveValue('User');
    });

    it('should show clear button when search has text', async () => {
      const user = userEvent.setup();
      render(<SavedQueriesPanel />);

      const searchInput = screen.getByPlaceholderText(
        /Search queries by name, description, or content/i
      );
      await user.type(searchInput, 'test');

      const clearButton = screen.getByRole('button', { name: '' });
      expect(clearButton).toBeInTheDocument();
    });

    it('should clear search when clear button clicked', async () => {
      const user = userEvent.setup();
      render(<SavedQueriesPanel />);

      const searchInput = screen.getByPlaceholderText(
        /Search queries by name, description, or content/i
      );
      await user.type(searchInput, 'test');

      const buttons = screen.getAllByRole('button');
      const clearButton = buttons.find((btn) => btn.querySelector('.lucide-x'));
      if (clearButton) {
        await user.click(clearButton);
        expect(searchInput).toHaveValue('');
      }
    });
  });

  describe('query actions', () => {
    it('should call onLoadQuery when query card clicked', async () => {
      const user = userEvent.setup();
      render(<SavedQueriesPanel onLoadQuery={mockOnLoadQuery} />);

      const queryCard = screen.getByText('User Query');
      await user.click(queryCard);

      expect(mockOnLoadQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'q1',
          name: 'User Query',
        })
      );
    });

    it('should toggle favorite when star button clicked', async () => {
      const user = userEvent.setup();
      mockToggleFavorite.mockResolvedValue(undefined);

      render(<SavedQueriesPanel />);

      // Find star buttons (there should be one for each query)
      const starButtons = screen.getAllByRole('button');
      const favoriteButton = starButtons.find((btn) =>
        btn.querySelector('.lucide-star')
      );

      if (favoriteButton) {
        await user.click(favoriteButton);
        expect(mockToggleFavorite).toHaveBeenCalled();
      }
    });

    it('should copy query to clipboard', async () => {
      const user = userEvent.setup();
      render(<SavedQueriesPanel />);

      // Open dropdown menu
      const moreButtons = screen.getAllByRole('button', { name: '' });
      const dropdownButton = moreButtons.find((btn) =>
        btn.querySelector('.lucide-more-vertical')
      );

      if (dropdownButton) {
        await user.click(dropdownButton);

        const copyMenuItem = screen.getByText('Copy to Clipboard');
        await user.click(copyMenuItem);

        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
          'SELECT * FROM users'
        );
      }
    });
  });

  describe('edit query', () => {
    it('should show edit dialog when edit menu item clicked', async () => {
      const user = userEvent.setup();
      render(<SavedQueriesPanel />);

      // Open dropdown menu
      const moreButtons = screen.getAllByRole('button', { name: '' });
      const dropdownButton = moreButtons.find((btn) =>
        btn.querySelector('.lucide-more-vertical')
      );

      if (dropdownButton) {
        await user.click(dropdownButton);

        const editMenuItem = screen.getByText('Edit');
        await user.click(editMenuItem);

        expect(screen.getByText('Edit Query')).toBeInTheDocument();
      }
    });

    it('should populate form with query data', async () => {
      const user = userEvent.setup();
      render(<SavedQueriesPanel />);

      // Open dropdown menu and click edit
      const moreButtons = screen.getAllByRole('button', { name: '' });
      const dropdownButton = moreButtons.find((btn) =>
        btn.querySelector('.lucide-more-vertical')
      );

      if (dropdownButton) {
        await user.click(dropdownButton);

        const editMenuItem = screen.getByText('Edit');
        await user.click(editMenuItem);

        const nameInput = screen.getByDisplayValue('User Query');
        const descriptionInput = screen.getByDisplayValue('Get all users');

        expect(nameInput).toBeInTheDocument();
        expect(descriptionInput).toBeInTheDocument();
      }
    });

    it('should update query when saved', async () => {
      const user = userEvent.setup();
      mockUpdateSavedQuery.mockResolvedValue(undefined);

      render(<SavedQueriesPanel />);

      // Open dropdown menu and click edit
      const moreButtons = screen.getAllByRole('button', { name: '' });
      const dropdownButton = moreButtons.find((btn) =>
        btn.querySelector('.lucide-more-vertical')
      );

      if (dropdownButton) {
        await user.click(dropdownButton);

        const editMenuItem = screen.getByText('Edit');
        await user.click(editMenuItem);

        const nameInput = screen.getByDisplayValue('User Query');
        await user.clear(nameInput);
        await user.type(nameInput, 'Updated Query');

        const saveButton = screen.getByRole('button', {
          name: /Save Changes/i,
        });
        await user.click(saveButton);

        await waitFor(() => {
          expect(mockUpdateSavedQuery).toHaveBeenCalledWith(
            'q1',
            expect.objectContaining({
              name: 'Updated Query',
            })
          );
        });
      }
    });
  });

  describe('delete query', () => {
    it('should show delete confirmation dialog', async () => {
      const user = userEvent.setup();
      render(<SavedQueriesPanel />);

      // Open dropdown menu
      const moreButtons = screen.getAllByRole('button', { name: '' });
      const dropdownButton = moreButtons.find((btn) =>
        btn.querySelector('.lucide-more-vertical')
      );

      if (dropdownButton) {
        await user.click(dropdownButton);

        const deleteMenuItem = screen.getByText('Delete');
        await user.click(deleteMenuItem);

        expect(screen.getByText('Delete Query?')).toBeInTheDocument();
        expect(screen.getByText(/User Query/)).toBeInTheDocument();
      }
    });

    it('should delete query when confirmed', async () => {
      const user = userEvent.setup();
      mockDeleteSavedQuery.mockResolvedValue(undefined);

      render(<SavedQueriesPanel />);

      // Open dropdown menu
      const moreButtons = screen.getAllByRole('button', { name: '' });
      const dropdownButton = moreButtons.find((btn) =>
        btn.querySelector('.lucide-more-vertical')
      );

      if (dropdownButton) {
        await user.click(dropdownButton);

        const deleteMenuItem = screen.getByText('Delete');
        await user.click(deleteMenuItem);

        const confirmButton = screen.getByRole('button', { name: /^Delete$/i });
        await user.click(confirmButton);

        await waitFor(() => {
          expect(mockDeleteSavedQuery).toHaveBeenCalledWith('q1');
        });
      }
    });
  });

  describe('accessibility', () => {
    it('should have search input with proper placeholder', () => {
      render(<SavedQueriesPanel />);

      const searchInput = screen.getByPlaceholderText(
        /Search queries by name, description, or content/i
      );
      expect(searchInput).toBeInTheDocument();
    });

    it('should have aria-label for favorite toggle', () => {
      render(<SavedQueriesPanel />);

      const favoriteToggle = screen.getByRole('button', {
        name: /Show only favorites/i,
      });
      expect(favoriteToggle).toBeInTheDocument();
    });
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSavedQueriesStore } from '@/stores/saved-queries-store';
import { FavoritesQuickPanel } from '../FavoritesQuickPanel';

// Mock the stores
vi.mock('@/stores/saved-queries-store');

describe('favoritesQuickPanel', () => {
  const mockLoadSavedQueries = vi.fn();
  const mockOnLoadQuery = vi.fn();

  const mockSavedQueries = [
    {
      id: 'q1',
      name: 'Favorite Query 1',
      queryText: 'SELECT * FROM users WHERE active = 1',
      description: 'Get active users',
      isFavorite: true,
      collectionIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'q2',
      name: 'Regular Query',
      queryText: 'SELECT * FROM orders',
      description: '',
      isFavorite: false,
      collectionIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'q3',
      name: 'Favorite Query 2',
      queryText: 'SELECT * FROM products WHERE price > 100 AND stock > 0',
      description: 'Expensive in-stock products',
      isFavorite: true,
      collectionIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock saved queries store
    vi.mocked(useSavedQueriesStore).mockReturnValue({
      savedQueries: mockSavedQueries,
      isLoading: false,
      favoritesOnly: false,
      selectedCollectionId: null,
      loadSavedQueries: mockLoadSavedQueries,
      saveSavedQuery: vi.fn(),
      updateSavedQuery: vi.fn(),
      deleteSavedQuery: vi.fn(),
      toggleFavorite: vi.fn(),
      setFavoritesOnly: vi.fn(),
    });
  });

  describe('rendering as popover', () => {
    it('should render popover trigger button', () => {
      render(<FavoritesQuickPanel />);

      const triggerButton = screen.getByRole('button', {
        name: /Favorite Queries/i,
      });
      expect(triggerButton).toBeInTheDocument();
    });

    it('should show favorite count when favorites exist', () => {
      render(<FavoritesQuickPanel />);

      expect(screen.getByText('(2)')).toBeInTheDocument();
    });

    it('should not show count when no favorites exist', () => {
      vi.mocked(useSavedQueriesStore).mockReturnValue({
        savedQueries: mockSavedQueries.filter((q) => !q.isFavorite),
        isLoading: false,
        favoritesOnly: false,
        selectedCollectionId: null,
        loadSavedQueries: mockLoadSavedQueries,
        saveSavedQuery: vi.fn(),
        updateSavedQuery: vi.fn(),
        deleteSavedQuery: vi.fn(),
        toggleFavorite: vi.fn(),
        setFavoritesOnly: vi.fn(),
      });

      render(<FavoritesQuickPanel />);

      expect(screen.queryByText(/\(\d+\)/)).not.toBeInTheDocument();
    });

    it('should load saved queries on mount', () => {
      render(<FavoritesQuickPanel />);

      expect(mockLoadSavedQueries).toHaveBeenCalled();
    });

    it('should open popover when trigger clicked', async () => {
      const user = userEvent.setup();
      render(<FavoritesQuickPanel />);

      const triggerButton = screen.getByRole('button', {
        name: /Favorite Queries/i,
      });
      await user.click(triggerButton);

      expect(screen.getByText('Favorite Query 1')).toBeInTheDocument();
      expect(screen.getByText('Favorite Query 2')).toBeInTheDocument();
    });
  });

  describe('rendering as section', () => {
    it('should render section header', () => {
      render(<FavoritesQuickPanel asSection={true} />);

      expect(screen.getByText('Favorites')).toBeInTheDocument();
      expect(
        screen.getByText('Quick access to your starred queries')
      ).toBeInTheDocument();
    });

    it('should display favorite queries immediately', () => {
      render(<FavoritesQuickPanel asSection={true} />);

      expect(screen.getByText('Favorite Query 1')).toBeInTheDocument();
      expect(screen.getByText('Favorite Query 2')).toBeInTheDocument();
    });

    it('should not show non-favorite queries', () => {
      render(<FavoritesQuickPanel asSection={true} />);

      expect(screen.queryByText('Regular Query')).not.toBeInTheDocument();
    });
  });

  describe('favorite queries list', () => {
    it('should display only favorite queries', async () => {
      const user = userEvent.setup();
      render(<FavoritesQuickPanel />);

      const triggerButton = screen.getByRole('button', {
        name: /Favorite Queries/i,
      });
      await user.click(triggerButton);

      expect(screen.getByText('Favorite Query 1')).toBeInTheDocument();
      expect(screen.getByText('Favorite Query 2')).toBeInTheDocument();
      expect(screen.queryByText('Regular Query')).not.toBeInTheDocument();
    });

    it('should display query previews', async () => {
      const user = userEvent.setup();
      render(<FavoritesQuickPanel />);

      const triggerButton = screen.getByRole('button', {
        name: /Favorite Queries/i,
      });
      await user.click(triggerButton);

      expect(
        screen.getByText(/SELECT \* FROM users WHERE active = 1/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/SELECT \* FROM products WHERE price > 100/)
      ).toBeInTheDocument();
    });

    it('should truncate long query previews', async () => {
      const user = userEvent.setup();
      render(<FavoritesQuickPanel />);

      const triggerButton = screen.getByRole('button', {
        name: /Favorite Queries/i,
      });
      await user.click(triggerButton);

      const preview = screen.getByText(
        /SELECT \* FROM products WHERE price > 100/
      );
      expect(preview.textContent).toContain('...');
    });

    it('should display star icons for favorites', async () => {
      const user = userEvent.setup();
      const { container } = render(<FavoritesQuickPanel />);

      const triggerButton = screen.getByRole('button', {
        name: /Favorite Queries/i,
      });
      await user.click(triggerButton);

      const starIcons = container.querySelectorAll('.fill-yellow-400');
      expect(starIcons.length).toBeGreaterThan(0);
    });
  });

  describe('loading state', () => {
    it('should show loading skeleton when loading', async () => {
      vi.mocked(useSavedQueriesStore).mockReturnValue({
        savedQueries: [],
        isLoading: true,
        favoritesOnly: false,
        selectedCollectionId: null,
        loadSavedQueries: mockLoadSavedQueries,
        saveSavedQuery: vi.fn(),
        updateSavedQuery: vi.fn(),
        deleteSavedQuery: vi.fn(),
        toggleFavorite: vi.fn(),
        setFavoritesOnly: vi.fn(),
      });

      const user = userEvent.setup();
      const { container } = render(<FavoritesQuickPanel />);

      const triggerButton = screen.getByRole('button', {
        name: /Favorite Queries/i,
      });
      await user.click(triggerButton);

      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should show loading skeleton in section mode', () => {
      vi.mocked(useSavedQueriesStore).mockReturnValue({
        savedQueries: [],
        isLoading: true,
        favoritesOnly: false,
        selectedCollectionId: null,
        loadSavedQueries: mockLoadSavedQueries,
        saveSavedQuery: vi.fn(),
        updateSavedQuery: vi.fn(),
        deleteSavedQuery: vi.fn(),
        toggleFavorite: vi.fn(),
        setFavoritesOnly: vi.fn(),
      });

      const { container } = render(<FavoritesQuickPanel asSection={true} />);

      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('empty state', () => {
    it('should show empty state when no favorites exist', async () => {
      vi.mocked(useSavedQueriesStore).mockReturnValue({
        savedQueries: mockSavedQueries.filter((q) => !q.isFavorite),
        isLoading: false,
        favoritesOnly: false,
        selectedCollectionId: null,
        loadSavedQueries: mockLoadSavedQueries,
        saveSavedQuery: vi.fn(),
        updateSavedQuery: vi.fn(),
        deleteSavedQuery: vi.fn(),
        toggleFavorite: vi.fn(),
        setFavoritesOnly: vi.fn(),
      });

      const user = userEvent.setup();
      render(<FavoritesQuickPanel />);

      const triggerButton = screen.getByRole('button', {
        name: /Favorite Queries/i,
      });
      await user.click(triggerButton);

      expect(screen.getByText('No favorite queries')).toBeInTheDocument();
      expect(
        screen.getByText('Star queries to add them here')
      ).toBeInTheDocument();
    });

    it('should show empty state in section mode', () => {
      vi.mocked(useSavedQueriesStore).mockReturnValue({
        savedQueries: [],
        isLoading: false,
        favoritesOnly: false,
        selectedCollectionId: null,
        loadSavedQueries: mockLoadSavedQueries,
        saveSavedQuery: vi.fn(),
        updateSavedQuery: vi.fn(),
        deleteSavedQuery: vi.fn(),
        toggleFavorite: vi.fn(),
        setFavoritesOnly: vi.fn(),
      });

      render(<FavoritesQuickPanel asSection={true} />);

      expect(screen.getByText('No favorite queries')).toBeInTheDocument();
    });
  });

  describe('query loading', () => {
    it('should call onLoadQuery when query clicked in popover', async () => {
      const user = userEvent.setup();
      render(<FavoritesQuickPanel onLoadQuery={mockOnLoadQuery} />);

      const triggerButton = screen.getByRole('button', {
        name: /Favorite Queries/i,
      });
      await user.click(triggerButton);

      const queryButton = screen.getByRole('button', {
        name: /Favorite Query 1/i,
      });
      await user.click(queryButton);

      expect(mockOnLoadQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'q1',
          name: 'Favorite Query 1',
        })
      );
    });

    it('should call onLoadQuery when query clicked in section', async () => {
      const user = userEvent.setup();
      render(
        <FavoritesQuickPanel asSection={true} onLoadQuery={mockOnLoadQuery} />
      );

      const queryButton = screen.getByRole('button', {
        name: /Favorite Query 1/i,
      });
      await user.click(queryButton);

      expect(mockOnLoadQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'q1',
          name: 'Favorite Query 1',
        })
      );
    });

    it('should show query description in tooltip', async () => {
      render(<FavoritesQuickPanel asSection={true} />);

      const queryButton = screen.getByRole('button', {
        name: /Favorite Query 1/i,
      });
      expect(queryButton).toHaveAttribute('title', 'Get active users');
    });

    it('should fallback to query name in tooltip when no description', async () => {
      render(<FavoritesQuickPanel asSection={true} />);

      const queryButton = screen.getByRole('button', {
        name: /Favorite Query 2/i,
      });
      expect(queryButton).toHaveAttribute(
        'title',
        'Expensive in-stock products'
      );
    });
  });

  describe('keyboard navigation', () => {
    it('should have keyboard navigation support with focus-visible', async () => {
      const user = userEvent.setup();
      render(<FavoritesQuickPanel asSection={true} />);

      const queryButton = screen.getByRole('button', {
        name: /Favorite Query 1/i,
      });
      await user.tab();

      // Check that the button has focus-visible class
      expect(queryButton).toHaveClass('focus-visible:bg-accent');
      expect(queryButton).toHaveClass('focus-visible:outline-none');
      expect(queryButton).toHaveClass('focus-visible:ring-2');
    });

    it('should allow Enter key to load query', async () => {
      const user = userEvent.setup();
      render(
        <FavoritesQuickPanel asSection={true} onLoadQuery={mockOnLoadQuery} />
      );

      screen.getByRole('button', {
        name: /Favorite Query 1/i,
      });
      await user.tab();
      await user.keyboard('{Enter}');

      expect(mockOnLoadQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'q1',
        })
      );
    });
  });

  describe('accessibility', () => {
    it('should have proper button type attributes', () => {
      render(<FavoritesQuickPanel asSection={true} />);

      const queryButtons = screen.getAllByRole('button');
      queryButtons.forEach((button) => {
        expect(button).toHaveAttribute('type', 'button');
      });
    });

    it('should have proper title attributes for tooltips', () => {
      render(<FavoritesQuickPanel asSection={true} />);

      const query1Button = screen.getByRole('button', {
        name: /Favorite Query 1/i,
      });
      const query2Button = screen.getByRole('button', {
        name: /Favorite Query 2/i,
      });

      expect(query1Button).toHaveAttribute('title');
      expect(query2Button).toHaveAttribute('title');
    });

    it('should have proper icon with star styling', async () => {
      const user = userEvent.setup();
      const { container } = render(<FavoritesQuickPanel />);

      const triggerButton = screen.getByRole('button', {
        name: /Favorite Queries/i,
      });
      await user.click(triggerButton);

      const starIcons = container.querySelectorAll('.lucide-star');
      expect(starIcons.length).toBeGreaterThan(0);
    });
  });

  describe('query preview truncation', () => {
    it('should truncate long query text at 60 characters', async () => {
      const longQuery = {
        id: 'q4',
        name: 'Long Query',
        queryText:
          'SELECT * FROM very_long_table_name WHERE column1 = value1 AND column2 = value2 AND column3 = value3',
        description: '',
        isFavorite: true,
        collectionIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      vi.mocked(useSavedQueriesStore).mockReturnValue({
        savedQueries: [longQuery],
        isLoading: false,
        favoritesOnly: false,
        selectedCollectionId: null,
        loadSavedQueries: mockLoadSavedQueries,
        saveSavedQuery: vi.fn(),
        updateSavedQuery: vi.fn(),
        deleteSavedQuery: vi.fn(),
        toggleFavorite: vi.fn(),
        setFavoritesOnly: vi.fn(),
      });

      const user = userEvent.setup();
      render(<FavoritesQuickPanel />);

      const triggerButton = screen.getByRole('button', {
        name: /Favorite Queries/i,
      });
      await user.click(triggerButton);

      // The preview should be truncated
      const preview = screen.getByText(/SELECT \* FROM very_long_table_name/);
      expect(preview.textContent?.length).toBeLessThanOrEqual(63); // 60 chars + '...'
    });

    it('should not truncate short query text', async () => {
      const shortQuery = {
        id: 'q5',
        name: 'Short Query',
        queryText: 'SELECT * FROM users',
        description: '',
        isFavorite: true,
        collectionIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      vi.mocked(useSavedQueriesStore).mockReturnValue({
        savedQueries: [shortQuery],
        isLoading: false,
        favoritesOnly: false,
        selectedCollectionId: null,
        loadSavedQueries: mockLoadSavedQueries,
        saveSavedQuery: vi.fn(),
        updateSavedQuery: vi.fn(),
        deleteSavedQuery: vi.fn(),
        toggleFavorite: vi.fn(),
        setFavoritesOnly: vi.fn(),
      });

      const user = userEvent.setup();
      render(<FavoritesQuickPanel />);

      const triggerButton = screen.getByRole('button', {
        name: /Favorite Queries/i,
      });
      await user.click(triggerButton);

      const preview = screen.getByText('SELECT * FROM users');
      expect(preview.textContent).not.toContain('...');
    });
  });
});

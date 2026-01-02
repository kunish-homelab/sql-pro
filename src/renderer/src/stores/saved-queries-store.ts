import type {
  SavedQuery,
  SaveSavedQueryRequest,
  UpdateSavedQueryRequest,
  DeleteSavedQueryRequest,
  ToggleFavoriteRequest,
} from '@shared/types';
import { create } from 'zustand';
import { sqlPro } from '@/lib/api';

interface SavedQueriesState {
  // Saved queries data
  savedQueries: SavedQuery[];
  isLoading: boolean;

  // Filter state
  favoritesOnly: boolean;
  selectedCollectionId: string | null;

  // Actions
  loadSavedQueries: () => Promise<void>;
  saveSavedQuery: (
    query: Omit<SavedQuery, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  updateSavedQuery: (
    id: string,
    updates: Partial<Omit<SavedQuery, 'id' | 'createdAt'>>
  ) => Promise<void>;
  deleteSavedQuery: (id: string) => Promise<void>;
  toggleFavorite: (id: string, isFavorite: boolean) => Promise<void>;
  setFavoritesOnly: (favoritesOnly: boolean) => void;
  setSelectedCollection: (collectionId: string | null) => void;
}

const initialState = {
  savedQueries: [] as SavedQuery[],
  isLoading: false,
  favoritesOnly: false,
  selectedCollectionId: null as string | null,
};

// Generate a unique ID for saved queries
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

export const useSavedQueriesStore = create<SavedQueriesState>((set, get) => ({
  ...initialState,

  loadSavedQueries: async () => {
    set({ isLoading: true });
    try {
      const response = await sqlPro.savedQueries.getAll({});
      if (response.success && response.queries) {
        set({ savedQueries: response.queries, isLoading: false });
      } else {
        set({ savedQueries: [], isLoading: false });
      }
    } catch {
      set({ savedQueries: [], isLoading: false });
    }
  },

  saveSavedQuery: async (query) => {
    const newQuery: SavedQuery = {
      id: generateId(),
      ...query,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Optimistically update the UI
    set((state) => ({
      savedQueries: [newQuery, ...state.savedQueries],
    }));

    // Persist to storage in background
    try {
      const request: SaveSavedQueryRequest = { query: newQuery };
      const response = await sqlPro.savedQueries.save(request);

      // If the backend returns a different query (with server-generated ID), update it
      if (response.success && response.query) {
        set((state) => ({
          savedQueries: state.savedQueries.map((q) =>
            q.id === newQuery.id ? response.query! : q
          ),
        }));
      }
    } catch {
      // If save fails, remove the optimistically added query
      set((state) => ({
        savedQueries: state.savedQueries.filter((q) => q.id !== newQuery.id),
      }));
    }
  },

  updateSavedQuery: async (id, updates) => {
    // Store original query for rollback
    const originalQuery = get().savedQueries.find((q) => q.id === id);
    if (!originalQuery) return;

    // Optimistically update the UI
    set((state) => ({
      savedQueries: state.savedQueries.map((q) =>
        q.id === id
          ? { ...q, ...updates, updatedAt: new Date().toISOString() }
          : q
      ),
    }));

    // Persist to storage
    try {
      const request: UpdateSavedQueryRequest = { id, updates };
      const response = await sqlPro.savedQueries.update(request);

      // If the backend returns updated query, use it
      if (response.success && response.query) {
        set((state) => ({
          savedQueries: state.savedQueries.map((q) =>
            q.id === id ? response.query! : q
          ),
        }));
      }
    } catch {
      // If update fails, rollback to original query
      set((state) => ({
        savedQueries: state.savedQueries.map((q) =>
          q.id === id ? originalQuery : q
        ),
      }));
    }
  },

  deleteSavedQuery: async (id) => {
    // Store original queries for rollback
    const originalQueries = get().savedQueries;

    // Optimistically update the UI
    set((state) => ({
      savedQueries: state.savedQueries.filter((q) => q.id !== id),
    }));

    // Persist deletion to storage
    try {
      const request: DeleteSavedQueryRequest = { id };
      await sqlPro.savedQueries.delete(request);
    } catch {
      // If deletion fails, restore original queries
      set({ savedQueries: originalQueries });
    }
  },

  toggleFavorite: async (id, isFavorite) => {
    // Store original query for rollback
    const originalQuery = get().savedQueries.find((q) => q.id === id);
    if (!originalQuery) return;

    // Optimistically update the UI
    set((state) => ({
      savedQueries: state.savedQueries.map((q) =>
        q.id === id
          ? { ...q, isFavorite, updatedAt: new Date().toISOString() }
          : q
      ),
    }));

    // Persist to storage
    try {
      const request: ToggleFavoriteRequest = { id, isFavorite };
      const response = await sqlPro.savedQueries.toggleFavorite(request);

      // If the backend returns updated query, use it
      if (response.success && response.query) {
        set((state) => ({
          savedQueries: state.savedQueries.map((q) =>
            q.id === id ? response.query! : q
          ),
        }));
      }
    } catch {
      // If toggle fails, rollback to original query
      set((state) => ({
        savedQueries: state.savedQueries.map((q) =>
          q.id === id ? originalQuery : q
        ),
      }));
    }
  },

  setFavoritesOnly: (favoritesOnly) => set({ favoritesOnly }),

  setSelectedCollection: (selectedCollectionId) => set({ selectedCollectionId }),
}));

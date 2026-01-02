import type {
  QueryCollection,
  SaveCollectionRequest,
  UpdateCollectionRequest,
  DeleteCollectionRequest,
  AddQueryToCollectionRequest,
  RemoveQueryFromCollectionRequest,
} from '@shared/types';
import { create } from 'zustand';
import { sqlPro } from '@/lib/api';

interface CollectionsState {
  // Collections data
  collections: QueryCollection[];
  isLoading: boolean;

  // Selection state
  selectedCollectionId: string | null;

  // Actions
  loadCollections: () => Promise<void>;
  saveCollection: (
    collection: Omit<QueryCollection, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  updateCollection: (
    id: string,
    updates: Partial<Omit<QueryCollection, 'id' | 'createdAt'>>
  ) => Promise<void>;
  deleteCollection: (id: string) => Promise<void>;
  addQueryToCollection: (queryId: string, collectionId: string) => Promise<void>;
  removeQueryFromCollection: (queryId: string, collectionId: string) => Promise<void>;
  setSelectedCollection: (collectionId: string | null) => void;
}

const initialState = {
  collections: [] as QueryCollection[],
  isLoading: false,
  selectedCollectionId: null as string | null,
};

// Generate a unique ID for collections
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

export const useCollectionsStore = create<CollectionsState>((set, get) => ({
  ...initialState,

  loadCollections: async () => {
    set({ isLoading: true });
    try {
      const response = await sqlPro.collections.getAll({});
      if (response.success && response.collections) {
        set({ collections: response.collections, isLoading: false });
      } else {
        set({ collections: [], isLoading: false });
      }
    } catch {
      set({ collections: [], isLoading: false });
    }
  },

  saveCollection: async (collection) => {
    const newCollection: QueryCollection = {
      id: generateId(),
      ...collection,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      queryIds: collection.queryIds || [],
    };

    // Optimistically update the UI
    set((state) => ({
      collections: [newCollection, ...state.collections],
    }));

    // Persist to storage in background
    try {
      const request: SaveCollectionRequest = { collection: newCollection };
      const response = await sqlPro.collections.save(request);

      // If the backend returns a different collection (with server-generated ID), update it
      if (response.success && response.collection) {
        set((state) => ({
          collections: state.collections.map((c) =>
            c.id === newCollection.id ? response.collection! : c
          ),
        }));
      }
    } catch {
      // If save fails, remove the optimistically added collection
      set((state) => ({
        collections: state.collections.filter((c) => c.id !== newCollection.id),
      }));
    }
  },

  updateCollection: async (id, updates) => {
    // Store original collection for rollback
    const originalCollection = get().collections.find((c) => c.id === id);
    if (!originalCollection) return;

    // Optimistically update the UI
    set((state) => ({
      collections: state.collections.map((c) =>
        c.id === id
          ? { ...c, ...updates, updatedAt: new Date().toISOString() }
          : c
      ),
    }));

    // Persist to storage
    try {
      const request: UpdateCollectionRequest = { id, updates };
      const response = await sqlPro.collections.update(request);

      // If the backend returns updated collection, use it
      if (response.success && response.collection) {
        set((state) => ({
          collections: state.collections.map((c) =>
            c.id === id ? response.collection! : c
          ),
        }));
      }
    } catch {
      // If update fails, rollback to original collection
      set((state) => ({
        collections: state.collections.map((c) =>
          c.id === id ? originalCollection : c
        ),
      }));
    }
  },

  deleteCollection: async (id) => {
    // Store original collections for rollback
    const originalCollections = get().collections;

    // Optimistically update the UI
    set((state) => ({
      collections: state.collections.filter((c) => c.id !== id),
      // Clear selection if deleting the selected collection
      selectedCollectionId: state.selectedCollectionId === id ? null : state.selectedCollectionId,
    }));

    // Persist deletion to storage
    try {
      const request: DeleteCollectionRequest = { id };
      await sqlPro.collections.delete(request);
    } catch {
      // If deletion fails, restore original collections
      set({ collections: originalCollections });
    }
  },

  addQueryToCollection: async (queryId, collectionId) => {
    // Store original collection for rollback
    const originalCollection = get().collections.find((c) => c.id === collectionId);
    if (!originalCollection) return;

    // Check if query is already in collection
    if (originalCollection.queryIds.includes(queryId)) return;

    // Optimistically update the UI
    set((state) => ({
      collections: state.collections.map((c) =>
        c.id === collectionId
          ? {
              ...c,
              queryIds: [...c.queryIds, queryId],
              updatedAt: new Date().toISOString(),
            }
          : c
      ),
    }));

    // Persist to storage
    try {
      const request: AddQueryToCollectionRequest = { queryId, collectionId };
      const response = await sqlPro.collections.addQuery(request);

      // If the backend returns updated collection, use it
      if (response.success && response.collection) {
        set((state) => ({
          collections: state.collections.map((c) =>
            c.id === collectionId ? response.collection! : c
          ),
        }));
      }
    } catch {
      // If add fails, rollback to original collection
      set((state) => ({
        collections: state.collections.map((c) =>
          c.id === collectionId ? originalCollection : c
        ),
      }));
    }
  },

  removeQueryFromCollection: async (queryId, collectionId) => {
    // Store original collection for rollback
    const originalCollection = get().collections.find((c) => c.id === collectionId);
    if (!originalCollection) return;

    // Optimistically update the UI
    set((state) => ({
      collections: state.collections.map((c) =>
        c.id === collectionId
          ? {
              ...c,
              queryIds: c.queryIds.filter((id) => id !== queryId),
              updatedAt: new Date().toISOString(),
            }
          : c
      ),
    }));

    // Persist to storage
    try {
      const request: RemoveQueryFromCollectionRequest = { queryId, collectionId };
      const response = await sqlPro.collections.removeQuery(request);

      // If the backend returns updated collection, use it
      if (response.success && response.collection) {
        set((state) => ({
          collections: state.collections.map((c) =>
            c.id === collectionId ? response.collection! : c
          ),
        }));
      }
    } catch {
      // If remove fails, rollback to original collection
      set((state) => ({
        collections: state.collections.map((c) =>
          c.id === collectionId ? originalCollection : c
        ),
      }));
    }
  },

  setSelectedCollection: (selectedCollectionId) => set({ selectedCollectionId }),
}));

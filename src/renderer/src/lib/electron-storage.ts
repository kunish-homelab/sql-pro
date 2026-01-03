/**
 * Electron Store Persistence Utility for Zustand
 *
 * Provides a custom storage adapter that persists zustand state
 * to the main process via IPC, using electron-store under the hood.
 * This ensures all app data is stored in a single, consistent location.
 */

import type {
  RendererConnectionState,
  RendererDiagramState,
  RendererPanelWidths,
  RendererSettingsState,
  RendererStoreSchema,
} from '@shared/types/renderer-store';
import type { PersistStorage, StorageValue } from 'zustand/middleware';
import { sqlPro } from './api';

// Re-export types for convenience
export type {
  RendererConnectionState,
  RendererDiagramState,
  RendererPanelWidths,
  RendererSettingsState,
  RendererStoreSchema,
};

/**
 * Synchronous storage adapter for initial state loading
 * Uses a cache that's populated on app start
 */
class SyncElectronStorage<T> implements PersistStorage<T> {
  private storeKey: keyof RendererStoreSchema;
  private cache: StorageValue<T> | null = null;
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  constructor(storeKey: keyof RendererStoreSchema) {
    this.storeKey = storeKey;
  }

  /**
   * Initialize the cache by loading data from electron-store
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        const response = await sqlPro.rendererStore.get({
          key: this.storeKey,
        });
        if (response.success && response.data !== undefined) {
          this.cache = { state: response.data as T };
        }
      } catch (error) {
        console.error(
          `Failed to initialize ${this.storeKey} from electron-store:`,
          error
        );
      } finally {
        this.initialized = true;
      }
    })();

    return this.initPromise;
  }

  getItem(_name: string): StorageValue<T> | null {
    // Return cached value synchronously
    return this.cache;
  }

  setItem(_name: string, value: StorageValue<T>): void {
    // Update cache immediately
    this.cache = value;

    // Persist to electron-store asynchronously
    sqlPro.rendererStore
      .set({
        key: this.storeKey,
        value: value.state,
      })
      .catch((error) => {
        console.error(
          `Failed to persist ${this.storeKey} to electron-store:`,
          error
        );
      });
  }

  removeItem(_name: string): void {
    this.cache = null;
    sqlPro.rendererStore.reset({ key: this.storeKey }).catch((error) => {
      console.error(
        `Failed to reset ${this.storeKey} in electron-store:`,
        error
      );
    });
  }
}

// Storage instances for each store type
const storageInstances = new Map<
  keyof RendererStoreSchema,
  SyncElectronStorage<unknown>
>();

/**
 * Get or create a synchronous storage adapter for a specific store key
 */
export function getElectronStorage<T>(
  storeKey: keyof RendererStoreSchema
): SyncElectronStorage<T> {
  let storage = storageInstances.get(storeKey);
  if (!storage) {
    storage = new SyncElectronStorage<T>(storeKey);
    storageInstances.set(storeKey, storage);
  }
  return storage as SyncElectronStorage<T>;
}

/**
 * Initialize all storage instances - call this early in app startup
 */
export async function initializeElectronStorage(): Promise<void> {
  const keys: (keyof RendererStoreSchema)[] = [
    'settings',
    'diagram',
    'panelWidths',
    'connectionUi',
  ];

  await Promise.all(
    keys.map(async (key) => {
      const storage = getElectronStorage(key);
      await storage.initialize();
    })
  );
}

/**
 * Helper to check if running in Electron environment
 */
export function isElectronEnvironment(): boolean {
  return typeof window !== 'undefined' && !!window.sqlPro?.rendererStore;
}

/**
 * Create a hybrid storage that uses electron-store in Electron
 * and falls back to localStorage in web/development mode
 */
export function createHybridStorage<T>(
  storeKey: keyof RendererStoreSchema
): PersistStorage<T> {
  if (isElectronEnvironment()) {
    return getElectronStorage<T>(storeKey);
  }

  // Fallback to localStorage for non-Electron environments
  return {
    getItem: (name: string): StorageValue<T> | null => {
      const str = localStorage.getItem(name);
      if (!str) return null;
      try {
        return JSON.parse(str) as StorageValue<T>;
      } catch {
        return null;
      }
    },
    setItem: (name: string, value: StorageValue<T>): void => {
      localStorage.setItem(name, JSON.stringify(value));
    },
    removeItem: (name: string): void => {
      localStorage.removeItem(name);
    },
  };
}

/**
 * Create a storage adapter for connection store with custom serialization
 * Handles Map and Set types properly
 */
export function createConnectionStorage<T>(): PersistStorage<T> {
  const electronStorage = isElectronEnvironment()
    ? getElectronStorage<T>('connectionUi')
    : null;

  return {
    getItem: (name: string): StorageValue<T> | null => {
      if (electronStorage) {
        const result = electronStorage.getItem(name);
        if (result && result.state) {
          const state = result.state as Record<string, unknown>;
          // Transform flat arrays back to Maps/Sets in the state
          return {
            ...result,
            state: {
              ...state,
              // Restore Set from array
              expandedFolderIds: new Set(
                (state.expandedFolderIds as string[]) || []
              ),
              // Restore Map types (they're not persisted in electron-store, so use empty)
              connections: state.connections ?? new Map(),
              schemas: state.schemas ?? new Map(),
              profiles: state.profiles ?? new Map(),
              folders: state.folders ?? new Map(),
            } as T,
          };
        }
        return null;
      }

      // Fallback to localStorage with existing serialization
      const str = localStorage.getItem(name);
      if (!str) return null;
      try {
        const parsed = JSON.parse(str) as StorageValue<Record<string, unknown>>;
        const state = parsed.state;
        return {
          ...parsed,
          state: {
            ...state,
            // Restore Map/Set types
            connections: new Map(
              (state.connections as [string, unknown][]) || []
            ),
            schemas: new Map((state.schemas as [string, unknown][]) || []),
            profiles: new Map((state.profiles as [string, unknown][]) || []),
            folders: new Map((state.folders as [string, unknown][]) || []),
            expandedFolderIds: new Set(
              (state.expandedFolderIds as string[]) || []
            ),
          } as T,
        };
      } catch {
        return null;
      }
    },

    setItem: (name: string, value: StorageValue<T>): void => {
      const state = value.state as Record<string, unknown>;

      if (electronStorage) {
        // For electron-store, only persist UI state
        const uiState: RendererConnectionState = {
          activeConnectionId: (state.activeConnectionId as string) ?? null,
          expandedFolderIds: Array.from(
            (state.expandedFolderIds as Set<string>) || new Set()
          ),
          connectionTabOrder: (state.connectionTabOrder as string[]) || [],
          connectionColors:
            (state.connectionColors as Record<string, string>) || {},
        };

        sqlPro.rendererStore
          .set({
            key: 'connectionUi',
            value: uiState,
          })
          .catch((error) => {
            console.error(
              'Failed to persist connectionUi to electron-store:',
              error
            );
          });
      } else {
        // Fallback to localStorage with full serialization
        const serialized = {
          ...value,
          state: {
            ...state,
            connections: Array.from(
              (state.connections as Map<string, unknown>) || new Map()
            ),
            schemas: Array.from(
              (state.schemas as Map<string, unknown>) || new Map()
            ),
            profiles: Array.from(
              (state.profiles as Map<string, unknown>) || new Map()
            ),
            folders: Array.from(
              (state.folders as Map<string, unknown>) || new Map()
            ),
            expandedFolderIds: Array.from(
              (state.expandedFolderIds as Set<string>) || new Set()
            ),
          },
        };
        localStorage.setItem(name, JSON.stringify(serialized));
      }
    },

    removeItem: (name: string): void => {
      if (electronStorage) {
        sqlPro.rendererStore.reset({ key: 'connectionUi' }).catch((error) => {
          console.error(
            'Failed to reset connectionUi in electron-store:',
            error
          );
        });
      } else {
        localStorage.removeItem(name);
      }
    },
  };
}

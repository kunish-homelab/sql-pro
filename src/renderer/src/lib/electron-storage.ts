/**
 * Electron Store Persistence Utility for Zustand
 *
 * Provides centralized persistence for renderer state via IPC to electron-store.
 * Uses a simple cache-based approach: load all data at startup, persist on change.
 */

import type {
  RendererConnectionState,
  RendererDiagramState,
  RendererPanelWidths,
  RendererSettingsState,
  RendererStoreSchema,
} from '@shared/types/renderer-store';
import { sqlPro } from './api';

// Re-export types for convenience
export type {
  RendererConnectionState,
  RendererDiagramState,
  RendererPanelWidths,
  RendererSettingsState,
  RendererStoreSchema,
};

// ============ Cache for loaded data ============

interface ElectronStorageCache {
  settings: RendererSettingsState | null;
  diagram: RendererDiagramState | null;
  panelWidths: RendererPanelWidths | null;
  connectionUi: RendererConnectionState | null;
}

const cache: ElectronStorageCache = {
  settings: null,
  diagram: null,
  panelWidths: null,
  connectionUi: null,
};

let initialized = false;

// ============ Initialization ============

/**
 * Initialize electron storage by loading all data from electron-store.
 * Call this early in app startup before accessing any cached data.
 */
export async function initializeElectronStorage(): Promise<void> {
  if (initialized) return;

  const keys: (keyof RendererStoreSchema)[] = [
    'settings',
    'diagram',
    'panelWidths',
    'connectionUi',
  ];

  await Promise.all(
    keys.map(async (key) => {
      try {
        const response = await sqlPro.rendererStore.get({ key });
        if (response.success && response.data !== undefined) {
          // Use explicit type assertion based on key
          switch (key) {
            case 'settings':
              cache.settings = response.data as RendererSettingsState;
              break;
            case 'diagram':
              cache.diagram = response.data as RendererDiagramState;
              break;
            case 'panelWidths':
              cache.panelWidths = response.data as RendererPanelWidths;
              break;
            case 'connectionUi':
              cache.connectionUi = response.data as RendererConnectionState;
              break;
          }
        }
      } catch (error) {
        console.error(`Failed to load ${key} from electron-store:`, error);
      }
    })
  );

  initialized = true;
}

/**
 * Check if electron storage has been initialized
 */
export function isStorageInitialized(): boolean {
  return initialized;
}

/**
 * Helper to check if running in Electron environment
 */
export function isElectronEnvironment(): boolean {
  return typeof window !== 'undefined' && !!window.sqlPro?.rendererStore;
}

// ============ Getters ============

/**
 * Get cached settings state
 */
export function getCachedSettings(): RendererSettingsState | null {
  return cache.settings;
}

/**
 * Get cached diagram state
 */
export function getCachedDiagram(): RendererDiagramState | null {
  return cache.diagram;
}

/**
 * Get cached panel widths
 */
export function getCachedPanelWidths(): RendererPanelWidths | null {
  return cache.panelWidths;
}

/**
 * Get cached connection UI state
 */
export function getCachedConnectionUi(): RendererConnectionState | null {
  return cache.connectionUi;
}

// ============ Persistence Functions ============

/**
 * Persist settings to electron-store
 */
export function persistSettings(settings: RendererSettingsState): void {
  cache.settings = settings;
  sqlPro.rendererStore
    .set({ key: 'settings', value: settings })
    .catch((error) => {
      console.error('Failed to persist settings to electron-store:', error);
    });
}

/**
 * Persist diagram state to electron-store
 */
export function persistDiagram(diagram: RendererDiagramState): void {
  cache.diagram = diagram;
  sqlPro.rendererStore
    .set({ key: 'diagram', value: diagram })
    .catch((error) => {
      console.error('Failed to persist diagram to electron-store:', error);
    });
}

/**
 * Persist panel widths to electron-store
 */
export function persistPanelWidths(panelWidths: RendererPanelWidths): void {
  cache.panelWidths = panelWidths;
  sqlPro.rendererStore
    .set({ key: 'panelWidths', value: panelWidths })
    .catch((error) => {
      console.error('Failed to persist panelWidths to electron-store:', error);
    });
}

/**
 * Persist connection UI state to electron-store
 */
export function persistConnectionUi(
  connectionUi: RendererConnectionState
): void {
  cache.connectionUi = connectionUi;
  sqlPro.rendererStore
    .set({ key: 'connectionUi', value: connectionUi })
    .catch((error) => {
      console.error('Failed to persist connectionUi to electron-store:', error);
    });
}

// ============ Store Hydration ============

// Store setters - will be registered by each store
type StoreHydrator<T> = (data: T) => void;

const storeHydrators = {
  settings: null as StoreHydrator<RendererSettingsState> | null,
  diagram: null as StoreHydrator<RendererDiagramState> | null,
  connectionUi: null as StoreHydrator<RendererConnectionState> | null,
};

/**
 * Register a store hydrator function for settings
 */
export function registerSettingsHydrator(
  hydrator: StoreHydrator<RendererSettingsState>
): void {
  storeHydrators.settings = hydrator;
}

/**
 * Register a store hydrator function for diagram
 */
export function registerDiagramHydrator(
  hydrator: StoreHydrator<RendererDiagramState>
): void {
  storeHydrators.diagram = hydrator;
}

/**
 * Register a store hydrator function for connectionUi
 */
export function registerConnectionUiHydrator(
  hydrator: StoreHydrator<RendererConnectionState>
): void {
  storeHydrators.connectionUi = hydrator;
}

/**
 * Hydrate all registered stores with cached data.
 * Call this after initializeElectronStorage and after stores are created.
 */
export function hydrateStores(): void {
  if (cache.settings && storeHydrators.settings) {
    storeHydrators.settings(cache.settings);
  }
  if (cache.diagram && storeHydrators.diagram) {
    storeHydrators.diagram(cache.diagram);
  }
  if (cache.connectionUi && storeHydrators.connectionUi) {
    storeHydrators.connectionUi(cache.connectionUi);
  }
}

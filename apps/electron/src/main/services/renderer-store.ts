/**
 * Renderer Store Persistence Service
 *
 * Provides persistence for renderer (UI) state using electron-store.
 * This allows zustand stores in the renderer process to persist their state
 * via IPC calls to the main process, ensuring all app data is stored in one place.
 */

import type {
  RendererConnectionState,
  RendererDiagramState,
  RendererPanelWidths,
  RendererSettingsState,
  RendererStoreSchema,
} from '@shared/types/renderer-store';
import Store from 'electron-store';

// ============ Default Values ============

const DEFAULT_SETTINGS: RendererSettingsState = {
  editorVimMode: true,
  appVimMode: false,
  fonts: {
    editor: { family: '', size: 14 },
    table: { family: '', size: 14 },
    ui: { family: '', size: 13 },
    syncAll: true,
  },
  tabSize: 2,
  pageSize: 100,
  restoreSession: true,
  sidebarCollapsed: false,
};

const DEFAULT_DIAGRAM: RendererDiagramState = {
  nodePositionsMap: {},
  viewportMap: {},
  showColumns: true,
  showTypes: true,
};

const DEFAULT_PANEL_WIDTHS: RendererPanelWidths = {};

const DEFAULT_CONNECTION_UI: RendererConnectionState = {
  activeConnectionId: null,
  expandedFolderIds: [],
  connectionTabOrder: [],
  connectionColors: {},
};

// ============ Store Instance ============

let _rendererStore: Store<RendererStoreSchema> | null = null;

function getRendererStore(): Store<RendererStoreSchema> {
  if (!_rendererStore) {
    _rendererStore = new Store<RendererStoreSchema>({
      name: 'sql-pro-renderer-state',
      defaults: {
        settings: DEFAULT_SETTINGS,
        diagram: DEFAULT_DIAGRAM,
        panelWidths: DEFAULT_PANEL_WIDTHS,
        connectionUi: DEFAULT_CONNECTION_UI,
      },
      // Enable schema migration for future updates
      migrations: {
        // Migration from localStorage-based storage (v1.0.0)
        '>=1.0.0': (_store) => {
          // Future migrations can be added here
          // The migration will run when upgrading from older versions
        },
      },
    });
  }
  return _rendererStore;
}

// ============ Generic Operations ============

/**
 * Get a specific section of the renderer store
 */
export function getRendererState<K extends keyof RendererStoreSchema>(
  key: K
): RendererStoreSchema[K] {
  const defaults: RendererStoreSchema = {
    settings: DEFAULT_SETTINGS,
    diagram: DEFAULT_DIAGRAM,
    panelWidths: DEFAULT_PANEL_WIDTHS,
    connectionUi: DEFAULT_CONNECTION_UI,
  };
  const result = getRendererStore().get(key, defaults[key]);
  return result;
}

/**
 * Set a specific section of the renderer store
 */
export function setRendererState<K extends keyof RendererStoreSchema>(
  key: K,
  value: RendererStoreSchema[K]
): void {
  getRendererStore().set(key, value);
}

/**
 * Update a specific section of the renderer store (merge)
 */
export function updateRendererState<K extends keyof RendererStoreSchema>(
  key: K,
  updates: Partial<RendererStoreSchema[K]>
): void {
  const current = getRendererState(key);
  getRendererStore().set(key, { ...current, ...updates });
}

/**
 * Reset a specific section to defaults
 */
export function resetRendererState<K extends keyof RendererStoreSchema>(
  key: K
): void {
  const defaults: RendererStoreSchema = {
    settings: DEFAULT_SETTINGS,
    diagram: DEFAULT_DIAGRAM,
    panelWidths: DEFAULT_PANEL_WIDTHS,
    connectionUi: DEFAULT_CONNECTION_UI,
  };
  getRendererStore().set(key, defaults[key]);
}

// ============ Settings Operations ============

export function getSettings(): RendererSettingsState {
  return getRendererState('settings');
}

export function setSettings(settings: RendererSettingsState): void {
  setRendererState('settings', settings);
}

export function updateSettings(updates: Partial<RendererSettingsState>): void {
  updateRendererState('settings', updates);
}

// ============ Diagram Operations ============

export function getDiagramState(): RendererDiagramState {
  return getRendererState('diagram');
}

export function setDiagramState(state: RendererDiagramState): void {
  setRendererState('diagram', state);
}

export function updateDiagramState(
  updates: Partial<RendererDiagramState>
): void {
  updateRendererState('diagram', updates);
}

// ============ Panel Widths Operations ============

export function getPanelWidths(): RendererPanelWidths {
  return getRendererState('panelWidths');
}

export function setPanelWidth(key: string, width: number): void {
  const widths = getPanelWidths();
  setRendererState('panelWidths', { ...widths, [key]: width });
}

export function getPanelWidth(key: string): number | undefined {
  return getPanelWidths()[key];
}

// ============ Connection UI Operations ============

export function getConnectionUiState(): RendererConnectionState {
  return getRendererState('connectionUi');
}

export function setConnectionUiState(state: RendererConnectionState): void {
  setRendererState('connectionUi', state);
}

export function updateConnectionUiState(
  updates: Partial<RendererConnectionState>
): void {
  updateRendererState('connectionUi', updates);
}

// ============ Utility Functions ============

export function clearAllRendererState(): void {
  getRendererStore().clear();
}

export function getRendererStorePath(): string {
  return getRendererStore().path;
}

// Export store getter for advanced usage
export { getRendererStore };

// Export defaults for use in renderer
export const RENDERER_STORE_DEFAULTS = {
  settings: DEFAULT_SETTINGS,
  diagram: DEFAULT_DIAGRAM,
  panelWidths: DEFAULT_PANEL_WIDTHS,
  connectionUi: DEFAULT_CONNECTION_UI,
} as const;

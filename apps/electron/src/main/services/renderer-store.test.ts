import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock electron-store
let mockStoreData: Record<string, unknown> = {};

vi.mock('electron-store', () => {
  return {
    default: class MockStore {
      constructor(config: { name: string; defaults: Record<string, unknown> }) {
        // Initialize with defaults
        mockStoreData = { ...config.defaults };
      }

      get(key: string, defaultValue?: unknown) {
        return mockStoreData[key] ?? defaultValue;
      }

      set(key: string, value: unknown) {
        mockStoreData[key] = value;
      }

      delete(key: string) {
        delete mockStoreData[key];
      }

      clear() {
        mockStoreData = {};
      }

      get path() {
        return '/mock/path/sql-pro-renderer-state.json';
      }
    },
  };
});

describe('renderer-store Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockStoreData = {};
  });

  describe('settings operations', () => {
    it('should get default settings', async () => {
      const { getSettings } = await import('./renderer-store');
      const settings = getSettings();

      expect(settings).toEqual({
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
      });
    });

    it('should update settings', async () => {
      const { getSettings, updateSettings } = await import('./renderer-store');

      updateSettings({ editorVimMode: false });
      const settings = getSettings();

      expect(settings.editorVimMode).toBe(false);
    });
  });

  describe('diagram operations', () => {
    it('should get default diagram state', async () => {
      const { getDiagramState } = await import('./renderer-store');
      const state = getDiagramState();

      expect(state).toEqual({
        nodePositionsMap: {},
        viewportMap: {},
        showColumns: true,
        showTypes: true,
      });
    });

    it('should update diagram state', async () => {
      const { getDiagramState, updateDiagramState } =
        await import('./renderer-store');

      updateDiagramState({ showColumns: false });
      const state = getDiagramState();

      expect(state.showColumns).toBe(false);
    });
  });

  describe('panel widths operations', () => {
    it('should get empty panel widths by default', async () => {
      const { getPanelWidths } = await import('./renderer-store');
      const widths = getPanelWidths();

      expect(widths).toEqual({});
    });

    it('should set and get panel width', async () => {
      const { getPanelWidth, setPanelWidth } = await import('./renderer-store');

      setPanelWidth('sidebar', 250);
      const width = getPanelWidth('sidebar');

      expect(width).toBe(250);
    });
  });

  describe('connection UI operations', () => {
    it('should get default connection UI state', async () => {
      const { getConnectionUiState } = await import('./renderer-store');
      const state = getConnectionUiState();

      expect(state).toEqual({
        activeConnectionId: null,
        expandedFolderIds: [],
        connectionTabOrder: [],
        connectionColors: {},
      });
    });

    it('should update connection UI state', async () => {
      const { getConnectionUiState, updateConnectionUiState } =
        await import('./renderer-store');

      updateConnectionUiState({
        activeConnectionId: 'test-id',
        expandedFolderIds: ['folder-1', 'folder-2'],
      });
      const state = getConnectionUiState();

      expect(state.activeConnectionId).toBe('test-id');
      expect(state.expandedFolderIds).toEqual(['folder-1', 'folder-2']);
    });
  });

  describe('generic operations', () => {
    it('should reset state to defaults', async () => {
      const { getRendererState, setRendererState, resetRendererState } =
        await import('./renderer-store');

      // Set custom value
      setRendererState('settings', {
        editorVimMode: false,
        appVimMode: true,
        fonts: {
          editor: { family: 'Fira Code', size: 16 },
          table: { family: 'Fira Code', size: 16 },
          ui: { family: 'Fira Code', size: 16 },
          syncAll: false,
        },
        tabSize: 4,
        pageSize: 200,
        restoreSession: false,
        sidebarCollapsed: true,
      });

      // Reset
      resetRendererState('settings');

      // Check defaults
      const settings = getRendererState('settings');
      expect(settings.editorVimMode).toBe(true);
      expect(settings.tabSize).toBe(2);
    });
  });
});

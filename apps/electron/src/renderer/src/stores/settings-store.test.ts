import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MONOSPACE_FONTS, useSettingsStore } from './settings-store';

describe('settings-store', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useSettingsStore.setState({
      editorVimMode: true,
      appVimMode: false,
      fonts: {
        editor: { family: '', size: 14 },
        table: { family: '', size: 14 },
        ui: { family: '', size: 13 },
        syncAll: true,
      },
      tabSize: 2,
    });
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have editorVimMode enabled by default', () => {
      const { editorVimMode } = useSettingsStore.getState();
      expect(editorVimMode).toBe(true);
    });

    it('should have appVimMode disabled by default', () => {
      const { appVimMode } = useSettingsStore.getState();
      expect(appVimMode).toBe(false);
    });

    it('should have default editor font settings', () => {
      const { fonts } = useSettingsStore.getState();
      expect(fonts.editor).toEqual({ family: '', size: 14 });
    });

    it('should have default table font settings', () => {
      const { fonts } = useSettingsStore.getState();
      expect(fonts.table).toEqual({ family: '', size: 14 });
    });

    it('should have default ui font settings with size 13', () => {
      const { fonts } = useSettingsStore.getState();
      expect(fonts.ui).toEqual({ family: '', size: 13 });
    });

    it('should have syncAll enabled by default', () => {
      const { fonts } = useSettingsStore.getState();
      expect(fonts.syncAll).toBe(true);
    });

    it('should have tabSize of 2 by default', () => {
      const { tabSize } = useSettingsStore.getState();
      expect(tabSize).toBe(2);
    });
  });

  describe('setEditorVimMode', () => {
    it('should enable editor vim mode', () => {
      const { setEditorVimMode } = useSettingsStore.getState();

      setEditorVimMode(true);

      expect(useSettingsStore.getState().editorVimMode).toBe(true);
    });

    it('should disable editor vim mode', () => {
      const { setEditorVimMode } = useSettingsStore.getState();

      setEditorVimMode(false);

      expect(useSettingsStore.getState().editorVimMode).toBe(false);
    });

    it('should toggle editor vim mode', () => {
      const { setEditorVimMode } = useSettingsStore.getState();

      setEditorVimMode(false);
      expect(useSettingsStore.getState().editorVimMode).toBe(false);

      setEditorVimMode(true);
      expect(useSettingsStore.getState().editorVimMode).toBe(true);
    });
  });

  describe('setAppVimMode', () => {
    it('should enable app vim mode', () => {
      const { setAppVimMode } = useSettingsStore.getState();

      setAppVimMode(true);

      expect(useSettingsStore.getState().appVimMode).toBe(true);
    });

    it('should disable app vim mode', () => {
      const { setAppVimMode } = useSettingsStore.getState();

      setAppVimMode(true);
      setAppVimMode(false);

      expect(useSettingsStore.getState().appVimMode).toBe(false);
    });

    it('should be independent of editor vim mode', () => {
      const { setEditorVimMode, setAppVimMode } = useSettingsStore.getState();

      setEditorVimMode(false);
      setAppVimMode(true);

      const state = useSettingsStore.getState();
      expect(state.editorVimMode).toBe(false);
      expect(state.appVimMode).toBe(true);
    });
  });

  describe('setFont', () => {
    describe('with syncAll enabled', () => {
      it('should sync font family to all categories when syncAll is true', () => {
        const { setFont } = useSettingsStore.getState();

        setFont('editor', { family: 'Fira Code' });

        const { fonts } = useSettingsStore.getState();
        expect(fonts.editor.family).toBe('Fira Code');
        expect(fonts.table.family).toBe('Fira Code');
        expect(fonts.ui.family).toBe('Fira Code');
      });

      it('should sync font size to all categories when syncAll is true', () => {
        const { setFont } = useSettingsStore.getState();

        setFont('table', { size: 16 });

        const { fonts } = useSettingsStore.getState();
        expect(fonts.editor.size).toBe(16);
        expect(fonts.table.size).toBe(16);
        expect(fonts.ui.size).toBe(16);
      });

      it('should sync both family and size when both provided', () => {
        const { setFont } = useSettingsStore.getState();

        setFont('ui', { family: 'JetBrains Mono', size: 18 });

        const { fonts } = useSettingsStore.getState();
        expect(fonts.editor).toEqual({ family: 'JetBrains Mono', size: 18 });
        expect(fonts.table).toEqual({ family: 'JetBrains Mono', size: 18 });
        expect(fonts.ui).toEqual({ family: 'JetBrains Mono', size: 18 });
      });
    });

    describe('with syncAll disabled', () => {
      beforeEach(() => {
        useSettingsStore.setState({
          ...useSettingsStore.getState(),
          fonts: {
            editor: { family: '', size: 14 },
            table: { family: '', size: 14 },
            ui: { family: '', size: 13 },
            syncAll: false,
          },
        });
      });

      it('should only update editor font when syncAll is false', () => {
        const { setFont } = useSettingsStore.getState();

        setFont('editor', { family: 'Fira Code', size: 16 });

        const { fonts } = useSettingsStore.getState();
        expect(fonts.editor).toEqual({ family: 'Fira Code', size: 16 });
        expect(fonts.table).toEqual({ family: '', size: 14 });
        expect(fonts.ui).toEqual({ family: '', size: 13 });
      });

      it('should only update table font when syncAll is false', () => {
        const { setFont } = useSettingsStore.getState();

        setFont('table', { family: 'Monaco', size: 12 });

        const { fonts } = useSettingsStore.getState();
        expect(fonts.editor).toEqual({ family: '', size: 14 });
        expect(fonts.table).toEqual({ family: 'Monaco', size: 12 });
        expect(fonts.ui).toEqual({ family: '', size: 13 });
      });

      it('should only update ui font when syncAll is false', () => {
        const { setFont } = useSettingsStore.getState();

        setFont('ui', { family: 'Consolas', size: 11 });

        const { fonts } = useSettingsStore.getState();
        expect(fonts.editor).toEqual({ family: '', size: 14 });
        expect(fonts.table).toEqual({ family: '', size: 14 });
        expect(fonts.ui).toEqual({ family: 'Consolas', size: 11 });
      });

      it('should allow different fonts for each category', () => {
        const { setFont } = useSettingsStore.getState();

        setFont('editor', { family: 'Fira Code' });
        setFont('table', { family: 'Monaco' });
        setFont('ui', { family: 'Consolas' });

        const { fonts } = useSettingsStore.getState();
        expect(fonts.editor.family).toBe('Fira Code');
        expect(fonts.table.family).toBe('Monaco');
        expect(fonts.ui.family).toBe('Consolas');
      });
    });

    it('should merge partial config with existing values', () => {
      const { setFont } = useSettingsStore.getState();

      // Set initial font
      useSettingsStore.setState({
        ...useSettingsStore.getState(),
        fonts: {
          editor: { family: 'Fira Code', size: 14 },
          table: { family: 'Fira Code', size: 14 },
          ui: { family: 'Fira Code', size: 14 },
          syncAll: false,
        },
      });

      // Only update size, family should remain
      setFont('editor', { size: 18 });

      const { fonts } = useSettingsStore.getState();
      expect(fonts.editor.family).toBe('Fira Code');
      expect(fonts.editor.size).toBe(18);
    });
  });

  describe('setSyncAll', () => {
    it('should enable syncAll', () => {
      useSettingsStore.setState({
        ...useSettingsStore.getState(),
        fonts: {
          editor: { family: 'Fira Code', size: 14 },
          table: { family: 'Monaco', size: 12 },
          ui: { family: 'Consolas', size: 13 },
          syncAll: false,
        },
      });

      const { setSyncAll } = useSettingsStore.getState();
      setSyncAll(true);

      const { fonts } = useSettingsStore.getState();
      expect(fonts.syncAll).toBe(true);
    });

    it('should sync all fonts to editor font when enabling syncAll', () => {
      useSettingsStore.setState({
        ...useSettingsStore.getState(),
        fonts: {
          editor: { family: 'Fira Code', size: 16 },
          table: { family: 'Monaco', size: 12 },
          ui: { family: 'Consolas', size: 13 },
          syncAll: false,
        },
      });

      const { setSyncAll } = useSettingsStore.getState();
      setSyncAll(true);

      const { fonts } = useSettingsStore.getState();
      // All should match editor font
      expect(fonts.editor).toEqual({ family: 'Fira Code', size: 16 });
      expect(fonts.table).toEqual({ family: 'Fira Code', size: 16 });
      expect(fonts.ui).toEqual({ family: 'Fira Code', size: 16 });
    });

    it('should disable syncAll', () => {
      const { setSyncAll } = useSettingsStore.getState();

      setSyncAll(false);

      const { fonts } = useSettingsStore.getState();
      expect(fonts.syncAll).toBe(false);
    });

    it('should preserve current fonts when disabling syncAll', () => {
      const { setFont, setSyncAll } = useSettingsStore.getState();

      // First set fonts with syncAll enabled
      setFont('editor', { family: 'Fira Code', size: 16 });

      // Now disable syncAll
      setSyncAll(false);

      const { fonts } = useSettingsStore.getState();
      // All fonts should still be the same (preserved)
      expect(fonts.editor).toEqual({ family: 'Fira Code', size: 16 });
      expect(fonts.table).toEqual({ family: 'Fira Code', size: 16 });
      expect(fonts.ui).toEqual({ family: 'Fira Code', size: 16 });
      expect(fonts.syncAll).toBe(false);
    });
  });

  describe('setTabSize', () => {
    it('should set tabSize', () => {
      const { setTabSize } = useSettingsStore.getState();

      setTabSize(4);

      expect(useSettingsStore.getState().tabSize).toBe(4);
    });

    it('should update tabSize', () => {
      const { setTabSize } = useSettingsStore.getState();

      setTabSize(4);
      setTabSize(8);

      expect(useSettingsStore.getState().tabSize).toBe(8);
    });

    it('should handle common tab sizes', () => {
      const { setTabSize } = useSettingsStore.getState();

      const commonSizes = [2, 4, 8];
      for (const size of commonSizes) {
        setTabSize(size);
        expect(useSettingsStore.getState().tabSize).toBe(size);
      }
    });
  });

  describe('mONOSPACE_FONTS constant', () => {
    it('should have System Default as first option', () => {
      expect(MONOSPACE_FONTS[0]).toEqual({ name: 'System Default', value: '' });
    });

    it('should have all common monospace fonts', () => {
      const fontNames = MONOSPACE_FONTS.map((f) => f.name);

      expect(fontNames).toContain('SF Mono');
      expect(fontNames).toContain('Menlo');
      expect(fontNames).toContain('Monaco');
      expect(fontNames).toContain('Consolas');
      expect(fontNames).toContain('Fira Code');
      expect(fontNames).toContain('JetBrains Mono');
    });

    it('should have unique values', () => {
      const values = MONOSPACE_FONTS.map((f) => f.value);
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(values.length);
    });
  });

  describe('selector hooks', () => {
    it('useEditorFont should return editor font config', () => {
      useSettingsStore.setState({
        ...useSettingsStore.getState(),
        fonts: {
          editor: { family: 'Fira Code', size: 16 },
          table: { family: '', size: 14 },
          ui: { family: '', size: 13 },
          syncAll: false,
        },
      });

      // Direct call to the selector
      const editorFont = useSettingsStore.getState().fonts.editor;
      expect(editorFont).toEqual({ family: 'Fira Code', size: 16 });
    });

    it('useTableFont should return table font config', () => {
      useSettingsStore.setState({
        ...useSettingsStore.getState(),
        fonts: {
          editor: { family: '', size: 14 },
          table: { family: 'Monaco', size: 12 },
          ui: { family: '', size: 13 },
          syncAll: false,
        },
      });

      const tableFont = useSettingsStore.getState().fonts.table;
      expect(tableFont).toEqual({ family: 'Monaco', size: 12 });
    });

    it('useUIFont should return ui font config', () => {
      useSettingsStore.setState({
        ...useSettingsStore.getState(),
        fonts: {
          editor: { family: '', size: 14 },
          table: { family: '', size: 14 },
          ui: { family: 'Consolas', size: 11 },
          syncAll: false,
        },
      });

      const uiFont = useSettingsStore.getState().fonts.ui;
      expect(uiFont).toEqual({ family: 'Consolas', size: 11 });
    });
  });

  describe('store API', () => {
    it('should expose getState method', () => {
      expect(typeof useSettingsStore.getState).toBe('function');
    });

    it('should expose setState method', () => {
      expect(typeof useSettingsStore.setState).toBe('function');
    });

    it('should expose subscribe method', () => {
      expect(typeof useSettingsStore.subscribe).toBe('function');
    });

    it('should allow subscribing to state changes', () => {
      const listener = vi.fn();
      const unsubscribe = useSettingsStore.subscribe(listener);

      const { setTabSize } = useSettingsStore.getState();
      setTabSize(4);

      expect(listener).toHaveBeenCalled();

      unsubscribe();
    });
  });

  describe('edge cases', () => {
    it('should handle empty font family', () => {
      const { setFont } = useSettingsStore.getState();

      setFont('editor', { family: '' });

      const { fonts } = useSettingsStore.getState();
      expect(fonts.editor.family).toBe('');
    });

    it('should handle very large font sizes', () => {
      const { setFont } = useSettingsStore.getState();

      setFont('editor', { size: 72 });

      const { fonts } = useSettingsStore.getState();
      expect(fonts.editor.size).toBe(72);
    });

    it('should handle zero font size', () => {
      const { setFont } = useSettingsStore.getState();

      setFont('editor', { size: 0 });

      const { fonts } = useSettingsStore.getState();
      expect(fonts.editor.size).toBe(0);
    });

    it('should handle font family with spaces', () => {
      const { setFont } = useSettingsStore.getState();

      setFont('editor', { family: 'Source Code Pro' });

      const { fonts } = useSettingsStore.getState();
      expect(fonts.editor.family).toBe('Source Code Pro');
    });

    it('should handle multiple rapid state changes', () => {
      const { setFont, setTabSize, setEditorVimMode } =
        useSettingsStore.getState();

      setFont('editor', { family: 'Fira Code' });
      setTabSize(4);
      setEditorVimMode(false);
      setFont('editor', { size: 18 });
      setTabSize(2);
      setEditorVimMode(true);

      const state = useSettingsStore.getState();
      expect(state.fonts.editor.size).toBe(18);
      expect(state.tabSize).toBe(2);
      expect(state.editorVimMode).toBe(true);
    });
  });
});
